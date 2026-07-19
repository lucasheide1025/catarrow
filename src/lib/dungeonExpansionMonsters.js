// src/lib/dungeonExpansionMonsters.js — 地下城中途樓層擴充怪物池（2026-07-18）
// 難度→Tier 對映依 monster-handbook 拍板：普通=T1-2、進階=T4、困難=T5、地獄=T6。
// 小王/大王只在 BOSS 房生成（母任務 PRD §151-152），中途樓層一律 encounter==="normal"。
// flag 關閉或池子無效時 fallback 舊 drawFloorMonsters，行為與改版前一致。

import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { toLegacyBattleMonster, applySoloVariant } from "./monsterExpansionAdapter";
import { isMonsterExpansionEnabled } from "./monsterExpansionFeature";
import { drawFloorMonsters, drawMixedMonsterPool, drawTreasureMonsterPool } from "./monsterData";

// 舊地下城 family 別名（與 dungeonBossEncounter 同表）
const FAMILY_ALIASES = Object.freeze({
  ghost: "ghost", forest: "mountain", mountain: "mountain",
  poison: "insect", insect: "insect", office: "workplace", workplace: "workplace",
  exam: "exam", western: "temple", temple: "temple", treasure: "treasure",
});

// 2026-07-19 全面改版（使用者拍板）：地下城**不再跨階生怪**，Tn 只出該族的 Tn 怪。
// 樓層之間的難度差異由「變體」表現（第1層弱化→第2層普通→第3層強悍），
// 小王／大王只在最終王房出現。
//
// 為什麼以前要跨階：舊設計每族每階只有 1 隻怪，不跨階就會整層都是同一隻。
// 現在擴充清冊每族每階有 3 隻 normal 怪，池子夠深，跨階已無必要 —— 而且跨階
// 正是「標示 T4 的地下城第一層跑出神話怪」的元凶。
export const DUNGEON_DIFFICULTY_TIER_POOL = Object.freeze({
  1: ["common"],   // T1
  2: ["rare"],     // T2
  3: ["elite"],    // T3
  4: ["fierce"],   // T4
  5: ["boss"],     // T5
  6: ["mythic"],   // T6
});
export const MAX_DUNGEON_TIER = 6;

export function getDungeonTierPool(difficulty) {
  const level = Math.max(1, Math.min(MAX_DUNGEON_TIER, Math.floor(Number(difficulty) || 1)));
  return DUNGEON_DIFFICULTY_TIER_POOL[level];
}

function pickExpansionCandidate(family, difficulty, random) {
  const normalizedFamily = FAMILY_ALIASES[family] || family;
  const tierPool = getDungeonTierPool(difficulty);
  const candidates = EXPANSION_MONSTERS.filter(monster =>
    monster.family === normalizedFamily
    && monster.encounter === "normal"
    && tierPool.includes(monster.tier),
  );
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

// 單隻抽怪（呼叫端 fallback 補怪用）;抽不到回傳 null，由呼叫端走舊路徑
export function drawExpansionDungeonMonster(variant, difficulty, { family, random = Math.random } = {}) {
  const selected = pickExpansionCandidate(family, difficulty, random);
  if (!selected) return null;
  return applySoloVariant(toLegacyBattleMonster(selected), variant, random());
}

function drawExpansionPool(count, variant, difficulty, family, random) {
  const picks = [];
  for (let index = 0; index < count; index += 1) {
    const monster = drawExpansionDungeonMonster(variant, difficulty, { family, random });
    if (monster) picks.push(monster);
  }
  return picks;
}

// 擴充王快照數值已含錨點倍率（母任務 PRD §67），只貼 boss 標籤供 UI 光暈，不再套舊版 ×2/×1.6
function tagExpansionBoss(fixedBoss) {
  if (!fixedBoss) return null;
  return fixedBoss.variant === "boss" ? { ...fixedBoss } : { ...fixedBoss, variant: "boss" };
}

export function drawExpansionDungeonFloorMonsters(floorIndex, difficulty, { family, fixedBoss, random = Math.random } = {}) {
  if (floorIndex === 0) {
    const count = 2 + Math.floor(random() * 2);
    return { monsters: drawExpansionPool(count, "weak", difficulty, family, random), elite: null, boss: null };
  }
  if (floorIndex === 1) {
    const count = 3 + Math.floor(random() * 2);
    return {
      monsters: drawExpansionPool(count, "normal", difficulty, family, random),
      elite: drawExpansionDungeonMonster("strong", difficulty, { family, random }),
      boss: null,
    };
  }
  return {
    monsters: drawExpansionPool(3, "strong", difficulty, family, random),
    elite: drawExpansionDungeonMonster("strong", difficulty, { family, random }),
    boss: tagExpansionBoss(fixedBoss),
  };
}

// ── 唯一接線入口 ─────────────────────────────────────────
// flag on 且該族/難度抽得到擴充怪 → 擴充池;否則完全走舊 drawFloorMonsters。
export function drawDungeonFloorMonsters(floorIndex, difficulty, options = {}) {
  if (isMonsterExpansionEnabled()) {
    const result = drawExpansionDungeonFloorMonsters(floorIndex, difficulty, options);
    const needsElite = floorIndex >= 1;
    const needsBoss = floorIndex === 2;
    if (result.monsters.length && (!needsElite || result.elite) && (!needsBoss || result.boss)) {
      return result;
    }
  }
  return drawFloorMonsters(floorIndex, difficulty, options);
}

// 單隻 fallback 補怪的 flag 分流版（取代呼叫端 drawMixedMonsterPool(1, …)[0]）
export function drawDungeonFallbackMonster(variant, difficulty, { family } = {}) {
  if (isMonsterExpansionEnabled()) {
    const monster = drawExpansionDungeonMonster(variant, difficulty, { family });
    if (monster) return monster;
  }
  const legacy = family === "treasure"
    ? drawTreasureMonsterPool(1, variant, difficulty)
    : drawMixedMonsterPool(1, variant, difficulty);
  return legacy[0] || null;
}

// ── 王房抽王（2026-07-19 使用者拍板規格）────────────────────────
// Tn 地下城的王房只出 Tn 的王：小王（每族每階 2 隻，隨機）或大王（1 隻）。
// 保底：連續 2 次小王後，第 3 次必定出大王 —— 否則玩家可能一直刷不到
// 大王素材，高階精煉直接卡死。
//
// ⚠️ 舊的 drawExpeditionBoss 是「找該族該階的第一隻怪再套 boss 倍率」，
// 完全沒過濾 isKing/encounter，所以王房的王其實是一隻被放大的雜怪。
export const MINI_BOSS_PITY = 3;

// forceKind："boss" / "miniBoss" —— 指定就跳過機率與保底，只在該類池子裡重抽。
// 用於「同一座地下城換難度」（金幣強化／免費降級）：王要換成新階的，但大王還是
// 大王、小王還是小王，否則玩家反覆升降級就能把保底計數刷滿。
export function drawDungeonBossEncounter(difficulty, family, options = {}) {
  const { miniStreak = 0, random = Math.random, forceKind = null } = options;
  const normalizedFamily = FAMILY_ALIASES[family] || family;
  const tierPool = getDungeonTierPool(difficulty);
  const poolOf = kind => EXPANSION_MONSTERS.filter(monster =>
    monster.family === normalizedFamily
    && tierPool.includes(monster.tier)
    && monster.encounter === kind,
  );
  const bossPool = poolOf("boss");
  const miniPool = poolOf("miniBoss");
  if (!bossPool.length && !miniPool.length) return null;

  const pityReached = miniStreak >= MINI_BOSS_PITY - 1;
  const useBoss = forceKind
    ? (forceKind === "boss" ? bossPool.length > 0 : !miniPool.length)
    : bossPool.length > 0 && (pityReached || !miniPool.length || random() < 0.5);
  const pool = useBoss ? bossPool : miniPool;
  const selected = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return {
    monster: { ...toLegacyBattleMonster(selected), variant: "boss" },
    kind: useBoss ? "boss" : "miniBoss",
    // 抽到大王就把連續小王計數歸零，抽到小王則累加
    miniStreak: useBoss ? 0 : miniStreak + 1,
  };
}
