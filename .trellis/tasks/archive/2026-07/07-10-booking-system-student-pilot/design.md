# Design：線上約課預約系統（學生試用版）

## 1. 資料模型

### `bookings/{id}`（新 collection，`addDoc` 產生 ID）
```js
{
  memberId: string,              // members collection docId（不是 uid，比照專案既有慣例）
  memberName: string,             // 快照，避免每次顯示都要 join members
  contactEmail: string,           // 必填，快照
  contactPhone: string,           // 必填，快照
  planType: "general" | "discount" | "own_equipment",  // 單人一般／兒童學生敬老／自備器材
  participantCount: number,       // 這次試用版固定 1（8人以上團康不走這條路）
  date: "YYYY-MM-DD",
  startTime: "HH:mm",
  endTime: "HH:mm",               // 依 planType 對應時數換算（1hr 或 3hr）
  slotKey: "YYYY-MM-DD_HH:mm",    // 冗餘欄位，方便查詢跟容量counter用同一把key
  instructorId: string | null,    // 內部排班用，不給客戶選，教練後台可填
  status: "confirmed" | "cancelled" | "completed" | "no_show",
  source: "online" | "phone",     // 學生自助 or 教練代填（電話進線）
  paymentMethod: "cash" | "transfer" | null,  // 到店/事後由教練標記，不是預約當下必填
  note: string,
  rescheduledFrom: string | null, // 若是改期產生的新預約，記錄原 bookingId（audit trail）
  createdAt, updatedAt, cancelledAt,
}
```

### `bookingSlotCounts/{slotKey}`（容量計數器，`slotKey` = `"YYYY-MM-DD_HH:mm"`）
```js
{ count: number, blocked: boolean }
```
`count` 是這個時段目前有效預約數（0-8），`blocked` 是教練手動封鎖旗標。**這個文件是容量正確性的唯一真相來源**，`bookings` collection 本身不能拿來現場即時計數（那需要查詢，不是原子操作）。

### `members/{id}` 新增欄位（沿用既有 collection，不新開顧客表）
```js
{
  bookingStats: {
    firstBookingAt: Timestamp | null,
    totalBookings: number,       // 只累加，取消不扣（見下方「更多紀錄」語意說明）
    lastBookingAt: Timestamp | null,
  }
}
```
電話進線但還沒有帳號的顧客：沿用 guest-kid-mode-overhaul 那套 `accountType`／`contactHash` 機制，建立一筆 `accountType:"guest"` 的 `members` 文件（`contactHash` 用電話或email算），之後要轉正式學籍走既有 `convertGuestToOfficial` 邏輯，**不要另建顧客資料表**。

## 2. 容量交易（本次設計核心，全部走 `runTransaction`）

比照 `dungeonDb.js::trySetDungeonFirstClear` 的既有寫法慣例（讀取+判斷+寫入包在同一個 transaction）：

```js
// bookingDb.js
export async function createBooking(memberId, memberName, contact, planType, date, startTime, endTime, source, note) {
  const slotKey = `${date}_${startTime}`;
  const counterRef = doc(db, "bookingSlotCounts", slotKey);
  const bookingRef = doc(collection(db, "bookings")); // 先產生 ref 拿 id，還沒寫入

  try {
    await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      const data = counterSnap.exists() ? counterSnap.data() : { count: 0, blocked: false };
      if (data.blocked) throw new Error("SLOT_BLOCKED");
      if (data.count >= LANE_CAPACITY) throw new Error("SLOT_FULL"); // LANE_CAPACITY = 8

      tx.set(counterRef, { count: data.count + 1, blocked: data.blocked }, { merge: true });
      tx.set(bookingRef, {
        memberId, memberName, contactEmail: contact.email, contactPhone: contact.phone,
        planType, participantCount: 1, date, startTime, endTime, slotKey,
        instructorId: null, status: "confirmed", source, paymentMethod: null, note: note || "",
        rescheduledFrom: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      // 同一個 transaction 順手更新顧客摘要欄位（見下方「更多紀錄」設計）
      const memberRef = doc(db, "members", memberId);
      tx.set(memberRef, {
        bookingStats: {
          totalBookings: increment(1),
          lastBookingAt: serverTimestamp(),
          // firstBookingAt 只在第一次寫入時設定，見下方 §3 特殊處理
        }
      }, { merge: true });
    });
    return { ok: true, id: bookingRef.id };
  } catch (e) {
    if (e.message === "SLOT_FULL") return { ok: false, reason: "這個時段已經滿了，換一個時段看看" };
    if (e.message === "SLOT_BLOCKED") return { ok: false, reason: "這個時段教練暫停預約" };
    return { ok: false, reason: "系統忙碌，請稍後再試" };
  }
}
```

**取消**：同一個 transaction 模式，`counterRef.count` 做 `decrement`（不會低於0，讀出來後 `Math.max(0, count-1)` 寫回），`bookings/{id}.status` 改成 `cancelled`。

**變更時段（改期）**：**一個 transaction 內同時做「舊時段 decrement + 新時段 capacity check + increment」**，不要拆成「先取消再新增」兩次獨立操作——拆開的話中間會有一個瞬間舊名額已經釋放、新名額還沒鎖定，若剛好被別人搶走新時段，會出現「改期失敗但舊時段已經沒了」的爛尾状態。設計上用 `tx.get()` 同時讀舊/新兩個 `bookingSlotCounts` 文件，判斷新時段有空位才一起寫入，否則整個 transaction 拋錯、舊時段完全不動。

**封鎖時段**：教練後台寫入 `bookingSlotCounts/{slotKey}.blocked = true`，不需要 transaction（單一文件單一欄位寫入），但容量交易讀到 `blocked:true` 時要拒絕新增/改期進來。

## 3. 「更多紀錄」三欄位語意與 `firstBookingAt` 特殊處理

- `totalBookings`：**語意＝目前有效預約數**（使用者已拍板：取消要扣回去）。`createBooking` 的 transaction 內 `increment(1)`；`cancelBooking` 的 transaction 內 `increment(-1)`（要注意不能低於0，理論上不會發生但寫的時候還是用 `Math.max` 保護，不要盲目相信永遠不會出現負數）。**改期＝同一個 transaction 內「舊時段 decrement」+「新時段 increment」一起做**，兩個動作互相抵銷，`totalBookings` 淨變化是0，只有 `lastBookingAt` 會更新成新時段時間——這樣「改期」在語意上正確地不算成一次新的預約次數，只是移動了同一筆。
- `lastBookingAt`：每次成功 create（含改期）都更新（`serverTimestamp()`）；取消**不**更新這個欄位（取消不是「一次新的預約」，不該覆蓋掉最近一次真正的預約時間）。
- `firstBookingAt`：只在第一次寫入時要設定，`increment`/`serverTimestamp()` 沒有「只在不存在時才設定」的原生語法，需要在同一個 transaction 裡先 `tx.get(memberRef)` 讀出現有的 `bookingStats.firstBookingAt`，判斷是 `null`/不存在才把它塞進這次的 `tx.set()` payload，存在就不動這個欄位。取消/改期都不動這個欄位（它記錄的是「第一次」，不是「最近一次」）。

## 3.1 30 分鐘最短前置時間檢查

`createBooking`／`rescheduleBooking` 在寫入前（transaction 開始前，純函式檢查，不需要讀資料庫）先做：
```js
const slotStart = new Date(`${date}T${startTime}:00+08:00`); // 注意時區，伺服器/瀏覽器環境時區不一定是台北
if (slotStart.getTime() - Date.now() < 30 * 60 * 1000) {
  return { ok: false, reason: "這個時段快開始了（少於30分鐘），請選晚一點的時段，或直接來電/加LINE確認是否還能安排" };
}
```
**這個檢查一定要在後端函式（`bookingDb.js`）裡做，不能只做在前端 UI 篩選可選時段**——三個入口（學生前台、新生隱藏入口、教練後台代建）都呼叫同一個 `createBooking`/`rescheduleBooking`，後端擋一次就三邊都保護到，UI 上再各自把「不到30分鐘」的時段標成不可選/灰階，是體驗優化，不是唯一防線。

## 4. 前台（學生）UI —— `MemberApp.jsx` 新分頁

- 沿用 `MemberApp.jsx` 既有分頁架構（`page` state 字串切換），新增一個 tab，元件比照 `src/components/member/` 現有元件風格（`Card`/`Btn`/`Modal` 等共用 UI）。
- **這個分頁只對 `profile.bookingBetaAccess === true` 的會員顯示**（見 §4.1），不是上線就對所有學生開放。
- 流程：選日期（月曆/日期選擇器，只能選營業日：週二~週日，週一自動不可選）→ 該日依營業時間切出時段格（週二 13-22 共 9 格，週三~日 10-22 共 12 格，每格 1 小時）→ 已滿/被封鎖/距現在不到30分鐘的格子disable顯示→ 選方案類別 → 確認送出。
- 「我的預約」清單：讀 `where("memberId","==",profile.id)` 的 `bookings`，顯示未來的預約，含改期/取消按鈕。**改期/取消沒有時間緩衝限制**（沒收訂金，隨時可以動），但改期選的新時段一樣要過 30 分鐘最短前置時間檢查。

## 4.1 `bookingBetaAccess` 漸進開放旗標

`members/{id}` 新增欄位 `bookingBetaAccess: boolean`（預設不存在＝視為 `false`）。教練後台（§5）要有一個簡單的開關可以幫特定學生打開這個旗標。`MemberApp.jsx` 只在 `profile?.bookingBetaAccess === true || role === "admin"`（教練切射手模式時自己也要看得到，方便測試）時才 render 這個新分頁的入口。這是 PRD「上線策略」要求的漸進開放機制，跟「先不要 push」是兩層不同的保護（push 前的保護、push 後的保護），兩個都要做。

## 4.2 新生隱藏入口（公開自助註冊+預約）

- 新頁面 `src/pages/PublicBookingApp.jsx`，走跟 `GuestApp.jsx` 類似的獨立頂層元件模式（不掛進 `AuthProvider`，自己管理 `profile` state，參考 guest-kid-mode-overhaul 任務的既有架構）。
- `App.jsx` 新增路由，用一個**不容易被猜到、沒有規律的 query 參數值**進入（例如 `?bk=<一串隨機字串>`，不要用 `?booking=1` 這種容易猜的形式——雖然主要防線是「沒有公開連結」，但參數本身也不要太好猜，多一層保險）。
- 流程：填姓名/email/電話（複用 `resolveGuestSession`-style 的 `contactHash` 邏輯，這次可以直接呼叫既有 `resolveGuestSession(contact, "guest", null)` 拿到/建立一筆 `members` 文件）→ 選時段（跟學生前台同一套時段選擇 UI/邏輯，複用同一個元件）→ `createBooking(memberId, ..., source:"online_public")` → 完成。
- **不需要**額外做「新生專屬」的 accountType，沿用既有 `"guest"` 即可，跟訪客模式共用同一套規則與轉正式流程（`convertGuestToOfficial`）。
- 這個頁面的 `<head>` 要加 `<meta name="robots" content="noindex,nofollow">`，避免哪天不小心被搜尋引擎爬到收錄（多一層被動保護，不依賴人為記得不要分享連結）。

## 5. 後台（教練）UI —— `AdminApp.jsx` 新 Hub 分頁

比照 `AdminKidMode.jsx` 的既有模式（`memberSub` 分頁 + `HubCard` 掛進 `AdminMemberHub`，或另開一個 Hub 視情況決定）：

- **行事曆檢視**：週/日切換（比照使用者截圖的 SimplyBook 視覺——色塊呈現，每格顯示顧客名/方案），點時段格看詳細/建立新預約。
- **建立預約 Modal**：顧客搜尋（依 email/電話比對既有 `members`）或新建（電話進線情境，三欄位表單），方案類別、日期時段選擇（複用前台同一套 `createBooking` 函式，`source:"phone"`）。
- **封鎖時段**：點行事曆空格 → 「封鎖此時段」按鈕，寫入 `bookingSlotCounts.blocked=true`。
- **收費分類報表**：新元件（不沿用 `AdminFinance.jsx`），依日期區間查詢 `bookings`（**要加 `where` 限定日期範圍，例如「本月」，不要無界查詢全部歷史預約**——這是今天處理 Firestore 額度問題學到的教訓，任何新報表都要先問「這個查詢會不會隨時間累積越查越貴」），依 `planType` × `paymentMethod` 分組統計。
- **`bookingBetaAccess` 開關**：顧客列表（或既有 `AdminMembers.jsx` 會員列表）加一個簡單切換，讓教練勾選要開放給哪些學生試用「線上約課」分頁（對應 §4.1）。

## 5.1 Firestore 規則（需要使用者手動貼 Firebase Console）

```
match /bookings/{bookingId} {
  allow read: if isLoggedIn();
  allow create: if isLoggedIn() &&
    (isAdmin() || request.resource.data.memberId == /* 對應目前登入者的 members docId，需比對 uid */);
  allow update: if isAdmin() || (isLoggedIn() && resource.data.memberId == ... && 
    request.resource.data.diff(resource.data).affectedKeys().hasOnly(["status","updatedAt","cancelledAt"]));
    // 學生只能改自己預約的 status（取消），不能亂改別人的或改金額/時段以外的東西
  allow delete: if false; // 一律用 status 標記，不真的刪除文件
}
match /bookingSlotCounts/{slotKey} {
  allow read: if isLoggedIn();
  allow write: if isLoggedIn(); // transaction 內寫入，讀寫都需要登入即可（跟訪客模式類似的寬鬆取捨，容量計數器本身不含個資）
}
```
實際規則要在實作時比對現有 `firestore.rules` 的 `isAdmin()`/`isLoggedIn()` helper 寫法補齊，這裡只列邏輯，不是最終語法。**寫完一定要提醒使用者手動貼進 Firebase Console**（CLI 403 是這個專案的已知限制）。

## 6. 施工順序建議

1. `bookingDb.js` 資料層 + 規則（最地基，先確保 transaction 邏輯正確，可以先寫幾個 admin console 手動測試腳本驗證容量交易）
2. 教練後台：建立預約 Modal + 行事曆檢視 + 封鎖時段（教練自己能先用，不急著開放學生）
3. 學生前台：`MemberApp.jsx` 新分頁選時段送出預約 + 我的預約清單（改期/取消）
4. 收費分類報表
5. 全部串起來後，找一小群學生實測一輪（PRD 驗收項目 3 的雙分頁搶位測試務必手動做一次，這是本次最核心的正確性風險）
