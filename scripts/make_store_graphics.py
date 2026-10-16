"""Generate store banners (Play feature graphic, Toss banner) into store-listing/assets/.

Uses the designer sources assets/icon.png and assets/logo.png (see make_icons.py).
Usage: python scripts/make_store_graphics.py   (Windows: uses the Malgun Gothic font)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from make_icons import SRC_LOGO, field_color, full_bleed_icon

ROOT = Path(__file__).resolve().parent.parent / "store-listing" / "assets"
FONT = "C:/Windows/Fonts/malgun.ttf"
GREEN_TOP = (60, 160, 80)


def hex_rgb(h: str) -> tuple[int, int, int]:
    return tuple(int(h[i : i + 2], 16) for i in (1, 3, 5))


def banner(w: int, h: int, lines: list[str], line_px: int) -> Image.Image:
    bottom = hex_rgb(field_color())
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        c = tuple(round(a + (b - a) * y / (h - 1)) for a, b in zip(GREEN_TOP, bottom))
        for x in range(w):
            px[x, y] = c

    side = round(h * 0.6)
    icon = full_bleed_icon(side)
    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, side - 1, side - 1), radius=round(side * 0.22), fill=255)
    x0 = round(w * 0.08)
    img.paste(icon, (x0, (h - side) // 2), mask)

    logo = Image.open(SRC_LOGO).convert("RGBA")
    logo = logo.crop(logo.getchannel("A").getbbox())
    lh = round(h * 0.34)
    logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
    font = ImageFont.truetype(FONT, line_px)
    block = lh + round(line_px * 0.6) + len(lines) * round(line_px * 1.4)
    x = x0 + side + round(w * 0.06)
    y = (h - block) // 2
    img.paste(logo, (x, y), logo)
    y += lh + round(line_px * 0.6)
    draw = ImageDraw.Draw(img)
    for line in lines:
        draw.text((x, y), line, font=font, fill=(240, 250, 240))
        y += round(line_px * 1.4)
    return img


def main():
    banner(1024, 500, ["카메라로 네잎클로버 찾기", "AI가 기기 안에서 바로 찾아줘요"], 32).save(
        ROOT / "play" / "feature-graphic-1024x500.png"
    )
    banner(1200, 675, ["카메라로 네잎클로버 찾기"], 40).save(ROOT / "toss" / "banner-1200x675.png")
    print("store banners ->", ROOT)


if __name__ == "__main__":
    main()
