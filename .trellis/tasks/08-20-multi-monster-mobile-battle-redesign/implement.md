# 多人複數怪手機戰鬥與完整加成整合執行計畫

## 1. 統一三圍

- [ ] 以 fixture 重現 raw profile 與角色頁總三圍差異。
- [ ] 建立統一 adventurer stat contract，涵蓋基礎、證照／紀錄、圖鑑、RPG 裝備、射手等級與卡片靜態三圍。
- [ ] 新增 golden tests，比對角色頁、單人複數怪與多人複數怪 server snapshot 的 HP／ATK／DEF 與來源總和。
- [ ] 移除 `MemberApp` 直接傳 raw `profile.hp/atk/def` 作為複數怪正式值的路徑。

## 2. LoadoutSnapshot v2

- [ ] 定義／驗證 schema、source fingerprint、effect version 與舊資料預設。
- [ ] Functions 從正式玩家資料建立 snapshot，不接受 client 計算值。
- [ ] 接入一般卡三圍、族系攻防、套裝、天賦、異常及世界王卡 v2 被動。
- [ ] 接入貓咪等級、ATK、羈絆、modifier 與 battle state。
- [ ] 測試偽造 payload 無效、active 中途換裝不改 snapshot。

## 3. Server-authoritative rounds

- [ ] 新增／擴充 targeted callable：開始 v2、提交／修改、鎖定與結算。
- [ ] 以 `submissionId + revision` 支援鎖定前修改；round phase 原子鎖定。
- [ ] 升級純 `resolveMultiMonsterPartyRound`，只接受 snapshot 與合法 submission。
- [ ] 使用決定性 seed 產生版本化 `RoundResolution events`。
- [ ] 實作集火／全體的多目標卡片、異常、貓咪及死亡轉向。
- [ ] 測試重送、競爭結算、斷線重連、stale round、非法目標與 forged revision。
- [ ] 更新 Firestore rules，禁止 client 直接改權威戰鬥欄位。

## 4. Mobile battle shell

- [ ] 拆出 compact status bar、responsive battlefield、rear marker、event overlay、fixed action dock 與 bottom sheets。
- [ ] 移除重複 roster／完整 MemberCard；常駐隊友只顯示存活、HP、ready。
- [ ] 三隻前排怪改為可縮放目標；後排符文改為緊湊 marker。
- [ ] 建立兩排六鍵 score pad、緊湊箭組、撤回／長按清空與主要送出。
- [ ] 送出後顯示鎖定與 N/M；resolving 前可修改，鎖定後停用。
- [ ] 以 `100dvh`、safe-area、breakpoints 驗證 `390×844`、`360×640` 無頁面捲動。

## 5. 效果與事件呈現

- [ ] 從 snapshot／resolution 建立共用 bonus view model，不解析顯示文字計算。
- [ ] 常駐自己 HP 與最多三個狀態；建立效果／隊伍／戰報 bottom sheet。
- [ ] 依 event ID 播放卡片、貓咪、異常、傷害、治療與護盾；重連不重算／重播副作用。
- [ ] 支援 reduced motion、長名稱與未知 catalog ID 中文 fallback。
- [ ] 建立 resolution presentation queue／event cursor；terminal result 等 queue 播放完才揭示。
- [ ] 將箭矢、命中／爆擊／miss、卡片／異常、貓咪、反擊、擊倒、回合及勝敗事件映射到既有 SFX，播放錯誤不可卡住 queue。
- [ ] 新增秒殺回歸測試，驗證完整 event order、擊倒演出與勝利延後顯示。
- [ ] 驗證 overlay 沒有 skip／fast-forward，點擊不會推進 cursor；reduced motion 仍完整消費 queue。

## 6. 相容、獎勵、部署

- [ ] 新房 `combatVersion: 2`；舊 active v1 房維持舊 resolver。
- [ ] 保持 `claimMultiMonsterBattleReward` trusted receipt 與 battleId 冪等，不生成 client 預覽掉落。
- [ ] 更新錯誤碼／中文訊息與非敏感 logs。
- [ ] 僅 targeted deploy；部署前依 handoff 確認 `CAT_ARCHERY_VERCEL` 狀態。

## 7. 驗證

- [ ] 執行 stat parity、card、world-boss card、cat、multi-target、authority、idempotency、rules 與 UI contract tests。
- [ ] 執行 `npm test -- --watchAll=false --runInBand`、存在時執行 lint，以及 `npm run build`。
- [ ] 於 `390×844`、`360×640` 驗證選目標、模式、3／6 箭、撤回、長按清空、送出、修改、等待、事件與下一回合。
- [ ] 雙帳號與 8 人 fixture 驗證 ready、重送、重連、勝敗與 reward claim。
- [ ] 比對角色頁、單人／多人複數怪三圍，並在效果 sheet 核對卡片與貓咪來源。

## 高風險與回復點

- `MemberApp.jsx`／`MemberProfile.jsx`：避免統一三圍時讓其他模式重複加成。
- `MultiMonsterPartyRoom.jsx`：UI shell 與 server contract 分開落地，保留 v1 renderer。
- `multiMonsterPartyDb.js`／`multiMonsterPartyBattle.js`：先以 authority、idempotency tests 鎖住再切責任。
- `functions/index.js` 與新增模組：targeted deploy，不改不相關 Functions，不升級 `firebase-functions`。
- `firestore.rules`：用 emulator 確認阻擋權威欄位寫入但不阻斷合法訂閱。
