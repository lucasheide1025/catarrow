# Journal - codex (Part 1)

> AI development session journal
> Started: 2026-07-27

---

## 2026-08-02 — 訪客評價邀請與審核

- 建立並啟動 Trellis 任務：`.trellis/tasks/08-02-guest-review-workflow`。
- 產品決策：訪客首次完成來訪後隔天 10:00 寄信；30 天免登入安全連結；每位訪客僅一份不可編輯評價；私人回饋與公開審核分流；拒絕轉客訴且成功寄信後才能結案。
- 隱私決策：公開匿名名稱獨立填寫，不使用帳戶本名；內部評價與公開去識別投影分離；訪客可在待審核或核准後撤回公開同意。
- 商業決策：只有本站 5 星者顯示 Google 評價入口，與本站公開同意無關；已記錄 Google 平台政策風險並提供後台總開關。
- 已實作：首次資格鎖、隔日排程、token hash、失敗重試／補寄、匿名與登入提交、後台審核／私人回饋／客訴、mail delivery 結案、客訴寄送歷史、首頁最多六則動態評價與靜態 fallback、Firestore rules/indexes。
- 第二輪檢查修正：待審核撤回、失敗 mail attempt 卡死、舊 delivery event 污染新狀態、已評價者誤補寄、缺少邀請狀態與 badge、客訴補寄覆寫稽核，以及錯誤 App URL。
- 驗證：Functions 70/70；CRA 140 suites / 1,584 tests；production build；Trellis validate；diff whitespace check 全部通過。
- Google 評價導流已設定為產品方提供的官方短連結 `https://share.google/bqXYZDlWtwruWvV69`，並將 `share.google` 加入安全 URL 允許清單與測試。
- 2026-08-02 已部署 Firebase rules、indexes 與全部 Cloud Functions；70 項 functions Node tests 與 production build 通過。全新設定不存在時，評價邀請及 5 星 Google 導流依產品指示預設啟用，後台仍可明確關閉。
- Vercel production 已部署並確認 Ready：會員／後台應用別名 `https://student.catgroup.com.tw`、`https://catarrow.vercel.app`；獨立官網專案 `catarrow-archery`（正式網域 `https://archery.catgroup.com.tw`）。
- 尚未完成：本機缺 Java，Firestore rules emulator 未執行；尚未以真實完成預約觀察隔日 Email 與完整人工 E2E。

