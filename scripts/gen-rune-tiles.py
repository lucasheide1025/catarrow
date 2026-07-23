# scripts/gen-rune-tiles.py
# 裝備符文全自動管線：ComfyUI 生成 → rembg 去背 → 512 WebP → public/assets/runes/
#   風格：RPG 質感寫實（配合寶箱美術）。4 類型 × 4 階 = 16 顆。
#   用法：<embedded_python> scripts/gen-rune-tiles.py <type|all> [tier 1-4]
#   例：  python scripts/gen-rune-tiles.py all         # 全 16 顆
#         python scripts/gen-rune-tiles.py atk         # 攻擊符文 T1~T4
#         python scripts/gen-rune-tiles.py cat 4       # 只生貓靈 T4
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "runes")
CANVAS, PAD = 512, 0.08

BASE = ("a single magic RUNE STONE game item icon, high quality RPG fantasy asset, 3D rendered game item, "
        "a carved arcane rune tablet with a set glowing gem in the center, an engraved glowing magic symbol, "
        "dramatic studio lighting, strong rim light, centered single object, front view, plain dark background, "
        "no text, no letters, no ui, no people, no hands. ")

# 類型：符號 + 主色（用色彩+意象輔助辨識，不硬要精準圖示）
TYPE_THEME = {
    "atk": "an engraved glowing SWORD BLADE emblem carved into the rune, fierce fiery red and orange magical "
           "glow, a deep ruby-red gemstone, sharp aggressive design",
    "def": "an engraved glowing SHIELD emblem carved into the rune, steady steel-blue magical glow, a "
           "sapphire-blue gemstone, solid sturdy protective design",
    "hp":  "an engraved glowing HEART emblem carved into the rune, vibrant green and crimson life-energy glow, "
           "a bright emerald-green gemstone, warm vital design",
    "cat": "an engraved glowing CAT PAW print and cute cat silhouette carved into the rune, mystic purple and "
           "gold magical glow, a shining amethyst-purple gemstone, spiritual design",
}

# 階級遞進（T1 粗石暗 → T4 王級金框強光）
TIER_DESC = {
    1: "a small rough plain grey stone rune, dull faint glow, simple worn edges, humble",
    2: "a polished stone rune with a simple metal rim, modest steady inner glow",
    3: "a bright gemstone rune set in an ornate silver frame, strong radiant glow, small floating crystal shards",
    4: "a legendary masterwork rune in an ornate golden frame, brilliant radiant aura, floating magical energy, "
       "the most powerful and luxurious, crackling arcane light",
}

NEG = ("cartoon, chibi, cute mascot, flat vector, sticker, low detail, childish, "
       "text, letters, words, watermark, signature, ui, frame border, "
       "multiple runes, people, hands, character, creature, animal body, "
       "blurry, lowres, jpeg artifacts, deformed, cluttered background")

TYPES = ["atk", "def", "hp", "cat"]


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
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "rune_gen", "images": ["8", 0]}},
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


def run(rtype, only_tier=None):
    os.makedirs(OUTDIR, exist_ok=True)
    theme = TYPE_THEME[rtype]
    tiers = [only_tier] if only_tier else [1, 2, 3, 4]
    for t in tiers:
        fname = f"rune_{rtype}_t{t}.webp"
        outpath = os.path.abspath(os.path.join(OUTDIR, fname))
        print(f"[{rtype}/T{t}] generating...", flush=True)
        pos = BASE + theme + ". " + TIER_DESC[t]
        try:
            png = generate(pos, NEG)
            cut_and_save(png, outpath)
            print(f"  OK -> {outpath}", flush=True)
        except Exception as e:
            print(f"  ERROR {rtype} T{t}: {e}", flush=True)


if __name__ == "__main__":
    rt = sys.argv[1] if len(sys.argv) > 1 else "all"
    tier = int(sys.argv[2]) if len(sys.argv) > 2 else None
    types = TYPES if rt == "all" else [rt]
    for x in types:
        run(x, tier)
    print("DONE", flush=True)
