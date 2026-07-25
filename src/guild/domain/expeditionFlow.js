// src/guild/domain/expeditionFlow.js
// ─────────────────────────────────────────────────────────────
// 委託遠征「戰鬥核心狀態機」（純函數）。一回合流程：
//   1. 玩家射箭（真實分數）→ 對選定目標造成傷害（六維 ATK vs 怪 DEF，LUK→爆擊）
//   2. 波次清空 → 進下一波；最後一波清空 → 勝利（該回合給喘息，怪不推進）
//   3. 存活怪 distance −1；歸零 → 攻擊玩家（DEF 減傷、AGI 閃避），攻擊後退回
//   4. 消耗食/水（VIT 減緩）；任一歸零 → 飢渴掉血
//   5. HP≤0 → 失敗（陣亡 or 補給耗盡＋力竭＝強迫撤退）
// ⚠️ 只用公會自己的六維（guildStats），不碰主線戰力。
// ─────────────────────────────────────────────────────────────
import { deriveGuildCombat } from "./guildStats";

function cloneWaveMonsters(wave) {
  return (wave?.monsters || []).map(m => ({ ...m }));
}

// 公會箭傷公式（重用「分數×攻擊 − 防禦」概念，獨立於主線 damage.js 呼叫）
function arrowDamage(score, atk, def, crit) {
  const base = Math.max(1, Math.round(atk * (0.5 + (score || 0) / 11) - def * 0.5));
  return crit ? Math.round(base * 1.5) : base;
}

export function createExpeditionState(expedition, guildStats, supplies = { food: 6, water: 6 }) {
  const derived = deriveGuildCombat(guildStats);
  return {
    expedition,
    guildStats,
    derived,
    maxHp: derived.maxHP,
    hp: derived.maxHP,
    supplies: { ...supplies },
    waveIndex: 0,
    monsters: cloneWaveMonsters(expedition.waves[0]),
    round: 1,
    status: "fighting", // fighting | won | lost
    lostReason: null,
    log: [],
  };
}

// shots: [{ targetInstanceId, score }]（一回合射出的箭）
export function processRound(state, shots = [], opts = {}) {
  if (state.status !== "fighting") return state;
  const rand = opts.rand || Math.random;
  const s = {
    ...state,
    monsters: state.monsters.map(m => ({ ...m })),
    supplies: { ...state.supplies },
    log: [],
  };
  const d = s.derived;

  // 1. 玩家射箭
  for (const shot of shots) {
    const mon = s.monsters.find(m => m.instanceId === shot.targetInstanceId && m.hp > 0);
    if (!mon) continue;
    const crit = rand() < d.critChance;
    const dmg = arrowDamage(shot.score, s.guildStats.atk, mon.def, crit);
    mon.hp = Math.max(0, mon.hp - dmg);
    s.log.push({ type: "arrow", target: mon.instanceId, dmg, crit, killed: mon.hp <= 0 });
  }
  s.monsters = s.monsters.filter(m => m.hp > 0);

  // 2. 波次清空 → 勝利 / 進下一波（清波該回合怪不推進）
  let clearedWave = false;
  if (s.monsters.length === 0) {
    if (s.waveIndex + 1 >= s.expedition.totalWaves) {
      s.status = "won";
      return s;
    }
    s.waveIndex += 1;
    s.monsters = cloneWaveMonsters(s.expedition.waves[s.waveIndex]);
    s.log.push({ type: "waveClear", nextWave: s.waveIndex });
    clearedWave = true;
  }

  // 3. 存活怪推進 + 距離歸零攻擊（清波回合跳過）
  if (!clearedWave) {
    for (const mon of s.monsters) {
      mon.distance = Math.max(0, mon.distance - 1);
      if (mon.distance === 0) {
        if (rand() < d.dodgeChance) { s.log.push({ type: "dodge", from: mon.instanceId }); continue; }
        const dmg = Math.max(1, Math.round(mon.atk * (1 - d.dmgReducePct / 100)));
        s.hp = Math.max(0, s.hp - dmg);
        mon.distance = 2; // 攻擊後退回，避免每回合連打
        s.log.push({ type: "monsterAttack", from: mon.instanceId, dmg });
      }
    }
  }

  // 4. 消耗補給（VIT 減緩）
  const rate = 1 - d.supplySavePct;
  s.supplies.food = Math.max(0, Math.round((s.supplies.food - rate) * 100) / 100);
  s.supplies.water = Math.max(0, Math.round((s.supplies.water - rate) * 100) / 100);
  const starving = s.supplies.food <= 0 || s.supplies.water <= 0;
  if (starving) {
    const dmg = Math.max(1, Math.round(s.maxHp * 0.1));
    s.hp = Math.max(0, s.hp - dmg);
    s.log.push({ type: "starve", dmg });
  }

  s.round += 1;

  // 5. 敗北判定
  if (s.hp <= 0 && s.status === "fighting") {
    s.status = "lost";
    s.lostReason = starving ? "補給耗盡＋力竭，強迫撤退" : "陣亡";
  }
  return s;
}

// 目前可鎖定的存活目標（畫面用，≤4 由 rollExpedition 保證）
export function aliveTargets(state) {
  return state.monsters.filter(m => m.hp > 0);
}
