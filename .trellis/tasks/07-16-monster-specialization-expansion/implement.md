# Implementation plan

> 只有使用者審閱並明確批准開始實作後，才執行本清單。全程本機，不部署。

## Phase 0 — 基線與隔離

- [ ] 記錄現有 lint/test/build、bundle chunks及主要戰鬥流程基線。
- [ ] 建立 `monsterExpansionV1` 本機 feature flag；預設關閉。
- [ ] 為舊60 monster/card/material ID建立不可變快照測試。
- [ ] 建立每階段可獨立提交與回滾的工作批次。

驗證：flag關閉時現有單人、組隊、地下城、世界王、箱子與卡片測試完全不變。

## Phase 1 — 純資料 Catalog

- [ ] 依 `monster-catalog.md` 建立252 monsters與materials。
- [ ] 建立12 common abilities與252 signatures。
- [ ] 建立cards、specializations、loot與conversion catalog。
- [ ] 建立 `validateCatalogs()` 與完整性測試。
- [ ] 生成／接入192張新怪圖及必要舊圖重製；保留ID。

Gate：252/252 monster↔material↔signature↔card↔asset全部匹配；126一般／84小王／42大王分類正確。

## Phase 2 — 共用領域 Resolver

- [ ] 實作 seeded RNG、break ratio、effect primitives與ability resolver。
- [ ] 實作status、shield、minimum-HP、companion ordering。
- [ ] 實作reward、pity、boss-room、chest、conversion resolver。
- [ ] 實作specialization unlock/upgrade/activation/effects。
- [ ] 全部以純函式單元測試覆蓋邊界與四段破解。

Gate：相同seed/context重跑結果完全一致；失敗交易不產生部分寫入。

## Phase 3 — 單人一般打怪

- [ ] 接入新monster、skill phase與貓咪行動。
- [ ] 接入本體素材×3、卡片與保底。
- [ ] 接入音效／震動獨立設定與reduced motion。
- [ ] 驗證T1～T6、三一般怪與弱化／普通／強悍變體。

Rollback：關flag回舊單人 adapter。

## Phase 4 — 組隊一般打怪

- [ ] 移除依隊員人數的monster stat scaling。
- [ ] 實作權威round、團隊break、每人貓咪與個人×5素材。
- [ ] 修正靶紙／箭數／回合設定重連記憶。
- [ ] 實作合格成員、斷線待領與唯一發獎鍵。

Gate：2～4人、不同靶紙與3／6箭、房主更換、重連、重複snapshot皆不重複結算。

## Phase 5 — 地下城單人／組隊

- [ ] 地圖生成時鎖定BOSS房抽選與大王保底計數。
- [ ] 接入兩小王／一大王、王素材、卡片pity、圖鑑道具。
- [ ] 接入固定獎勵與選擇箱；組隊使用個人choice key。
- [ ] 沿用首殺道具與既有圖鑑品階。
- [ ] 進行中舊run維持version0，新run才使用version1。

Gate：刷新、返回、斷線、換房主不得重抽王或重發選擇箱。

## Phase 6 — 世界王

- [x] 建立24隻世界王第2／4回合強攻資料。（`worldBossSkillData.js`,PRD 22-26 逐條;48 skillId 唯一測試）
- [x] 接入個人break與強攻演出；R2最低1HP、R4可擊倒。（`WorldBossAttack.finishRound` 接 `worldBossStrikeEngine`;R1/R3 末預告橫幅;once-only key + 減益/預告入中途記憶）
- [x] 確認12隻六族王倍率1.3/1.8、教練與貓王1.6/2.2。（引擎 bossClass 驗證 + 24 王資料測試）
- [x] 確認治療型貓王改為輸出＋異常，所有王不可回全域HP。（妹妹/哥哥/大娘=輸出+減益;技能結算只動個人出戰,無全域HP寫入）
- [x] 未完成出戰不得提交傷害、獎勵或保底。（`attackWorldBoss` 僅在 `submitAttack`（5回合完/王死/玩家倒）呼叫;中途離開只留本機 save）

> 未接：貓王「防禦型攻擊後自身護盾/減傷、治癒型自我回復」的**王側**演出加成（PRD 21 王 profile 的 self 效果）——目前 24 王皆走同一結算,只差資料;若要王自身護盾需在 boss HP 側加欄位,留待後續批次。

## Phase 7 — 寶箱、卡片、素材與裝備UI

- [ ] 更新所有普通／地下城／挖掘／商店／世界王箱池與禁入規則。
- [x] 實作素材同Tier轉換、同族5換1與批量原子交易。（`materialConversionDb.convertMaterials` transaction;UI `ExpansionMaterialsPanel` 掛素材頁 materials tab,含批量與即時預覽）
- [x] 實作9專精購買、升級失敗、pity、切換與效果顯示。（`EquipSpecializationPanel` 掛裝備頁;`equipSpecializationDb` transaction 驗證金幣/素材;新 collection `equipSpecializations` 規則已加,**須手動貼 Console**;戰鬥端 apply* 效果接線另批）
- [ ] 更新傳說／神話精煉成本及舊nextMats一次性相容。
- [ ] 重構卡片頁為族系→Tier六張分組，保留裝備／升星／市集。

## Phase 8 — 全域驗證與本機驗收

- [ ] lint、typecheck（若專案有）、unit、integration、build全部通過。
- [ ] 以360／390／430px檢查所有入口、戰鬥預告、獎勵、卡片、素材、專精。
- [ ] 鍵盤操作、44px觸控區、對比、reduced motion、音效與震動開關。
- [ ] Bundle比較：資料catalog可拆chunk；戰鬥初始頁不得載入252張圖片。
- [ ] 模擬至少100,000次掉落／升級，檢查掉率、pity、金幣消耗與養成速度。
- [ ] 完成本機多人E2E：單人、組隊、地下城單／組、世界王、重連、重複提交。
- [ ] 產出本機預覽給使用者；不部署。

## 必測矩陣

| 範圍 | 案例 |
|---|---|
| Catalog | 252唯一、全引用、舊60快照、Tier cap、王素材禁入 |
| Combat | 四段破解、技能排程、貓擊殺取消、毒不致死、R4世界王可致死 |
| Party | 2/3/4人、不同箭數、不同靶紙、掉線／重連、房主更換、零有效回合 |
| Dungeon | 35/35/30抽選、第四房大王保底、舊run、選1/選2、首殺不重發 |
| Loot | ×3/×5、變體進位、王素材×1、箱池排除、舊箱新版池 |
| Pity | 小王第5次、大王第8次、首次保證、每怪每人獨立、重連不加次 |
| Conversion | 每Tier比例、T6禁止升、批量上限、金幣不足、交易衝突 |
| Specialization | 10k解鎖、Lv1～10成本、失敗扣除、+15pp、第4次必過、切換 |
| Migration | 舊卡／裝備／圖鑑、舊nextMats一次、缺新欄位預設、flag rollback |
| UI | 360/390/430、懶載入、鍵盤、reduced motion、音效／震動分開 |

## 完成定義

- 所有Phase gates通過且沒有新增警告。
- Flag關閉與開啟兩條路徑皆build成功。
- 不修改登入、預約與官網商業邏輯。
- 使用者本機驗收後才討論部署；本任務本身不包含部署。
