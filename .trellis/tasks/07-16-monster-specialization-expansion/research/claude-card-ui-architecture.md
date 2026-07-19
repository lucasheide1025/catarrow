# C4 — 卡片 UI 資訊架構（252 卡）盤點 + 推薦架構

> 唯讀盤點 + 設計,未修改任何 src。完成後交 Codex 審核,由 Codex 決定是否讓 Claude 實作獨立卡片 UI 元件。
> 機器可讀分類 schema：`claude-card-ui-schema.json`。

## 0. 現有卡片系統盤點

| 面向 | 現況 | 檔案 |
|---|---|---|
| 主收藏 UI | `CardCollection.jsx`(821行)：**只渲染已擁有卡**,扁平單一 grid **一次全渲染**,分類按**屬性(HP/ATK/DEF/世界王)** | CardCollection.jsx |
| 卡片資料/加成 | FAMILY_STAT、TIER_CARD_BONUS、STAR_UPGRADE_COST(升滿15張)、MAX_EQUIPPED_PER_STAT=3、MAX_WB_EQUIPPED=3 | monsterCards.js(97) |
| 世界王卡 | 獨立卡池 WB_CARDS(24)，`wbCards:{bossKey}`，可設稱號 | worldBossCards.js |
| 裝備 | HP/ATK/DEF 各 3 格 + 世界王 3 格;`equipped:[]`(新格式 {key,source}) | CardCollection + db.js |
| 升星 | duplicates 累積,`upgradeCard`,`canUpgradeStar` | monsterCards + db.js |
| 卡包開啟 | `GachaMachine.jsx` `CardResult({cardId,isNew})` | GachaMachine.jsx |
| 圖鑑跳轉 | MemberMonsterDex(301)/MemberDex(572) 用 cards 統計 | — |
| 首次/重複 | 卡有 `duplicates`;gacha 有 `isNew`(單次),**無持久「新卡紅點/未讀」** | — |
| 圖片 | `<img>` 三段 fallback(`/cards/monsters/{id}` → `/monsters-battle/` → `/monsters/` → emoji),**無懶載入** | MonsterArt/WorldBossArt |
| 資料模型 | Firestore `cards:{[monsterId]}`+`wbCards:{[bossKey]}`+`equipped:[]`,`subscribeCardCollection` | db.js:3366 |
| 實際卡圖 | `public/cards/monsters`=**36**張、`public/cards/worldboss`=24張(60 隻中 treasure 等靠 fallback) | — |

## 1. 252 卡加入後的問題評估

| 問題 | 現況風險 | 對策方向 |
|---|---|---|
| **一次渲染過多** | 扁平 grid 全渲染 → 252 DOM | **分組**：一次只渲染「族系×Tier」一組(≤6 卡) |
| **圖片請求過多** | 252 `<img>` 立即請求 | 懶載入 + 分組閘門 + 未擁有用剪影(不發圖片請求) |
| **分類按鈕過多** | 目前 5 屬性籤;再加族系7+Tier6+遭遇4 會爆 | **兩層**：L1 遭遇(5)、L2 篩選 chip(可收合) |
| **升星資訊擁擠** | 卡面塞 params+lore+星+重複 | 小卡**極簡**,詳情移到 detail |
| **新卡紅點** | **無持久機制** | 沿用射手表現 `dexSeen.js` 雙集合模式(seed-on-first-run 防洪水) |
| **60 舊 ID 相容** | cards 以 monsterId 為 key | ✅ 加新 key 即可,60 舊 key 天然保留,零破壞 |
| **小/大王/世界王分類** | 目前按屬性 | 改按**遭遇**(L1);世界王維持獨立卡池 |
| **360/390/430px** | grid-cols-3 詳細卡偏擠 | 小卡極簡化,維持 3 欄或自適應 2-3 欄 |
| **鍵盤/觸控/reduced-motion** | 卡是 `<div onClick>`(非 button),a11y 不足 | 改 `<button>`/role+tabIndex;動畫吃 `.no-anim` |
| **圖片失敗 fallback** | 已有三段 fallback ✅ | 沿用,252 補 art manifest |
| **虛擬列表?** | — | **不需要**：分組後單組 ≤6-18 卡 + 懶載入即可,避免虛擬列表複雜度 |

## 2. 推薦資訊架構

### (1) 第一層分類（L1,遭遇型）
`全部 / 一般怪 / 小王 / 大王 / 世界王`
- 對應 roster 的 `encounter`(normal/miniBoss/bigBoss) + 世界王獨立卡池。

### (2) 第二層篩選（L2,chip,可收合）
- **族系**(7)：鬼怪/山林/毒蟲/職場/考試/西方/寶箱
- **Tier**：T1–T6
- **狀態**：已取得 / 未取得
- **可升星**（duplicates 足夠升下一星）
- **新取得**（未讀紅點）
- **瀏覽動線(依 PRD 67)**：族系 → Tier 分層;選定「族系×Tier」後一次只呈現該組 3 一般 + 2 小王 + 1 大王(≤6 卡),不同時渲染 252。

### (3) 卡片小卡最小資訊
- 卡圖 or **未取得剪影**(灰階輪廓,只露卡名輪廓+遭遇型+來源)
- 卡名(未取得顯示 `？？？` 或輪廓)
- 星等(已取得,`★`列)
- 角標：遭遇型 icon(小/大王/世界王)、Tier 色框、**新卡紅點**、可升星點
- **不放** params/lore/重複數(移到 detail)

### (4) 點擊詳細頁資訊
- 大圖 + 族系/Tier/遭遇型 + 稀有度框
- 三圍 HP/ATK/DEF、招牌/效果、故事 lore
- 星等：目前星、重複數、升星所需/成本、升星按鈕
- 裝備/卸下;神話卡/世界王卡屬性選擇(chosenStat)
- 圖鑑戰績(wins/losses/勝率,現有 modal 已整合)
- 取得來源(遭遇型/掉落來源)

### (5) 新卡紅點保存與清除
- **沿用 `dexSeen.js` 模式**(我在射手表現 [[project_local_first_performance]] 已驗證):雙集合 `notified`/`seen`,`seedIfFirstRun` 把當下已擁有卡標基準 → **根治首次進頁洪水紅點**。
- 儲存：localStorage(即時) + 可選 Firestore 鏡像(跨裝置)。
- 清除：進入該卡 detail / 展開其所屬「族系×Tier」組 → 標記已讀、清該卡紅點;L1/L2 籤上顯示聚合紅點數。
- 新卡來源(gacha `isNew`、戰鬥首次掉落、王房保底)統一寫入 seen 差集。

### (6) 252 圖片懶載入策略（不需虛擬列表）
1. **分組閘門**：只掛載當前選定組的卡(族系×Tier ≤6,或 L1 類別分頁),其餘不進 DOM。
2. **原生懶載入**：卡圖 `loading="lazy" decoding="async"`。
3. **未取得 = 剪影**：用 CSS 灰階/blur 佔位,**不發圖片請求**(252 中未擁有者零流量)。
4. **失敗重試清理**：切換組時 abort 未完成/失敗的圖片請求,避免堆積(PRD 69)。
5. **art manifest**：252 卡圖路徑 `/cards/monsters/{monsterId}.webp`,缺圖走現有三段 fallback → emoji。(見 claude-card-ui-schema.json 的 artKey)

### (7) 舊資料 migration / normalization
- **零破壞**：`cards` 以 monsterId 為 key,60 舊 key 不動;192 新卡在**目錄層**(從 MONSTERS/roster 衍生)呈現為未取得剪影,不需寫入 owned map。
- **衍生而非儲存**：encounter/family/tier 從 monster 目錄衍生,不冗存在每張 owned card(避免 migration)。
- normalize：確保 owned card 有 `{duplicates, stars, chosenStat?}`;缺欄位補預設。world boss 卡沿用 `normalizeWorldBossCard`。
- **不改 ID、不使已裝備卡失效**(PRD 70)。

### (8) 建議元件拆分 + 檔案位置（新資料夾 `src/components/member/cards/`）
| 元件 | 職責 |
|---|---|
| `CardCollectionPage.jsx` | 容器:訂閱 collection/dex/seen、L1/L2 狀態、裝備總覽 |
| `CardFilterBar.jsx` | L1 遭遇籤 + L2 篩選 chip(可收合) + 紅點聚合 |
| `EquippedCardsPanel.jsx` | HP/ATK/DEF 3 格 + 世界王 3 格 + 加成總覽 |
| `CardGroupGrid.jsx` | 渲染單一「族系×Tier」或類別組,懶載入 |
| `CardMiniCell.jsx` | 極簡小卡(已取得/剪影/紅點),`<button>` a11y |
| `CardDetailModal.jsx` | 詳細頁(裝備/升星/屬性/圖鑑戰績) |
| 新 lib `cardCatalog.js` | 從 MONSTERS+roster 衍生完整 252 目錄(遭遇/族系/tier/artKey) |
| 新 lib `cardSeen.js` | 比照 dexSeen 的紅點/未讀 |
| 保留 `monsterCards.js` | 加成/升星計算邏輯不動 |

### (9) 現有元件保留 / 重構 / 淘汰
- **保留**：`monsterCards.js`、`worldBossCards.js`、db 卡片函式(subscribeCardCollection/equipCard/upgradeCard/setMythicCardStat)、`MonsterArt`/`WorldBossArt` fallback 鏈、Gacha 的 `isNew`。
- **重構**：`CardCollection.jsx`(821行) → 拆進 `cards/`;分類由**屬性→遭遇**;加剪影 + 分組 + 懶載入 + 紅點;卡是 `<button>`。
- **淘汰**：扁平「一次全渲染已擁有卡」的 grid;純屬性 `CATEGORY_TABS`(屬性降為 L2 篩選其一)。

## 3. 風險與相容
- **低風險**：資料模型 monsterId-keyed → 60 舊卡零破壞;純前端 UI 重構,不碰戰鬥/db 寫入邏輯。
- 需 Codex 提供:252 卡圖 art manifest 產出計畫(目前僅 60);world boss 卡與新大王卡是否合併分類(建議維持獨立池)。

## 4. 交棒
- 交 Codex 審核此架構;通過後 Claude 可實作 `src/components/member/cards/` 獨立元件(不碰禁改清單)。
- 可先做 `cardCatalog.js` + `cardSeen.js` + `CardMiniCell` 的無狀態原型驗證懶載入/剪影/紅點。
