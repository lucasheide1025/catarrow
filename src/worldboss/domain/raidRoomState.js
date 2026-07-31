// src/worldboss/domain/raidRoomState.js
// 組隊房間要把「戰鬥狀態」存進 Firestore、再讀回來繼續打。
// 這支只做序列化與還原，純函數、可測——真正碰 Firestore 的在 lib/raidTeamDb.js。
//
// ⚠️ 兩個不能存進 Firestore 的東西：
//   ① `boss.skillConfig`——那是 24 隻王的完整技能表，存進房間等於每回合搬一次。
//      改存 `boss.key`，讀回來時用 WORLD_BOSS_SKILLS 重新掛上。
//   ② `undefined`——Firestore 會直接拒絕整筆寫入。序列化時一律轉成 null 或省略。

import { WORLD_BOSS_SKILLS } from "../../lib/worldBossSkillData";

// 存進房間的欄位白名單。用白名單而不是黑名單：
// 之後 state 加了新欄位，不會不小心把一坨東西同步上去。
const STATE_KEYS = [
  "bossHp", "round", "staggered", "weakenStacks", "finished",
  "spots", "gauge", "totals", "members", "teamBuff",
  "participantBonus", "dmgBonusPct", "dmgReducePct",
  "distanceM", "targetFmt", "rangeMult", "archerLevel", "rookieMult",
  "playerHp", "playerMaxHp",
];

const clean = value => {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;          // Firestore 不吃 undefined
      out[k] = clean(v);
    }
    return out;
  }
  return value;
};

export function serializeRaidState(state) {
  if (!state) return null;
  const out = {};
  for (const key of STATE_KEYS) {
    if (state[key] !== undefined) out[key] = clean(state[key]);
  }
  out.boss = clean({
    key: state.boss?.key || null,
    name: state.boss?.name || "",
    atk: state.boss?.atk || 0,
    def: state.boss?.def || 0,
    maxHp: state.boss?.maxHp || 1,
  });
  return out;
}

export function hydrateRaidState(stored) {
  if (!stored) return null;
  const bossKey = stored.boss?.key;
  return {
    ...stored,
    boss: {
      ...stored.boss,
      // skillConfig 不進 Firestore，讀回來時重新掛上
      skillConfig: (bossKey && WORLD_BOSS_SKILLS[bossKey]) || null,
    },
    stats: stored.members?.[0]?.stats || { atk: 0, def: 0, hp: 100 },
    cats: stored.members?.[0]?.cats || [],
  };
}

/**
 * 房間現在卡在誰身上。房主的推進閘門吃這個結果。
 * 回傳 { phase, waitingFor, canResolve }
 *   phase: "shooting"（有人還沒送出）| "ready"（全員送出，等房主結算）| "done"
 */
export function roomPhase(room) {
  if (!room) return { phase: "done", waitingFor: [], canResolve: false };
  if (room.status === "done" || room.state?.finished) {
    return { phase: "done", waitingFor: [], canResolve: false };
  }
  const ids = Object.keys(room.members || {}).filter(id => room.members[id]);
  const round = Math.max(1, Number(room.round) || 1);
  const waitingFor = ids.filter(id => {
    const sub = room.submissions?.[id];
    return !(sub && Number(sub.round) === round && Array.isArray(sub.arrows) && sub.arrows.length);
  });
  return {
    phase: waitingFor.length ? "shooting" : "ready",
    waitingFor,
    waitingNames: waitingFor.map(id => room.members?.[id]?.name || id),
    canResolve: waitingFor.length === 0,
  };
}

// 把房間的 submissions 攤平成 resolveRaidRound 要的 arrows 陣列
export function collectRoomArrows(room) {
  const round = Math.max(1, Number(room?.round) || 1);
  const ids = Object.keys(room?.members || {}).filter(id => room.members[id]);
  const out = [];
  for (const id of ids) {
    const sub = room?.submissions?.[id];
    if (!sub || Number(sub.round) !== round) continue;
    for (const a of sub.arrows || []) out.push({ ...a, memberId: id });
  }
  return out;
}

// 房間成員 → createRaidState 要的 members
export function rosterFromRoom(room) {
  const ids = Object.keys(room?.members || {}).filter(id => room.members[id]);
  return ids.map(id => {
    const m = room.members[id] || {};
    return {
      memberId: id,
      name: m.name || id,
      stats: { atk: Number(m.atk) || 0, def: Number(m.def) || 0, hp: Number(m.hp) || 100 },
      archerLevel: Number(m.archerLevel) || 1,
      cats: Array.isArray(m.cats) ? m.cats : [],
    };
  });
}
