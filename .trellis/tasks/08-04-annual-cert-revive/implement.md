# 執行計畫：年度檢定重新啟用

順序刻意是「純邏輯 → 後台 → 會員端」：純函式先寫完並測過，後面兩塊才有共同地基，
而且中途任何一步停下來都不會讓現況壞掉（既有流程完全沒被拔掉）。

## 步驟

- [ ] **1. `src/lib/certStatus.js`（純函式，零 firebase 相依）**
      `certCompTitle` / `activeCertComp` / `certPeriodKey` / `certProgress` /
      `myCertState` / `certYearOptions`。級別一律經 `getCertLevelByScores`、
      級別名一律從 `CERT_LEVELS[bowType]` 取（傳統弓是「菁英」）。
- [ ] **2. `src/lib/certStatus.test.js`**
      至少涵蓋：最高級時 `nextLevel=null`／傳統弓菁英不被寫成精英／沒有進行中檢定時
      `activeCertComp` 回 `null`／`certProgress` 遇到 0 分與缺門檻不回 `NaN`／
      `certYearOptions` 新到舊排序。
      驗證：`npx react-scripts test --watchAll=false --testPathPattern=certStatus`
- [ ] **3. `src/components/admin/CertRuleFields.jsx`**：從 `AddCertModal`(:437) 抽出規則欄位，
      受控元件 + 「回復預設值」。`AddCertModal` 改用它，**行為必須完全不變**。
- [ ] **4. `CompDetailModal` 加 `⚙️ 規則` tab**（`isCert` 才顯示）
      → `updateCompetition(comp.id, { distance, arrowCount, roundCount, maxScore, hasMiss, certScores, title }, operatorId)`，
      `title` 用 `certCompTitle()` 重組。儲存前顯示「已審核成績不重算」警語。
- [ ] **5. 驗收 A**（先手動測後台，通過再往下）：開一場 2026 下半年檢定 → 改門檻與距離 →
      重新開啟 Modal 數字有留住 → 上半年那場沒被動到。
- [ ] **6. `MemberProfile.jsx:876` 年度檢定卡片**：`showHistory` 布林改期別選單
      （`certYearOptions`），加「距離下一級還差 N 分」與「檢定級別會提升三圍」一行。
      **不得新增 Firestore 讀取**，沿用既有 `cert_records.<memberId>` 快取。
- [ ] **7. `MemberHome.jsx` 首頁檢定卡片**：有進行中檢定且我這期未通過才顯示，
      顯示期別／我的狀態／各弓種差幾分，點擊 `onPageChange("comps")`。
      先確認首頁有沒有現成的 competitions 資料源；沒有才加
      `cachedFetch("cert_active_comp", 10 * 60 * 1000, …)`。
- [ ] **8. 比賽分頁紅點**（`MemberApp.jsx`）：沿用既有紅點計數機制，條件同步驟 7。
- [ ] **9. 全域檢查**
      - `npx eslint src/lib/certStatus.js src/components/admin/CertRuleFields.jsx src/components/member/MemberHome.jsx src/components/member/MemberProfile.jsx src/components/admin/AdminCompetitions.jsx`
        （**`react-scripts build` 不會擋 `no-undef`，一定要另外跑 ESLint**）
      - `npx react-scripts test --watchAll=false`
      - `npm run build`
- [ ] **10. 教練模式實測**：教練切「射手模式」→ 首頁與「我的」都不空白。
- [ ] **11. 更新第二大腦**：`docs/second_brain/changelog.md` + `features.md`（檢定那條），
      同步 `C:\Users\broud\Documents\Obsidian Vault\catarrow\`。

## 檢查點 / 回滾點

- 步驟 2 通過 → 純邏輯已定，後面只是接線。
- 步驟 5 通過 → 後台可用，就算會員端全部停工，教練也已經能開下半年檢定（**最低可交付**）。
- 步驟 8 之後才動到每日必經頁面，出事就先移除首頁卡片與紅點，其餘保留。

## 不做（本次明確排除）

- 已審核成績重算級別（已定案：不重算）。
- 升級別發箭露／成就／稱號。
- 動 `calcArcherStats` 的三圍公式。
- 碰射手證畢業考（`MemberCertExam.jsx`）那條線。
