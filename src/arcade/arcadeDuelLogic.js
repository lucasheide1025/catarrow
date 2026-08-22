// src/arcade/arcadeDuelLogic.js — 射手競技場純邏輯
// Local First：此檔不碰 Firestore。各手機都能用同一份摘要重算同一回合。

import { applyArcadeCardProcs, arcadeEffectiveDefense, tickArcadeStatuses } from "./arcadeProgression";

export const DUEL_MODES = Object.freeze({
  duel: { id: "duel", name: "1 VS 1", icon: "⚔️", min: 2, max: 2 },
  ffa: { id: "ffa", name: "大亂鬥", icon: "👑", min: 3, max: 8 },
  team: { id: "team", name: "團隊戰", icon: "🛡️", min: 4, max: 8 },
});
export const DUEL_MAX_PLAYERS = 8;
export const DUEL_ARROW_OPTIONS = Object.freeze([3, 6]);
export const DUEL_HP = Object.freeze({ 3: 80, 6: 130 });
export const FOCUS_FIRE_MULT = Object.freeze({ 1: 1, 2: 0.85, 3: 0.70, 4: 0.55 });

// PvP submission 直接放在既有 arcadeRooms collection 的固定 top-level 文件。
// visitorId 必須 encode，避免 `/` 被 Firestore 當成 path separator。
export function duelSubmissionDocId(roomCode, sessionKey, visitorId) {
  const code = String(roomCode || "");
  const player = encodeURIComponent(String(visitorId || ""));
  const scope = String(sessionKey || "").trim();
  // legacy fallback keeps rooms created during the first top-level rollout usable after hot reload.
  if (!scope) return `DUELSUB_${code}_${player}`;
  return `DUELSUB_${code}_${encodeURIComponent(scope)}_${player}`;
}

export function duelModeById(id) {
  return DUEL_MODES[id] || DUEL_MODES.duel;
}

export function normalizeArrowsPerRound(n) {
  return Number(n) === 6 ? 6 : 3;
}

export function maxHpForArrows(n, playerCount = 2) {
  const arrows = normalizeArrowsPerRound(n);
  const count = Math.min(8, Math.max(2, Number(playerCount) || 2));
  const perExtraPlayer = arrows === 6 ? 30 : 20;
  return DUEL_HP[arrows] + (count - 2) * perExtraPlayer;
}

export function validDuelPlayerCount(mode, count) {
  const n = Number(count) || 0;
  if (mode === "team") return [4, 6, 8].includes(n);
  const m = duelModeById(mode);
  return n >= m.min && n <= m.max;
}

export function assignDuelTeams(players) {
  const sorted = [...(players || [])].sort((a, b) => {
    const at = Number(a?.joinedAt || 0) - Number(b?.joinedAt || 0);
    return at || String(a?.visitorId || "").localeCompare(String(b?.visitorId || ""));
  });
  return Object.fromEntries(sorted.map((p, i) => [p.visitorId, i % 2 === 0 ? "A" : "B"]));
}

export function arrowScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n === 11 ? 10 : Math.min(10, Math.max(1, Math.floor(n)));
}

export function arrowDamage(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n === 11) return 20;
  if (n === 10) return 15;
  return Math.min(9, Math.max(1, Math.floor(n)));
}

export function summarizeDuelArrows(arrows, count = 3) {
  const n = normalizeArrowsPerRound(count);
  const vals = Array.from({ length: n }, (_, i) => Number(arrows?.[i] ?? 0));
  return vals.reduce((out, v) => {
    out.totalScore += arrowScore(v);
    out.baseDamage += arrowDamage(v);
    if (v === 10) out.tens += 1;
    if (v === 11) out.xCount += 1;
    if (v > 0) out.hits += 1;
    return out;
  }, { totalScore: 0, baseDamage: 0, tens: 0, xCount: 0, hits: 0 });
}

export function focusFireMultiplier(lockCount) {
  const n = Math.max(1, Number(lockCount) || 1);
  return FOCUS_FIRE_MULT[Math.min(4, n)] || FOCUS_FIRE_MULT[4];
}

export function spiritSupportAmount(submission) {
  const score = Math.max(0, Number(submission?.totalScore) || 0);
  const tens = Math.max(0, Number(submission?.tens) || 0);
  const xs = Math.max(0, Number(submission?.xCount) || 0);
  return Math.max(0, Math.round(score * 0.25 + tens * 2 + xs * 4));
}

export function duelStatAdjustedDamage(baseDamage, attackerAtk = 10, defenderDef = 5) {
  const base = Math.max(0, Number(baseDamage) || 0);
  if (base <= 0) return 0;
  const atk = Math.max(1, Number(attackerAtk) || 10);
  const def = Math.max(0, Number(defenderDef) || 5);
  const atkDelta = Math.round((atk - 10) * 0.75);
  const defDelta = Math.round((def - 5) * 0.65);
  return Math.max(1, base + atkDelta - defDelta);
}

export function buildInitialDuelCombat(players, { mode = "duel", arrowsPerRound = 3 } = {}) {
  const list = Object.values(players || {});
  const modeHp = maxHpForArrows(arrowsPerRound, list.length);
  const teams = mode === "team" ? assignDuelTeams(list) : {};
  return Object.fromEntries(list.map((p) => {
    const maxHp = Math.max(1, Math.round(modeHp * (Math.max(1, Number(p.maxHp) || 100) / 100)));
    return [p.visitorId, {
      hp: maxHp,
      maxHp,
      level: Math.max(1, Number(p.level) || 1),
      atk: Math.max(1, Number(p.atk) || 10),
      def: Math.max(0, Number(p.def) || 5),
      cardEffects: Array.isArray(p.cardEffects) ? p.cardEffects.slice(0, 2) : [],
      statuses: [],
      state: "alive",
      team: mode === "team" ? teams[p.visitorId] : null,
      forfeited: false,
    }];
  }));
}

function aliveIds(combat) {
  return Object.entries(combat || {})
    .filter(([, c]) => c && c.state === "alive" && !c.forfeited && Number(c.hp) > 0)
    .map(([id]) => id);
}

function lowestHpAlive(combat) {
  return aliveIds(combat).sort((a, b) => {
    const d = Number(combat[a]?.hp || 0) - Number(combat[b]?.hp || 0);
    return d || a.localeCompare(b);
  })[0] || null;
}

export function duelWinner(mode, combat) {
  const alive = aliveIds(combat);
  if (mode !== "team") {
    return alive.length <= 1
      ? { finished: true, winnerId: alive[0] || null, winnerTeam: null }
      : { finished: false, winnerId: null, winnerTeam: null };
  }
  const teams = [...new Set(alive.map((id) => combat[id]?.team).filter(Boolean))];
  return teams.length <= 1
    ? { finished: true, winnerId: null, winnerTeam: teams[0] || null }
    : { finished: false, winnerId: null, winnerTeam: null };
}

export function requiredDuelSubmitterIds(combat) {
  return Object.entries(combat || {})
    .filter(([, c]) => c && !c.forfeited && ["alive", "spirit"].includes(c.state))
    .map(([id]) => id)
    .sort();
}

function zeroSubmission(id, round) {
  return { visitorId: id, round, targetId: null, totalScore: 0, baseDamage: 0, tens: 0, xCount: 0, hits: 0 };
}

/**
 * 同步回合結算：所有攻擊使用回合開始時的狀態，避免提交順序影響結果。
 * submissions 可缺人（force resolve 時缺席視 0 分）。
 */
export function resolveDuelRound({ mode = "duel", round = 1, combat = {}, submissions = [] } = {}) {
  const start = Object.fromEntries(Object.entries(combat || {}).map(([id, c]) => [id, { ...c }]));
  const submitMap = Object.fromEntries((submissions || []).filter(Boolean).map((s) => [s.visitorId, s]));
  const required = requiredDuelSubmitterIds(start);
  const normalized = required.map((id) => ({ ...zeroSubmission(id, round), ...(submitMap[id] || {}) }));
  const supports = [];
  const attacks = [];

  for (const s of normalized) {
    const me = start[s.visitorId];
    if (!me || me.forfeited) continue;
    if (me.state === "spirit") {
      let targetId = null;
      if (mode === "team") {
        const requested = s.targetId;
        if (requested && requested !== s.visitorId && start[requested]?.state === "alive" && !start[requested]?.forfeited && start[requested]?.team === me.team) {
          targetId = requested;
        } else {
          targetId = aliveIds(start)
            .filter((id) => start[id]?.team === me.team)
            .sort((a, b) => (start[a].hp - start[b].hp) || a.localeCompare(b))[0] || null;
        }
      } else {
        targetId = lowestHpAlive(start);
      }
      if (targetId) supports.push({ fromId: s.visitorId, targetId, heal: spiritSupportAmount(s), score: Number(s.totalScore) || 0, xCount: Number(s.xCount) || 0 });
      continue;
    }

    const targetId = s.targetId;
    const target = start[targetId];
    const validEnemy = targetId && targetId !== s.visitorId && target?.state === "alive" && !target?.forfeited
      && (mode !== "team" || target.team !== me.team);
    if (validEnemy) attacks.push({
      fromId: s.visitorId,
      targetId,
      baseDamage: Math.max(0, Number(s.baseDamage) || 0),
      score: Math.max(0, Number(s.totalScore) || 0),
      tens: Math.max(0, Number(s.tens) || 0),
      xCount: Math.max(0, Number(s.xCount) || 0),
    });
  }

  const lockCounts = {};
  attacks.forEach((a) => { lockCounts[a.targetId] = (lockCounts[a.targetId] || 0) + 1; });
  const damageByTarget = {};
  const damageByPlayer = {};
  const events = [];
  attacks.forEach((a) => {
    const locks = lockCounts[a.targetId] || 1;
    const mult = focusFireMultiplier(locks);
    const damage = Math.max(0, Math.round(a.baseDamage * mult));
    damageByTarget[a.targetId] = (damageByTarget[a.targetId] || 0) + damage;
    damageByPlayer[a.fromId] = (damageByPlayer[a.fromId] || 0) + damage;
    events.push({ type: "attack", ...a, locks, multiplier: mult, damage });
  });

  const healByTarget = {};
  supports.forEach((s) => {
    healByTarget[s.targetId] = (healByTarget[s.targetId] || 0) + s.heal;
    events.push({ type: "support", ...s });
  });

  const next = {};
  for (const [id, c0] of Object.entries(start)) {
    const c = { ...c0 };
    if (c.forfeited) {
      next[id] = { ...c, hp: 0, state: "spirit" };
      continue;
    }
    if (c.state === "alive") {
      const healed = Math.min(c.maxHp || c.hp, Number(c.hp || 0) + (healByTarget[id] || 0));
      const hp = Math.max(0, healed - (damageByTarget[id] || 0));
      next[id] = { ...c, hp, state: hp > 0 ? "alive" : "spirit" };
      if (hp <= 0) events.push({ type: "knockout", targetId: id });
    } else {
      next[id] = { ...c, state: "spirit" };
    }
  }

  const winner = duelWinner(mode, next);
  return {
    round,
    combat: next,
    attacks: events.filter((e) => e.type === "attack"),
    supports: events.filter((e) => e.type === "support"),
    knockouts: events.filter((e) => e.type === "knockout").map((e) => e.targetId),
    events,
    damageByPlayer,
    submittedIds: normalized.filter((s) => submitMap[s.visitorId]).map((s) => s.visitorId).sort(),
    missingIds: normalized.filter((s) => !submitMap[s.visitorId]).map((s) => s.visitorId).sort(),
    ...winner,
  };
}

export function updateLocalDuelStats(stats = {}, { won = false, damage = 0, xCount = 0, score = 0 } = {}) {
  return {
    matches: (Number(stats.matches) || 0) + 1,
    wins: (Number(stats.wins) || 0) + (won ? 1 : 0),
    damage: (Number(stats.damage) || 0) + Math.max(0, Number(damage) || 0),
    xCount: (Number(stats.xCount) || 0) + Math.max(0, Number(xCount) || 0),
    bestScore: Math.max(Number(stats.bestScore) || 0, Math.max(0, Number(score) || 0)),
  };
}
