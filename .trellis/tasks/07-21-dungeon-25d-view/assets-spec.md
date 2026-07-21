# 資產規格 — 地下城 2.5D 房間立繪（七族版・定案）

## 定案方向
- **七族各自文明風格**（非「一套共用換色」）→ 每族一套房間立繪。
- **風格：可愛、不寫實、不恐怖**（繪本感 painterly、chibi/低多邊形童趣，no gore/no horror）。
- **房間只放功能物件**（戰鬥=交叉劍徽、寶箱=寶箱、營地=帳篷…），不放吉祥物，房型一目了然。
- 全自動管線：ComfyUI 生成 → rembg 去背 → 512 WebP → `public/assets/dungeon/`。

## 生成管線（全自動，使用者不需手動）
1. **生成**：ComfyUI API，模型 `DreamShaperXL_Turbo_v2_1.safetensors`
   - KSampler：`dpmpp_sde` / `karras` / steps 8 / cfg 2.0 / denoise 1.0 / 1024×1024
2. **去背**：`scripts/process-tile.py`（rembg u2net）→ 依 alpha 裁切 → 置中 512×512 透明 WebP
3. **放置**：`public/assets/dungeon/room_<family>_<type>.webp`

## 命名
- 房間：`room_<family>_<type>.webp`（例：`room_ghost_battle.webp`）
- family：ghost / mountain / insect / workplace / exam / temple / treasure
- type（11）：entrance / battle / elite_battle / boss_battle / shop / event / trap / chest / rest / stairs / treasure
- 共用退路：`room_<type>.webp`（無族系圖時 fallback）、`room_empty.webp`、SVG/emoji

## 程式對接（待做）
- RoomTile 讀取改為：`room_<family>_<type>` →（缺）`room_<type>` →（缺）`room_empty` →（缺）SVG。
- family 不再用色彩 overlay tint（改為真正的族系立繪）。

## 通用風格區塊（每張前綴，套「可愛不恐怖」）
```
cute stylized isometric 2.5D game asset, a single small floating platform viewed
from high 3/4 top-down angle, painterly FRIENDLY mobile game art, NOT realistic,
NOT scary, NO horror, no gore, kawaii low-poly charm, soft rounded shapes, warm
and inviting. Isolated floating stone platform with rocky underside, centered,
dark simple background, no text, no ui, no people, no character/mascot.
Theme: {族系風格}. On the platform: {功能物件}
```
negative：`realistic, photorealistic, scary, horror, creepy, gore, blood, grim, ugly, text, watermark, ui, multiple platforms, bridges, people, mascot, character, blurry, lowres, deformed`

## 七族風格（{族系風格}）
| family | 名稱草案 | 族系風格 prompt |
|---|---|---|
| ghost | 陰司地宮·黃泉迴廊 | cute Taiwanese folk-temple, little red-and-gold shrine, paper lanterns, candles, warm glow |
| mountain | 魔神山道·迷霧靈嶺 | cozy misty mountain shrine, mossy rocks, sacred pine trees, wooden totems, soft green |
| insect | 蟲巢深淵·百足洞窟 | cute friendly bug-hive, smooth chitin, big leaves, glowing honeycomb, non-gross |
| workplace | 血汗高塔·資本煉獄 | tiny stylized office ruin, cubicle desk, soft neon signs, paper stacks, muted tones |
| exam | 試煉學府·升學煉獄 | cute scholarly study, book mountains, exam papers, pencils, little bell tower |
| temple | 亡者聖殿·骸骨神廟 | cute cartoon gothic stone shrine, arches, candles, friendly cartoon skulls (not scary) |
| treasure | 祕寶金庫·貪婪寶窟 | shiny golden vault, gems, coin piles, sparkling treasure, warm gold |

## 功能物件（{功能物件}，各族共用同一組）
| type | 功能物件 |
|---|---|
| entrance | a stone gateway arch / doorway with two lanterns |
| battle | a round arena floor with a crossed-swords emblem in the center |
| elite_battle | a larger arena with banners and a bold crossed-swords emblem |
| boss_battle | a grand arena with a throne and a glowing crown emblem |
| shop | a cute market stall with striped awning and goods |
| event | a glowing magic rune circle with floating sparkles |
| trap | a cracked floor with (cartoon, non-scary) spikes and a pressure plate |
| chest | a glowing open treasure chest with gold coins |
| rest | a cozy campfire with a small tent and bedroll |
| stairs | a stone staircase going down |
| treasure | a pile of golden treasure and gems |

## 驗證紀錄
- 幽冥戰鬥房測試（`ghost_test_00001_.png`）：可愛不恐怖 + 台灣民俗味 + 2.5D 石台 → 方向確認 ✅
  （該張含小白鬼吉祥物，正式版改為「只放功能物件」）
- 待驗證：rembg 去背輸出乾淨度。
