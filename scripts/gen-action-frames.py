# scripts/gen-action-frames.py
# 貓貓村探索地圖：挖礦（dig）／採集素材（gather）的「動作動畫」幀。
# 七大族 × 2 種動作 × 3 幀：action_<mapId>_<dig|gather>_<1..3>.webp
# 管線：DreamShaperXL_Turbo @ 127.0.0.1:8188 → 512×512 WebP。
# ⚠️ 2026-08-07 修正：**不再去背**——rembg 會把貓的部位一起誤刪（玩家回報），
#    原圖本身就是場景圖（角色＋資源＋背景），直接縮放保留完整畫面即可。
# 用法：<embedded_python> scripts/gen-action-frames.py <mapId|all> <dig|gather|all> [--force]
import sys, json, time, uuid, urllib.request, urllib.parse, io, os, random
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "board")
CANVAS, PAD = 512, 0.04

# ── 動作場景基底：角色＋道具＋資源的小場景（不是單一物件）──
ACTION_BASE = (
    "isometric 2.5D game scene, one cute chubby orange cartoon cat villager with big eyes in the center, "
    "soft studio lighting, stylized casual mobile game art, cute chunky shapes, vibrant colors, "
    "top-down 3/4 perspective, shallow depth of field, clean simple background, no text, no ui. "
)

# ── 七大族主題＋該族可採集的資源 ──
FAMILIES = {
    "mine":      ("cold starlit mine aesthetic, blue-purple ore crystals, frosty metal, stardust sparkles. ",
                  "glowing blue-purple ore crystal vein", "glowing ore crystal"),
    "farm":      ("lush moonlit farmland, pastel green crops, melons and dewdrops, firefly glow, spring palette. ",
                  "ripe green melon patch", "big juicy melon"),
    "harbor":    ("misty harbor docks, teal fog, paper lanterns, ghostly pale blue glow, water reflections. ",
                  "stacked fresh silver fish on the dock", "shiny fresh fish"),
    "hunting":   ("verdant hunting forest, autumn leaves, leather and arrows, warm green-brown palette. ",
                  "cluster of wild mushrooms and berries", "plump red mushroom"),
    "market":    ("festive market bazaar, warm orange awnings, hanging lanterns, gold coins, bustling warmth. ",
                  "shelves of shiny canned goods and gold coins", "shiny golden can"),
    "warehouse": ("ancient relic warehouse, terracotta jars, antique gold, dust motes, warm brown palette. ",
                  "ancient terracotta relic jar", "antique golden relic"),
    "archery":   ("golden treasure shooting range, bullseye targets, piled gold, radiant yellow palette. ",
                  "pile of golden treasure and bullseye target", "gleaming gold nugget"),
}

# ── 兩種動作 × 3 幀（{res}＝礦脈資源，{item}＝單件收穫物）──
ACTIONS = {
    "dig": [
        "the cat villager raising a pickaxe high overhead with both paws, ready to swing down at a big {res}, "
        "eager determined pose, small dust particles in the air",
        "the cat villager swinging the pickaxe and striking the {res}, bright sparks and rock chips flying, "
        "impact burst lines, dust cloud puff",
        "the {res} cracked open with glowing pieces popping out, the cat villager joyfully grabbing a big glowing chunk, "
        "sparkles and confetti, victory pose",
    ],
    "gather": [
        "the cat villager reaching out both paws toward a {res}, eager curious pose, leaning forward",
        "the cat villager plucking a {item} with one paw, leaves and dewdrops shaking, small motion lines, "
        "the item coming loose",
        "the cat villager holding up a shiny {item} with both paws, happy closed-eye smile, sparkles and floating petals, "
        "celebration pose",
    ],
}

NEG = ("realistic, photorealistic, text, letters, watermark, ui, frame, cluttered, blurry, lowres, deformed, "
       "dark, scary, extra limbs, extra fingers, distorted hands, two cats, many objects, crowded")


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
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "board_action", "images": ["8", 0]}},
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
    # ⚠️ 不去背：rembg 會誤刪貓的部位。原圖＝完整場景（角色＋資源＋背景），直接縮放。
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    out = im.resize((CANVAS, CANVAS), Image.LANCZOS)
    out.save(outpath, "WEBP", quality=90, method=6)


def run(map_id, action, frame, force=False):
    os.makedirs(OUTDIR, exist_ok=True)
    fname = f"action_{map_id}_{action}_{frame}.webp"
    outpath = os.path.abspath(os.path.join(OUTDIR, fname))
    if os.path.exists(outpath) and not force:
        print(f"  skip (exists) {fname}")
        return
    theme, res, item = FAMILIES[map_id]
    prompt = ACTION_BASE + theme + ACTIONS[action][frame - 1].format(res=res, item=item) + ". "
    print(f"[{map_id}/{action}#{frame}] generating...", flush=True)
    try:
        png = generate(prompt, NEG)
        cut_and_save(png, outpath)
        print(f"  OK -> {fname}", flush=True)
    except Exception as e:
        print(f"  ERROR {map_id}/{action}#{frame}: {e}", flush=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    force = "--force" in args
    maps = [a for a in args if a in FAMILIES] or list(FAMILIES)
    acts = [a for a in args if a in ACTIONS] or list(ACTIONS)
    if "all" in args:
        maps, acts = list(FAMILIES), list(ACTIONS)
    for mid in maps:
        for a in acts:
            for f in (1, 2, 3):
                run(mid, a, f, force)
    print("done")
