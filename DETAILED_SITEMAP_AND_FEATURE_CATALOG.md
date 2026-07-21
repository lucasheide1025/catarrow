# 🗺️ 貓小隊專案全功能細部網站地圖與參數對照手冊 (For Claude Review)

> **報告說明**：本報告詳列 `catarrow` 專案中 4 大應用入口、全頁面視圖、彈窗 Modal、UI 控制參數、State 變數與 Firestore 存取路徑。供 Claude 及開發團隊進行全面功能查核與重構。

---

## 📑 目錄
1. [🌐 超詳細網站地圖 (Exhaustive Sitemap)](#1--超詳細網站地圖-exhaustive-sitemap)
2. [📦 核心功能區塊、輸入參數與 State 明細](#2--核心功能區塊輸入參數與-state-明細)
   - [2.1 線上約課系統 (Booking System)](#21-線上約課系統-booking-system)
   - [2.2 會計財務與月卡系統 (Billing & Monthly Card)](#22-會計財務與月卡系統-billing--monthly-card)
   - [2.3 會員學籍與權限管理 (Members & Permissions)](#23-會員學籍與權限管理-members--permissions)
   - [2.4 RPG 地下城與冒險者公會 (Dungeon & Guild)](#24-rpg-地下城與冒險者公會-dungeon--guild)
   - [2.5 貓村經營與抽卡系統 (Cat Village & Gacha)](#25-貓村經營與抽卡系統-cat-village--gacha)
   - [2.6 賽事與世界王系統 (Competitions & World Boss)](#26-賽事與世界王系統-competitions--world-boss)

---

## 1. 🌐 超詳細網站地圖 (Exhaustive Sitemap)

### 1.1 🎯 教練管理後台 (`AdminApp.jsx`)
入口網址/模式：`/admin` (或教練登入後預設視圖)

```
教練營運後台 (AdminApp.jsx)
├── 頂部教練控制列 (Sticky Header)
│   ├── 射手模式切換按鈕 (setArcherMode(true))
│   └── 登出按鈕 (logout())
├── 全域通知橫幅 (Notification Banners)
│   ├── 👑 地下城首殺公告 (dungeonKillAlert)
│   ├── 🔔 待審核事項提示條 (pendingCertN / pendingMsgN / pendingExamN / pendingGuildN...)
│   └── 🎫 月卡待審核提示條 (pendingMonthlyN)
├── 📌 次級分頁快捷 Pills (Top Sub-Nav Bar - Sticky)
└── 📱 主選單四大分頁 (Bottom Main Navigation Bar)
    ├── 1. 📅 今日營運 (`page = "daily"`)
    │   ├── 📅 線上約課 (`dailySub = "booking"`) → AdminBooking.jsx
    │   │   ├── 當日與週行事曆視圖 (AllocateDayLanes Grid)
    │   │   ├── 時段名額封鎖 Modal (BlockSlotModal)
    │   │   ├── 預約修改 Modal (EditBookingModal)
    │   │   └── 輸出今日課表圖卡 Modal (BookingScheduleCard.jsx)
    │   ├── 🔔 審核中心 (`dailySub = "review"`) → AdminUnifiedReview
    │   │   ├── 一般審核 Tab (AdminReviewCenter.jsx)
    │   │   └── 公會任務審核 Tab (AdminGuildQuests.jsx)
    │   └── 🎫 財務與記帳 (`dailySub = "monthlycard"`) → AdminFinance.jsx
    │       ├── 🎫 月卡管理 Tab (AdminMonthlyCard.jsx)
    │       └── 💰 會計記帳 Tab (BillingSystem.jsx)
    │
    ├── 2. 👥 學員財務 (`page = "members-finance"`)
    │   ├── 👥 會員管理 (`mfSub = "members"`) → AdminMembers.jsx
    │   │   ├── 會員搜尋/排序/篩選
    │   │   ├── 稱號與稱號權限配給 Modal
    │   │   └── 點數與經驗值手動微調 Modal
    │   ├── 🎫 訪客帳號 (`mfSub = "guests"`) → AdminGuestAccounts.jsx
    │   ├── 🎈 兒童模式 (`mfSub = "kidmode"`) → AdminKidMode.jsx
    │   ├── 📓 學習紀錄 (`mfSub = "learn"`) → AdminLearn.jsx
    │   └── 💬 學生留言 (`mfSub = "messages"`) → AdminMessages.jsx
    │
    ├── 3. 🎮 遊戲活動 (`page = "game-events"`)
    │   ├── 🏆 賽事管理 (`eventsSub = "comps"`) → AdminCompetitions.jsx
    │   ├── 📜 公會任務 (`eventsSub = "guild"`) → AdminGuildQuests.jsx
    │   ├── 👑 世界王 (`eventsSub = "worldboss"`) → AdminWorldBoss.jsx
    │   ├── ⚔️ 魔王對戰 (`eventsSub = "battlesetting"`) → AdminBattleEvent.jsx
    │   ├── 🗡️ 裝備庫 (`eventsSub = "items"`) → AdminEquipItems.jsx
    │   ├── 🏡 貓村管理 (`eventsSub = "village"`) → AdminVillageManager.jsx
    │   └── 📖 故事章節 (`eventsSub = "story"`) → AdminStoryManager.jsx
    │
    └── 4. ⚙️ 系統設定 (`page = "system-tools"`)
        ├── 🎁 獎品發放 (`sysSub = "givetool"`) → AdminGiveTool.jsx
        ├── 🎓 權限矩陣 (`sysSub = "tierperms"`) → AdminTierPermissions.jsx
        ├── 📷 射箭辨識 (`sysSub = "archery"`) → AdminArchery.jsx
        ├── 🔄 重置中心 (`sysSub = "reset"`) → AdminResetCenter.jsx
        └── 🧪 測試工具 (`sysSub = "testing"`) → AdminDungeon.jsx & AdminBattleTest.jsx
```

### 1.2 🏹 射手學生前台 (`MemberApp.jsx`)
```
射手學生前台 (MemberApp.jsx)
├── 頂部狀態列 (MemberHeader)
│   ├── 射手等級、頭像、稱號
│   ├── 貓幣、體力條、經驗條
│   └── 每日簽到 / 任務提醒
└── 底部導覽選單 (Bottom Nav)
    ├── 🏠 首頁 (home) → 個人數據、成就進度、公告
    ├── 🗺️ 冒險中心 (adventure-hub)
    │   ├── ⚔️ 單人打怪戰鬥
    │   ├── 👥 隊伍冒險討伐
    │   ├── 👑 世界王 BOSS 挑戰
    │   └── 🏰 地下城探索 (DungeonMapView)
    ├── 🏹 練箭中心 (training-hub)
    │   ├── 🎯 靶面成績登記與分析
    │   ├── 🏆 年度檢定申請
    │   └── 📈 歷史成績曲線圖 (GrowthChart)
    ├── 🏡 貓村中心 (gacha) → 貓咪抽卡 (CatGachaModal)、建築管理、派遣採集
    ├── 🎒 背包裝備 (inventory-hub) → 裝備穿戴 (Equipment.jsx)、精煉、道具使用
    ├── 📅 線上約課 (booking) → 學生線上預約日曆
    └── 👤 我的帳號 (profile) → 成就章/肥貓章展示、個人設定
```

### 1.3 📅 學生線上約課前台 (`PublicBookingApp.jsx`)
```
線上約課前台 (PublicBookingApp.jsx)
├── Step 1: 選擇日期與熱門時段 (DateSlotPicker.jsx)
├── Step 2: 選擇課程方案、時數與人數 (PlanDurationPicker.jsx & ParticipantCountPicker.jsx)
├── Step 3: 手機號碼身份驗證 / 顧客資料填寫 (簡訊驗證碼 / 會員快速載入)
└── Step 4: 預約成功明細與 Email 確認信發送
```

---

## 2. 📦 核心功能區塊、輸入參數與 State 明細

### 2.1 線上約課系統 (Booking System)
- **主要處理模組**：`AdminBooking.jsx` / `PublicBookingApp.jsx` / `BookingScheduleCard.jsx` / `src/lib/bookingDb.js`
- **核心常數與設定值**：
  - `LANE_CAPACITY = 8`：單一時段全場名額上限（8 人）。
  - `CALENDAR_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]`：營業時間 10:00 至 21:00。
  - `PLAN_TYPES`：`general` (單人一般), `discount` (兒童/學生/敬老), `own_equipment` (自備器材)。
- **組件 State 變數**：
  - `selectedDate` (`"YYYY-MM-DD"`): 當前選取日期。
  - `editTarget` (`Booking` 物件): 當前編輯中的預約資料。
  - `startTime` (`"HH:mm"`): 預約開始時間（教練可任意提早/調整）。
  - `durationHours` (`1` | `2` | `3`): 課程時數。
  - `participantCount` (`1`~`8`): 預約人數。
- **Firestore 集合與欄位**：
  - `bookings/{bookingId}`：
    `{ date, startTime, endTime, durationHours, planType, participantCount, slotKeys: ["2026-07-21_10", ...], status: "confirmed", isNewStudent, memberName, memberId }`
  - `bookingSlotCounts/{slotKey}`：
    `{ count, blocked, newCount, returningCount }`（原子事務 `runTransaction` 更新）。

### 2.2 會計財務與月卡系統 (Billing & Monthly Card)
- **主要處理模組**：`BillingSystem.jsx` / `AdminMonthlyCard.jsx` / `AdminFinance.jsx` / `src/lib/db.js`
- **核心常數與設定值**：
  - `PLANS`：`自一` ($200), `自二` ($400), `自三` ($400), `單一` ($300), `單二` ($600), `單三` ($600), `學一` ($200), `學二` ($400), `學三` ($400)。
  - `EARLY_BIRD_MAX = 123`（射手編號 `<= 123` 享早鳥資格）。
  - `EARLY_BIRD_DISC = 50`（早鳥折扣 NT$ 50）。
  - `PAY_METHODS`：`["現金", "轉帳", "月卡"]`。
- **組件 State 變數**：
  - `memberQuery` (String): 搜尋輸入之射手姓名。
  - `selectedMember` (Member Object): 當前連結之會員資料。
  - `plan` (String): 選定之會計方案 ID。
  - `payMethod` (`"現金"` | `"轉帳"` | `"月卡"`): 付款方式。
  - `discount` (Boolean): 是否勾選早鳥折扣。
  - `filterMode` (`"today"` | `"month"` | `"year"`): 清單與報表篩選模式。
- **Firestore 集合與欄位**：
  - `billing/{recordId}`：
    `{ date, memberName, memberId, plan, basePrice, discount, finalPrice, paymentMethod, year, month, day, note, createdBy }`
  - `members/{memberId}` 的 `monthlyCard` 欄位：
    `{ active: true, sessions: 16, expiresAt: Timestamp }`

### 2.3 會員學籍與權限管理 (Members & Permissions)
- **主要處理模組**：`AdminMembers.jsx` / `AdminTierPermissions.jsx` / `src/lib/accessControl.js`
- **核心常數與設定值**：
  - `TIERS`：`archer_tier_0` 至 `archer_tier_5`（劃分社團、公會與射箭場權限）。
  - `COMP_TYPES`：`實體賽`, `積分賽`, `挑戰賽`, `臨時任務賽`, `年度檢定`。
- **組件 State 變數**：
  - `search` (String): 會員名稱/編號搜尋關鍵字。
  - `selectedTier` (String): 權限階級篩選。
  - `editingMember` (Member Object): 稱號與點數修改中之會員。

---
*詳細地圖手冊更新時間：2026-07-21*
