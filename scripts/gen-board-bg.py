# scripts/gen-board-bg.py
# 大富翁棋盤背景 + 各族中央地圖（不去背，整張場景）→ public/assets/board/
#   board_bg.webp（全螢幕背景）、map_<mode>.webp（中央地圖，6 族）
#   用法：<embedded_python> scripts/gen-board-bg.py <bg|maps|all>
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "board")

_COMMON = "cute painterly casual mobile game art, warm cozy, soft lighting, no text, no ui, no people. "

BG = ("a warm wooden adventure table top from above with an aged parchment map, ornate golden metal frame corners, "
      "cozy tavern candlelight, cat-village exploration theme, rich amber and brown tones, decorative border")

# 6 模式中央地圖（族系主題的可愛探險地圖）
MAPS = {
    "mine":      "a cute stylized exploration map of a misty mountain mining region, rocky peaks and ore veins, cloud fog edges, teal and amber",
    "farm":      "a cute stylized map of green farmland and insect meadows, crop fields and glowing bugs, soft green",
    "harbor":    "a cute stylized map of a foggy fishing harbor, docks boats and ghostly mist, blue teal",
    "hunting":   "a cute stylized map of a forest hunting grounds, trees trails and campfires, warm green gold",
    "market":    "a cute stylized map of a bustling market town, stalls streets and lanterns, orange cream",
    "warehouse": "a cute stylized map of an old temple warehouse district, storehouses and shrines, violet purple",
}
NEG = "realistic, photorealistic, text, letters, watermark, ui, people, mascot, character, blurry, lowres, close-up single object"


def post(path, payload):
    req = urllib.request.Request(COMFY + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=60))


def build_wf(pos, neg, w, h):
    import random
    return {
        "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 2**31 - 1), "steps": 8, "cfg": 2.0,
              "sampler_name": "dpmpp_sde", "scheduler": "karras", "denoise": 1.0, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "boardbg_gen", "images": ["8", 0]}},
    }


def generate(pos, neg, w=1024, h=1024):
    pid = post("/prompt", {"prompt": build_wf(pos, neg, w, h), "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(120):
        h2 = get(f"/history/{pid}")
        if pid in h2 and h2[pid].get("status", {}).get("completed"):
            img = h2[pid]["outputs"]["9"]["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img["type"]})
            return urllib.request.urlopen(COMFY + "/view?" + q, timeout=60).read()
        time.sleep(1.5)
    raise RuntimeError("timeout")


def save(png, outpath, w, h):
    im = Image.open(io.BytesIO(png)).convert("RGB").resize((w, h), Image.LANCZOS)
    im.save(outpath, "WEBP", quality=86, method=6)


def run_bg():
    os.makedirs(OUTDIR, exist_ok=True)
    print("[board_bg] generating...", flush=True)
    png = generate(_COMMON + BG, NEG, 1024, 1024)
    save(png, os.path.abspath(os.path.join(OUTDIR, "board_bg.webp")), 1024, 1024)
    print("  OK board_bg", flush=True)


def run_map(mode):
    os.makedirs(OUTDIR, exist_ok=True)
    print(f"[map/{mode}] generating...", flush=True)
    png = generate(_COMMON + MAPS[mode], NEG, 1024, 1024)
    save(png, os.path.abspath(os.path.join(OUTDIR, f"map_{mode}.webp")), 768, 768)
    print(f"  OK map_{mode}", flush=True)


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("bg", "all"):
        run_bg()
    if which in ("maps", "all"):
        for m in MAPS:
            run_map(m)
    print("DONE", flush=True)
