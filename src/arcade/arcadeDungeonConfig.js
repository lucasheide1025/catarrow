import { generateBranchFloor, generateGridFloor } from "../lib/expeditionGrid";
import {
  ABYSS_DEEP_BOSS,
  ARCADE_BOSS,
  ARCADE_MONSTERS,
  MOON_BOSS,
} from "./arcadeBattle";

export const ARCADE_DUNGEON_CONFIGS = Object.freeze({
  forest: Object.freeze({
    id: "forest",
    name: "貓森遺跡",
    icon: "🌲",
    family: "forest",
    floors: 2,
    roomsPerGrid: 14,
    difficulty: 1,
    rewardMult: 1,
    allowRetreat: false,
    finalBranch: false,
    weights: Object.freeze({
      battle: 18, elite_battle: 3, trap: 4, event: 8, chest: 16, shop: 5, rest: 13,
      quick_event: 9, empty: 5, coin_pouch: 10, mini_chest: 7, scout: 2,
    }),
  }),
  moon: Object.freeze({
    id: "moon",
    name: "月夜迷城",
    icon: "🌙",
    family: "western",
    floors: 3,
    roomsPerGrid: 19,
    difficulty: 2,
    rewardMult: 1.25,
    allowRetreat: true,
    finalBranch: true,
    weights: Object.freeze({
      battle: 22, elite_battle: 9, trap: 9, event: 13, chest: 10, shop: 9, rest: 8,
      quick_event: 7, empty: 3, coin_pouch: 5, mini_chest: 3, scout: 2,
    }),
  }),
  abyss: Object.freeze({
    id: "abyss",
    name: "深淵巢穴",
    icon: "🔥",
    family: "ghost",
    floors: 3,
    roomsPerGrid: 23,
    difficulty: 3,
    rewardMult: 1.65,
    allowRetreat: true,
    finalBranch: true,
    weights: Object.freeze({
      battle: 31, elite_battle: 15, trap: 14, event: 8, chest: 9, shop: 5, rest: 3,
      quick_event: 4, empty: 1, coin_pouch: 4, mini_chest: 4, scout: 2,
    }),
  }),
});

const LABELS = Object.freeze({
  battle: "怪物房", elite_battle: "菁英怪物", trap: "陷阱", event: "事件",
  chest: "寶箱", shop: "商人", rest: "休息處", quick_event: "小事件",
  empty: "寧靜角落", coin_pouch: "金幣袋", mini_chest: "小寶箱", scout: "偵查點",
  boss_battle: "Boss", treasure: "寶藏",
});

function hash01(text) {
  let h = 2166136261;
  const input = String(text || "");
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function seededRandom(seed) {
  let state = Math.max(1, Math.floor(hash01(seed) * 0xffffffff)) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function weightedType(weights, seed) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, value]) => sum + Math.max(0, Number(value) || 0), 0) || 1;
  let cursor = hash01(seed) * total;
  for (const [type, value] of entries) {
    cursor -= Math.max(0, Number(value) || 0);
    if (cursor <= 0) return type;
  }
  return entries[entries.length - 1]?.[0] || "empty";
}

function key(pos) {
  return `${pos.x},${pos.y}`;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function trimConnectedGrid(base, targetCount, seed) {
  const roomByKey = new Map((base.rooms || []).map((room) => [key(room.pos), room]));
  const start = base.startPos;
  const queue = [start];
  const seen = new Set([key(start)]);
  const picked = [];
  while (queue.length && picked.length < Math.max(3, targetCount)) {
    const pos = queue.shift();
    const room = roomByKey.get(key(pos));
    if (room) picked.push(room);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
      .map(([dx,dy]) => ({ x:pos.x+dx, y:pos.y+dy }))
      .filter((next) => roomByKey.has(key(next)) && !seen.has(key(next)))
      .sort((a,b) => hash01(`${seed}:${key(a)}`) - hash01(`${seed}:${key(b)}`));
    dirs.forEach((next) => { seen.add(key(next)); queue.push(next); });
  }
  return picked;
}

function rebuildGrid(base, rooms) {
  const grid = Array.from({ length: base.size }, () => Array(base.size).fill(null));
  rooms.forEach((room) => { grid[room.pos.y][room.pos.x] = room.id; });
  return grid;
}

export function getArcadeDungeonConfig(id) {
  return ARCADE_DUNGEON_CONFIGS[id] || ARCADE_DUNGEON_CONFIGS.forest;
}

export function buildArcadeDungeonFloor(dungeonId, floorIndex = 0, seed = "arcade") {
  const config = getArcadeDungeonConfig(dungeonId);
  const lastFloor = floorIndex >= config.floors - 1;
  if (lastFloor && config.finalBranch) {
    const generated = generateBranchFloor(`${seed}:${dungeonId}:${floorIndex}`);
    const branches = {};
    ["A", "B", "C"].forEach((branchKey) => {
      const source = generated.branches?.[branchKey];
      const rooms = (source?.rooms || []).map((room, index) => {
        const type = weightedType(config.weights, `${seed}:${branchKey}:${index}`);
        return { ...room, type, label: LABELS[type] || room.label || type, cleared:false };
      });
      branches[branchKey] = { ...source, rooms };
    });
    return {
      kind: "branch",
      entrance: generated.entrance,
      branches,
      boss: { ...generated.boss, label: `${config.name} Boss`, cleared:false },
      treasure: { ...generated.treasure, label:"終點寶藏", cleared:false },
    };
  }

  const generated = generateGridFloor(
    Math.min(floorIndex, 1),
    config.difficulty,
    seededRandom(`${seed}:${dungeonId}:${floorIndex}:grid`),
  );
  const selected = trimConnectedGrid(generated, config.roomsPerGrid, `${seed}:${dungeonId}:${floorIndex}`);
  const startRoom = selected.find((room) => room.type === "entrance") || selected[0];
  const terminal = selected
    .filter((room) => room.id !== startRoom.id)
    .sort((a,b) => manhattan(b.pos, startRoom.pos) - manhattan(a.pos, startRoom.pos))[0];

  const rooms = selected.map((room, index) => {
    if (room.id === startRoom.id) return { ...room, type:"entrance", label:"樓層入口", cleared:true };
    if (room.id === terminal?.id) {
      const terminalType = lastFloor ? "boss_battle" : "stairs";
      return { ...room, type:terminalType, label:lastFloor ? `${config.name} Boss` : "前往下一層", cleared:false };
    }
    const type = weightedType(config.weights, `${seed}:${dungeonId}:${floorIndex}:${room.id}:${index}`);
    return { ...room, type, label:LABELS[type] || type, cleared:false };
  });
  const stairsOrBoss = rooms.find((room) => room.id === terminal?.id);
  return {
    kind:"grid",
    size:generated.size,
    grid:rebuildGrid(generated, rooms),
    rooms,
    startPos:{ ...startRoom.pos },
    stairsPos:stairsOrBoss?.type === "stairs" ? { ...stairsOrBoss.pos } : null,
    bossPos:stairsOrBoss?.type === "boss_battle" ? { ...stairsOrBoss.pos } : null,
  };
}

const BOSS_BY_DUNGEON = Object.freeze({ forest:ARCADE_BOSS, moon:MOON_BOSS, abyss:ABYSS_DEEP_BOSS });
const BASE_SCALE = Object.freeze({ forest:1, moon:1.25, abyss:1.55 });
const TYPE_SCALE = Object.freeze({ battle:1, elite_battle:1.45, boss_battle:2.1 });

export function buildArcadeVisitorMonster(dungeonId, floorIndex = 0, roomType = "battle", seed = "monster") {
  const config = getArcadeDungeonConfig(dungeonId);
  const isBoss = roomType === "boss_battle";
  if (isBoss) {
    const identity = BOSS_BY_DUNGEON[config.id] || ARCADE_BOSS;
    const floorScale = 1 + floorIndex * 0.12;
    return {
      ...identity,
      id:`${config.id}_boss_f${floorIndex + 1}`,
      hp:Math.round(105 * BASE_SCALE[config.id] * TYPE_SCALE.boss_battle * floorScale),
      atk:Math.round(5 * BASE_SCALE[config.id] * floorScale),
      def:Math.max(1, Math.round(BASE_SCALE[config.id] + floorIndex * 0.5)),
      rewardCoins:Math.round(70 * config.rewardMult * floorScale),
      ability:"boss",
      visitorCombatProfile:true,
    };
  }
  const identity = ARCADE_MONSTERS[Math.floor(hash01(`${seed}:${dungeonId}:${floorIndex}:${roomType}`) * ARCADE_MONSTERS.length)] || ARCADE_MONSTERS[0];
  const typeScale = TYPE_SCALE[roomType] || 1;
  const floorScale = 1 + floorIndex * 0.14;
  return {
    ...identity,
    id:`${config.id}_${roomType}_f${floorIndex + 1}_${identity.id}`,
    name:roomType === "elite_battle" ? `菁英${identity.name}` : identity.name,
    hp:Math.round(48 * BASE_SCALE[config.id] * typeScale * floorScale),
    atk:Math.max(3, Math.round(4 * BASE_SCALE[config.id] * typeScale * floorScale)),
    def:Math.max(0, Math.round((BASE_SCALE[config.id] - 0.8) * typeScale + floorIndex * 0.4)),
    rewardCoins:Math.round(18 * config.rewardMult * typeScale * floorScale),
    ability:roomType === "elite_battle" ? (identity.ability || "power") : (identity.ability || "none"),
    elite:roomType === "elite_battle",
    visitorCombatProfile:true,
  };
}

export function getArcadeSettlementPolicy(dungeonId, outcome, runCoins = 0) {
  const config = getArcadeDungeonConfig(dungeonId);
  const safeCoins = Math.max(0, Math.floor(Number(runCoins) || 0));
  const clear = outcome === "clear";
  const retreat = outcome === "retreat";
  const defeat = outcome === "defeat";
  const canBank = clear || (retreat && config.id === "abyss") || (retreat && config.id === "moon");
  const xpBase = { forest:30, moon:50, abyss:80 }[config.id] || 30;
  return {
    coins:canBank ? safeCoins : 0,
    xp:defeat ? Math.max(12, Math.round(xpBase * 0.55)) : retreat ? Math.round(xpBase * 0.7) : xpBase + 10,
    losesRunCoins:defeat,
    canBank,
  };
}
