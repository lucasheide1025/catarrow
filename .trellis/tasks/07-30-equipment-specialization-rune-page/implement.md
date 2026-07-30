# 執行清單

1. [x] 更新裝備系統規格，將符文／專精管理責任改到獨立頁。
2. [x] 生成並檢查「專精與符文」背包入口主視覺，保存至專案資產目錄。
3. [x] 建立 `EquipmentProgressionPage` 頁面外殼與響應式主分頁。
4. [x] 重構 `EquipSpecializationPanel` 為清楚的三部位卡片、狀態摘要與操作流程。
5. [x] 重構 `EquipmentRunePanel` 的製作、庫存、合成 UI。
6. [x] 從 `RPGEquipPanel` 抽出 socket 邏輯，建立 `EquipmentSocketPanel`。
7. [x] 精簡 `EquipmentPage`，移除專精、符文與 socket 重複 UI。
8. [x] 在 `MemberInventoryHub` 加入跨欄大型圖片入口卡。
9. [x] 串接 `MemberApp`、`AdminApp`、背包 active route 與 `MemberProfile` 入口。
10. [x] 檢查訪客／兒童模式不會取得寫入入口或誤用教練帳號。
11. [x] 既有符文、專精、訪客與路由測試涵蓋資料契約；執行完整測試。
12. [x] 執行完整測試與 production build。
13. [x] 專精手機版改為部位切換式單欄卡片，拆分效果、成本、成功率與操作區。

## 高風險檔案

- `src/components/member/RPGEquipPanel.jsx`
- `src/components/member/EquipmentPage.jsx`
- `src/components/member/EquipSpecializationPanel.jsx`
- `src/components/member/EquipmentRunePanel.jsx`
- `src/components/member/MemberInventoryHub.jsx`
- `src/pages/MemberApp.jsx`
- `src/pages/AdminApp.jsx`
- `src/pages/GuestApp.jsx`

## 驗證門檻

- 原本所有專精與符文交易仍使用相同資料函式。
- 開洞、鑲嵌、卸下均可操作且狀態即時更新。
- 裝備頁不再殘留符文或專精長區塊。
- 手機 360px、平板與桌面沒有橫向溢出。
- 圖片有正確 alt／裝飾語意、尺寸與載入策略。
- 完整 `npm test -- --watchAll=false --runInBand` 與 `npm run build` 通過。
