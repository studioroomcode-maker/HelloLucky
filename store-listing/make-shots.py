"""스토어 스크린샷 만들기 (2026-10-17).

    python store-listing/make-shots.py <원본 폴더> <ko|en>

원본 = 폰(1440x3120 등)에서 `adb exec-out screencap -p > 01-scan.png` 로 찍은 화면. 파일 이름 앞 두 글자(01~06)로 문구를 고른다.
결과: assets/play/screenshots/<lang>/ (1080x1920) · assets/appstore/screenshots-6.9/<lang>/ (1290x2796)
영어 화면은 폰 언어를 English 로 바꾸고 앱을 다시 켜서 찍는다(앱 안 언어 전환 없음).
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT = os.path.join(ROOT, "assets", "fonts", "SDGothicNeoRound-hEb.ttf")
SKY, GRASS = (35, 188, 252), (32, 137, 60)  # 스플래시 하늘색 → 아이콘 초록

CAPTIONS = {
    "01": ("풀밭을 비추면\nAI가 행운을 찾아줘요", "Point at the grass,\nthe AI finds your luck"),
    "02": ("찾은 행운은\n나만의 기록장에", "Every find goes\ninto your lucky journal"),
    "03": ("행운마다\n오늘의 한 줄 운세", "A fortune line\nwith every find"),
    "04": ("모르는 누군가에게\n행운을 보내요", "Send luck\nto a stranger"),
    "05": ("전 세계의 행운을\n지도에서 만나요", "See luck found\naround the world"),
    "06": ("모을수록 열리는\n행운 배지", "Badges unlock\nas your luck grows"),
}
SIZES = {"play/screenshots": (1080, 1920), "appstore/screenshots-6.9": (1290, 2796)}


def compose(shot, caption, size):
    w, h = size
    bg = Image.new("RGB", size)
    d = ImageDraw.Draw(bg)
    for y in range(h):  # 세로 그라데이션
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(SKY, GRASS)))
    font = ImageFont.truetype(FONT, round(w * 0.075))
    top = round(h * 0.05)
    d.multiline_text((w / 2, top), caption, font=font, fill="white", anchor="ma", align="center", spacing=round(w * 0.02))
    cap_bottom = d.multiline_textbbox((w / 2, top), caption, font=font, anchor="ma", spacing=round(w * 0.02))[3]
    # 화면은 캡션 아래 남은 높이에 맞추고 아래로 살짝 잘려 나가게 둔다
    sh = h - cap_bottom - round(h * 0.04)
    sw = round(shot.width * (sh / shot.height) * 1.08)
    shot = shot.resize((sw, round(shot.height * sw / shot.width)), Image.LANCZOS)
    r = round(sw * 0.07)
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], r, fill=255)
    bg.paste(shot, ((w - sw) // 2, cap_bottom + round(h * 0.04)), mask)
    return bg


def main(src, lang):
    i = {"ko": 0, "en": 1}[lang]
    files = sorted(f for f in os.listdir(src) if f.lower().endswith(".png") and f[:2] in CAPTIONS)
    assert files, f"{src} 에 01~06 으로 시작하는 png 가 없습니다"
    for sub, size in SIZES.items():
        out = os.path.join(HERE, "assets", sub, lang)
        os.makedirs(out, exist_ok=True)
        for old in os.listdir(out):
            os.remove(os.path.join(out, old))
        for f in files:
            img = compose(Image.open(os.path.join(src, f)).convert("RGB"), CAPTIONS[f[:2]][i], size)
            assert img.size == size
            img.save(os.path.join(out, f"{f[:2]}-{lang}-{size[0]}x{size[1]}.png"))
        print(out, len(files))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
