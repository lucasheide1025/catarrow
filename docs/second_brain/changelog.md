# 📝 changelog — 變更日誌
> 每次功能完工後由 Claude 自動寫入。格式：日期 / 改了什麼 / 為什麼 / 踩坑提醒

---

## 2026-06-25（後段：打怪掉落修正 + 貓貓決鬥/地下城傷害 + 村莊累積生產 + 市集重設計）

### 打怪模式不再掉落徽章碎片與貓貓箱
**為什麼**：36 隻怪物打怪後給徽章碎片（frag_*）與貓貓箱（cat type chest）不符合設計方向。
**改了什麼**：`MonsterBattle.jsx`：
- `makeChests` 解構移除 `catChest`，不加入 mainChests
- 移除 catChest log 行
- `rollMaterialDrops` 結果 `.filter(m => !m.id?.startsWith("frag_"))` 過濾碎片
- 移除 `addFragments` 呼叫與 import
**踩坑提醒**：frags 已被獨立分出來（`mats.filter(frag_)`），直接在 rollMaterialDrops 後過濾更乾淨。

### 貓貓在決鬥模式（DuelRoom）傷害
**為什麼**：貓貓只存了名字，沒有真正參戰。
**改了什麼**：
- `duelDb.js` 新增 `calcCatDmg(catAtk, targetDef)` helper（6箭合算，0.5~2.0倍隨機）
- `applyPlayerCatToRoom` 加 `catAtk` 參數，存到 `team${team}.${memberId}.catAtk`
- `processDuelRound` 在 attacks 加總前插入貓貓攻擊段（effAliveA/B 各選目標，isCat:true）
- `DuelRoom.jsx`：從 hook 取 `catATK`，傳入 `applyPlayerCatToRoom`

### 貓貓在地下城模式（DungeonBattleRoom）傷害
**為什麼**：同上。
**改了什麼**：
- `dungeonDb.js` 新增 `calcCatDmg` helper
- `updateDungeonMemberStats` 加 `catAtk` 參數，存到 `members.${memberId}.catAtk`
- `processDungeonRound` Step 3 結束後插入「貓貓攻擊」mini round（isCat:true）
- `DungeonLobby.jsx`：import `useCatCompanion`，取 `myCatATK`，傳入兩個 updateDungeonMemberStats 呼叫

### 村莊累積生產模型（T2 → T1+T2 同時產出）
**為什麼**：高等建築應同時產出低階材料，方便玩家管理資源，升級更有感。
**改了什麼**：
- `villageData.js` `calcPendingResources`：tiered 資源改為 loop tier 1~maxTier，各自以同速率計算
- `db.js` `collectVillageResources`：同樣邏輯，非分層資源（箭露/射手等）維持原邏輯
**踩坑提醒**：non-tiered 資源（arrowdew、archer、gachaToken）不進 loop，避免 fracKey 衝突。

### 市集重設計（6 種族材料包 + 藥水箱 + 怪物卡包 + 黃金寶箱）
**為什麼**：原本 4 種通用寶箱不夠明確，玩家無法選擇要哪族材料。
**改了什麼**：
- `CatVillage.jsx` `BATTLE_EXCHANGE`：6 族材料包（ghost/mountain/exam/insect/workplace/temple）各消耗對應建築 T1 資源 ×30，加藥水箱/卡包/黃金寶箱
- `doBattleExchange` 加 `family` 參數，傳入 `exchangeMaterialsForChest`
- `db.js` `exchangeMaterialsForChest` 加 `family` 可選參數，加入寶箱 object
**踩坑提醒**：`gotThis` key 改為 `type + family`（否則不同族包 justGot 無法區分）。

---

## 2026-06-25（貓貓等級+裝備+技能系統）

### 舊 catStatMult 被動加成移除（設計簡化）
**為什麼**：TYPE × 羈絆等級的被動加成（射手 ATK/DEF 百分比）與新的 ID 群組主動技能重疊，且 catStatMult 雖有計算但從未真正套用到戰鬥傷害。簡化為「TYPE 只決定基礎 ATK 倍率，羈絆等級只影響技能觸發機率與效果幅度」。
**改了什麼**：
- `catData.js` CAT_TYPES skills 全部改為搞笑貓咪行為敘事（無任何數字加成）
- `useCatCompanion.js` 移除 `getCatStatMult` import 和 `catStatMult` return
- `DungeonBattleRoom.jsx`：移除 catStatMult，光環顯示改為「陪戰中」
- `DuelRoom.jsx`：`applyPlayerCatToRoom` 固定傳 1.0
- `PartyBattleRoom.jsx`：`getArcherStats` catStatMult 參數全換成 1.0
**踩坑提醒**：catData.js 的 `getCatStatMult` / `getCatBattleBonus` 函式保留（以防 UI 有用），但已不被 hook 呼叫。

### 貓貓等級 / 裝備 / 技能 三系統實作
**為什麼**：從輔助型升為「真正陪伴玩家的戰鬥夥伴」，與射手等級系統平行。

**改了什麼**：
- `src/lib/catLevel.js`（新）：200級、XP公式與射手相同，`CAT_TIER_XP` 戰鬥後給 XP
- `catData.js` 新增：`CAT_SKILL_GROUPS`（前三補血/中三攻擊/後三防禦）、`CAT_EQUIP_SLOTS`（5格）、`calcCatEquipBonus`、`calcForgeCost`、`calcCatSkillChance/Effect`
- `catDb.js` 新增：`addCatXP`、`upgradeCatEquip`（同步 equippedCat 快取）；`equipCat` 更新同步 `catXP+equip`
- `useCatCompanion.js` 重寫：戰鬥數值整合等級+裝備加成；新增 `triggerCatSkill()`、`saveXP()`
- `MonsterBattle.jsx`：
  - ATK技能：貓咪攻擊後追加 XX%~翻倍傷害
  - HEAL技能：回復射手 HP
  - DEF技能：`catDefShieldRef` 保護下回合計數器攻擊（減傷/完全格擋）
  - 勝利後呼叫 `saveXP(CAT_TIER_XP[monster.tier])`
- `CatVillage.jsx` 新增「🔨 鍛造」TAB：`ForgePanel` 顯示 5 格裝備、費用（村莊材料）、升強化/升階按鈕

**踩坑提醒**：
- 計數器攻擊用 `let cdmg` 才能被貓盾修改（原本是 const）
- `equippedCat.equip` 可能是 `undefined`（舊資料），預設 `{}` → 所有格位視為「普通 +0」
- `calcForgeCost` 回傳 null 代表已達神話+5（極限）

---

## 2026-06-25

### 報到系統改為教練審核制（刪除日常任務）
**為什麼**：舊系統讓學生自己做任務（三選一），太複雜且難以管理；新流程改為教練手動確認出席。
**改了什麼**：
- `db.js`：`submitCheckin` 改建 `pending`；新增 `approveCheckin`/`rejectCheckin`；`subscribePendingCheckins` 加 `pending` filter
- `DailyQuest.jsx`：**完整重寫**，移除任務/施法/Buff，改為 pending/rejected/active/classEnded 狀態顯示 + 下課按鈕
- `MemberApp.jsx`：新增浮動報到視窗（`sessionStorage("checkin_popup_shown")` 防本 session 重複彈）
- `AdminDailyQuest.jsx`：「待施法」→「待審核」，通過/不通過按鈕；inProgress 改用 `!classEnded` 判斷；done 改用 `classEnded` 判斷
**踩坑提醒**：舊 `done` 是 `questDone`，新 `done` 是 `classEnded`。歷史資料的 `questDone` 欄位不影響新邏輯（篩掉了）。

### 修復：下課後不再觸發里程碑 popup
**為什麼**：下課時已結算箭露，若再去練習還會觸發里程碑，導致重複獎勵。
**改了什麼**：`MemberPractice.jsx` 加 `classEndedRef`（useRef）+ `subscribeMyCheckin` 訂閱；saveRound 前檢查 `!classEndedRef.current`。
**踩坑提醒**：用 useRef 而非 useState，避免訂閱更新觸發不必要的重新渲染。

### 首頁射手等級 widget 擴展
**為什麼**：玩家需要在首頁快速看到自己的完整數值與資源狀況。
**改了什麼**：`MemberHome.jsx` 新增 `calcEquippedBonus/calcArcherStats/archerLevelBonus` import；widget 顯示實際 HP/ATK/DEF（三層加成相加）；新增資源列（金幣/箭露/轉蛋幣/今日箭數）。
**踩坑提醒**：`calcArcherStats` 需要 `dexStats`，而 `computeDexStats` 在同一元件已有呼叫，直接複用即可。

### 修復：怪物卡片效果在選擇畫面不顯示
**為什麼**：原本 `cardCollRef`（useRef）不觸發重新渲染，選擇畫面讀到的永遠是初始空值。
**改了什麼**：`MonsterBattle.jsx` 改成 `useState + useRef` 雙軌——`useState` 給渲染用，`useRef` 給 `startBattle` 異步函式同步讀取。
**踩坑提醒**：這是 React closure stale 問題的標準解法，其他元件若有同樣情境可參考此模式。

---

## 2026-06-22（前次 session）

### 效能優化（3 個函式）
**為什麼**：買裝備/升級裝備/申請月卡 UI 卡住，因為有多次串行 Firestore getDoc 讀取。
- `upgradeEquipSlot`：5 次 ops → 2 次平行（接受 clientData，不需 getDoc）
- `submitMonthlyCardRequest`：移除 getDocs/getDoc，接受 `clientCard/hasPending`
- `MemberApp` practice logs：改用 `subscribeTodayPracticeLogs`（只讀今日）
- `MemberHome`：`useState(false)` 移除阻塞 spinner
**設計依據**：CLAUDE.md 規則「優先瀏覽器計算，不需防作弊」

### 射手等級系統（新檔案 archerLevel.js）
**為什麼**：讓射箭練習有長期成長感，各戰鬥模式都需要回饋。
**改了什麼**：新增 `archerLevel.js`；5 種戰鬥模式加 `addArcherXP`；4 處顯示等級（Header/MemberHome/MonsterBattle選擇/MemberProfile）。
**踩坑提醒**：Header 顯示的是 Lv.X，首頁 widget 顯示的是完整 HP/ATK/DEF（三層加成）。

### 組隊打怪靶紙選擇器修復
**為什麼**：`TargetFmtPicker` 出現在戰鬥每一回合，應只在設定時選一次。
**改了什麼**：`PartyBattleRoom.jsx` 移除戰鬥階段的 `TargetFmtPicker` block。
