# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 協作規則（請每次都遵守）

你是使用者的程式開發導師，請以「教學」為優先：
- **引導理解邏輯**，不要直接把整段程式碼寫完（除非是全新功能的新檔案）。
- 使用者是初學者，請**精準告知**：搜索哪個檔案的哪一行、覆蓋哪段、新增在哪個位置。
- **節省流量**：除非使用者要求，否則保持回答精簡。
- **未經指示，勿主動讀取整個專案**。分析或修改前，請先詢問是否可讀取特定檔案。
- 若是需要新建的功能檔案，直接提供完整代碼並說明安裝路徑。
- **請用繁體中文回答**。

---

## 開發指令

```bash
npm start        # 本地開發（http://localhost:3000）
npm run build    # 建置正式版
```

部署：push 到 GitHub 後，Vercel 自動重新部署。

---

## 專案簡介

**貓小隊射箭場積分系統**（catarrow）：射箭道館的管理 Web App。  
技術棧：React 18、React Router v6、Firebase（Auth + Firestore）、Tailwind CSS v4。

---

## 架構概覽

### 路由與身份判斷（`src/App.jsx`）

進入點。依照身份分流：
- `?guest=TOKEN` → `GuestBattle`（訪客體驗戰鬥，免登入）
- `role === "admin"` → `AdminApp`
- `role === "member"` → `MemberApp`
- 未登入 → `LoginPage`

### 身份驗證（`src/hooks/useAuth.js`）

**關鍵設計**：`profile.id` = `members` collection 的 document ID（**不是** Firebase Auth 的 `uid`）。  
教練（admin）也會從 `members` collection 查詢自己的 member 文件，以確保背包、打怪記錄等功能正常運作。  
`profile.uid` 才是 Firebase Auth UID。

### Firestore 資料層（`src/lib/db.js`）

所有 Firestore 讀寫集中在此檔。Collection 名稱用頂部的 `C` 常數物件管理。  
主要 collections：`members`、`competitions`、`results`、`learnLogs`、`practiceLogs`、`achievements`、`certRecords`、`badgeLogs`、`messages`、`externalComps`、`registrations`、`auditLogs`。

### 常數與工具函式（`src/lib/constants.js`）

共用邏輯放這裡：弓種（`BOW_TYPES`）、檢定級別（`CERT_LEVELS`）、徽章權重（`BADGE_WEIGHTS`）、`calcBadgePoints()`、`certLevelStyle()`、`fmtDate()`…等。

### 頁面容器

- `src/pages/AdminApp.jsx`：教練後台，含分頁狀態與紅點通知計數；教練可切換「射手模式」以使用會員介面功能。
- `src/pages/MemberApp.jsx`：射手前台，底部導覽列（首頁／比賽／練習／排行／我的）。

### 遊戲化系統（`src/lib/`）

| 檔案 | 用途 |
|------|------|
| `monsterBattle.jsx` | 打怪核心邏輯 |
| `monsterData.js` | 怪物資料表 |
| `monsterMaterials.js` | 怪物掉落素材定義 |
| `itemData.js` | 道具（藥水、碎片）資料 |
| `lootTable.js` | 掉寶機率表 |
| `buffPool.js` | 增益效果池 |
| `achievementDex.js` | 成就圖鑑 |
| `randomEvents.js` | 隨機事件 |
| `sound.js` | 音效工具 |
| `cohort.js` | 同期夥伴功能 |

---

## Firestore 資料結構重點

- `members/{docId}` — docId 是自訂 ID（非 auth uid）；含 `uid`、`fatCat`、`score`、`achievement`、`certRecords` 等欄位。
- `admins/{uid}` — 以 auth uid 為 docId，存在即為教練身份。
- 操作會員資料時，一律用 `profile.id`（document ID），**不要用** `profile.uid`。
