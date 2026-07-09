# 🤖 ai-guide — AI 接手手冊（任何模型通用）

> 這份文件是給「任何 AI 模型」（Claude / GPT / Gemini / …）的接手指南。
> 目標：讀完這份，你就能用跟前任 AI 一致的思路做功能設計、UI/UX、程式編寫與除錯。
> quick-ref.md 記的是「事實」（函式/路徑/坑），這份記的是「**方法**」（怎麼想、怎麼做）。
> 最後更新：2026-07-09

---

## 0. 三十秒定位

- **專案**：貓小隊射箭場積分系統（catarrow）——射箭道館管理 Web App ＋ 大量遊戲化系統（打怪/地下城/貓村/卡片/世界王/組隊/決鬥/訪客兒童模式）。
- **技術棧**：React 18（CRA / react-scripts）、React Router v6、Firebase Auth + Firestore、Tailwind（CDN 版，注意偽類限制）。**純前端，沒有後端伺服器、沒有 Cloud Functions。**
- **部署**：push 到 GitHub `main` → Vercel 自動部署。沒有 staging，main 就是 production。
- **使用者**：道館教練（admin）＋ 學生（member）＋ 訪客/兒童（guest/kid），幾乎全是**手機瀏覽器**使用。
- **老闆**：非工程師，用繁體中文溝通，重視「教學式說明」與「精簡回答」。

---

## 1. 📖 閱讀順序（做任何事之前）

**鐵則：先讀筆記，不要先 grep 源碼。** 順序如下：

| 步驟 | 讀什麼 | 為了什麼 |
|------|--------|----------|
| 1 | `docs/second_brain/quick-ref.md` | 踩過的坑、函式速查、collection 清單——90% 的問題答案在這 |
| 2 | 本檔（ai-guide.md） | 方法論與慣例 |
| 3 | `docs/second_brain/game-systems.md` / `features.md` | 遊戲系統規格、功能現況 |
| 4 | `docs/second_brain/changelog.md` | 最近改了什麼、為什麼（由新到舊） |
| 5 | `.trellis/spec/frontend/*.md` | 各子系統的正式 code-spec（英文，含 contract/error matrix） |
| 6 | 這時才讀源碼 | **針對性讀特定檔案**，不要盲目掃整個專案 |

改完任何東西後：**更新 changelog.md（含「為什麼」與「踩坑提醒」）→ 同步複製到 `C:\Users\broud\Documents\Obsidian Vault\catarrow\`**。這不是選配，是流程的一部分。

---

## 2. ⛓️ 鐵律（違反 = 必出 bug）

這些是被真實 bug 教出來的架構級規則，優先權高於任何「更漂亮的寫法」：

1. **`profile.id` ≠ `profile.uid`**。`id` = `members` 的 Firestore docId，`uid` = Firebase Auth UID。操作會員資料一律用 `profile.id`。登入查找是 `where("uid","==",...)` 查詢，**從不靠 docId===uid**（所以 guest 轉正式可以原地改寫文件）。
2. **Firestore 規則只能手動貼進 Firebase Console**（CLI 部署會 403）。任何規則變更都要明確提醒老闆去貼，否則新功能會全數 permission-denied。規則必須寫在 `match /databases/{database}/documents { }` **內部**。
3. **會員自己會寫入的新欄位，必須加進 `firestore.rules` 的 hasOnly 白名單**，否則寫入被「靜默」擋掉（不報錯、資料就是不動）。
4. **禁止「一人瀏覽器幫別人寫入」模式**。`members` 規則只准改自己的文件；跨帳號發獎勵一律改成「自行請領」（範本：`claimVillageGoalReward`、`claimWorldBossKillReward`、`claimCardSaleProceeds`）。
5. **優先瀏覽器端計算，Firestore 只存結果**。這個 app 不需要防作弊，不要為了「安全」把邏輯搬去不存在的後端。
6. **共用常數不要放在 UI 元件裡再 re-export**——會造成循環 import，症狀是「教練切換射手模式白屏」。常數放 `src/lib/constants.js` 或對應的 `src/lib/*.js`。
7. **改任何 member 端元件後，必須確認教練後台「切換射手模式」不白屏**（AdminApp 也會 render member 元件）。
8. **多人併發寫同一文件要用 transaction**（範本：`trySetDungeonFirstClear`）；「先查後寫」在組隊場景必產生重複寫入。
9. **`deleteField()` 只能出現在 `updateDoc` 的 payload**。同一個 patch 物件若要拿去 `addDoc`（稽核 log）或 return，先做一份 sanitized 副本（sentinel 換成 null）。
10. **數值耦合檢查**：改任何「戰力相關」數值前，先確認它會不會被 `calcArcherPower()` 讀到——archerStats 同時是戰鬥力**也是**怪物配對難度輸入，拉高數值可能跨過 `getTierPoolByPower` 門檻（100/180/280/400）反而配到更強的怪。這是一個通用教訓：**改 A 之前先問「還有誰在讀 A」。**

---

## 3. 🛠️ 程式編寫慣例

### 檔案放哪裡
- Firestore 讀寫 → **全部**集中在 `src/lib/db.js`（子系統大的另立 `xxxDb.js`：`duelDb`/`dungeonDb`/`partyDb`/`expeditionDb`/`worldBossDb`/`guestAuth`）。collection 名稱一律走頂部 `C` 常數物件，不硬編字串。
- 純邏輯/資料表 → `src/lib/*.js`（monsterData、lootTable、archerLevel…），**不含 UI、不 import 元件**。
- 頁面容器 → `src/pages/`（AdminApp / MemberApp / GuestApp / LoginPage）。
- 元件 → `src/components/<域>/`（admin / member / party / duel / dungeon / worldboss / cat / shared）。
- 共用 UI 原件 → `src/components/shared/UI.jsx`：`Card` `Btn` `Modal`(有 `wide`) `Inp` `Sel` `TA` `Spinner` `Empty` `ConfirmModal` `useToast`。**寫新後台/表單前先看這裡有什麼，不要重造。**

### 寫法風格
- 元件用 function component + hooks，`export default function Xxx()`。
- 大元件用 `lazy(() => import(...))` 掛進頁面容器，並加進對應的 `NAV_PRELOADS`（AdminApp/MemberApp 都有預載表）。
- 新增 member 端頁面 → 記得 AdminApp 的射手模式路由也要補（雙路由）。
- 註解寫「**為什麼**」不寫「做了什麼」；重大設計取捨直接寫在檔案頂部（參考 `GuestShareCard.jsx`、`GuestDungeonSimple.jsx` 的頭部註解風格）。
- 中文註解、中文 UI 文案；變數/函式名英文。
- 效能慣例：需要既有資料時優先讓呼叫端傳 clientData 進來（`upgradeEquipSlot`/`submitMonthlyCardRequest` 模式），少一次 getDoc。

### 改既有程式的紀律
- **小步改**：找到準確的行，只動需要動的段落，不重排無關程式碼。
- 兩套平行系統（如 `dungeonDb` 與 `partyDb` 的前後衛邏輯）改一邊時，**必須檢查另一邊要不要同步**。
- 改共用函式前先 grep 所有呼叫端，確認每個呼叫端在新行為下仍正確。

---

## 4. 🎨 UI / UX / 美術設計語言

### 視覺基調
- **深色系**為主：背景深藍/深灰，卡片 `rgba(255,255,255,0.04~0.08)` ＋ `border-white/10`，圓角 `rounded-2xl`。
- 主行動按鈕用**漸層**：`linear-gradient(90~135deg, 主色, 深主色)`，字 `font-black`。
- 各系統有自己的主題色：打怪＝琥珀金（#fbbf24→#f59e0b）、地下城＝紫藍（#7c3aed→#2563eb）、兒童模式＝亮色大按鈕。新功能先決定主題色再開工。
- 圖示用 **emoji**（🏹⚔️💰🎈），怪物/徽章用 **SVG 元件**（`MonsterSVG`/`BadgeSVG`），**不用圖片檔**；例外：貓村/卡片系統用 `public/` 下的預生成圖片。
- 音效用 **Web Audio 合成**（`src/lib/sound.js` 的 `sfxTap/sfxSuccess/sfxCast/...`），不用音檔。要新音效就組合 noiseBurst/distTone，不要引入 mp3。

### UX 原則
- **手機優先**：單欄直式佈局、底部導覽列、大按壓目標。桌機不是設計目標。
- 分頁狀態用 `useState` 的 `page`/`tab`/`sub` 字串，不用 router 巢狀路由（全 app 只有頂層一個 route 分流）。
- Hub 模式：後台用「Hub 卡片 → 子頁 → HubBack 返回」兩層結構（AdminMemberHub 模式），新後台功能就加一張 `HubCard` ＋ 一個 `memberSub===` render 分支。
- 回饋必達：每個寫入操作都要有 toast（成功/失敗），危險操作套 `ConfirmModal`。
- 等待狀態：`Spinner`／文字「載入中…」／按鈕 `disabled + 文案變化`（「儲存中…」）。
- 兒童向 UI = **放大＋簡化**（`py-6 text-2xl`、短文案、少層級），**不是**改遊戲數值。
- 分享卡（ShareCard/GuestShareCard）語言：9:16 直式、漸層底、主題色可切換、html2canvas 出圖。新的「炫耀型」功能沿用這套。

### 文案語氣
- 繁體中文、輕鬆遊戲化（「出發打怪！」「恭喜通關！」），教練後台則精簡專業。
- 提示訊息說清楚「發生什麼＋怎麼辦」，不要只寫「錯誤」。

---

## 5. 🧩 功能設計方法論

新功能從想法到上線的標準思路：

1. **先查再想**：quick-ref + game-systems 確認有沒有既有系統可重用（例：兒童協戰 = 既有房號系統，零新程式碼）。**「不用寫程式」是最好的方案。**
2. **資料模型先行**：先定 Firestore 欄位/collection（寫進 design 文件），再想 UI。問三個問題：誰寫入？（決定規則）欄位缺省時舊資料怎麼辦？（JS 端 filter，別用 where 查「欄位不存在」）會不會有人併發寫？（要不要 transaction）
3. **分 Phase 切**：每個 Phase 是**獨立可上線**的單位（新增不破壞既有），一個 Phase 一個 commit+push。範例切法：規則+資料層 → 入口+主UI → 玩法內容 → 後台管理。
4. **重用戰鬥核心**：任何新戰鬥玩法都掛回既有引擎（`DungeonBattleRoom`/`MonsterBattle`）加 flag（`expeditionMode`/`kidMode`/`isGuest`），**不要**另寫一套戰鬥迴圈。
5. **平衡設計交叉檢查**：新數值要過一遍「這個數值還餵給誰」（戰力→配怪、掉寶→經濟、金幣→商店）。雙貨幣/雙系統要看 game-systems.md 的兌換比例設計。
6. **權限走勢**：新 collection 先寫規則（誰讀誰寫），新 member 欄位進 hasOnly 白名單，然後**提醒老闆貼 Console**。
7. **老闆溝通**：玩法/內容的腦力激盪用自由文字討論，不要丟選擇題打斷；技術細節才用選項問。做完給「教學式」總結：改了哪個檔哪一段、為什麼。

---

## 6. 🐛 除錯方法（SOP）

### 固定驗證關卡
```bash
CI=true npx react-scripts build   # 唯一的機器驗證關卡（無測試、無 typecheck）
```
CI=true 會把 ESLint warning 當 error——**每次改完必跑，過了才算完**。

### 症狀 → 第一嫌疑犯對照表

| 症狀 | 先查什麼 |
|------|----------|
| permission-denied | 規則貼進 Console 了嗎？新欄位在 hasOnly 白名單嗎？是不是在幫別人寫入？ |
| 寫入「沒反應」也不報錯 | hasOnly 白名單漏欄位（Firestore 靜默擋）；或 client-triggered 跨帳號寫入 |
| 教練切射手模式白屏 | 循環 import（常數放在 UI 元件裡 re-export） |
| minified 報 `n is not defined` | 源碼某函式外多了孤立字元 |
| 狀態明明設了卻不重渲染 | 用了 `useRef` 該用 `useState`（快照比 `.then()` 早到的 race） |
| 組隊場景資料重複/覆蓋 | 「先查後寫」沒用 transaction |
| 樣式沒生效（focus/placeholder） | Tailwind 是 CDN 版，偽類要寫進 index.css 的純 CSS 類 |
| 加成/數值顯示不對 | 檢查讀的是哪個格式（`calcPotionBuffs` 有 Pct 和 Mult 兩種；`equipped` 是 `{key,source}` 物件不是字串） |

### 除錯思路（依序）
1. **先查 changelog.md 和 quick-ref.md**——這個坑八成踩過，答案已經寫好了。
2. **重現路徑最小化**：確認是哪個身份（admin/member/guest）、哪個入口觸發。
3. **資料流三段檢查**：UI state → db.js 函式 → Firestore 規則。bug 通常在段與段的交界（尤其規則層，因為它「看不見」）。
4. **懷疑併發**：多人功能（組隊/世界王/市集）的怪 bug 先想 race condition。
5. **修完寫 changelog 的「踩坑提醒」**——把 bug 變成上面對照表的新一行，這是除錯流程的最後一步，不是選配。
6. 同一個 bug 修兩次還在 → 停下來寫深度分析（root cause、為什麼前兩次沒修好），不要繼續嘗試性亂改。

---

## 7. ✅ 完工定義（每次改動的收尾 checklist）

1. `CI=true npx react-scripts build` → Compiled successfully
2. 教練「切換射手模式」不白屏（若動了 member 元件）
3. `docs/second_brain/changelog.md` 新增條目（改了什麼＋**為什麼**＋踩坑提醒）
4. 複製同步到 `C:\Users\broud\Documents\Obsidian Vault\catarrow\`
5. 動了規則 → 明確提醒老闆貼 Firebase Console
6. 涉及跨層 contract → 更新/新增 `.trellis/spec/frontend/*.md`（英文 code-spec）
7. git commit（訊息用中文、說明「為什麼」）→ push `main` → Vercel 自動部署

---

## 8. 🗺️ 快速路標（找東西去哪裡）

| 要找 | 位置 |
|------|------|
| 身份分流/路由 | `src/App.jsx`（`?guest=1`/`?kid=<id>` → GuestApp；admin → AdminApp；member → MemberApp） |
| 登入邏輯 | `src/hooks/useAuth.js` |
| 所有 Firestore 函式 | `src/lib/db.js`（+ 各 `xxxDb.js`） |
| 共用常數 | `src/lib/constants.js` |
| 怪物/掉寶/等級數值 | `src/lib/monsterData.js` / `lootTable.js` / `archerLevel.js` |
| UI 原件 | `src/components/shared/UI.jsx` |
| 音效 | `src/lib/sound.js` |
| 安全規則 | `firestore.rules`（改完要手貼 Console） |
| 完整函式/坑速查 | `docs/second_brain/quick-ref.md` |
| 子系統正式 spec | `.trellis/spec/frontend/index.md` 起跳 |
