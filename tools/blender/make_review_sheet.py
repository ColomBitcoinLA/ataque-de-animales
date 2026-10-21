"""Compose four unretouched Blender renders for human art review; ISC.
Requires Pillow. Does not generate character pixels or edit the source renders.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/r1b'
font_file = Path('C:/Windows/Fonts/segoeui.ttf')
bold_file = Path('C:/Windows/Fonts/segoeuib.ttf')
font = ImageFont.truetype(str(font_file), 22)
title = ImageFont.truetype(str(bold_file), 32)
canvas = Image.new('RGB',(1600,1510),'#141d26')
draw=ImageDraw.Draw(canvas)
draw.text((40,25),'SALAMANDER / R1-B.2',font=title,fill='#ffd298')
draw.text((40,72),'RENDERS REALES DE BLENDER · MODELO ESTÁTICO · REVISIÓN HUMANA PENDIENTE',font=font,fill='#bcc9d2')
for i,(name,label) in enumerate([('front','01 / FRONTAL'),('side','02 / LATERAL DERECHA'),('back','03 / POSTERIOR'),('three-quarter','04 / TRES CUARTOS')]):
    image=Image.open(DOC/f'salamander-{name}.png').convert('RGB')
    assert image.size==(1200,1000)
    # Same aspect ratio, entire source frame; only resampling and layout.
    image=image.resize((744,620),Image.Resampling.LANCZOS)
    x=40+(i%2)*776; y=150+(i//2)*672
    draw.text((x,y-32),label,font=font,fill='#ffd298')
    canvas.paste(image,(x,y))
draw.text((40,1465),'Sin rig / animaciones · No es aprobación artística ni captura del juego',font=font,fill='#bcc9d2')
canvas.save(DOC/'salamander-review-sheet.png')
print('Review sheet composed from the four full, unretouched Blender frames.')
