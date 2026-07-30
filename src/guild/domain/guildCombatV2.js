export const BATTLEFIELD = Object.freeze({ lanes: 3, visibleDepth: 10, maxVisible: 8 });
export const MONSTER_ROLES = Object.freeze(["pursuer", "heavy", "ranged", "caster", "support", "charger"]);
export const COUNTER_TYPES = Object.freeze(["minScore", "totalScore", "defeatCaster", "exactRing"]);

const ROLE_DEFAULTS = Object.freeze({
  pursuer: { moveSpeed: 1, attackRange: 0, cooldown: 2, skillChance: 0.16, targetPolicy: "player" },
  heavy: { moveSpeed: 1, attackRange: 0, cooldown: 3, skillChance: 0.2, targetPolicy: "gate" },
  ranged: { moveSpeed: 1, attackRange: 3, cooldown: 2, skillChance: 0.24, targetPolicy: "player" },
  caster: { moveSpeed: 1, attackRange: 4, cooldown: 2, skillChance: 0.32, targetPolicy: "player" },
  support: { moveSpeed: 1, attackRange: 3, cooldown: 2, skillChance: 0.28, targetPolicy: "ally" },
  charger: { moveSpeed: 2, attackRange: 0, cooldown: 3, skillChance: 0.18, targetPolicy: "player" },
});

// ── 距離傷害倍率 ─────────────────────────────────────────────────────────────
// 戰場縱深 10 格，怪物依角色有各自的攻擊距離（近戰 0／遠程 3／施法 4…）。
// 舊版只要 distance <= attackRange 就用同一個傷害，站在射程邊緣跟貼到臉上一樣痛，
// 玩家因此感覺不到「該優先處理貼近的怪」——使用者回報「沒有明確的怪物攻擊」。
//
// 現在：射程邊緣＝base 倍，愈近愈痛，貼到 0 格＝contact 倍（線性內插，好預期）。
// 純近戰（attackRange 0）只有貼身一種距離，一律吃 contact 倍。
// 要調平衡就改這兩個數字。
export const PROXIMITY_DAMAGE = Object.freeze({ base: 1, contact: 2 });

export function proximityDamageMultiplier(distance, attackRange) {
  const range = Math.max(0, Math.floor(Number(attackRange) || 0));
  const dist = Math.max(0, Math.floor(Number(distance) || 0));
  if (dist > range) return 0;                        // 射程外：根本不該攻擊
  if (range === 0) return PROXIMITY_DAMAGE.contact;  // 純近戰
  const closeness = (range - dist) / range;          // 0＝射程邊緣，1＝貼身
  return PROXIMITY_DAMAGE.base + (PROXIMITY_DAMAGE.contact - PROXIMITY_DAMAGE.base) * closeness;
}

const hash = value => Array.from(String(value || "")).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
const clampLane = lane => Math.max(0, Math.min(BATTLEFIELD.lanes - 1, Math.floor(Number(lane) || 0)));
const clampDepth = depth => Math.max(0, Math.floor(Number(depth) || 0));
const effectKey = effect => `${effect.targetId}:${effect.stat}:${effect.value >= 0 ? "positive" : "negative"}`;

export function roleForMonster(monster) {
  if (MONSTER_ROLES.includes(monster?.combatRole)) return monster.combatRole;
  return MONSTER_ROLES[hash(monster?.id || monster?.instanceId) % MONSTER_ROLES.length];
}

export function toGridMonster(monster, index = 0) {
  const role = roleForMonster(monster);
  const defaults = ROLE_DEFAULTS[role];
  return {
    ...monster,
    combatRole: role,
    position: {
      lane: clampLane(monster?.position?.lane ?? index % BATTLEFIELD.lanes),
      depth: clampDepth(monster?.position?.depth ?? monster?.distance ?? BATTLEFIELD.visibleDepth),
    },
    moveSpeed: Math.max(0, Math.floor(Number(monster?.moveSpeed) || defaults.moveSpeed)),
    attackRange: Math.max(0, Math.floor(Number(monster?.attackRange) || defaults.attackRange)),
    cooldown: Math.max(1, Math.floor(Number(monster?.cooldown) || defaults.cooldown)),
    cooldownLeft: Math.max(0, Math.floor(Number(monster?.cooldownLeft) || 0)),
    skillChance: Math.max(0, Math.min(1, Number.isFinite(Number(monster?.skillChance)) ? Number(monster.skillChance) : defaults.skillChance)),
    targetPolicy: monster?.targetPolicy || defaults.targetPolicy,
    intent: monster?.intent || null,
  };
}

function cellKey(position) {
  return `${position.lane}:${position.depth}`;
}

function nearestFreeCell(monster, occupied) {
  const desiredDepth = Math.max(0, monster.position.depth - monster.moveSpeed);
  for (let depth = desiredDepth; depth <= monster.position.depth; depth += 1) {
    const laneOrder = [monster.position.lane, (monster.position.lane + 1) % 3, (monster.position.lane + 2) % 3];
    for (const lane of laneOrder) {
      const position = { lane, depth };
      if (!occupied.has(cellKey(position))) return position;
    }
  }
  return monster.position;
}

export function createGridCombatState(monsters = [], opts = {}) {
  const normalized = monsters.map(toGridMonster);
  const visible = normalized.filter(monster => monster.position.depth <= BATTLEFIELD.visibleDepth).slice(0, BATTLEFIELD.maxVisible);
  const visibleIds = new Set(visible.map(monster => monster.instanceId || monster.id));
  const approaching = normalized
    .filter(monster => !visibleIds.has(monster.instanceId || monster.id))
    .sort((a, b) => a.position.depth - b.position.depth || hash(a.instanceId) - hash(b.instanceId));
  return {
    version: 2,
    round: 0,
    visible,
    approaching,
    effects: {},
    counter: null,
    playerHp: opts.playerHp ?? 100,
    gateHp: opts.gateHp ?? 100,
    log: [],
  };
}

export function applySignedEffect(state, effect) {
  const next = { ...state, effects: { ...(state.effects || {}) }, log: [...(state.log || [])] };
  const normalized = {
    ...effect,
    value: Number(effect.value) || 0,
    duration: Math.max(1, Math.floor(Number(effect.duration) || 1)),
  };
  const key = effectKey(normalized);
  const current = next.effects[key];
  if (!current) {
    next.effects[key] = normalized;
    next.log.push({ type: "effectApply", effect: normalized });
  } else if (Math.abs(normalized.value) > Math.abs(current.value)) {
    next.effects[key] = normalized;
    next.log.push({ type: "effectReplace", before: current, effect: normalized });
  } else if (normalized.sourceId === current.sourceId || normalized.value === current.value) {
    next.effects[key] = { ...current, duration: normalized.duration };
    next.log.push({ type: "effectRefresh", before: current, effect: next.effects[key] });
  } else {
    next.log.push({ type: "effectIgnore", current, effect: normalized });
  }
  return next;
}

export function createCounter(template, data = {}) {
  if (!COUNTER_TYPES.includes(template)) return null;
  return {
    type: template,
    targetId: data.targetId || null,
    threshold: Number(data.threshold) || 0,
    exactRing: data.exactRing == null ? null : Number(data.exactRing),
    exactRings: data.exactRings ? { ...data.exactRings } : null,
    progress: 0,
    resolved: false,
    success: false,
  };
}

export function advanceCounter(counter, shots = [], livingIds = []) {
  if (!counter || counter.resolved) return counter;
  let success = false;
  let progress = counter.progress || 0;
  if (counter.type === "minScore") {
    progress = Math.max(progress, ...shots.map(shot => Number(shot.rawScore ?? shot.score) || 0), 0);
    success = progress >= counter.threshold;
  } else if (counter.type === "totalScore") {
    progress += shots.reduce((sum, shot) => sum + (Number(shot.rawScore ?? shot.score) || 0), 0);
    success = progress >= counter.threshold;
  } else if (counter.type === "defeatCaster") {
    success = !livingIds.includes(counter.targetId);
    progress = success ? 1 : 0;
  } else if (counter.type === "exactRing") {
    success = shots.some(shot => {
      const required = counter.exactRings?.[shot.targetFormat] ?? counter.exactRing;
      return Number(shot.rawScore ?? shot.score) === required;
    });
    progress = success ? 1 : 0;
  }
  return { ...counter, progress, resolved: success, success };
}

function admitApproaching(visible, approaching) {
  const nextVisible = [...visible];
  const nextApproaching = [];
  const occupied = new Set(nextVisible.map(monster => cellKey(monster.position)));
  for (const monster of approaching) {
    if (nextVisible.length >= BATTLEFIELD.maxVisible || monster.position.depth > BATTLEFIELD.visibleDepth) {
      nextApproaching.push(monster);
      continue;
    }
    const position = nearestFreeCell(monster, occupied);
    if (position.depth > BATTLEFIELD.visibleDepth) {
      nextApproaching.push(monster);
      continue;
    }
    occupied.add(cellKey(position));
    nextVisible.push({ ...monster, position });
  }
  return { visible: nextVisible, approaching: nextApproaching };
}

export function resolveMonsterActions(state) {
  const next = {
    ...state,
    visible: state.visible.map(monster => ({ ...monster, position: { ...monster.position } })),
    approaching: state.approaching.map(monster => ({ ...monster, position: { ...monster.position } })),
    effects: { ...(state.effects || {}) },
    log: [],
  };
  const occupied = new Set(next.visible.map(monster => cellKey(monster.position)));
  for (const monster of next.visible) {
    occupied.delete(cellKey(monster.position));
    if (monster.position.depth <= monster.attackRange) {
      const damage = Math.max(1, Math.round(Number(monster.atk) || 1));
      if (monster.targetPolicy === "gate") next.gateHp = Math.max(0, next.gateHp - damage);
      else if (monster.targetPolicy !== "ally") next.playerHp = Math.max(0, next.playerHp - damage);
      next.log.push({ type: "monsterAttack", monsterId: monster.instanceId || monster.id, target: monster.targetPolicy, damage });
    } else {
      const from = monster.position;
      monster.position = nearestFreeCell(monster, occupied);
      next.log.push({ type: "monsterMove", monsterId: monster.instanceId || monster.id, from, to: monster.position });
    }
    occupied.add(cellKey(monster.position));
    monster.cooldownLeft = Math.max(0, monster.cooldownLeft - 1);
  }
  next.approaching = next.approaching.map(monster => ({
    ...monster,
    position: { ...monster.position, depth: Math.max(BATTLEFIELD.visibleDepth, monster.position.depth - monster.moveSpeed) },
  }));
  const admitted = admitApproaching(next.visible, next.approaching);
  next.visible = admitted.visible;
  next.approaching = admitted.approaching;
  next.round += 1;
  return next;
}
