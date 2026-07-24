# scripts/gen-board-tiles.py
# 貓貓村大富翁：格子圖示（去背 512 WebP）→ public/assets/board/tile_<type>.webp
#   風格：可愛手繪 mobile game icon（配合參考圖），非寫實。
#   用法：<embedded_python> scripts/gen-board-tiles.py <type|all>
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "board")
CANVAS, PAD = 512, 0.08

BASE = ("cute chunky mobile game icon, kawaii painterly casual game art, soft rounded shapes, bold clean outline, "
        "single centered object, bright cheerful colors, NOT realistic, no text, no ui, plain background. ")

TILES = {
    "start":    "a cheerful checkered START flag on a little pole, green base",
    "material": "an open burlap sack overflowing with shiny crafting materials and ore chunks",
    "mining":   "a crossed pickaxe and shovel over a glowing gem-filled rock",
    "monster":  "a cute tiny round friendly monster with big eyes and little horns, smiling",
    "arrowdew":  "a big glowing blue dew water droplet with sparkles",
    "coins":    "a stack of shiny gold coins with a sparkle",
    "gacha":    "a colorful gacha capsule-toy machine, round capsules",
    "potion":   "a cute round potion bottle with glowing green liquid and cork",
    "chest":    "a cute closed wooden treasure chest with gold trim, slightly open glow",
    "catbond":  "a cute smiling cat face with a pink heart above its head",
    "fate":     "a mysterious fortune tarot card with a swirl and a question mark, purple gold",
    "opp":      "a lucky opportunity card with a four-leaf clover and a gift, teal gold",
}
NEG = ("realistic, photorealistic, text, letters, watermark, ui, frame, people, hands, multiple objects, "
       "cluttered, blurry, lowres, deformed, dark, scary")


def post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(COMFY + path, data=data, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=60))


def build_wf(pos, neg):
    import random
    return {
        "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 2**31 - 1), "steps": 8,
              "cfg": 2.0, "sampler_name": "dpmpp_sde", "scheduler": "karras", "denoise": 1.0,
              "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "board_gen", "images": ["8", 0]}},
    }


def generate(pos, neg):
    pid = post("/prompt", {"prompt": build_wf(pos, neg), "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(120):
        h = get(f"/history/{pid}")
        if pid in h and h[pid].get("status", {}).get("completed"):
            img = h[pid]["outputs"]["9"]["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img["type"]})
            return urllib.request.urlopen(COMFY + "/view?" + q, timeout=60).read()
        time.sleep(1.5)
    raise RuntimeError("timeout")


def cut_and_save(png_bytes, outpath):
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    cut = remove(im).convert("RGBA")
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    m = int(CANVAS * (1 - PAD * 2))
    w, h = cut.size
    s = min(m / w, m / h)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    cut = cut.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(cut, ((CANVAS - nw) // 2, (CANVAS - nh) // 2), cut)
    out.save(outpath, "WEBP", quality=90, method=6)


def run(t):
    os.makedirs(OUTDIR, exist_ok=True)
    outpath = os.path.abspath(os.path.join(OUTDIR, f"tile_{t}.webp"))
    print(f"[tile/{t}] generating...", flush=True)
    try:
        png = generate(BASE + TILES[t], NEG)
        cut_and_save(png, outpath)
        print(f"  OK -> {outpath}", flush=True)
    except Exception as e:
        print(f"  ERROR {t}: {e}", flush=True)


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    types = list(TILES.keys()) if which == "all" else [which]
    for t in types:
        run(t)
    print("DONE", flush=True)
