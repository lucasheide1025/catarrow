# scripts/gen-raid-chars.py
# 世界王討伐：隊友外觀 + UI 素材
#
# 產出（→ public/assets/raid/）：
#   archer_<id>.webp   ×8   隊友射手（去背全身，512²）
#   lobby_bg.webp      ×1   組隊等待室底圖（2:1，不去背）
#   medal_<id>.webp    ×3   結算勳章（去背，256²）
#
# ⚠️ **六族 12 王的立繪不重生**：現有的 /worldboss/*.webp 品質很好（去背、細節足夠），
#    重生只會變差。教練/師母/YUMI 是真人、九隻貓王是真貓，更不生。
#
# ⚠️ 隊友射手要**跟既有的 /cats/archers/*.webp 同一個畫風**：
#    墨線漫畫、土色系、全身站姿、白底去背。不同風格混在同一排會很難看。
#
# 用法（要用正在跑 8188 的那個副本的 embedded python，才有 rembg）：
#   E:\AI\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\python_embeded\python.exe \
#     scripts/gen-raid-chars.py <all|archers|lobby|medals> [單一 id] [--force]
import sys, json, time, uuid, urllib.request, urllib.parse, io, os, random
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "raid")

# 既有射手立繪的畫風：墨線漫畫、土色系、全身、白底
STYLE_ARCHER = (
    "inked comic book illustration of a cute anthropomorphic cat adventurer standing full body, "
    "bold clean ink linework, muted earth-tone palette, soft cel shading, detailed leather gear, "
    "front facing, standing pose, plain white background, NOT photorealistic, no text, no watermark. "
)
NEG_ARCHER = (
    "photorealistic, realistic fur photo, 3d render, blurry, lowres, deformed, extra limbs, "
    "(bow:1.5)(longbow:1.5)(arrow:1.4)(quiver:1.3), "
    "text, watermark, signature, cropped, multiple characters, background scenery, "
    "(pedestal:1.4)(round base:1.4)(platform:1.4), lantern, shadow on ground"
)

# 勳章：純物件，不能吃角色風格字串（會長出生物）
STYLE_MEDAL = (
    "game UI award medal icon, ornate metal emblem with ribbon, clean vector-like rendering, "
    "centered, plain white background, no text, no watermark. "
)
NEG_MEDAL = (
    "(creature:1.4)(animal:1.4)(person:1.4)(face:1.4), photorealistic, text, letters, numbers, "
    "watermark, blurry, lowres, background scenery, multiple objects, (pedestal:1.3)"
)

STYLE_SCENE = (
    "painterly hand-painted fantasy RPG mobile game background art, warm torchlight, rich detail, "
    "stylised, NOT photorealistic, no text, no watermark, no ui, no characters. "
)
NEG_SCENE = (
    "person, people, character, creature, realistic, photorealistic, text, letters, watermark, "
    "ui, hud, blurry, lowres, deformed, frame border, collage"
)

# 八位隊友：毛色與裝備都要拉開，隊伍列上才分得出誰是誰。
# ⚠️ **不要拿弓**（作者 2026-07-31）：這個模型畫弓的成功率很低，
#    常常變成一條白色幽靈狀的線。改拿好畫的近戰/輔助裝備，辨識度反而更高。
# ⚠️ 毛色要加權（(solid black fur:1.4)），不然黑貓會生成灰虎斑。
ARCHERS = {
    "grey":   "a (grey tabby:1.3) cat adventurer in a dark green hooded cloak, holding a wooden quarterstaff, leather bracers",
    "calico": "a (calico:1.4) cat adventurer in a rust-red padded jerkin, holding a round wooden shield, feathered cap",
    "siamese":"a (siamese:1.4) cat adventurer in a pale blue travelling coat, holding a rolled parchment map, shoulder satchel",
    "tuxedo": "a (tuxedo black and white:1.4) cat adventurer in a charcoal ranger coat with silver buckles, holding a short sword",
    "ginger": "a (ginger orange:1.4) cat adventurer in a tan desert wrap and scarf, holding a curved dagger, hip pouches",
    "smoke":  "a (smoke grey:1.3) cat adventurer in a deep purple mantle, holding a glowing crystal orb, arm guard",
    "cream":  "a (cream point:1.3) cat adventurer in soft leather scout armour, holding a small lantern, belt pouches",
    "black":  "a (solid black fur:1.5) cat adventurer in a midnight blue hood with a crescent brooch, holding a slim spear",
}

# 擊倒動畫用的「拉弓射擊」姿勢。
# ⚠️ 這裡**要**有弓——是唯一需要弓的地方，所以負面詞不排除弓，
#    改用側身拉弓的明確描述提高成功率（正面持弓最容易畫壞）。
SHOOTERS = {
    "shoot_a": "a (calico:1.3) cat archer seen from the side, drawing a longbow at full draw, arrow nocked, focused expression, cloak flowing",
    "shoot_b": "a (grey tabby:1.3) cat archer seen from the side, drawing a recurve bow at full draw, arrow nocked, green hood",
    "shoot_c": "a (solid black fur:1.4) cat archer seen from the side, drawing a dark bow at full draw, arrow nocked, midnight blue cloak",
    "shoot_d": "a (ginger orange:1.3) cat archer seen from the side, drawing a horn bow at full draw, arrow nocked, desert scarf",
}

MEDALS = {
    "victory": "a golden laurel wreath medal with a star centre and red ribbon, triumphant",
    "breaker": "a bronze shattered-shield medal with cracks and an orange ribbon",
    "lasthit": "a silver arrowhead medal with a crown motif and blue ribbon",
}

SCENES = {
    "lobby_bg": dict(w=1216, h=832, out=(1024, 512), prompt=(
        "interior of an adventurers staging hall before a great hunt, long wooden table with maps and "
        "quivers, racks of bows on the walls, warm torchlight, tall arched window showing a stormy sky, "
        "empty room without characters")),
}


def post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(COMFY + path, data=data, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=60))


def build_wf(pos, neg, w, h):
    return {
        "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 2**31 - 1), "steps": 8,
              "cfg": 2.0, "sampler_name": "dpmpp_sde", "scheduler": "karras", "denoise": 1.0,
              "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "raidchar", "images": ["8", 0]}},
    }


def generate(pos, neg, w, h):
    pid = post("/prompt", {"prompt": build_wf(pos, neg, w, h), "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(200):
        hist = get(f"/history/{pid}")
        if pid in hist and hist[pid].get("status", {}).get("completed"):
            img = hist[pid]["outputs"]["9"]["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"],
                                        "subfolder": img.get("subfolder", ""), "type": img["type"]})
            return urllib.request.urlopen(COMFY + "/view?" + q, timeout=60).read()
        time.sleep(1.5)
    raise RuntimeError("timeout waiting for generation")


def save_cutout(png, outpath, canvas=512, pad=0.06):
    from rembg import remove
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    cut = remove(im).convert("RGBA")
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    m = int(canvas * (1 - pad * 2))
    w, h = cut.size
    s = min(m / w, m / h)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    cut = cut.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(cut, ((canvas - nw) // 2, (canvas - nh) // 2), cut)
    out.save(outpath, "WEBP", quality=90, method=6)


def save_scene(png, outpath, out_size):
    im = Image.open(io.BytesIO(png)).convert("RGB")
    ow, oh = out_size
    w, h = im.size
    target = ow / oh
    if w / h > target:
        nw = int(h * target); x = (w - nw) // 2; im = im.crop((x, 0, x + nw, h))
    else:
        nh = int(w / target); y = (h - nh) // 2; im = im.crop((0, y, w, y + nh))
    im.resize((ow, oh), Image.LANCZOS).save(outpath, "WEBP", quality=86, method=6)


def do_archer(key, force=False):
    outpath = os.path.abspath(os.path.join(OUTDIR, f"archer_{key}.webp"))
    if os.path.exists(outpath) and not force:
        print(f"[archer/{key}] 已存在，跳過", flush=True); return
    print(f"[archer/{key}] generating...", flush=True)
    png = generate(STYLE_ARCHER + ARCHERS[key], NEG_ARCHER, 832, 1216)
    save_cutout(png, outpath, 512, 0.05)
    print(f"  OK -> {outpath}", flush=True)


def do_shooter(key, force=False):
    outpath = os.path.abspath(os.path.join(OUTDIR, f"{key}.webp"))
    if os.path.exists(outpath) and not force:
        print(f"[shooter/{key}] 已存在，跳過", flush=True); return
    print(f"[shooter/{key}] generating...", flush=True)
    neg = NEG_ARCHER.replace("(bow:1.5)(longbow:1.5)(arrow:1.4)(quiver:1.3), ", "")
    png = generate(STYLE_ARCHER + SHOOTERS[key], neg, 1216, 832)
    save_cutout(png, outpath, 512, 0.04)
    print(f"  OK -> {outpath}", flush=True)


def do_medal(key, force=False):
    outpath = os.path.abspath(os.path.join(OUTDIR, f"medal_{key}.webp"))
    if os.path.exists(outpath) and not force:
        print(f"[medal/{key}] 已存在，跳過", flush=True); return
    print(f"[medal/{key}] generating...", flush=True)
    png = generate(STYLE_MEDAL + MEDALS[key], NEG_MEDAL, 1024, 1024)
    save_cutout(png, outpath, 256, 0.08)
    print(f"  OK -> {outpath}", flush=True)


def do_scene(key, force=False):
    cfg = SCENES[key]
    outpath = os.path.abspath(os.path.join(OUTDIR, f"{key}.webp"))
    if os.path.exists(outpath) and not force:
        print(f"[scene/{key}] 已存在，跳過", flush=True); return
    print(f"[scene/{key}] generating...", flush=True)
    png = generate(STYLE_SCENE + cfg["prompt"], NEG_SCENE, cfg["w"], cfg["h"])
    save_scene(png, outpath, cfg["out"])
    print(f"  OK -> {outpath}", flush=True)


if __name__ == "__main__":
    os.makedirs(os.path.abspath(OUTDIR), exist_ok=True)
    group = sys.argv[1] if len(sys.argv) > 1 else "all"
    only = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else None
    force = "--force" in sys.argv

    jobs = []
    if group in ("all", "archers"):
        jobs += [(do_archer, k) for k in (ARCHERS if not only else [only]) if k in ARCHERS]
    if group in ("all", "shooters"):
        jobs += [(do_shooter, k) for k in (SHOOTERS if not only else [only]) if k in SHOOTERS]
    if group in ("all", "medals"):
        jobs += [(do_medal, k) for k in (MEDALS if not only else [only]) if k in MEDALS]
    if group in ("all", "lobby"):
        jobs += [(do_scene, k) for k in SCENES]

    for fn, key in jobs:
        try:
            fn(key, force)
        except Exception as e:
            print(f"  FAIL {key}: {e}", flush=True)
    print("done.")
