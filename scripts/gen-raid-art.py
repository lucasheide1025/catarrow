# scripts/gen-raid-art.py
# 世界王討伐場地背景（比照 gen-guild-art 的場景管線）
#   ComfyUI /prompt 生成 → 中央裁切 → 2:1 WebP → public/assets/raid/
#
# 產出：raid_bg_<key>.webp（1024×512）
#   六族 + 教練 + 貓，共 8 張。討伐版式的王佔畫面上半，所以背景要「上方開闊、下方壓暗」，
#   讓 UI（意圖條/破防槽/宣告列）壓在下半部時不會跟背景打架。
#
# ⚠️ 王的立繪**不生**：教練/師母/YUMI 是真人、九隻貓王是真貓（/worldboss/*.webp 是真素材），
#    六族王也已經有既有立繪。這裡只補場景。
#
# 用法（要用正在跑 8188 的那個副本的 embedded python，才有相依套件）：
#   E:\AI\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\python_embeded\python.exe \
#     scripts/gen-raid-art.py <all|單一key>
import sys, json, time, uuid, urllib.request, urllib.parse, io, os, random
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "raid")

# 討伐場地的統一畫風：史詩感、戲劇天光。跟公會/地下城同一套「手繪 RPG 手遊」語言，
# 但打光更強、對比更高——世界王要有「大場面」的感覺。
STYLE = ("painterly hand-painted epic fantasy RPG mobile game background art, dramatic god rays, "
         "high contrast cinematic lighting, vast sense of scale, rich detail, stylised, "
         "NOT photorealistic, no text, no watermark, no ui, no characters, no creatures. ")

# ⚠️ 一定要排除 creature/monster：這是「空場地」，王是另外疊上去的立繪，
#    背景自己長一隻怪會變成畫面上有兩隻。
NEG = ("creature, monster, dragon, animal, person, people, character, figure, silhouette of creature, "
       "realistic, photorealistic, text, letters, words, watermark, ui, hud, health bar, "
       "blurry, lowres, deformed, frame border, collage, split screen, close-up")

# 下緣壓暗的收尾（UI 壓在下半部，背景不能太亮太花）
TAIL = (", wide panoramic composition, open sky in the upper half, empty foreground ground plane in the "
        "lower half, bottom edge fading into deep shadow, nothing in the centre of the frame")

ARENAS = {
    "ghost":   "a ruined moonlit temple courtyard at midnight, cracked stone slabs, floating pale lanterns, "
               "torn banners, cold blue mist pooling on the ground, distant broken pagoda",
    "forest":  "a vast ancient forest clearing at dusk, colossal moss-covered tree trunks ringing the arena, "
               "shafts of golden light through the canopy, glowing spores drifting, fallen giant log",
    "poison":  "a toxic swamp arena under a sickly green sky, bubbling acid pools, twisted dead trees, "
               "drifting spore clouds, glowing purple fungus on wet rocks",
    "office":  "a shattered corporate skyscraper rooftop at stormy dusk, broken glass panels, "
               "twisted steel beams, city skyline far below, lightning in heavy clouds",
    "exam":    "a colossal abandoned examination hall, endless rows of overturned desks, "
               "towering blackboards, cold fluorescent shafts of light, papers frozen mid-air",
    "western": "a desert canyon showdown arena at golden hour, red rock mesas, dry cracked earth, "
               "dust devils, distant wooden watchtower, long dramatic shadows",
    "coach":   "a grand ceremonial archery range at sunrise, immense stone pillars, "
               "rows of distant targets, banners rippling in the wind, mountains on the horizon",
    "cat":     "a sunlit ancient courtyard garden, warm terracotta tiles, cherry blossom petals in the air, "
               "stone lanterns, koi pond reflections, soft dawn light",
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
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "raid_gen", "images": ["8", 0]}},
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


def do_arena(key, force=False):
    outpath = os.path.abspath(os.path.join(OUTDIR, f"raid_bg_{key}.webp"))
    if os.path.exists(outpath) and not force:
        print(f"[{key}] 已存在，跳過（--force 可重生）", flush=True)
        return
    print(f"[{key}] generating...", flush=True)
    png = generate(STYLE + ARENAS[key] + TAIL, NEG, 1216, 832)
    save_scene(png, outpath, (1024, 512))
    print(f"  OK -> {outpath}", flush=True)


if __name__ == "__main__":
    os.makedirs(os.path.abspath(OUTDIR), exist_ok=True)
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    force = "--force" in sys.argv
    keys = list(ARENAS) if which == "all" else [which]
    for k in keys:
        if k not in ARENAS:
            print(f"未知的場地：{k}（可用：{', '.join(ARENAS)}）")
            continue
        try:
            do_arena(k, force)
        except Exception as e:
            print(f"  FAIL {k}: {e}", flush=True)
    print("done.")
