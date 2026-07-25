# scripts/gen-cert-tiles.py
# 年度檢定級別「底圖」全自動管線：ComfyUI 生成 → 置中方形 → WebP → public/ui/cert-*.webp
#   與寶箱不同：底圖是「深底 + 華麗外框」整張背景，**不做 rembg 去背**（去背會把深底摳掉）。
#   設計：深色底、中央留空好放白字、越高級越華麗、射箭母題（弓箭/桂冠）、無任何文字。
#   用法：<python> scripts/gen-cert-tiles.py <level|all> [outdir]
#     level ∈ empty|novice|beginner|intermediate|advanced|elite
#   例： python scripts/gen-cert-tiles.py intermediate C:/tmp   # 只生中級到指定資料夾（樣本）
#        python scripts/gen-cert-tiles.py all                    # 六張全生到 public/ui
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
DEFAULT_OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "ui")
OUT_SIZE = 768

BASE = ("ornate rectangular award certificate border frame, decorative metallic frame with archery motifs, "
        "crossed arrows and laurel wreath corner ornaments, symmetrical corner flourishes, "
        "large EMPTY dark hollow center area for text, elegant luxury diploma frame, game UI badge background, "
        "clean sharp ornament, dramatic rim lighting on the frame edges only, "
        "no text, no words, no letters, no numbers, no people, no hands. ")

NEG = ("text, words, letters, numbers, calligraphy, watermark, signature, logo, seal, "
       "people, person, hands, face, character, animal, "
       "bright background, white background, light background, pale, washed out, "
       "busy center, cluttered center, filled center, photo, realistic photo, "
       "blurry, lowres, jpeg artifacts, deformed, asymmetrical")

# level → (輸出檔名, 該級主題：配色 + 華麗度 + 深底)
LEVELS = {
    "empty":        ("cert-empty.webp",
                     "dark charcoal background, plain thin muted silver-grey frame, very minimal simple ornament, "
                     "humble understated, faint dull sheen, entry blank certificate"),
    "novice":       ("cert-novice.webp",
                     "dark background, modest bronze and warm amber metallic frame, simple restrained ornament, "
                     "soft amber glow on the frame, beginner tier"),
    "beginner":     ("cert-beginner.webp",
                     "dark background, polished emerald green and bright silver frame, clean elegant ornament, "
                     "soft green glow on the frame edges"),
    "intermediate": ("cert-intermediate.webp",
                     "dark navy-black background, sapphire blue and bright silver ornate frame, refined flourishes, "
                     "cool blue glow on the frame, moderately elaborate"),
    "advanced":     ("cert-advanced.webp",
                     "dark background, rich amethyst purple with silver-gold ornate frame, elaborate flourishes, "
                     "magical purple glow, prestigious high tier"),
    "elite":        ("cert-elite.webp",
                     "pure black background, the most elaborate glowing gold filigree frame encrusted with "
                     "sparkling diamonds, radiant golden aura, ultra luxurious masterwork, top tier"),
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
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "cert_gen", "images": ["8", 0]}},
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


def save_bg(png_bytes, outpath):
    im = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    w, h = im.size
    s = min(w, h)  # 置中裁成方形（1024x1024 本來就是方形，保險用）
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2)).resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    im.save(outpath, "WEBP", quality=88, method=6)


def run(level, outdir):
    fname, theme = LEVELS[level]
    os.makedirs(outdir, exist_ok=True)
    outpath = os.path.abspath(os.path.join(outdir, fname))
    print(f"[{level}] generating...", flush=True)
    png = generate(BASE + theme, NEG)
    save_bg(png, outpath)
    print(f"  OK -> {outpath}", flush=True)


if __name__ == "__main__":
    lvl = sys.argv[1] if len(sys.argv) > 1 else "all"
    outdir = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUTDIR
    levels = list(LEVELS.keys()) if lvl == "all" else [lvl]
    for L in levels:
        try:
            run(L, outdir)
        except Exception as e:
            print(f"  ERROR {L}: {e}", flush=True)
    print("DONE", flush=True)
