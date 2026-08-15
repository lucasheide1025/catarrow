# 狩獵戰鬥演示與結算重建執行計畫

## 1. 建立可重現測試

- [ ] 新增 reducer 測試：輸入 X → 刪除 → 再輸入，不得在提交前改變怪物狀態或消耗效果。
- [ ] 新增回合解析冪等測試：同 submission ID 重試只產生同一份 resolution。
- [ ] 新增貓咪事件測試：每個 resolution 每位裝備貓咪的玩家最多一筆 `cat_action`。
- [ ] 新增演示測試：重播事件不呼叫 resolver／持久化函式。
- [ ] 新增獎勵測試：結算 UI 只接受 claim receipt，不接受舊 loot preview。

## 2. 分離草稿與正式結算

- [ ] 將 `SCORE_ARROW` 限縮為草稿資料與純預估；移除 RNG、異常合併及一次性效果消耗。
- [ ] 將完整箭組計算移入可測試的 round resolver。
- [ ] 建立並傳遞穩定 `submissionId`，對雙擊、重渲染與重試加鎖。
- [ ] 讓單機 `BattleScreen` 與組隊 `submitArrows/processPartyRound` 都輸出統一 `RoundResolution` adapter。

## 3. 重建演示控制器

- [ ] 建立純階段游標／controller 與自動時間表。
- [ ] `BattleScreen` 僅消費 resolution events，不在動畫 effect 內計算遊戲結果。
- [ ] 合併目前 `BattleScreen`、`PartyBattleRoom` 的重複勝負與貓咪演示觸發。
- [ ] 保留組隊等待與回合休息，摘要後自動進入下一回合。
- [ ] 確保訊息特效會依時程消失，不會阻擋下一階段。

## 4. 玩家加成抽屜

- [ ] 建立共用 bonus view model，正規化卡片、專精、種族、異常、抗性、護盾與限時狀態。
- [ ] 建立手機 bottom sheet 與不遮怪物的單一按鈕。
- [ ] 單機與組隊接入同一元件；移除組隊常駐來源表與效果清單。
- [ ] 加入狀態數量、中文翻譯與無資料狀態測試。

## 5. 權威獎勵收據

- [ ] 建立 `BattleRewardReceipt` normalizer 與 pending retry store。
- [ ] 擴充單機 callable，使所有正式單機自由狩獵獎勵一次冪等入帳並回傳完整收據。
- [ ] 將組隊 callable 回應正規化為同一收據，移除 `previewReward`、客戶端 `roll*` 與領取時再次生成寶箱。
- [ ] 勝利後自動 claim；失敗保存相同 claim ID，自動重試且未確認前不揭示掉落。
- [ ] 保存／恢復已確認收據，避免重整後查舊資料拼湊。

## 6. 重建共用結算 UI

- [ ] 新增自由狩獵專用的手機結算頁與共用獎勵項目卡。
- [ ] 單機與組隊共用主結構；組隊只追加隊伍貢獻區。
- [ ] 顯示同步中、已確認與可重試狀態。
- [ ] 確保再戰建立新 battle ID，返回不會再次入帳。
- [ ] 舊戰鬥沒有收據時明示無法還原，不讀背包／舊 log 猜獎勵。

## 7. 驗證與清理

- [ ] 執行戰鬥 reducer、卡片時間、貓咪引擎、組隊流程、獎勵 ledger/callable 測試。
- [ ] 加入 360px 手機版 DOM／版面契約，驗證怪物不被加成資訊遮擋。
- [ ] 搜尋並移除自由狩獵中的舊 loot preview、重複 claim 與動畫副作用。
- [ ] 執行完整 `npm test`、lint 與 production build。
- [ ] 以單機及兩名玩家組隊完成實際流程測試：X 刪除重輸、貓咪一次、離線同步、重整收據、勝敗結算。

## 高風險檔案與回復點

- `src/components/battle/BattleScreen.jsx`：先以測試鎖住 reducer，再逐段抽離。
- `src/components/member/MonsterBattle.jsx`：伺服器收據完整前不可刪除舊入帳路徑。
- `src/components/party/PartyBattleRoom.jsx`：先改 claim 顯示，再移除 preview；不可讓舊房無法結束。
- `functions/` 的 claim callable：每個 schema 變更需向後相容且保持 claim ID 冪等。

## 驗證指令

```powershell
npm test -- --runInBand
npm run lint
npm run build
```
