# scripts/gen-cat-portraits.py
# 九貓立繪「貓貓村風」img2img 重繪管線：
#   讀現有立繪(來源) → ComfyUI img2img(保留毛色花紋、換手繪暖色調) → rembg 去背 → 置中 512 WebP
#   ⚠️ 原檔不覆蓋！輸出到 public/cats/portraits_v2/，你比對滿意再手動覆蓋 portraits/。
#   用法：<embedded_python> scripts/gen-cat-portraits.py <catId|all> [denoise]
#   例：  python scripts/gen-cat-portraits.py niuniu 0.5     # 先試一隻乳牛貓
#         python scripts/gen-cat-portraits.py all 0.55       # 全 9 隻
#   denoise 越低越像原貓(0.45)、越高越貓村風但辨識度降(0.6)。預設 0.5。
import sys, json, time, uuid, urllib.request, urllib.parse, io, os, random
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
# 模型預設：dream=DreamShaperXL Turbo(寫實,快)；anime=Animagine XL 4.0(動漫插畫,可愛貓村風)
MODELS = {
    "dream": {"ckpt": "DreamShaperXL_Turbo_v2_1.safetensors", "steps": 0, "cfg": 2.0, "sampler": "dpmpp_sde", "scheduler": "karras", "qtags": ""},
    "anime": {"ckpt": "animagine-xl-4.0-opt.safetensors", "steps": 28, "cfg": 5.0, "sampler": "euler_ancestral", "scheduler": "normal",
              "qtags": "masterpiece, best quality, high quality, official art, "},
}
SRCDIR = os.path.join(os.path.dirname(__file__), "..", "public", "cats", "portraits")
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "cats", "portraits_v2")
CANVAS, PAD = 512, 0.06

COMMON = ("flat cel-shaded cartoon, warm cozy children's storybook illustration, kawaii adorable, "
          "soft flat shading, clean bold outlines, bright warm sunny palette, Studio-Ghibli-like warmth, "
          "cute casual mobile game character art, rounded soft shapes, big sparkly expressive eyes, "
          "cat-village cozy aesthetic, head-and-shoulders 3/4 portrait, centered, single cat, "
          "soft pale cream background, no text. ")

NEG = ("realistic, photorealistic, semi-realistic, digital painting, painterly, gritty, dark, gloomy, "
       "dim, low-key, muted colors, desaturated, harsh shadows, night, 3d render, photo, text, letters, "
       "watermark, ui, frame, multiple cats, human, hands, blurry, lowres, deformed, extra limbs, busy background")

# 逐隻：毛色花紋 + 個性神情（保留辨識度）
CATS = {
    "daming":   "a regal tortoiseshell cat with mixed orange, black and cream patches, calm confident matriarch expression, wise gentle protective eyes",
    "gege":     "a gentle orange-and-white bicolor cat, orange tabby top with white chest and muzzle, warm friendly welcoming look, soft kind eyes",
    "meimei":   "a lively orange tabby cat, playful energetic expression, bright curious sparkling eyes, ears perked up",
    "niuniu":   "a black-and-white cow-pattern cat, crisp black patches on white fur, serious tidy no-nonsense expression, focused judging eyes",
    "haji":     "a fluffy cream ragdoll cat with soft brown points and blue eyes, dreamy sleepy serene expression, extra fluffy fur",
    "baobao":   "a small round orange tabby kitten, clingy adorable cuddly expression, big pleading eyes, chubby round cheeks",
    "youyou":   "a deep-orange tabby cat, laid-back calm relaxed posture but sharp perceptive slightly narrowed eyes",
    "xiaoan":   "a tortoiseshell cat with orange and dark-brown patches, timid but brave expression, slightly wide nervous yet determined eyes",
    "diandian": "a sleek all-black cat, mysterious enigmatic expression, glowing amber eyes, subtle faint magical aura",
}


def post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(COMFY + path, data=data, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=60))


def upload_image(png_bytes, name):
    # multipart/form-data 上傳來源圖到 ComfyUI input 目錄，供 LoadImage 讀取
    boundary = "----catpt" + uuid.uuid4().hex
    b = io.BytesIO()
    b.write(("--" + boundary + "\r\n").encode())
    b.write(('Content-Disposition: form-data; name="image"; filename="' + name + '"\r\n').encode())
    b.write(b"Content-Type: image/png\r\n\r\n")
    b.write(png_bytes)
    b.write(("\r\n--" + boundary + "\r\n").encode())
    b.write(b'Content-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n')
    b.write(("--" + boundary + "--\r\n").encode())
    req = urllib.request.Request(COMFY + "/upload/image", data=b.getvalue(),
                                 headers={"Content-Type": "multipart/form-data; boundary=" + boundary})
    r = json.load(urllib.request.urlopen(req, timeout=60))
    return r["name"] if not r.get("subfolder") else r["subfolder"] + "/" + r["name"]


def prep_source(cat_id):
    # 讀原立繪 → RGB → 長邊縮到 1024（SDXL 最佳）→ PNG bytes
    src = os.path.abspath(os.path.join(SRCDIR, cat_id + ".webp"))
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = 1024 / max(w, h)
    if s < 1:
        im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, "PNG")
    return out.getvalue()


def build_wf(pos, neg, src_name, denoise, steps, mp):
    # denoise>=1 → txt2img（不吃暗源、純用描述生亮麗卡通）；否則 img2img（保留來源特徵）
    t2i = src_name is None or denoise >= 1.0
    latent = ({"5": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}}}
              if t2i else
              {"1": {"class_type": "LoadImage", "inputs": {"image": src_name}},
               "2": {"class_type": "VAEEncode", "inputs": {"pixels": ["1", 0], "vae": ["4", 2]}}})
    latent_ref = ["5", 0] if t2i else ["2", 0]
    wf = {
        "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 2**31 - 1), "steps": steps,
              "cfg": mp["cfg"], "sampler_name": mp["sampler"], "scheduler": mp["scheduler"],
              "denoise": 1.0 if t2i else denoise,
              "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": latent_ref}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": mp["ckpt"]}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "catpt_gen", "images": ["8", 0]}},
    }
    wf.update(latent)
    return wf


def generate(pos, neg, src_name, denoise, steps, mp):
    wf = build_wf(pos, neg, src_name, denoise, steps, mp)
    pid = post("/prompt", {"prompt": wf, "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(160):
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


def run(cat_id, denoise, mp):
    if cat_id not in CATS:
        print(f"  SKIP unknown cat: {cat_id}", flush=True)
        return
    os.makedirs(OUTDIR, exist_ok=True)
    outpath = os.path.abspath(os.path.join(OUTDIR, cat_id + ".webp"))
    # dream(turbo)：低 denoise 步數等比補回；anime(非turbo)：用固定步數
    steps = mp["steps"] or max(8, round(8 / max(0.35, denoise)))
    t2i = denoise >= 1.0
    mode = "txt2img" if t2i else "img2img"
    print(f"[{cat_id}] {mode} denoise={denoise} steps={steps} ckpt={mp['ckpt'].split('.')[0]} generating...", flush=True)
    try:
        src_name = None
        if not t2i:
            src_name = upload_image(prep_source(cat_id), f"catsrc_{cat_id}.png")
        pos = mp["qtags"] + COMMON + CATS[cat_id]
        png = generate(pos, NEG, src_name, denoise, steps, mp)
        cut_and_save(png, outpath)
        print(f"  OK -> {outpath}", flush=True)
    except Exception as e:
        print(f"  ERROR {cat_id}: {e}", flush=True)


if __name__ == "__main__":
    # 用法：<py> gen-cat-portraits.py <catId|all> [denoise] [model=dream|anime]
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    denoise = float(sys.argv[2]) if len(sys.argv) > 2 else 0.72   # 004 配方預設 0.72
    model = sys.argv[3] if len(sys.argv) > 3 else "dream"
    mp = MODELS.get(model, MODELS["dream"])
    ids = list(CATS.keys()) if which == "all" else [which]
    for cid in ids:
        run(cid, denoise, mp)
    print("DONE", flush=True)
