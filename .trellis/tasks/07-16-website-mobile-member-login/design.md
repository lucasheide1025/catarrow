# 官網手機會員登入入口設計

## Confirmed deployment boundary

官網原始碼位於同 repo 的 `website/`，正式站是獨立 Vercel 專案 `catarrow-archery`，未接 GitHub 自動部署。修改完成後需將 `website/` 單獨手動 `vercel deploy --prod`；主 App 的 git push 不會讓官網上線。

## Mobile navigation

目前所有頁面的 `.nav-login` 與 `.nav-book` 在手機 media query 被隱藏，漢堡選單內只有內容錨點。首頁與 8 個情境子頁的手機選單新增兩個明確行動：

- `會員登入` → 公開預約 URL 加 `&login=1`
- `立即預約` → 一般公開預約 URL

兩者放在展開後的 nav 內，並在首頁 hero 行動區保留會員登入次要按鈕，讓不展開選單的手機使用者也能發現。桌面既有按鈕保留。

## Accessibility

使用 `<a>` 導覽、至少 44px 點擊高度、focus-visible、適當對比；漢堡的 aria-expanded 與點擊 CTA 後關閉選單維持有效。不得停用縮放。

## Deployment verification

靜態 HTML 無 build system；以本機 HTML／連結檢查、手機 viewport 視覺檢查後，打包 `website/` 到獨立部署目錄並部署 `catarrow-archery`。正式網址需同時驗證首頁與至少一個子頁的手機入口。
