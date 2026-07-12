# 修正市集卡片交換 Missing or insufficient permissions

## Goal

使用者回報射手帳號市集交換卡片會出現 `Missing or insufficient permissions`。根因已確認：`db.js::buyCardListing()` 在**買家的瀏覽器**裡用 `writeBatch` 直接寫入**賣家**的 `members` 文件（給賣家錢/卡片），但 firestore.rules 的 `members` update 規則要求 `resource.data.uid == request.auth.uid`，買家沒有權限寫別人的文件，導致整個 batch（含買家自己那部分）一起被拒絕——**這是必現 bug，不是偶發**，目前市集交易完全跑不通。

跟村目標獎勵（`07-09-07-09-village-goal-reward-claim`）是同一種架構問題：client-triggered 幫別人寫入。修法比照同一套「自行請領」模式。

## Requirements

1. `buyCardListing(buyerId, buyerName, listing, offeredCardId)` 拆分：
   - 買家端的 batch 只保留**自己**的寫入：扣款（`village.resources.arrowdew` / `gachaCoins` / `catCards.{offeredCardId}` 依 priceType）、拿到卡片（`catCards.{listing.cardId}` +1）。
   - **移除**對 `listing.sellerId` 的 members 文件寫入。
   - `listingRef` 更新為 `status:"sold", buyerId, buyerName, soldAt, sellerClaimed:false`，priceType==="card" 時額外記錄 `offeredCardId`（供賣家請領時知道該給哪張卡）。
   - 通知賣家的 `createNotification` 呼叫維持不變（`notifications` collection 本來就允許任何登入者建立）。
2. 新增 `claimCardSaleProceeds(sellerId, listingId)`：
   - 賣家用自己的帳號呼叫，讀取 listing，驗證 `listing.sellerId===sellerId`、`status==="sold"`、`!sellerClaimed`。
   - 依 `listing.priceType` 把錢/卡片加到賣家**自己**的 `members` 文件（`arrowdew`/`gachaToken`/`offeredCardId`）。
   - 標記該 listing `sellerClaimed:true`。
   - 回傳 `{ok, proceeds}` 供 UI 顯示「已收到 XXX」。
3. `src/components/member/CatVillage.jsx` 的 `CardMarketPanel`：`myListings` 訂閱已經存在（`subscribeCardMarket` 回呼裡篩出 `sellerId===memberId` 的），在偵測到某筆 `status==="sold" && !sellerClaimed` 時自動呼叫 `claimCardSaleProceeds`，成功後用 toast 或既有提示機制顯示「收到 XXX」。

## Acceptance Criteria

- [ ] 買家購買卡片流程正常完成，不再出現 permission 錯誤。
- [ ] 賣家下次開啟市集頁面（或已開著的頁面偵測到 snapshot 更新）能自動收到款項/交換卡片，不需要額外手動點擊請領按鈕（除非技術上做自動偵測比手動按鈕更複雜，屆時可以改成一個明顯的「請領」按鈕，兩者皆可接受）。
- [ ] `CI=true npm run build` 成功。
- [ ] 不需要改 `cardMarket`/`notifications` 的 firestore.rules（本來就夠寬鬆）。

## Notes
- 這是使用者這輪主動要求優先處理的 bug。
