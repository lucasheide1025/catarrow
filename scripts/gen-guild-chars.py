# scripts/gen-guild-chars.py
# 冒險者公會「2.5D 微縮模型風」角色美術管線（ComfyUI → rembg 去背 → 512 WebP）
#
# 為什麼要這支：公會戰鬥畫面的立繪目前是**三種畫風混在一起**——
#   ① 擴充怪（210 隻）動漫插畫風，可用；
#   ② 舊怪（42 隻 normalExisting）是寫實暗黑風，跟旁邊的怪擺一起很突兀；
#   ③ 玩家還是 emoji 🏹，貓貓用的是「有背景的寫實頭像」（方形、沒去背）。
# 所以本腳本只補 ②③。**不覆蓋 /monsters-battle/**，輸出到 public/assets/guild/chibi/，
# 主線打怪模式完全不受影響（公會隔離鐵律）。
#
# 🎨 畫風＝**跟地下城房塊同一套語言**（見 gen-dungeon-tiles.py 的 _COMMON）：
#    可愛微縮模型 / 黏土手作感 / 45° 3-4 視角 / 柔和打光，**不是動漫 Q 版**。
#    ⚠️ 第一版用 Animagine（動漫模型）畫 chibi，結果是貼紙風＋平塗向量，跟地下城完全不同世界 → 廢棄。
#    地下城房塊角色都坐在圓石台上；戰鬥立繪**不要石台**（要站在戰場上），所以石台移到負面詞。
#
# 用法（一定要用「正在跑 8188 的那個副本」的 embedded python，它才有 rembg）：
#   E:\AI\...\python_embeded\python.exe scripts/gen-guild-chars.py <all|hero|cats|mobs> [單一 id] [--force]
#   預設**跳過已存在的檔案**（可分批續跑）；要重抽某張加 --force。
import sys, json, time, uuid, urllib.request, urllib.parse, io, os, random

from PIL import Image

COMFY = "http://127.0.0.1:8188"
# 跟地下城房塊同一個 checkpoint 與 Turbo 參數，畫風才會真的一致
CKPT = "DreamShaperXL_Turbo_v2_1.safetensors"
STEPS, CFG, SAMPLER, SCHED = 8, 2.0, "dpmpp_sde", "karras"
W, H = 832, 1216          # 直幅，全身站姿才不會被裁頭
CANVAS, PAD = 512, 0.05
OUTDIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "guild", "chibi")

# ── 全域畫風（沿用地下城 _COMMON，改成「單體角色」而非房塊）────────────
# ⚠️ 教訓（見 gen-guild-art.py）：全域 STYLE 會污染每一張圖。這裡不寫任何場景/光源道具，
#    因為全部要去背，多一盞燈或一塊地板都會被 rembg 留下來變垃圾像素。
STYLE = ("cute stylized isometric 2.5D miniature game figure, collectible vinyl toy figurine, "
         "oversized head with short stubby limbs, glossy smooth sculpted materials, "
         "painterly friendly mobile game art, NOT realistic, NOT scary, no horror, no gore, "
         "kawaii low-poly charm, soft rounded shapes, handcrafted miniature model feel, "
         "soft even studio lighting, high 3/4 front view, FULL BODY standing, single character, "
         "MEDIUM-SIZED clearly visible and complete, plain dark simple background, no text, no ui. ")
# 怪物一律先冠上「可愛玩具」前綴：DreamShaper 偏寫實，描述裡只要有 huge/roaring/scarred
# 這種字眼就會壓過風格字串畫成寫實猛獸（第一版的食人巨熊就是這樣跑掉的）。
MOB_HEAD = "a cute chunky toy figurine of "

# ⚠️ 上面的 STYLE 寫死了「short stubby limbs + FULL BODY standing」→ **任何東西都會被掰成兩足人形**：
#    蛇長出手腳、蜘蛛變外星人、蜈蚣變小龍。非兩足的怪要換掉這兩句。
STYLE_NONBIPED = (STYLE
                  .replace("oversized head with short stubby limbs", "chunky rounded body, big cute eyes")
                  .replace("FULL BODY standing", "the WHOLE creature visible, natural creature anatomy"))
# 再一層：主體是**物件**（紙、書）的怪。連 "figure / character / creature" 這些字都要拿掉，
# 只要留著，模型就會生一隻小怪出來（exam_1 連抽四次都是生物，就是被這些字釘住的）。
STYLE_OBJECT = (STYLE
                .replace("miniature game figure, collectible vinyl toy figurine",
                         "miniature game object, cute animated everyday object")
                .replace("oversized head with short stubby limbs", "chunky rounded shape")
                .replace("FULL BODY standing, single character", "the WHOLE object visible, single object"))
# 蛇/蟲/寶箱/紙這類本來就不是兩足的
NONBIPED = {"mountain_2", "mountain_6", "insect_1", "insect_3", "insect_4", "insect_5",
            "exam_1", "exam_2", "exam_3",
            "treasure_1", "treasure_2", "treasure_3", "treasure_4", "treasure_5", "treasure_6"}
# 單怪額外負面詞：光靠正面描述壓不住模型偏好時用。
# 蛇連抽三次都長出手腳＋變成蜥蜴 → 只能把四肢與蜥蜴類直接加權排除。
MOB_NEG = {
    "mountain_2": ", (arms:1.5), (legs:1.5), (hands:1.5), (feet:1.5), lizard, dinosaur, dragon, upright posture",
    "insect_5":   ", (humanoid:1.4), (human body:1.4), alien, two legs, arms, torso",
    # 紙/書類：模型一律想生一隻生物 → 直接把「生物」加權排除
    "exam_1": ", (creature:1.4), (animal:1.4), (monster body:1.4), fur, skin, alien, blob",
    "exam_2": ", (creature:1.4), (animal:1.4), (monster body:1.4), fur, skin, alien, blob",
    "exam_3": ", (creature:1.4), (animal:1.4), (monster body:1.4), fur, skin, alien, blob",
}
# ⚠️ `MOB_HEAD`（"a cute chunky toy figurine of"）本身就在叫模型生一隻**生物玩具**，
#    紙怪/書怪套上去必定變成小怪。這幾隻的主體是物件，前綴要拿掉、改走 STYLE_OBJECT。
#    蛇也放進來：`figure/character/creature` 這些字只要還在，牠就會被畫成兩足蜥蜴（抽四次都是）。
NO_MOB_HEAD = {"exam_1", "exam_2", "exam_3", "mountain_2"}
# ⚠️ 寶箱怪**不要**放進 NO_MOB_HEAD：牠是「箱子＋臉」的合體，走純物件風格會變成一個
#    沒有五官的漂亮寶箱（或反過來變成沒有箱子的獸）。留在 STYLE_NONBIPED 才會長出蓋子當嘴巴。
# 石台/地面一定要擋掉：地下城房塊是「怪坐在圓石台上」，戰鬥立繪要的是**單獨一隻**
NEG = ("realistic, photorealistic, scary, horror, creepy, gore, blood, grim, ugly, "
       # 加權：不加權的話模型很愛給角色一塊圓形底座（林投姐第一版就站在黑色展示台上）
       "(stone platform:1.4), (round base:1.4), (pedestal:1.4), (display stand:1.4), "
       "disc, diorama base, terrain, ground, floor, grass, "
       "anime, manga, flat vector, sticker, die cut sticker, white outline border, frame, border, "
       "aura, glowing effects, magic circle, sparkles, confetti, rainbow, colorful splashes, "
       "text, letters, watermark, signature, ui, hud, multiple characters, crowd, duplicate, "
       "cropped, out of frame, cut off, blurry, lowres, deformed, extra limbs")

# 階級遞進：同一族從 T1 到 T6 要看得出「越來越強」
# 強弱只用「裝飾密度 / 材質 / 表情」表達，**不准寫光效**（會噴滿背景害去背失敗）
TIER_TAIL = {
    1: ", scruffy, crude simple gear, muted colors",
    2: ", worn leather gear, cocky expression",
    3: ", decorated bronze gear, confident veteran expression",
    4: ", ornate silver armor, elite commander expression",
    5: ", luxurious ornamented gold regalia, imposing expression",
    6: ", elaborate jewelled golden regalia, majestic expression",
}
# 非生物型的怪（紙、書、寶箱）不能吃上面那套「盔甲/裝備」字眼——第一版考試三隻因此
# 全被畫成披甲小怪，「紙」的概念整個不見。改用材質與體積表達強弱。
TIER_TAIL_OBJ = {
    1: ", small, plain worn material, muted colors",
    2: ", thicker and heavier, slightly worn edges",
    3: ", bulky, richer materials, more detail",
    4: ", large and imposing, ornate trim",
    5: ", massive, luxurious gold trim",
    6: ", colossal, elaborate jewelled gold ornamentation",
}
OBJ_MOBS = {"exam_1", "exam_2", "exam_3", "exam_5", "exam_6",
            "treasure_1", "treasure_2", "treasure_3", "treasure_4", "treasure_5", "treasure_6"}

# ── 42 隻舊怪（Q 版重畫）────────────────────────────────────
# 台灣民俗 + 西幻 + 職場/考試梗混編。描述只寫「長相與道具」，畫風交給 CHIBI。
MOBS = {
    # 鬼怪（台灣民俗）
    "ghost_1": (1, "a friendly wandering spirit ghost in a pale white funeral robe, translucent wispy lower body, holding a lit incense stick, cheeky grin, drifting blue soul flames"),
    "ghost_2": (2, "a small red-skinned mountain goblin spirit wearing tattered leaves, holding grasshoppers, sly toothy grin, glowing yellow eyes"),
    "ghost_3": (3, "a female ghost in a flowing white robe with very long black hair, pandanus leaves around her, carrying a paper lantern, pale sorrowful face"),
    "ghost_4": (4, "a chinese city god deity in ornate imperial magistrate robes, tall black official hat, holding a judgement tablet, stern golden aura"),
    "ghost_5": (5, "a loyal black dog guardian spirit with a red temple sash and gold collar, small shrine gate behind its shoulders, incense smoke, protective stance"),
    "ghost_6": (6, "king yama the hell judge, crimson and black imperial robes, long beard, jade crown, holding a life-and-death ledger and writing brush, hellfire aura"),
    # 山林
    "mountain_1": (1, "a wild boar spirit standing upright on two legs, big tusks, straw rope armor, mountain vines, snorting"),
    # ⚠️ 只寫 "viper king" 會被畫成蜥蜴/小龍——**長條無足的蛇身**要講死（第一版跑掉過）
    "mountain_2": (2, "a snake, a long legless serpent with a coiled spiral body and NO arms and NO legs, "
                      "brown triangular scale pattern, raised head with a small crown, venom fangs"),
    "mountain_3": (3, "a mandrill mountain demon, bright blue and red face, long fangs, fur cloak, wooden club"),
    "mountain_4": (4, "a mist-shrouded stone giant, mossy rocky skin, indigenous totem tattoos, huge fists, foggy aura"),
    "mountain_5": (5, "a huge black bear beast standing on hind legs, bone plate armor, scarred fur, roaring, big claws"),
    "mountain_6": (6, "an eastern flood dragon jiaolong, dark green scales, antlers, long whiskers, coiling body, storm clouds and water spray"),
    # 蟲
    "insect_1": (1, "a giant cockroach monster, glossy brown carapace, twitching antennae, comically menacing pose"),
    "insect_2": (2, "a giant hornet, bold yellow and black stripes, translucent wings, oversized stinger"),
    "insect_3": (3, "a giant centipede demon, red segmented armored body, many legs, glowing eyes, rearing up"),
    "insect_4": (4, "a scorpion king, obsidian carapace, small golden crown, raised stinger tail, huge pincers"),
    # ⚠️ 同上：不寫死「八條腿的蜘蛛身體」會被畫成人形外星人
    "insect_5": (5, "a spider, a round fat spider body with EIGHT long thin spider legs, purple carapace, "
                    "eight small gleaming eyes, a tiny silk web crown, no humanoid body"),
    "insect_6": (6, "an insect god, radiant divine scarab beetle deity, golden chitin plates, halo of shimmering wings, sacred aura"),
    # 職場
    "workplace_1": (1, "an angry entitled customer, arms crossed, pointing finger, shopping bag, furious shouting face, casual clothes"),
    "workplace_2": (2, "a smug bad middle manager in a wrinkled shirt and loose tie, holding a tall stack of paperwork, pointing dismissively"),
    "workplace_3": (3, "an evil company boss in a pinstripe suit, slicked back hair, cigar, gold watch, sneering"),
    "workplace_4": (4, "a greedy landlady in a floral apron, hair curlers, holding a rent contract and an abacus, scowling"),
    "workplace_5": (5, "a conglomerate chairman in a luxurious black suit, silver hair, gold-headed cane, cold smile, floating gold coins"),
    "workplace_6": (6, "a demon lord of capitalism, dark business suit with demon horns and wings, crown of coins, glowing money aura"),
    # 考試
    # ⚠️ 這三隻的主體是「紙／書」不是生物：第一版被 TIER_TAIL 的盔甲字眼帶偏，全變成披甲小怪。
    #    現在走 TIER_TAIL_OBJ，描述也把「身體就是那張紙/那本書」講死。
    "exam_1": (1, "a walking sheet of exam paper, the body IS one flat white sheet of paper with an angry "
                  "cartoon face drawn on it, red pen correction marks, tiny stick arms and legs"),
    "exam_2": (2, "a walking stack of stapled exam papers, the body IS a thick pile of white paper sheets "
                  "with a face on the front page, pencil arms, glaring eyes"),
    "exam_3": (3, "a walking exam booklet, the body IS a thick closed book with a face on the cover, "
                  "red correction marks, tiny arms and legs, ominous grin"),
    "exam_4": (4, "a demon king of entrance exams, robe made of answer sheets, crown of pencils, shield shaped like a scoreboard"),
    "exam_5": (5, "a monstrous figure built from a towering pile of law textbooks, burning red aura, heavy chains"),
    "exam_6": (6, "the education system as an eldritch entity, ranking charts and gears, floating diplomas, one giant central eye, cold institutional aura"),
    # 神殿（西幻）
    "temple_1": (1, "a goblin, green skin, ragged loincloth, crude dagger, pointy ears, cackling"),
    "temple_2": (2, "a skeleton swordsman, rusty sword and round shield, tattered cape, glowing eye sockets"),
    "temple_3": (3, "a werewolf, thick grey fur, torn trousers, sharp claws, howling"),
    "temple_4": (4, "a vampire count, crimson lined cape, pale skin, fangs, aristocratic pose, small bats"),
    "temple_5": (5, "a lich king, skeletal face under an iron crown, frost robes, staff with a soul gem, icy blue necromantic aura"),
    "temple_6": (6, "an apocalypse dragon, black scales, huge wings, molten glowing cracks, breathing fire"),
    # 寶箱怪
    # ⚠️ 寫 "mimic monster" 會被畫成人形小怪、箱子整個不見（第一版六隻全跑掉）。
    #    要講死「**身體就是那個箱子**、開著的蓋子是嘴巴」，並且走 STYLE_NONBIPED。
    "treasure_1": (1, "a mimic chest, the body IS a wooden treasure chest, the open hinged lid is its mouth "
                      "with big square teeth, two small eyes on the lid, a long tongue, tiny stubby legs under the box"),
    "treasure_2": (2, "a mimic chest, the body IS a golden treasure chest, the open lid is its toothy mouth, "
                      "gold coins spilling out, two small eyes on the lid, tiny stubby legs under the box"),
    "treasure_3": (3, "a mimic chest, the body IS a treasure chest encrusted with sparkling diamonds and crystals, "
                      "the open lid is its toothy mouth, two small eyes on the lid, tiny stubby legs under the box"),
    "treasure_4": (4, "a mimic chest, the body IS a silver mithril treasure chest with glowing blue runes on the lid, "
                      "the open lid is its mouth with metal fangs, two small eyes on the lid, tiny stubby legs under the box"),
    "treasure_5": (5, "a mimic chest, the body IS an ancient carved stone treasure chest with moss and runes, "
                      "the open lid is its mouth, warm amber light inside, two small eyes on the lid, tiny stubby legs"),
    "treasure_6": (6, "a mimic chest, the body IS a colossal ornate golden temple-shaped treasure chest, "
                      "the open lid is its huge mouth, jewelled gold ornamentation, two glowing eyes on the lid, "
                      "short stone golem arms at the sides of the box"),
}

# ── 九隻真貓（外觀特徵沿用 gen-cat-portraits.py，換成 Q 版全身冒險者）──
# 重點是**毛色花紋要對得上真貓**，玩家才認得出自己的貓；裝備只給小配件不遮花色。
CATS = {
    "daming":   "a regal tortoiseshell cat with mixed orange, black and cream patches, calm confident matriarch expression, small red captain cape",
    "gege":     "a gentle orange-and-white bicolor cat, orange tabby back with white chest and muzzle, warm friendly smile, small green scarf",
    "meimei":   "a lively orange tabby cat, playful energetic expression, bright sparkling eyes, ears perked up, tiny leather satchel",
    "niuniu":   "a black-and-white cow-pattern cat, crisp black patches on white fur, serious tidy no-nonsense expression, tiny referee whistle on a cord",
    "haji":     "a fluffy cream ragdoll cat with soft brown points and blue eyes, dreamy sleepy expression, extra fluffy fur, small blue ribbon",
    "baobao":   "a small round chubby orange tabby kitten, big pleading eyes, cuddly clingy expression, oversized tiny backpack",
    "youyou":   "a deep-orange tabby cat, relaxed laid-back posture but sharp perceptive narrowed eyes, small brown travel cloak",
    "xiaoan":   "a tortoiseshell cat with orange and dark-brown patches, timid but determined expression, slightly wide nervous eyes, small wooden shield",
    "diandian": "a sleek all-black cat, mysterious enigmatic expression, glowing amber eyes, faint magical purple aura, tiny star pendant",
}
CAT_TAIL = (", a cute miniature cat figure standing on all four paws, tiny adventurer accessories that do not "
            "cover the fur pattern, fluffy tail up, adorable, soft fur texture")

# ── 玩家（射手本人）──────────────────────────────────────────
# idle 與拉弓兩張：戰鬥畫面本來就有 bowPull 狀態，可以直接換圖做出「拉弓」演出。
HEROES = {
    "hero":       "a cute chibi adventurer archer, short hooded forest-green cloak over light leather armor, "
                  "brown leather bracer, quiver of arrows on the back, holding a wooden recurve bow at rest, "
                  "confident friendly smile, androgynous youthful face",
    "hero_shoot": "a cute chibi adventurer archer drawing a wooden recurve bow, arrow nocked and string pulled back, "
                  "short hooded forest-green cloak over light leather armor, brown leather bracer, "
                  "quiver of arrows on the back, focused determined expression, androgynous youthful face, side-on aiming stance",
}


def post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(COMFY + path, data=data, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=90))


def get(path):
    return json.load(urllib.request.urlopen(COMFY + path, timeout=90))


def upload_image(png_bytes, name):
    # multipart 上傳到 ComfyUI input 目錄供 LoadImage 使用（作法同 gen-cat-portraits.py）
    boundary = "----guildch" + uuid.uuid4().hex
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


def build_wf(pos, neg, src_name=None, denoise=1.0):
    # src_name 有值 → img2img（保留來源角色的長相），否則 txt2img
    t2i = src_name is None
    latent = ({"5": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}}}
              if t2i else
              {"1": {"class_type": "LoadImage", "inputs": {"image": src_name}},
               "2": {"class_type": "VAEEncode", "inputs": {"pixels": ["1", 0], "vae": ["4", 2]}}})
    wf = {
        "3": {"class_type": "KSampler", "inputs": {"seed": random.randint(1, 2**31 - 1), "steps": STEPS,
              "cfg": CFG, "sampler_name": SAMPLER, "scheduler": SCHED, "denoise": 1.0 if t2i else denoise,
              "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0],
              "latent_image": ["5", 0] if t2i else ["2", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": pos, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": neg, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "guild_chibi", "images": ["8", 0]}},
    }
    wf.update(latent)
    return wf


def generate(pos, src_name=None, denoise=1.0, neg_extra=""):
    pid = post("/prompt", {"prompt": build_wf(pos, NEG + neg_extra, src_name, denoise),
                           "client_id": str(uuid.uuid4())})["prompt_id"]
    for _ in range(200):
        hist = get(f"/history/{pid}")
        if pid in hist and hist[pid].get("status", {}).get("completed"):
            img = hist[pid]["outputs"]["9"]["images"][0]
            q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img["type"]})
            return urllib.request.urlopen(COMFY + "/view?" + q, timeout=90).read()
        time.sleep(1.5)
    raise RuntimeError("timeout waiting for generation")


def save_cutout(png, outpath):
    from rembg import remove
    im = Image.open(io.BytesIO(png)).convert("RGBA")
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
    # 底部對齊（角色站在地上，置中會讓大小不一的立繪浮起來）
    out.paste(cut, ((CANVAS - nw) // 2, CANVAS - nh - int(CANVAS * PAD)), cut)
    out.save(outpath, "WEBP", quality=90, method=6)


def prep_source(name):
    # 讀已生成的圖 → 白底 RGB（去背後是透明，直接送進 VAE 會變黑底）→ 長邊 1024 PNG
    src = Image.open(os.path.join(OUTDIR, f"{name}.webp")).convert("RGBA")
    flat = Image.new("RGB", src.size, (255, 255, 255))
    flat.paste(src, (0, 0), src)
    s = 1024 / max(flat.size)
    if s < 1:
        flat = flat.resize((int(flat.width * s), int(flat.height * s)), Image.LANCZOS)
    out = io.BytesIO()
    flat.save(out, "PNG")
    return out.getvalue()


def do_one(name, prompt, force=False, src=None, denoise=0.62, style=None, neg_extra=""):
    outpath = os.path.abspath(os.path.join(OUTDIR, f"{name}.webp"))
    if os.path.exists(outpath) and not force:
        print(f"[skip] {name} (已存在)", flush=True)
        return
    print(f"[gen] {name} ...", flush=True)
    src_name = upload_image(prep_source(src), f"guildsrc_{src}.png") if src else None
    png = generate((style or STYLE) + prompt, src_name, denoise, neg_extra)
    save_cutout(png, outpath)
    print(f"  OK -> {outpath}", flush=True)


def run(group, only=None, force=False):
    os.makedirs(OUTDIR, exist_ok=True)
    if group in ("all", "hero"):
        do_one("hero", HEROES["hero"], force)
        # 拉弓姿勢用 **img2img 從 idle 重繪**：兩張都 txt2img 會抽出兩個長得不一樣的射手，
        # 戰鬥中一切換就「閃成別人」。denoise 0.62 換得掉姿勢又留得住長相配色。
        if only != "hero":
            do_one("hero_shoot", HEROES["hero_shoot"], force, src="hero", denoise=0.62)
    if group in ("all", "cats"):
        for cid in ([only] if only and only in CATS else list(CATS)):
            do_one(f"cat_{cid}", CATS[cid] + CAT_TAIL, force)
    if group in ("all", "mobs"):
        for mid in ([only] if only and only in MOBS else list(MOBS)):
            tier, desc = MOBS[mid]
            tail = (TIER_TAIL_OBJ if mid in OBJ_MOBS else TIER_TAIL)[tier]
            head = "" if mid in NO_MOB_HEAD else MOB_HEAD
            style = STYLE_OBJECT if mid in NO_MOB_HEAD else (STYLE_NONBIPED if mid in NONBIPED else None)
            do_one(f"mob_{mid}", head + desc + tail, force, style=style,
                   neg_extra=MOB_NEG.get(mid, ""))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--force"]
    force = "--force" in sys.argv
    grp = args[0] if args else "all"
    one = args[1] if len(args) > 1 else None
    try:
        run(grp, one, force)
        print("DONE", flush=True)
    except Exception as e:
        print(f"FAILED: {e}", flush=True)
        sys.exit(1)
