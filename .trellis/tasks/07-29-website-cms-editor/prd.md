# 官網後台內容編輯

## Goal

讓既有管理員可以在目前後台編輯官網文字與圖片，不需要修改 HTML 或重新操作登入。

## Requirements

- 沿用現有管理員登入與權限，不新增另一套帳號。
- 後台新增「官網內容」入口，可依頁面及區塊編輯文字。
- 官網圖片可選擇既有網址，也可上傳圖片後替換。
- 變更先儲存為草稿，明確按下發布後才更新前台。
- 保留最近一次已發布內容，可一鍵回復預設值。
- 前台讀取失敗時仍顯示 HTML 內建內容，不得空白。
- 圖片需有替代文字；前台不得把 SEO 文字改成圖片。
- 官網訪客只能讀取已發布內容，只有管理員可以寫入。
- 本次只在隔離分支施工，不部署 Firebase 規則或正式網站。

## Acceptance Criteria

- [ ] 管理員可編輯首頁、新增主題頁與既有 SEO 情境頁的文字及圖片。
- [ ] 圖片上傳限制類型與大小，並顯示預覽。
- [ ] 草稿不會影響訪客，發布後前台套用新內容。
- [ ] 官網資料不存在或網路失敗時保留原始頁面。
- [ ] Firestore 與 Storage 規則限制只有管理員可寫。
- [ ] Production build、內容模型測試與靜態頁面檢查通過。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
