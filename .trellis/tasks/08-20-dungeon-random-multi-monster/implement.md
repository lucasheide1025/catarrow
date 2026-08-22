# 實作計畫

## 1. 遭遇與相容契約

- [ ] 先以測試定義一般格 50/50、精英 1+2、Boss 1+2、穩定 seed、唯一 instance ID 與 legacy single fallback。
- [ ] 實作純函式地下城 encounter resolver，Boss 主怪只接受既有 locked snapshot。
- [ ] 將 encounter snapshot 納入單人 recovery map state 與組隊 coordination pending room 的序列化／恢復契約。
- [ ] 加入舊 active room 缺欄位的 contract regression tests。

## 2. 地下城 multi 戰鬥 adapter

- [ ] 擴充／包裝 multi-monster v2 server resolver，使其接受 dungeon encounter、run-scoped HP／buff 與 dungeon battle identity。
- [ ] 單人踩格：先持久化 encounter，再依 kind 導向 legacy single 或 multi UI。
- [ ] 組隊踩格：房主 transaction 鎖 encounter，再建立／發布 multi battle room；隊員只訂閱導頁。
- [ ] 對接完整權威 loadout：角色三圍、卡片／世界王卡、裝備專精、貓咪羈絆、休息與商人加成，並以 browser／Functions golden fixtures 驗證。
- [ ] 保存並恢復目標 HP、狀態、貓咪 battle state、隊員 HP、round、resolution 與 presentation identity。

## 3. 結算與經濟安全

- [ ] 建立 encounter／target／member 級冪等 claim resolver 與資料 schema。
- [ ] 每隻 target 各自判定素材與一般怪物卡；格子級金幣、經驗、收藏品每位成員一次。
- [ ] 精英／Boss 特殊獎勵只認 primary target；小怪不能取得特殊倍率或觸發通關。
- [ ] 單人勝利原子地保存 claim marker、run loot、玩家狀態與格子 cleared。
- [ ] 組隊把 persisted battle summary 冪等合併至 coordination room，最終 member claim 仍一次性入帳。
- [ ] 覆蓋重新整理、雙擊、重送 callable、隊員斷線／離隊與房主重連測試。

## 4. UI、演出與續戰

- [ ] 地下城 multi 掛接既有手機戰場，標示主精英／Boss，維持固定操作盤與不顯示多餘隊友狀態。
- [ ] 沿用不可快轉 presentation queue 與 SFX；增加同時／連續擊殺及一擊清場回歸測試。
- [ ] 演出完成前封鎖勝敗、領獎、清房與地圖跳轉；session 內完成的 resolution 不重播。
- [ ] 單人與雙帳號組隊分別驗證重連會回到同一 encounter 與同一戰鬥進度。

## 5. Rules、驗證與部署閘門

- [ ] Firestore rules：新 v2 active combat client 只讀，coordination host 權限與 legacy room 相容。
- [ ] Functions 全量測試、前端相關測試、Firestore rules emulator、production build。
- [ ] 以 390×844 與 360×640 驗證一般 multi、精英 1+2、Boss 1+2，包含秒殺完整演出。
- [ ] 部署前執行 generated combat runtime 同步／parity 檢查；先 Functions／rules、後 frontend。
- [ ] 部署後以單人與兩帳號煙霧測試驗證 encounter 穩定、回合權威、回地圖與不重複獎勵。

## Review gates

- Gate A：純 resolver 與 schema 測試通過後，才接 UI。
- Gate B：冪等獎勵與 legacy 相容測試通過後，才允許部署 Functions／rules。
- Gate C：真機／雙帳號完整故事通過後，才部署 production frontend。

## Rollback

- 前端可先回退至只建立 legacy single；不得刪除已建立的新 encounter／battle documents。
- Functions／rules 保留讀取 legacy 與新 schema 的相容期；若新 multi 停用，以 feature gate 阻止建立新場，讓已開始的場次完成或由清理 callable 安全結束。

