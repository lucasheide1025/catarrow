import { buildArcadeDungeonFloor, getArcadeDungeonConfig, getArcadeSettlementPolicy } from "./arcadeDungeonConfig";
import { getArcadePlayerStats } from "./arcadeProgression";

export const ARCADE_DUNGEON_RUNTIME_VERSION = 1;

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roomKey(pos) {
  return `${pos?.x ?? ""},${pos?.y ?? ""}`;
}

function hashInt(text) {
  let h = 2166136261;
  for (const ch of String(text || "")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createArcadeDungeonRuntime({ dungeonId = "forest", runId, profile, sessionRuntime = null } = {}) {
  const config = getArcadeDungeonConfig(dungeonId);
  if (sessionRuntime && sessionRuntime.version === ARCADE_DUNGEON_RUNTIME_VERSION
    && sessionRuntime.runId === runId && sessionRuntime.dungeonId === config.id) {
    return normalizeArcadeDungeonRuntime(sessionRuntime, profile);
  }
  const stats = getArcadePlayerStats(profile);
  const floor = buildArcadeDungeonFloor(config.id, 0, runId || "arcade");
  const startRoom = floor.kind === "grid"
    ? floor.rooms.find(room => room.type === "entrance") || floor.rooms[0]
    : null;
  return {
    version:ARCADE_DUNGEON_RUNTIME_VERSION,
    runId:runId || `local-${Date.now()}`,
    dungeonId:config.id,
    floorIndex:0,
    phase:floor.kind,
    floor,
    playerPos:floor.kind === "grid" ? { ...floor.startPos } : null,
    visitedIds:startRoom ? [startRoom.id] : [],
    clearedIds:startRoom ? [startRoom.id] : [],
    branchChoice:null,
    branchStep:0,
    pendingRoom:null,
    playerHp:stats.maxHp,
    maxHp:stats.maxHp,
    runCoins:0,
    buffs:{ atkMult:1, defMult:1, dmgMult:1, skillChanceBuff:0, monsterHpMult:1, monsterAtkMult:1, hasRevival:false },
    restBonuses:{ atkPct:0, defPct:0 },
    merchantBonuses:{ atkPct:0, defPct:0 },
    boughtEffects:{},
    inventoryDelta:{},
    stats:{ battles:0, kills:0, treasures:0, bestDamage:0, xCount:0, bestFloor:1 },
    inlineToast:null,
    outcome:null,
    result:null,
  };
}

export function normalizeArcadeDungeonRuntime(runtime, profile) {
  if (!runtime) return runtime;
  const base = getArcadePlayerStats(profile);
  const maxHp = Math.max(1, safeNumber(runtime.maxHp, base.maxHp));
  return {
    ...runtime,
    version:ARCADE_DUNGEON_RUNTIME_VERSION,
    playerHp:clamp(safeNumber(runtime.playerHp, maxHp), 0, maxHp),
    maxHp,
    visitedIds:Array.isArray(runtime.visitedIds) ? runtime.visitedIds : [],
    clearedIds:Array.isArray(runtime.clearedIds) ? runtime.clearedIds : [],
    buffs:{ atkMult:1, defMult:1, dmgMult:1, skillChanceBuff:0, monsterHpMult:1, monsterAtkMult:1, hasRevival:false, ...(runtime.buffs || {}) },
    restBonuses:{ atkPct:0, defPct:0, ...(runtime.restBonuses || {}) },
    merchantBonuses:{ atkPct:0, defPct:0, ...(runtime.merchantBonuses || {}) },
    boughtEffects:{ ...(runtime.boughtEffects || {}) },
    inventoryDelta:{ ...(runtime.inventoryDelta || {}) },
    stats:{ battles:0, kills:0, treasures:0, bestDamage:0, xCount:0, bestFloor:1, ...(runtime.stats || {}) },
  };
}

export function getArcadeDungeonPlayerState(runtime, profile) {
  const base = getArcadePlayerStats(profile);
  const atkPct = safeNumber(runtime?.restBonuses?.atkPct) + safeNumber(runtime?.merchantBonuses?.atkPct);
  const defPct = safeNumber(runtime?.restBonuses?.defPct) + safeNumber(runtime?.merchantBonuses?.defPct);
  const atk = Math.max(1, Math.round(base.atk * safeNumber(runtime?.buffs?.atkMult, 1) * (1 + atkPct / 100)));
  const def = Math.max(0, Math.round(base.def * safeNumber(runtime?.buffs?.defMult, 1) * (1 + defPct / 100)));
  return {
    id:profile?.visitorId || "visitor",
    name:profile?.nickname || "訪客射手",
    hp:Math.max(0, safeNumber(runtime?.playerHp, base.maxHp)),
    maxHP:Math.max(1, safeNumber(runtime?.maxHp, base.maxHp)),
    maxHp:Math.max(1, safeNumber(runtime?.maxHp, base.maxHp)),
    atk,
    def,
    buffs:{ ...(runtime?.buffs || {}) },
    restBonuses:{ ...(runtime?.restBonuses || {}) },
    merchantBonuses:{ ...(runtime?.merchantBonuses || {}) },
    alive:safeNumber(runtime?.playerHp, base.maxHp) > 0,
    role:"front",
  };
}

export function getRoomAtPosition(floor, pos) {
  if (!floor || floor.kind !== "grid" || !pos) return null;
  return (floor.rooms || []).find(room => roomKey(room.pos) === roomKey(pos)) || null;
}

export function canMoveToArcadeRoom(runtime, room) {
  if (!runtime?.playerPos || !room?.pos || runtime.floor?.kind !== "grid") return false;
  const distance = Math.abs(room.pos.x - runtime.playerPos.x) + Math.abs(room.pos.y - runtime.playerPos.y);
  return distance === 1;
}

export function markArcadeRoomCleared(runtime, roomId) {
  if (!roomId) return runtime;
  const clearedIds = runtime.clearedIds.includes(roomId) ? runtime.clearedIds : [...runtime.clearedIds, roomId];
  const floor = runtime.floor?.kind === "grid"
    ? { ...runtime.floor, rooms:runtime.floor.rooms.map(room => room.id === roomId ? { ...room, cleared:true } : room) }
    : runtime.floor;
  return { ...runtime, clearedIds, floor, pendingRoom:null, phase:runtime.floor?.kind || "grid" };
}

export function moveArcadeDungeonPlayer(runtime, room) {
  if (!canMoveToArcadeRoom(runtime, room)) return runtime;
  const visitedIds = runtime.visitedIds.includes(room.id) ? runtime.visitedIds : [...runtime.visitedIds, room.id];
  return { ...runtime, playerPos:{ ...room.pos }, visitedIds, inlineToast:null };
}

function addInventoryDelta(inventoryDelta, itemId, count = 1) {
  if (!itemId) return inventoryDelta;
  return { ...inventoryDelta, [itemId]:Math.max(0, safeNumber(inventoryDelta?.[itemId]) + safeNumber(count, 1)) };
}

function applyPercentHp(runtime, fraction) {
  const ratio = Math.abs(fraction) <= 1 ? fraction : fraction / 100;
  return clamp(runtime.playerHp + Math.round(runtime.maxHp * ratio), 0, runtime.maxHp);
}

function chooseRandomEffect(effect, seed) {
  if (!Array.isArray(effect?.random) || effect.random.length === 0) return effect || {};
  const index = hashInt(seed) % effect.random.length;
  return { ...effect, ...effect.random[index], random:undefined };
}

export function applyArcadeDungeonLocalEffect(runtime, payload, seed = "effect") {
  if (!runtime || !payload) return runtime;
  let next = { ...runtime };
  if (payload.type === "heal_pct") {
    next.playerHp = applyPercentHp(next, safeNumber(payload.value));
  } else if (payload.type === "buff_mult") {
    next.buffs = { ...next.buffs, [payload.key]:safeNumber(next.buffs?.[payload.key], 1) * safeNumber(payload.value, 1) };
  } else if (payload.type === "coins") {
    next.runCoins = Math.max(0, Math.floor(safeNumber(next.runCoins) + safeNumber(payload.value)));
  } else if (payload.type === "rest_result") {
    const result = payload.result || {};
    if (result.hp != null) next.playerHp = clamp(safeNumber(result.hp), 0, next.maxHp);
    if (result.restBonuses) next.restBonuses = { ...next.restBonuses, ...result.restBonuses };
    if (result.coinCost) next.runCoins = Math.max(0, next.runCoins - safeNumber(result.coinCost));
  } else if (payload.type === "chest_reward") {
    const reward = payload.reward || {};
    const itemId = reward.material?.id || reward.collectibleItemId || reward.itemId || reward.id || `chest_${reward.type || "reward"}`;
    const count = reward.amount || reward.qty || reward.count || 1;
    next.inventoryDelta = addInventoryDelta(next.inventoryDelta, itemId, count);
    next.stats = { ...next.stats, treasures:safeNumber(next.stats?.treasures) + 1 };
  } else if (payload.type === "event") {
    const event = payload.event || {};
    const cost = event.cost || {};
    if (cost.hp) next.playerHp = applyPercentHp(next, -Math.abs(safeNumber(cost.hp)));
    if (cost.gold) next.runCoins = Math.max(0, next.runCoins - Math.abs(safeNumber(cost.gold)));
    const effect = chooseRandomEffect(event.effect || {}, `${seed}:${event.id || event.title || "event"}`);
    if (effect.hp) next.playerHp = applyPercentHp(next, safeNumber(effect.hp));
    if (effect.gold) next.runCoins = Math.max(0, Math.floor(next.runCoins + safeNumber(effect.gold)));
    if (effect.atk) next.buffs = { ...next.buffs, atkMult:safeNumber(next.buffs.atkMult, 1) * (1 + safeNumber(effect.atk)) };
    if (effect.def) next.buffs = { ...next.buffs, defMult:safeNumber(next.buffs.defMult, 1) * (1 + safeNumber(effect.def)) };
    if (effect.dmg) next.buffs = { ...next.buffs, dmgMult:safeNumber(next.buffs.dmgMult, 1) * (1 + safeNumber(effect.dmg)) };
    if (effect.monsterHp) next.buffs = { ...next.buffs, monsterHpMult:safeNumber(next.buffs.monsterHpMult, 1) * (1 + safeNumber(effect.monsterHp)) };
    if (effect.monsterAtk) next.buffs = { ...next.buffs, monsterAtkMult:safeNumber(next.buffs.monsterAtkMult, 1) * (1 + safeNumber(effect.monsterAtk)) };
    if (effect.item) next.inventoryDelta = addInventoryDelta(next.inventoryDelta, effect.item, 1);
  }
  return next;
}

export function applyArcadeDungeonShopItem(runtime, item) {
  if (!runtime || !item || safeNumber(runtime.runCoins) < safeNumber(item.cost)) return runtime;
  let next = { ...runtime, runCoins:Math.max(0, runtime.runCoins - safeNumber(item.cost)) };
  if (item.kind === "instant_heal" || item.effect === "hp_restore") {
    next.playerHp = clamp(next.playerHp + Math.round(next.maxHp * safeNumber(item.value)), 0, next.maxHp);
  } else if (item.kind === "magic_weapon" || item.effect === "dungeon_atk") {
    next.merchantBonuses = { ...next.merchantBonuses, atkPct:Math.max(safeNumber(next.merchantBonuses?.atkPct), safeNumber(item.pct, safeNumber(item.value) * 100)) };
  } else if (item.kind === "magic_armor" || item.effect === "dungeon_def") {
    next.merchantBonuses = { ...next.merchantBonuses, defPct:Math.max(safeNumber(next.merchantBonuses?.defPct), safeNumber(item.pct, safeNumber(item.value) * 100)) };
  } else if (item.effect === "revival") {
    next.buffs = { ...next.buffs, hasRevival:true };
  } else if (item.kind === "carry_potion" && item.potionId) {
    next.inventoryDelta = addInventoryDelta(next.inventoryDelta, item.potionId, 1);
  } else if (item.kind === "material_chest") {
    next.inventoryDelta = addInventoryDelta(next.inventoryDelta, `material_chest_${item.family || "unknown"}_t${item.tier || 1}`, 1);
  }
  const effectKey = item.group || item.id;
  next.boughtEffects = { ...next.boughtEffects, [effectKey]:item.id };
  return next;
}

export function resolveArcadeInlineRoom(runtime, room, rewardMult = 1) {
  if (!room || runtime.clearedIds.includes(room.id)) return runtime;
  let next = { ...runtime };
  const base = Math.max(1, safeNumber(rewardMult, 1));
  let toast = { key:`${room.id}:${Date.now()}`, icon:"🐾", title:room.label || "探索完成", badges:[] };
  if (room.type === "coin_pouch") {
    const coins = Math.round(18 * base);
    next.runCoins += coins;
    toast = { ...toast, icon:"🪙", title:"撿到金幣", badges:[`+${coins} 金幣`] };
  } else if (room.type === "mini_chest") {
    const coins = Math.round(12 * base);
    next.runCoins += coins;
    next.inventoryDelta = addInventoryDelta(next.inventoryDelta, "arcade_mini_chest", 1);
    next.stats = { ...next.stats, treasures:safeNumber(next.stats.treasures) + 1 };
    toast = { ...toast, icon:"📦", title:"找到小寶箱", badges:[`+${coins} 金幣`, "小寶箱 ×1"] };
  } else if (room.type === "quick_event") {
    const good = hashInt(`${runtime.runId}:${room.id}`) % 2 === 0;
    if (good) {
      next.playerHp = clamp(next.playerHp + Math.round(next.maxHp * 0.08), 0, next.maxHp);
      toast = { ...toast, icon:"✨", title:"貓咪的祝福", badges:["HP +8%"] };
    } else {
      const coins = Math.round(10 * base);
      next.runCoins += coins;
      toast = { ...toast, icon:"🪙", title:"路邊的小驚喜", badges:[`+${coins} 金幣`] };
    }
  } else if (room.type === "scout") {
    next.buffs = { ...next.buffs, dmgMult:safeNumber(next.buffs.dmgMult, 1) * 1.05 };
    toast = { ...toast, icon:"🔭", title:"偵查完成", badges:["本趟傷害 +5%"] };
  } else {
    toast = { ...toast, icon:"🌿", title:"稍作探索", badges:["沒有危險"] };
  }
  next = markArcadeRoomCleared(next, room.id);
  return { ...next, inlineToast:toast, phase:"grid" };
}

export function enterArcadeDungeonRoom(runtime, room, extras = {}) {
  if (!room || runtime.clearedIds.includes(room.id)) return runtime;
  return { ...runtime, phase:"room", pendingRoom:{ ...room, ...extras } };
}

export function getArcadeBranchSequence(runtime) {
  if (runtime?.floor?.kind !== "branch" || !runtime.branchChoice) return [];
  const branch = runtime.floor.branches?.[runtime.branchChoice];
  return [...(branch?.rooms || []), runtime.floor.boss, runtime.floor.treasure].filter(Boolean);
}

export function chooseArcadeDungeonBranch(runtime, choice) {
  if (runtime?.floor?.kind !== "branch" || !runtime.floor.branches?.[choice]) return runtime;
  return { ...runtime, branchChoice:choice, branchStep:0, phase:"branch", pendingRoom:null };
}

export function advanceArcadeDungeonBranch(runtime) {
  const seq = getArcadeBranchSequence(runtime);
  return { ...runtime, branchStep:Math.min(seq.length, safeNumber(runtime.branchStep) + 1), pendingRoom:null, phase:"branch" };
}

export function advanceArcadeDungeonFloor(runtime) {
  const config = getArcadeDungeonConfig(runtime.dungeonId);
  const nextFloorIndex = runtime.floorIndex + 1;
  if (nextFloorIndex >= config.floors) return runtime;
  const floor = buildArcadeDungeonFloor(runtime.dungeonId, nextFloorIndex, runtime.runId);
  const startRoom = floor.kind === "grid" ? floor.rooms.find(room => room.type === "entrance") || floor.rooms[0] : null;
  return {
    ...runtime,
    floorIndex:nextFloorIndex,
    floor,
    phase:floor.kind,
    playerPos:floor.kind === "grid" ? { ...floor.startPos } : null,
    visitedIds:startRoom ? [startRoom.id] : [],
    clearedIds:startRoom ? [startRoom.id] : [],
    branchChoice:null,
    branchStep:0,
    pendingRoom:null,
    inlineToast:null,
    stats:{ ...runtime.stats, bestFloor:Math.max(safeNumber(runtime.stats?.bestFloor, 1), nextFloorIndex + 1) },
  };
}

export function scaleArcadeDungeonMonsterForRun(monster, runtime) {
  if (!monster) return monster;
  return {
    ...monster,
    hp:Math.max(1, Math.round(safeNumber(monster.hp, 1) * safeNumber(runtime?.buffs?.monsterHpMult, 1))),
    atk:Math.max(0, Math.round(safeNumber(monster.atk) * safeNumber(runtime?.buffs?.monsterAtkMult, 1))),
  };
}

export function applyArcadeDungeonBattleRound(runtime, roundResult) {
  const arrows = roundResult?.arrows || [];
  const xCount = arrows.filter(arrow => typeof arrow === "object" && arrow?.displayLabel === "X").length;
  return {
    ...runtime,
    playerHp:clamp(safeNumber(roundResult?.playerHp, runtime.playerHp), 0, runtime.maxHp),
    pendingRoom:runtime.pendingRoom ? {
      ...runtime.pendingRoom,
      battleState:{
        monsterHp:safeNumber(roundResult?.monsterHp, runtime.pendingRoom?.monster?.hp),
        monsterStatuses:roundResult?.monsterStatuses || [],
        roundKey:safeNumber(roundResult?.roundKey),
        ring:roundResult?.ring || runtime.pendingRoom?.battleState?.ring || null,
      },
    } : runtime.pendingRoom,
    stats:{
      ...runtime.stats,
      bestDamage:Math.max(safeNumber(runtime.stats?.bestDamage), safeNumber(roundResult?.dmg) + safeNumber(roundResult?.statusDamage)),
      xCount:safeNumber(runtime.stats?.xCount) + xCount,
    },
  };
}

export function applyArcadeDungeonBattleVictory(runtime, result, rewardCoins = 0) {
  const roomId = runtime.pendingRoom?.id;
  let next = applyArcadeDungeonBattleRound(runtime, result);
  next.runCoins = Math.max(0, Math.floor(next.runCoins + safeNumber(rewardCoins)));
  next.stats = { ...next.stats, battles:safeNumber(next.stats.battles) + 1, kills:safeNumber(next.stats.kills) + 1 };
  if (runtime.floor?.kind === "grid") return markArcadeRoomCleared(next, roomId);
  return advanceArcadeDungeonBranch({ ...next, pendingRoom:null, phase:"branch" });
}

export function buildArcadeDungeonSettlement(runtime, outcome) {
  const policy = getArcadeSettlementPolicy(runtime.dungeonId, outcome, runtime.runCoins);
  return {
    id:`${runtime.runId}:dungeon`,
    coins:policy.coins,
    xp:policy.xp,
    inventoryDelta:outcome === "defeat" ? {} : { ...(runtime.inventoryDelta || {}) },
    stats:{
      battles:safeNumber(runtime.stats?.battles),
      kills:safeNumber(runtime.stats?.kills),
      treasures:safeNumber(runtime.stats?.treasures),
      bestDamage:safeNumber(runtime.stats?.bestDamage),
      xCount:safeNumber(runtime.stats?.xCount),
      bestFloor:safeNumber(runtime.stats?.bestFloor, runtime.floorIndex + 1),
    },
    policy,
  };
}

export function resultArcadeDungeonRuntime(runtime, outcome, settlement) {
  return {
    ...runtime,
    phase:"result",
    outcome,
    pendingRoom:null,
    result:{ outcome, settlement, finishedAt:Date.now() },
  };
}

export function getArcadeDungeonConfigSummary(runtime) {
  return getArcadeDungeonConfig(runtime?.dungeonId || "forest");
}
