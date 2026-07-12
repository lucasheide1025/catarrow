# 貓小隊射箭場積分系統 — 安裝與部署指南

## 你需要準備的帳號
- GitHub 帳號（免費）：https://github.com
- Firebase 帳號（用 Google 帳號登入，免費）：https://firebase.google.com
- Vercel 帳號（用 GitHub 帳號登入，免費）：https://vercel.com

---

## STEP 1：建立 Firebase 專案

1. 開啟 https://console.firebase.google.com
2. 點「新增專案」→ 輸入名稱（例如 `catarrow`）→ 下一步到底
3. 左側選單「建構」→「Authentication」
   - 點「開始使用」
   - 啟用「電子郵件/密碼」登入方式
4. 左側選單「建構」→「Firestore Database」
   - 點「建立資料庫」→ 選「以測試模式啟動」（之後再部署正式規則）
   - 地區選 `asia-east1`（台灣最近）
5. 左側選單「專案設定」（齒輪圖示）→「你的應用程式」
   - 點「+新增應用程式」→ 選網頁（</>）
   - 輸入名稱 → 取得 `firebaseConfig` 設定物件，等等要用

---

## STEP 2：建立第一個管理員帳號

1. Firebase Console → Authentication → 使用者 → 新增使用者
   - 電子郵件：你的管理員信箱
   - 密碼：設定一個強密碼
   - **記下這個使用者的 UID**（在使用者列表裡點進去可以看）

2. Firebase Console → Firestore → 開始新增集合
   - 集合 ID：`admins`
   - 文件 ID：貼上剛才的 UID
   - 加一個欄位：`name` = 你的名字
   - 儲存

---

## STEP 3：設定本地開發環境

### 安裝 Node.js（如果還沒有）
到 https://nodejs.org 下載 LTS 版本安裝

### 下載並設定專案

```bash
# 在 Windows 的命令提示字元（cmd）或 PowerShell 執行

# 1. 把專案資料夾複製到你想放的地方
cd C:\Users\你的名字\Desktop

# 2. 進入專案資料夾
cd catarrow

# 3. 安裝套件（第一次要等一下）
npm install

# 4. 建立環境變數檔案
# 把 .env.local.template 複製一份，改名為 .env.local
# 然後用記事本打開，把裡面的值換成 Step 1 Step 5 得到的 Firebase 設定
```

`.env.local` 填寫範例：
```
REACT_APP_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXX
REACT_APP_FIREBASE_AUTH_DOMAIN=catarrow-xxxxx.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=catarrow-xxxxx
REACT_APP_FIREBASE_STORAGE_BUCKET=catarrow-xxxxx.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:xxxxxxxxx
```

### 在本地啟動

```bash
npm start
```

瀏覽器會自動開啟 http://localhost:3000
用你在 Step 2 建立的管理員帳號登入測試

---

## STEP 4：上傳到 GitHub

1. 在 GitHub 建立新的 Repository（私人）
2. 在專案資料夾執行：
```bash
git init
git add .
git commit -m "初始版本"
git remote add origin https://github.com/你的帳號/catarrow.git
git push -u origin main
```

---

## STEP 5：部署到 Vercel

1. 開啟 https://vercel.com → 用 GitHub 登入
2. 點「New Project」→ 選你剛才建立的 repository → Import
3. 在「Environment Variables」區塊，把 `.env.local` 裡的每一行都加進去
4. 點「Deploy」
5. 部署完成後 Vercel 會給你一個網址，例如 `catarrow.vercel.app`
   → 這個就是你的公開網址！

---

## STEP 6：部署 Firestore 安全規則

```bash
# 安裝 Firebase CLI
npm install -g firebase-tools

# 登入
firebase login

# 初始化（選擇 Firestore）
firebase init firestore

# 部署規則
firebase deploy --only firestore:rules
```

---

## 日常使用

- **系統網址**：你的 Vercel 網址
- **新增射手**：後台 → 會員管理 → 新增會員（會自動建立登入帳號）
- **更新系統**：改完程式碼後 `git push`，Vercel 自動重新部署

---

## 費用總覽

| 服務 | 免費額度 | 你的預估用量 |
|------|---------|------------|
| Firebase Firestore | 50,000 讀/天、20,000 寫/天 | 遠低於此 |
| Firebase Auth | 10,000 次驗證/月 | 遠低於此 |
| Vercel | 無限靜態部署 | 免費 |
| 網域（選購）| — | 約 NT$400-600/年 |

**結論：正常使用下完全免費**

---

## 遇到問題時

把錯誤訊息截圖給我，我來幫你解決。
