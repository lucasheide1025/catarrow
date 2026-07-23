# scripts/gen-dungeon-covers.py
# 地下城「橫向外觀封面」管線：ComfyUI 生成 → 直接存 RGB WebP（不去背）→ public/assets/dungeon/cover_<family>_t<tier>.webp
#   風格：手繪氛圍風（與 map_bg 一致），寬幅地下城入口場景。7 族 × 6 階 = 42 張，高階更宏偉危險。
#   用法：<embedded_python> scripts/gen-dungeon-covers.py <family|all> [tier 1-6]
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "dungeon")
GEN_W, GEN_H = 1216, 832          # SDXL 橫向 bucket
OUT_W, OUT_H = 1024, 512          # 存檔 2:1 橫幅（中央裁切）

_COMMON = ("wide cinematic establishing shot, painterly friendly fantasy mobile game art, atmospheric, "
           "rich lighting, depth, NOT photorealistic, no text, no ui, no people, no characters. ")

COVERS = {
    "ghost":     "the entrance of a haunted Taiwanese folk dungeon at night, a dark temple stone gateway with "
                 "red paper lanterns and incense, drifting purple and indigo ghostly mist, eerie soft glow",
    "mountain":  "the entrance of a misty mountain cave dungeon, a rugged stone gateway among tall pine trees, "
                 "mossy grey boulders, drifting fog, dark emerald and teal ambient glow",
    "insect":    "the entrance of a glowing insect hive cavern dungeon, organic chitin archway, bioluminescent "
                 "honeycomb and spores, dark deep green and gold glow, damp cavern",
    "workplace": "the entrance of a dystopian ruined office-tower dungeon at night, a broken corporate lobby "
                 "gateway, flickering neon signs in fog, dark blue and purple glow, cold and grim-cute",
    "exam":      "the entrance of an ancient magical library-ruins dungeon, a grand stone archway with floating "
                 "parchment and books, scattered pencils, dark crimson and bronze ambient glow",
    "temple":    "the entrance of a gothic cathedral cavern dungeon, a tall carved stone archway with lit "
                 "candles and gothic pillars, dark violet and silver holy glow, solemn",
    "treasure":  "the entrance of a golden vault dungeon, an ornate golden gateway with piles of gold coins and "
                 "gems glinting in dark mist, warm amber and gold radiant glow, luxurious",
}
# 階級遞進（T1 樸素平靜 → T6 傳說級宏偉危險）
TIER_SCALE = {
    1: "a modest small entrance, calm and quiet, dim soft light, humble scale, few details",
    2: "a sturdier entrance, slightly larger, a touch more foreboding, gentle glow",
    3: "a grander ornate entrance, more imposing, richer details, stronger ambient glow",
    4: "a large imposing entrance, dramatic lighting, dangerous foreboding atmosphere, ominous mood",
    5: "a massive epic entrance, towering scale, intense magical glow, very dangerous and dramatic",
    6: "a colossal legendary entrance, overwhelming epic scale, blazing magical energy and swirling power, "
       "the most dangerous and awe-inspiring, cinematic",
}

NEG = ("realistic, photorealistic, scary, horror, gore, blood, text, watermark, ui, people, mascot, character, "
       "close-up object, single item, blurry, lowres, deformed, frame border")


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
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": GEN_W, "height": GEN_H, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "cover_gen", "images": ["8", 0]}},
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


def save_cover(png_bytes, outpath):
    im = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    # 中央裁切成 2:1，再縮到 OUT_W x OUT_H
    w, h = im.size
    target = OUT_W / OUT_H
    if w / h > target:
        nw = int(h * target); x = (w - nw) // 2; im = im.crop((x, 0, x + nw, h))
    else:
        nh = int(w / target); y = (h - nh) // 2; im = im.crop((0, y, w, y + nh))
    im = im.resize((OUT_W, OUT_H), Image.LANCZOS)
    im.save(outpath, "WEBP", quality=86, method=6)


def run(family, only_tier=None):
    os.makedirs(OUTDIR, exist_ok=True)
    tiers = [only_tier] if only_tier else [1, 2, 3, 4, 5, 6]
    for t in tiers:
        outpath = os.path.abspath(os.path.join(OUTDIR, f"cover_{family}_t{t}.webp"))
        print(f"[cover/{family}/T{t}] generating...", flush=True)
        try:
            pos = _COMMON + COVERS[family] + ". " + TIER_SCALE[t]
            png = generate(pos, NEG)
            save_cover(png, outpath)
            print(f"  OK -> {outpath}", flush=True)
        except Exception as e:
            print(f"  ERROR {family} T{t}: {e}", flush=True)


if __name__ == "__main__":
    fam = sys.argv[1] if len(sys.argv) > 1 else "all"
    tier = int(sys.argv[2]) if len(sys.argv) > 2 else None
    fams = list(COVERS.keys()) if fam == "all" else [fam]
    for f in fams:
        run(f, tier)
    print("DONE", flush=True)
