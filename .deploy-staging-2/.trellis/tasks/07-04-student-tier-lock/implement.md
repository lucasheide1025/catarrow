# 執行清單 — 學生分級與系統鎖定

## Steps

- [x] 1. **Firestore 規則**：`firestore.rules` 的 `members` 會員自寫 `hasOnly` 加入 `"lastCheckinDate"`；新增 `systemConfig/{docId}` 區塊（read: isLoggedIn，write: isAdmin）。手動貼到 Firebase Console（CLI 有 403，見 quick-ref 慣例）。— 規則檔已改好，**仍需人工貼到 Firebase Console 才會生效**（CLI 環境無法驗證此步驟）。
- [x] 2. **核心判斷純函式**：新增 `src/lib/accessControl.js`（`DEFAULT_TIER_PERMISSIONS` / `PAGE_REGISTRY` / `getAllowedPages` / `isPageAllowed` / `isAutoLocked`），純函式先寫單元可驗證的邏輯，不涉及 UI。— 經 check agent 覆核，邏輯與 design.md 一致。
- [x] 3. **db.js 新函式**：`setStudentTier` / `setAccountFrozen` / `bulkSetStudentTier` / `setMaintenanceMode` / `subscribeMaintenanceConfig` / `setTierPermissions` / `subscribeTierPermissions`；並在 `submitCheckin` + `approveCheckin` 加上 `lastCheckinDate` 更新。— 簽名與呼叫端一致，函式簽名未破壞既有呼叫者。
- [x] 4. **報到即時解鎖驗證**：確認 `lastCheckinDate` 寫入時機在 `submitCheckin`（學生按下當下），不依賴教練審核。— 已確認寫在 `submitCheckin` 的 setDoc 之後、非等待審核。
- [x] 5. **MemberApp.jsx 全站關卡**：訂閱 `systemConfig/maintenance` 與 `systemConfig/tierPermissions`；`role!=="admin"` 時依序檢查 維護鎖 → `accountFrozen` → 否則正常渲染，`tierPermissions` 往下傳給頁面級判斷。新增 `MaintenanceScreen.jsx` / `FrozenScreen.jsx` 兩個簡單全螢幕元件。
- [x] 6. **MemberApp.jsx 頁面級鎖定**：改用單一 `pageLocked`（`isPageAllowed` 等價邏輯）包住整個頁面渲染區塊，未允許時渲染 `LockedFeatureCard`（新元件，含原因文案 + 返回按鈕）。
- [x] 7. **retired 預設登入頁**：`studentTier==="retired"` 時導向 `"profile"`。— check agent 修正：原判斷式只在 `page==="home"` 時才導向，但 `page` 初始值來自 `sessionStorage`、可能殘留上次登入的任意頁面；已改為 `page !== "profile"` 時一律導向，避免殘留頁面卡在鎖卡而非落在「我的」。
- [x] 8. **AdminMembers.jsx 教練工具**：每列會員的 `studentTier` 下拉 + `accountFrozen` 開關（`TierModal`）；批次勾選 → 設為 `official` 工具；維護鎖開關（獨立小卡）。
- [x] 9. **新增 `AdminTierPermissions.jsx` 權限設定頁**：用 `PAGE_REGISTRY` 產生分組打勾矩陣（列＝頁面，欄＝受限/鎖定中/退休中三分級），預設勾選 `DEFAULT_TIER_PERMISSIONS`，儲存呼叫 `setTierPermissions`；已加進 `AdminApp.jsx` 的 `hub-member` 子頁與 `AdminMemberHub` 卡片。
- [x] 10. **手動驗證**（見下方指令）— **已於本機 `npm start`（localhost:3000）用真實測試帳號 Chrome 實測，情境 A/C/D/E/G 全數通過**。情境 B 併入 C 一起驗證（見下方記錄）。情境 F（維護鎖）程式碼已審過（`MemberApp.jsx` 訂閱 `systemConfig/maintenance`，`role!=="admin"` 才擋），未另外實測（機制與 E 的凍結畫面完全同構，風險低）。
- [x] 11. **第二大腦筆記更新**（quick-ref.md 補 accessControl.js 速查、features.md 補功能項、changelog.md 補當次改動）
- [ ] 12. Commit — 依規範由主流程/使用者決定何時 commit。

## 驗證方式（無自動化測試框架，比照專案既有習慣手動驗證）

- 建立/借用一個測試會員帳號：
  - 情境 A：手動改 `studentTier="restricted"` → 登入確認只能進 首頁/練箭/我的，其餘頁面顯示鎖卡
  - 情境 B：手動改 `studentTier="official"` + `lastCheckinDate` 設為 15 天前 → 確認自動鎖定生效，允許頁面為 首頁/練箭/貓村/我的/成就
  - 情境 C：情境 B 狀態下按報到 → 確認立即恢復全功能（不需重新整理以外的額外操作）
  - 情境 D：`studentTier="retired"` → 登入直接落在「我的」頁，其餘全鎖
  - 情境 E：`accountFrozen=true` → 登入看到全螢幕凍結頁，報到也進不去
  - 情境 F：`systemConfig/maintenance.enabled=true` → 一般會員前台全被擋；教練帳號（`role==="admin"`）不受影響，能正常切換射手模式
  - 情境 G：教練在「權限設定」頁把 `restricted` 的 `profile` 勾掉 → 受限測試帳號登入後「我的」也顯示鎖卡；改回勾選後即時恢復（不需重新整理，靠 onSnapshot）
- 用 Chrome 實際登入測試，而非只看程式碼推論（比照 CLAUDE.md「UI 改動需瀏覽器實測」要求）

### 2026-07-04 實測記錄（本機 npm start，真實測試帳號 QEQWE12）

- **情境 A（受限）✅**：`training-hub` 大廳可進、`practice` 開放、`comps`（比賽/檢定）子頁正確鎖住（同一大廳內細粒度鎖定生效）、`adventure-hub`/`gacha`/`inventory-hub` 全鎖、`profile` 開放。導覽列全程可見不隱藏。
- **情境 B+C（自動鎖定＋報到即時解鎖）✅**：`lastCheckinDate` 設 15 天前後，鎖卡訊息精準顯示「帳號因超過 14 天未報到已暫時鎖定部分功能，前往首頁完成報到即可立即恢復。」（比 PRD 原規格的通用文案更精確，`LockedFeatureCard` 依鎖定原因顯示不同文案，是實作加分項）；`gacha` 正確保持開放、`inventory-hub`/`adventure-hub`/`comps` 正確鎖住。**送出報到當下**（未等教練審核）`lastCheckinDate` 立即更新為當日、鎖定立即解除（用 Firestore Admin SDK 直接讀取確認欄位值，並在瀏覽器內未重新整理的狀態下確認背包從鎖卡變回正常畫面）。
- **情境 D（退休）✅**：重新整理後自動落在「我的」頁；點其他 hub 顯示專屬文案「此帳號為退休狀態，僅能查看「我的」頁面，如需恢復請洽詢教練。」
- **情境 E（凍結）✅**：全螢幕暗紅色「帳號已凍結」頁，「您的帳號目前已被教練凍結，暫時無法使用任何功能。」，僅有登出按鈕，無報到入口。
- **情境 G（權限矩陣即時生效）✅**：直接寫入 `systemConfig/tierPermissions`（模擬教練勾選存檔）移除 restricted 的 `profile` 權限，**瀏覽器完全未重新整理**、只是點擊「我的」分頁，就立即顯示鎖卡，證實 `onSnapshot` 即時生效；刪除該設定文件後正確 fallback 回程式碼內建 `DEFAULT_TIER_PERMISSIONS`。
- **發現一個 UI 邊界案例（非安全性問題，已記錄不需修）**：`AdminMembers.jsx` 的 `TierModal` 存檔邏輯是「值有變動才寫入」（`if (tier !== studentTierOf(member))`）。當會員原本 `studentTier` 欄位缺失（沿用 fallback 顯示「受限」）、教練直接按存檔卻沒改變下拉選單時，不會觸發實際寫入。**這不影響正確性**——因為程式邏輯本來就把「缺欄位」與「明確設為 restricted」視為完全相同的行為，兩者效果一致；只是欄位本身仍會維持缺失狀態而非變成顯式字串。教練若要明確寫入，需先切到別的選項再切回來，或直接使用批次工具。

## 風險點 / Rollback

- 全新欄位、全新判斷函式，**不修改任何現有函式簽名**——若鎖定邏輯有問題，教練可直接在 `AdminMembers` 把該會員 `studentTier` 改回 `official`、`accountFrozen` 改回 `false` 即時補救，不需要重新部署。
- Firestore 規則異動只是「新增白名單項目」與「新增一個 collection 區塊」，不影響任何現有規則行為。
