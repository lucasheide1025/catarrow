# scripts/process-tile.py
# 房間立繪後製：rembg 去背 → 依 alpha 裁切 → 置中縮放到 512×512 透明畫布 → 存 WebP
#   用法：python scripts/process-tile.py <輸入.png> <輸出.webp>
import sys
from rembg import remove
from PIL import Image

CANVAS = 512
PAD = 0.05  # 邊界留白比例


def process(inp, outp, canvas=CANVAS, pad=PAD):
    im = Image.open(inp).convert("RGBA")
    cut = remove(im)  # 回傳去背後的 RGBA
    if cut.mode != "RGBA":
        cut = cut.convert("RGBA")
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    max_side = int(canvas * (1 - pad * 2))
    w, h = cut.size
    scale = min(max_side / w, max_side / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    cut = cut.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(cut, ((canvas - nw) // 2, (canvas - nh) // 2), cut)
    out.save(outp, "WEBP", quality=90, method=6)
    print(f"OK  {outp}  <- {inp}  ({nw}x{nh})")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python scripts/process-tile.py <輸入.png> <輸出.webp>")
        sys.exit(1)
    process(sys.argv[1], sys.argv[2])
