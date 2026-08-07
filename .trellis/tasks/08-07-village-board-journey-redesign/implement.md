# Implement：探索地圖重製（7 張直線旅程地圖）

> 規格見 `prd.md`＋`design.md`。開工前先讀 `docs/second_brain/village-board-spec.md`（舊規格，很多概念沿用）。

## Phase 0：資料保留（已於 2026-08-07 完成）

- [x] **Firestore 完整備份**：`backups/firestore-2026-08-07T04-46-24/`（82 collection、38,980 筆、`members.json` 162 人含 40 人 `villageBoard` 已驗證）——`node scripts/backup-firestore.js backups`。
- [x] 舊資料遷移規則已寫進 `design.md §9`：`boardPos/lapCount/mode` → `maps.{舊mode}.{pos/clears}`，`normalizeVillageBoard` 補齊 7 圖欄位，不丟任何玩家進度。
- ⚠️ 踩坑：`backup-firestore.js` 匯出完成後會因 Firestore SDK keepalive **卡在退出**（指令不結束、但資料已寫完）——判斷完成看 `_summary.json` 是否寫出，不要等指令回傳。

## Phase 1：資料層（純函式＋DB）✅ 已完成

- [x] `src/lib/boardJourney.js`：`seedRandom`（mulberry32）、`generateJourney(modeId, seed)`、`rollTileType`（權重表）、`windingPath`＋位置/buff 數學（nextPos/applyTrapPos/applyShortcutPos/mergeBuffs/applyJourneyMultipliers/combineRewards）。
- [x] `boardJourney.test.js`＋`boardJourneyRewards.test.js`：26 測（seed 恆等、長度界、端點、遷移、每日重置假 legacy、位置/buff 數學、新格子獎勵）。
- [x] `boardData.js`：**不刪** `BOARD_LAYOUT`（組隊版仍用）；`TILE_TYPES` 加 8 種新格子；`rollTileReward` 加新分支（含 Boss 分帶倍率 S×1.5/A×1.0/B×0.75/C×0.5）。
- [x] `villageBoardDb.js`：**新增** journey 函式（`startJourney`/`rollJourney`/`settleJourneyTile`）——舊 `rollAndMove`/`settleBoardTile` 保留給舊棋盤與組隊；`subscribeBoardState` 加 `_hasVillageBoard` 旗標。
- [x] `firestore.rules`：**不需改**——members hasOnly 白名單的頂層 `villageBoard` 已涵蓋 nested `maps.{id}` 寫入（含 buffs）。
- [x] 驗證：全專案 1882 測過＋build 成功。

## Phase 2：單人 UI ✅ 已完成

- [x] `CatVillageBoard.jsx` 全重寫：地圖選單（7 卡片：進度 %/完成次數/骰子）→ 旅程畫面（橫向捲動大畫布＋SVG 路徑線＋path 絕對定位＋棋子自動捲動追蹤，尊重 prefers-reduced-motion）。
- [x] `TileIcon` 沿用 img→emoji fallback（新格子無 webp 自動 fallback）。
- [x] `GatherDemo.jsx`：A 純動畫（1.6s 進度條）＋ C 三選一，隨機擇一；說明範圍與實際獎勵一致（×3~6 / +9~23 / 混合）。
- [x] 射箭格：只有 `JOURNEY_SHOOTING_TILES`（monster/boss）開 6 箭 overlay；怪物沿用 `public/monsters-battle/` 立繪（pickFamilyMonster）；採集格走 GatherDemo 不射箭。
- [x] 終點 Boss 完成 → BoardRewardPopup 大獎 → `clears+1`＋村目標 board_laps hook＋旅程重置換新 seed（顯示位置歸零）。
- [x] buff 系統：營地 campMult ×1.2（村資源）/ 強化 nextShootMult ×2（下一個射箭格）/ 貓夥伴 catmate（射箭完成度上限 +5%）已實作。
- [x] 陷阱後退 2 格＋扣金幣（下限 0）；捷徑前進 3~5 格（可能直達終點→接著打 Boss）；市集佔位；風景/命運/機會微獎勵。
- [ ] ⚠️ 單人流程還需真人/裝置實測（骰→採集演示→射箭格→終點→重置）。組隊等待保護（15s 自動選）留給 Phase 3。

## Phase 3：組隊

- [ ] `villageBoardTeamDb.js`：房間存房主旅程（hostId/modeId/seed/pos/diceLeft）；共享棋子；隊員顯示房主路線。
- [ ] 斷線重連＋中途存檔（沿用現有 reconnect/save）。
- [ ] 驗證：房主進度正確、隊員 0 骰可玩、重連恢復。

## Phase 4：整合與收尾

- [ ] 村目標 `board_laps` hook 改吃 `clears`（`villageGoalDb.js`）。
- [ ] 舊資料遷移測試（舊 boardPos/lapCount → per-map）。
- [ ] 全專案測試＋ESLint＋production build。
- [ ] 使用者核准後才提交、部署（含 firestore.rules 上傳）。

### 進度 2026-08-07（晚）：2.5D 格子資產＋分岔路＋獎勵分層

**已完成**
- ✅ 2.5D 格子全量：7 族 × 21 種（含 fork）＋21 共用 fallback＋board_bg = **169/169 資產驗證通過**
  （scripts/verify-journey-tiles.mjs 檢查 WebP 魔數/大小/覆蓋；gen-journey-tiles.py 已加 fork 提示詞）
- ✅ 分岔路口（fork）：findNextTile 純函式＋chooseForkPath DB＋二選一模態（左路素材/右路怪物），
  前方 15 格無目標退回固定步數；組隊版暫不支援（Phase 3 待評估）
- ✅ 統一獎勵分層分級：MONSTER_BAND_TABLE（S×2.0/A×1.4/B×1.0/C×0.6＋素材4/3/2/1＋寶箱40/25/10/0%）、
  MINING_BAND_TABLE 五階、Boss 沿用四階；修掉「怪物格 threshold 沒傳→恆過→平獎」的隱形 bug；
  組隊版 UI band 顯示與 scoreToBand 對齊
- ✅ 驗證：1888 測全過、build 成功、聯絡表＋旅程模擬圖呈現在 Preview（tile-sheet-preview.html）
- ✅ 資產檢查工具：scripts/verify-journey-tiles.mjs（可重跑）

**待辦**
- Phase 3：組隊吃房主旅程（含 fork 是否納入組隊、15 秒自動選保護）
- Phase 4：真人實測（骰→採集→射箭→終點→重置手感）＋Code Review＋部署
- 若嫌某張格子風格：`gen-journey-tiles.py <族> <格子> --force` 重跑即可

---

## Phase 3（組隊版吃房主旅程）完成 — 2026-08-07

**villageBoardTeamDb.js**
- `startBoardRoom`：讀房主 `villageBoard.maps.<mode>`（normalizeVillageBoard）——有進行中旅程（length≥100）直接續走、沒有就開新 seed；`journeySeed` 寫進房間，全端確定性重算同一條路線。
- `roomRollAndMove`：旅程內前進（nextPos 夾終點）＋陷阱後退 2／捷徑前進 3~5（可能直達 Boss）／分岔路（pendingFork + 兩路選項）／buff 格（camp/empower/catmate → room.buffs）／怪物（隨機半數射手）／Boss（全員射）；每步同步寫回房主 `maps.<mode>.pos`（斷線不丟進度）。
- `finalizeBoardShoot`：貓夥伴 +5% 完成度、shootMult/campMult 進 pendingSettle、強化用完即棄；Boss 完成→房主 clears+1＋換新 seed＋歸零＋清 buff＋房間同步。
- `claimBoardSettle`：fate/opp 純金幣、trap 每人扣金幣（下限 0）、mining 預設「完成」帶（不射箭）、乘 applyJourneyMultipliers。
- 新增 `voteForkPath`（成員投票 left/right → forkVotes）＋`resolveFork`（房主，票多者勝、平手房主決定、fallback +2/+4、防分岔接龍）。
- `forceAdvanceRoom` 卡分岔路→用現有票直接決定；`clearRoomPending` 涵蓋 pendingFork。

**CatVillageBoardTeam.jsx（重寫）**
- 蜿蜒旅程畫布（76px 格子、88×96 間距、鏡頭雙軸跟隨）、per-map 2.5D TileIcon 三層 fallback。
- 分岔路全員投票 UI（live 票數、20 秒自動投左路、票多者勝）。
- Boss 全員射 6 箭、結果分帶 S/A/B/C（Boss 用終點分帶 ×1.5/1.0/0.75/0.5，怪物用 MONSTER_BAND_TABLE）。
- 移除舊 8x8 棋盤、fate/opp 事件卡、採集射箭、lapped。
- 組隊採集基底資源補乘 partyMult（boardData.js）。

**boardAdvanceGate.test.js**：+5 測（分岔路投票閘門）。
**驗證**：53 相關測＋全專案 1893 測全過＋build 成功。

**reviewer 抓到的 bug（已修）**
1. resolveFork 無重試→暫態失敗整房卡死（allPassed=true 時 stuckLong 不觸發、resync 不清 pendingFork）→補 2.5 秒重試迴圈。
2. Boss 結果畫面顯示怪物表數字（×2.0/素材4/寶箱40%）→改終點分帶（×1.5/12 素材/2 寶箱）。
3. 分岔跳躍被同 seq 動畫閘門擋掉（棋子瞬移）→lastMove.fork 旗標放行重播。
4. 組隊採集沒乘 partyMult（8 人房跟單人一樣多）→採集基底補乘。
