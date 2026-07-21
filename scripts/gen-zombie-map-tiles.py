# scripts/gen-zombie-map-tiles.py
# 🗺️ 殭屍生存模式地圖環境圖塊：ComfyUI 生成 → rembg 去背 → 256×256 → public/assets/zombie/map/
#   用法：python scripts/gen-zombie-map-tiles.py [tile_type|all]
#   例：  python scripts/gen-zombie-map-tiles.py hospital
#         python scripts/gen-zombie-map-tiles.py all
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "assets", "zombie", "map"))
CANVAS = 256  # 方形輸出，SVG 端用 clipPath 裁成菱形
PAD = 0.06

# ── 通用風格基底 ────────────────────────────────────────
_COMMON = (
    "isometric top-down game tile, 2.5D view from above at 45 degree angle, "
    "dark zombie apocalypse atmosphere, gloomy moody lighting, "
    "abandoned ruined post-apocalyptic, game asset style, "
    "clear silhouette, centered on a single round floating stone platform, "
    "dark background, no text, no ui, no people, no zombies, no characters, "
    "high quality game art, sharp focus, stylized"
)

NEG = (
    "realistic photorealistic, text, watermark, ui elements, "
    "multiple platforms, people, zombies, monsters, characters, "
    "cartoon anime, blurry, lowres, deformed, "
    "bright sunny, daytime, happy, colorful"
)

# ── 各地點類型 prompt ────────────────────────────────────
TILE_PROMPTS = {
    # ── 12 個隨機地點 ────────────────────────────────────
    "supermarket": {
        "subject": "a ruined supermarket, collapsed shelves, scattered canned goods, broken glass, flickering neon sign, grocery store ruins",
        "extra_neg": "people, zombie",
    },
    "gas_station": {
        "subject": "an abandoned gas station, old fuel pumps, rusted car, broken canopy, oil stains on ground, convenience store attached",
        "extra_neg": "people, zombie",
    },
    "residential": {
        "subject": "a destroyed residential neighborhood, collapsed apartment buildings, rubble, broken windows, overgrown yards, suburban ruins",
        "extra_neg": "people, zombie",
    },
    "hospital": {
        "subject": "a derelict hospital building, broken windows, emergency sign dangling, ambulances abandoned outside, medical debris",
        "extra_neg": "people, zombie",
    },
    "police_station": {
        "subject": "a ruined police station, barricaded doors, police cars wrecked outside, barbed wire, broken street lights",
        "extra_neg": "people, zombie",
    },
    "factory": {
        "subject": "an abandoned factory, rusted machinery, smokestacks, broken conveyor belts, industrial ruins, metal structures",
        "extra_neg": "people, zombie",
    },
    "bank": {
        "subject": "a ruined bank building, broken vault door visible, scattered cash, collapsed columns, marble floor cracked",
        "extra_neg": "people, zombie",
    },
    "park": {
        "subject": "an overgrown city park, dead trees, broken benches, pond with murky water, rusted playground, wild vegetation taking over",
        "extra_neg": "people, zombie, monsters",
    },
    "church": {
        "subject": "a ruined stone church, collapsed steeple, broken stained glass, overgrown with ivy, candles still lit inside, peaceful but decaying",
        "extra_neg": "people, zombie",
    },
    "pharmacy": {
        "subject": "a ransacked pharmacy, smashed medicine shelves, scattered pill bottles, broken glass counter, medical supplies debris",
        "extra_neg": "people, zombie",
    },
    "school": {
        "subject": "a ruined school building, broken classroom windows, overturned desks, graffiti on walls, overgrown sports field",
        "extra_neg": "people, zombie",
    },
    "underground": {
        "subject": "a dark subway tunnel entrance, train tracks, columns, flickering lights deep inside, damp walls, underground station",
        "extra_neg": "people, zombie",
    },

    # ── 5 個固定節點 ────────────────────────────────────
    "start": {
        "subject": "a fortified safe house hideout, sandbags, boarded windows, supply crates, a small campfire, makeshift shelter",
        "extra_neg": "people, zombie",
    },
    "bridge": {
        "subject": "a large suspension bridge over dark water, broken railings, abandoned vehicles on the bridge, cables hanging, fog",
        "extra_neg": "people, zombie",
    },
    "military_base": {
        "subject": "a fortified military checkpoint, concrete barriers, sandbags, watchtower, military vehicles, razor wire, bunker entrance",
        "extra_neg": "people, zombie",
    },
    "boss_room": {
        "subject": "a dark throne room, tattered banners, bones scattered, destroyed pillars, a throne made of debris, ominous red glow",
        "extra_neg": "people, zombie",
    },
    "extraction_heli": {
        "subject": "a helicopter landing zone, landing pad marked with H, smoke flares, empty fuel barrels, clear area surrounded by ruins",
        "extra_neg": "people, zombie",
    },
}


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
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 768, "height": 768, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "zmap_gen", "images": ["8", 0]}},
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
    raise RuntimeError("timeout waiting for generation")


def cut_and_save(png_bytes, outpath):
    """去背 → 裁切 → 置中縮放到 CANVAS×CANVAS → 存 WebP"""
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    cut = remove(im).convert("RGBA")
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    max_side = int(CANVAS * (1 - PAD * 2))
    w, h = cut.size
    scale = min(max_side / w, max_side / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    cut = cut.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(cut, ((CANVAS - nw) // 2, (CANVAS - nh) // 2), cut)
    out.save(outpath, "WEBP", quality=90, method=6)


def run(tile_id):
    info = TILE_PROMPTS[tile_id]
    pos = _COMMON + ", " + info["subject"]
    neg = NEG + ", " + info["extra_neg"]
    os.makedirs(OUTDIR, exist_ok=True)
    fname = f"map_{tile_id}.webp"
    outpath = os.path.join(OUTDIR, fname)
    print(f"[{tile_id}] generating...", flush=True)
    png = generate(pos, neg)
    cut_and_save(png, outpath)
    print(f"  OK -> {outpath}", flush=True)


if __name__ == "__main__":
    types = sys.argv[1:] if len(sys.argv) > 1 else ["all"]
    if "all" in types:
        types = list(TILE_PROMPTS.keys())
    for t in types:
        if t in TILE_PROMPTS:
            run(t)
        else:
            print(f"未知 tile: {t}，可選: {list(TILE_PROMPTS.keys())} + all")
    print("DONE", flush=True)
