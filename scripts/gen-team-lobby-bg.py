# scripts/gen-team-lobby-bg.py
# 組隊遠征等候室背景（RPG 戰術大廳）— 全 RGB 場景（不去背）→ 直式覆蓋用
#   用法：<embedded_python> scripts/gen-team-lobby-bg.py [outname]
import sys, json, time, uuid, urllib.request, urllib.parse, io, os, random
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "dungeon")

POS = ("epic dark fantasy RPG dungeon war council hall, torchlit ancient stone chamber, a glowing "
       "battle map table in the center, tattered banners and old weapons and shields on the walls, "
       "braziers with warm firelight, drifting embers and faint mist, deep dramatic shadows, "
       "atmospheric volumetric light, cinematic video game key art, highly detailed, moody, "
       "vertical composition, empty room, no text, no people")
NEG = ("text, letters, watermark, signature, ui, hud, people, person, character, mascot, cartoon, "
       "chibi, cute, flat vector, bright daylight, low detail, blurry, lowres")


def post(p, payload):
    req = urllib.request.Request(COMFY + p, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(p):
    return json.load(urllib.request.urlopen(COMFY + p, timeout=60))


def wf(pos, neg, w, h):
    return {
        "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 2**31 - 1), "steps": 8, "cfg": 2.0,
              "sampler_name": "dpmpp_sde", "scheduler": "karras", "denoise": 1.0, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "teamlobby_gen", "images": ["8", 0]}},
    }


def generate(pos, neg, w, h):
    pid = post("/prompt", {"prompt": wf(pos, neg, w, h), "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(120):
        h2 = get(f"/history/{pid}")
        if pid in h2 and h2[pid].get("status", {}).get("completed"):
            img = h2[pid]["outputs"]["9"]["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img["type"]})
            return urllib.request.urlopen(COMFY + "/view?" + q, timeout=60).read()
        time.sleep(1.5)
    raise RuntimeError("timeout")


if __name__ == "__main__":
    outname = sys.argv[1] if len(sys.argv) > 1 else "_new_team_lobby_bg.jpg"
    os.makedirs(OUTDIR, exist_ok=True)
    print(f"[team-lobby-bg] generating {outname}...", flush=True)
    png = generate(POS, NEG, 832, 1216)  # 直式 2:3
    im = Image.open(io.BytesIO(png)).convert("RGB")
    outpath = os.path.abspath(os.path.join(OUTDIR, outname))
    im.save(outpath, "JPEG", quality=88)
    print(f"  OK -> {outpath}", flush=True)
