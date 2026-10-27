"""Remove the Android status bar from the App Store screenshots (App Review 2.3.10, 2026-10-27).

    python store-listing/strip-status-bar.py

The App Store shots were taken on an Android phone, so their top strip shows Android's clock and icons. Apple rejects
non-iOS status bars. This blanks that strip in place: flat screens get their own background colour, screens with a
photo under the status bar get the photo rows just below it, mirrored. Geometry follows make-shots.py (a 1440x3120
shot composed at 1290x2796). Run it again after make-shots.py whenever the App Store shots are remade.
"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT = os.path.join(ROOT, "assets", "fonts", "SDGothicNeoRound-hEb.ttf")
OUT = os.path.join(HERE, "assets", "appstore", "screenshots-6.9")
W, H = 1290, 2796
RAW_W, RAW_H = 1440, 3120
RAW_BAR = 150  # the status bar's height on the phone (1440 px wide), with a little margin under the icons
# Same captions as make-shots.py, needed to find where the shot sits under them.
CAPTIONS = {
    "02": ("찾은 행운은\n나만의 기록장에", "Every find goes\ninto your lucky journal"),
    "04": ("모르는 누군가에게\n행운을 보내요", "Send luck\nto a stranger"),
    "06": ("모을수록 열리는\n행운 배지", "Badges unlock\nas your luck grows"),
}
PHOTO_TOP = {"04"}  # screens with a camera photo under the status bar


def shot_box(caption):
    """Where make-shots.py pasted the phone screen: left, top, width and corner radius."""
    font = ImageFont.truetype(FONT, round(W * 0.075))
    top = round(H * 0.05)
    d = ImageDraw.Draw(Image.new("RGB", (W, H)))
    cap_bottom = d.multiline_textbbox((W / 2, top), caption, font=font, anchor="ma", spacing=round(W * 0.02))[3]
    sh = H - cap_bottom - round(H * 0.04)
    sw = round(RAW_W * (sh / RAW_H) * 1.08)
    return (W - sw) // 2, cap_bottom + round(H * 0.04), sw, round(sw * 0.07)


def strip(path, key, caption):
    im = Image.open(path).convert("RGB")
    x0, y0, sw, r = shot_box(caption)
    bar = round(RAW_BAR * sw / RAW_W)
    box = (x0, y0, x0 + sw, y0 + bar)
    if key in PHOTO_TOP:
        fill = im.crop((x0, y0 + bar, x0 + sw, y0 + 2 * bar)).transpose(Image.FLIP_TOP_BOTTOM)
        # The back button sits just under the bar on the left: borrow plain grass from further right there.
        left = round(sw * 0.2)
        fill.paste(im.crop((x0 + left, y0 + bar, x0 + 2 * left, y0 + 2 * bar)).transpose(Image.FLIP_TOP_BOTTOM), (0, 0))
    else:
        fill = Image.new("RGB", (sw, bar), im.getpixel((x0 + sw // 2, y0 + bar + 4)))
    # Only inside the screen's rounded corners; the gradient around it stays.
    mask = Image.new("L", (sw, bar), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, bar + 2 * r], r, fill=255)
    im.paste(fill, box[:2], mask)
    im.save(path)
    return bar


def main(keys=CAPTIONS):
    for lang, i in (("ko", 0), ("en", 1)):
        for key, captions in ((k, CAPTIONS[k]) for k in keys):
            path = os.path.join(OUT, lang, f"{key}-{lang}-{W}x{H}.png")
            print(path, strip(path, key, captions[i]))


if __name__ == "__main__":
    import sys

    main(sys.argv[1:] or CAPTIONS)
