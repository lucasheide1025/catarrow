# 第二大腦落差稽核 — AGY 執行指令書

> 出題與驗收：Claude（Opus）。執行：AGY。
> 這一輪的唯一任務是**產出落差報告**，不是修筆記。

---

## 0. 背景與目的

專案 `catarrow` 有一套「第二大腦」筆記（`docs/second_brain/`），設計上要求所有 AI 開工前先讀筆記、少 grep。
**問題：筆記已與現在的程式碼嚴重脫節**，內容不知道漏了多少、錯了多少。

你的任務：**以現在的 `src/` 程式碼為唯一事實**，反向稽核筆記，產出一份「落差地圖」，讓人類與後續 AI 一眼看出每一塊「還準 / 過時 / 沒記」。

---

## 0.5 給執行模型的特別提醒（Gemini Flash 專用防呆）

你的速度快是優點，但這個任務**寧可慢也不能編**。三件事務必做到：

1. **禁止憑印象**。每一條落差引用的 `file:line`，你**必須真的把那個檔案打開讀過**該行。作為證明，報告裡除了行號，還要**原文摘錄那一行的實際內容**（貼出來，不要改寫）。無法貼出原文的判斷 = 你沒讀 = 不准寫。
2. **不確定就標 `❓`，不要猜**。你傾向於填一個看起來合理的答案——這裡不要。只要不能從 code 直接確認，一律標 `❓需人工確認` 並寫明原因。寧可 ❓ 多，也不要 ⚠️/✅ 亂下。
3. **機械式全掃，不要抽樣**。`db.js` 的每一個 collection、每一個 export 函式都要逐一比對；`src/lib/` 每一個檔都要打開。不准「看起來差不多就跳過」。

---

## 1. 鐵則（違反即作廢，必讀）

1. **事實來源 = code**。禁止把舊筆記的敘述當事實。凡是筆記寫的，都要回 `src/` 驗證後才能判定。
2. **這一輪只稽核、不改筆記**。**禁止修改** `docs/second_brain/` 底下任何既有 `.md` 正文（quick-ref / features / game-systems / changelog / ai-guide）。你只能新增 `docs/second_brain/_audit/` 底下的報告檔。
3. **每一條落差都要附證據**：用 `相對路徑:行號` 指出程式碼位置（例如 `src/lib/db.js:214`）。沒有證據的判斷不准寫。
4. **禁止 `git add`／`git commit`／`git push`／任何 git 寫入操作**。你只負責產出檔案，交由人類與 Claude 處理版本控制。（本專案有平行 agent，亂 add 會出事。）
5. **不要改任何 `src/` 的程式碼**。你是來讀的，不是來修的。
6. 遇到判斷不了、模稜兩可的，標記為 `❓需人工確認`，不要自己腦補結論。

---

## 2. 稽核範圍

### 2.1 要讀的「事實」（code / 資料層）
逐一實際打開、不要只看檔名猜：

- `src/App.jsx`（路由與身份分流）
- `src/pages/AdminApp.jsx`、`src/pages/MemberApp.jsx`（頁面容器、分頁）
- `src/hooks/useAuth.js`（身份設計：`profile.id` vs `profile.uid`）
- `src/lib/db.js`（**重點**：頂部 `C` 常數的 collection 名稱、所有 export 的讀寫函式）
- `src/lib/constants.js`（共用常數/工具函式）
- `src/lib/` 底下**所有 `.js`/`.jsx`**（逐檔列出 export 的主要函式/資料表），至少含：
  `archerLevel.js` `monsterData.js` `monsterCards.js` `monsterBattle.jsx`
  `monsterMaterials.js` `itemData.js` `lootTable.js` `buffPool.js`
  `achievementDex.js` `arrowMilestone.js` `randomEvents.js` `sound.js` `cohort.js`
  —— **並且自己列出上面清單沒提到、但實際存在的新檔案**（這很重要，漏記的新系統通常在這裡）
- `src/features/` 底下的實際結構（例如 `catalog/context/CatalogContext.jsx` 等，逐一列出有哪些 feature 模組）

> 提示：先跑一次目錄盤點，把 `src/` 底下實際的檔案樹列出來，作為「現況母體」。

### 2.2 要被稽核的「筆記」（doc）
- `docs/second_brain/quick-ref.md`
- `docs/second_brain/features.md`
- `docs/second_brain/game-systems.md`
- `docs/second_brain/changelog.md`
- `docs/second_brain/ai-guide.md`（只檢查其中「事實性」敘述，如路徑/檔名；方法論段落不列入落差）

---

## 3. 稽核方法（逐份筆記做）

對每一份筆記，逐段比對，把每個「可驗證的事實聲明」分類：

| 標記 | 意義 |
|------|------|
| ✅ 準確 | 筆記所述與 code 一致 |
| ⚠️ 過時 | 筆記有寫，但與現在 code 不符（名稱/路徑/流程/數值變了） |
| ❌ 缺漏 | code 裡存在的系統/函式/collection，但筆記完全沒提 |
| 🗑️ 已死 | 筆記寫的東西 code 裡已不存在（檔案/函式/欄位被刪） |
| ❓需人工確認 | 無法只靠 code 判定（例如涉及 Firestore 實際資料、外部部署狀態） |

**重點稽核項（務必涵蓋）**：
1. `db.js` 的 **collection 清單**（`C` 物件）與 **export 函式清單** vs `quick-ref.md` 的速查表 —— 一條一條對。
2. `src/lib/` 的**實際檔案清單** vs `game-systems.md` 的系統表 —— 找出「有檔案沒記」與「有記檔案已不在」。
3. 路由（`App.jsx`）與底部導覽（`MemberApp.jsx` 分頁）vs `features.md` 的功能清單。
4. `constants.js` 的關鍵常數（`BOW_TYPES`/`CERT_LEVELS`/`BADGE_WEIGHTS` 等）名稱與內容 vs `quick-ref.md`。
5. `src/features/` 是否為筆記完全沒提到的新架構層。

---

## 4. 產出物（唯一允許寫入的地方）

在 `docs/second_brain/_audit/` 底下產出：

### 4.1 `gap-map.md` — 落差總表（主要交付）
格式範例：

```markdown
# 第二大腦落差地圖（產出日期：YYYY-MM-DD，by AGY）

## 摘要
- 稽核筆記 X 份、程式檔 Y 個
- ✅ 準確 N 條 / ⚠️ 過時 N 條 / ❌ 缺漏 N 條 / 🗑️ 已死 N 條 / ❓待確認 N 條
- 一句話結論：建議「小修 / 整份重寫 / 只補缺漏」哪一種

## quick-ref.md
| 標記 | 筆記聲明 | 證據 file:line | **原文摘錄（貼實際那行）** | 說明 |
|------|----------|----------------|---------------------------|------|
| ⚠️ | getFoo() 在 db.js | src/lib/db.js:120 | `export async function getFooBar(id) {` | 函式已改名 getFooBar |
| ❌ | （無） | src/lib/villageBoard.js:1 | `// 貓貓村大富翁地圖系統` | 全新系統，筆記完全沒記 |
...

## features.md
...（同上格式）

## game-systems.md
...

## changelog.md
...

## ai-guide.md（僅事實性敘述）
...

## 🔴 高風險落差（會誤導 AI 動手的，獨立列在最前面給人看）
- ...
```

### 4.2 `src-inventory.md` — 現況母體清單（佐證用）
- `src/` 實際檔案樹
- `db.js` 的完整 collection 清單 + 函式清單（附行號）
- `src/lib/` 每檔的主要 export

> 這份是你判斷的依據，讓 Claude 驗收時能抽查，不用重掃。

---

## 5. 完工檢查（交回前自己核對）

- [ ] 沒有動過 `docs/second_brain/` 既有正文，也沒動 `src/`
- [ ] 每條 ⚠️/❌/🗑️ 都有 `file:line` 證據
- [ ] `gap-map.md` 最前面有「🔴 高風險落差」與「一句話結論」
- [ ] 沒有執行任何 git 指令
- [ ] `❓` 項目有清楚寫出「為什麼 code 判斷不了」

完成後回報：兩份檔案路徑 + 摘要數字，交給 Claude 驗收。
