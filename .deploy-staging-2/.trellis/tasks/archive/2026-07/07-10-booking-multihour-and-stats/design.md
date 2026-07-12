# Design：3小時方案＋跨時段容量鎖定＋新舊生統計

## 1. Schema 變更

`bookings/{id}` 新增欄位：
```js
{
  durationHours: 1 | 3,        // 新增，預設 1（沿用既有欄位不動，只加這個）
  slotKeys: string[],          // 新增：這筆預約占用的所有時段格，取代單靠 startTime 推算
  isNewStudent: boolean,       // 新增：使用者自己勾選「是否為第一次來體驗」
  // 既有欄位不變：memberId/memberName/contactEmail/contactPhone/planType/date/startTime/endTime/
  //             slotKey(保留=slotKeys[0]，向後相容既有讀取程式碼)/status/source/paymentMethod/note/
  //             rescheduledFrom/createdAt/updatedAt/cancelledAt
}
```
`endTime` 依 `durationHours` 計算（`startTime + durationHours` 小時，取 `HH:mm`）。`slotKey`（單數，舊欄位）保留寫入 `slotKeys[0]`，避免任何還在讀舊欄位的程式碼壞掉。

`bookingSlotCounts/{slotKey}` 新增欄位：
```js
{ count, blocked, newCount: number, returningCount: number }
```
不變式：`count === newCount + returningCount`。三個數字永遠在同一次 `tx.set()` 裡一起寫，不會有只更新其中一個的路徑。

## 2. 時段格生成

```js
// bookingDb.js 內部工具，取代單一 slotKeyOf 的地方一律改用這個
function slotKeysFor(date, startTime, durationHours) {
  const [h, m] = startTime.split(":").map(Number);
  const keys = [];
  for (let i = 0; i < durationHours; i++) {
    const hh = String(h + i).padStart(2, "0");
    keys.push(`${date}_${hh}:${m === 0 ? "00" : String(m).padStart(2,"0")}`);
  }
  return keys; // 例：10:00 起3小時 → ["date_10:00","date_11:00","date_12:00"]
}
```
（既有的 `slotKeyOf(date, startTime)` 單數版本保留給只需要單一時段 key 的地方用，例如 `blockSlot`/`unblockSlot` 這種教練手動針對單一格操作的場景不用改。）

## 3. `createBooking` 的多時段原子交易（取代現有單時段版本）

```js
export async function createBooking(memberId, memberName, contact, planType, durationHours, isNewStudent, date, startTime, endTime, source, note = "") {
  ...（既有的 memberId/contact 檢查、checkLeadTime 檢查不變，只檢查 startTime）

  const slotKeys   = slotKeysFor(date, startTime, durationHours);
  const counterRefs = slotKeys.map(k => doc(db, SLOT_COUNTS, k));
  const memberRef  = doc(db, "members", memberId);
  const bookingRef = doc(collection(db, BOOKINGS));

  await runTransaction(db, async (tx) => {
    // ── 全部讀取先做完，包含每一個涉及的時段格 ──
    const counterSnaps = await Promise.all(counterRefs.map(ref => tx.get(ref)));
    const memberSnap   = await tx.get(memberRef);

    const counters = counterSnaps.map(readCounter); // readCounter 要順便回傳 newCount/returningCount 預設值

    // ── 逐格檢查，任何一格不通過就整筆丟出，不寫入任何東西 ──
    counters.forEach(c => {
      if (c.blocked) throw new Error("SLOT_BLOCKED");
      if (c.count >= LANE_CAPACITY) throw new Error("SLOT_FULL");
    });

    // ── 全部通過才寫入：每一格各自 +1（count 與 new/returningCount 一起動）──
    counterRefs.forEach((ref, i) => {
      const c = counters[i];
      tx.set(ref, {
        count: c.count + 1,
        blocked: c.blocked,
        newCount:       c.newCount       + (isNewStudent ? 1 : 0),
        returningCount: c.returningCount + (isNewStudent ? 0 : 1),
      }, { merge: true });
    });

    tx.set(bookingRef, {
      ..., durationHours, slotKeys, slotKey: slotKeys[0], isNewStudent,
      ...
    });

    ...（bookingStats 更新邏輯完全不變，跟時段數無關）
  });
}
```
**關鍵**：`Promise.all(counterRefs.map(ref => tx.get(ref)))` 這種寫法要確認 Firestore SDK 允許在同一個 transaction 內對多個不同文件平行 `tx.get()`（這是合法的——transaction 只要求「所有讀取先於所有寫入」，沒有限制讀取只能一個一個循序做）。若测试發現不支援平行讀取，改成 `for...of` 循序 `await tx.get()` 即可，效果一樣，只是稍慢。

## 4. `cancelBooking` / `rescheduleBooking` 推廣

`cancelBooking`：讀出 `booking.slotKeys`（若是舊資料只有 `slotKey` 沒有 `slotKeys`，fallback 成 `[booking.slotKey]`，維持向後相容），對**每一格**做讀取→`count`/`newCount`或`returningCount` 各自 `Math.max(0, x-1)`。用 `booking.isNewStudent` 判斷要扣 `newCount` 還是 `returningCount`。

`rescheduleBooking`：讀出舊 `slotKeys` 陣列與新算出的 `slotKeys` 陣列（新的用同樣的 `durationHours`，除非UI決定要開放改期時連時數一起改——這次先不開放改時數，只能改日期/時段，`durationHours`/`isNewStudent` 沿用舊預約的值）。**所有舊格 + 所有新格**（扣掉真的重疊、沒有變化的格子，避免對同一個文件重複讀寫）都要在同一個 transaction 內讀取完才開始寫入。這比原本「只有可能1個新格」複雜一些，但原則不變：全部讀完才寫、任何一個新格不通過就整個 transaction 失敗不動舊格。

## 5. 讀取端：`bookingSchedule.js`

`fetchSlotCountsForRange`／`slotState` 現在除了 `count`/`blocked`，也要把 `newCount`/`returningCount` 一起帶出來給 UI 用。UI 顯示格式建議：`新{newCount}／舊{returningCount}（{count}/8）`，額滿時的視覺樣式（既有的 disabled 樣式）維持不變，只是多顯示這行文字。

## 6. UI 表單新增欄位

三個入口（`MemberBooking.jsx`／`PublicBookingApp.jsx`／`AdminBooking.jsx` 的建立預約表單）都要新增：
- **時數選擇**：1小時／3小時（2送1）——跟方案類別是兩個獨立的選擇，不是6選1的下拉，UI上比較清楚（對齊官網價目表本來就是「方案 × 時數」兩個維度）。
- **是否為第一次來體驗**：簡單勾選框，預設看目前有沒有更好的預設值可以推斷（例如帳號 `bookingStats.totalBookings` 是 0 時可以預設勾選，但不強制鎖死，使用者仍可自己改），不強制邏輯，只是體驗上的小提示。

## 7. 施工順序
1. `bookingDb.js`：schema + 多時段 transaction 邏輯（`createBooking`/`cancelBooking`/`rescheduleBooking` 三個都要改），這是本次風險最高的部分——延續既有的「先讀後寫、失敗就整個不動」原則，但要對N個文件做，不是1個
2. `bookingSchedule.js`：讀取端補上 `newCount`/`returningCount`
3. 三個入口的表單UI：時數選擇＋新生勾選框
4. 前後台的時段格顯示：「新X／舊X（共Y/8）」
5. `test-booking-concurrency.js` 補上3小時跨格併發測試案例
6. 驗證（含 design.md 情境重現：9點3小時舊生預約跨到10/11點的計數正確性），`CI=true npx react-scripts build`
7. 這個任務沿用上一個任務的「不要push main」限制——一樣先commit，等使用者親自測試（含Firestore額度恢復後跑併發測試）才push
