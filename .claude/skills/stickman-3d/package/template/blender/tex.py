"""Painted textures for the sets (our own designs) -> blender/tex/*.png.  python tex.py"""
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = Path(__file__).resolve().parent / "tex"; OUT.mkdir(exist_ok=True)


def font(sz, serif=True, italic=False):
    for f in (["georgiai.ttf"] if italic else []) + (["georgia.ttf", "times.ttf"] if serif else ["arialbd.ttf", "arial.ttf"]):
        try: return ImageFont.truetype(f, sz)
        except Exception: pass
    return ImageFont.load_default()


def wallpaper(name="wallpaper", base=(185, 195, 239), stripe=(169, 180, 230), rose=(229, 143, 176)):
    im = Image.new("RGB", (512, 512), base); d = ImageDraw.Draw(im)
    for x in range(0, 512, 64): d.rectangle([x, 0, x + 22, 512], fill=stripe)
    for iy in range(4):
        for ix in range(4):
            x, y = ix * 128 + 54 + (iy % 2) * 64, iy * 128 + 60
            d.line([x, y + 8, x, y + 34], fill=(95, 154, 106), width=4)
            d.ellipse([x - 17, y + 20, x - 1, y + 28], fill=(111, 174, 122)); d.ellipse([x + 1, y + 16, x + 17, y + 24], fill=(111, 174, 122))
            d.ellipse([x - 11, y - 11, x + 11, y + 11], fill=rose); d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(200, 104, 144))
    im.save(OUT / f"{name}.png")


def planks(name="planks", base=(154, 102, 72), n=8, size=1024, seed=1):
    r = random.Random(seed); im = Image.new("RGB", (size, size)); d = ImageDraw.Draw(im); h = size // n
    for i in range(n):
        k = 1 + (r.random() - 0.5) * 0.16
        c = tuple(max(0, min(255, int(v * k))) for v in base)
        d.rectangle([0, i * h, size, (i + 1) * h], fill=c)
        d.line([0, i * h, size, i * h], fill=(40, 20, 10), width=5)
        j = int(r.random() * size); d.line([j, i * h, j, (i + 1) * h], fill=(40, 20, 10), width=5)
        for _ in range(4):
            y = i * h + 10 + r.random() * (h - 20); d.line([0, y, size, y + r.uniform(-6, 6)], fill=tuple(int(v * 0.88) for v in c), width=2)
    im.save(OUT / f"{name}.png")


def rug():
    cols = [(216, 67, 59), (240, 138, 44), (242, 196, 58), (95, 176, 74), (47, 134, 201), (124, 75, 181), (232, 226, 212)]
    im = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for i in range(24):
        rr = 500 - i * 20; c = cols[(i * 3) % len(cols)]
        d.ellipse([512 - rr, 512 - rr, 512 + rr, 512 + rr], fill=c + (255,))
        for a in range(0, 360, 5):
            t = math.radians(a); d.line([512 + (rr - 6) * math.cos(t), 512 + (rr - 6) * math.sin(t), 512 + (rr - 14) * math.cos(t + 0.04), 512 + (rr - 14) * math.sin(t + 0.04)], fill=(0, 0, 0, 22), width=2)
    im.save(OUT / "rug.png")


def window_view(name, night=True):
    W, H = 512, 768; im = Image.new("RGB", (W, H)); d = ImageDraw.Draw(im)
    top, mid, gnd = ((111, 134, 232), (184, 198, 255), (223, 230, 255)) if night else ((90, 176, 240), (191, 228, 255), (124, 198, 90))
    for y in range(H):
        t = y / H
        c = tuple(int(a + (b - a) * min(1, t / 0.55)) for a, b in zip(top, mid)) if t < 0.56 else gnd
        d.line([0, y, W, y], fill=c)
    if night:
        for x in range(10, W, 40): d.rectangle([x, 470, x + 12, 540], fill=(244, 246, 255))
        d.rectangle([0, 490, W, 498], fill=(244, 246, 255)); d.rectangle([0, 520, W, 528], fill=(244, 246, 255))
        d.rectangle([300, 230, 318, 490], fill=(58, 51, 96)); d.polygon([(270, 240), (309, 205), (348, 240)], fill=(58, 51, 96))
        d.pieslice([295, 248, 323, 276], 180, 360, fill=(232, 176, 74))
        r = random.Random(3)
        for _ in range(70): x, y = r.random() * W, r.random() * 470; d.ellipse([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=(255, 255, 255))
    else:
        for i in range(6): d.ellipse([i * 90, 360, i * 90 + 80, 440], fill=(63, 138, 58))
        for i in range(4): d.ellipse([46 + i * 120, 546, 74 + i * 120, 574], fill=(242, 196, 58))
        for cx, cy, rr in ((120, 120, 30), (150, 110, 34), (185, 125, 26)): d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(255, 255, 255))
    im.save(OUT / f"{name}.png")


def dig_note():
    im = Image.new("RGB", (512, 384), (246, 239, 224)); d = ImageDraw.Draw(im)
    d.rectangle([6, 6, 506, 378], outline=(200, 190, 170), width=3)
    for i in range(3): d.ellipse([50 + i * 55, 110, 90 + i * 55, 150], fill=(28, 22, 32))
    d.rectangle([240, 118, 350, 144], fill=(28, 22, 32))
    d.text((285, 180), "= dig", fill=(28, 22, 32), font=font(70, italic=True))
    d.polygon([(110, 340), (60, 290), (75, 262), (110, 290), (145, 262), (160, 290)], fill=(216, 51, 58))
    d.ellipse([244, 14, 268, 38], fill=(201, 162, 39))
    im.save(OUT / "dig_note.png")


def tally():
    im = Image.new("RGBA", (256, 1024), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    days = ["Jun 2", "Jun 9", "Jun 16", "Jun 23", "Jun 30", "Jul 7", "Jul 14", "Jul 21", "Jul 28", "Aug 4", "Aug 11"]
    for i, day in enumerate(days):
        y = 60 + i * 88
        d.text((8, y - 12), day, fill=(40, 30, 60, 200), font=font(26, italic=True))
        for k in range(3): d.ellipse([114 + k * 24, y - 8, 130 + k * 24, y + 8], fill=(246, 243, 255, 255))
        d.rectangle([196, y - 6, 240, y + 6], fill=(246, 243, 255, 255))
    im.save(OUT / "tally.png")


def certificate():
    W, H = 800, 1000; im = Image.new("RGB", (W, H), (242, 232, 205)); d = ImageDraw.Draw(im)
    d.rectangle([24, 24, W - 24, H - 24], outline=(120, 90, 60), width=6); d.rectangle([40, 40, W - 40, H - 40], outline=(120, 90, 60), width=2)
    c = lambda y, s, sz, it=False: d.text(((W - d.textlength(s, font=font(sz, italic=it))) / 2, y), s, fill=(50, 35, 30), font=font(sz, italic=it))
    c(90, "CERTIFICATE", 76); c(180, "OF DEATH", 48); c(300, "I hereby certify the death of", 34, True)
    c(390, "S. HOLT", 96); c(520, "Oct. 21, 1894", 46)
    d.line([300, 760, 560, 760], fill=(50, 35, 30), width=3); c(700, "A. Hale", 52, True); c(780, "Physician", 30)
    d.ellipse([560, 800, 720, 960], fill=(196, 52, 50)); d.ellipse([580, 820, 700, 940], outline=(240, 200, 190), width=4)
    im.save(OUT / "certificate.png")


def iou(i):
    im = Image.new("RGB", (400, 260), (246, 240, 226)); d = ImageDraw.Draw(im)
    d.text((24, 20), "I.O.U.", fill=(40, 30, 30), font=font(60)); d.text((24, 110), f"${[20, 50, 12, 100, 35, 8][i % 6]}  - S. Holt", fill=(40, 30, 30), font=font(36, italic=True))
    d.line([24, 200, 360, 200], fill=(120, 100, 90), width=2)
    im.save(OUT / f"iou{i}.png")


def plaque():
    im = Image.new("RGB", (512, 256), (232, 222, 196)); d = ImageDraw.Draw(im)
    d.rectangle([8, 8, 504, 248], outline=(60, 45, 35), width=8)
    d.text((70, 40), "S. HOLT", fill=(40, 30, 25), font=font(110)); d.text((150, 170), "1849 - 1894", fill=(40, 30, 25), font=font(48, italic=True))
    im.save(OUT / "plaque.png")


def physician():
    im = Image.new("RGB", (768, 256), (40, 52, 90)); d = ImageDraw.Draw(im)
    d.rectangle([10, 10, 758, 246], outline=(230, 200, 120), width=8)
    d.text((60, 40), "A. HALE", fill=(240, 230, 200), font=font(96)); d.text((150, 165), "PHYSICIAN", fill=(230, 200, 120), font=font(56))
    im.save(OUT / "physician.png")


def west():
    im = Image.new("RGB", (512, 160), (190, 140, 90)); d = ImageDraw.Draw(im)
    d.rectangle([6, 6, 506, 154], outline=(90, 60, 40), width=8); d.text((120, 22), "WEST", fill=(60, 35, 25), font=font(110))
    im.save(OUT / "west.png")


def soil():
    """cross-section soil: orange-brown earth with stones, darker bands"""
    r = random.Random(5); im = Image.new("RGB", (1024, 1024), (196, 110, 56)); d = ImageDraw.Draw(im)
    for y in range(0, 1024, 4):
        k = 0.85 + 0.15 * math.sin(y / 60.0); d.line([0, y, 1024, y], fill=(int(196 * k), int(110 * k), int(56 * k)))
    for _ in range(140):
        x, y, s = r.random() * 1024, r.random() * 1024, r.uniform(6, 18)
        d.ellipse([x - s, y - s * 0.7, x + s, y + s * 0.7], fill=(150, 140, 135), outline=(60, 40, 30), width=3)
    im = im.filter(ImageFilter.SMOOTH); im.save(OUT / "soil.png")


def snow():
    r = random.Random(7); im = Image.new("RGB", (1024, 1024), (236, 240, 252)); d = ImageDraw.Draw(im)
    for _ in range(900):
        x, y, s = r.random() * 1024, r.random() * 1024, r.uniform(2, 8); c = int(r.uniform(214, 232))
        d.ellipse([x - s, y - s * 0.5, x + s, y + s * 0.5], fill=(c, c + 4, 250))
    im.save(OUT / "snow.png")


def grass(name="grass", base=(116, 178, 70), seed=11):
    r = random.Random(seed); im = Image.new("RGB", (1024, 1024), base); d = ImageDraw.Draw(im)
    for _ in range(3500):
        x, y = r.random() * 1024, r.random() * 1024; k = r.uniform(0.8, 1.15)
        d.line([x, y, x + r.uniform(-3, 3), y - r.uniform(6, 14)], fill=tuple(min(255, int(c * k)) for c in base), width=2)
    im.save(OUT / f"{name}.png")


def dirt():
    r = random.Random(13); im = Image.new("RGB", (1024, 1024), (110, 72, 46)); d = ImageDraw.Draw(im)
    for _ in range(1500):
        x, y, s = r.random() * 1024, r.random() * 1024, r.uniform(3, 12); k = r.uniform(0.7, 1.2)
        d.ellipse([x - s, y - s * 0.6, x + s, y + s * 0.6], fill=(int(110 * k), int(72 * k), int(46 * k)))
    im.save(OUT / "dirt.png")


def siding(name, base):
    im = Image.new("RGB", (512, 512), base); d = ImageDraw.Draw(im)
    for y in range(0, 512, 32):
        d.line([0, y, 512, y], fill=tuple(int(c * 0.72) for c in base), width=4)
        d.rectangle([0, y + 4, 512, y + 8], fill=tuple(min(255, int(c * 1.08)) for c in base))
    im.save(OUT / f"{name}.png")


if __name__ == "__main__":
    wallpaper(); planks(); planks("floorboards_night", (120, 80, 60)); planks("coffin_wood", (196, 154, 82), 6, 512, 4)
    rug(); window_view("win_night", True); window_view("win_day", False); dig_note(); tally(); certificate()
    for i in range(6): iou(i)
    plaque(); physician(); west(); soil(); snow(); grass(); grass("grass_autumn", (196, 150, 70), 12); dirt()
    for n, c in (("siding_teal", (64, 160, 160)), ("siding_purple", (110, 60, 120)), ("siding_red", (180, 60, 50)), ("siding_yellow", (214, 176, 70)),
                 ("siding_blue", (70, 110, 180)), ("siding_cream", (232, 222, 196)), ("siding_wood", (130, 86, 56))): siding(n, c)
    print(sorted(p.name for p in OUT.iterdir()))
