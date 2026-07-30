# 技術設計

## 邊界

- React 管理後台負責編輯、草稿、發布與圖片上傳。
- Firestore `websiteContent/{pageId}` 保存 `draft` 與 `published`。
- Firebase Storage `website-content/{pageId}/` 保存管理員上傳的圖片。
- 靜態官網以 `data-cms` 標記可替換文字，以 `data-cms-image` 標記可替換圖片。
- `cms-runtime.js` 只讀取 `published` 並套用；失敗時不改動原始 DOM。

## 資料契約

每頁文件包含：

- `draft.fields`：欄位鍵至文字值。
- `draft.images`：圖片鍵至 `{src, alt}`。
- `published.fields`、`published.images`：訪客可見快照。
- `updatedAt`、`publishedAt`、`updatedBy`。

欄位與圖片清單由程式內的中文 schema 管理，避免管理員輸入 CSS selector 或任意 HTML。所有文字以 `textContent` 套用，不允許注入 HTML。

## 相容與回復

- 靜態 HTML 永遠保留完整預設文字與圖片。
- 舊官網沒有 CMS 文件時，畫面完全不變。
- 「恢復預設」只清除草稿覆寫；發布後才生效。
- 不修改驗證與登入流程。
