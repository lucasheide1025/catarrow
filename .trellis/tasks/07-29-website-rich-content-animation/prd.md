# 官網內容與動畫完整化

## Goal

在不讓首頁重新變成冗長目錄的前提下，補回舊版重要內容、品牌美術與可感知動畫，使新版在資訊完整度與視覺品質上超越現行官網。

## Requirements

- 保留新版問題導向架構、價格與預約入口。
- 補回弓種、器材、新手學習路徑、場館與貓咪、長期練習、參賽帶隊、真實活動及完整訓練系統介紹。
- 每個主題在首頁提供有資訊量的摘要、真實照片或品牌插畫及完整分頁入口。
- 使用舊版既有貓咪插畫與真實照片，不裁切人物。
- 加入 Hero、靶環、箭矢、卡片、圖片、數字與區塊進場動畫。
- 動畫需支援靜音、觸控、鍵盤操作與 `prefers-reduced-motion`。
- 保留 CMS 自動辨識文字與圖片。
- 不修改登入、預約邏輯或正式網站。

## Acceptance Criteria

- [ ] 首頁重要舊內容都有清楚承接。
- [ ] 手機與桌面能明顯看見品牌動畫，且不妨礙閱讀。
- [ ] 不產生橫向溢出或裁切人物照片。
- [ ] SEO 文字保持直接存在於 HTML。
- [ ] CMS 仍可辨識新增文字與圖片。
- [ ] production build 與瀏覽器檢查通過。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
