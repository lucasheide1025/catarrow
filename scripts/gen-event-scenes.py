# scripts/gen-event-scenes.py
# 🎴 探索地圖命運/機會事件卡片圖（08-08 v2）：依效果類型生成 16 張「卡面插畫」。
# v2 修正（玩家回饋）：v1 誤用格子圖的 2.5D 地台風格 → 改為抽卡房卡片樣式：
#   直立 3:4 卡面（832×1216）、動畫半厚塗插畫風（沿用 animagine 風格 DNA）、單一主題貓主角。
# 管線：DreamShaperXL_Turbo @ 127.0.0.1:8188 → rembg 去背 → 置中 832×1216 透明 WebP。
# 輸出：public/assets/board/event_<scene>.webp（EventScene.jsx 依 eventSceneOf() 取用）
# 用法：<embedded_python> scripts/gen-event-scenes.py <scene|all> [--force]
import sys, json, time, uuid, urllib.request, urllib.parse, io, os, random
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "board")
W, H = 832, 1216   # 直立 3:4 卡面（與抽卡房卡片同比例）

# 卡面插畫風格 DNA（取自 animagine 管線的 premium anime semi-painterly 語彙）
BASE = ("premium Japanese fantasy RPG card illustration, highly refined anime semi-painterly style, "
        "intricate clean linework, one cute chubby cat adventurer hero, expressive large eyes, "
        "vibrant colors, dramatic warm lighting, centered composition, full scene visible, "
        "simple soft neutral pale background, masterpiece, high score, great score, absurdres. ")

EVENT_SCENES = {
    "move":     "the cat walking forward along a winding glowing path of paw prints with tiny golden arrows floating ahead, happy adventurous stride",
    "retreat":  "the cat walking backward on a winding road, glancing over its shoulder, slightly weary, paw prints facing the other way",
    "teleport": "the cat stepping through a glowing purple magic portal ring, sparkles swirling around its tail, wonder on its face",
    "coin":     "the cat hugging one big shiny gold coin, a small neat pile of gold coins stacked beside it, sparkling glow",
    "material": "the cat holding up a big glowing blue crystal ore with both paws, sparkling crafting materials floating around",
    "arrowdew": "the cat happily lapping a giant glowing cyan dewdrop resting on a leaf pedestal, sparkles around",
    "gacha":    "the cat spinning a golden gacha capsule with a star emblem, the capsule popping open with golden sparkles",
    "potion":   "the cat sniffing a round potion bottle filled with glowing purple liquid, tiny bubbles rising",
    "chest":    "the cat opening a small treasure chest overflowing with golden light rays, amazed expression",
    "cat":      "two cute cats nuzzling noses with a glowing pink heart floating between them, warm cozy warm light",
    "lose":     "a sad cat looking at a spilled puddle of glowing cyan dewdrops on the ground, ears drooping",
    "dice":     "the cat batting a pair of big dice with lucky star faces across a wooden table, playful pose",
    "monster":  "the cat drawing a bow at a cute round friendly monster peeking from behind a big rock, dynamic pose",
    "mining":   "the cat swinging a pickaxe at a glowing gem-studded rock, sparkling shards flying",
    "mult":     "the cat gazing amazed at a big glowing golden rune emblem radiating light beams and sparkles",
    "micro":    "the cat rolling playfully with a big ball of yarn, tiny pink hearts floating in the air",
}
NEG = ("lowres, worst quality, low quality, bad anatomy, bad hands, extra digits, text, letters, error, "
       "signature, watermark, logo, frame, card border, ui, multiple characters, photorealistic, 3d, "
       "blurry, cropped, cluttered, dark, scary, gore, blood")


def post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(COMFY + path, data=data, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=60))


def build_wf(pos, neg):
    return {
        "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 2**31 - 1), "steps": 8,
              "cfg": 2.0, "sampler_name": "dpmpp_sde", "scheduler": "karras", "denoise": 1.0,
              "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "board_event", "images": ["8", 0]}},
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
    # 直立卡面：內容縮放至 92% 卡面內、水平/垂直置中
    mw, mh = int(W * 0.92), int(H * 0.92)
    cut.thumbnail((mw, mh), Image.LANCZOS)
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(cut, ((W - cut.width) // 2, (H - cut.height) // 2))
    out.save(outpath, "WEBP", quality=92, method=6)


def run(scene, force=False):
    os.makedirs(OUTDIR, exist_ok=True)
    outpath = os.path.abspath(os.path.join(OUTDIR, f"event_{scene}.webp"))
    if os.path.exists(outpath) and not force:
        print(f"  skip (exists) event_{scene}.webp")
        return
    pos = BASE + EVENT_SCENES[scene] + ". "
    print(f"[event/{scene}] generating...", flush=True)
    try:
        png = generate(pos, NEG)
        cut_and_save(png, outpath)
        print(f"  OK -> event_{scene}.webp", flush=True)
    except Exception as e:
        print(f"  ERROR event/{scene}: {e}", flush=True)


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    force = "--force" in sys.argv[1:]
    scenes = list(EVENT_SCENES.keys()) if which == "all" else [which]
    for s in scenes:
        run(s, force)
    print("DONE", flush=True)
