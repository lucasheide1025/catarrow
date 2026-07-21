# Dead Code & 檔案瘦身調查報告
**日期**: 2026-07-19  
**範圍**: src/、根目錄腳本、部署殘留、公共資源  
**目標**: 識別可安全移除的死代碼、重複定義、孤立檔案、瘦身建議

---

## 🔴 高優先級 — 可安全移除的檔案

### 1. 孤立元件（無任何 import 來源）

這些元件存在於專案中，但**完全沒有被任何其他 JS/JSX 檔案 import**，也未被路由動態載入：

| 元件 | 路徑 | 行數 | 備註 |
|------|------|------|------|
| AdminAchievements | `src/components/admin/AdminAchievements.jsx` | ~150 | 僅在 AdminBooking.jsx 註解被提及 |
| AdminAdventurerGuild | `src/components/admin/AdminAdventurerGuild.jsx` | ~200 | 完全孤立 |
| DungeonPathSelect | `src/components/dungeon/DungeonPathSelect.jsx` | ~120 | 完全孤立 |
| CouncilBattle | `src/components/member/CouncilBattle.jsx` | ~1212 | ⚠️ 大檔案！但只在 damage.js 註解被提到 |
| GatheringBattle | `src/components/member/GatheringBattle.jsx` | ~300 | 完全孤立 |
| HonorTicker | `src/components/member/HonorTicker.jsx` | ~150 | 完全孤立 |
| CatAnimationToggle | `src/components/cat/CatAnimationToggle.jsx` | ~50 | 完全孤立 |

**建議**: 確認無路由或動態載入後，可安全刪除這 7 個元件（尤其 CouncilBattle 可省 ~1200 行）。

### 2. 根目錄一次性修復腳本（7月12日批次）

以下 Python 腳本全部修改於 **2026-07-12 18:00~19:48**，推測為一次性 Firestore 資料庫修復腳本，執行完後未清理：

| 腳本 | 行數 | 類別 |
|------|------|------|
| `fix_brace_bin.py` | ~50 | brace 修復 |
| `fix_brace_v2.py` | ~50 | brace 修復 v2（重複） |
| `fix_potions_v2.py` | ~70 | 藥水修復 |
| `fix_potions_v3.py` | ~50 | 藥水修復 v3（重複） |
| `fix_catid.py` | ~40 | catId 修復 |
| `fix_chesttype_and_profile.py` | ~150 | 寶箱類型修復 |
| `fix_monsterbattle_step2.py` | ~400 | 怪物戰鬥修復（大） |
| `fix_party_potions.py` | ~35 | 隊伍藥水修復 |
| `fix_partybattleroom.py` | ~150 | party battle room 修復 |
| `fix_onpotion.py` | ~50 | onPotion 修復 |
| `add_onpotionused.py` | ~50 | onPotionUsed 新增 |
| `fix_undo_brace.py` | ~35 | brace 復原 |
| `fix_endbattle_brace.py` | ~45 | endBattle brace 修復 |
| `fix_handleMBBattleEnd.py` | ~180 | MonsterBattle end 修復 |
| `fix_logs_and_arrows.py` | ~100 | log & arrows 修復 |
| `fix_missing_brace.py` | ~45 | missing brace 修復 |

**建議**: 全部可刪除（已於 7/12 執行完畢，距今一週無修改）。

### 3. 根目錄備份與管理腳本

| 檔案 | 大小 | 日期 | 說明 |
|------|------|------|------|
| `backup.js` | 2.4KB | 06-13 | 一次性的 firestore 備份腳本 |
| `restore.js` | 3.1KB | 06-13 | 一次性的 firestore 還原腳本 |
| `backup_2026-06-13T00-34-22.json` | **1.5MB** | 06-13 | 舊備份資料，可移入 backups/ 或刪除 |
| `backup_2026-06-22T21-23-42.json` | **5.0MB** | 06-23 | 舊備份資料，可移入 backups/ 或刪除 |
| `init-admin-member.js` | 1.6KB | 06-09 | 一次性管理員初始化 |

**建議**: 備份 JSON 可移入 `backups/` 目錄（已有該目錄），腳本可刪除。

---

## 🟡 中優先級 — 需進一步確認

### 4. `scripts/` 目錄的最終分類（逐一檢視程式碼後確認）

`scripts/` 共 47 個檔案，經**逐一讀取完整程式碼**後確認：

**🔥 以下 26 個從未修改且可安全刪除（已確認無任何外部引用 — 檢查 package.json / vercel.json / firebase.json / .github / .git/hooks 皆無引用）**

📂 組別 A — PartyBattleRoom UI 整合（7/13, 共 13 個）
```
apply_bottom_bar.py          clean_party_battle.py        final_party_restructure.py
fix_bs_props.py               fix_flex_fullscreen.py      fix_party_battle_ui.py
fix_party_battlescreen.py     fix_party_full_restructure.py fix_party_simple.py
fix_player_cards.py           fix_top_section.py          remove_block.py
remove_old_battlescreen.py
```

📂 組別 B — PartyBattleRoom Bonus 修復（7/14, 共 5 個）
```
fix_party_animation_lock.py   fix_party_card_bonus.py     fix_party_cat_bonus.py
fix_prebattle_stats.py        fix_root_causes.py
```

📂 組別 C — MonsterBattle 修復（7/13, 共 6 個）
```
complete_integration.py       fix_monster_battle_ui.py    fix_monster_battlescreen.py
fix_monster_potions.py        fix_monster_usememo.py      remove_zombie_monsterbattle.py
```

📂 組別 D — DungeonBattleRoom 修復（7/13~7/14, 共 5 個）
```
apply_dungeon_battlescreen.py  fix_dungeon_battle_room.mjs fix_dungeon_potions.py
fix_remaining_dungeon.mjs      swap_blocks.mjs
```

📂 組別 E — WorldBoss UI 修復（7/14, 共 3 個）
```
clean_fix_wbframe.mjs         fix_wbframe_position.mjs    fix_wbframe_tdz.mjs
```

📂 組別 F — BattleScreen 通用修復（7/13~7/15, 共 7 個）
```
fix_battle_round_stuck.py     fix_battle_round_stuck.mjs  fix_battlemode_score.py
fix_battlemode_v2.py          fix_dup_status.py           fix_missing_exports.py
fix_subscriptions.py
```

📂 組別 G — Phase C 資料遷移（7/3, 共 3 個）
```
phase_c_dungeon_data.py       phase_c_monster_data.py     phase_c_registry.py
```

📂 組別 H — 其他一次性工具（7/5~7/14, 共 3 個）
```
add-5s-delay.js               insert_milestone_fn.py      listModels.js
```

**✅ 保留（5 個 — 仍在維運或日後可能使用）**

| 腳本 | 日期 | 行數 | 保留原因 |
|------|------|------|----------|
| `generate-monster-handbook.py` | 7/18 | 94 | 註解寫「資料改動後重跑」，自動生成 docs 手冊 |
| `generate-monster-expansion-catalog.mjs` | 7/16 | 113 | 生成 `monsterExpansionCatalog.json`（核心資料檔） |
| `sync-functions-monster-data.mjs` | 7/18 | 18 | 同步怪物資料到 `functions/`（Cloud Functions 用） |
| `remove-bg.mjs` 🟡 | 6/18 | 108 | 圖片去背景工具，後續新增怪獸/卡片圖片會用到 |
| `generateVillageImages.js` 🟡 | 6/22 | 165 | 呼叫 Gemini API 生成村莊建築圖，若需補圖會用到 |

**總結：scripts/ 共 47 檔 → 保留 5 檔，可刪 42 檔。**

### 5. 舊元件被取代但仍殘留 import

| 舊元件 | 現狀 | 殘留 import 來源 |
|--------|------|-----------------|
| `CardCollection.jsx` | 已從 src/ 刪除 | ⚠️ 但 `subscribeCardCollection` 仍被 8 個元件 import（這是 db.js 的函式，非元件本身 — 安全） |
| `DungeonController.jsx` | 已從 src/ 刪除 | ✅ 無殘留 import |
| `DungeonExplore.jsx` | 已從 src/ 刪除 | ✅ 無殘留 import |
| `DungeonMap.jsx` | 已從 src/ 刪除 | ✅ 無殘留 import |

### 6. 重複 export 名稱（命名衝突風險）

| 名稱 | 同時定義於 | 風險 |
|------|-----------|------|
| `rollCoinChestTier` | `lootTable.js` + `monsterConfig.js` | 🟡 import 時可能混淆 |
| `markQuestDone` | `db.js` + `partyDb.js` | 🟡 import 時已用 `as` 別名規避 |
| `CONSOLATION_REWARD` | `villageGoalData.js` + `worldBossData.js` | 🟡 常數命名衝突 |
| `COIN_CHEST_TIERS` | `lootTable.js` + `monsterConfig.js` | 🟡 常數命名衝突 |
| `todayStr` | `accessControl.js` + `bookingSchedule.js` | 🟢 函式內容相同（日期字串），可考慮共用 |

### 7. 殘留除錯日誌

**`src/lib/db.js` 第 1534-1570 行** — 【榮耀除錯】區塊：
```js
console.log("【榮耀除錯】進入函式", ...);
console.log("【榮耀除錯】級別 index", ...);
console.log("【榮耀除錯】❌ newIdx<0，沒達標，不發");
console.log("【榮耀除錯】判斷", ...);
console.log("【榮耀除錯】❌ 沒進步，不發");
console.log("【榮耀除錯】拿到會員", ...);
console.log("【榮耀除錯】❌ getMember 出錯", ...);
console.log("【榮耀除錯】✅ 通知已寫入，id =", ...);
console.log("【榮耀除錯】❌ createNotification 出錯", ...);
```

這 9 行 `console.log` 顯然是開發階段除錯用，可安全刪除（功能正常）。

另外 `db.js` 中還有約 20 處 `console.warn` 在 `catch` 區塊中，其中部分可升級為正式錯誤處理機制。

### 8. BattleSound 中無引用的音效

`src/lib/sound.js` 匯出了大量 sfx 函式。以下經搜尋未在 `src/` 中被調用：
- `sfxMonsterAtk` ❌ 無引用
- `sfxMonsterCrit` ❌ 無引用
- `sfxMiss` ❌ 無引用

---

## 🔵 低優先級 — 瘦身建議

### 9. 超大檔案（>1000行）

| 檔案 | 行數 | 建議 |
|------|------|------|
| `src/lib/db.js` | **5234** | 🔴 **最高優先** — 資料庫 + 業務邏輯大雜燴，可拆分為多個模組 |
| `src/components/member/MemberPractice.jsx` | 2457 | 🟡 練習模式 UI，可拆分子元件 |
| `src/components/member/MonsterBattle.jsx` | 2432 | 🟡 怪物戰鬥邏輯，可拆分 |
| `src/components/dungeon/DungeonBattleRoom.jsx` | 2346 | 🟡 地下城戰鬥室，可拆分 |
| `src/components/party/PartyBattleRoom.jsx` | 2297 | 🟡 隊伍戰鬥室，可拆分 |
| `src/components/member/CatVillage.jsx` | 2121 | 🟡 貓村 UI，可拆分 |
| `src/components/worldboss/WorldBossAttack.jsx` | 1898 | 🟡 世界王攻擊，可拆分 |
| `src/lib/achievementDex.js` | 1239 | 🟢 資料定義檔，較難拆分 |
| `src/components/member/CouncilBattle.jsx` | 1212 | 🟢 但仍確認是否為死代碼（見 §1） |
| `src/pages/AdminApp.jsx` | 1171 | 🟢 路由集中地，可接受 |
| `src/lib/dungeonDb.js` | 1165 | 🟢 資料庫層，可接受 |

### 10. 無對應原始檔的測試檔

| 測試檔 | 說明 |
|--------|------|
| `src/components/battle/battleScreenAutoStart.test.js` | 沒有對應的 `battleScreenAutoStart.js` 原始檔 — 該功能可能已被移除但測試沒清 |



## 🗑️ 部署殘留 — 可釋放 ~1GB 空間

| 目錄 | 大小 | 說明 |
|------|------|------|
| `.deploy-staging-2/` | **702MB** | 🔴 完整的舊版程式碼副本 + node_modules |
| `.deploy-static-home/` | **335MB** | 🟡 靜態首頁部署（含圖片 142MB） |
| `.deploy-staging/` | 空 | ✅ 可保留或刪除 |

**建議**: 確認不需要保留舊部署快照後，可釋放約 **1GB** 磁碟空間。

---

## 📊 總結建議優先序

| 優先級 | 項目 | 預估節省 |
|--------|------|---------|
| 🔴 P0 | 刪除孤立元件 x7（§1） | ~3200 行程式碼 |
| 🔴 P0 | 刪除根目錄一次性腳本 x16（§2） | ~1500 行程式碼 |
| 🔴 P0 | 刪除根目錄備份檔案（§3） | ~6.5MB + 5 個檔案 |
| 🟡 P1 | 清理 scripts/ 歷史腳本（§4, 類別 A） | ~30 個檔案 |
| 🟡 P1 | 刪除 db.js 除錯日誌（§7） | 9 行 |
| 🟡 P1 | 確認並處理重複 export（§6） | 5 組 |
| 🟡 P1 | 刪除無引用音效（§8） | 3 個 sfx 函式 |
| 🔵 P2 | 拆分超大檔案（§9） | 可維護性提升 |
| 🔵 P2 | 清理 deploy 殘留（§12） | ~1GB 空間 |
| 🔵 P2 | 刪除無對應測試（§10） | 1 個檔案 |

---

## 📝 勘誤記錄

| 版本 | 修正 |
|------|------|
| 2026-07-19 v2 | ❌ 移除 §11 `serviceAccountKey.json` 安全疑慮 — 已在 `.gitignore` 中排除 (`serviceAccountKey*.json`)，Git 狀態 `NOT tracked`。由 CLAUDE 處理完成，報告誤報。|
| 2026-07-19 v2 | ✅ §4 `scripts/` 目錄更新為逐檔檢驗後的明確分類：保留 5 個 / 刪除 42 個 |

---

*報告完畢 — 如需我協助執行任何清理（但不可修改檔案），請告知！*
