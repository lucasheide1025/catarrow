# 議會廳採集系統 — 圖片生成提示詞

> 使用 Gemini 或其他 AI 圖片生成工具時，每次只貼一條提示詞，不要貼整份文件。

---

## 🎨 風格基底（所有圖片共用）

```
Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill with visible brush texture, warm muted pastel palette, yuru-kawaii aesthetic, reminiscent of Chiikawa or Sumikko Gurashi, no text no letters no watermarks
```

---

## 📐 尺寸規格

| 類型 | 尺寸 | 用途 |
|------|------|------|
| 戰鬥場景背景 | 800×500px 橫向 | 上半場景區底圖 |
| 障礙物 | 256×256px 正方形 | 場景中央大圖 |
| 工人貓 | 200×300px 直向 | 場景底部角色 |

---

## 一、戰鬥場景背景 Background（6 張）

存放路徑：`public/council/bg/`

---

### BG-01 礦山 `mine.webp`

```
Underground mine cavern interior, rough stone tunnel walls embedded with glittering crystal clusters and veins of orange ore, thick wooden support beams crossing the ceiling, two warm amber lanterns hanging on iron hooks casting a soft glow, a rusted ore cart on rails in the left foreground, scattered loose stones and pebbles on the dirt floor, faint mist drifting near the ground, rich earth tones of deep brown and amber with dark charcoal shadows, mysterious but cozy underground adventure atmosphere, isometric 45-degree low angle view. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill with visible brush texture, warm muted pastel palette, yuru-kawaii aesthetic, reminiscent of Chiikawa or Sumikko Gurashi, no text no letters no watermarks. 800×500px horizontal.
```

---

### BG-02 農地 `farm.webp`

```
Open farmland field in soft morning light, neat rows of leafy green vegetable crops and melon vines stretching into the distance, a weathered wooden fence on the right side, two wooden buckets and a shovel leaning against the fence, irrigation channel running between the crop rows, a small stone path through the middle, golden morning sunlight filtering through light clouds with a warm hazy glow, cheerful countryside atmosphere, distant rolling hills with pastel green and yellow tones, isometric 45-degree view. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill with visible brush texture, warm muted pastel palette, yuru-kawaii aesthetic, reminiscent of Chiikawa or Sumikko Gurashi, no text no letters no watermarks. 800×500px horizontal.
```

---

### BG-03 海港 `harbor.webp`

```
Wooden fishing dock at dusk, thick wooden pier planks with coiled ropes and iron anchors, two small wooden fishing boats moored at the side with folded sails, hanging fish lanterns on bamboo poles glowing warm orange, dense ocean fog rolling in from the dark teal sea background, reflections shimmering on calm dark water below the dock, crab traps and woven nets stacked in the corner, rich deep blue and teal palette with warm lantern accent light, calm mysterious harbor atmosphere, isometric 45-degree view. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill with visible brush texture, warm muted pastel palette, yuru-kawaii aesthetic, reminiscent of Chiikawa or Sumikko Gurashi, no text no letters no watermarks. 800×500px horizontal.
```

---

### BG-04 獵場 `hunting.webp`

```
Ancient dense forest hunting ground, massive gnarled tree trunks with thick bark and exposed roots, lush fern undergrowth and wild mushrooms on the mossy floor, two glowing fireflies drifting in the air, filtered golden-green light breaking through a dense leaf canopy above, a narrow dirt path winding through the trees, fallen leaves scattered on the ground, deep emerald and forest green palette with golden light accents, enchanting mysterious forest atmosphere, isometric 45-degree view. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill with visible brush texture, warm muted pastel palette, yuru-kawaii aesthetic, reminiscent of Chiikawa or Sumikko Gurashi, no text no letters no watermarks. 800×500px horizontal.
```

---

### BG-05 貓貓市集 `market.webp`

```
Charming village market street at dusk, colorful wooden vendor stalls with fabric awnings in red and orange, stone cobblestone street, hanging round paper lanterns glowing warm yellow, shelves of goods and woven baskets visible in the stalls, wooden buildings with tiled roofs lining both sides, a large round iron cooking pot on a stone stand in the center background, warm evening sky gradient of orange and purple above, lively festive marketplace atmosphere, isometric 45-degree view. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill with visible brush texture, warm muted pastel palette, yuru-kawaii aesthetic, reminiscent of Chiikawa or Sumikko Gurashi, no text no letters no watermarks. 800×500px horizontal.
```

---

### BG-06 露天倉庫 `warehouse.webp`

```
Large indoor warehouse at night, tall wooden shelving units stretching to a high ceiling packed with wooden crates and barrels of various sizes, stone floor with scattered packaging straw, two small rectangular skylights in the ceiling letting in pale blue moonlight, dust motes floating in the air, deep blue-purple night palette with soft moonlight pools on the floor, quiet mysterious storage atmosphere, neat stacks of boxes in the foreground, isometric 45-degree view. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill with visible brush texture, warm muted pastel palette, yuru-kawaii aesthetic, reminiscent of Chiikawa or Sumikko Gurashi, no text no letters no watermarks. 800×500px horizontal.
```

---

## 二、障礙物 Obstacle（36 張）

存放路徑：`public/council/obs/`  
格式：`{建築}_{等級}.webp`

> 等級強度說明：common 可愛輕鬆 → rare 明顯問題 → elite 嚴重障礙 → fierce 危機四伏 → boss 重大威脅 → mythic 神秘魔法力量

---

### ⛏️ 礦山 Mine

#### OBS-mine-01 入口碎石堆 `mine_common.webp` [普通]
```
A cute pile of grey and brown rocks of various sizes stacked in a slightly wobbly tower, small pebbles rolling out from the base, soft round rock shapes with smooth watercolor texture, pale grey and warm brown tones, centered on white background, simple and charming. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-mine-02 礦道積水 `mine_rare.webp` [稀有]
```
A flooded mine shaft puddle scene from above angle, dark groundwater spreading across a stone floor with gentle ripples forming circular rings, two droplets falling from an unseen ceiling above, subtle reflections of amber light in the dark water surface, cool grey-blue water tones against dark stone texture, slightly eerie but cute. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-mine-03 礦車壞軸 `mine_elite.webp` [精英]
```
A rusted old mine cart tilted sideways with one wheel broken and fallen off, scattered dark ore chunks spilling out around it on the ground, visible cracked wooden axle underneath, warm rusty orange and brown tones, slightly dramatic angle as if a problem just occurred, on white background. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-mine-04 礦燈全滅 `mine_fierce.webp` [猛獸]
```
Four extinguished mine lanterns hanging in a row against a deep dark background, each lantern cold and dark with a tiny fading ember glow remaining inside, thin wisps of smoke curling from snuffed wicks, dark charcoal and slate grey palette with a single dim amber accent, dramatic oppressive darkness atmosphere. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-mine-05 頂板裂縫 `mine_boss.webp` [首領]
```
A dramatic jagged crack splitting across a stone mine ceiling, small rocks and dust chips falling downward along the crack line, the crack glowing faintly with a deep red-orange energy from inside the rock, fine dust particles floating in the air, dark grey stone texture with ominous warm crack glow, tense and dangerous atmosphere. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-mine-06 地脈封印 `mine_mythic.webp` [神話]
```
A large glowing magical seal pattern carved into a stone rock face, ancient circular rune design radiating purple and golden energy, magical sparkles and light particles floating outward from the seal, the surrounding rock appears crystallized and frozen, mystical and powerful supernatural atmosphere, deep purple and gold palette with white light accents. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

---

### 🌿 農地 Farm

#### OBS-farm-01 雜草叢生 `farm_common.webp` [普通]
```
A cheerful but unruly tangle of wild weeds and dandelions growing over and smothering a small vegetable patch, round leaves and fluffy white dandelion seeds floating in the air, bright green overgrown plants in soft muted tones, slightly messy but still cute and round-shaped, centered composition on white background. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-farm-02 菜畦積水 `farm_rare.webp` [稀有]
```
A flooded vegetable garden bed with muddy brown water covering the soil, small wilted leafy plants barely poking above the water surface, one bucket overflowing at the edge causing the flood, water droplets splashing, soft brown and dark green tones with reflective water surface. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-farm-03 板結土壤 `farm_elite.webp` [精英]
```
Hardened cracked clay soil viewed from slight angle, deep geometric cracks forming a mosaic pattern across the dirt surface, the soil appearing dry and pale grey-brown, a tiny seedling struggling to push through one of the cracks, parched earth texture with fine dust details, sun-baked atmosphere. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-farm-04 農具全鏽 `farm_fierce.webp` [猛獸]
```
A collection of heavily rusted farming tools - a hoe, a trowel, and a pair of shears - piled together, all surfaces covered in thick orange-red rust spots and flaking, looking completely unusable, warm rust orange and dark brown color palette, slightly sad neglected farm tools still cute in yuru-kawaii style. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-farm-05 土壤污染 `farm_boss.webp` [首領]
```
A patch of farmland soil with dark toxic-looking black and purple splotches spreading across it, withered brown plant stems sticking up from the poisoned earth, small ominous dark liquid bubbles on the surface, eerie glowing purple tint emanating from the contaminated soil, dramatic threatening agricultural crisis atmosphere. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-farm-06 枯萎詛咒 `farm_mythic.webp` [神話]
```
Multiple farm crops withering simultaneously, their leaves turning dark purple and black while magical dark cursed energy in swirling wisps flows around their stems, a faint glowing purple magic circle visible in the soil beneath them, dramatic contrast between dying plants and supernatural energy, mystical cursed atmosphere with soft dark palette. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

---

### ⚓ 海港 Harbor

#### OBS-harbor-01 港口濃霧 `harbor_common.webp` [普通]
```
Thick white sea fog rolling in over a wooden dock, the mist so dense that only the nearest dock planks and one rope cleat are visible, the dock lantern light appearing as a soft hazy glow hidden inside the white fog, peaceful but disorienting atmosphere, white and pale grey fog tones with soft warm light. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-harbor-02 惡浪衝擊 `harbor_rare.webp` [稀有]
```
A large dramatic ocean wave crashing against a wooden dock railing, the wave curl foaming white at the top, water splashing upward and droplets scattering, the wooden railing bending slightly from impact, deep teal and dark blue wave colors with white foam accents, dynamic motion feeling. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-harbor-03 纏船漁網 `harbor_elite.webp` [精英]
```
A small wooden fishing boat completely tangled and wrapped in a large brown fishing net, the net ropes twisted around the mast and hull from all sides, some rope ends dragging in dark water, the boat appears immobilized and helpless, warm brown and dark teal palette, surprisingly cute despite the predicament. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-harbor-04 擱淺船隻 `harbor_fierce.webp` [猛獸]
```
A small wooden fishing boat tilted awkwardly on its side, stuck on jagged dark rocks at low tide, the hull pressed against rocks with a visible crack, water swirling in a gentle whirlpool around the rocks, dramatic but cute disaster scene, rocky grey-brown reef with dark teal water, exposed keel visible. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-harbor-05 閘門故障 `harbor_boss.webp` [首領]
```
A large wooden harbor lock gate sealed shut, thick rusted iron bolts jammed across it, chains wrapped around the gate handles, the wood warped and swollen from water damage, dark water pressing on one side visible through a tiny crack, ominous and imposing barrier blocking all passage, dark brown and rust palette. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-harbor-06 海底異常湧泉 `harbor_mythic.webp` [神話]
```
An underwater magical upwelling spring scene viewed from above, glowing aquamarine and deep blue water churning in a spiral vortex pattern, strange bioluminescent bubbles floating upward from the depths, magical sea energy radiating outward in rings, supernatural ocean phenomenon, brilliant blues and teals with glowing light effects. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

---

### 🏕️ 獵場 Hunting

#### OBS-hunting-01 蟲害草叢 `hunting_common.webp` [普通]
```
A dense bush of wild grass and weeds with many small round cartoon insects hiding inside - beetles, beetles and ladybugs peeking out, some flying around, the plants looking slightly disheveled from bug activity, bright green with small colorful insect accents, cheerful bug infestation scene. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-hunting-02 擋路蜂巢 `hunting_rare.webp` [稀有]
```
A large papery wasp nest hanging from a tree branch directly blocking a forest path, small round cartoon bees and wasps buzzing around it in circles, the nest textured with layered grey-brown wavy patterns, the trail completely blocked behind it, honey-yellow and grey-brown palette with small animated bee details. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-hunting-03 毒蟲巢穴 `hunting_elite.webp` [精英]
```
A large underground insect burrow entrance in forest soil, dark purple toxic ooze seeping from the hole opening, small cartoon centipedes and larvae crawling in and out, dark poisonous liquid spreading in a puddle around the entrance, ominous forest floor scene, dark earthy tones with toxic purple and green accents. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-hunting-04 蠍子埋伏 `hunting_fierce.webp` [猛獸]
```
Multiple small but menacing cartoon scorpions hiding in sandy rocky terrain, their curled tails raised in warning position, peeking out from under rocks and crevices across the whole scene, warm sandy brown and orange palette, the scorpions have cute but fierce expressions, danger lurking everywhere. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-hunting-05 巨型蛛網 `hunting_boss.webp` [首領]
```
An enormous intricate spiderweb spanning across multiple trees and blocking the entire forest path, the web strands thick and silver-white with tiny dew droplets, a large round cute-but-scary spider sitting at the center, some trapped leaves visible in the web, pale silver and dark forest green background palette, dramatic but still yuru-kawaii. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-hunting-06 蟲群封地 `hunting_mythic.webp` [神話]
```
A swirling supernatural swarm of glowing magical insects forming a luminous tornado-like column, the bugs emitting soft golden-green bioluminescent light, an ancient insect deity sigil glowing at the center of the swarm, magical energy crackling around the edges, the entire scene feels like a sacred insect ritual, otherworldly and mystical. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

---

### 🛒 貓貓市集 Market

#### OBS-market-01 奧客糾紛 `market_common.webp` [普通]
```
A small round cartoon troublemaker character (not a cat, not a person - an abstract yuru-kawaii creature) standing in front of a market stall with arms raised and an angry frowning expression, the stall owner peeking nervously from behind the counter, simple merchant booth background, warm orange and brown market tones, relatable and slightly comedic scene. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-market-02 價格紛爭 `market_rare.webp` [稀有]
```
A large price tag with an upward arrow floating dramatically above a market stall, the price tag glowing with an assertive orange aura, coins flying through the air around it, a simple yuru-kawaii market booth in the background looking overwhelmed, warm yellow-orange price crisis atmosphere, exaggerated cute economic tension. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-market-03 攤位搶占 `market_elite.webp` [精英]
```
Three market stalls completely occupied and overflowing with goods belonging to one aggressive seller who has spread their merchandise across all of them, a large imposing presence dominating the central market area, neighboring stalls pushed aside and empty, bold orange and red palette showing dominance, comic but slightly villainous market situation. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-market-04 惡意漲租 `market_fierce.webp` [猛獸]
```
A large intimidating scroll or contract document floating upright with a red stamp on it, surrounded by small coin bags stacking up dramatically around it, dark oppressive shadow emanating from the contract, small market stalls looking shrunken and threatened in the background, deep burgundy and gold villain merchant aesthetic. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-market-05 市場壟斷 `market_boss.webp` [首領]
```
An enormous abacus and scale balance dominating the center, surrounded by chains linking together all the market stall signs, a dramatic dark silhouette of a large merchant figure looming in background shadows controlling everything, the chains glowing with controlling energy, dark brown and gold monopoly power atmosphere. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-market-06 財閥入侵 `market_mythic.webp` [神話]
```
A massive golden coin tower radiating powerful aura energy, surrounded by miniaturized market stalls being absorbed into the golden glow, dramatic rays of golden light bursting outward, an imposing merchant empire icon at the very top of the tower, god-like financial domination atmosphere, gold and deep purple luxury villain palette. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

---

### 📦 露天倉庫 Warehouse

#### OBS-warehouse-01 散落貨物 `warehouse_common.webp` [普通]
```
Wooden crates and cardboard boxes scattered and tumbled across a warehouse floor in disarray, some lids open with contents spilling out, small packages rolling away, warm brown wooden box tones on a pale floor, messy but still organized enough to look cute, cheerful warehouse chaos scene. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-warehouse-02 通道堵塞 `warehouse_rare.webp` [稀有]
```
A narrow warehouse aisle completely blocked by a tall unstable tower of stacked boxes and crates reaching to the ceiling, the stack leaning slightly with one box about to topple, absolutely no passage visible, a small arrow-shaped sign pointing at the blockage in a resigned way, muted grey and brown tones. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-warehouse-03 貨架倒塌 `warehouse_elite.webp` [精英]
```
Three tall wooden warehouse shelving units fallen in a chain domino sequence, goods and boxes sliding and tumbling off the tilted shelves, some shelves leaning against each other, the scene mid-collapse with items frozen in the air, dramatic diagonal composition, warm brown wood tones with scattered colorful package details. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-warehouse-04 大量庫損 `warehouse_fierce.webp` [猛獸]
```
A warehouse area where half the inventory appears damaged - boxes crushed, crates cracked, packages torn open with contents scattered, a clipboard with an urgent checklist hovering above showing the scale of damage, the scene looking overwhelmed with loss assessment chaos, muted dusty tones with red warning accents. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-warehouse-05 全庫封鎖 `warehouse_boss.webp` [首領]
```
The entire entrance of a large warehouse sealed shut by a massive glowing purple magical barrier, the barrier forming an impenetrable wall of energy across the doorway, chains and padlocks also wrapped around the doors for extra effect, dark mysterious energy pulsing from the barrier, deep indigo and purple seal magic palette. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

#### OBS-warehouse-06 龍守古寶 `warehouse_mythic.webp` [神話]
```
A small but majestic ancient dragon coiled atop a pile of golden treasure and ancient artifact boxes in the deepest darkest corner of a warehouse, the dragon glowing with soft golden-purple aura, treasure glinting beneath it, ancient storage crates surrounding the pile as if the warehouse was built around this hoard, mythical guardian atmosphere. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii aesthetic, no text no letters no watermarks. 256×256px square.
```

---

## 三、工人貓 Worker Cat（6 張）

存放路徑：`public/council/cat/`

> 每隻貓使用 Chiikawa / Sumikko Gurashi 風格：圓頭大眼、小短腿、全身立像（full body）、白色或透明背景

---

### CAT-01 礦工貓 `mine.webp`

```
A tiny round-headed cute cat character standing upright in full body view, wearing a yellow hard mining helmet with a small round headlamp on the front, a simple brown workman vest over a white undershirt, sturdy little boots, holding a small pickaxe in one paw with a determined cheerful expression, transparent or plain white background, centered full body portrait. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii Chiikawa-style cat character, no text no letters no watermarks. 200×300px vertical portrait.
```

---

### CAT-02 農夫貓 `farm.webp`

```
A tiny round-headed cute cat character standing upright in full body view, wearing a wide floppy straw hat with a small flower tucked in the brim, light green denim overalls over a cream shirt, small rubber boots with soil stains, holding a tiny wooden hoe tool, cheerful relaxed farming expression, transparent or plain white background, centered full body portrait. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii Chiikawa-style cat character, no text no letters no watermarks. 200×300px vertical portrait.
```

---

### CAT-03 漁夫貓 `harbor.webp`

```
A tiny round-headed cute cat character standing upright in full body view, wearing a classic navy blue sailor hat with a small anchor badge, a light blue rain slicker jacket and waterproof pants, short rubber boots, holding a small fishing rod with a tiny fish dangling from the line, happy fishing expression, transparent or plain white background, centered full body portrait. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii Chiikawa-style cat character, no text no letters no watermarks. 200×300px vertical portrait.
```

---

### CAT-04 獵人貓 `hunting.webp`

```
A tiny round-headed cute cat character standing upright in full body view, wearing a dark green hooded cloak with the hood up framing the face, forest-brown leather tunic and pants, knee-high leather boots, holding a small wooden bow with a tiny arrow nocked, alert cautious expression with big watchful eyes, transparent or plain white background, centered full body portrait. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii Chiikawa-style cat character, no text no letters no watermarks. 200×300px vertical portrait.
```

---

### CAT-05 商人貓 `market.webp`

```
A tiny round-headed cute cat character standing upright in full body view, wearing a round merchant beret cap in deep burgundy, a cozy cream-colored coat with large pockets, carrying a small open basket of goods in one arm, a coin pouch hanging from the belt, friendly enthusiastic salesperson expression with a big smile, transparent or plain white background, centered full body portrait. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii Chiikawa-style cat character, no text no letters no watermarks. 200×300px vertical portrait.
```

---

### CAT-06 倉管貓 `warehouse.webp`

```
A tiny round-headed cute cat character standing upright in full body view, wearing a white safety hard hat with an orange stripe, a neat light purple vest with small chest pockets, dark work trousers, sturdy work shoes, holding a clipboard in one paw and a pen in the other, serious focused inspector expression with slightly furrowed brows but still cute, transparent or plain white background, centered full body portrait. Japanese cozy picture book illustration style (ehon-style), soft colored pencil outlines, hand-painted watercolor fill, warm muted pastel palette, yuru-kawaii Chiikawa-style cat character, no text no letters no watermarks. 200×300px vertical portrait.
```

---

## 📁 完整檔案清單

```
public/
└── council/
    ├── bg/
    │   ├── mine.webp
    │   ├── farm.webp
    │   ├── harbor.webp
    │   ├── hunting.webp
    │   ├── market.webp
    │   └── warehouse.webp
    ├── obs/
    │   ├── mine_common.webp
    │   ├── mine_rare.webp
    │   ├── mine_elite.webp
    │   ├── mine_fierce.webp
    │   ├── mine_boss.webp
    │   ├── mine_mythic.webp
    │   ├── farm_common.webp
    │   ├── farm_rare.webp
    │   ├── farm_elite.webp
    │   ├── farm_fierce.webp
    │   ├── farm_boss.webp
    │   ├── farm_mythic.webp
    │   ├── harbor_common.webp
    │   ├── harbor_rare.webp
    │   ├── harbor_elite.webp
    │   ├── harbor_fierce.webp
    │   ├── harbor_boss.webp
    │   ├── harbor_mythic.webp
    │   ├── hunting_common.webp
    │   ├── hunting_rare.webp
    │   ├── hunting_elite.webp
    │   ├── hunting_fierce.webp
    │   ├── hunting_boss.webp
    │   ├── hunting_mythic.webp
    │   ├── market_common.webp
    │   ├── market_rare.webp
    │   ├── market_elite.webp
    │   ├── market_fierce.webp
    │   ├── market_boss.webp
    │   ├── market_mythic.webp
    │   ├── warehouse_common.webp
    │   ├── warehouse_rare.webp
    │   ├── warehouse_elite.webp
    │   ├── warehouse_fierce.webp
    │   ├── warehouse_boss.webp
    │   └── warehouse_mythic.webp
    └── cat/
        ├── mine.webp
        ├── farm.webp
        ├── harbor.webp
        ├── hunting.webp
        ├── market.webp
        └── warehouse.webp
```

**合計：6 + 36 + 6 = 48 張**
