# Design

## 1. `monsterData.js` — 新增 8 隻怪物（6真 + 2王），假的沿用既有 6 隻

現有 `treasure_1~6`（259-294行）不改數值，視為「假」。新增：

```js
// ════ 寶箱族·真（不會反擊）════
{ id:"treasure_1_real", family:"treasure", tier:"common", name:"安分寶箱怪", icon:"📦",
  hp:80,  atk:1, def:70,  desc:"貨真價實的寶箱，完全不會反擊，輕鬆打開。" },
{ id:"treasure_2_real", family:"treasure", tier:"rare", name:"安分黃金寶箱怪", icon:"📦",
  hp:140, atk:1, def:110, desc:"..." },
{ id:"treasure_3_real", family:"treasure", tier:"elite", name:"安分鑽石寶箱怪", icon:"💎",
  hp:220, atk:1, def:160, desc:"..." },
{ id:"treasure_4_real", family:"treasure", tier:"fierce", name:"安分秘銀寶箱怪", icon:"📦",
  hp:340, atk:1, def:220, desc:"..." },
{ id:"treasure_5_real", family:"treasure", tier:"boss", name:"安分遠古寶箱怪", icon:"🗡️",
  hp:500, atk:1, def:300, desc:"..." },
{ id:"treasure_6_real", family:"treasure", tier:"mythic", name:"安分神話寶箱巨像", icon:"👑",
  hp:800, atk:1, def:400, desc:"..." },
```

（實際 desc 文案實作時直接寫，不逐字先跟使用者對；ATK=1 而非 0，避免任何除以 0 或「必定 0 傷害」的特判邏輯意外分支——傷害公式本來就會算出接近 0 的結果，不需要真的是 0。）

```js
// ════ 寶箱族·王（隱藏地下城王房專屬，不進入一般抽池）════
{ id:"treasure_king_small", family:"treasure", tier:"boss", isKing:true, name:"寶箱小王", icon:"👑",
  hp:900,  atk:20, def:200, desc:"低階隱藏地下城的守護者，擊敗後獲得大量獎勵。" },
{ id:"treasure_king_big",   family:"treasure", tier:"mythic", isKing:true, name:"寶箱大王", icon:"👑",
  hp:1800, atk:35, def:350, desc:"高階隱藏地下城的終極守護者，擊敗後獲得海量獎勵與符文。" },
```

`isKing:true` 是唯一新欄位，用來把王排除在一般寶箱怪抽池外。

## 2. `monsterData.js` — 抽怪函式

```js
export function drawTreasureMonsterPool(count, tier) {
  const tierKey = TIER_ORDER[Math.max(0, Math.min(5, (tier || 1) - 1))];
  const candidates = MONSTERS.filter(m => m.family === "treasure" && m.tier === tierKey && !m.isKing);
  const picks = [];
  for (let i = 0; i < count; i++) {
    const m = candidates[Math.floor(Math.random() * candidates.length)];
    if (m) picks.push(applyVariant(m, "normal"));
  }
  return picks;
}

export function drawTreasureKing(difficultyTier) {
  const king = (difficultyTier || 1) <= 3
    ? MONSTERS.find(m => m.id === "treasure_king_small")
    : MONSTERS.find(m => m.id === "treasure_king_big");
  return applyVariant(king, "boss");
}
```

`drawMixedMonsterPool`（既有函式，537-557行）尾端加低機率彩蛋：

```js
export function drawMixedMonsterPool(count, variant, tier) {
  const tierKey = TIER_ORDER[Math.max(0, Math.min(5, (tier || 1) - 1))];
  const shuffled = [...FAMILY_KEYS].sort(() => Math.random() - 0.5);
  const selectedFamilies = shuffled.slice(0, Math.min(count, 6));

  return selectedFamilies.map(family => {
    let monster;
    if (Math.random() < 0.05) {
      const treasurePool = MONSTERS.filter(m => m.family === "treasure" && m.tier === tierKey && !m.isKing);
      monster = treasurePool[Math.floor(Math.random() * treasurePool.length)];
    }
    if (!monster) {
      // 既有邏輯：candidates/fallback 選怪（原樣保留）
      ...
    }
    if (!monster) return null;
    return applyVariant(monster, variant);
  }).filter(Boolean);
}
```

`drawFloorMonsters`（576-604行）樓層 1、2 補上 family 判斷：

```js
export function drawFloorMonsters(floorIndex, difficultyTier, options = {}) {
  const isTreasureRun = options.family === "treasure";
  if (floorIndex === 0) {
    const count = 2 + Math.floor(Math.random() * 2);
    return {
      monsters: isTreasureRun
        ? drawTreasureMonsterPool(count, difficultyTier)
        : drawMixedMonsterPool(count, "weak", difficultyTier),
      elite: null, boss: null,
    };
  }
  if (floorIndex === 1) {
    const count = 3 + Math.floor(Math.random() * 2);
    const elite = isTreasureRun
      ? drawTreasureMonsterPool(1, difficultyTier)[0]
      : drawMixedMonsterPool(1, "strong", difficultyTier)[0];
    return {
      monsters: isTreasureRun
        ? drawTreasureMonsterPool(count, difficultyTier)
        : drawMixedMonsterPool(count, "normal", difficultyTier),
      elite: elite || null, boss: null,
    };
  }
  // 第3層：王房用 drawTreasureKing（isTreasureRun 時）取代 drawExpeditionBoss
  const elite = isTreasureRun
    ? drawTreasureMonsterPool(1, difficultyTier)[0]
    : drawMixedMonsterPool(1, "strong", difficultyTier)[0];
  const fixedBoss = options.fixedBoss
    ? (options.fixedBoss.variant === "boss" ? { ...options.fixedBoss } : applyVariant(options.fixedBoss, "boss"))
    : (isTreasureRun ? drawTreasureKing(difficultyTier) : drawExpeditionBoss(difficultyTier, options.family));
  return {
    monsters: isTreasureRun ? drawTreasureMonsterPool(3, difficultyTier) : drawMixedMonsterPool(3, "strong", difficultyTier),
    elite: elite || null, boss: fixedBoss,
  };
}
```

（樓層 1、2 的 `weak`/`normal`/`strong` 強度標籤對寶箱族刻意不套用——寶箱族的難度曲線靠「真/假比例隨機」跟 tier 本身表達，不疊加強弱變體，維持 `drawTreasureMonsterPool` 內部固定用 `"normal"`。）

## 3. `dungeonExcavation.js::revealExcavation`

```js
const isHidden = Math.random() < 0.05;
const family = isHidden ? "treasure" : FAMILIES[Math.floor(Math.random() * FAMILIES.length)];
const boss = isHidden
  ? (await import("./monsterData")).drawTreasureKing(difficulty)
  : drawExpeditionBoss(difficulty, family);
```

（`drawTreasureKing` 用動態 import 或直接加進本檔頂部既有的 `import { drawExpeditionBoss } from "./monsterData"` 那行，改成一併 import `drawTreasureKing`，不需要動態 import，寫的時候直接用靜態 import 即可，上面動態 import 只是示意。）

## 4. `expeditionDb.js::calculateExpeditionRewards`

```js
const TREASURE_REWARD_MULT = { coins: 3, arrowDew: 3, archerXP: 1.3 };

export function calculateExpeditionRewards({ difficultyTier, floorsCleared, won, family }) {
  const tier = Math.max(1, Math.min(6, difficultyTier || 1));
  const table = EXPEDITION_REWARD_TABLE[tier];
  const floorMult = won ? 1.0 : Math.max(0.1, floorsCleared / 3);
  const isTreasure = family === "treasure";
  const bonusMult = isTreasure ? TREASURE_REWARD_MULT : { coins:1, arrowDew:1, archerXP:1 };

  const coinsBase = table.coinBase + Math.floor(Math.random() * table.coinRange);
  const coins = Math.round(coinsBase * floorMult * bonusMult.coins);

  const dewBase = table.dewBase + Math.floor(Math.random() * table.dewBase);
  const arrowDew = Math.max(1, Math.round(dewBase * floorMult * bonusMult.arrowDew));

  const xpBase = table.xpBase + Math.floor(Math.random() * table.xpRange);
  const archerXP = Math.round(xpBase * floorMult * bonusMult.archerXP);

  return { coins, arrowDew, archerXP, won, difficultyLabel: table.label, floorsCleared, totalFloors: 3,
    breakdown: { coinBase: coinsBase, floorMult, dewBase, xpBase, isTreasure } };
}
```

呼叫端（`DungeonExpedition.jsx` `resultRewards` 計算處、`TeamExpeditionBattle.jsx::publishResult`）補上 `family: dungeonFamily`/`family` 參數。

材料保底稀有以上：`saveExpeditionRecord`/`grantExpeditionRewards` 目前不處理材料（遠征系統的材料掉落走 `handleTreasureLoot`/寶藏房機制，跟 `calculateExpeditionRewards` 是分開的兩條路）。本任務不额外新增材料保底邏輯到 `calculateExpeditionRewards`（範圍已經夠大），材料的加成留給王擊殺獎勵（見下）即可，不強求每一場寶箱族戰鬥都保底材料。

## 5. 寶箱王擊殺加碼獎勵

王房通關時（`isBossRoom && isTreasureRun` 判斷點，在 `DungeonExpedition.jsx`/`TeamExpeditionBattle.jsx` 現有的「首殺判定」呼叫附近）額外呼叫既有的 `addMaterials`/`addChests` 給一份固定材料+寶箱獎勵，並呼叫（尚待——符文物品目前系統怎麼發放需要現場查 `runeData.js`/`runeInventory` 的既有寫入函式，比照既有材料發放方式）。

## 6. 非遠征模式彩蛋加成（次要，範圍小）

`DungeonBattleRoom.jsx::handleClaimSelf` 呼叫 `rollCoins`/`rollMaterialDrops` 處，加一個簡單判斷：

```js
const isTreasureMonster = room?.monster?.family === "treasure";
const baseCoins = rollCoins(room?.monster?.tier || "common", 1) * (isTreasureMonster ? 3 : 1);
```

不改 `lootTable.js` 本身（不動既有 `mode` 系統語意），只在呼叫端疊乘。

## 不在本任務範圍

- 符文「使用」介面解鎖（另一個獨立項目）。
- 新系統藥水無法使用（另一個獨立 bug）。
- 材料保底稀有度的完整重新設計（只做王擊殺加碼，一般寶箱怪戰鬥沿用既有材料機率）。
