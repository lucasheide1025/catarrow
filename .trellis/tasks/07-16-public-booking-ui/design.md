# 訪客預約介面與課表優化設計

## Information architecture

將 `PublicBookingApp` 重排成明確步驟：`選擇課程` → `選擇日期與時段` → `聯絡資料／登入` → `確認預約`。頁首提供品牌、流程說明，以及一直可見的「會員登入」次要入口；登入後改為「我的預約」。非必要問卷收進可展開的「其他需求」區，避免第一次進入時形成長表單牆。

視覺採精品射箭館方向：深海軍藍與炭黑底、香檳金主要行動、少量紫色會員識別。卡片具有清楚層級與克制陰影；不使用過量 emoji、漸層或遊戲式特效。手機為單欄，較寬桌面將課程／日期與預約摘要排成雙欄。

## Availability privacy

`DateSlotPicker` 新增顯示模式，例如 `availabilityDisplay="public"`。底層仍呼叫 `slotState()` 取得 disabled 與真實容量判斷，但公開模式只映射成：

- 可選：`可預約`
- 容量不足：`已額滿`
- 被封鎖、跨時段不足或超出營業時間：`不可預約`
- 非營業日：`公休`

會員與教練既有模式保持原資訊，不全站移除容量細節。

## Date navigation

公開頁日期界線使用 Asia/Taipei 今天至「下個月同日」為止。日期列以 7 天為一頁，提供前後切換：使用者可回到已瀏覽的較近未來日期，但前一頁永遠不會早於今天；下一頁不會產生最大日期之後的選項。切換課程時數或人數會清除不再有效的已選時段。

## Duration clarity

共用格式以 `durationLabel()` 與 `computeEndTime()` 為準。公開時段按鈕直接顯示 `10:00－12:00` 與 `2 小時`；所有摘要、登入前確認、成功頁、會員中心卡片、取消／改期與改期 picker 都顯示完整起訖與時數。

## Accessibility and responsive behavior

- 表單元件具可點擊 label、`name`、`autocomplete`、正確 type/inputMode。
- 所有按鈕與連結至少 44px，具有 `:focus-visible`，不以 div 模擬操作。
- 非同步錯誤與成功提示使用 `aria-live`；Modal 控制 overscroll。
- 動畫只使用 opacity/transform 並遵守 `prefers-reduced-motion`。
- 360px 無水平溢出，底部固定主要行動包含 safe-area inset。

## Compatibility

不改 `createBooking`、容量 transaction、價格與 Firestore schema。共用 DateSlotPicker 的新增 props 要有維持現況的預設值，避免學生／教練流程退化。
