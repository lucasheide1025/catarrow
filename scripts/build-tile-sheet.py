# scripts/build-tile-sheet.py
# 把七大族的 2.5D 格子合成一張聯絡表 PNG（審核用）：
#   <embedded_python> scripts/build-tile-sheet.py
# 輸出：.trellis/tasks/08-07-village-board-journey-redesign/research/tile-all-sheet.png
import os
from PIL import Image, ImageDraw, ImageFont

SRC = "public/assets/board"
OUT = ".trellis/tasks/08-07-village-board-journey-redesign/research/tile-all-sheet.png"
FAMILIES = ["mine", "farm", "harbor", "hunting", "market", "warehouse", "archery"]
FAMILY_NAMES = {"mine": "星屑礦坑", "farm": "月芽農田", "harbor": "霧潮港口", "hunting": "巡林狩獵場",
                "market": "喧鬧市集", "warehouse": "古罐倉庫", "archery": "藏金靶場"}
TYPES = ["start","material","mining","monster","arrowdew","coins","gacha","potion","chest",
         "catbond","fate","opp","camp","empower","catmate","trap","shortcut","market","scenery","fork","boss"]

try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 14)
    small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 11)
except Exception:
    font = small = ImageFont.load_default()

CELL, PAD = 96, 6
W = CELL * len(TYPES) + PAD * 2
H = CELL * len(FAMILIES) + PAD * 2 + 40
sheet = Image.new("RGB", (W, H), (24, 14, 6))
d = ImageDraw.Draw(sheet)
d.text((PAD, 10), "2.5D journey tiles - 7 families x 20 types", font=font, fill=(252, 211, 77))
for fi, fam in enumerate(FAMILIES):
    y = 38 + fi * CELL
    d.text((PAD, y + 2), f"{FAMILY_NAMES[fam]}", font=small, fill=(212, 160, 23))
    for ti, t in enumerate(TYPES):
        x = PAD + ti * CELL
        try:
            im = Image.open(f"{SRC}/tile_{fam}_{t}.webp").convert("RGBA")
            im.thumbnail((CELL - 14, CELL - 14), Image.LANCZOS)
            sheet.paste(im, (x + (CELL - im.width) // 2, y + 14 + (CELL - 14 - im.height) // 2), im)
        except Exception:
            d.rectangle([x + 2, y + 16, x + CELL - 4, y + CELL - 6], outline=(90, 60, 20))
    if fi == 0:
        for ti, t in enumerate(TYPES):
            d.text((PAD + ti * CELL + 6, y - 14), t[:6], font=small, fill=(250, 204, 21))
sheet.save(OUT, "PNG")
print("saved", OUT, sheet.size)
