# 🎲 貓貓村大富翁探索地圖 — 規格書（2026-07-24 定案，待實作）

> 定位：**取代雞肋的「協力採集」外殼**，用大富翁踩格玩法提高實際價值。保留採集的底層養成（貓咪 XP/羈絆、六種材料）。
> 本文件只定「規格＋內容」，功能 code 待作者看過後才開工。

---

## 1. 核心規則（定案）

| 項目 | 決定 |
|------|------|
| 移動 | 純骰子 1~6，**不綁箭**、傳統大富翁 |
| 進場限制 | **不限次數**；限制在「手上的骰子餘額」——沒骰子就不能骰 |
| 骰子來源 | 每日重置**補滿至 15 顆**（上限 15、不疊加囤積） |
| 組隊骰子 | **只吃房主的骰子**；隊員骰子 0 也能加入一起玩 |
| 強度 | **刻意做強**：一次 session（約 15 骰、繞 1.5~2 圈）≈ 2~3 趟地下城的材料量 |
| 素材階級上限 | ＝所選族對應**建築物的 stage**（蓋越高能刷越高階；進場依該族建築等級鎖上限，非地下城進度） |
| 採集模式 | 進場選 **1 of 6**；6 模式＝**冒險六大族 ＝ 貓貓村六經濟體 ＝ 六採集任務**（此對應不變），玩家自選要刷哪一族的資源 |
| 挖礦/素材格 | 給該模式對應族的**家族素材 + 村資源**（六資源：ore/melon/fish/meat/driedfish/can） |
| 繞圈 | **普通一輪包**（非大獎）；另新增村目標「繞 N 圈」 |

---

## 2. 棋盤結構（28 格環形）

羊皮紙雙金屬邊框、中央 catarrow 探險地圖 + 進度條；踩格炫光高亮。格子類型（重複排列成 28 格）：

| 格 | 類型 | 效果摘要 |
|---|---|---|
| 🏁 | 起點/繞圈 | 繞回起點發普通一輪包 |
| 📦 | 素材格 | 所選族的家族素材 ×3~6（階級抽到玩家上限）；依族分色 |
| ⛏️ | 挖礦格 | **射 6 箭**，完成度決定額外加乘（基準 ×6~15，命中越好倍率越高）＋15% 皮草/家族素材 |
| 👾 | 怪物格 | 就地**射 6 箭** → 完成度 S/A/B/C → 300/200/150/100% × 挖礦基準；S 送寶箱 |
| 💧 | 箭露格 | 箭露 +(15~50)×T |
| 🪙 | 金幣格 | 金幣 +(80~400)×T |
| 🎰 | 扭蛋幣格 | 扭蛋幣 ×1~3 |
| 🧪 | 藥水格 | 隨機藥水 ×1（品質隨 T） |
| 🎁 | 寶箱格 | **射 6 箭**，完成度決定拿到幾箱（1~3 箱）；族系箱/通用材料箱（接現有箱系統） |
| 🐱 | 貓咪羈絆格 | 貓咪 XP +50~150、羈絆 +1~2 |
| 🎴 | 命運格 | 抽命運牌（戲劇/移動/得失，見 §5） |
| 🎴 | 機會格 | 抽機會牌（資源/搞笑，見 §5） |

> T = 玩家進度階級 1~6。獎勵數值表見上一輪定案（本檔 §7 附完整表）。

---

## 3. 移動與回合流程

### 單人
1. 玩家進入 → 選採集模式（六種材料之一，決定素材/挖礦格給哪種）。
2. 花 1 骰 → 隨機 1~6 步順時針移動（踩格動畫）。
3. 結算落點格獎勵（命運/機會格 → 抽卡+翻牌動畫）。
4. 重複直到骰子用完或玩家離開。繞回起點發普通一輪包。

### 組隊（全員一起一顆棋）
- **一顆共享棋子**，全員一起前進（不分開輪流，避免拖太久）。
- **只消耗房主骰子**；隊員 0 骰也能同樂。
- 每個事件都要**確保全員能通過**（獎勵發給全員；需全員確認的事件要有「等待/自動跳過」保護）。
- **斷線重連 + 中途存檔**：比照遠征組隊（`TeamExpeditionBattle`）——房間狀態存 Firestore，重進以房主狀態重建；房主離開有存檔。
- **人數加成**：獎勵豐富度 `×(1 + 0.12×(人數−1))`，8 人上限 ≈ ×1.84；3~4 人以上額外開 rareBonus（高階材料/寶箱機率）。
- 訪客/兒童：限 **T1~T2** 難度。

---

## 4. 射箭格（怪物 / 挖礦 / 寶箱 — 一律射 6 箭）

三種「射箭格」踩到時彈出視窗、**就地射 6 箭**，沿用現有完成度計分（`TargetFaceOverlay`/分數），完成度決定獎勵。**不看能力值**（核心是採集取代打怪）。

| 格 | 6 箭完成度 → 效果 |
|---|---|
| 👾 怪物格 | S=300% / A=200% / B=150% / C=100% × 挖礦基準；S 級額外送寶箱 |
| ⛏️ 挖礦格 | 完成度決定額外倍率：S≈×1.8 / A≈×1.5 / B≈×1.2 / C≈×1.0（基準 ×6~15 材料） |
| 🎁 寶箱格 | 完成度決定箱數：S=3 箱 / A=2 箱 / B~C=1 箱 |

- 組隊：建議**房主代表射 6 箭**，完成度結果**獎勵發全員**（避免全員各射拖太久）。

---

## 5. 命運 / 機會事件系統

- **兩牌堆**：命運（Fate，戲劇/移動/得失）、機會（Opportunity，資源/搞笑）。各 **50 張** → `src/lib/boardEvents.js`。
- **抽卡 + 翻牌動畫**：踩到事件格 → 卡背飛入 → 翻面 → 顯示卡面美術 + 文案 → 套用效果。卡片需美術（後續 ComfyUI 生成命運/機會兩種卡框）。
- **調性比例**：真效果 ≈ 60%、純 flavor ≈ 40%。純 flavor 給微獎勵（+1~5 金幣）避免「翻到空牌」失落感。
- **內部梗**：教練/師母/yumi、9 隻貓（大娘/哥哥/妹妹/妞妞/哈吉/寶寶/悠悠/小安/點點）、七族台灣民俗（林投姐/魔神仔/好兄弟/城隍/十八王公義犬…）。
- **組隊限定事件**：送禮/偷取/全隊加成（`effect.team`）。

### boardEvents.js schema
```js
// { id, deck:"fate"|"opp", text, flavor:boolean, effect: EffectObj | null }
// EffectObj.type:
//   gain     { resource, min, max }        得資源（材料/箭露/金幣/扭蛋幣/貓XP…）
//   lose     { resource, min, max }        失資源（有下限保護，不歸零）
//   move     { steps }                     ±格（負=後退）
//   teleport { tile }                      傳送到最近的某類格（"monster"/"mining"/"chest"…）
//   dice     { delta }                     加骰/失回合（delta<0 = 跳過）
//   multiplier { next, factor }            下次某類格獎勵 ×factor
//   chest    { kind }                      給寶箱（"family"/"universal"）
//   catBond  { xp, bond }                  貓咪養成
//   trigger  { event }                     觸發 "mining" | "monster"
//   team     { sub, ... }                  組隊限定：gift/steal/allBuff（單人時退化成自身微獎勵）
//   micro    { coins }                     純 flavor 微獎勵
```

---

## 6. T 階連動（由建築物決定）

- 棋盤「材料類」掉落的階級上限 = **所選族對應建築物的 `getBuildingStage(level)`**（該族＝該村經濟體＝該建築）。蓋越高、能刷越高階，讓建築投資有意義。
- 建築目前 **5 階**（Lv≤4/8/12/16/其餘=5），故棋盤材料上限為 **T1~T5**；**T6 材料維持地下城/王房專屬**，不從棋盤取得。
- 高階材料機率隨建築 stage 提升；不改 `getBuildingStage` 本身。
- ⚠️ 待確認：滿級建築（stage 5）是否要放行到 T6，或維持 T5 上限（本規格暫定 **T5 上限**）。

---

## 7. 獎勵範圍表（定案，可再微調）

| 格子 | 單次範圍（T=進度 1~6） |
|---|---|
| 素材格 | 該族家族素材 ×3~6（階級上限＝該族建築 stage） |
| 挖礦格 | 射6箭；基準 ×6~15，完成度加乘 ×1.0~1.8 ＋15% 皮草/家族素材 |
| 怪物格 | 射6箭；S/A/B/C = 300/200/150/100% × 挖礦基準；S 送寶箱 |
| 寶箱格 | 射6箭；完成度 S/A/B~C = 3/2/1 箱（族系/通用箱，階級隨建築） |
| 箭露格 | +(15~50)×T |
| 金幣格 | +(80~400)×T |
| 扭蛋幣格 | ×1~3 |
| 藥水格 | 隨機藥水 ×1 |
| 寶箱格 | 族系/通用箱（階級隨進度） |
| 貓咪羈絆格 | XP +50~150、羈絆 +1~2 |
| 繞圈 | 材料 ×3 + 箭露 + 少量金幣 |
| 組隊加成 | ×(1+0.12×(人數−1))，上限 ≈×1.84 |

---

## 8. 資料模型 + Firestore 規則

```js
// members/{id}.villageBoard  （新欄位 → 必須加進 firestore.rules members hasOnly 白名單！）
{
  dice: 15,                 // 手上骰子餘額
  diceGrantedDate: "YYYY-MM-DD",  // 每日發放判斷
  boardPos: 0,              // 單人棋子位置
  lapCount: 0,              // 累計繞圈（供村目標「繞 N 圈」）
  boardSeed: 12345,         // 當前棋盤佈局種子（每日/每局換）
  mode: "ore",              // 進入時選的採集模式
  pendingEvent: null,       // 未結算的命運/機會卡（斷線保護）
}
```
- ⚠️ **`villageBoard` 一定要加進 `firestore.rules` 的兩個 members hasOnly 清單**（本專案已多次踩「新欄位沒白名單→靜默 permission-denied」）。
- 組隊房間：沿用 `dungeonRooms` 模式新增 board 房型（共享棋子位置、房主骰子、pendingEvent、reconnect/save）。

---

## 9. 村目標新增「繞 N 圈」

- `villageGoalDb.js` 新增 goalType `"board_laps"`；`villageBoard.lapCount` 增加時 hook 進度。
- 繞圈本身只發普通一輪包（非大獎），大獎留給村目標達標。

---

## 10. 檔案變動與 Phase 切分

**Phase 1a（單人核心）**
- `src/lib/boardData.js`：28 格佈局、格子類型權重、獎勵計算 `rollTileReward(tile, tierCap, mode, partyMult)`。
- `src/lib/boardEvents.js`：命運/機會 100 張（本輪交付）。
- `src/lib/villageBoardDb.js`：`getBoardState`/`grantDailyDice`/`spendDiceMove`/`settleTile`/`drawEventCard`。
- `src/components/member/CatVillageBoard.jsx`：棋盤 UI（羊皮紙金框、踩格動畫、繞圈）。
- `src/components/member/CatVillageBoardEventCard.jsx`：抽卡+翻牌動畫。
- `CatVillage.jsx`：以 CatVillageBoard 取代 `VillageGoalBanner` 入口（村目標併進來）。
- `firestore.rules`：members 白名單加 `villageBoard`。

**Phase 1b（組隊）**
- `src/lib/villageBoardTeamDb.js`：比照 `expeditionTeamDb`——建房/加入/共享棋子/房主骰子/pendingEvent/斷線重連/中途存檔/人數加成。
- 組隊房型接 `dungeonRooms` 或新 collection；限 T1~T2 給訪客。

**Phase 1c（美術）**
- ComfyUI 生命運/機會卡框 + 格子圖示（沿用 gen 管線）。
- **作者指示：一切盡量用生成圖片、少用 SVG/emoji**。UI 一律「`<img>` + emoji fallback」（比照 RuneImg），素材由 ComfyUI 生：`public/assets/board/`（格子圖示 tile_<type>.webp、羊皮紙框 frame.webp、命運/機會卡框 card_fate/opp.webp、骰子 dice.webp）。

---

## 11. 已定案 / 待確認
- ✅ 每日骰：補滿至 **15**（上限 15、不囤積）。
- ✅ 射箭格：怪物/挖礦/寶箱皆 **射 6 箭**，完成度決定加乘/箱數。
- ✅ 階級上限：由**所選族建築 stage** 決定（T1~T5；T6 暫維持地下城專屬）。
- ⏳ 待確認：滿級建築是否放行 T6（暫定否）。

---

## 12. 實作進度（autonomous，2026-07-24 起）
- [ ] Phase 1a-1：`boardData.js`（佈局/獎勵計算）
- [ ] Phase 1a-2：`villageBoardDb.js`（狀態/每日骰/移動/結算/抽卡）+ firestore.rules 白名單
- [ ] Phase 1a-3：`CatVillageBoard.jsx`（棋盤 UI/骰/踩格動畫）
- [ ] Phase 1a-4：`CatVillageBoardEventCard.jsx`（抽卡翻牌）+ 6 箭射箭格整合
- [ ] Phase 1a-5：接進 `CatVillage.jsx`（取代 VillageGoalBanner 入口）
- [ ] Phase 1b：組隊（房主骰/共享棋/斷線重連/存檔/人數加成）
- [ ] Phase 1c：ComfyUI 卡框 + 格子圖示
