"""Graveyard textures (our own designs) -> blender/tex/gy_*.png.   python tex_graveyard.py"""
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
OUT = Path(__file__).resolve().parent / "tex"; OUT.mkdir(exist_ok=True)


def autumn_grass(size=1024, seed=3):
    """amber grass with darker patches, little grass tufts, fallen leaves (red/orange/yellow) - the reference dusk lawn."""
    r = random.Random(seed)
    im = Image.new("RGB", (size, size), (196, 146, 62)); d = ImageDraw.Draw(im)
    for _ in range(260):
        x, y, rr = r.random() * size, r.random() * size, r.uniform(20, 70)
        c = r.choice([(184, 132, 52), (206, 158, 70), (176, 140, 60), (190, 120, 50)])
        d.ellipse([x - rr, y - rr * 0.6, x + rr, y + rr * 0.6], fill=c)
    im = im.filter(ImageFilter.GaussianBlur(14)); d = ImageDraw.Draw(im)
    for _ in range(900):                                   # tufts: little V strokes
        x, y = r.random() * size, r.random() * size
        c = r.choice([(150, 112, 40), (222, 182, 88), (128, 132, 58), (110, 138, 70)])
        for k in (-1, 0, 1):
            d.line([x, y, x + k * r.uniform(3, 7), y - r.uniform(6, 13)], fill=c, width=2)
    for _ in range(420):                                   # leaves
        x, y = r.random() * size, r.random() * size
        c = r.choice([(214, 84, 40), (232, 128, 42), (240, 180, 60), (176, 60, 36), (150, 96, 40)])
        a = r.random() * math.pi; L = r.uniform(5, 10)
        pts = [(x + math.cos(a) * L, y + math.sin(a) * L), (x + math.cos(a + 1.9) * L * 0.45, y + math.sin(a + 1.9) * L * 0.45),
               (x - math.cos(a) * L, y - math.sin(a) * L), (x + math.cos(a - 1.9) * L * 0.45, y + math.sin(a - 1.9) * L * 0.45)]
        d.polygon(pts, fill=c)
    for _ in range(140):                                   # pebbles
        x, y, rr = r.random() * size, r.random() * size, r.uniform(2, 4)
        d.ellipse([x - rr, y - rr * 0.7, x + rr, y + rr * 0.7], fill=(160, 150, 150), outline=(90, 70, 60))
    im.save(OUT / "gy_grass.png")


def snow_ground(size=1024, seed=5):
    """white-lilac snow with soft blue dimples (footprints) like the reference."""
    r = random.Random(seed)
    im = Image.new("RGB", (size, size), (240, 241, 255)); d = ImageDraw.Draw(im)
    for _ in range(90):
        x, y, rr = r.random() * size, r.random() * size, r.uniform(30, 90)
        d.ellipse([x - rr, y - rr * 0.6, x + rr, y + rr * 0.6], fill=r.choice([(232, 234, 252), (246, 246, 255), (228, 230, 250)]))
    im = im.filter(ImageFilter.GaussianBlur(20)); d = ImageDraw.Draw(im)
    for _ in range(60):
        x, y = r.random() * size, r.random() * size
        for k in range(r.randint(2, 4)):
            xx, yy = x + k * 26, y + (k % 2) * 16
            d.ellipse([xx - 8, yy - 5, xx + 8, yy + 5], fill=(208, 212, 244))
    for _ in range(500):
        x, y = r.random() * size, r.random() * size
        d.point((x, y), fill=(214, 218, 246))
    im.filter(ImageFilter.GaussianBlur(1.2)).save(OUT / "gy_snow.png")


def shingles(size=512, seed=7, base=(122, 92, 82)):
    r = random.Random(seed)
    im = Image.new("RGB", (size, size), base); d = ImageDraw.Draw(im); rows = 6; h = size // rows; w = size // 5
    for i in range(rows):
        off = (i % 2) * w // 2
        for j in range(-1, 6):
            k = 1 + (r.random() - 0.5) * 0.25
            c = tuple(max(0, min(255, int(v * k))) for v in base)
            x0 = j * w + off; d.rectangle([x0, i * h, x0 + w, (i + 1) * h], fill=c, outline=(52, 36, 34), width=4)
            d.line([x0 + 6, (i + 1) * h - 8, x0 + w - 6, (i + 1) * h - 8], fill=tuple(int(v * 0.8) for v in c), width=3)
    im.save(OUT / "gy_shingles.png")


def headstone(size=256):
    im = Image.new("RGB", (size, size), (226, 226, 232)); d = ImageDraw.Draw(im)
    d.ellipse([88, 50, 168, 130], outline=(150, 150, 165), width=5)
    d.ellipse([110, 72, 146, 108], outline=(165, 165, 178), width=3)
    for y in (150, 172, 190):
        d.line([70, y, 186, y], fill=(170, 170, 182), width=4)
    im.save(OUT / "gy_stone.png")


def pit_soil(size=1024, seed=9):
    """orange-brown pit wall with embedded pebbles + roots (reference grave walls)."""
    r = random.Random(seed)
    im = Image.new("RGB", (size, size), (176, 92, 44)); d = ImageDraw.Draw(im)
    for _ in range(200):
        x, y, rr = r.random() * size, r.random() * size, r.uniform(30, 90)
        d.ellipse([x - rr, y - rr * 0.4, x + rr, y + rr * 0.4], fill=r.choice([(168, 84, 40), (186, 102, 50), (160, 80, 44)]))
    im = im.filter(ImageFilter.GaussianBlur(12)); d = ImageDraw.Draw(im)
    for _ in range(40):                                   # roots
        x, y = r.random() * size, r.random() * size; pts = [(x, y)]
        for k in range(5): x += r.uniform(-14, 14); y += r.uniform(8, 22); pts.append((x, y))
        d.line(pts, fill=(96, 52, 30), width=3)
    for _ in range(260):
        x, y, rr = r.random() * size, r.random() * size, r.uniform(4, 9)
        d.ellipse([x - rr, y - rr * 0.7, x + rr, y + rr * 0.7], fill=r.choice([(150, 150, 160), (130, 132, 150), (176, 170, 168)]), outline=(70, 50, 44), width=2)
    im.save(OUT / "gy_pit.png")


def post_wood(size=512, seed=12):
    """light tan wood with vertical grain (bell post)."""
    r = random.Random(seed)
    im = Image.new("RGB", (size, size), (214, 176, 120)); d = ImageDraw.Draw(im)
    for _ in range(70):
        x = r.random() * size; c = r.choice([(196, 156, 100), (224, 190, 136), (186, 146, 92)])
        w = r.uniform(2, 6); pts = [(x + 4 * math.sin(y / 60 + x), y) for y in range(0, size + 16, 16)]
        d.line(pts, fill=c, width=int(w))
    for _ in range(4):
        x, y = r.random() * size, r.random() * size
        d.ellipse([x - 6, y - 14, x + 6, y + 14], outline=(140, 100, 60), width=3)
    im.save(OUT / "gy_postwood.png")


if __name__ == "__main__":
    autumn_grass(); snow_ground(); shingles(); headstone(); pit_soil(); post_wood(); print("ok")
