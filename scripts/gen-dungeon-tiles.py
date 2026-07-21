# scripts/gen-dungeon-tiles.py
# 地下城房間立繪全自動管線：ComfyUI 生成 → rembg 去背 → 512 WebP → public/assets/dungeon/
#   用法：<embedded_python> scripts/gen-dungeon-tiles.py <family|all> [type]
#   例：  python scripts/gen-dungeon-tiles.py ghost         # 生幽冥系全部 11 房
#         python scripts/gen-dungeon-tiles.py ghost battle  # 只生幽冥戰鬥房
#         python scripts/gen-dungeon-tiles.py all           # 七族全生（77 張）
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "dungeon")
CANVAS, PAD = 512, 0.05

_COMMON = ("cute stylized isometric 2.5D dungeon map tile, painterly friendly mobile game art, "
           "NOT realistic, NOT scary, no horror, no gore, kawaii low-poly charm, soft rounded shapes, "
           "high 3/4 top-down angle. ")
# 物件房：大石台為主、物件小而置中（各房石台一致大小）
STYLE_OBJECT = (_COMMON +
    "A round floating stone platform is the consistent base (similar size every tile). In the CENTER on "
    "top of the platform sits a clear MEDIUM-SIZED {subject}, obvious and instantly recognizable, taking "
    "up the middle of the platform. A few small {theme} accents on the platform edge (props only, NOT a "
    "building). Dark simple background, no text, no ui, no people.")
# 小怪房：小怪醒目、佔比較大，站/飄在石台中央
STYLE_CREATURE = (_COMMON +
    "A round floating stone platform is the base. Floating in the CENTER as the clear main focus: {subject}. "
    "The creature is prominent and medium-large (about half the tile height), cute and instantly recognizable. "
    "A few tiny {theme} accents on the platform edge. Dark simple background, no text, no ui, no people.")
NEG = ("realistic, photorealistic, scary, horror, creepy, gore, blood, grim, ugly, "
       "text, watermark, ui, multiple platforms, bridges, people, "
       "big building covering everything, blurry, lowres, deformed")
# 功能物件房額外禁止出現生物/角色（戰鬥類房間不套用，因為要放小怪）
NEG_OBJECT = ", monster, creature, animal, character, mascot, ghost, person"

# 各族「可愛小怪」（代表戰鬥房 = 有怪要打）
CREATURES = {
    "common":    "a cute small round monster with cat ears, a friendly smiling face, no legs (a wavy bottom)",
    "ghost":     "a cute classic bedsheet ghost, a smooth floating white teardrop body whose bottom is a WAVY RUFFLED SKIRT HEM (floating cloth, absolutely NO legs, NO feet, NO arms, NO hands), only small pointy CAT EARS on top of its head and cat whiskers, big cute round eyes, glowing soft white, floating in mid air",
    "mountain":  "a cute little wild boar spirit with tiny tusks",
    "insect":    "a cute little round rhino beetle",
    "workplace": "a cute grumpy tiny office-suit monster",
    "exam":      "a cute little walking book monster with big eyes",
    "temple":    "a cute little cartoon skeleton, friendly not scary",
    "treasure":  "a cute little mimic treasure-chest monster with a smiling face",
}
CREATURE_TYPES = {"battle", "elite_battle", "boss_battle"}

# 族系 = 只當「石台點綴」，不是主體建築
FAMILIES = {
    "common":    "mossy grey dungeon stone, a couple of small torches, green moss, simple neutral",
    "ghost":     "a few small red paper lanterns, incense sticks, mossy old stone, warm candle glow",
    "mountain":  "moss, small pine saplings, wooden totem carvings, grey mountain stone",
    "insect":    "small glowing honeycomb bits, green leaves, smooth chitin edges",
    "workplace": "a small neon sign, scattered office papers, grey tiled floor",
    "exam":      "small stacks of books, scattered exam papers, pencils",
    "temple":    "small lit candles, carved stone runes, pale gothic stone",
    "treasure":  "a few scattered gold coins, tiny gems, golden trim",
}

# 功能物件 = 主角，放大、明確、一眼可辨
SUBJECTS = {
    "entrance":     "a stone gateway archway doorway, the entrance portal",
    "battle":       "{creature}, a monster to fight",
    "elite_battle": "a tougher {creature} with a small banner, an elite monster",
    "boss_battle":  "{creature} wearing a shiny golden crown, a boss monster",
    "shop":         "a merchant market stall with a striped awning and goods, a shop",
    "event":        "a glowing magic rune circle with sparkles and a question mark, a mystery event",
    "trap":         "iron spikes with a pressure-plate trap mechanism, a trap, cartoon not scary",
    "chest":        "an open wooden treasure chest with gold coins",
    "rest":         "a cozy campfire with a small tent, a rest camp",
    "stairs":       "a stone staircase descending into a dark hole, stairs going down",
    "treasure":     "a pile of gold coins gems and a small golden idol, a treasure hoard",
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
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "dungeon_gen", "images": ["8", 0]}},
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


def run(family, only_type=None):
    theme = FAMILIES[family]
    os.makedirs(OUTDIR, exist_ok=True)
    types = [only_type] if only_type else list(SUBJECTS.keys())
    for t in types:
        fname = f"room_{t}.webp" if family == "common" else f"room_{family}_{t}.webp"
        outpath = os.path.abspath(os.path.join(OUTDIR, fname))
        print(f"[{family}/{t}] generating...", flush=True)
        subj = SUBJECTS[t]
        is_creature = t in CREATURE_TYPES
        if "{creature}" in subj:
            subj = subj.format(creature=CREATURES[family])
        style = STYLE_CREATURE if is_creature else STYLE_OBJECT
        pos = style.format(theme=theme, subject=subj)
        neg = NEG if is_creature else NEG + NEG_OBJECT
        if is_creature and family == "ghost":
            neg = neg + ", legs, feet, paws, arms, hands, standing, four legs, animal body, pikachu, pokemon"
        png = generate(pos, neg)
        cut_and_save(png, outpath)
        print(f"  OK -> {outpath}", flush=True)


if __name__ == "__main__":
    fam = sys.argv[1] if len(sys.argv) > 1 else "ghost"
    typ = sys.argv[2] if len(sys.argv) > 2 else None
    fams = list(FAMILIES.keys()) if fam == "all" else [fam]
    for f in fams:
        run(f, typ)
    print("DONE", flush=True)
