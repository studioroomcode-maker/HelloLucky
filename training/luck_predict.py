"""
One predictor for the eval scripts: four-leaf boxes [(x0, y0, x1, y1), conf] in image pixels.

  *.onnx → the exported app model (training/export_yolox.py), decoded like src/services/detector/yoloDecode.ts:
           RGB 0..1 in, [4 + C, N] out, best class must be 0 (four_leaf), greedy NMS.
  *.pt   → Ultralytics weights (old baseline; local comparison only).
"""
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 960
PAD = 114 / 255  # YOLOX letterbox grey


def nms(boxes: np.ndarray, scores: np.ndarray, iou: float) -> list[int]:
    order, keep = scores.argsort()[::-1], []
    while order.size:
        i = order[0]
        keep.append(int(i))
        xx0 = np.maximum(boxes[i, 0], boxes[order[1:], 0])
        yy0 = np.maximum(boxes[i, 1], boxes[order[1:], 1])
        xx1 = np.minimum(boxes[i, 2], boxes[order[1:], 2])
        yy1 = np.minimum(boxes[i, 3], boxes[order[1:], 3])
        inter = np.clip(xx1 - xx0, 0, None) * np.clip(yy1 - yy0, 0, None)
        area = lambda b: (b[..., 2] - b[..., 0]) * (b[..., 3] - b[..., 1])  # noqa: E731
        order = order[1:][inter / (area(boxes[i]) + area(boxes[order[1:]]) - inter + 1e-9) <= iou]
    return keep


assert nms(np.array([[0, 0, 10, 10], [1, 1, 10, 10], [20, 20, 30, 30.0]]), np.array([0.9, 0.8, 0.7]), 0.45) == [0, 2]


def predictor(weights, conf: float = 0.1):
    weights = Path(weights)
    if weights.suffix == ".pt":
        from ultralytics import YOLO

        model = YOLO(str(weights))

        def run(img: Image.Image):
            r = model.predict(img, imgsz=SIZE, conf=conf, verbose=False)[0]
            return [(tuple(b), float(c)) for b, c in zip(r.boxes.xyxy.tolist(), r.boxes.conf)]

        return run

    import onnxruntime as ort

    session = ort.InferenceSession(str(weights), providers=["CUDAExecutionProvider", "CPUExecutionProvider"])

    def run(img: Image.Image):
        img = img.convert("RGB")
        k = SIZE / max(img.size)
        resized = img.resize((round(img.width * k), round(img.height * k)), Image.BILINEAR)
        canvas = np.full((SIZE, SIZE, 3), PAD, np.float32)
        canvas[: resized.height, : resized.width] = np.asarray(resized, np.float32) / 255
        out = session.run(None, {"images": canvas.transpose(2, 0, 1)[None]})[0][0]  # [4 + C, N]
        scores = out[4:]
        best = scores.argmax(0)
        score = scores.max(0)
        sel = (best == 0) & (score >= conf)
        cx, cy, w, h = (out[:4, sel] * SIZE) / k
        boxes = np.stack([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], 1)
        keep = nms(boxes, score[sel], 0.45)[:20]
        return [(tuple(boxes[i]), float(score[sel][i])) for i in keep]

    return run
