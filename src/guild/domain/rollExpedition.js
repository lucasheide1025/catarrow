// src/guild/domain/rollExpedition.js
// ─────────────────────────────────────────────────────────────
// 委託 → 隨機「多場討伐遠征」：依危險度抽怪物 tier，生成 N 波、每波 ≤4 隻。
// 怪物**沿用打怪模式數值**（MONSTERS 的 hp/atk/def），只是拿進公會當戰鬥單位。
// 每隻怪帶 `distance`（距離倒數）：每回合 −1，歸零發動攻擊（見 2.5D 戰鬥設計）。
// ⚠️ 讀主線怪物「資料」OK；不把公會戰力餵回主線。
// ─────────────────────────────────────────────────────────────
import { MONSTERS } from "../../lib/monsterData";

export const DANGER = Object.freeze({ NORMAL: 1, DANGER: 2, EXTREME: 3 });

// 危險度設定：可選 tier、波數、每波怪數、初始距離
export const DANGER_META = Object.freeze({
  1: { label: "一般", skulls: "☠️",     tiers: ["common", "rare"],           waves: 3, waveSize: [1, 2], initDist: [3, 5] },
  2: { label: "危險", skulls: "☠️☠️",   tiers: ["rare", "elite"],            waves: 4, waveSize: [2, 3], initDist: [3, 6] },
  3: { label: "極危", skulls: "☠️☠️☠️", tiers: ["elite", "fierce", "boss"],  waves: 5, waveSize: [2, 4], initDist: [4, 6] },
});

export const MAX_TARGETS = 4; // 畫面最多同時 4 個目標

// 委託可能遭遇的怪物池（畫面預覽與實際抽怪共用同一份規則，預覽才不會騙人）。
// contract.families = 多元種族（一張委託可以混族）；沒給就退回單一 family；都沒給＝不限族。
export function expeditionMonsterPool(contract = {}) {
  const danger = DANGER_META[contract.danger] ? contract.danger : 1;
  const meta = DANGER_META[danger];
  const wanted = contract.families?.length ? contract.families : (contract.family ? [contract.family] : null);
  const base = MONSTERS.filter(m => meta.tiers.includes(m.tier) && m.family !== "treasure");
  if (wanted) {
    const famPool = base.filter(m => wanted.includes(m.family));
    if (famPool.length) return famPool;
  }
  return base.length ? base : MONSTERS.filter(m => m.tier === "common");
}

// contract: { id?, danger:1|2|3, family?, families? }；opts.rand 可注入（測試用）
export function rollExpedition(contract = {}, opts = {}) {
  const rand = opts.rand || Math.random;
  const danger = DANGER_META[contract.danger] ? contract.danger : 1;
  const meta = DANGER_META[danger];
  const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  const pool = expeditionMonsterPool({ ...contract, danger });

  let inst = 0;
  const waves = [];
  for (let w = 0; w < meta.waves; w++) {
    const size = Math.min(MAX_TARGETS, ri(meta.waveSize[0], meta.waveSize[1]));
    const monsters = [];
    for (let i = 0; i < size; i++) {
      const m = pick(pool);
      monsters.push({
        instanceId: `g${inst++}`,
        monsterId: m.id, name: m.name, icon: m.icon, family: m.family, tier: m.tier,
        maxHp: m.hp, hp: m.hp, atk: m.atk, def: m.def,
        distance: ri(meta.initDist[0], meta.initDist[1]), // 距離倒數
      });
    }
    waves.push({ waveIndex: w, monsters });
  }

  return {
    contractId: contract.id || null,
    danger,
    family: contract.family || contract.families?.[0] || null,  // 戰場底圖用主族
    families: contract.families?.length ? [...contract.families] : (contract.family ? [contract.family] : []),
    totalWaves: meta.waves,
    waves,
  };
}
