# Design：山林族 T1～T6 GPT 立繪重製

## Design Boundary

- 來源：Codex built-in image generation。
- 審核區：`.staging/image-generation/gpt-mountain-t1-t6/`。
- 正式卡圖：`public/cards/monsters/{stableId}.webp`。
- 正式戰鬥圖：`public/monsters-battle/{stableId}.webp`。
- 資料文案：`src/data/monsterExpansionCatalog.json`，以及六隻既有怪物使用的 legacy 名稱與素材鏈。

## Identity Model

每一隻怪物是獨立身分：

`mountain × tier × role → identity`

Tier 不代表同一角色的成長階段。共同性只來自山林族的色彩、材質、地景與自然能力語言。

## Visual Axes

### Tier

- T1：路邊山徑、竹木、粗石、普通布革、單一局部自然能力。
- T2：溪谷與獵徑、加工木石、簡單工具、可控風水能力。
- T3：古林與聚落、防具專業化、兩種材料、中型自然能力。
- T4：高山堡寨、稀有礦石與複合裝備、區域級天候。
- T5：傳說山域、唯一神器、古老盟誓與大型地景。
- T6：神話天嶺、法則材料、山河與風雨服從其權能。

### Encounter

- normal：占幅約 40～50%，中性姿態，環境只在局部反應。
- miniBoss：占幅約 60～72%，量體約普通怪 1.25～1.4 倍，主動戰姿。
- boss：占幅約 80～92%，量體約普通怪 1.7～2.2 倍，低角度、全場反應。

## Battle Conversion

- 每張核准卡圖作為對應戰鬥圖 reference。
- 人形目標 3.5～4 頭身，頭部占總高約 25～28%。
- 純怪物將頭部或招牌輪廓放大約 20～25%。
- 原始輸出採純綠 chroma key，再使用既有去背工具產生透明 PNG。
- 正式整合統一輸出 512×512 transparent WebP。

## Naming Migration

- 建立 36 筆 stable-ID 對應表。
- 每筆同時包含：
  - 新怪物名稱
  - 新招牌技能名稱
  - 新素材名稱
- `signatureSummary` 只替換技能名稱前綴，冒號後的機制文字不變。
- 六隻 existing 怪物同步更新 legacy `MONSTERS` 與族群素材鏈。

## Verification

- 每階兩張聯絡表。
- T1～T6 兩張總覽。
- manifest 記錄檔案、bytes、SHA-256 與 prompt 摘要。
- 正式整合腳本驗證 72 個 WebP 的尺寸、格式、透明度與檔案大小。
- 全測試與 production build。

## Rollback

- staging 永久保留核准來源與 manifest。
- 正式資產皆為 Git tracked，可按單一 stable ID 回退。
- 文案改名集中在 catalog 與 legacy 六怪資料，避免改動技能機制。
