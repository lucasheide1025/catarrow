# 🤝 交接給 Codex（2026-08-03）

> 前一位負責人（Claude）到此為止。這份是**給接手的 AI 看的**，不是給人看的。
> 先讀完這份，再讀 `ai-guide.md`（方法論）與 `quick-ref.md`（事實速查）。

---

## 1. 現在的狀態

- `main` 乾淨，**1722 個測試全過**，`npm run build` 無警告。
- 前端：push 到 GitHub → Vercel 自動部署。**已上線。**
- Cloud Functions：`ensureWorldBossLifecycle` / `forceSpawnWorldBossFromCycle` /
  `worldBossLifecycleSchedule` / `contributeWorldBossSpawnProgress` **已部署**（asia-east1）。
- Firestore 規則：**CLI 部署會 403，必須手動貼進 Console**。
  目前 `tournaments`（對外賽事排行榜）那段作者說已貼，但沒有實際驗證過寫入成功。

---

## 2. ⚠️ 最重要：`npm run build` 不會擋 `no-undef`

`react-scripts build` 印「Compiled successfully」**不代表沒有未定義的引用**。
這個專案在 2026-08 那一輪就因此白屏了**五次**（漏 import、刪碼刪掉還在用的變數）。

**改完 JS/JSX 一定要另外跑**（專案沒有 `.eslintrc`，直接 `npx eslint` 會中止）：

```bash
npx eslint --no-eslintrc \
  --parser-options=ecmaVersion:2022,sourceType:module,ecmaFeatures:{jsx:true} \
  --env browser,es2022 --rule '{"no-undef":"error"}' <改過的檔案>
```

---

## 3. ⚠️ 會「靜靜做錯事」的陷阱（不報錯、測試也不一定抓得到）

這一節是這份文件存在的主要理由。每一條都真的發生過。

| 陷阱 | 症狀 |
|---|---|
| **Firestore 會跳過缺少 `orderBy` 欄位的文件** | 資料像是「不見了」，完全沒有錯誤訊息 |
| **日期當文件 id**（`raidMatches/{YYYY-MM-DD}`） | 跨午夜就指向一份不存在的文件，看起來像成績全沒了 |
| **`practiceLogs.arrowCount` 是「每組幾箭」不是總箭數** | 3箭×20組被算成 3 箭。一律用 `practiceLogArrowCount` |
| **通用材料寶箱忽略 `chest.family`** | `wood/iron/gold/epic/mythic` 固定開六族且排除寶箱族。要指定族請用 `family_mat` |
| **族別有兩組清單** | 六族 `FAMILY_KEYS`/`ALL_DUNGEON_FAMILIES`（地下城，排除寶箱族）vs **七族** `ALL_FAMILIES`/`FAMILIES`（素材與寶箱） |
| **咪咪箱 `mimi_box` 😺 ≠ 貓貓箱 `cat_box` 🎐** | 前者開出貓咪夥伴，後者掉章碎片 |
| **客戶端寫入會壓過雲端** | 世界王重生曾有兩套並存，客戶端搶先寫死值 → 後台設定從來沒生效過 |
| **手抄常數表** | `FACE_LABEL` 曾漏掉複合弓與室內靶紙。一律從來源模組生成 |
| **加成放在 `Math.min` 裡面** | 老手頂到天花板後，再多的加成都沒有感覺 |
| **加成沒有畫面呈現** | 加再多也等於沒有，玩家不會因此去追求它 |

---

## 4. ⚠️ 不要用「改數字」來讓測試通過

以下測試檔**編碼的是作者的設計理念**，不是實作細節。它們紅了代表你破壞了理念，
不是測試該改：

- `worldBossRewards.test.js` — 「上場幫忙都有不錯的獎勵，努力的更好」
  （√壓縮、鍋子隨人數變大、名次是榮譽不是收入）
- `villageGoalRewards.test.js` — 同一套理念套用在村目標
- `villageGoalTargets.test.js` — 目標值曲線上限，含「換算成每天要射幾箭」
- `raidBalance.test.js` — 戰鬥模型必須**中性**，補償走外層 `raidRookie.js`
- `monsterStatus` 相關 — 異常要 9 環以上才觸發（射得準換戰術優勢，不是抽獎）
- `archerHonorBonus.test.js` — **三種章與射手證不設上限**，而且必須加在
  `Math.min` **之外**。作者原話：「我就是煞車，而且這遊戲會繼續更新往上攀升」。
  ⚠️ 看到「無上限」的第一反應會想加回上限——**那會讓老手再拿章完全沒感覺**，
  正是 2026-08-04 修掉的問題。難度排序（肥貓章最難／成就章最好拿）也是作者定的，
  **不要從點數權重去推**。

**要改平衡，先跟作者確認，然後同時改數字與測試裡的理由註解。**

---

## 5. 貨幣／獎勵改哪裡（改錯地方會完全沒效果）

- 世界王貨幣 → **只能改 `src/lib/worldBossRewards.js`**。
  `REWARD_TABLE`、`RANK_BONUS` 已停用，`DROP_TABLE_BY_CATEGORY` 只剩物品。
- 村目標貨幣 → `src/lib/villageGoalRewards.js`。
- 世界王重生 → 權威在 `functions/worldBossLifecycle.js`。
  **客戶端 `worldBossSpawnCycle.js` 是唯讀顯示層，不要在那裡寫生成邏輯。**
  兩邊預設值靠測試直接讀 functions 原始碼比對釘住。

---

## 6. 已知未完成（沒有假裝做完）

1. **世界王「組隊」線上同步**：從沒兩台裝置實跑過。
2. **組隊／地下城的權威端異常狀態**：只有單元測試，Firestore 讀寫層沒開過真房間。
3. **練習模式參數研究**：作者 2026-07-31 提過。只修了分析端讀錯欄位，參數本身沒動。
4. **比賽獎勵設定偏寬鬆**（15XP/箭、50金幣/分、每1箭1箱、上限999），作者尚未決定是否調整。
5. **教練的測試資料**還在比賽排行榜上（42分/5箭），可用 `resetMatchMember` 清掉。

---

## 7. 協作規則（作者明確要求，請遵守）

- **用繁體中文回答**，以教學為優先，作者是初學者。
- **官網 `website/` 是 Codex 的地盤**，另一邊不要動。
- **禁止 `git add -A`** —— 這個 repo 常有多個 agent 同時在同一個 working tree。
  只加自己明確改過的檔案。
- **完工後要更新 `docs/second_brain/`**，並同步到
  `C:\Users\broud\Documents\Obsidian Vault\catarrow\`。
- 記「**為什麼這樣改**」與「**踩過的坑**」，不要只記「改了什麼」。
