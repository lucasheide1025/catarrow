# 用實際生成的 2.5D 格子，模擬旅程蜿蜒路徑畫面（畫面驗證用）
# 尺寸與 CatVillageBoard.jsx 同步：CELL_W=66 / CELL_H=70 / TILE=56
from PIL import Image, ImageDraw, ImageFont
import os

BOARD = "public/assets/board"
OUT = ".trellis/tasks/08-07-village-board-journey-redesign/research/journey-screen-preview.png"
CELLS = ["start","coins","material","monster","arrowdew","camp","mining","chest","trap",
         "material","empower","monster","fork","coins","mining","shortcut","catmate",
         "material","arrowdew","monster","scenery","mining","chest","gacha","material",
         "monster","coins","arrowdew","mining","boss"]
FAM = "mine"
CELL_W, CELL_H, TILESZ, MARGIN = 88, 96, 76, 14
COLS = 6
ROWS = (len(CELLS) + COLS - 1) // COLS
W = MARGIN * 2 + COLS * CELL_W
H = MARGIN * 2 + ROWS * CELL_H + 60

canvas = Image.new("RGBA", (W, H), (22, 12, 6))
d = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 16)
except Exception:
    font = ImageFont.load_default()

def pos(i):
    r, c = divmod(i, COLS)
    if r % 2 == 1: c = COLS - 1 - c
    return (MARGIN + c * CELL_W + CELL_W // 2, MARGIN + 40 + r * CELL_H + CELL_H // 2)

pts = [pos(i) for i in range(len(CELLS))]
for i in range(len(pts) - 1):
    d.line([pts[i], pts[i + 1]], fill=(212, 170, 90), width=5)

d.text((MARGIN, 8), "模擬旅程畫面（山岳族・2.5D 格子・76px 鏡頭跟隨版）", font=font, fill=(252, 211, 77))
cache = {}
def tile_img(t):
    if t not in cache:
        p = os.path.join(BOARD, f"tile_{FAM}_{t}.webp")
        im = Image.open(p).convert("RGBA") if os.path.exists(p) else Image.new("RGBA", (512, 512), (80, 60, 30))
        cache[t] = im.resize((TILESZ, TILESZ), Image.LANCZOS)
    return cache[t]

for i, t in enumerate(CELLS):
    x, y = pos(i)
    x -= TILESZ // 2; y -= TILESZ // 2
    canvas.alpha_composite(tile_img(t), (x, y))
    d.ellipse([pos(i)[0] - 3, pos(i)[1] - 3, pos(i)[0] + 3, pos(i)[1] + 3], fill=(255, 220, 120))
    if t == "boss":
        d.ellipse([pos(i)[0] - 24, pos(i)[1] - 24, pos(i)[0] + 24, pos(i)[1] + 24], outline=(248, 113, 113), width=3)

canvas.convert("RGB").save(OUT, quality=92)
print(f"saved {OUT} ({W}x{H})")
