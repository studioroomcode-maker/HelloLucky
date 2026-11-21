"""
Stage-2 Four-Leaf Clover Crop Verifier (MobileNetV3-Small, 224x224).

Why:
  Stage 1 (YOLOX-Tiny) finds candidate boxes in wide/live scenes, but sometimes mistakes
  overlapping three-leaf clovers for four-leafs. Stage 2 inspects a tight 1.5x crop around
  each candidate and outputs P(four_leaf) in [0, 1] (~2.5 MB FP16 TFLite, ~5-10 ms on device).

Data (zero leakage into valid / negatives_holdout):
  train/pos : merged/train four_leaf boxes
  train/neg : merged/train three_leaf boxes
            + YOLOX-mined hard false positives on negatives_inat & three_leaf
            + synthetic overlapped-three-leaf hard negatives (2x c1 cutouts)
            + random grass background crops
  val       : merged/valid four_leaf (pos) vs three_leaf (neg) + negatives_holdout YOLOX FPs

Usage:
  python training/train_verifier.py
  wsl -d Ubuntu -- bash training/export_verifier.sh
"""
import argparse
import math
import random
import shutil
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageFilter, ImageOps
from torch import nn
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import models, transforms

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "third_party" / "YOLOX"))

from export_yolox import AppLayout, load_exp  # noqa: E402
from luck_predict import PAD, SIZE as YOLO_SIZE, nms  # noqa: E402
from synthesize_composite import transform_cutout  # noqa: E402

MERGED = ROOT / "merged"
CUTOUTS = ROOT / "cutouts"
NEG_TRAIN_DIRS = [PROJECT / "clover_dataset" / "negatives_inat", PROJECT / "clover_dataset" / "three_leaf"]
NEG_HOLDOUT_DIR = PROJECT / "clover_dataset" / "negatives_holdout"
YOLO_CKPT = ROOT / "YOLOX_outputs" / "luck_tiny" / "best_ckpt.pth"

DATA_DIR = ROOT / "verifier_crops"
BEST_CKPT = ROOT / "verifier_best.pt"
ONNX_OUT = ROOT / "clover_verifier.onnx"

IMG_SIZE = 224
CROP_PAD = 1.5
TRAIN_SAVE_PAD = 1.9  # wider margin saved for train crops so random jitter stays inside the image
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def parse_boxes(label_path: Path, w: int, h: int):
    """Yields (cls, x0, y0, x1, y1) in pixels."""
    if not label_path.exists():
        return
    for line in label_path.read_text().splitlines():
        p = line.split()
        if len(p) < 5:
            continue
        cls = int(p[0])
        v = list(map(float, p[1:]))
        if len(v) == 4:
            cx, cy, bw, bh = v
            x0, y0, x1, y1 = (cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h
        else:
            x0, y0, x1, y1 = min(v[0::2]) * w, min(v[1::2]) * h, max(v[0::2]) * w, max(v[1::2]) * h
        x0, y0, x1, y1 = max(0.0, x0), max(0.0, y0), min(float(w), x1), min(float(h), y1)
        if x1 - x0 >= 8 and y1 - y0 >= 8:
            yield cls, x0, y0, x1, y1


def square_crop(im: Image.Image, box, pad: float, out_size: int = 256) -> Image.Image:
    """Matches src/services/detector/tiles.ts cloverSquare() framing."""
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    short = min(im.width, im.height)
    side = min(short, max(max(x1 - x0, y1 - y0) * pad, short * 0.07))
    left = max(0.0, min(im.width - side, cx - side / 2.0))
    top = max(0.0, min(im.height - side, cy - side / 2.0))
    crop = im.crop((round(left), round(top), round(left + side), round(top + side)))
    return crop.resize((out_size, out_size), Image.LANCZOS)


def mine_yolo_fps(img_paths: list[Path], out_dir: Path, pad: float, conf: float, device: torch.device, prefix: str) -> int:
    """Run current YOLOX detector to harvest hard false-positive boxes on negative photos."""
    exp = load_exp()
    raw = exp.get_model()
    state = torch.load(YOLO_CKPT, map_location="cpu", weights_only=False)
    raw.load_state_dict(state["model"])
    raw.eval()
    model = AppLayout(raw, YOLO_SIZE).eval().to(device)
    if device.type == "cuda":
        model.half()

    saved = 0
    bs = 16
    with torch.no_grad():
        for i in range(0, len(img_paths), bs):
            batch_paths = img_paths[i : i + bs]
            imgs, arrs, ks = [], [], []
            for p in batch_paths:
                im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
                imgs.append(im)
                k = YOLO_SIZE / max(im.size)
                resized = im.resize((round(im.width * k), round(im.height * k)), Image.BILINEAR)
                canvas = np.full((YOLO_SIZE, YOLO_SIZE, 3), PAD, np.float32)
                canvas[: resized.height, : resized.width] = np.asarray(resized, np.float32) / 255.0
                arrs.append(canvas.transpose(2, 0, 1))
                ks.append(k)
            t = torch.from_numpy(np.stack(arrs, 0)).to(device)
            if device.type == "cuda":
                t = t.half()
            outs = model(t).float().cpu().numpy()
            for p, im, out, k in zip(batch_paths, imgs, outs, ks):
                s0, s1 = out[4], out[5]
                sel = (s0 > s1) & (s0 >= conf)
                if not np.any(sel):
                    continue
                cx, cy, w, h = (out[:4, sel] * YOLO_SIZE) / k
                boxes = np.stack([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], 1)
                scores = s0[sel]
                for idx, j in enumerate(nms(boxes, scores, 0.45)[:5]):
                    crop = square_crop(im, tuple(boxes[j]), pad, out_size=256)
                    crop.save(out_dir / f"{prefix}_{p.stem}_{idx}.jpg", quality=92)
                    saved += 1
    return saved


def build_overlapped_three_leafs(bg_paths: list[Path], out_dir: Path, count: int, seed: int = 42) -> int:
    """Synthesize hard negatives: 2 overlapping three-leaf cutouts that mimic a 4-leaf clover."""
    rng = random.Random(seed)
    cuts = [Image.open(p).convert("RGBA") for p in sorted(CUTOUTS.glob("c1_*.png"))]
    if not cuts or not bg_paths:
        return 0
    canvas_sz = 256
    for i in range(count):
        bg = ImageOps.exif_transpose(Image.open(rng.choice(bg_paths))).convert("RGB")
        short = min(bg.size)
        side = rng.randint(max(64, short // 4), short)
        lx = rng.randint(0, max(0, bg.width - side))
        ly = rng.randint(0, max(0, bg.height - side))
        patch = bg.crop((lx, ly, lx + side, ly + side)).resize((canvas_sz, canvas_sz), Image.LANCZOS).convert("RGBA")

        # Two three-leaf cutouts placed close enough to overlap and look 4-leaf-like.
        base_w = round(rng.uniform(0.32, 0.50) * canvas_sz)
        cx, cy = canvas_sz // 2 + rng.randint(-18, 18), canvas_sz // 2 + rng.randint(-18, 18)
        offset = round(base_w * rng.uniform(0.22, 0.48))
        ang = rng.uniform(0, 2 * math.pi)
        dx, dy = round(math.cos(ang) * offset), round(math.sin(ang) * offset)

        for ox, oy in [(-dx // 2, -dy // 2), (dx // 2, dy // 2)]:
            piece = transform_cutout(
                rng.choice(cuts),
                round(base_w * rng.uniform(0.85, 1.15)),
                rng.uniform(0, 360),
                rng.random() < 0.5,
                rng.uniform(0.75, 1.15),
                rng.uniform(0.75, 1.15),
            )
            px = cx + ox - piece.width // 2
            py = cy + oy - piece.height // 2
            patch.alpha_composite(piece, (px, py))

        out_img = patch.convert("RGB")
        if rng.random() < 0.25:
            out_img = out_img.filter(ImageFilter.GaussianBlur(rng.uniform(0.4, 1.1)))
        out_img.save(out_dir / f"overlap3_{i:05d}.jpg", quality=90)
    return count


def build_crops(device: torch.device, force: bool = False):
    if DATA_DIR.exists() and not force:
        print(f"Using cached crops in {DATA_DIR} (pass --rebuild to regenerate)")
        return
    if DATA_DIR.exists():
        shutil.rmtree(DATA_DIR)
    for sub in ("train/pos", "train/neg", "val/pos", "val/neg", "holdout_fp"):
        (DATA_DIR / sub).mkdir(parents=True, exist_ok=True)

    # 1. Real boxes from merged/train and merged/valid
    for split, pad in [("train", TRAIN_SAVE_PAD), ("valid", CROP_PAD)]:
        dst = "train" if split == "train" else "val"
        n_pos = n_neg = 0
        for img_path in sorted((MERGED / split / "images").iterdir()):
            if img_path.suffix.lower() not in EXTS:
                continue
            label_path = MERGED / split / "labels" / f"{img_path.stem}.txt"
            if not label_path.exists():
                continue
            im = ImageOps.exif_transpose(Image.open(img_path)).convert("RGB")
            for idx, (cls, *box) in enumerate(parse_boxes(label_path, im.width, im.height)):
                if cls == 0:
                    square_crop(im, box, pad, 256).save(DATA_DIR / dst / "pos" / f"{img_path.stem}_{idx}.jpg", quality=92)
                    n_pos += 1
                elif cls == 1:
                    square_crop(im, box, pad, 256).save(DATA_DIR / dst / "neg" / f"{img_path.stem}_{idx}.jpg", quality=92)
                    n_neg += 1
        print(f"Real {split}: pos={n_pos}, neg={n_neg}")

    # 2. YOLOX-mined hard negatives on train negative dirs + holdout negative dir
    train_negs = [p for d in NEG_TRAIN_DIRS if d.is_dir() for p in sorted(d.iterdir()) if p.suffix.lower() in EXTS]
    mined_train = mine_yolo_fps(train_negs, DATA_DIR / "train" / "neg", TRAIN_SAVE_PAD, conf=0.08, device=device, prefix="yolo_fp")
    print(f"YOLOX-mined train hard negatives (conf>=0.08): {mined_train}")

    holdout_negs = sorted(p for p in NEG_HOLDOUT_DIR.iterdir() if p.suffix.lower() in EXTS)
    mined_holdout = mine_yolo_fps(holdout_negs, DATA_DIR / "holdout_fp", CROP_PAD, conf=0.15, device=device, prefix="holdout_fp")
    print(f"YOLOX-mined holdout FPs (conf>=0.15, eval only): {mined_holdout}")

    # 3. Overlapped 3-leaf synthetic hard negatives
    n_ov = build_overlapped_three_leafs(train_negs, DATA_DIR / "train" / "neg", count=1500)
    print(f"Synthetic overlapped 3-leaf hard negatives: {n_ov}")

    # 4. Random background crops from train negatives
    rng = random.Random(123)
    for i in range(800):
        im = ImageOps.exif_transpose(Image.open(rng.choice(train_negs))).convert("RGB")
        short = min(im.size)
        side = rng.randint(max(64, short // 5), short // 2)
        lx = rng.randint(0, max(0, im.width - side))
        ly = rng.randint(0, max(0, im.height - side))
        im.crop((lx, ly, lx + side, ly + side)).resize((256, 256), Image.LANCZOS).save(
            DATA_DIR / "train" / "neg" / f"randbg_{i:04d}.jpg", quality=90
        )
    print("Added 800 random grass background crops")


class CropDataset(Dataset):
    def __init__(self, items: list[tuple[Path, int]], tfm):
        self.items = items
        self.tfm = tfm

    def __len__(self):
        return len(self.items)

    def __getitem__(self, idx):
        path, label = self.items[idx]
        im = Image.open(path).convert("RGB")
        return self.tfm(im), torch.tensor(float(label), dtype=torch.float32)


class VerifierNet(nn.Module):
    """MobileNetV3-Small with ImageNet normalization baked in so app passes RGB 0..1 directly."""

    def __init__(self, pretrained: bool = True):
        super().__init__()
        weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        net = models.mobilenet_v3_small(weights=weights)
        in_features = net.classifier[-1].in_features
        net.classifier[-1] = nn.Linear(in_features, 1)
        self.net = net
        self.register_buffer("mean", torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    def forward(self, x):
        return self.net((x - self.mean) / self.std)


class ExportVerifier(nn.Module):
    def __init__(self, base: VerifierNet):
        super().__init__()
        self.base = base

    def forward(self, x):
        return torch.sigmoid(self.base(x))


@torch.no_grad()
def predict_probs(model: nn.Module, paths: list[Path], tfm, device: torch.device) -> np.ndarray:
    if not paths:
        return np.array([], dtype=np.float32)
    ds = CropDataset([(p, 0) for p in paths], tfm)
    dl = DataLoader(ds, batch_size=64, shuffle=False, num_workers=0)
    probs = []
    model.eval()
    for x, _ in dl:
        logits = model(x.to(device)).squeeze(-1)
        probs.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(probs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--rebuild", action="store_true")
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Device:", device)
    build_crops(device, force=args.rebuild)

    train_pos = [(p, 1) for p in sorted((DATA_DIR / "train" / "pos").glob("*.jpg"))]
    train_neg = [(p, 0) for p in sorted((DATA_DIR / "train" / "neg").glob("*.jpg"))]
    train_items = train_pos + train_neg
    print(f"Train split: pos={len(train_pos)}, neg={len(train_neg)}")

    val_pos_paths = sorted((DATA_DIR / "val" / "pos").glob("*.jpg"))
    val_neg_paths = sorted((DATA_DIR / "val" / "neg").glob("*.jpg"))
    holdout_fp_paths = sorted((DATA_DIR / "holdout_fp").glob("*.jpg"))
    print(f"Val split: pos={len(val_pos_paths)}, three_leaf_neg={len(val_neg_paths)}, holdout_fp={len(holdout_fp_paths)}")

    # Train crops were saved with pad=1.9 vs inference pad=1.5 → 1.5/1.9 ≈ 0.79 center scale.
    train_tfm = transforms.Compose([
        transforms.RandomRotation(180, interpolation=transforms.InterpolationMode.BILINEAR),
        transforms.RandomResizedCrop(IMG_SIZE, scale=(0.55, 0.90), ratio=(0.90, 1.11)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.25, hue=0.04),
        transforms.ToTensor(),
    ])
    val_tfm = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
    ])

    weights = [1.0 / len(train_pos)] * len(train_pos) + [1.0 / len(train_neg)] * len(train_neg)
    sampler = WeightedRandomSampler(weights, num_samples=len(train_pos) * 3, replacement=True)
    train_dl = DataLoader(CropDataset(train_items, train_tfm), batch_size=64, sampler=sampler, num_workers=4, pin_memory=True)

    model = VerifierNet(pretrained=True).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-2)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")
    criterion = nn.BCEWithLogitsLoss()

    best_score = -1.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        for x, y in train_dl:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            # Mild label smoothing (0.03) for better calibration.
            y_smooth = y * 0.94 + 0.03
            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
                logits = model(x).squeeze(-1)
                loss = criterion(logits, y_smooth)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            total_loss += loss.item()
        scheduler.step()

        vp = predict_probs(model, val_pos_paths, val_tfm, device)
        vn = predict_probs(model, val_neg_paths, val_tfm, device)
        hp = predict_probs(model, holdout_fp_paths, val_tfm, device)

        tpr = float((vp >= 0.5).mean())
        tnr = float((vn < 0.5).mean())
        h_rej = float((hp < 0.5).mean()) if len(hp) else 1.0
        bal_acc = 0.5 * (tpr + tnr)
        if bal_acc > best_score:
            best_score = bal_acc
            torch.save(model.state_dict(), BEST_CKPT)
        if epoch % 2 == 0 or epoch == 1 or epoch == args.epochs:
            print(f"Epoch {epoch:02d}/{args.epochs} | loss={total_loss/len(train_dl):.4f} | val_pos_rec={tpr:5.1%} | val_3leaf_rej={tnr:5.1%} | holdout_fp_rej={h_rej:5.1%} | bal={bal_acc:5.1%}")

    # Final threshold sweep with best weights
    model.load_state_dict(torch.load(BEST_CKPT, map_location=device, weights_only=True))
    vp = predict_probs(model, val_pos_paths, val_tfm, device)
    vn = predict_probs(model, val_neg_paths, val_tfm, device)
    hp = predict_probs(model, holdout_fp_paths, val_tfm, device)
    print(f"\n=== Best Verifier Threshold Sweep (bal_acc={best_score:.1%}) ===")
    print(" thr | val four_leaf kept | val three_leaf FP | holdout YOLOX FP kept")
    for thr in [0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80]:
        pos_kept = (vp >= thr).mean()
        neg_fp = (vn >= thr).mean()
        h_kept = (hp >= thr).mean() if len(hp) else 0.0
        print(f" {thr:.2f} | {pos_kept:6.1%} ({int((vp>=thr).sum()):3d}/{len(vp)})   | {neg_fp:6.1%} ({int((vn>=thr).sum()):3d}/{len(vn)})  | {h_kept:6.1%} ({int((hp>=thr).sum()):2d}/{len(hp)})")

    # Export ONNX
    export_model = ExportVerifier(model.cpu().eval()).eval()
    dummy = torch.rand(1, 3, IMG_SIZE, IMG_SIZE)
    torch.onnx.export(
        export_model,
        dummy,
        str(ONNX_OUT),
        input_names=["images"],
        output_names=["prob"],
        opset_version=13,
        dynamo=False,
    )
    print(f"\nExported {ONNX_OUT}")


if __name__ == "__main__":
    main()
