"""Build every app/store icon size from the designer sources in assets/.

Sources (replace these to rebrand, then run `python scripts/make_icons.py`):
  assets/icon.png   square-ish app icon with rounded corners and a thin light rim
  assets/logo.png   white "HELLO LUCK" logo on transparency (home header, store banners)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC_ICON = ROOT / "assets" / "icon.png"
SRC_LOGO = ROOT / "assets" / "logo.png"
OUT = ROOT / "assets" / "images"
STORE = ROOT / "store-listing" / "assets"
# Launchers show only the centre 72/108 (often a 66dp circle) of the layer; 0.58 keeps the bracket corners inside it.
ADAPTIVE_CONTENT = 0.58


def full_bleed_icon(size: int) -> Image.Image:
    """Square, opaque icon: trim the source's rounded corners and light rim, the OS applies its own mask."""
    src = Image.open(SRC_ICON).convert("RGB")
    w, h = src.size
    inset = 4  # rim + corner rounding measured on the source
    side = min(w, h) - 2 * inset
    left, top = (w - side) // 2, (h - side) // 2
    return src.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def art_mask(img: Image.Image) -> Image.Image:
    """Clover + stem + corner brackets: everything not connected to the dark green field at the border."""
    a = np.asarray(img).astype(int)
    field = (a[..., 0] < 62) & (a[..., 1] < 160)
    labels, _ = ndimage.label(field)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, border[border > 0])
    art = ndimage.binary_opening(~background, iterations=1)
    return Image.fromarray((art * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))


def field_color() -> str:
    a = np.asarray(full_bleed_icon(256)).astype(int)
    r, g, b = (int(np.median(np.concatenate([a[:12, :, c].ravel(), a[-12:, :, c].ravel()]))) for c in range(3))
    return f"#{r:02X}{g:02X}{b:02X}"


def _cutout(size: int, color: tuple[int, int, int] | None) -> Image.Image:
    art = full_bleed_icon(round(size * ADAPTIVE_CONTENT))
    mask = art_mask(art)
    layer = Image.new("RGBA", art.size, (0, 0, 0, 0))
    fill = art if color is None else Image.new("RGB", art.size, color)
    layer.paste(fill, (0, 0), mask)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    off = (size - art.width) // 2
    out.alpha_composite(layer, (off, off))
    return out


def adaptive_layer(size: int) -> Image.Image:
    """Foreground: the art cut out of its field, inside the adaptive safe zone (background = field_color())."""
    return _cutout(size, None)


def monochrome_layer(size: int) -> Image.Image:
    """Themed-icon silhouette (Android 13+): solid white art on transparent."""
    return _cutout(size, (255, 255, 255))


def main():
    icon = full_bleed_icon(1024)
    icon.save(OUT / "icon.png")
    adaptive_layer(1024).save(OUT / "android-icon-foreground.png")
    monochrome_layer(1024).save(OUT / "android-icon-monochrome.png")
    # Android status-bar notification icon: white silhouette, no padding to waste at 24dp.
    full = _cutout(round(1024 / ADAPTIVE_CONTENT), (255, 255, 255))
    art = full.crop(full.getchannel("A").getbbox())
    side = max(art.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.alpha_composite(art, ((side - art.width) // 2, (side - art.height) // 2))
    square.resize((96, 96), Image.LANCZOS).save(OUT / "notification-icon.png")
    # Blank native splash: the in-app title art (assets/title.png) carries the logo; a splash logo
    # would cross-fade over it and show twice.
    Image.new("RGBA", (64, 64), (0, 0, 0, 0)).save(OUT / "splash-icon.png")
    icon.resize((48, 48), Image.LANCZOS).save(OUT / "favicon.png")

    icon.resize((512, 512), Image.LANCZOS).save(STORE / "play" / "icon-512.png")
    icon.save(STORE / "appstore" / "icon-1024.png")  # App Store: 1024, opaque, no rounding
    icon.save(STORE / "toss" / "icon-1024.png")
    assert ImageChops.difference(icon, icon.convert("RGB")).getbbox() is None
    print("icons ->", OUT, "| adaptive backgroundColor:", field_color())


if __name__ == "__main__":
    main()
