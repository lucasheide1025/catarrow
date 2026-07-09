# PRD：訪客模式全新UI＋兒童模式＋跨帳號共戰＋帳號轉移系統

## 背景

現有訪客模式（`GuestBattle.jsx`）是「用完即丟」設計：QR連結3小時過期、Firebase匿名登入、無持久資料。使用者要把它升級成可跨次造訪追蹤的正式體驗系統，同時新增給夏令營用的「兒童模式」（基於打怪模式疊加兒童向設計），兩者都要能跟正式學籍帳號一起組隊/打地下城，最後還要能把訪客/兒童帳號「轉正式」成為真正的學籍會員。

## Requirements

### 1. 帳號模型：`accountType` 三態
- `members/{id}` 新增欄位 `accountType: "official" | "guest" | "kid"`（沒有這欄位的既有資料視為 `"official"`）。
- 三種帳號共用同一套遊戲系統資料結構（金幣/材料/寶箱/卡片/地下城進度/貓咪等），差別只在 `accountType` 標籤跟部分權限/UI。
- **轉正式**＝同一份文件原地把 `accountType` 改成 `"official"`＋補上正式學籍欄位，不搬移任何遊戲資料。

### 2. 訪客/兒童入口
- 掃碼進站 → Firebase 匿名登入（沿用現有機制）→ 輸入信箱或電話 → 後端用聯絡方式的 hash（`contactHash`）查詢是否已有 `accountType in [guest,kid]` 且 `contactHash` 相符的既有記錄：
  - 找到 → 接續舊記錄（沿用其 `id`，重寫 `uid` 為這次的匿名 uid）
  - 找不到 → 新建一筆（`accountType` 由入口網址/QR 類型決定是 guest 還是 kid）

### 3. 訪客模式：全新 UI（完全取代舊版）
- 分頁：打怪 / 地下城（簡化版）/ 組隊 / 決鬥 / 世界王 / 商店 / 結算分享。
- 地下城採**簡化版**：固定樓層數與固定王，不使用正式版的挖掘/遠征/卷軸三來源系統，體驗向、降低上手門檻。
- 視覺風格全新設計（不沿用現有 MemberApp 樣式），偏向「體驗/宣傳感」，鮮豔活潑、強調立即上手。

### 4. 訪客結算分享卡
- 新元件 `GuestShareCard`（不沿用 `ShareCard.jsx`，因為那個綁死射手證/屆數等正式學籍限定資料）。
- 視覺沿用 `ShareCard.jsx` 的漸層卡片美術語言，內容改成：今日射箭數、擊敗的怪物/王、地下城通關層數、累積金幣、標語。
- 支援存圖/分享到社群。

### 5. 兒童模式
- 基礎：現有打怪模式（`MonsterBattle.jsx`）疊加兒童向設計：
  - 操作簡化：按鈕加大、文字精簡
  - 命中判定保底：降低脫靶率，避免小朋友挫折感過重
  - 簡化計分：弱化環數細節，強調「有沒有中」的正向回饋
  - 額外可愛過場動畫/貼紙/鼓勵語音
- **組隊打怪／地下城模式不簡化**，直接沿用現有房號機制（建房→分享房號→輸入房號加入），讓爸媽（不論是正式學生或另外開一個訪客身份）能直接加入小孩的房間幫忙打。房間不限制帳號類型，房號本身已經是私密邀請機制，不需額外存取限制。

### 6. 後台管理
- 新增「兒童模式」分頁：
  - 建立/管理夏令營場次（場次名稱、日期、對應QR/連結）
  - 查看/管理該場次所有兒童帳號（列表、篩選）
  - 批次或單筆「轉正式」（選擇記錄→輸入正式學籍需要的欄位→建立正式 email/password 帳號→改寫該記錄的 `uid`+`accountType`）
  - 產生兒童模式專屬 QR / 連結

### 7. Firestore 規則調整
- `members` 集合新增 `accountType in ["guest","kid"]` 的專屬分支：
  - `create`：登入（含匿名）即可建立，前提 `request.resource.data.uid == request.auth.uid` 且 `accountType` 為 guest/kid。
  - `update`：登入（含匿名）即可改動，**不要求** uid 對應本人（因為匿名重登入 uid 每次都變，這是使用者已確認接受的安全取捨）。
  - `get`：`accountType in ["guest","kid"]` 的文件，登入即可讀（不要求 uid/email 對應）。
- 既有 `official` 帳號的規則完全不變（uid/email 對應 + hasOnly 白名單）。

## 限制與既有架構

- 正式會員登入是真 Firebase Auth email+password（`useAuth.js::signInWithEmailAndPassword`），跟訪客/兒童的匿名登入是兩條路——轉正式時要透過現有「新增會員」後台流程建立真正的 email/password 帳號，再把既有文件的 `uid` 改指向新帳號。
- 組隊/地下城房間系統（`PartyLobby`/`DungeonLobby` 房號機制）本來就不管帳號類型，跨帳號共戰不需要新開發任何房間邏輯，只需要在訪客/兒童UI裡曝露「輸入房號加入」的既有入口。
- 官方排行榜/名冊/檢定/競賽等既有查詢（現在都是直接掃整個 `members` collection 或用 `list`）需要逐一加上 `where accountType == "official"` 過濾，避免訪客/兒童資料混進正式榜單——這是一筆需要逐一稽核既有查詢點的工作，範圍待 design.md 列清單。
- 遵守 self-claim 精神：訪客/兒童資料寫入都是玩家自己的 session 直接寫，不涉及跨帳號代寫。

## Acceptance Criteria

- [ ] `members` 新增 `accountType`/`contactHash` 欄位，`firestore.rules` 對應規則部署（需使用者手動貼 Firebase Console）。
- [ ] 掃碼→輸入聯絡方式→建立或接續 guest/kid 記錄的完整流程可運作。
- [ ] 訪客模式全新 UI 上線，含簡化版地下城。
- [ ] `GuestShareCard` 可正確顯示當次體驗成果並可存圖/分享。
- [ ] 兒童模式單人打怪呈現簡化/保底/鼓勵設計；組隊/地下城沿用現有房號系統，正式學生/訪客可用房號加入兒童房間。
- [ ] 後台「兒童模式」分頁可建立場次、管理帳號、執行轉正式、產生QR。
- [ ] 官方排行榜/名冊/競賽等既有查詢已加上 `accountType=="official"` 過濾，訪客/兒童資料不會混入。
- [ ] `npm run build` 編譯成功。

## Notes

範圍非常大，預期分階段實作（見 `implement.md` 的 Phase 切分），不會一次做完。
