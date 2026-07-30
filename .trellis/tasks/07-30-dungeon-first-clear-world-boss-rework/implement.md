# Implement：地下城首次通關與世界王誕生系統重構

## 執行順序

### Phase 1：先移除成本警訊

- [ ] 從 `AdminApp` 的教練後台與射手模式移除 `AdminCostControlBanner` 渲染與 import。
- [ ] 保留 `CostControlProvider` 與 `assertCostCapability`。
- [ ] 更新／新增測試，確認警訊不渲染但能力保護仍有效。

### Phase 2：建立可重現的地下城測試

- [ ] 為 stable `familyTierKey` 建純函式測試。
- [ ] 重現「兩個不同 run ID、相同族系與 T 等級都被當首殺」。
- [ ] 重現「組隊每位玩家缺少自己的首次通關紀錄／必掉道具」。
- [ ] 重現重連／重複領取不應重發限定收藏品。

### Phase 3：地下城資料與 UI

- [ ] 新增穩定地下城鍵與個人首次通關狀態 helper。
- [ ] 重構全服首殺 transaction，只吃房主。
- [ ] 新增個人首次通關 self-claim transaction，紀錄與收藏品原子發放。
- [ ] 修改單人遠征、組隊遠征與地圖戰鬥結算，分開三種結果。
- [ ] 修改全域公告，只接真正 global first clear。
- [ ] 在地下城選擇／儲存卡／組隊入口顯示個人首次通關狀態。
- [ ] 新增首次通關收藏品圖片與共用小圖元件。
- [ ] 更新 Firestore rules 與規則測試。

### Phase 4：建立可重現的世界王測試

- [ ] 純函式測試 `status=defeated + HP=6721` 必須正規化為 0。
- [ ] 測試 active + HP<=0 必須判為 defeated。
- [ ] 測試攻擊交易只有真正從正 HP 扣到 0 才能寫尾刀。
- [ ] 測試最後一名低傷害玩家仍被列為 pending reward。
- [ ] 測試新王建立後仍可找到前一場未領獎勵。
- [ ] 測試擊倒回傳驅動勝利結算，而不是使用舊 event prop 判敗。

### Phase 5：世界王狀態與待領修復

- [ ] 新增世界王狀態正規化並套用 Lobby、Attack、後台與介紹動畫。
- [ ] 新增 terminal repair，修正 defeated 但 HP>0 的舊文件。
- [ ] 移除 `WorldBossLobby` 對 `autoSpawnWorldBoss` 的呼叫。
- [ ] 將舊 auto spawn 變成無副作用相容函式。
- [ ] 新增 bounded pending reward 查詢，取代只讀最新歷史。
- [ ] 將 preview／claim 改為同一份鎖定獎勵資料並加冪等 claim marker。
- [ ] 確認「雪莉」案例可以看到、預覽並領取。

### Phase 6：世界王降臨進度

- [ ] 建立 spawn cycle 純函式、資料存取與冪等 operation marker。
- [ ] 世界王擊倒結算時建立 8 小時 resting cycle。
- [ ] 接入箭數、地下城通關、七族擊殺、村地圖骰子四個合法貢獻點。
- [ ] 實作五條件並行、任一達標召喚與 48 小時 deadline。
- [ ] 實作隨機王（排除上一隻）與一次性 spawn lock。
- [ ] 在會員首頁／世界王大廳顯示降臨進度。
- [ ] 在後台顯示門檻、進度、狀態與手動召喚；保留現有指定建立。

### Phase 7：獎勵與結算畫面

- [ ] 建立每王 reward snapshot 與獎勵分類。
- [ ] 重做保底、參戰、貢獻、前三名與尾刀顯示。
- [ ] 確認高額金幣、箭露、寶箱及既有卡片／卷軸／收藏品都有發放。
- [ ] 世界王真正擊倒後強制進勝利動畫與結算入口。

## 驗證指令

```powershell
npm test -- --watchAll=false
npm run lint
npm run build
```

另執行：

- 地下城 stable key／首次通關／全服首殺單元測試；
- 世界王正規化／pending reward／spawn cycle 單元測試；
- Firestore rules emulator 測試（若本機環境可用）；
- 搜尋 `autoSpawnWorldBoss(`，一般 UI 呼叫端必須為 0；
- 搜尋 `AdminCostControlBanner`，`AdminApp` 渲染必須為 0；
- 本機以教練、一般會員與低等會員各走一次世界王結算。

## 風險與回滾點

- `src/lib/dungeonDb.js`、`DungeonBattleRoom.jsx`、`DungeonExpedition.jsx`、`TeamExpeditionBattle.jsx` 已有未提交工作，修改時只做局部 patch，禁止覆蓋既有差異。
- `src/lib/worldBossDb.js`、`WorldBossLobby.jsx`、`WorldBossAttack.jsx` 已有未提交修正，先建立回歸測試再改。
- Firestore 規則屬正式資料安全邊界；未通過規則測試不得部署。
- 世界王降臨進度先在本機功能旗標開啟；若召喚交易驗證失敗，可關閉自動降臨但保留手動後台。
- 不執行破壞性資料遷移，不刪除舊首殺、世界王事件或歷史文件。

