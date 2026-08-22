// src/lib/multiMonsterEncounter.js
// ═══════════════════════════════════════════════════════════════
//  多怪遭遇生成引擎（純函數）
//  隨機抽2-6隻怪、前後排分配、符文柱生成
// ═══════════════════════════════════════════════════════════════

import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { applySoloVariant, selectVariant, toLegacyBattleMonster } from "./monsterExpansionAdapter";

// ── 多怪模式常數 ──────────────────────────────────────────
export const MULTI_MONSTER_CONFIG = {
  FRONT_MONSTERS: 3,
  MAX_REAR_ROW: 2,
  RUNE_PILLAR_HEAL_MIN: 0.01,  // 1%
  RUNE_PILLAR_HEAL_MAX: 0.05,  // 5%
};

export const MULTI_VARIANT_LABELS = Object.freeze({ weak: "弱化", normal: "普通", strong: "強悍" });

// ── 符文柱資料 ──────────────────────────────────────────
export const RUNE_PILLAR = {
  id: "rune_pillar",
  name: "符文柱",
  icon: "🔮",
  desc: "後排治療單位，每回合為前排怪物補血",
  hp: 1,
  atk: 0,
  def: 0,
  isRunePillar: true,
  family: "none",
  tier: "special",
  encounter: "rune_pillar",
};

/**
 * 生成多怪遭遇
 * @param {string} family - 族系（ghost/mountain/insect/workplace/exam/temple/treasure）
 * @param {number} tier - tierIndex (1-6)
 * @param {object} [options]
 * @param {number} [options.monsterCount] - 指定怪物數量（不指定則隨機）
 * @param {function} [options.rand] - 隨機函數
 * @returns {object} encounter state
 */
export function generateMultiMonsterEncounter(family, tier, options = {}) {
  const { rand = Math.random, pillarCount } = options;
  const tierNum = Number(tier);
  const availableMonsters = EXPANSION_MONSTERS.filter(m =>
    m.family === family &&
    Number(m.tierIndex) === tierNum &&
    m.encounter === "normal"
  );

  if (availableMonsters.length < MULTI_MONSTER_CONFIG.FRONT_MONSTERS) {
    throw new Error(`No monsters found for family=${family}, tier=${tier}`);
  }

  const frontRow = availableMonsters.slice(0, 3).map((source, index) => {
    const variant = selectVariant(rand());
    const rolled = applySoloVariant(toLegacyBattleMonster(source), variant, rand());
    return {
      ...source,
      ...rolled,
      instanceId: `monster_${index}`,
      position: "front",
      currentHp: rolled.hp,
      maxHp: rolled.hp,
      alive: true,
      variantLabel: MULTI_VARIANT_LABELS[variant],
    };
  });
  const rearCount = Number.isInteger(pillarCount)
    ? Math.max(0, Math.min(2, pillarCount))
    : randomInt(0, 2, rand);
  const rearRow = Array.from({ length: rearCount }, (_, index) => ({
    ...RUNE_PILLAR,
    instanceId: `rune_pillar_${index}`,
    position: "rear",
    currentHp: RUNE_PILLAR.hp,
    maxHp: RUNE_PILLAR.hp,
    alive: true,
  }));
  const monsters = [...frontRow, ...rearRow];

  return {
    monsters,
    frontRow,
    rearRow,
    totalMonsters: monsters.length,
    family,
    tier,
  };
}

/**
 * 取得下一個存活的怪物（用於傷害轉移）
 * @param {Array} monsters - 怪物陣列
 * @param {number} currentIndex - 目前被擊殺的怪 index
 * @returns {object|null} 下一隻存活的怪
 */
export function getNextAliveMonster(monsters, currentIndex) {
  // 從下一個位置開始找
  for (let i = currentIndex + 1; i < monsters.length; i++) {
    if (monsters[i].alive && !monsters[i].isRunePillar) {
      return { monster: monsters[i], index: i };
    }
  }
  // 繞回前面找
  for (let i = 0; i < currentIndex; i++) {
    if (monsters[i].alive && !monsters[i].isRunePillar) {
      return { monster: monsters[i], index: i };
    }
  }
  return null;
}

/**
 * 取得所有存活的非符文柱怪物
 * @param {Array} monsters
 * @returns {Array}
 */
export function getAliveMonsters(monsters) {
  return monsters.filter(m => m.alive && !m.isRunePillar);
}

/**
 * 計算符文柱效果
 * @param {Array} monsters - 所有怪物
 * @returns {object} buff results
 */
export function applyRunePillarEffects(monsters) {
  const results = {
    heals: [],      // { targetId, healAmount }
    buffs: [],      // { targetId, buffType, value }
  };

  const runePillars = monsters.filter(m => m.isRunePillar && m.alive);
  const frontMonsters = monsters.filter(m => m.position === "front" && m.alive);

  for (const pillar of runePillars) {
    for (const target of frontMonsters) {
      // 補血 1-5%
      const healPct = randomFloat(
        MULTI_MONSTER_CONFIG.RUNE_PILLAR_HEAL_MIN,
        MULTI_MONSTER_CONFIG.RUNE_PILLAR_HEAL_MAX,
        Math.random
      );
      const healAmount = Math.max(1, Math.floor(target.maxHp * healPct));
      const actualHeal = Math.min(healAmount, target.maxHp - target.currentHp);

      if (actualHeal > 0) {
        target.currentHp += actualHeal;
        results.heals.push({
          targetId: target.instanceId,
          healAmount: actualHeal,
          newHp: target.currentHp,
        });
      }

    }
  }

  return results;
}

// ── 輔助函數 ──────────────────────────────────────────────

function randomInt(min, max, rand = Math.random) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomFloat(min, max, rand = Math.random) {
  return rand() * (max - min) + min;
}
