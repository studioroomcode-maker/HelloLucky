"""
How recall falls as the four-leaf gets smaller (field use: 5–8% of the frame at 30–50 cm).
Each valid box is cut out with a margin, scaled so the box spans <size> of a 960 canvas, and pasted
onto a held-out no-luck background (clover_dataset/negatives_holdout).

Usage: python training/eval_scale.py [weights.pt | model.onnx]
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from luck_predict import predictor

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = Path(__file__).resolve().parent
WEIGHTS = sys.argv[1] if len(sys.argv) > 1 else BASE / "runs" / "clover" / "weights" / "best.pt"
VALID = BASE / "merged" / "valid"
BGS = sorted((BASE.parent / "clover_dataset" / "negatives_holdout").glob("*.jpg"))
# Live mode sees a 30–50 cm clover at 5–8% of the input; wide scan tiles see it at ~10–12%.
SIZES = [0.40, 0.15, 0.12, 0.10, 0.08, 0.05]
CANVAS = 960


def boxes(img: Path, w: int, h: int):
    label = VALID / "labels" / f"{img.stem}.txt"
    for line in label.read_text().split("\n") if label.exists() else []:
        if not line.strip() or line.split()[0] != "0":  # four_leaf only
            continue
        v = list(map(float, line.split()[1:]))
        if len(v) == 4:
            yield (v[0] - v[2] / 2) * w, (v[1] - v[3] / 2) * h, (v[0] + v[2] / 2) * w, (v[1] + v[3] / 2) * h
        elif v:
            yield min(v[0::2]) * w, min(v[1::2]) * h, max(v[0::2]) * w, max(v[1::2]) * h


def paste(src: Image.Image, box, size: float, rng: random.Random):
    x0, y0, x1, y1 = box
    side = max(x1 - x0, y1 - y0)
    m = side * 0.4  # keep some surrounding leaves so it is not a clean sticker
    cx0, cy0 = max(0, x0 - m), max(0, y0 - m)
    crop = src.crop((cx0, cy0, min(src.width, x1 + m), min(src.height, y1 + m)))
    k = size * CANVAS / side
    crop = crop.resize((max(1, round(crop.width * k)), max(1, round(crop.height * k))), Image.LANCZOS)
    bg = Image.open(rng.choice(BGS)).convert("RGB").resize((CANVAS, CANVAS))
    px, py = rng.randint(0, max(0, CANVAS - crop.width)), rng.randint(0, max(0, CANVAS - crop.height))
    mask = Image.new("L", crop.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, crop.width - 1, crop.height - 1), fill=255)
    bg.paste(crop, (px, py), mask.filter(ImageFilter.GaussianBlur(max(1, crop.width // 12))))
    gx0, gy0 = px + (x0 - cx0) * k, py + (y0 - cy0) * k
    return bg, (gx0, gy0, gx0 + (x1 - x0) * k, gy0 + (y1 - y0) * k)


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9)


def main():
    run = predictor(WEIGHTS, conf=0.25)
    rng = random.Random(0)
    print(WEIGHTS)
    for size in SIZES:
        hit = {0.25: 0, 0.45: 0}
        total = 0
        for img in sorted((VALID / "images").iterdir()):
            src = Image.open(img).convert("RGB")
            for box in list(boxes(img, src.width, src.height))[:1]:
                canvas, gt = paste(src, box, size, rng)
                preds = run(canvas)
                total += 1
                for t in hit:
                    hit[t] += any(c >= t and iou(gt, b) >= 0.3 for b, c in preds)
        print(f" clover = {size:.0%} of frame | found @0.25 {hit[0.25] / total:6.1%} | @0.45 {hit[0.45] / total:6.1%}  (n={total})")


if __name__ == "__main__":
    main()
