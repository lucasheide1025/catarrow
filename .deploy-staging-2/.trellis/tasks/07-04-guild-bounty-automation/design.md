# 設計文件 — 公會一般懸賞任務自動化

## `src/lib/adventurerSystem.js` 新增內容

```js
export const GENERAL_BOUNTY_TIER_DEFAULTS = [
  { tier: 1, label: "簡單", killMin: 8,  killMax: 15, xp: 60,  coins: 100, arrowDew: 15, gachaCoins: 1, chestType: "wood",  count: 2 },
  { tier: 2, label: "普通", killMin: 5,  killMax: 10, xp: 120, coins: 200, arrowDew: 30, gachaCoins: 2, chestType: "iron",  count: 2 },
  { tier: 3, label: "困難", killMin: 3,  killMax: 6,  xp: 220, coins: 350, arrowDew: 60, gachaCoins: 3, chestType: "gold",  count: 2 },
  { tier: 4, label: "極限", killMin: 1,  killMax: 3,  xp: 400, coins: 600, arrowDew: 100,gachaCoins: 5, chestType: "epic",  count: 1 },
];

export function getDailyPeriodKey() {
  const d = new Date();
  return `d_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
}

// tierConfig: 4 階陣列，教練後台覆寫值（缺項 fallback 用 GENERAL_BOUNTY_TIER_DEFAULTS 對應階）
export function generateDailyGeneralBounties(periodKey, monsters, tierConfig = GENERAL_BOUNTY_TIER_DEFAULTS) {
  const seed = parseInt(periodKey.replace(/\D/g, ""), 10);
  const rand = makeSeedRand(seed);
  const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const quests = [];
  for (const cfg of tierConfig) {
    // 一般懸賞不綁定怪物族系/tier 高低，四階都從全部怪物池隨機抽（跟雙週懸賞的「依 monster.tier 篩池」不同，
    // 因為一般懸賞的「難度」只反映擊殺數與獎勵倍率，不是怪物本身的強度分類）
    for (let i = 0; i < cfg.count; i++) {
      const monster = monsters[Math.floor(rand() * monsters.length)];
      const killCount = ri(cfg.killMin, cfg.killMax);
      quests.push({
        title: `${monster.icon} ${monster.name} 一般懸賞`,
        desc: `擊殺 ${monster.name} ${killCount} 隻，完成公會日常懸賞。`,
        type: "normal",
        questSubtype: "general",
        requirement: { monsterId: monster.id, killCount },
        reward: { xp: cfg.xp, coins: cfg.coins, arrowDew: cfg.arrowDew, gachaCoins: cfg.gachaCoins },
        bonusChest: cfg.chestType,   // 固定附贈，非機率（跟既有 bonus 機率欄位區分，新欄位名）
        periodTag: periodKey,
        difficultyTier: cfg.tier,
        badgeReward: null,
        deadline: null,
        status: "active",
      });
    }
  }
  return quests;
}
```

- `bonusChest` 是新欄位（固定附贈，跟 `generateBiWeeklyBounties` 的機率式 `bonus` 欄位刻意分開命名，避免混淆兩套不同的獎勵機制）。
- 任務要求型態沿用既有 `type:"normal"` + `questSubtype:"general"` + `requirement:{monsterId,killCount}`，跟 `kill_monster` 的資料形狀完全相同——**只是分類標籤不同（`general` vs `kill_monster`）**，這樣才能沿用既有的驗收判斷（若驗收邏輯是依 `requirement.monsterId/killCount` 判斷，不特別依賴 `questSubtype` 字串本身，則兩者天然相容；需在 implement 階段確認 `acceptGuildQuest`/`submitGuildQuestCompletion` 呼叫端沒有針對 `questSubtype==="kill_monster"` 寫死判斷，若有則需放寬成同時接受 `"general"`）。

## `src/lib/db.js` 新增

```js
// 每日一般懸賞自動發佈（比照 autoPublishBountyQuests 的雙週版本，改用每日 period key）
export async function autoPublishDailyGeneralBounties(monsters, tierConfig) {
  try {
    const { getDailyPeriodKey, generateDailyGeneralBounties } = await import("./adventurerSystem");
    const periodKey = getDailyPeriodKey();
    const metaRef  = doc(db, "guildMeta", "dailyGeneralBounty");
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data().periodKey === periodKey) {
      return { ok: true, reason: "already_exists" };
    }
    const bounties = generateDailyGeneralBounties(periodKey, monsters, tierConfig);
    for (const b of bounties) {
      await publishGuildQuest(b, "system").catch(() => {});
    }
    await setDoc(metaRef, { periodKey, generatedAt: serverTimestamp() });
    return { ok: true, count: bounties.length };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// 教練後台：一般懸賞難度設定（比照 PROMO_QUEST_DEFAULTS 模式）
export async function getGeneralBountyTierConfig() {
  try {
    const snap = await getDoc(doc(db, "guildConfig", "generalBountyTiers"));
    if (snap.exists()) return snap.data().tiers || GENERAL_BOUNTY_TIER_DEFAULTS;
  } catch (e) {}
  return GENERAL_BOUNTY_TIER_DEFAULTS;
}
export function subscribeGeneralBountyTierConfig(cb) {
  return onSnapshot(doc(db, "guildConfig", "generalBountyTiers"),
    snap => cb(snap.exists() ? (snap.data().tiers || GENERAL_BOUNTY_TIER_DEFAULTS) : GENERAL_BOUNTY_TIER_DEFAULTS),
    () => cb(GENERAL_BOUNTY_TIER_DEFAULTS)
  );
}
export async function saveGeneralBountyTierConfig(tiers, adminId) {
  await setDoc(doc(db, "guildConfig", "generalBountyTiers"), { tiers, updatedAt: serverTimestamp(), updatedBy: adminId }, { merge: true });
}
```

**「附贈固定寶箱」的實際發放**：`submitGuildQuestCompletion`（既有函式）目前只處理 xp/coins/arrowDew/gachaCoins，需要新增一段：若 `quest.bonusChest` 存在，呼叫既有 `addChests(memberId, [makeChest(quest.bonusChest, "一般懸賞獎勵")])`（沿用 `MonsterBattle.jsx` 已在用的 `makeChests`/`addChests` 模式，非新機制）。

## `AdventurerGuild.jsx`（前台）

進場 `useEffect` 內，`autoPublishBountyQuests(monsters)` 旁邊加一行：
```js
autoPublishDailyGeneralBounties(monsters, generalBountyTierConfig).catch(() => {});
```
`generalBountyTierConfig` 來源：`subscribeGeneralBountyTierConfig`（即時訂閱，教練調整後隔天新批次生效，當天已發佈的任務不回溯修改）。

## `AdminGuildQuests.jsx`（後台）

新增「一般懸賞設定」卡片，複製「晉階任務設定」（`promoForm`/`promoConfig` 那組 state 與 UI）的模式：4 列（難度1~4），每列可編輯 killMin/killMax/xp/coins/arrowDew/gachaCoins/chestType，儲存呼叫 `saveGeneralBountyTierConfig`。

## 相容性

- 不改動 `getDailyGuildTasks`、`generateBiWeeklyBounties`、`BOUNTY_TIER_CONFIG`、`autoPublishBountyQuests` 既有函式簽名——新函式全部另外命名，雙週懸賞邏輯原封不動。
- `guildQuests` collection 既有文件結構不變，只是新增 `bonusChest`/`difficultyTier` 兩個新欄位（其他任務類型的舊文件沒有這兩欄，讀取端需用 `quest.bonusChest &&` 判斷式保護，不可假設一定存在）。
