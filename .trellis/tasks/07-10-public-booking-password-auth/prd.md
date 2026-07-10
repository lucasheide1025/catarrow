# PRD：新生自助入口（`PublicBookingApp.jsx`）改用 Email＋密碼註冊/登入

## 背景

現況：`PublicBookingApp.jsx`（隱藏連結 `?bk=<token>`）流程是「填姓名/Email/電話 → 選時段 → 送出」，身份靠 `resolveGuestSession()` 的 email/電話 hash 比對找回/建立同一筆 `members` 文件（`accountType:"guest"`），沒有密碼，靠匿名 Firebase Auth。

使用者要求：
1. **流程改成先選時段，再處理身份**（選完時段後才跳出註冊/登入）。
2. **新增密碼**：第一次填密碼＝完成註冊；之後回訪可以用同一組 Email＋密碼登入，不用重新輸入所有資料。

## 已確認的設計決定
- 註冊/登入都在**隔離的臨時 Firebase App** 上做（比照今天稍早修過的 `guestAuth.js` 匿名身份隔離模式、以及 `AddMemberModal` 建帳號的既有慣例）——這個頁面可能在教練自己也登入著的裝置上被打開，絕對不能動到主要的 `auth` 物件。
- 帳號身份仍然以 **email 的 contactHash** 為準（不是 Firebase Auth uid），維持跟既有 guest/kid 帳號模型一致——註冊時用 contactHash 找回/建立 `members` 文件，把新建立的（非匿名）uid 寫回去；登入時先驗證密碼正確，再一樣用 contactHash 找回同一筆文件（不是靠 uid 反查，這樣即使之前用過舊的匿名QR碼流程建立過同一個 email 的記錄，也能正確接續上，不會產生重複帳號）。
- **這組密碼帳號的權限範圍僅止於這個隱藏頁面本身**——不會因為有密碼就自動獲得 `bookingBetaAccess` 或能登入完整的學生 App（`MemberApp.jsx`）。這是刻意的範圍限制，如果之後要開放這組帳號密碼登入完整 App，需要另外評估。

## 範圍
1. `PublicBookingApp.jsx` 流程重排：
   - 步驟一：選方案+時數+日期時段（沿用既有 `PlanDurationPicker`/`DateSlotPicker`，不用登入就能選）
   - 步驟二：選完時段後，顯示「註冊」／「登入」兩個分頁
     - 註冊：姓名／Email／電話／密碼（4個必填欄位）
     - 登入：Email／密碼
   - 步驟三：註冊或登入成功後，直接用步驟一選好的時段呼叫 `createBooking`，不用重選一次
2. `src/lib/guestAuth.js` 新增（或擴充）函式：
   - `registerGuestWithPassword(name, email, phone, password)`：臨時App建立Email+密碼帳號 → 用email的contactHash找回/建立`members`文件 → 寫回新uid → 回傳profile
   - `loginGuestWithPassword(email, password)`：臨時App驗證密碼 → 通過後用email的contactHash查找`members`文件 → 回傳profile（若這個email從來沒建立過記錄，給清楚的錯誤訊息引導去註冊）
3. 密碼欄位基本驗證（前端）：至少6碼（Firebase Auth 原生下限），註冊時盡量給清楚的錯誤訊息（例如email格式錯、密碼太短、email已經註冊過要改成登入）。

## 驗收
1. 新使用者：選時段 → 點「註冊」分頁 → 填姓名/Email/電話/密碼 → 送出 → 直接看到「預約成功」（不用重選時段）。
2. 同一使用者關掉頁面重新打開連結：選一個新時段 → 點「登入」分頁 → 輸入同一組Email/密碼 → 成功後看到自己是同一個人（姓名對得上），送出後這個新時段的預約也記在同一個 `members` 文件底下。
3. 密碼錯誤／email不存在時，登入分頁要給清楚的錯誤訊息，不能是原始的 Firebase 錯誤代碼英文。
4. 這組帳號密碼**不能**用來登入正式的學生 App（`MemberApp.jsx`／`LoginPage`）——確認一下 `useAuth.js` 的既有登入邏輯跟這個新流程完全獨立，不會互相干擾。
5. 在教練自己已經登入的分頁上開這個隱藏連結、走一次註冊流程，確認教練自己的登入身份完全沒被換掉或受影響（這是最需要小心驗證的地方，比照今天稍早那個auth重用bug的教訓）。
6. `CI=true npx react-scripts build` 通過。

## 非目標
- 不做「忘記密碼」/重設密碼功能——這次先不做，之後真的需要再排。
- 不讓這組帳號密碼直接登入完整學生 App。
- 不處理「同一個人在QR碼匿名流程與這個密碼流程之間切換身份」的進階整合——只確保用同一個email的話兩邊都會找到同一筆`members`文件，不特別做額外的帳號合併UI。
