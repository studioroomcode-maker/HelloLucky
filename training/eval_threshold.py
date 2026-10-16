"""
Pick the app's lock threshold: per confidence level, how often a no-luck photo still fires
(held-out hard negatives) vs how many real four-leaf boxes are found (valid split, IoU >= 0.5).

Usage: python training/eval_threshold.py [weights.pt | model.onnx]
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

from luck_predict import predictor

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = Path(__file__).resolve().parent
WEIGHTS = sys.argv[1] if len(sys.argv) > 1 else BASE / "runs" / "clover" / "weights" / "best.pt"
NEG = BASE.parent / "clover_dataset" / "negatives_holdout"
VALID = BASE / "merged" / "valid"
LEVELS = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75]


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


assert abs(iou((0, 0, 2, 2), (1, 0, 3, 2)) - 1 / 3) < 1e-6


def main():
    run = predictor(WEIGHTS, conf=min(LEVELS))

    negs = sorted(NEG.glob("*.jpg"))
    neg_top = [max([c for _, c in run(ImageOps.exif_transpose(Image.open(p)))] or [0]) for p in negs]

    found = {t: 0 for t in LEVELS}
    total = 0
    imgs = sorted((VALID / "images").iterdir())
    for img in imgs:
        im = Image.open(img)
        w, h = im.size
        label = VALID / "labels" / f"{img.stem}.txt"
        gts = []
        for line in label.read_text().split("\n") if label.exists() else []:
            if line.strip() and line.split()[0] == "0":  # four_leaf only; class 1 is three-leaf
                v = list(map(float, line.split()[1:]))
                if len(v) == 4:
                    cx, cy, bw, bh = v
                    gts.append(((cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h))
                else:  # polygon label (x1 y1 x2 y2 ...) → its bounding box
                    xs, ys = v[0::2], v[1::2]
                    gts.append((min(xs) * w, min(ys) * h, max(xs) * w, max(ys) * h))
        total += len(gts)
        preds = run(im)
        for t in LEVELS:
            found[t] += sum(any(c >= t and iou(g, b) >= 0.5 for b, c in preds) for g in gts)

    print(f"{WEIGHTS}\n negatives={len(negs)}  valid boxes={total}")
    print(" conf | false alarm (no-luck photos) | four-leaf found")
    for t in LEVELS:
        fa = sum(s >= t for s in neg_top) / max(1, len(negs))
        print(f" {t:.2f} | {fa:6.1%} | {found[t] / max(1, total):6.1%}")


if __name__ == "__main__":
    main()
