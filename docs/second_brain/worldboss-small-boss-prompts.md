# 🎨 世界王六族小王 — GPT/Midjourney 生圖提示詞

> 用途：六大族改版新增的 6 隻「小王」（T1~T3 代表）目前暫時借用同族大王的舊圖，這份文件提供完整提示詞，方便直接複製貼上生圖。生完圖後檔名請存成 `public/worldboss/{bossKey}.webp`（見下方每隻王的 bossKey），系統會自動優先讀取真實圖片，找不到才會 fallback 回像素圖。
>
> 風格基準：延續現有 12 隻世界王的調性——半寫實/精緻插畫風的 RPG boss 角色立繪，暗色調氛圍背景，帶點台灣民俗/都市傳說的幽默感（不是純恐怖，是「好笑又有點毛」的那種），構圖上半身或全身皆可、角色需要有清楚的輪廓方便疊加在深色背景 UI 上使用。

---

## 通用風格前綴（建議每個提示詞開頭都加這段）

```
Semi-realistic painterly digital illustration of a game boss character, dark fantasy RPG art style,
dramatic atmospheric lighting, detailed character design with clear silhouette,
Taiwanese folklore-inspired, slightly comedic yet eerie mood, archery-gym game aesthetic,
vertical portrait composition, high detail, moody color grading
```

---

## 1. 纏身女鬼・夜半哭聲（bossKey: `ghost_boss_small`）

**族群**：鬼怪族小王｜**配色**：主色 `#1e1b4b`（深靛藍夜色），強調色 `#818cf8`（幽魂紫光）

```
[通用風格前綴], a young female ghost with long messy black hair covering half her face,
pale translucent skin with a faint indigo-purple glow, wearing a tattered white/grey traditional dress,
floating slightly above the ground with no visible feet, one hand reaching out as if asking for something,
melancholic but not overtly scary expression, faint tears of light,
background: dark indigo night archery range with faint mist, purple ghost-light rim lighting on her silhouette,
color palette dominated by deep indigo #1e1b4b and soft violet glow #818cf8
```

---

## 2. 山魈頭領・迷霧引路（bossKey: `forest_boss_small`）

**族群**：山林族小王｜**配色**：主色 `#14532d`（深綠林），強調色 `#86efac`（淺綠光）

```
[通用風格前綴], a mischievous forest spirit resembling a small mountain goblin/fox-like creature,
covered in green moss and vines, glowing green eyes, mysterious playful grin,
holding a twisted wooden staff or vine, standing in a misty mountain forest path that loops back on itself,
surrounded by faint will-o'-the-wisp lights, trickster energy,
background: deep forest green #14532d with soft glowing green mist #86efac,
whimsical but slightly unsettling atmosphere
```

---

## 3. 蜈蚣蜂王・夏日惡夢（bossKey: `poison_boss_small`）

**族群**：毒蟲族小王｜**配色**：主色 `#451a03`（焦褐土色），強調色 `#fcd34d`（毒液黃）

```
[通用風格前綴], a chimeric summer-insect creature combining centipede segments and hornet wings,
glossy dark carapace with yellow warning stripes, multiple small glowing yellow eyes,
translucent buzzing wings, faint dripping venom with a yellow-green glow,
aggressive but almost comically over-the-top "summer pest" design,
background: dry summer heat haze in burnt umber #451a03 with venom-yellow accent glow #fcd34d,
humid oppressive atmosphere
```

---

## 4. 奧客糾察隊長・投訴連環信（bossKey: `office_boss_small`）

**族群**：職場族小王｜**配色**：主色 `#450a0a`（暗紅警示），強調色 `#fca5a5`（淡紅光）

```
[通用風格前綴], an exaggerated angry customer/complainer character in business-casual attire,
holding a stack of endless printed complaint letters/receipts spilling out like a scroll,
red angry aura, exaggerated furrowed brow and open shouting mouth, comically oversized name tag,
one hand pointing accusingly forward, satirical office-life demon vibe,
background: dim fluorescent office lighting in deep red #450a0a with soft warning-red glow #fca5a5,
darkly comedic corporate-hell atmosphere
```

---

## 5. 期末考魔王・熬夜復仇者（bossKey: `exam_boss_small`）

**族群**：考試族小王｜**配色**：主色 `#2e1065`（深紫夜讀），強調色 `#c4b5fd`（淡紫光）

```
[通用風格前綴], a sleep-deprived exam-demon character with dark under-eye circles glowing faintly purple,
wearing a wrinkled school uniform or academic robe, surrounded by floating exam papers covered in red X marks,
holding a giant red pen like a weapon, exhausted yet menacing expression, coffee-stain motifs,
chaotic swirling equations and question marks in the background,
background: deep study-night purple #2e1065 with soft lavender glow #c4b5fd,
frantic all-nighter atmosphere
```

---

## 6. 狼人首領・月圓獵殺（bossKey: `western_boss_small`）

**族群**：西方怪物族小王｜**配色**：主色 `#0c1a0c`（深夜森林黑綠），強調色 `#4ade80`（月光綠）

```
[通用風格前綴], a lean feral werewolf leader mid-transformation, standing on two legs with sharp claws,
grey-brown fur with glowing green eyes, torn clothing remnants, howling pose under a full moon,
muscular but leaner/smaller build than a typical "final boss" wolf (this is the weaker pack leader, not the alpha),
background: dark western-fantasy forest at night in near-black green #0c1a0c,
full moon casting a moonlight-green glow #4ade80 across the silhouette,
primal hunting atmosphere
```

---

## 注意事項

- 生完圖後如果角色跟既有大王（例如 `ghost_boss.webp` 的怨靈大君）風格差太多，建議把大王的圖也一併丟給 AI 當參考圖，確保同族兩隻王的畫風一致。
- 六隻小王的體型/氣勢建議都比對應大王「弱一號」——構圖上可以站姿更收斂、光效更少、體型稍小，跟大王做出強度上的視覺區隔。
- 存檔路徑：`public/worldboss/ghost_boss_small.webp`、`public/worldboss/forest_boss_small.webp`、`public/worldboss/poison_boss_small.webp`、`public/worldboss/office_boss_small.webp`、`public/worldboss/exam_boss_small.webp`、`public/worldboss/western_boss_small.webp`。
