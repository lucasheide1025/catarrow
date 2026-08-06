# scripts/gen-dungeon-tiles.py
# 地下城房間立繪全自動管線：ComfyUI 生成 → rembg 去背 → 512 WebP → public/assets/dungeon/
#   用法：<embedded_python> scripts/gen-dungeon-tiles.py <family|all> [type]
#   例：  python scripts/gen-dungeon-tiles.py ghost         # 生幽冥系全部 15 房
#         python scripts/gen-dungeon-tiles.py ghost battle  # 只生幽冥戰鬥房
#         python scripts/gen-dungeon-tiles.py common scout  # 只生通用版瞭望點
#         python scripts/gen-dungeon-tiles.py all           # 七族全生（105 張）
#
# RoomTile 的 fallback 鏈是 room_{family}_{type} → room_{type} → EMPTY_SRC，
# 所以新房型**先生 common 通用版就能上線**，族系專屬版之後想做再補、不做也不會壞。
import sys, json, time, uuid, urllib.request, urllib.parse, io, os
from rembg import remove
from PIL import Image

COMFY = "http://127.0.0.1:8188"
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "dungeon")
CANVAS, PAD = 512, 0.05

_COMMON = ("cute stylized isometric 2.5D dungeon map tile, painterly friendly mobile game art, "
           "NOT realistic, NOT scary, no horror, no gore, kawaii low-poly charm, soft rounded shapes, "
           "high 3/4 top-down angle. ")
# 物件房：大石台為主、物件小而置中（各房石台一致大小）
STYLE_OBJECT = (_COMMON +
    "ALWAYS a round thick floating stone disc platform as the base — the FULL circular stone platform is "
    "clearly visible and complete at the bottom, consistent size every tile. In the CENTER on top of the "
    "platform sits a clear MEDIUM-SIZED {subject}, obvious and instantly recognizable. A few small {theme} "
    "accents on the platform edge (props only, NOT a building). Dark simple background, no text, no ui, no people.")
# 小怪房：小怪醒目但不遮住石台，坐/站在石台中央
STYLE_CREATURE = (_COMMON +
    "ALWAYS a round thick floating stone disc platform as the base — the FULL circular stone platform is "
    "clearly visible and complete at the bottom under the creature, consistent size every tile. Sitting ON TOP "
    "of the platform in the CENTER as the clear main focus: {subject}. The cute creature is medium sized so the "
    "whole round stone platform stays fully visible around and beneath it (creature does NOT float in empty "
    "space). A few tiny {theme} accents on the platform edge. Dark simple background, no text, no ui, no people.")
NEG = ("realistic, photorealistic, scary, horror, creepy, gore, blood, grim, ugly, "
       "text, watermark, ui, multiple platforms, bridges, people, "
       "floating in empty space, no platform, missing platform, no ground base, "
       "square tile, grass block, isometric grid tile, "
       "big building covering everything, blurry, lowres, deformed")
# 功能物件房額外禁止出現生物/角色（戰鬥類房間不套用，因為要放小怪）
NEG_OBJECT = ", monster, creature, animal, character, mascot, ghost, person"

# 主體吃重版：物件必須壓過石台。
# ⚠️ 2026-08-06 踩坑：輕量房四張第一次全滅，失敗模式**完全一致** ——
#    模型把 STYLE_OBJECT 的「round stone platform」當成主角畫得又大又華麗
#    （多層蛋糕狀石台、正中央插一支火把），而 SUBJECTS 描述的錢袋／驚嘆號／
#    望遠鏡整個消失。這跟 memory 記的「主體太搶焦時石台會被省略」是反向的同一個病：
#    石台與主體在搶版面，誰贏由 seed 決定。
#    解法＝把主體加權 (…:1.5) 並明講佔畫面高度，同時把模型愛自己加的東西
#    （火把／火焰／多層石台）寫進負面詞。
#    ⚠️ 第二次又全滅，方向相反：加權 1.5 把主體拉出來了，但**連風格字串一起壓過去** ——
#       四張全變成白底寫實商品攝影（真皮錢袋、黃銅望遠鏡），石台完全消失。
#       結論：加權要輕（1.2），而且風格與石台必須在主體**之後**再宣告一次，
#       讓最後的 token 把畫風拉回來。
STYLE_OBJECT_HERO = (_COMMON +
    "ALWAYS a round thick floating stone disc platform as the base — the FULL circular stone platform is "
    "clearly visible and complete at the bottom, SINGLE FLAT LEVEL, consistent size every tile. Resting in "
    "the CENTER on top of the platform is ({subject}:1.2), rendered large enough to fill most of the platform "
    "and be instantly recognizable at a glance. A few small {theme} accents on the platform edge (props only, "
    "NOT a building). Painterly stylized cute mobile game art, hand-painted textures, high 3/4 top-down angle, "
    "dark simple background, no text, no ui, no people.")

# 各房型的額外負面詞（對付模型的固定偏好，比一直重抽有效）
TYPE_NEG = {
    "quick_event": ", torch, brazier, fire, flame, bonfire, candle, campfire, rune circle, question mark",
    "coin_pouch":  ", torch, brazier, fire, flame, treasure chest, empty platform",
    "mini_chest":  ", torch, brazier, fire, flame, stone chest, stone box, huge chest, ornate golden chest",
    "scout":       ", torch, brazier, fire, flame, beacon, watchtower, tower, building, castle, stairs",
}
# 用主體吃重版的房型（輕量房：主體要一眼可辨，不能被石台搶走）
HERO_TYPES = {"quick_event", "coin_pouch", "mini_chest", "scout"}
# 模型很愛自己把石台畫成多層婚禮蛋糕，共通擋掉
NEG_HERO = (", tiered platform, multi-level platform, ziggurat, wedding cake shape, staircase platform, "
            "empty platform, nothing on top, square base, wooden base, rectangular base, "
            "product photo, studio photo, white background, plain background, letters, words, writing, signature")

# 各族「可愛小怪」（代表戰鬥房 = 有怪要打）
CREATURES = {
    "common":    "a cute small round monster with cat ears, a friendly smiling face, no legs (a wavy bottom)",
    "ghost":     "a cute classic bedsheet ghost, a smooth floating white teardrop body whose bottom is a WAVY RUFFLED SKIRT HEM (floating cloth, absolutely NO legs, NO feet, NO arms, NO hands), only small pointy CAT EARS on top of its head and cat whiskers, big cute round eyes, glowing soft white, floating in mid air",
    "mountain":  "a cute chunky wild boar spirit made of mossy grey mountain stone, small ivory tusks, glowing jade-green eyes, rocky pebble skin with green moss patches, sturdy and earthy",
    "insect":    "a cute round rhino beetle with a glossy iridescent emerald-green shell, one small golden horn, tiny wings, big friendly sparkling eyes, honey-amber glow",
    "workplace": "a cute grumpy tiny monster wearing a dark business suit and red necktie, holding a small briefcase, tired office-worker face, cold blue neon rim light",
    "exam":      "a cute little monster whose body is an open book with big round eyes, tiny pencil arms, wearing small round glasses, floating exam papers around it, ink-blue and ivory tones",
    "temple":    "a cute friendly little cartoon skeleton monk in a tiny grey robe holding a small glowing lantern, gentle smile, NOT scary, pale gothic candlelight",
    "treasure":  "a cute mimic monster whose body is a wooden treasure chest, the open lid is a big smiling mouth with square teeth, two tiny eyes on the lid, gold coins spilling, golden sparkle",
}
CREATURE_TYPES = {"battle", "elite_battle", "boss_battle"}

# 族系 = 只當「石台點綴」，不是主體建築
FAMILIES = {
    "common":    "mossy grey dungeon stone, a couple of small torches, green moss, simple neutral",
    "ghost":     "a few small red paper lanterns, incense sticks, mossy old stone, warm candle glow",
    "mountain":  "moss, small pine saplings, wooden totem carvings, grey mountain stone",
    "insect":    "small glowing honeycomb bits, green leaves, smooth chitin edges",
    "workplace": "a small neon sign, scattered office papers, grey tiled floor",
    "exam":      "small stacks of books, scattered exam papers, pencils",
    "temple":    "small lit candles, carved stone runes, pale gothic stone",
    "treasure":  "a few scattered gold coins, tiny gems, golden trim",
}

# 功能物件 = 主角，放大、明確、一眼可辨
SUBJECTS = {
    "entrance":     "a stone gateway archway doorway, the entrance portal",
    "battle":       "{creature}, a monster to fight",
    "elite_battle": "a tougher {creature} with a small banner, an elite monster",
    "boss_battle":  "{creature} wearing a shiny golden crown, a boss monster",
    "shop":         "a merchant market stall with a striped awning and goods, a shop",
    "event":        "a glowing magic rune circle with sparkles and a question mark, a mystery event",
    "trap":         "iron spikes with a pressure-plate trap mechanism, a trap, cartoon not scary",
    "chest":        "an open wooden treasure chest with gold coins",
    "rest":         "a cozy campfire with a small tent, a rest camp",
    "stairs":       "a stone staircase descending into a dark hole, stairs going down",
    "treasure":     "a pile of gold coins gems and a small golden idol, a treasure hoard",
    # ── 輕量房（2026-08-06 地圖重製）──────────────────────────────
    # 踩到就結算、不開全螢幕舞台，所以立繪要「一眼看懂、不引起期待」。
    # 刻意與對應的重量房拉開距離：
    #   quick_event 綠色驚嘆號 vs event 發光符文圈＋問號
    #   mini_chest  樸素闔上的小木箱 vs chest 敞開的華麗寶箱
    # empty 房型**不生圖**：room_empty.webp 已是一張完整的空平台立繪（同時當 EMPTY_SRC）。
    # 抽象符號（驚嘆號、問號）模型畫不穩，改用「實體物件」當主角比較好抽
    # ⚠️ 這四條**不准出現 small / tiny / little / mini** 等縮小詞 ——
    #    memory 早就記過「寫『小』會讓模型把物件畫沒」，我還是踩了：
    #    mini_chest 寫了 "a small ... crate" + "a tiny wooden barrel"，結果整張只剩苔蘚甜甜圈。
    #    對照組：會成功的 chest 是 "an open wooden treasure chest with gold coins"，零尺寸詞。
    #    「迷你」的感覺靠**造型樸素**（木板、無裝飾、闔上）表達，不靠形容詞。
    "quick_event":  "a wooden signpost pole with a wooden arrow board nailed on it, a glowing green exclamation mark shining above the board, green sparkles",
    "coin_pouch":   "a burst open brown cloth money sack lying on its side with a big pile of gold coins pouring out of it",
    "mini_chest":   "a closed wooden crate chest made of rustic brown planks with iron corner bands and a latch, plain and undecorated",
    "scout":        "a wooden lookout post, a ladder leaning against a raised viewing platform with a flag on a pole",
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
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "dungeon_gen", "images": ["8", 0]}},
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


BG_PROMPTS = {
    "common":    "mysterious fantasy dungeon atmosphere, dark atmospheric cavern background, soft ambient glow, painterly mobile game art, no text, no ui, no focus object",
    "ghost":     "Taiwanese folk temple at night, paper lanterns in dark mist, mysterious Taiwanese taoist atmosphere, dark purple and indigo ambient glow, painterly mobile game background",
    "mountain":  "misty magical mountain peak at night, pine trees in fog, mossy rocks, dark emerald and teal ambient glow, painterly mobile game background",
    "insect":    "glowing insect cavern hive, bioluminescent spores, honeycomb glow, dark deep green and gold ambient glow, painterly mobile game background",
    "workplace": "stylized dystopian office ruins at night, soft neon signs in dark fog, dark blue and purple ambient glow, painterly mobile game background",
    "exam":      "mysterious ancient library ruins, floating parchment and books in dark fog, dark crimson and bronze ambient glow, painterly mobile game background",
    "temple":    "gothic stone cathedral cavern, lit candles and gothic arches in dark mist, dark violet and silver ambient glow, painterly mobile game background",
    "treasure":  "golden vault cavern, glowing gold coin piles in dark mist, dark warm amber and gold ambient glow, painterly mobile game background",
}

def run_bg(family):
    fname = f"map_bg.webp" if family == "common" else f"map_bg_{family}.webp"
    outpath = os.path.abspath(os.path.join(OUTDIR, fname))
    print(f"[{family}/BG] generating background...", flush=True)
    pos = BG_PROMPTS.get(family, BG_PROMPTS["common"])
    neg = "realistic, photorealistic, scary, horror, gore, blood, text, watermark, ui, people, mascot, character"
    png = generate(pos, neg)
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im = im.resize((1024, 1024), Image.LANCZOS)
    im.save(outpath, "WEBP", quality=85)
    print(f"  OK BG -> {outpath}", flush=True)


GEN_BG = os.environ.get("GEN_BG", "0") == "1"  # 預設不重生背景，只生房塊


def run(family, only_type=None):
    theme = FAMILIES[family]
    os.makedirs(OUTDIR, exist_ok=True)
    # 若無指定單一房型，且開啟 GEN_BG，才生成族系專屬背景圖
    if not only_type and GEN_BG:
        try:
            run_bg(family)
        except Exception as e:
            print(f"  BG Error: {e}", flush=True)

    types = [only_type] if only_type else list(SUBJECTS.keys())
    for t in types:
        fname = f"room_{t}.webp" if family == "common" else f"room_{family}_{t}.webp"
        outpath = os.path.abspath(os.path.join(OUTDIR, fname))
        print(f"[{family}/{t}] generating...", flush=True)
        subj = SUBJECTS[t]
        is_creature = t in CREATURE_TYPES
        if "{creature}" in subj:
            subj = subj.format(creature=CREATURES[family])
        is_hero = t in HERO_TYPES
        style = STYLE_CREATURE if is_creature else (STYLE_OBJECT_HERO if is_hero else STYLE_OBJECT)
        pos = style.format(theme=theme, subject=subj)
        neg = NEG if is_creature else NEG + NEG_OBJECT
        if is_hero:
            neg = neg + NEG_HERO + TYPE_NEG.get(t, "")
        if is_creature and family == "ghost":
            neg = neg + ", legs, feet, paws, arms, hands, standing, four legs, animal body, pikachu, pokemon"
        png = generate(pos, neg)
        cut_and_save(png, outpath)
        print(f"  OK -> {outpath}", flush=True)


if __name__ == "__main__":
    fam = sys.argv[1] if len(sys.argv) > 1 else "all"
    typ = sys.argv[2] if len(sys.argv) > 2 else None
    fams = list(FAMILIES.keys()) if fam == "all" else [fam]
    for f in fams:
        run(f, typ)
    print("DONE", flush=True)
