# 全倉庫清查報告（多餘／用不到／舊程式碼）— 給 CODEX 重整用

- 產出：2026-08-09（基準 HEAD = `b7e68b35`）
- 方法：程式掃描（541 個非測試 src 檔逐一查 import）、資產引用掃描（2268 個 public 檔）、git 追蹤狀態、依賴比對、手動驗證每個候選。
- 前一份商店導向報告：`docs/second_brain/codebase-audit-old-new-2026-08-09.md`（§1~§3 商店/探索地圖細節，本報告含其結論）。
- 舊報告：`dead-code-audit-report-2026-07-19.md`、`CODEBASE_AUDIT_AND_REDUNDANCY_REPORT.md`（2026-07-21）——本報告已**重驗**其中項目，標註哪些仍成立、哪些已改善。

---

## 0. 執行摘要

| 類別 | 數量 | 可節省 |
|---|---|---|
| src 確定孤兒檔案（無人 import） | **21 個**（見 §1） | ~4,000+ 行 |
| src 生產死碼但有測試（疑被取代） | 3 個（combatModifiers / combatRoundState / dungeonBossReward） | 需決策 |
| 死碼函式（db.js / villageShopDb.js） | 4 組 | ~150 行 |
| public 強候選未用資產 | **126 個** | ~75MB（官網照片原始檔為主） |
| 根目錄一次性腳本（**已 git 追蹤**） | 16 個 fix_*.py ＋ 3 個一次性 js | ~1,500 行 |
| backups/ 舊程式碼副本（**已 git 追蹤**） | 33 檔 | 一整批重複的舊 src |
| 根目錄 0 位元組雜檔（**已追蹤**） | 2（findstr / npx）＋ nul（已忽略） | — |
| 部署殘留目錄 | 3 個（.deploy-staging-2 702MB／.deploy-static-home 335MB／.deploy-staging 空） | **~1GB** |
| package.json 未用依賴 | 1（date-fns） | — |
| website 未用頁面 | 1（index-redesign.html） | — |

---

## 1. src 孤兒檔案（無人 import／require）— 本次以「只認 import」重掃

### 1.1 ✅ 確定孤兒（21 個，可安全刪除）

**與 2026-07-19 報告相同（當時建議刪但至今未刪）**

| 檔案 | 行數 | 備註 |
|---|---|---|
| `src/components/admin/AdminAchievements.jsx` | ~150 | 只有 AdminBooking 註解提及 |
| `src/components/admin/AdminAdventurerGuild.jsx` | ~200 | 完全孤立 |
| `src/components/cat/CatAnimationToggle.jsx` | ~50 | 完全孤立 |
| `src/components/dungeon/DungeonPathSelect.jsx` | ~120 | 完全孤立 |
| `src/components/member/CouncilBattle.jsx` | **~1212** | 只有 damage.js 註解提及，最大孤兒 |
| `src/components/member/GatheringBattle.jsx` | ~300 | 完全孤立 |
| `src/components/member/HonorTicker.jsx` | ~150 | 完全孤立 |

**新發現（本次掃描新增）**

| 檔案 | 備註 |
|---|---|
| `src/components/admin/AdminCostControlBanner.jsx` | 完全孤立 |
| `src/components/BadgeSVG.jsx` | 完全孤立 |
| `src/components/booking/ParticipantCountPicker.jsx` | 完全孤立 |
| `src/components/member/AdventurerGuild.jsx` | 已被「冒險者公會遠征」(2026-07-25) 取代，只有註解 |
| `src/components/member/ShopSimulator.jsx` | **商店 V2 孤兒**（833 行，從未 commit、無人 import，詳見商店報告 §1） |
| `src/battle/BattleEngine.js` | 註解說舊 inline 戰鬥 UI 已於 08-02 刪除；getHitText/HIT_TEXTS 無人用 |
| `src/battle/useBattleRound.js` | 完全孤立（只有自己檔內的範例註解） |
| `src/guild/domain/guildBalanceSimulation.js` | 完全孤立 |
| `src/lib/buffPool.js` | 完全孤立 |
| `src/lib/campSessionsDb.js` | 完全孤立 |
| `src/lib/equipGradeCurve.js` | 完全孤立 |
| `src/lib/monsterConfig.js` | 完全孤立（7/19 報告指它與 lootTable 重複定義 rollCoinChestTier / COIN_CHEST_TIERS） |
| `src/zombie/bridge/crossWorldAdapter.js` | 完全孤立 |
| `src/zombie/ZombieTestApp.jsx` | 測試用 app，完全孤立 |

### 1.2 🟡 生產死碼但有測試覆蓋（別直接刪，先決策）

| 檔案 | 測試 | 說明 |
|---|---|---|
| `src/lib/combatModifiers.js` | combatModifiers.test.js（225 行） | 生產線已改用 combatSkillEngine；此檔只剩測試在維護 |
| `src/lib/combatRoundState.js` | combatRoundState.test.js | 同上模式 |
| `src/lib/dungeonBossReward.js` | dungeonBossReward.test.js | 同上模式（注意 functions/ 另有同名 dungeonBossReward.js，是不同模組，別混淆） |

**決策選項**：若公式已由新模組取代 → 刪檔＋把測試遷移到新模組；若仍是唯一公式來源 → 把它們接回生產（可能是 bug）。

---

## 2. 死碼函式（有定義、無呼叫端）

| 位置 | 函式 | 證據 |
|---|---|---|
| `src/lib/villageShopDb.js` | `serveShop` | 唯一呼叫端是孤兒 ShopSimulator.jsx；現役 V3 用 settleVillageShopAutoSales/completeLiveShopSession |
| `src/lib/db.js:5244` | `exchangeVillageMaterial` | 全 repo 無呼叫 |
| `src/lib/db.js:5286` | `exchangeMaterialsForChest` | 全 repo 無呼叫 |
| `src/lib/db.js:5485-5492` ＋ `AdminVillageManager.jsx` | 市集兌換設定（get/save/subscribe + DEFAULT_BATTLE_EXCHANGE 編輯器） | 寫入無人讀（CatVillage 消費端已移除）。二選一：刪除或接回讀取端 |

---

## 3. public 資產（2268 檔：769 用 / 1499 候選）

### 3.1 🔴 強候選：目錄與檔名都未出現在程式碼（126 個）

| 目錄 | 數量 | 說明 |
|---|---|---|
| `public/images/archery/real/...`（含「這個是我原始分類的你參考有沒有需要/Converter_...」整包） | ~115 | **官網照片原始檔 dump（72MB）**，含簡體字樣「Converter_148_files_660.9MB…／新增資料夾 (4)」——原始照片分類暫存，程式碼無引用。⚠️ 可能是你網站改版要用的素材，**刪除前請確認**（可先移到 repo 外） |
| `public/cats/portraits_v2/` | 8 | `niuniu_062/072/anime/bright/cute/v4`、`_t_daming`、`_t_niuniu`——v2／temp（`_t_` 前綴）立繪，現役立繪在 `cats/portraits/` |
| `public/images/badges/first_checkin.png` | 1 | 未被引用 |

### 3.2 🟡 弱候選：目錄有被動態引用、但個別檔名不是字面值（1373 個）— 需逐目錄比對 id 對照

這些目錄在程式碼中有路徑字串（例如 `/assets/board/${tile}.webp`、`/cards/monsters/${id}.webp`），**大部分是現役**；真正該查的是「目錄內的檔名集合 vs 程式碼 id 集合」的差集。最大目錄：

```
244  /assets/board          158  /cards/monsters      158  /monsters-battle
150  /assets/dungeon        133  /items/monster-materials  109  /ui/village
 42  /assets/guild/chibi     42  /ui/battle-bg         41  /assets/chests
 37  /ui/dungeon/first-clear 35  /council/obs          25  /assets/shop
```

**建議**：重整時對這幾個目錄寫一次「id 對照差集」腳本（把程式碼裡組路徑用的 id 全集 vs 檔案名），只刪真正沒被任何 id 對到的。

### 3.3 src/assets（18 檔）

僅 1 檔未被 import：`src/assets/dungeon/event-hall.webp`。

---

## 4. 根目錄雜物

### 4.1 🔴 一次性修復腳本（**全部已被 git 追蹤**，7/12 批次）

`add_onpotionused.py`、`fix_brace_bin.py`、`fix_brace_v2.py`、`fix_catid.py`、`fix_chesttype_and_profile.py`、`fix_endbattle_brace.py`、`fix_handleMBBattleEnd.py`、`fix_logs_and_arrows.py`、`fix_missing_brace.py`、`fix_monsterbattle_step2.py`、`fix_onpotion.py`、`fix_party_potions.py`、`fix_partybattleroom.py`、`fix_potions_v2.py`、`fix_potions_v3.py`、`fix_undo_brace.py`（16 個）

＋ 一次性 js：`init-admin-member.js`、`test-booking-concurrency.js`（已追蹤）

**建議**：整批 `git rm` 移出 repo（內容都在 git 歷史裡，真要找回可用 `git log`）。

### 4.2 🔴 backups/（33 檔已被 git 追蹤）

`backups/2026-07-14_card-potion-optimization/`、`2026-07-14_firestore-optimization/`、`2026-07-16_performance-charts/` —— **整批舊 src 檔案的完整副本**（db.js、CatVillage.jsx、MonsterBattle.jsx…）。git 本身就是版本控制，這批是重複的舊程式碼。**建議整包 `git rm -r backups/`**。

### 4.3 🟡 0 位元組雜檔與 Windows 意外產物

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `findstr` | **已追蹤**（0 bytes） | Windows 指令誤導出的空檔 |
| `npx` | **已追蹤**（0 bytes） | 同上 |
| `nul` | 已 gitignore | Windows 空檔 |
| `{src` | 未追蹤（空目錄） | 打錯字產生的空資料夾 |
| `firestore-debug.log` | 未追蹤 | 除錯 log |
| `備份到D槽.bat/.ps1`、`install.ps1`、`backup.js`、`restore.js`、`codebase-ui.zip` | 已 gitignore | 本機工具/備份 |

### 4.4 tmp 暫存（前次報告已列）

`tmp-cardgacha-preview.html`、`tmp-event-cards-v2-preview.html`、`tmp-event-scenes-preview.html`、`tmp-tile-preview.html` ＋ `tmp/` 整包（imagegen 來源圖數百張）。**建議把 `tmp/` 與 `tmp-*.html` 加入 .gitignore**（目前只有 `.tmp-dev-server*` 與 `.staging/image-generation/` 被忽略）。

---

## 5. 部署殘留（~1GB，未追蹤）

| 目錄 | 大小 | 說明 |
|---|---|---|
| `.deploy-staging-2/` | **702MB** | 舊部署暫存（含 node_modules） |
| `.deploy-static-home/` | **335MB** | 舊靜態首頁部署 |
| `.deploy-staging/` | 0 | 空目錄 |

7/19 報告就建議刪除，至今仍在。**整包刪除即可**（git 無追蹤）。

---

## 6. Git 狀態（重整前必知）

- **3 個 worktree**：
  - `catarrow`（main，b7e68b35）— 本機
  - `.worktrees/website-home-redesign`（feat/website-home-redesign，b0b0a472）— 官網改版分支
  - `catarrow-deploy-worldboss`（detached ffae25cb）— 部署用
  - ⚠️ 重整時**只動 main worktree**；`.worktrees/` 內是另一個 checkout，別在那邊刪檔。
- **多批未提交工作**（商店 V6~V11＋CODEX、探索地圖事件卡、背包磁磚回復）——**絕不可 `git add -A`**，分批 commit 邊界見商店報告 §7。
- `serviceAccountKey.json` 未被追蹤（已 gitignore）✅；`firebase`、`storage.rules` 在根目錄是舊版殘留（`firebase.json`/`firestore.rules` 才是現役）🟡。

---

## 7. 依賴與網站

| 項目 | 狀態 |
|---|---|
| `date-fns`（package.json dependencies） | 🔴 **全 repo 無人 import**（只出現在 package.json 與部署殘留副本）→ 可移除 |
| `react-scripts` | ✅ 建置工具（scripts 用），非未用 |
| `firebase-admin` | ✅ functions 用 |
| `website/index.html` | ✅ 現役（引用 12 個子頁） |
| `website/index-redesign.html` | 🟡 未被任何頁面引用（改版草案，可刪或留參考） |
| `website/*/`（beginner-guide 等 12 子頁） | ✅ 全部被 index.html 引用 |

---

## 8. 重複實作／命名衝突（沿用 7/19＋7/21 報告，本次抽驗仍成立）

| 衝突 | 位置 | 建議 |
|---|---|---|
| 商店 UI V2/V3 並存 | `ShopSimulator.jsx`（孤兒）vs `ShopSimulatorV3.jsx`（現役） | 刪 V2；CODEX 場景化完成後 V3 正名 |
| 金幣商店 vs 貓貓村商店命名 | `shopData.js`（coinshop）vs `villageShop*.js` | 文件/命名區分（詳見商店報告 §1.4） |
| db.js 巨型檔（5234+ 行） | `src/lib/db.js` | 7/21 建議拆分 memberDb/billingDb/achievementDb，至今未做；重整核心項目 |
| bookingDb.js vs db.js 約課邏輯重疊 | — | 7/21 建議歸一至 bookingDb |
| `rollCoinChestTier`/`COIN_CHEST_TIERS` | `lootTable.js` vs `monsterConfig.js` | monsterConfig 已是孤兒（§1.1），刪它即解 |
| `markQuestDone` | `db.js` vs `partyDb.js` | 已用 as 別名規避，🟡 可合併 |
| `CONSOLATION_REWARD` | `villageGoalData.js` vs `worldBossData.js` | 🟡 命名衝突，重整時改名 |
| 大量 sfx 無引用（sfxMonsterAtk 等） | `sound.js` | 7/19 已列，本次未重驗，建議列入 |
| 超大檔案（>2000 行） | db.js／MonsterBattle.jsx／DungeonBattleRoom.jsx／PartyBattleRoom.jsx／CatVillage.jsx／MemberPractice.jsx | 7/19 已列，仍成立 |

---

## 9. CODEX 行動清單（依優先級）

### P0 — 安全（先做）
1. **只動 main worktree**；commit 分批（見商店報告 §7 分界）；**絕不用 `git add -A`**。
2. `.gitignore` 補上 `tmp/`、`tmp-*.html`（防誤 commit 數百張圖）。

### P1 — 直接可刪（無爭議）
3. `git rm` 根目錄 16 個 `fix_*.py`＋`add_onpotionused.py`＋`init-admin-member.js`＋`test-booking-concurrency.js`（§4.1）。
4. `git rm -r backups/`（§4.2，33 檔舊 src 副本）。
5. `git rm findstr npx`＋刪 `nul`、`{src`（§4.3）。
6. 刪 21 個孤兒檔（§1.1）——**CouncilBattle.jsx（1212 行）與 ShopSimulator.jsx（833 行）是最大宗**。
7. 刪死碼函式 4 組（§2）。
8. 刪 `.deploy-staging-2/`、`.deploy-static-home/`、`.deploy-staging/`（§5，~1GB）。
9. 移除 `date-fns` 依賴；處理 `website/index-redesign.html`（§7）。
10. 刪 `src/assets/dungeon/event-hall.webp` 與 `public/images/badges/first_checkin.png`。

### P2 — 需決策（先問使用者）
11. `public/images/archery/real/` 原始照片 dump（72MB）——**可能是有用的官網素材**，先移到 repo 外或問使用者再刪（§3.1）。
12. `portraits_v2/` 8 張——確認現役立繪後刪（§3.1）。
13. combatModifiers / combatRoundState / dungeonBossReward：遷移測試後刪，或接回生產（§1.2）。
14. 市集兌換設定：刪除或接回讀取端（§2）。
15. 弱候選資產（1373）：對 244/158/158/150 等目錄跑「id 對照差集」後清差集（§3.2）。

### P3 — 結構重構（重整主體）
16. 拆分 `src/lib/db.js`；歸一約課邏輯；合併重複常數（§8）。
17. 商店模組收進 `src/lib/shop/`、V3 正名（CODEX 場景化完成後）。
18. 大檔拆分子元件（§8 超大檔案清單）。

---

## 10. 驗證方式（每階段刪完都要跑）

```bash
CI=true npx react-scripts build          # 前端編譯
CI=true npx react-scripts test --watchAll=false   # 前端測試（目前 2015+ 全過）
cd functions && node --test              # functions（71/71）
```

刪孤兒檔後若有測試引用它們會立刻紅燈（例如 combatModifiers 那類先確認測試再動）。

---

*本報告所有「孤兒」皆經程式掃描＋手動 grep 雙重驗證；弱候選（§3.2）與需決策項（§11-14）為建議確認清單，非自動判定。*
