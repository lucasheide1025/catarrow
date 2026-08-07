# scripts/gen-journey-tiles.py
# 貓貓村探索地圖重製：2.5D 立體格子圖示（七大族各自的格子樣式）。
# 沿用 gen-board-tiles.py 的 ComfyUI 管線：DreamShaperXL_Turbo @ 127.0.0.1:8188
#   → rembg 去背 → 置中 512×512 透明 WebP。
# 輸出：public/assets/board/tile_<mapId>_<type>.webp（旅程用，七大族各自風格）
#       public/assets/board/tile_<type>.webp（共用 fallback / 舊棋盤）
# 用法：<embedded_python> scripts/gen-journey-tiles.py <mapId|base> <type|all> [--force]
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "board")
CANVAS, PAD = 512, 0.06

# ── 2.5D 基底風格：小地台立體模型、軟光、卡通厚塗（非平面 icon）──
BASE = ("isometric 2.5D game tile diorama, a tiny handcrafted diorama scene on a small round stone base, "
        "soft studio lighting, stylized casual mobile game art, cute chunky shapes, vibrant colors, "
        "top-down 3/4 perspective, single centered object, no text, no ui, soft plain background. ")

# ── 七大族主題（對應各 map 的背景調性）──
FAMILIES = {
    "mine":     "cold starlit mine aesthetic, blue-purple ore crystals, frosty metal, stardust sparkles. ",
    "farm":     "lush moonlit farmland, pastel green crops, melons and dewdrops, firefly glow, spring palette. ",
    "harbor":   "misty harbor docks, teal fog, paper lanterns, ghostly pale blue glow, water reflections. ",
    "hunting":  "verdant hunting forest, autumn leaves, leather and arrows, warm green-brown palette. ",
    "market":   "festive market bazaar, warm orange awnings, hanging lanterns, gold coins, bustling warmth. ",
    "warehouse":"ancient relic warehouse, terracotta jars, antique gold, dust motes, warm brown palette. ",
    "archery":  "golden treasure shooting range, bullseye targets, piled gold, radiant yellow palette. ",
}

# ── 格子主題（20 種）──
TILES = {
    "start":     "a checkered START flag on a flagpole with a tiny welcome mat",
    "material":  "an open burlap sack overflowing with shiny crafting materials and ore chunks",
    "mining":    "a glowing gem-studded rock with a crossed pickaxe leaning against it",
    "monster":   "a cute round friendly monster peeking from behind a rock, big sparkly eyes",
    "arrowdew":  "a big glowing dew droplet resting on a leaf pedestal with sparkles",
    "coins":     "a neat stack of gold coins with a sparkle on top",
    "gacha":     "a colorful gacha capsule machine with round capsules and a coin slot",
    "potion":    "a round potion bottle with glowing liquid standing on a tiny pedestal",
    "chest":     "a small treasure chest slightly open with a warm golden glow",
    "catbond":   "a cute cat sitting happily with a pink heart floating above its head",
    "fate":      "a tarot card standing upright with a swirling purple question mark",
    "opp":       "an opportunity card with a four-leaf clover and a little gift box",
    "camp":      "a cozy campfire with a tiny tent and a small kettle",
    "empower":   "a glowing rune stone with a radiant sword stuck into it",
    "catmate":   "a friendly cat companion walking beside a trail of paw prints",
    "trap":      "a spiky bear trap with a little warning sign, slightly ominous but cute",
    "shortcut":  "a glowing portal ring floating above a stone bridge",
    "market":    "a tiny market stall with a striped awning and hanging goods",
    "scenery":   "a miniature mountain vista with a warm sun and fluffy clouds",
    "fork":      "a wooden signpost splitting into two diverging paths with glowing arrows left and right, tiny lanterns",
    "boss":      "a fearsome dragon skull boss emblem with a red glow and horns",
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
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "board_journey", "images": ["8", 0]}},
    }


def generate(pos, neg):
    pid = post("/prompt", {"prompt": build_wf(pos, neg), "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(180):
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


def run(key, t, force=False):
    os.makedirs(OUTDIR, exist_ok=True)
    fname = f"tile_{key}_{t}.webp" if key != "base" else f"tile_{t}.webp"
    outpath = os.path.abspath(os.path.join(OUTDIR, fname))
    if os.path.exists(outpath) and not force:
        print(f"  skip (exists) {fname}")
        return
    theme = FAMILIES.get(key, "")
    pos = BASE + theme + TILES[t] + ". "
    print(f"[{key}/{t}] generating...", flush=True)
    try:
        png = generate(pos, NEG)
        cut_and_save(png, outpath)
        print(f"  OK -> {fname}", flush=True)
    except Exception as e:
        print(f"  ERROR {key}/{t}: {e}", flush=True)


if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else "mine"
    which = sys.argv[2] if len(sys.argv) > 2 else "all"
    force = "--force" in sys.argv[1:]
    types = list(TILES.keys()) if which == "all" else [which]
    for t in types:
        run(key, t, force)
    print("DONE", flush=True)
