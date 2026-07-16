# 🗺️ 成就圖鑑總體規劃書（Master Plan）

> **檔案位置**: `docs/achievement-dex-master-plan.md`
> **日期**: 2026-07-16
> **目的**: 把「所有遊戲系統」的成就圖鑑做一次通盤規劃——哪些要重整、哪些要新建、
> 以什麼順序做。承接 `achievement-dex-redesign-plan.md`（Phase 1-2 已完成）。
>
> **核心對象檔**:
> - `src/lib/achievementDex.js` — 成就定義層（TIERED / AUTO / SPECIAL）
> - `src/components/member/MemberDex.jsx` — 前端顯示層（DexCell / DexDetailModal / cellsFor）

---

## 0. 設計哲學（骨幹已建好，之後全部沿用）

Phase 1-2 已經把「里程碑進度條模型」做成可重複使用的骨幹。**新系統一律插進這個骨幹，不要再發明新結構**：

| 結構 | 用途 | 判準 |
|------|------|------|
| `TIERED_ACHIEVEMENTS` | **單調累積值**的系列（越打越多） | getValue 回傳的數字只會往上、不會倒退 → 用進度條 |
| `AUTO_ACHIEVEMENTS`（單次） | 一次性 / 非單調 / 條件式 | 例如「擊敗主教練」「六族全收」「完美決鬥」 |
| `SPECIAL_GRANTS` | 教練後台手動授予 | 無法程式判定的（幫忙、情緒價值…） |
| round / cohort | 屆數 / 期數 | 既有特例，不動 |

**鐵律（避免死成就）**：設計任何成就前，先確認它的 `check`/`getValue` 讀的欄位**真的有地方寫入**。本文件第 3 節的「資料就緒度」欄位就是為此存在——`drop_rare~drop_mythic` 四個死成就就是當初沒做這一步。

---

## 1. 現況全景

**已有圖鑑的 14 個分類**：啟程 / 期數 / 射手證 / 檢定 / 收藏 / 實體賽 / 積分賽 / 特殊 / 打怪 / 決鬥 / 煉製&藥水 / 怪物卡 / 冒險者公會 / 地下城。

**已完成（Phase 1-2, 2026-07-16）**：
- 8 個明顯系列 + 4 組動態巨量系列（kill×36 / chest×7 / potion / dex_fam×6）合併成階段式。
- `computeDexStats` 改用「排除被取代舊成就 + tiered 里程碑」計數。

**仍是死成就 / 缺口**：
- `drop_rare~drop_mythic`（掉寶無統計）— 待修。
- `card_first`/`card_renew`（月卡未實裝）— 保留 futureFeature。

---

## 2. 系統 × 圖鑑覆蓋矩陣

盤點所有遊戲系統，標出目前圖鑑覆蓋程度：

| 遊戲系統 | 現有圖鑑分類 | 覆蓋度 | 說明 |
|---------|------------|-------|------|
| 報到 / 練習箭數 | 啟程（只有報到） | 🟡 部分 | **終身箭數 `totalArrowsAllTime` 完全沒做成就**——最大缺口 |
| 年度檢定 / 射手證 | 檢定 / 射手證 | 🟢 完整 | 不動 |
| 打怪 RPG | 打怪 | 🟢 完整 | Phase 2 剛補完 |
| 決鬥 | 決鬥 | 🟢 完整 | 不動 |
| 煉製 / 藥水 | 煉製&藥水 | 🟢 完整 | 不動 |
| 怪物卡（36 種） | 怪物卡 | 🟢 完整 | 不動 |
| 冒險者公會 / 射手等級 | 冒險者公會 | 🟢 完整 | 不動 |
| 地下城收藏品 | 地下城 | 🟢 完整 | 不動 |
| 賽事 | 實體賽 / 積分賽 | 🟢 完整 | 不動 |
| **世界王** | 特殊（只有獎盃） | 🟡 部分 | 獎盃塞在「特殊」裡，應獨立成一類；參戰/傷害/尾刀沒成就 |
| **貓咪夥伴（9 隻）** | ❌ 無 | 🔴 缺 | 集貓數 / 貓等級 / 羈絆 / 故事章節 全無成就 |
| **貓貓卡（100 張）** | ❌ 無 | 🔴 缺 | 與怪物卡不同系統，完全沒圖鑑 |
| **貓貓村（9 棟 20 級）** | ❌ 無 | 🔴 缺 | 建築等級 / 資源 / 市集 全無成就 |
| **射手遠征隊** | ❌ 無 | 🔴 缺 | 遠征次數沒被累計（見就緒度） |
| **RPG 裝備** | ❌ 無 | 🔴 缺 | 裝滿槽位 / 強化 +N / 神話裝 全無成就 |
| **議會廳 / 協力採集** | ❌ 無 | 🔴 缺 | 採集次數 / 36 隻生活怪物圖鑑 全無 |

---

## 3. 資料就緒度矩陣（決定實作順序的關鍵）

每個「想做的成就系列」對應到實際 Firestore 欄位，標出能不能**現在就 check**：

| 提案系列 | 讀取欄位 | 就緒度 | 備註 |
|---------|---------|-------|------|
| 終身練習箭數 | `member.totalArrowsAllTime` | ✅ 就緒 | `addRoundArrows` 已 increment（規則已放行） |
| 集貓數 | `cats` 子集合文件數 / `getOwnedCatIds` | ✅ 就緒 | |
| 貓咪最高等級 | 各貓 `catXP` → `levelFromXP` | ✅ 就緒 | 取最大值 |
| 貓咪羈絆 | 各貓 `bond` | ✅ 就緒 | |
| 貓咪故事章節 | 各貓 `unlockedChapters` | ✅ 就緒 | |
| 建築總等級 / 各棟等級 | `member.village.buildings.{id}` (1-20) | ✅ 就緒 | `getVillageLevel()` 已有 |
| 村莊等級 | `getVillageLevel(buildings)` | ✅ 就緒 | |
| 裝備槽位完成度 | `member.rpgEquip[slot]` 有幾格 | ✅ 就緒 | 6 槽。⚠️ 欄位名要確認：db.js 寫 `rpgEquip`，equipData.js 註解寫 `equipment`，以 db 寫入路徑為準 |
| 裝備強化 +N（衝裝） | `member.rpgEquip[slot].plusLevel` | ✅ 就緒 | 取最大 plusLevel |
| 裝備品階突破 | `member.rpgEquip[slot].grade`（common→mythic） | ✅ 就緒 | 精英以上突破吃王之印記 |
| 神話裝備 | `grade === "mythic"` | ✅ 就緒 | |
| 打洞孔數 | `member.rpgEquip[slot].sockets` 陣列長度（每件 ≤3） | ✅ 就緒 | 全裝備加總 |
| 已鑲嵌符文數 | `sockets` 內非 null 數量 | ✅ 就緒 | |
| 符文最高階 | `equipmentRuneInventory` / socket 內 runeId → tier | ✅ 就緒 | 4 型（atk/def/hp/cat）分階 |
| 世界王獎盃（已存在） | `member.dungeonCollectibles[wbId]` | ✅ 就緒 | 只需從「特殊」搬到新類 |
| 貓貓卡收集 | 貓卡 collection（**需查實際欄位**） | ⚠️ 待查 | 100 張系統，訂閱函式待確認 |
| 世界王參戰 / 尾刀 / 傷害 | ❌ 無 per-member 累計 | ⚠️ 需加計數 | 要在 `attackWorldBoss` 結算加 `member.wbStats` |
| 遠征完成次數 | `expeditions.{slot}` 是暫態、領取即清 | ⚠️ 需加計數 | 領獎時 increment 一個 `expeditionsDone` |
| 協力採集次數 | ❌ 無累計 | ⚠️ 需加計數 | `completeCouncilSession` 加 `gatheringCount` |
| 生活怪物圖鑑（36） | ❌ 無擊破紀錄 | ⚠️ 需加紀錄 | 採集戰鬥要寫 `councilDex` |
| 掉寶 drop_rare~mythic | ❌ 無 lootStats | ⚠️ 需加計數 | 掉寶請領時寫 `member.lootStats.rarityCounts` |
| 月卡初啟 `card_first` | `member.monthlyCard.active`/`startedAt` | ✅ 就緒 | **月卡已實裝**，死成就可立即復活 |
| 月卡續約 `card_renew` | 續約處無計數 | ⚠️ 需加計數 | `activate/renew` 加 `monthlyCard.renewCount` |
| 決鬥場次 | `duelStats`(wins+losses+draws/solo/team) | ✅ 就緒 | 已有，決鬥雖少人用但資料完整 |
| 自主練習箭數 | `member.totalArrowsAllTime` | ✅ 就緒 | 同「練習」分類 |
| **各模式場次/勝場**（單人打怪/組隊/地下城/組隊地下城/世界王） | `monsterLogs.mode` 有但**未彙整**；`monsterDex` 只按怪物、不按模式 | ⚠️ 需加計數 | 統一在各模式結算加 `member.modeStats.{mode}.games/wins` |

**分兩桶**：✅ 就緒的可以「純圖鑑層」做完、零風險；⚠️ 的要先在資料層補一個 increment 才能做。

---

## 4. 提案：分類重整 + 新建

### 4.1 新增 5 個分類（`DEX_CATEGORIES`）

```
{ id: "practice",  label: "🎯 練習" },   // 終身箭數里程碑
{ id: "cat",       label: "🐈 貓咪" },   // 集貓/等級/羈絆/故事（貓卡另議）
{ id: "village",   label: "🏘️ 貓貓村" }, // 建築/資源/遠征
{ id: "equip",     label: "🛡️ 裝備" },   // 槽位/強化/神話
{ id: "worldboss", label: "🐲 世界王" }, // 參戰/尾刀/傷害/獎盃
{ id: "mode",      label: "🎮 歷練" },   // 各戰鬥模式的場次/勝場精通
```

（議會廳採集可暫併入既有分類或延後，見第 6 節路線圖。）

> **「歷練」分類的定位**：現有「打怪」是**按怪物**（打贏誰），「歷練」是**按模式**（用哪種玩法打）。
> 兩者互補不重複——同一場單人打怪，會同時累進「打怪」的怪物擊殺，也累進「歷練」的單人場次。

### 4.2 各分類的成就設計

> 格式：`系列 ID`（TIERED 里程碑值 / 或 SINGLE 條件）

**🎯 練習（practice）** — 全部 ✅ 就緒
- `arrows_total`（TIERED）終身箭數：100 / 500 / 1000 / 3000 / 6000 / 10000 / 20000 箭。← 全站最有存在感的長期目標
- 報到 `checkin`（既有 tiered）可考慮從「啟程」移來這裡，讓「啟程」只留新手一次性成就。

**🐈 貓咪（cat）** — ✅ 就緒
- `cat_collect`（TIERED）集貓數：1 / 3 / 6 / 9 隻
- `cat_level`（TIERED）任一貓最高等級：10 / 30 / 60 / 100 / 150 / 200
- `cat_bond`（TIERED）任一貓最高羈絆：50 / 200 / 500 / 1000
- `cat_story`（TIERED）已解鎖故事章節總數：1 / 5 / 10 / 全部
- `cat_all9`（SINGLE, hidden）集齊 9 隻

**🏘️ 貓貓村（village）** — 建築 ✅ / 遠征 ⚠️
- `village_level`（TIERED）村莊總等級 `getVillageLevel`：里程碑依總級距訂（如 12 / 30 / 60 / 100 / 150 / 180）
- `building_max`（TIERED）任一棟達到的最高等級：5 / 10 / 15 / 20
- `village_allbuilt`（SINGLE, hidden）9 棟全部 Lv.20
- `expedition_count`（TIERED, ⚠️需計數）遠征完成次數：1 / 10 / 30 / 60

**🛡️ 裝備（equip）** — 全部 ✅ 就緒（皆讀 `rpgEquip`）
- `equip_slots`（TIERED）已裝備槽位數：1 / 3 / 6（滿槽）
- `equip_plus`（TIERED, 衝裝）任一件最高強化：+1 / +2 / +3 / +4
- `equip_grade`（TIERED, 衝裝）任一件最高品階：稀有 / 精英 / 史詩 / 傳說 / 神話
- `equip_mythic`（TIERED）擁有神話裝件數：1 / 3 / 6
- `equip_socket`（TIERED, 打洞）全裝備打洞總孔數：1 / 3 / 6 / 12 / 18（6 槽×3 孔）
- `equip_rune`（TIERED, 符文）已鑲嵌符文總數：1 / 3 / 6 / 12
- `rune_tier`（TIERED, 符文）持有符文最高階：依 `EQUIPMENT_RUNE_TIERS` 分階
- `equip_full_mythic`（SINGLE, hidden）6 槽全神話 +4
- `equip_full_socket`（SINGLE, hidden）6 槽全部打滿 3 孔並鑲滿符文

**🐲 世界王（worldboss）** — 獎盃 ✅ / 統計 ⚠️
- 把既有 `wb_trophy_*`（48 個獎盃，尾刀+前三）從「特殊」**搬到這一類**（改 cat 欄位即可，check 不變）
- `wb_join`（TIERED, ⚠️需計數）參戰場次：1 / 5 / 10 / 25
- `wb_lasthit`（TIERED, ⚠️需計數）尾刀擊殺數：1 / 5 / 10
- `wb_damage`（TIERED, ⚠️需計數）累積對王傷害：1k / 10k / 50k / 100k

**🎮 歷練（mode）** — 決鬥/練習 ✅ / 其餘 ⚠️需計數
> 各模式一個 TIERED 場次系列。設計上**統一一個計數器** `member.modeStats.{mode} = { games, wins }`，
> 在每個模式的結算路徑各加一行 increment（單人打怪/組隊/地下城/組隊地下城/世界王 5 個 call site），
> 一次補完解鎖整個分類。決鬥、練習已有現成資料不需補。
- `mode_practice`（TIERED, ✅）自主練習箭數：直接複用「練習」的 `arrows_total`，不重複做格子
- `mode_solo`（TIERED, ⚠️）單人打怪場次：1 / 10 / 30 / 60 / 100
- `mode_party`（TIERED, ⚠️）組隊戰鬥場次：1 / 10 / 30 / 60
- `mode_dungeon`（TIERED, ⚠️）地下城通關次數：1 / 5 / 15 / 30
- `mode_dungeon_party`（TIERED, ⚠️）組隊地下城通關：1 / 5 / 15
- `mode_worldboss`（TIERED, ⚠️）世界王參戰場次：與 worldboss 分類的 `wb_join` **共用同一計數**，擇一顯示即可
- `mode_duel`（TIERED, ✅）決鬥場次：`duelStats` 總場次 1 / 5 / 10 / 25（勝場已在「決鬥」分類，這裡計總參與）

**📅 月卡（併入 start 或獨立小類）** — `card_first` ✅ / `card_renew` ⚠️
> **月卡已實裝**（`member.monthlyCard`），原本標 futureFeature 的兩個死成就可處理：
- `card_first`（SINGLE, ✅）月卡初啟：改 `check: c => !!c.member?.monthlyCard?.startedAt`（或 `.active`）
- `card_renew`（SINGLE, ⚠️）月卡續射：續約處加 `monthlyCard.renewCount`，check 改讀 `>= 1`

**啟程（start）重整**：把 `checkin` 移到「練習」後，「啟程」只留 `first_cert`（初試啼聲）＋月卡成就，成為純「新手第一步」分類。

---

## 5. 死成就 / 缺口處置

| 項目 | 處置 | 需動的資料層 |
|------|------|------------|
| `drop_rare~drop_mythic` | 做成 `loot_drops` TIERED（各稀有度累積掉落數） | 掉寶請領處 `increment("lootStats.rarityCounts.{rarity}")`，並補進 `firestore.rules` hasOnly |
| `card_first`（月卡初啟） | **月卡已實裝**，改 check 讀 `monthlyCard.startedAt`/`.active` → 立即復活 | 無（Phase 3） |
| `card_renew`（月卡續射） | 續約處加 `monthlyCard.renewCount`，check 讀 `>=1` | 續約路徑 increment（Phase 4） |
| 生活怪物圖鑑（36） | 新 `councilDex` 分類或併入打怪 | 採集戰鬥勝利寫 `member.councilDex.{monId}` |

---

## 5.5 成就通知與紅點高亮系統（修 bug + 新功能）

> **問題**：①玩家進圖鑑會重複噴一堆 toast；②獲得成就時沒即時提醒、也沒引導玩家去看。

### 根因（已定位）
`MemberDex.jsx` 的 `getShownIds`/`saveShownIds`（localStorage `dex_shown_{uid}`）**缺「首次基準標記」**。
空集合時偵測把「當下已解鎖的所有成就」都當新的 → 洪水式 toast。且偵測只在圖鑑頁掛載時跑、只掃 `AUTO_ACHIEVEMENTS`（tiered 里程碑不會提醒）。
→ 對照 `bookingSeen.js` 檔頭：教練後台早就用 `seedIfFirstRun` 解過同一個坑，直接沿用同一套模型。

### 設計（沿用 bookingSeen 三件式：seed / seen-set / mark）
新增 `src/lib/dexSeen.js`（比照 `bookingSeen.js`）：
- **`seedIfFirstRun(currentlyUnlockedKeys)`**：第一次載入時，把當下已解鎖的全部 key 標成「已看」——**根治洪水**。
- **seen-set 存哪**：短期沿用 localStorage（跟 bookingSeen 一致、零風險）；⚠️ 要跨裝置一致的話，改存 `member.seenAchievements`（Firestore），但要進 `firestore.rules` hasOnly 白名單。**建議先 localStorage，之後有需要再升級**。
- **解鎖 key 規則**：單次成就＝`id`；**tiered 成就＝`{id}_t{里程碑index}`**（每達到一個新里程碑各算一次「新解鎖」，才能逐階提醒與紅點）。

### 三個層次的呈現
| 層次 | 行為 | 位置 |
|------|------|------|
| **即時提醒** | 一解鎖就跳 `BadgeEarnPopup`（已存在）+ epic 以上發 `createNotification` | **移到 App 層**（`MemberApp` 已訂閱 monsterDex/craftStats… 全部資料）——不再綁圖鑑頁，打怪當下就提醒 |
| **紅點引導** | 有未看成就 → 圖鑑入口（導覽/角色頁）亮紅點；分類頁籤、格子也各自亮 | `MemberApp` nav + `MemberDex` 分類列/`DexCell` |
| **高亮 NEW** | 未看的格子加 `NEW` 角標 + 微光；點開/看過即 `markSeen` 清掉 | `MemberDex` DexCell |

### 關鍵改動點
1. **偵測搬家**：把 `MemberDex` 現行 useEffect 偵測邏輯抽成 App 層（或 hook `useAchievementWatch`），`MemberApp` 掛一份，資料源用它既有的訂閱。**tiered 也要納入偵測**（用 `computeTierProgress` 找新達成的里程碑）。
2. **seed 修 bug**：偵測第一次跑先 `seedIfFirstRun`，避免既有成就洪水。
3. **紅點狀態**：`unseenCount = 未看已解鎖 key 數`，供 nav 紅點 + 分類/格子高亮。
4. **清除**：進圖鑑分類、或點開某成就 → `markSeen`；「全部標為已看」按鈕（比照 `markAllSeen`）。

> ⚠️ 這套要跟 Phase 3 一起設計：新增 cat/village/equip 等 tiered 分類時，偵測要能認得 tiered 里程碑，否則新分類的成就一樣不會提醒。

---

## 6. 分階段路線圖（依就緒度排序：先摘唾手可得）

### 🟢 Phase 3 — 純圖鑑層（✅ 已完成 2026-07-16，見 changelog）
> 分類 14→20；新增練習/貓咪/貓村/裝備(衝裝+打洞+符文)/世界王/決鬥歷練/月卡初啟；
> 新增 `dexSeen.js` + App 層 `DexUnlockToast` + nav 紅點 + NEW 高亮，修好洪水式重複觸發。
> ⚠️ 未實機測試；裝備讀 `member.rpgEquip`。
只改 `achievementDex.js` + `MemberDex.jsx`，不碰任何寫入路徑：
1. 新增 `practice` 分類 + `arrows_total`（終身箭數）
2. 新增 `cat` 分類（集貓/等級/羈絆/故事）
3. 新增 `village` 分類（建築部分）
4. 新增 `equip` 分類（槽位/強化/神話）
5. 新增 `worldboss` 分類 + 把 `wb_trophy_*` 搬過來
6. `checkin` 從 start 移到 practice
7. 復活 `card_first`（月卡初啟，check 改讀 `monthlyCard.startedAt`）
8. `mode_duel`（決鬥場次，`duelStats` 已就緒）
9. **成就通知與紅點高亮系統（§5.5）**——修「重複觸發」洪水 bug（`seedIfFirstRun`）＋偵測搬到 App 層＋紅點/NEW 高亮。**必須跟新分類同批做**，否則新成就不會提醒。

→ 一次 build 驗證、部署。**這一階段就能讓圖鑑分類從 14 → 20，涵蓋幾乎所有系統，並修好通知體驗。**

### 🟡 Phase 4 — 補資料層計數（每項都是加一個 increment）
每做一個就解鎖對應成就，可獨立分次上：
1. **`modeStats.{mode}`（單一計數器，5 個結算 call site）→ 解鎖整個「歷練」分類**（單人/組隊/地下城/組隊地下城/世界王場次）— 這是 CP 值最高的一項
2. `expeditionsDone` → 遠征次數成就
3. `wbStats`（join/lasthit/damage）→ 世界王統計成就（`join` 可跟 modeStats.worldboss 共用）
4. `lootStats.rarityCounts` → 修 `drop_*` 死成就
5. `monthlyCard.renewCount` → 復活 `card_renew`
6. `gatheringCount` / `councilDex` → 議會廳採集成就

⚠️ 每個新 `members` 欄位都要同步加進 `firestore.rules` 的 `hasOnly` 白名單（見 quick-ref「必現 permission 錯誤」教訓）。

### 🔵 Phase 5 — 貓貓卡（需先查系統）
確認 100 張貓卡的 collection/訂閱結構後，比照怪物卡做 `catcard_collect` TIERED。

---

## 7. 一致性規範（新增成就都遵守）

- **TIERED vs SINGLE 判準**：getValue 單調遞增 → TIERED；否則 → SINGLE。
- **稀有度階梯**：里程碑由 common 往上爬，最終里程碑用 epic/legendary/mythic 收尾。
- **命名**：系列 id 用 `{系統}_{主題}`（如 `cat_bond`）；tier `name` 給有記憶點的中文（沿用「初次/漸入佳境/風雨無阻」語感）。
- **hidden + riddle**：終局/隱藏成就才用（如 `cat_all9`、`equip_full_mythic`）。
- **計數一致性**：TIERED 一律走 `computeTierProgress`，`computeDexStats` 自動納入，不用另外改統計。

---

## 8. 一頁總結

| 階段 | 內容 | 風險 | 產出 |
|------|------|------|------|
| **Phase 3** | 6 新分類（練習/貓咪/貓村建築/裝備/世界王/歷練-決鬥）純圖鑑層 + 復活月卡初啟 | 極低 | 分類 14→20，覆蓋大部分系統 |
| **Phase 4** | 補 `modeStats` 等 increment：解鎖「歷練」各模式場次 + 遠征/世界王統計/掉寶/月卡續約/採集 | 低（各自獨立） | 各模式場次、進階統計成就 |
| **Phase 5** | 貓貓卡圖鑑 | 中（需查系統） | 100 張貓卡收集 |

**建議先做 Phase 3**——完全不碰寫入路徑、零併發風險，一次就把「貓咪、貓村、裝備、世界王、練習箭數、決鬥歷練」補上。

**「歷練」分類的完整解鎖靠 Phase 4 的 `modeStats` 單一計數器**——在單人打怪/組隊/地下城/組隊地下城/世界王 5 個結算點各加一行 increment，一次點亮所有模式場次成就（CP 值最高）。

---

*規劃日期: 2026-07-16 — 承接 Phase 1-2*
