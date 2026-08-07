# scripts/gen-map-bg.py
# 補生成地圖背景圖（768×768 RGB，非透明）：public/assets/board/map_<id>.webp
# 用法：<embedded_python> scripts/gen-map-bg.py <mapId>
import sys, json, time, uuid, urllib.request, urllib.parse, io
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = "public/assets/board"

MAPS = {
    "archery": ("isometric 2.5D game map background, a golden treasure shooting range arena with bullseye "
                "targets, piles of gold coins, wooden stands, radiant yellow sunlight, stylized casual mobile "
                "game art, vibrant colors, no text, no characters. "),
}

def post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(COMFY + path, data=data, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))

def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=60))

def build_wf(pos):
    import random
    return {
        "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 2**31 - 1), "steps": 10,
              "cfg": 2.5, "sampler_name": "dpmpp_sde", "scheduler": "karras", "denoise": 1.0,
              "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 768, "height": 768, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "realistic, text, letters, watermark, ui, people, hands, blurry, lowres", "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "map_bg", "images": ["8", 0]}},
    }

def generate(pos):
    pid = post("/prompt", {"prompt": build_wf(pos), "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(180):
        h = get(f"/history/{pid}")
        if pid in h and h[pid].get("status", {}).get("completed"):
            img = h[pid]["outputs"]["9"]["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img["type"]})
            return urllib.request.urlopen(COMFY + "/view?" + q, timeout=60).read()
        time.sleep(1.5)
    raise RuntimeError("timeout")

if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else "archery"
    pos = MAPS[key]
    print(f"[map/{key}] generating...", flush=True)
    png = generate(pos)
    im = Image.open(io.BytesIO(png)).convert("RGB").resize((768, 768), Image.LANCZOS)
    im.save(f"{OUTDIR}/map_{key}.webp", "WEBP", quality=90)
    print(f"OK -> {OUTDIR}/map_{key}.webp", flush=True)
