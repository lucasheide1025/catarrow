# scripts/gen-chest-tiles.py
# 族系材料寶箱全自動管線：ComfyUI 生成 → rembg 去背 → 512 WebP → public/assets/chests/
#   風格：RPG 質感寫實（非 Q 版）。7 族 × 6 階 = 42 張。
#   用法：<embedded_python> scripts/gen-chest-tiles.py <family|all> [tier 1-6]
#   例：  python scripts/gen-chest-tiles.py ghost        # 幽冥系 T1~T6 共 6 張
#         python scripts/gen-chest-tiles.py all          # 七族全生 42 張
#         python scripts/gen-chest-tiles.py temple 6     # 只生神廟 T6
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "chests")
CANVAS, PAD = 512, 0.06

# 寫實 RPG 寶箱共用骨架（closed chest，方便當背包 icon）
BASE = ("a single CLOSED treasure chest, high quality RPG loot chest game asset, 3D rendered game item icon, "
        "detailed physically-based materials, rich textures, dramatic studio lighting, strong rim light, "
        "centered single object, front three-quarter view, plain dark background, "
        "no text, no ui, no people, no hands. ")

# 各族材質/主題（寫實質感）
FAMILY_THEME = {
    "ghost":     "dark lacquered wood chest with ghostly pale-blue soul flames, pasted paper talismans and "
                 "faded taoist charms, tarnished silver corners, wisps of eerie indigo mist, spectral glow",
    "mountain":  "rugged chest carved from mountain stone and rough weathered timber, iron ore veins and raw "
                 "gem crystals embedded, moss and lichen, earthy brown and slate grey, sturdy stone-carved lid",
    "insect":    "chest made of glossy iridescent beetle chitin and carapace plates, honeycomb amber inlays, "
                 "emerald-green and gold sheen, segmented shell texture, faint bioluminescent glow",
    "workplace": "sleek modern metal strongbox styled like an executive briefcase, brushed steel and dark navy "
                 "panels, glowing blue neon accents, corporate minimalist, cold fluorescent highlights",
    "exam":      "wooden chest bound with rolled parchment scrolls and stacked books, blue wax seals, quills, "
                 "ink-blue and ivory paper tones, brass buckles, scholarly arcane runes on the lid",
    "temple":    "ornate sacred reliquary chest of polished white marble and holy gold filigree, glowing blue "
                 "divine runes, halo of soft golden light, gothic cathedral engravings, celestial silver trim",
    "treasure":  "opulent solid-gold treasure chest overflowing feel, ornate golden filigree and scrollwork, "
                 "encrusted with brilliant multicolored gemstones, luxurious velvet lining hint, radiant gold shine",
}

# 階級遞進（T1 樸素小箱 → T6 神話華麗）
TIER_DESC = {
    1: "a small humble plain chest, basic worn materials, minimal ornament, faint dull sheen",
    2: "a sturdy reinforced chest with iron bands and simple studs, modest wear",
    3: "a decorated chest with polished silver trim and a few small set gemstones, clean condition",
    4: "an ornate chest with gold trim, engraved patterns and several glowing gemstones, subtle magical aura",
    5: "an elaborate legendary chest, intricate engravings, inlaid large radiant gems, glowing magical energy",
    6: "a mythical masterwork chest crowned with a brilliant aura, overflowing magical light, "
       "the most luxurious and powerful, radiant crackling energy",
}

NEG = ("cartoon, chibi, cute, kawaii, flat vector, sticker, low detail, childish, "
       "open chest, empty chest, coins spilling out, multiple chests, "
       "text, watermark, signature, ui, frame, people, hands, character, creature, animal, "
       "blurry, lowres, jpeg artifacts, deformed, extra objects, cluttered background")

FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple", "treasure"]


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
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "chest_gen", "images": ["8", 0]}},
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


def run(family, only_tier=None):
    os.makedirs(OUTDIR, exist_ok=True)
    theme = FAMILY_THEME[family]
    tiers = [only_tier] if only_tier else [1, 2, 3, 4, 5, 6]
    for t in tiers:
        fname = f"chest_{family}_t{t}.webp"
        outpath = os.path.abspath(os.path.join(OUTDIR, fname))
        print(f"[{family}/T{t}] generating...", flush=True)
        pos = BASE + theme + ". " + TIER_DESC[t]
        try:
            png = generate(pos, NEG)
            cut_and_save(png, outpath)
            print(f"  OK -> {outpath}", flush=True)
        except Exception as e:
            print(f"  ERROR {family} T{t}: {e}", flush=True)


if __name__ == "__main__":
    fam = sys.argv[1] if len(sys.argv) > 1 else "all"
    tier = int(sys.argv[2]) if len(sys.argv) > 2 else None
    fams = FAMILIES if fam == "all" else [fam]
    for f in fams:
        run(f, tier)
    print("DONE", flush=True)
