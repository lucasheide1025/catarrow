// src/zombie/domain/partyEngine.js
// ═══════════════════════════════════════════════════════════════
//  👥 殭屍生存 — 多人組隊引擎（純函數）
//  隊伍管理、玩家狀態、就緒同步
// ═══════════════════════════════════════════════════════════════

// ── 角色職位 ─────────────────────────────────────────────
export const PLAYER_ROLE = Object.freeze({
  LEADER: "leader",        // 房主
  SHOOTER: "shooter",      // 主射手
  SPOTTER: "spotter",      // 觀測手（標記弱點）
  SUPPORT: "support",      // 支援（補給/醫療）
});

/** 最大隊伍人數 */
export const MAX_PARTY_SIZE = 5;

/** 預設靶位標籤（對應現有 slot A-E） */
export const SLOT_LABELS = ["A", "B", "C", "D", "E"];

// ── 創建玩家 ─────────────────────────────────────────────
export function createPlayer({ id, name, slot, role = PLAYER_ROLE.SHOOTER }) {
  return {
    id,
    name,
    slot,                // "A" ~ "E"
    role,
    isReady: false,
    isAlive: true,
    isFullyInfected: false,
    infectionProgress: 0, // 0-10
    equipment: {
      armor: null,       // 防具 ID
      accessory: [],     // 配件 ID 列表
      arrows: [],        // 攜帶箭矢
      medical: [],       // 醫療品
    },
    combatStats: {
      hits: {},
      targetsKilled: 0,
      accuracy: 0,
      totalShots: 0,
      totalHits: 0,
    },
    joinedAt: Date.now(),
  };
}

// ── 創建隊伍 ─────────────────────────────────────────────
export function createParty(leaderId, leaderName) {
  const leader = createPlayer({
    id: leaderId,
    name: leaderName,
    slot: "A",
    role: PLAYER_ROLE.LEADER,
  });

  return {
    id: `party_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    leaderId,
    members: [leader],
    maxSize: MAX_PARTY_SIZE,
    createdAt: Date.now(),
    gameState: null,      // 關聯的遊戲狀態 ID
  };
}

// ── 加入隊伍 ─────────────────────────────────────────────
export function joinParty(party, playerId, playerName) {
  // 檢查是否已在隊伍中
  if (party.members.some(m => m.id === playerId)) {
    return { ok: false, reason: "already_in_party", party };
  }

  // 檢查人數上限
  if (party.members.length >= party.maxSize) {
    return { ok: false, reason: "party_full", party };
  }

  // 找第一個可用 slot
  const usedSlots = new Set(party.members.map(m => m.slot));
  const availableSlot = SLOT_LABELS.find(s => !usedSlots.has(s));
  if (!availableSlot) {
    return { ok: false, reason: "no_slot_available", party };
  }

  const newMember = createPlayer({
    id: playerId,
    name: playerName,
    slot: availableSlot,
  });

  return {
    ok: true,
    party: {
      ...party,
      members: [...party.members, newMember],
    },
  };
}

// ── 離開隊伍 ─────────────────────────────────────────────
export function leaveParty(party, playerId) {
  const member = party.members.find(m => m.id === playerId);
  if (!member) {
    return { ok: false, reason: "not_in_party", party };
  }

  const remaining = party.members.filter(m => m.id !== playerId);

  // 如果房主離開，轉讓房主
  let newLeaderId = party.leaderId;
  if (playerId === party.leaderId && remaining.length > 0) {
    newLeaderId = remaining[0].id;
    remaining[0] = { ...remaining[0], role: PLAYER_ROLE.LEADER };
  }

  return {
    ok: true,
    party: {
      ...party,
      leaderId: newLeaderId,
      members: remaining,
    },
  };
}

// ── 切換就緒狀態 ─────────────────────────────────────────
export function toggleReady(party, playerId) {
  return {
    ...party,
    members: party.members.map(m =>
      m.id === playerId ? { ...m, isReady: !m.isReady } : m
    ),
  };
}

// ── 全員就緒？ ──────────────────────────────────────────
export function isAllReady(party) {
  return party.members.length >= 2 && party.members.every(m => m.isReady);
}

// ── 更新玩家裝備 ─────────────────────────────────────────
export function setPlayerEquipment(party, playerId, equipment) {
  return {
    ...party,
    members: party.members.map(m =>
      m.id === playerId
        ? { ...m, equipment: { ...m.equipment, ...equipment } }
        : m
    ),
  };
}

// ── 更新玩家感染狀態 ─────────────────────────────────────
export function updateInfection(party, playerId, progress, isFullyInfected) {
  return {
    ...party,
    members: party.members.map(m =>
      m.id === playerId
        ? {
            ...m,
            infectionProgress: progress,
            isFullyInfected,
            isAlive: progress < 10, // 10 節點 → 死亡
          }
        : m
    ),
  };
}

// ── 更新戰鬥統計 ─────────────────────────────────────────
export function recordShot(party, playerId, hitPart, isHit) {
  return {
    ...party,
    members: party.members.map(m => {
      if (m.id !== playerId) return m;
      const newStats = { ...m.combatStats };
      newStats.totalShots += 1;
      if (isHit) {
        newStats.totalHits += 1;
        newStats.hits = { ...newStats.hits, [hitPart]: (newStats.hits[hitPart] || 0) + 1 };
      }
      newStats.accuracy = Math.round((newStats.totalHits / newStats.totalShots) * 100);
      return { ...m, combatStats: newStats };
    }),
  };
}

// ── 重置隊伍就緒狀態 ─────────────────────────────────────
export function resetReady(party) {
  return {
    ...party,
    members: party.members.map(m => ({ ...m, isReady: false })),
  };
}

// ── 查詢輔助 ─────────────────────────────────────────────
export function getAliveMembers(party) {
  return party.members.filter(m => m.isAlive);
}

export function getInfectedMembers(party) {
  return party.members.filter(m => m.infectionProgress > 0);
}

export function getMemberBySlot(party, slot) {
  return party.members.find(m => m.slot === slot);
}

export function getRoleLabel(role) {
  const labels = {
    [PLAYER_ROLE.LEADER]: "👑 房主",
    [PLAYER_ROLE.SHOOTER]: "🏹 射手",
    [PLAYER_ROLE.SPOTTER]: "🔭 觀測手",
    [PLAYER_ROLE.SUPPORT]: "💊 支援",
  };
  return labels[role] || role;
}
