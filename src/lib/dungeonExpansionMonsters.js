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
    if (result.monsters.length && (!needsElite || result.elite)) {
      // ⚠️ 王缺席時只補王，**不要**把整層雜怪也打回舊表。
      // 舊 drawFloorMonsters 是跨族跨階的，實測 T2 神廟第 3 層因為 fixedBoss 為 null
      // 就跑出爛主管（職場）＋虎頭蜂（昆蟲）＋魔神仔（幽冥）三族混雜。
      // 王缺席是上游的問題（見 DungeonExpedition 的 fixedBoss），不該波及整層。
      if (floorIndex === 2 && !result.boss) {
        return { ...result, boss: drawExpansionDungeonMonster("strong", difficulty, options) };
      }
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

// ── 王房抽王請用 dungeonBossEncounter.js ────────────────────────
// 這裡一度有過第二套 drawDungeonBossEncounter（2026-07-19），但 7/18 就已經有
// createLockedDungeonBossEncounter 在做同一件事，而且戰鬥端（DungeonExpedition）
// 讀的是那一套。兩套並存會變成「選擇畫面預覽一隻王、實際打到另一隻」，故已移除。
// 生成地下城時請走 dungeonExcavation.js::rollExcavationBoss。
