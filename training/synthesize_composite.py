"""
Hello Lucky - 합성 증강 (Cut-Paste-Learn)

왜 이게 필요한가:
  텍스트→이미지 생성(diffusion)은 잎 개수를 못 세서, 세잎을 네잎으로
  라벨한 오염 데이터를 만듭니다. 이 과제의 핵심 신호(3잎 vs 4잎)를 망칩니다.
  대신 "진짜 네잎 컷아웃"을 "진짜 배경"에 붙이면:
    - 잎 개수는 진짜라 정확
    - 붙인 위치가 곧 정답 박스 → 라벨링 0
    - 실제 픽셀이라 사실감 유지
  라벨 작업 없이 학습 데이터를 수천 장으로 불립니다.

한계(정직하게):
  - 근접샷 컷아웃을 축소해 붙여도 실제 '멀리서 본 밭'과는 도메인 갭이 있습니다.
  - 그래서 합성은 '보강'이지 '대체'가 아닙니다. 검증은 진짜 사진으로 하세요.

2단계 구조:
  1) cutout  : rembg 로 four_leaf/*.jpg 배경 제거 → training/cutouts/*.png (rembg 필요, 1회 캐시)
  2) compose : 컷아웃을 배경에 랜덤 합성 → YOLO 데이터셋 (PIL/numpy 만 필요)

사용법:
  pip install pillow numpy
  pip install rembg onnxruntime          # cutout 단계용 (무겁습니다)

  python training/synthesize_composite.py cutout            # 배경 제거 (1회)
  python training/synthesize_composite.py compose --count 1500
  python training/synthesize_composite.py all --count 1500  # 둘 다

출력:
  training/datasets_raw/synthetic-composite/{train,valid}/{images,labels} + data.yaml
  → 이후 merge_datasets.py 가 자동으로 함께 병합합니다 (클래스 four_leaf).
"""

import os
import sys
import glob
import math
import random
import argparse
from pathlib import Path

# Windows 콘솔(cp949)에서도 이모지가 깨지지 않도록 UTF-8 출력으로 전환.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

SOURCES_DIR = PROJECT_DIR / "clover_dataset" / "four_leaf"      # 컷아웃 원본 (진짜 네잎)
BACKGROUNDS_DIR = PROJECT_DIR / "clover_dataset" / "three_leaf"  # 배경 (진짜 클로버밭)
CUTOUTS_DIR = BASE_DIR / "cutouts"                              # 배경 제거 결과 캐시
OUT_DIR = BASE_DIR / "datasets_raw" / "synthetic-composite"     # merge 가 읽어가는 위치

TARGET_CLASS = "four_leaf"
IMAGE_EXTS = ("*.jpg", "*.jpeg", "*.png", "*.webp")


# ===========================================================
# 순수 로직 (실기기/rembg 없이 테스트 가능)
# ===========================================================
def alpha_bbox(rgba: Image.Image):
    """RGBA 이미지에서 알파>0 영역의 타이트 박스 (l, t, r, b). 없으면 None."""
    if rgba.mode != "RGBA":
        return (0, 0, rgba.width, rgba.height)
    alpha = np.asarray(rgba.split()[-1])
    ys, xs = np.where(alpha > 8)  # 미세 노이즈 무시
    if xs.size == 0 or ys.size == 0:
        return None
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def to_yolo(box, img_w: int, img_h: int):
    """(l,t,r,b) 픽셀 박스 → YOLO 정규화 (cx, cy, w, h)."""
    l, t, r, b = box
    cx = (l + r) / 2 / img_w
    cy = (t + b) / 2 / img_h
    w = (r - l) / img_w
    h = (b - t) / img_h
    return cx, cy, w, h


def transform_cutout(
    cutout: Image.Image,
    target_w: int,
    angle: float,
    flip: bool,
    brightness: float,
    color: float,
) -> Image.Image:
    """컷아웃을 스케일·회전·플립·색보정하고, 알파 기준으로 타이트하게 다시 크롭."""
    rgba = cutout.convert("RGBA")

    # 스케일: 목표 너비에 맞춰 등비 축소/확대.
    if rgba.width == 0:
        return rgba
    ratio = target_w / rgba.width
    new_size = (max(1, round(rgba.width * ratio)), max(1, round(rgba.height * ratio)))
    rgba = rgba.resize(new_size, Image.LANCZOS)

    if flip:
        rgba = rgba.transpose(Image.FLIP_LEFT_RIGHT)

    # 색/밝기 보정은 RGB 에만 적용하고 알파는 보존.
    rgb = rgba.convert("RGB")
    rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
    rgb = ImageEnhance.Color(rgb).enhance(color)
    r, g, b = rgb.split()
    a = rgba.split()[-1]
    rgba = Image.merge("RGBA", (r, g, b, a))

    # 회전 (expand=True 로 잘리지 않게). 빈 영역은 알파 0.
    if angle:
        rgba = rgba.rotate(angle, resample=Image.BICUBIC, expand=True)

    # 가장자리를 살짝 부드럽게 (하드 컷아웃 티 줄이기).
    a = rgba.split()[-1].filter(ImageFilter.GaussianBlur(0.8))
    r, g, b, _ = rgba.split()
    rgba = Image.merge("RGBA", (r, g, b, a))

    # 알파 기준 타이트 크롭 → 박스가 실제 잎 범위와 일치.
    bb = alpha_bbox(rgba)
    if bb is not None:
        rgba = rgba.crop(bb)
    return rgba


# ===========================================================
# 1) cutout — rembg 로 배경 제거
# ===========================================================
def run_cutout(limit: int):
    try:
        from rembg import remove, new_session
    except ImportError:
        print(
            "❌ rembg 가 없습니다 (cutout 단계에 필요).\n"
            "   설치:  pip install rembg onnxruntime\n"
            "   (또는 이미지 편집기로 직접 오려 RGBA png 를 training/cutouts/ 에 넣어도 됩니다)"
        )
        sys.exit(1)

    CUTOUTS_DIR.mkdir(parents=True, exist_ok=True)
    sources = []
    for pat in IMAGE_EXTS:
        sources.extend(sorted(SOURCES_DIR.glob(pat)))
    if limit > 0:
        sources = sources[:limit]

    if not sources:
        print(f"❌ {SOURCES_DIR} 에 원본 이미지가 없습니다.")
        sys.exit(1)

    session = new_session()  # 기본 모델 재사용 (반복 호출 빠르게)
    done, skipped = 0, 0
    print(f"✂️  배경 제거 {len(sources)}장 → {CUTOUTS_DIR}")
    for src in sources:
        out_path = CUTOUTS_DIR / (src.stem + ".png")
        if out_path.exists():
            skipped += 1
            continue
        try:
            img = Image.open(src).convert("RGBA")
            cut = remove(img, session=session)  # RGBA 반환
            bb = alpha_bbox(cut)
            if bb is None:
                print(f"  ⚠️ 알파 없음(제거 실패?) 건너뜀: {src.name}")
                continue
            cut.crop(bb).save(out_path)
            done += 1
            if done % 20 == 0:
                print(f"  ...{done}장")
        except Exception as e:
            print(f"  ⚠️ 실패 {src.name}: {e}")

    print(f"✅ 컷아웃 완료: 신규 {done}장, 캐시 재사용 {skipped}장")


# ===========================================================
# 2) compose — 컷아웃을 배경에 합성 + YOLO 라벨
# ===========================================================
def load_backgrounds(bg_max_dim: int):
    paths = []
    for pat in IMAGE_EXTS:
        paths.extend(sorted(BACKGROUNDS_DIR.glob(pat)))
    if not paths:
        return []
    return paths


def prep_background(path: Path, bg_max_dim: int) -> Image.Image:
    bg = Image.open(path).convert("RGB")
    # 너무 큰 배경은 축소해 데이터셋 용량/학습속도 관리.
    scale = min(1.0, bg_max_dim / max(bg.width, bg.height))
    if scale < 1.0:
        bg = bg.resize(
            (round(bg.width * scale), round(bg.height * scale)), Image.LANCZOS
        )
    return bg


def run_compose(args):
    cutout_paths = sorted(CUTOUTS_DIR.glob("*.png"))
    if not cutout_paths:
        print(
            f"❌ {CUTOUTS_DIR} 에 컷아웃(png)이 없습니다.\n"
            "   먼저:  python training/synthesize_composite.py cutout"
        )
        sys.exit(1)

    bg_paths = load_backgrounds(args.bg_max_dim)
    if not bg_paths:
        print(f"❌ {BACKGROUNDS_DIR} 에 배경 이미지가 없습니다.")
        sys.exit(1)

    rng = random.Random(args.seed)
    cutouts = [Image.open(p).convert("RGBA") for p in cutout_paths]
    print(
        f"🎨 합성 {args.count}장 생성 "
        f"(컷아웃 {len(cutouts)}종 · 배경 {len(bg_paths)}장 · seed {args.seed})"
    )

    # train/valid 폴더 준비.
    for split in ("train", "valid"):
        (OUT_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (OUT_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

    made = 0
    empty = 0
    for i in range(args.count):
        bg = prep_background(rng.choice(bg_paths), args.bg_max_dim).convert("RGBA")
        W, H = bg.size
        n = rng.randint(1, args.max_per_image)
        boxes = []

        for _ in range(n):
            cut = rng.choice(cutouts)
            # 목표 너비: 배경 너비의 min~max 비율 (실사용은 멀리 → 작게).
            target_w = max(8, round(rng.uniform(args.min_scale, args.max_scale) * W))
            angle = rng.uniform(0, 360)
            flip = rng.random() < 0.5
            brightness = rng.uniform(0.75, 1.15)
            color = rng.uniform(0.7, 1.2)

            piece = transform_cutout(cut, target_w, angle, flip, brightness, color)
            pw, ph = piece.size
            if pw >= W or ph >= H:
                continue  # 배경보다 크면 건너뜀

            px = rng.randint(0, W - pw)
            py = rng.randint(0, H - ph)
            bg.alpha_composite(piece, (px, py))

            # 붙인 조각의 알파 기준 박스(조각 내부) → 전체 좌표로.
            local = alpha_bbox(piece)
            if local is None:
                continue
            l, t, r, b = local
            boxes.append((px + l, py + t, px + r, py + b))

        split = "valid" if rng.random() < args.val_split else "train"
        stem = f"synth_{i:05d}"
        bg.convert("RGB").save(
            OUT_DIR / split / "images" / f"{stem}.jpg", quality=90
        )
        label_lines = [
            f"0 {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"
            for (cx, cy, w, h) in (to_yolo(bx, W, H) for bx in boxes)
        ]
        (OUT_DIR / split / "labels" / f"{stem}.txt").write_text(
            "\n".join(label_lines), encoding="utf-8"
        )
        if not label_lines:
            empty += 1
        made += 1
        if made % 200 == 0:
            print(f"  ...{made}/{args.count}")

    # data.yaml (merge_datasets.py 와 호환되는 단일 클래스).
    (OUT_DIR / "data.yaml").write_text(
        "train: train/images\n"
        "val: valid/images\n"
        "\nnc: 1\n"
        f"names: ['{TARGET_CLASS}']\n",
        encoding="utf-8",
    )

    print("\n" + "=" * 50)
    print(f"✅ 합성 완료: {made}장 → {OUT_DIR}")
    print(f"   (박스 없는 배경 이미지: {empty}장 — 하드 네거티브로 유용)")
    print("=" * 50)
    print("👉 다음: python training/merge_datasets.py  (합성 포함 병합)")


def main():
    parser = argparse.ArgumentParser(description="Hello Lucky 합성 증강 (Cut-Paste-Learn)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_cut = sub.add_parser("cutout", help="rembg 로 배경 제거 (1회 캐시)")
    p_cut.add_argument("--limit", type=int, default=0, help="원본 처리 개수 제한 (0=전체)")

    def add_compose_args(p):
        p.add_argument("--count", type=int, default=1500, help="생성할 합성 이미지 수")
        p.add_argument("--max-per-image", type=int, default=3, help="한 장당 최대 클로버 수")
        p.add_argument("--min-scale", type=float, default=0.04, help="클로버 최소 너비(배경 대비)")
        p.add_argument("--max-scale", type=float, default=0.16, help="클로버 최대 너비(배경 대비)")
        p.add_argument("--val-split", type=float, default=0.15, help="검증셋 비율")
        p.add_argument("--bg-max-dim", type=int, default=1024, help="배경 최대 변(px)")
        p.add_argument("--seed", type=int, default=0, help="랜덤 시드")

    p_com = sub.add_parser("compose", help="컷아웃을 배경에 합성 + YOLO 라벨")
    add_compose_args(p_com)

    p_all = sub.add_parser("all", help="cutout 후 compose")
    p_all.add_argument("--limit", type=int, default=0)
    add_compose_args(p_all)

    args = parser.parse_args()

    if args.cmd == "cutout":
        run_cutout(args.limit)
    elif args.cmd == "compose":
        run_compose(args)
    elif args.cmd == "all":
        run_cutout(args.limit)
        run_compose(args)


if __name__ == "__main__":
    main()
