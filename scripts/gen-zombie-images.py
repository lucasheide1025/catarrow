# scripts/gen-zombie-images.py
# 🧟 殭屍生存模式角色全自動管線：ComfyUI 生成 → rembg 去背 → 裁切縮放 → public/assets/zombie/
#   用法：python scripts/gen-zombie-images.py [zombie_type|all]
#   例：  python scripts/gen-zombie-images.py normal          # 只生普通殭屍
#         python scripts/gen-zombie-images.py all              # 生全部 5 種（4 archetypes + BOSS）
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "assets", "zombie"))
CANVAS_W, CANVAS_H = 400, 520  # 對應 ZombieTargetSVG 的 200×260 viewBox 比例
PAD = 0.04

# ── 通用的 dark zombie survival 風格基底 ─────────────────
_COMMON = (
    "dark atmospheric zombie survival game character art, full body front view, "
    "standing straight facing forward, arms slightly out to sides, "
    "dark gritty artstyle, painterly, moody lighting, game asset concept art, "
    "high detail, sharp focus, clear body silhouette, "
    "NOT a drawing, NOT a diagram, NOT schematic, NOT labeled, NOT educational"
)

# ── 各殭屍 archetype 專屬 prompt ────────────────────────
ZOMBIE_PROMPTS = {
    "normal": {
        "subject": (
            "a classic zombie, undead human with pale greenish-gray rotting skin, "
            "torn ragged clothes, hollow dark eyes, shambling pose, "
            "mouth slightly open, decaying flesh visible on face and hands"
        ),
        "neg": (
            "realistic photorealistic, scary horror gore blood, "
            "text watermark ui, multiple zombies, weapons, guns, "
            "blurry lowres deformed, cartoon, anime"
        ),
    },
    "fast": {
        "subject": (
            "a fast zombie runner type, lean emaciated undead with stretched sinewy limbs, "
            "tattered sportswear or running clothes, pale gray skin with visible veins, "
            "wild eyes, mouth agape showing teeth, dynamic lean-forward stance, "
            "long scraggly hair, clawed hands slightly raised"
        ),
        "neg": (
            "realistic photorealistic, scary horror gore, "
            "text watermark ui, multiple zombies, guns, weapons, "
            "blurry lowres deformed, cartoon, anime"
        ),
    },
    "armored": {
        "subject": (
            "a heavily armored zombie, undead warrior wearing crude metal armor plates "
            "strapped to torso and shoulders, a dented helmet, "
            "rotting flesh visible between armor gaps, one arm raised like a shield, "
            "dark rusted metal, chainmail fragments, imposing bulky silhouette, "
            "zombie with armor, undead in battle gear"
        ),
        "neg": (
            "realistic photorealistic, scary horror gore blood, "
            "text watermark ui, multiple zombies, modern military, "
            "blurry lowres deformed, cartoon, anime"
        ),
    },
    "ranged": {
        "subject": (
            "a grotesque ranged zombie, hunched over with unnaturally long spindly arms "
            "hanging low, twisted spine, tattered coat or robe, "
            "bald head with bulging eyes, open drooling mouth, "
            "bony fingers spread wide, creepy gaunt silhouette, "
            "emaciated distorted humanoid"
        ),
        "neg": (
            "realistic photorealistic, scary horror gore blood, "
            "text watermark ui, multiple zombies, guns, weapons, "
            "blurry lowres deformed, cartoon, anime"
        ),
    },
    "boss": {
        "subject": (
            "a gigantic undead king zombie, massive hulking figure wearing a tattered rusted crown, "
            "torn royal robes over swollen rotting flesh, one eye glowing red, "
            "huge muscular arms, jagged bone protrusions from shoulders, "
            "ancient decaying king of the dead, intimidating imposing presence, "
            "zombie boss creature wearing a crown"
        ),
        "neg": (
            "realistic photorealistic, cartoon anime, "
            "text watermark ui, multiple characters, companions, "
            "blurry lowres deformed, smiling happy"
        ),
    },
}

# 各 archetype 的額外負面詞（防止畫成解剖圖/示意圖）
EXTRA_NEG = (
    ", diagram, schematic, labeled, body parts labeled, "
    "instructional, medical diagram, anatomy chart, "
    "cross section, xray, transparent, wireframe"
)

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
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1331, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "zombie_gen", "images": ["8", 0]}},
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
    """去背 → 裁切 → 置中縮放到 CANVAS_W×CANVAS_H → 存 WebP"""
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    cut = remove(im).convert("RGBA")
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    mw = int(CANVAS_W * (1 - PAD * 2))
    mh = int(CANVAS_H * (1 - PAD * 2))
    w, h = cut.size
    s = min(mw / w, mh / h)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    cut = cut.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    out.paste(cut, ((CANVAS_W - nw) // 2, (CANVAS_H - nh) // 2), cut)
    out.save(outpath, "WEBP", quality=90, method=6)

def run(zombie_type):
    info = ZOMBIE_PROMPTS[zombie_type]
    pos = _COMMON + " " + info["subject"]
    neg = info["neg"] + EXTRA_NEG
    os.makedirs(OUTDIR, exist_ok=True)
    fname = f"zombie_{zombie_type}.webp"
    outpath = os.path.join(OUTDIR, fname)
    print(f"[{zombie_type}] generating...", flush=True)
    png = generate(pos, neg)
    cut_and_save(png, outpath)
    print(f"  OK -> {outpath}", flush=True)


if __name__ == "__main__":
    types = sys.argv[1:] if len(sys.argv) > 1 else ["all"]
    if "all" in types:
        types = list(ZOMBIE_PROMPTS.keys())
    for t in types:
        if t in ZOMBIE_PROMPTS:
            run(t)
        else:
            print(f"未知類型: {t}，可選: {list(ZOMBIE_PROMPTS.keys())} + all")
    print("DONE", flush=True)
