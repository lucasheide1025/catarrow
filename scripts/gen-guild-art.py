# scripts/gen-guild-art.py
# 冒險者公會美術全自動管線（比照 gen-dungeon-covers / gen-rune-tiles）
#   ComfyUI /prompt 生成 →（去背類走 rembg，場景類直接存 RGB）→ WebP → public/assets/guild/
#
# 產出（emoji 佔位的東西全部一次補齊）：
#   hall     公會大廳底圖（委託板背景）      2:1  hall_bg.webp
#   field    6 族 2.5D 鳥瞰戰場地面         4:3  field_<family>.webp
#   paper    委託單羊皮紙底                 4:3  contract_paper.webp
#   master   公會長貓 NPC（去背立繪）       512² guild_master.webp
#   rank     6 階徽章（去背）               256² rank_<id>.webp
#   junk     6 種雜貨（去背）               256² junk_<id>.webp
#
# ⚠️ 怪物與貓貓「不重生」——沿用主線既有的 /monsters-battle 與貓咪立繪（省時間也保持一致）。
# 用法：<embedded_python> scripts/gen-guild-art.py <all|hall|field|paper|master|rank|junk> [單一 id]
#   embedded python 要用「正在跑 8188 的那個副本」（有 rembg）：
#   E:\AI\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\python_embeded\python.exe
import sys, json, time, uuid, urllib.request, urllib.parse, io, os, random
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "guild")

# 全公會統一畫風：手繪 RPG 幻想手遊風（與地下城 cover 同語言，才不會像兩款遊戲）
STYLE = ("painterly hand-painted fantasy RPG mobile game art, warm lantern lighting, rich detail, "
         "cohesive stylised look, NOT photorealistic, no text, no watermark, no ui. ")
NEG_SCENE = ("realistic, photorealistic, text, letters, words, watermark, ui, hud, people, faces, "
             "blurry, lowres, deformed, frame border, collage, split screen")
NEG_CUTOUT = ("realistic, photorealistic, text, watermark, ui, background scenery, busy background, "
              "multiple objects, blurry, lowres, deformed, cropped, frame border, "
              "lantern, lamp, candle, torch, pedestal, base, stand, display case")
# ⚠️ 去背類**不能吃 STYLE**：STYLE 裡的 "warm lantern lighting" 會讓模型在物件旁邊加一盞燈籠
#    （雜貨齒輪第一版就長了一盞燈）。改用中性打光描述。
STYLE_CUTOUT = ("painterly hand-painted fantasy RPG game item art, clean soft studio rim lighting, "
                "rich detail, stylised, NOT photorealistic, no text, no watermark, no ui. ")

# ── 場景類（不去背）────────────────────────────────────────
SCENES = {
    # 委託板背景：公會大廳內部，中央一面貼滿委託的木製佈告板
    "hall_bg": dict(w=1216, h=832, out=(1024, 512), prompt=(
        "interior of a cozy adventurers guild hall at night, a large wooden bulletin board covered with "
        "pinned parchment notices in the centre, warm oil lanterns, wooden beams, stone fireplace glow, "
        "shelves with bottles and rolled maps, inviting tavern atmosphere, empty room without characters")),
    # 委託單紙張：**純紙張材質**當卡片底。
    # ⚠️ 第一版寫「pinned notice + candlelight」→ 模型硬加燈籠、小刀跟亂碼文字，紙還沒填滿畫面，整張不能用。
    #    改成「材質貼圖」的講法（fills entire frame / flat scan / empty），並把道具與文字全塞進負面詞。
    "contract_paper": dict(w=1024, h=768, out=(768, 576), prompt=(
        "seamless aged parchment paper texture filling the entire frame edge to edge, flat overhead scan of "
        "one empty sheet, uniform warm cream beige tone, subtle fibre grain and faint stains, "
        "slightly darker worn edges, completely empty surface, nothing on the paper"),
        # ⚠️ 不吃 STYLE：全域風格字串裡的 "warm lantern lighting" 會一直把燈籠畫進來（重抽兩次才發現）
        style="",
        neg=("text, writing, handwriting, letters, words, runes, symbols, drawing, map, seal, stamp, "
             "lantern, candle, knife, dagger, quill, pen, coins, tools, props, objects, hands, wood table, "
             "background scenery, vignette frame, torn hole, photorealistic, people")),
}

# 6 族的 2.5D 鳥瞰戰場地面（俯視 45 度，畫面上方遠、下方近）
FIELDS = {
    "ghost":     "a night-time temple courtyard seen from a high 45-degree bird's eye view, stone slabs, "
                 "red paper lanterns, drifting indigo ghost mist",
    "mountain":  "a misty mountain forest clearing seen from a high 45-degree bird's eye view, mossy rocks, "
                 "pine needles on dirt, dark emerald fog",
    "insect":    "a damp cavern floor seen from a high 45-degree bird's eye view, glowing bioluminescent "
                 "honeycomb patches, chitin shards, deep green glow",
    "workplace": "a ruined office floor seen from a high 45-degree bird's eye view, scattered documents, "
                 "broken desks, flickering cold neon light, dark blue tone",
    "exam":      "a ruined library floor seen from a high 45-degree bird's eye view, scattered books and "
                 "parchment, wooden boards, warm crimson bronze light",
    "temple":    "a gothic cathedral stone floor seen from a high 45-degree bird's eye view, carved tiles, "
                 "melted candles, violet silver holy glow",
}
FIELD_TAIL = (", empty battlefield ground with no characters and no monsters, receding depth from top to bottom, "
              "atmospheric perspective, darker at the bottom edge for ui overlay")

# ── 去背類 ────────────────────────────────────────────────
CUTOUTS = {
    # 公會長貓（NPC 立繪）：擬人化的老貓，穿公會長袍
    "guild_master": dict(canvas=640, pad=0.04, prompt=(
        "a dignified elderly anthropomorphic tabby cat guild master standing upright, wearing an ornate "
        "burgundy and gold guild robe with a badge, small round spectacles, holding a quill and ledger, "
        "kind but stern expression, full body character portrait, MEDIUM-SIZED clearly visible, "
        "plain solid dark background")),
}

RANKS = {
    "apprentice": "a simple humble wooden guild rank badge with a small green leaf emblem, plain rope trim",
    "bronze":     "a bronze guild rank badge with a crossed-arrows emblem, warm copper patina",
    "silver":     "a polished silver guild rank badge with a crossed-arrows emblem and small wings",
    "gold":       "an ornate gold guild rank badge with a crossed-arrows emblem and laurel wreath",
    "platinum":   "a radiant platinum guild rank badge with a cyan gemstone core and elegant filigree",
    "legend":     "a legendary guild rank badge, blazing golden crown emblem with violet magical aura and gems",
}
JUNKS = {
    "rusty_gear":       "a single rusty iron cog wheel, worn and pitted",
    "old_map_scrap":    "a single torn fragment of an old treasure map",
    "monster_fang":     "a single large curved ivory monster fang with a leather cord",
    "ancient_coin":     "a single tarnished ancient gold coin with unknown engraving",
    "gemstone_shard":   "a single glowing violet gemstone shard, faceted and translucent",
    "mysterious_relic": "a single small mysterious clay relic urn with glowing carved runes",
}
BADGE_TAIL = (", game item icon, centred single object, MEDIUM-SIZED clearly visible, "
              "plain solid dark background, soft rim light")


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
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "guild_gen", "images": ["8", 0]}},
    }


def generate(pos, neg, w, h):
    pid = post("/prompt", {"prompt": build_wf(pos, neg, w, h), "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(160):
        hist = get(f"/history/{pid}")
        if pid in hist and hist[pid].get("status", {}).get("completed"):
            img = hist[pid]["outputs"]["9"]["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img["type"]})
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


def save_cutout(png, outpath, canvas, pad):
    from rembg import remove
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    cut = remove(im).convert("RGBA")
    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)
    m = int(canvas * (1 - pad * 2))
    w, h = cut.size
    s = min(m / w, m / h)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    cut = cut.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(cut, ((canvas - nw) // 2, (canvas - nh) // 2), cut)
    out.save(outpath, "WEBP", quality=90, method=6)


def do_scene(name, cfg):
    outpath = os.path.abspath(os.path.join(OUTDIR, f"{name}.webp"))
    print(f"[scene/{name}] generating...", flush=True)
    neg = NEG_SCENE + ", " + cfg["neg"] if cfg.get("neg") else NEG_SCENE
    style = cfg["style"] if cfg.get("style") is not None else STYLE
    png = generate(style + cfg["prompt"], neg, cfg["w"], cfg["h"])
    save_scene(png, outpath, cfg["out"])
    print(f"  OK -> {outpath}", flush=True)


def do_field(family):
    outpath = os.path.abspath(os.path.join(OUTDIR, f"field_{family}.webp"))
    print(f"[field/{family}] generating...", flush=True)
    png = generate(STYLE + FIELDS[family] + FIELD_TAIL, NEG_SCENE, 1024, 1024)
    save_scene(png, outpath, (768, 768))
    print(f"  OK -> {outpath}", flush=True)


def do_cutout(name, prompt, canvas, pad, tail="", style=None):
    outpath = os.path.abspath(os.path.join(OUTDIR, f"{name}.webp"))
    print(f"[cutout/{name}] generating...", flush=True)
    png = generate((STYLE_CUTOUT if style is None else style) + prompt + tail, NEG_CUTOUT, 1024, 1024)
    save_cutout(png, outpath, canvas, pad)
    print(f"  OK -> {outpath}", flush=True)


def run(group, only=None):
    os.makedirs(OUTDIR, exist_ok=True)
    if group in ("all", "hall"):
        do_scene("hall_bg", SCENES["hall_bg"])
    if group in ("all", "paper"):
        do_scene("contract_paper", SCENES["contract_paper"])
    if group in ("all", "field"):
        for f in ([only] if only else list(FIELDS)):
            do_field(f)
    if group in ("all", "master"):
        c = CUTOUTS["guild_master"]
        do_cutout("guild_master", c["prompt"], c["canvas"], c["pad"])
    if group in ("all", "rank"):
        for rid in ([only] if only else list(RANKS)):
            do_cutout(f"rank_{rid}", RANKS[rid], 256, 0.06, BADGE_TAIL)
    if group in ("all", "junk"):
        for jid in ([only] if only else list(JUNKS)):
            do_cutout(f"junk_{jid}", JUNKS[jid], 256, 0.08, BADGE_TAIL)


if __name__ == "__main__":
    grp = sys.argv[1] if len(sys.argv) > 1 else "all"
    one = sys.argv[2] if len(sys.argv) > 2 else None
    try:
        run(grp, one)
        print("DONE", flush=True)
    except Exception as e:
        print(f"FAILED: {e}", flush=True)
        sys.exit(1)
