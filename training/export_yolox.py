"""
YOLOX checkpoint → ONNX laid out exactly like the app's decoder expects (src/services/detector/yoloDecode.ts):
  input  [1, 3, S, S]  RGB 0..1           (onnx2tf turns it into NHWC [1, S, S, 3], what the resize plugin gives)
  output [1, 4 + C, N] cx, cy, w, h in 0..1, then per-class score = objectness × class prob
Then: bash training/export_tflite.sh  (WSL, onnx2tf → assets/model/clover.tflite)

Usage: python training/export_yolox.py [checkpoint]   (default: YOLOX_outputs/luck_tiny/best_ckpt.pth)
"""
import importlib.util
import sys
from pathlib import Path

import torch
from torch import nn

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "third_party" / "YOLOX"))
CKPT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "YOLOX_outputs" / "luck_tiny" / "best_ckpt.pth"
OUT = ROOT / "yolox_luck.onnx"


def load_exp():
    spec = importlib.util.spec_from_file_location("luck_exp", ROOT / "yolox_exp.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.Exp()


class ConvFocus(nn.Module):
    """YOLOX Focus (2x2 space-to-depth) + RGB 0..1 → BGR 0..255 as one fixed 2x2/stride-2 conv.
    onnx2tf mangles Focus's strided slices; a conv with one-hot weights is exact and converts cleanly."""

    def __init__(self, focus: nn.Module):
        super().__init__()
        self.space = nn.Conv2d(3, 12, 2, 2, bias=False)
        w = torch.zeros(12, 3, 2, 2)
        # Focus concat order: top-left, bottom-left, top-right, bottom-right; 3 channels each.
        for p, (dy, dx) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
            for c in range(3):
                w[p * 3 + c, 2 - c, dy, dx] = 255.0  # BGR channel c ← RGB channel 2 - c
        self.space.weight = nn.Parameter(w, requires_grad=False)
        self.conv = focus.conv

    def forward(self, x):
        return self.conv(self.space(x))


class AppLayout(nn.Module):
    def __init__(self, model: nn.Module, size: int):
        super().__init__()
        self.model, self.size = model, size
        model.backbone.backbone.stem = ConvFocus(model.backbone.backbone.stem)
        # YOLOX builds its anchor grid at run time (meshgrid/Expand), which onnx2tf can't convert;
        # bake the same grid in as constants and decode here (yolo_head.decode_outputs).
        grids, strides = [], []
        for s in model.head.strides:
            n = size // s
            yv, xv = torch.meshgrid(torch.arange(n), torch.arange(n), indexing="ij")
            grids.append(torch.stack((xv, yv), 2).reshape(-1, 2))
            strides.append(torch.full((n * n, 1), s))
        self.register_buffer("grid", torch.cat(grids).float()[None])
        self.register_buffer("stride", torch.cat(strides).float()[None])

    def forward(self, x):
        # Same as YOLOXHead.forward (inference), but each level goes channels-last *before* flattening:
        # onnx2tf mis-orders YOLOX's flatten(NCHW)+concat, while permute→reshape matches TFLite's NHWC.
        head = self.model.head
        levels = []
        for k, feat in enumerate(self.model.backbone(x)):  # ConvFocus takes the app's RGB 0..1
            feat = head.stems[k](feat)
            cls_feat, reg_feat = head.cls_convs[k](feat), head.reg_convs[k](feat)
            out = torch.cat([head.reg_preds[k](reg_feat), head.obj_preds[k](reg_feat).sigmoid(),
                             head.cls_preds[k](cls_feat).sigmoid()], 1)
            levels.append(out.permute(0, 2, 3, 1).reshape(out.shape[0], -1, out.shape[1]))
        y = torch.cat(levels, 1)  # [B, N, 5 + C]: raw box, sigmoid obj/cls
        xy = (y[..., :2] + self.grid) * self.stride
        wh = torch.exp(y[..., 2:4]) * self.stride
        boxes = torch.cat([xy, wh], dim=-1) / self.size
        scores = y[..., 4:5] * y[..., 5:]
        return torch.cat([boxes, scores], dim=-1).permute(0, 2, 1)


def main():
    exp = load_exp()
    model = exp.get_model()
    state = torch.load(CKPT, map_location="cpu", weights_only=False)
    model.load_state_dict(state["model"])
    model.eval()
    size = exp.test_size[0]
    dummy = torch.rand(1, 3, size, size)
    with torch.no_grad():
        # Reference: stock YOLOX on the BGR 0..255 input it was trained on.
        model.head.decode_in_inference = True
        ref = model(torch.flip(dummy, dims=[1]) * 255.0)
        model.head.decode_in_inference = False
        wrapped = AppLayout(model, size).eval()
        out = wrapped(dummy)
    # Baked-in preprocessing + decode must match YOLOX's own.
    assert torch.allclose(out[:, :4] * size, ref[..., :4].permute(0, 2, 1), rtol=1e-3, atol=0.05)
    assert torch.allclose(out[:, 4:], (ref[..., 4:5] * ref[..., 5:]).permute(0, 2, 1), atol=1e-4)
    n = sum((size // s) ** 2 for s in (8, 16, 32))
    assert out.shape == (1, 4 + exp.num_classes, n), out.shape
    torch.onnx.export(wrapped, dummy, str(OUT), input_names=["images"], output_names=["output0"], opset_version=13, dynamo=False)
    print(f"✅ {OUT}  output {tuple(out.shape)}")


if __name__ == "__main__":
    main()
