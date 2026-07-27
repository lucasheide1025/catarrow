# Design：鬼怪族 T1 GPT 立繪重製

## Generation Boundary

使用 built-in `image_gen` 逐張生成，不使用 CLI/API fallback，也不直接生成到正式 `public/`。每張候選圖先留在 Codex generated-images 位置，再複製到：

```text
.staging/image-generation/gpt-ghost-t1/cards/
.staging/image-generation/gpt-ghost-t1/battle/
.staging/image-generation/gpt-ghost-t1/metadata/
```

只有使用者核准的候選圖才進入後續階段。候選圖不得覆寫現有 T1 WebP。

## Visual Reference Roles

已核准 T6 卡圖是「系列品質、線條、上色、臉部完成度、種族色彩」參考，不是 T1 服裝或特效密度參考。

| T1 sample | Primary T6 reference | Reference role |
|---|---|---|
| 暮燈旅者 | `public/cards/monsters/ghost_t6_normal_a.webp` | 男性臉部品質、銀髮、冷藍／銀灰系列語言 |
| 鏡幕幽姬 | `public/cards/monsters/ghost_6.webp` | 女性臉部品質、銀白長髮、冷紫／霧銀系列語言 |
| 星霧絨獸 | `public/cards/monsters/ghost_t6_normal_b.webp` | 獸型渲染品質、深藍絨毛、幽光系列語言；不得沿用馬型物種 |

每個 prompt 都明確要求「降 Tier，不複製 T6 神話裝備」，避免再次把 T1 生得像 T6。

## First Approval Gate

第一輪只生成三張普通角色卡圖，每位一個候選：

1. 暮燈旅者
2. 鏡幕幽姬
3. 星霧絨獸

三張分開呼叫 built-in image generator，因為它們是不同角色而非同 prompt 變體。生成後建立聯絡表並由使用者集中核准：

- 美術媒材與系列一致性；
- 男／女／獸三種身份；
- T1 華麗度是否足夠克制；
- 3:4 卡片 UI 下的臉部與輪廓辨識；
- 無文字、卡框或 UI。

若方向不對，只對單一問題做一次針對性迭代，不同時改多個變數。

## Remaining Generation Flow

第一輪三張卡圖核准後：

1. 以相同 T1 標準生成三張領袖卡圖。
2. 六張卡圖全部核准。
3. 每位角色以自己的卡圖作 identity reference，逐張生成綠幕戰鬥版。
4. 使用 imagegen skill 內建 chroma-key helper 去背；若複雜毛髮／魂霧無法通過驗證，停止並詢問是否使用需 API key 的原生透明 fallback。
5. 12 張圖全部核准後才轉正式 WebP 並覆寫穩定路徑。

## Prompt Contract

每張卡圖 prompt 使用 `stylized-concept`：

- Asset type：mobile fantasy RPG collectible card scene art。
- Style：high-detail Japanese fantasy RPG, 2D anime semi-painterly。
- Composition：portrait 3:4，角色為主，完整或 3/4 身，臉部清楚，四周保留 UI 安全區。
- T1 constraints：1～2 主色、簡潔單層服裝、普通材質、單一小型代表物、少量不穩定魂火／靈霧。
- Avoid：T6 神話甲冑、皇冠、大型神器、多層金屬飾品、密集晶體、巨大光環、滿版粒子、Q 版、照片寫實、3D、公仔、恐怖血腥、文字、卡框、UI、水印。

## Integration and Rollback

- 保持 `ghost_t1_normal_a`、`ghost_1`、`ghost_t1_normal_b`、`ghost_t1_mini_a`、`ghost_t1_mini_b`、`ghost_t1_boss`。
- 卡圖輸出到 `public/cards/monsters/<stable-key>.webp`。
- 戰鬥圖輸出到 `public/monsters-battle/<stable-id>.webp`。
- 不修改收藏資料或 gameplay。
- 正式替換由獨立、可重現的整合腳本完成，Git 保留舊圖供回滾。

## 3×3 Calibration Pivot

The previously generated leader and battle candidates are retained as rejected research evidence. Before any further production generation, create nine card-scene calibration images under:

```text
.staging/image-generation/gpt-ghost-calibration/
```

All nine use the same ghost-family palette and 2D anime semi-painterly medium, but each is an independent test monster.

### Tier budget

| Tier | Budget |
|---|---|
| T1 | primitive/common materials, one weak ability cue, small local setting, large visual calm |
| T3 | clear combat specialization, two materials, family motif, controlled medium ability, developed encounter setting |
| T6 | mythic material language, unique supernatural law/artifact, field-changing ability, monumental setting |

### Encounter composition

| Encounter | Composition |
|---|---|
| normal | standard scale, open readable stance, one focal ability, substantial negative space |
| miniBoss | 1.25–1.4× perceived mass, wider or taller silhouette, active attack pose, signature ability dominates one region |
| boss | 1.7–2.2× perceived mass, frame-dominating silhouette, low-angle or oppressive pose, environment visibly reacts |

No formal IDs, product paths or existing character references are used. The contact sheet must arrange columns as normal／miniBoss／boss and rows as T1／T3／T6.
