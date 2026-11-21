"""
Build the YOLOX (Apache-2.0) training set in COCO format.

  train = merged/train (four_leaf + three_leaf boxes)
        + hard negatives (clover_dataset/negatives_inat, three_leaf; no boxes)
        + field-scale composites: four- and three-leaf cutouts (synthesize_composite.py polygons)
          pasted at 3–12% of the frame onto shrunken, tiled real backgrounds.
          Both classes get the same paste treatment so "looks pasted" is never a four-leaf cue.
  val   = merged/valid (real photos only)

Usage: python training/build_yolox_data.py --synthetic 3000
  → training/yolox_data/{train2017,val2017}/ + annotations/instances_{train,val}2017.json
"""
import argparse
import json
import math
import random
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from synthesize_composite import alpha_bbox, transform_cutout  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = Path(__file__).resolve().parent
MERGED = BASE / "merged"
OUT = BASE / "yolox_data"
NEG_DIRS = [BASE.parent / "clover_dataset" / d for d in ("negatives_inat", "three_leaf")]
CUTOUTS = BASE / "cutouts"
BASE_CKPT = BASE / "YOLOX_outputs" / "luck_tiny" / "best_ckpt.pth"
CATEGORIES = [{"id": 1, "name": "four_leaf"}, {"id": 2, "name": "three_leaf"}]
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
CANVAS = 960


def label_boxes(label: Path, w: int, h: int):
    """YOLO box or polygon lines → (class, x, y, w, h) in pixels."""
    for line in label.read_text().split("\n") if label.exists() else []:
        p = line.split()
        if len(p) < 5:
            continue
        v = list(map(float, p[1:]))
        if len(v) == 4:
            x0, y0, x1, y1 = (v[0] - v[2] / 2) * w, (v[1] - v[3] / 2) * h, (v[0] + v[2] / 2) * w, (v[1] + v[3] / 2) * h
        else:
            x0, y0, x1, y1 = min(v[0::2]) * w, min(v[1::2]) * h, max(v[0::2]) * w, max(v[1::2]) * h
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
        if x1 - x0 >= 2 and y1 - y0 >= 2:
            yield int(p[0]), x0, y0, x1 - x0, y1 - y0


assert list(label_boxes(Path("__missing__"), 10, 10)) == []


class Coco:
    def __init__(self, split: str):
        self.dir = OUT / split
        self.dir.mkdir(parents=True, exist_ok=True)
        self.images, self.anns = [], []

    def add(self, name: str, w: int, h: int, boxes):
        img_id = len(self.images) + 1
        self.images.append({"id": img_id, "file_name": name, "width": w, "height": h})
        for cls, x, y, bw, bh in boxes:
            self.anns.append({"id": len(self.anns) + 1, "image_id": img_id, "category_id": cls + 1,
                              "bbox": [round(x, 2), round(y, 2), round(bw, 2), round(bh, 2)],
                              "area": round(bw * bh, 2), "iscrowd": 0})

    def put(self, src: Path, name: str, boxes) -> tuple[int, int, list]:
        """Store the image with its long side capped at CANVAS (training decodes 4 per mosaic; big JPEGs starve the GPU)."""
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        k = min(1.0, CANVAS / max(im.size))
        if k < 1.0:
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        im.save(self.dir / name, quality=92)
        return im.width, im.height, [(c, x * k, y * k, w * k, h * k) for c, x, y, w, h in boxes]

    def save(self, json_name: str):
        (OUT / "annotations").mkdir(exist_ok=True)
        (OUT / "annotations" / json_name).write_text(
            json.dumps({"images": self.images, "annotations": self.anns, "categories": CATEGORIES}), encoding="utf-8")
        fours = sum(a["category_id"] == 1 for a in self.anns)
        print(f"  {json_name}: {len(self.images)} images, {fours} four-leaf, {len(self.anns) - fours} three-leaf")


def add_real(coco: Coco, split: str):
    for img in sorted((MERGED / split / "images").iterdir()):
        if img.suffix.lower() not in EXTS:
            continue
        with Image.open(img) as im:
            w, h = ImageOps.exif_transpose(im).size
        name = f"{img.stem}.jpg"
        coco.add(name, *coco.put(img, name, list(label_boxes(MERGED / split / "labels" / f"{img.stem}.txt", w, h))))


def background(rng: random.Random, pool: list[Path]) -> Image.Image:
    """g×g grid of shrunken real backgrounds, so leaves end up roughly field-scale."""
    g = rng.choice([2, 3])
    tile = CANVAS // g
    canvas = Image.new("RGB", (CANVAS, CANVAS))
    for i in range(g * g):
        im = Image.open(rng.choice(pool)).convert("RGB")
        side = min(im.size)
        im = im.crop(((im.width - side) // 2, (im.height - side) // 2, (im.width + side) // 2, (im.height + side) // 2))
        im = im.resize((tile, tile), Image.LANCZOS).rotate(90 * rng.randint(0, 3))
        canvas.paste(im, ((i % g) * tile, (i // g) * tile))
    return canvas


def pseudo_label_three_leafs(img_paths: list[Path], ckpt: Path, conf: float = 0.35) -> dict[Path, list]:
    """
    Resolve the three_leaf label conflict on negative directories (negatives_inat, three_leaf):
    run the baseline detector and label ONLY confident class-1 (three_leaf) boxes so three-leaf
    clovers in negative photos are no longer trained as objectness=0 background.
    Never emits four_leaf (class 0) boxes because these photos are guaranteed no-luck negatives.
    """
    if not img_paths or not ckpt.exists():
        return {}
    import torch

    sys.path.insert(0, str(BASE / "third_party" / "YOLOX"))
    from export_yolox import AppLayout, load_exp
    from luck_predict import PAD, SIZE as YOLO_SIZE, nms

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    exp = load_exp()
    raw = exp.get_model()
    state = torch.load(ckpt, map_location="cpu", weights_only=False)
    raw.load_state_dict(state["model"])
    raw.eval()
    model = AppLayout(raw, YOLO_SIZE).eval().to(device)
    if device.type == "cuda":
        model.half()

    results: dict[Path, list] = {}
    total_boxes = 0
    bs = 16
    with torch.no_grad():
        for i in range(0, len(img_paths), bs):
            batch = img_paths[i : i + bs]
            arrs, ks, sizes = [], [], []
            for p in batch:
                im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
                sizes.append(im.size)
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
            for p, (w, h), out, k in zip(batch, sizes, outs, ks):
                s0, s1 = out[4], out[5]
                # Strictly three_leaf (class 1) only; ignore four_leaf completely.
                sel = (s1 > s0) & (s1 >= conf)
                boxes_out = []
                if np.any(sel):
                    cx, cy, bw, bh = (out[:4, sel] * YOLO_SIZE) / k
                    xyxy = np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], 1)
                    scores = s1[sel]
                    for j in nms(xyxy, scores, 0.45)[:30]:
                        x0 = max(0.0, float(xyxy[j, 0]))
                        y0 = max(0.0, float(xyxy[j, 1]))
                        x1 = min(float(w), float(xyxy[j, 2]))
                        y1 = min(float(h), float(xyxy[j, 3]))
                        if x1 - x0 >= 6 and y1 - y0 >= 6:
                            boxes_out.append((1, x0, y0, x1 - x0, y1 - y0))
                results[p] = boxes_out
                total_boxes += len(boxes_out)
    print(f"  pseudo-labeled {total_boxes} three_leaf boxes across {len(img_paths)} negative images (conf>={conf})")
    return results


def _paste_piece(bg: Image.Image, cut: Image.Image, target_w: int, rng: random.Random, px: int | None = None, py: int | None = None):
    piece = transform_cutout(
        cut, target_w, rng.uniform(0, 360), rng.random() < 0.5, rng.uniform(0.7, 1.15), rng.uniform(0.7, 1.2)
    )
    if rng.random() < 0.3:  # hand shake / focus miss, same for both classes
        a = piece.split()[-1]
        piece = piece.filter(ImageFilter.GaussianBlur(rng.uniform(0.5, 1.5)))
        piece.putalpha(a)
    pw, ph = piece.size
    if pw >= CANVAS or ph >= CANVAS:
        return None
    if px is None or py is None:
        px, py = rng.randint(0, CANVAS - pw), rng.randint(0, CANVAS - ph)
    else:
        px = max(0, min(CANVAS - pw, px))
        py = max(0, min(CANVAS - ph, py))
    bg.alpha_composite(piece, (px, py))
    bb = alpha_bbox(piece)
    return (px + bb[0], py + bb[1], bb[2] - bb[0], bb[3] - bb[1]) if bb else None


def add_synthetic(coco: Coco, count: int, seed: int):
    rng = random.Random(seed)
    pool = [p for d in NEG_DIRS if d.is_dir() for p in d.iterdir() if p.suffix.lower() in EXTS]
    cuts = {c: [Image.open(p).convert("RGBA") for p in sorted(CUTOUTS.glob(f"c{c}_*.png"))] for c in (0, 1)}
    assert cuts[0] and cuts[1], "run: python training/synthesize_composite.py polygons"
    for i in range(count):
        bg = background(rng, pool).convert("RGBA")
        boxes = []
        # 80% field-scale (3–13%), 20% close-up scale (13–30%, matching 3× recheck & close scans).
        close_up = rng.random() < 0.2
        scale_lo, scale_hi = (0.13, 0.30) if close_up else (0.03, 0.13)

        n_four = rng.choices([0, 1, 2], weights=[1, 3, 1])[0]
        pieces = [0] * n_four + [1] * rng.randint(1, 4)
        rng.shuffle(pieces)
        for cls in pieces:
            target_w = round(rng.uniform(scale_lo, scale_hi) * CANVAS)
            bb = _paste_piece(bg, rng.choice(cuts[cls]), target_w, rng)
            if bb:
                boxes.append((cls, *bb))

        # Hard negative decoys: 1–2 overlapping pairs of three-leaf clovers that mimic a 4-leaf clover.
        if rng.random() < 0.65:
            for _ in range(rng.randint(1, 2)):
                base_w = round(rng.uniform(scale_lo, scale_hi) * CANVAS)
                cx = rng.randint(base_w, max(base_w, CANVAS - base_w))
                cy = rng.randint(base_w, max(base_w, CANVAS - base_w))
                offset = round(base_w * rng.uniform(0.24, 0.48))
                ang = rng.uniform(0, 2 * math.pi)
                dx, dy = round(math.cos(ang) * offset), round(math.sin(ang) * offset)
                for ox, oy in [(-dx // 2, -dy // 2), (dx // 2, dy // 2)]:
                    w_i = round(base_w * rng.uniform(0.85, 1.15))
                    bb = _paste_piece(bg, rng.choice(cuts[1]), w_i, rng, cx + ox - w_i // 2, cy + oy - w_i // 2)
                    if bb:
                        boxes.append((1, *bb))

        name = f"synth_{i:05d}.jpg"
        bg.convert("RGB").save(coco.dir / name, quality=90)
        coco.add(name, CANVAS, CANVAS, boxes)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", type=int, default=3000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--no-pseudo-three-leaf", action="store_true", help="skip pseudo-labeling three_leaf on negative dirs")
    ap.add_argument("--pseudo-conf", type=float, default=0.35)
    args = ap.parse_args()
    if OUT.exists():
        shutil.rmtree(OUT)

    train = Coco("train2017")
    add_real(train, "train")
    neg_paths = [
        img
        for d in NEG_DIRS
        if d.is_dir()
        for img in sorted(p for p in d.iterdir() if p.suffix.lower() in EXTS)
    ]
    pseudo = {} if args.no_pseudo_three_leaf else pseudo_label_three_leafs(neg_paths, BASE_CKPT, conf=args.pseudo_conf)
    for img in neg_paths:
        name = f"neg__{img.parent.name}__{img.stem}.jpg"
        train.add(name, *train.put(img, name, pseudo.get(img, [])))
    add_synthetic(train, args.synthetic, args.seed)
    train.save("instances_train2017.json")

    val = Coco("val2017")
    add_real(val, "valid")
    val.save("instances_val2017.json")


if __name__ == "__main__":
    main()
