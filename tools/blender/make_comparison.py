"""Compose honest A/B and review sheets from real Blender renders. ISC.
Pillow only rescales and labels; it never synthesises or retouches character pixels.
Run: python tools/blender/make_comparison.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/r1b/v2'
F = Path('C:/Windows/Fonts/segoeui.ttf')
FB = Path('C:/Windows/Fonts/segoeuib.ttf')
font = ImageFont.truetype(str(F), 20)
label = ImageFont.truetype(str(FB), 24)
title = ImageFont.truetype(str(FB), 34)
small = ImageFont.truetype(str(F), 17)

VIEWS = [('front', 'FRONTAL'), ('side', 'LATERAL'), ('back', 'POSTERIOR'), ('three-quarter', 'TRES CUARTOS')]
CW, CH = 374, 312

# --- A/B: same cameras, lights and world for both versions -------------------
ab = Image.new('RGB', (1600, 830), '#111a22')
d = ImageDraw.Draw(ab)
d.text((40, 24), 'V1  vs  V2 — MISMAS CÁMARAS, LUCES Y MUNDO', font=title, fill='#ffd29a')
d.text((40, 70), 'Renders reales de Blender 5.2.2 · V1 re-renderizada para comparar · modelo estático', font=small, fill='#b9c6cf')
for i, (name, caption) in enumerate(VIEWS):
    x = 40 + i * 390
    d.text((x, 108), caption, font=label, fill='#ffd29a')
    v1 = Image.open(DOC / f'v1-comparison-{name}.png').convert('RGB').resize((CW, CH), Image.Resampling.LANCZOS)
    v2 = Image.open(DOC / f'salamander-{name}.png').convert('RGB').resize((CW, CH), Image.Resampling.LANCZOS)
    d.text((x, 142), 'V1', font=label, fill='#ff7a5c')
    ab.paste(v1, (x, 172))
    d.text((x, 500), 'V2', font=label, fill='#7cff9b')
    ab.paste(v2, (x, 530))
d.text((40, 880), 'Sin bloom ni postproceso de personaje · V1 conservada intacta', font=small, fill='#b9c6cf')
ab.save(DOC / 'salamander-before-after.png')

# --- review sheet: four unretouched V2 frames ------------------------------
sheet = Image.new('RGB', (1600, 1510), '#141d26')
d = ImageDraw.Draw(sheet)
d.text((40, 25), 'SALAMANDER V2 / R1-B.2A', font=title, fill='#ffd298')
d.text((40, 72), 'RENDERS REALES DE BLENDER · MODELO ESTÁTICO · SIN RIG · REVISIÓN HUMANA PENDIENTE', font=small, fill='#bcc9d2')
for i, (name, caption) in enumerate(VIEWS):
    img = Image.open(DOC / f'salamander-{name}.png').convert('RGB')
    assert img.size == (1200, 1000), (name, img.size)
    img = img.resize((744, 620), Image.Resampling.LANCZOS)
    x = 40 + (i % 2) * 776
    y = 150 + (i // 2) * 672
    d.text((x, y - 32), f'0{i+1} / {caption}', font=font, fill='#ffd298')
    sheet.paste(img, (x, y))
d.text((40, 1465), 'No es aprobación artística ni captura del juego', font=small, fill='#bcc9d2')
sheet.save(DOC / 'salamander-review-sheet.png')
print('Composed:', DOC / 'salamander-before-after.png', DOC / 'salamander-review-sheet.png')
