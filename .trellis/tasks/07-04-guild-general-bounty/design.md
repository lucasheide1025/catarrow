# 設計文件 — 冒險者公會一般懸賞任務自動化

## 資料模型

### 新 collection：`guildBountyTemplates`（教練管理的任務範本池）

```js
// guildBountyTemplates/{templateId}
{
  title: "森林異變討伐令",        // 任務標題
  desc: "擊殺 {monster} {count} 隻，協助公會清剿威脅。", // 說明（{monster}/{count} 為顯示用佔位符，實際判定看 requirement）
  difficulty: 1,                  // 1~4，全新獨立難度（不對應現有 6 階/3 階）
  requirement: {
    type: "kill_monster",         // 先只做這型
    monsterId: "goblin",          // 指定怪物 id（對應 monsterData.js 的 MONSTERS）
    killCount: 5,                 // 需擊殺數
  },
  active: true,                   // 教練可停用範本（停用後不會被抽到，但不影響已上架的任務）
  createdAt, updatedAt, createdBy,
}
```

### 新 collection：`guildBountyRewards`（教練可調整的難度獎勵表，單一文件）

```js
// guildBountyRewards/config
{
  1: { xp: 60,  coins: 100, arrowDew: 20, gachaCoins: 1, chestType: "wood" },
  2: { xp: 150, coins: 250, arrowDew: 50, gachaCoins: 2, chestType: "iron" },
  3: { xp: 300, coins: 450, arrowDew: 90, gachaCoins: 3, chestType: "gold" },
  4: { xp: 500, coins: 700, arrowDew: 150,gachaCoins: 5, chestType: "epic" },
  updatedAt, updatedBy,
}
```

- `chestType` 直接對應既有 `CHEST_TYPES`（`src/lib/itemData.js`）：`wood`/`iron`/`gold`/`epic`，剛好 4 種對應 4 個難度，不需要新增寶箱類型。
- 文件不存在時，程式碼內建 `DEFAULT_BOUNTY_REWARDS` 常數作為 fallback（同上數值），確保上線當下即使教練還沒進後台設定也能正常運作。

### 既有 `guildQuests`（`C_GUILD_Q`）沿用，新增一個標記欄位

發佈出來的每日一般懸賞任務，寫入既有 `guildQuests` collection（跟雙週懸賞、教練手動發佈的任務共用同一個 collection），並加一個 `bountySource: "daily_general"` 欄位（跟雙週懸賞的 `periodTag`/手動發佈區分開，方便查詢/下架時篩選）：

```js
{
  title, desc, type: "normal", questSubtype: "kill_monster", // ⚠️ 見下方修正說明，不是 "general"
  requirement: { type:"kill_monster", monsterId, killCount },
  reward: { xp, coins, arrowDew, gachaCoins },   // 從 guildBountyRewards 依 difficulty 套用
  bountyDifficulty: 1,          // 1~4，供 UI 顯示難度徽章
  bountySource: "daily_general",// 用來篩選/批次下架/區分「一般懸賞」跟雙週懸賞
  bountyDateKey: "2026-07-04",  // 當天 seed key，防重複發佈用
  badgeReward: null, prerequisiteQuestId: null, deadline: null,
  status: "active",
}
```

**⚠️ 實作階段修正（design 原稿有誤，已由 trellis-implement 發現並修正）**：原本這裡寫 `questSubtype:"general"`，但 `AdventurerGuild.jsx` 第425行的驗收判斷是 `killPassed = sub==="kill_monster" ? (擊殺數比對) : true`——也就是說任何 `questSubtype !== "kill_monster"` 的任務會**完全跳過擊殺驗證**，玩家不用真的打怪就能送出領獎。所以一定要用 `questSubtype:"kill_monster"`（跟雙週懸賞共用同一套驗證邏輯），改用 `bountySource:"daily_general"` + `bountyDifficulty` 這兩個新欄位來區分「這是一般懸賞」而非雙週懸賞，而不是靠 `questSubtype` 區分。

### 寶箱獎勵發放

`submitGuildQuestCompletion`（`db.js`）目前只發放 xp/coins/arrowDew/gachaCoins，直接發放不經審核。本次擴充：若 `quest.bountyDifficulty` 存在，額外呼叫既有 `addChests(memberId, [chest])`，`chest` 物件比照既有 schema（`{id, type, family:"guild", tier:difficulty, from:"公會懸賞", ts}`），`type` 從 `guildBountyRewards[difficulty].chestType` 取得。

## 每日刷新邏輯（沿用 `autoPublishBountyQuests` 的 client-triggered 模式）

新函式 `autoPublishDailyGeneralBounties()`（`db.js`，仿照既有 `autoPublishBountyQuests`）：

```js
export async function autoPublishDailyGeneralBounties() {
  try {
    const dateKey = todayStr(); // "YYYY-MM-DD"
    const metaRef = doc(db, "guildMeta", "dailyGeneralBounty");
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().dateKey === dateKey) {
      return { ok: true, reason: "already_exists" };
    }
    // 1. 下架昨天的舊任務（bountySource==="daily_general" 且 status==="active"）
    const oldSnap = await getDocs(query(collection(db, C_GUILD_Q),
      where("bountySource", "==", "daily_general"), where("status", "==", "active")));
    await Promise.all(oldSnap.docs.map(d => updateDoc(d.ref, { status: "expired" })));

    // 2. 讀範本池 + 獎勵表
    const templatesSnap = await getDocs(query(collection(db, "guildBountyTemplates"), where("active", "==", true)));
    const templates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const rewardsSnap = await getDoc(doc(db, "guildBountyRewards", "config"));
    const rewards = rewardsSnap.exists() ? rewardsSnap.data() : DEFAULT_BOUNTY_REWARDS;

    // 3. 用日期當 seed，每個難度固定抽 1 個範本（比照 getDailyGuildTasks 的 makeSeedRand 模式）
    const seed = parseInt(dateKey.replace(/-/g, ""), 10);
    const rand = makeSeedRand(seed); // 從 adventurerSystem.js 匯入既有的 seed 亂數函式
    const picks = [1, 2, 3, 4].map(diff => {
      const pool = templates.filter(t => t.difficulty === diff);
      if (!pool.length) return null; // 範本池空的該難度直接跳過，不強求湊滿4個
      return pool[Math.floor(rand() * pool.length)]; // 允許重複抽同一個範本（池只有1個時每天都抽到它）
    }).filter(Boolean);

    // 4. 依範本+獎勵表組成 guildQuests 文件並發佈
    for (const tpl of picks) {
      const r = rewards[tpl.difficulty] || DEFAULT_BOUNTY_REWARDS[tpl.difficulty];
      await publishGuildQuest({
        title: tpl.title, desc: tpl.desc, type: "normal", questSubtype: "general",
        requirement: tpl.requirement,
        reward: { xp: r.xp, coins: r.coins, arrowDew: r.arrowDew, gachaCoins: r.gachaCoins },
        bountyDifficulty: tpl.difficulty, bountySource: "daily_general", bountyDateKey: dateKey,
      }, "system").catch(() => {});
    }
    await setDoc(metaRef, { dateKey, generatedAt: serverTimestamp() });
    return { ok: true, count: picks.length };
  } catch (e) { return { ok: false, reason: e.message }; }
}
```

呼叫時機：比照既有 `autoPublishBountyQuests` 的呼叫慣例，在 `AdventurerGuild.jsx` 元件掛載時呼叫一次（前台進公會頁觸發，非 cron）。

## 教練後台 UI

### 新分頁：`AdminGuildBountyTemplates.jsx`（掛在既有 `AdminGuildQuests.jsx` 內新增一個 tab，例如 `tab==="bounty"`）

- 範本清單（分 4 個難度分組顯示）：新增/編輯/停用範本（title/desc/monsterId/killCount）
- 難度獎勵表編輯區：4 個難度各一組輸入框（xp/coins/arrowDew/gachaCoins + chestType 下拉選 wood/iron/gold/epic），儲存呼叫 `setGuildBountyRewards(rewardsObj, operatorId)`
- 「立即重新產生今日任務」按鈕（呼叫 `autoPublishDailyGeneralBounties()`，供教練測試/緊急重刷用，注意會員端也有相同防重複 `dateKey` 機制，不會重複扣人頭）

### 會員端顯示

既有 `AdventurerGuild.jsx` 的任務清單渲染邏輯不用大改（`questSubtype==="general"` 本來就有 label），只需要在卡片上加顯示 `bountyDifficulty`（例如「難度 ★☆☆☆」之類的徽章），讓玩家分辨這是新的每日一般懸賞。

## Firestore 規則

新增兩個 collection 都是教練限定寫入、登入者可讀：

```
match /guildBountyTemplates/{id} {
  allow read: if isLoggedIn();
  allow write: if isAdmin();
}
match /guildBountyRewards/{id} {
  allow read: if isLoggedIn();
  allow write: if isAdmin();
}
```

`guildQuests`/`guildMeta` 已有既有規則涵蓋（沿用雙週懸賞的寫入模式），不需新增規則。

## Out of Scope（沿用 PRD）

- 不動 `getDailyGuildTasks`（克蘇魯/人質/殭屍每日靶紙任務）
- 不動 `generateBiWeeklyBounties`（雙週怪物討伐懸賞）
- 不做 `kill_monster` 以外的任務類型
- 不做寶箱機率骰/保底掉落，直接固定對應難度→寶箱類型
