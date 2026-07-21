// src/lib/expeditionGrid.js
// 遠征模式 5×5 格子樓層生成（單人 / 團隊共用，純函式無副作用）
// 第 1、2 層：generateGridFloor — 隨機連通格子（最大 25 格，戰鬥不連續）
// 第 3 層：generateBranchFloor — 入口 → A/B/C 三選一 → 3 抽 + 固定商人 + 休息 → 王 → 寶箱

import { EXCAVATION_FLOOR_CONFIG } from "./dungeonData";

export const GRID_SIZE = 5;

// 權重表 key（EXCAVATION_FLOOR_CONFIG.roomTypes）→ 房間類型
const WEIGHT_ROOM_MAP = {
  monsters:       { type: "battle",        label: "戰鬥遭遇" },
  events:         { type: "event",         label: "特殊事件" },
  general_events: { type: "general_event", label: "一般事件" },
  traps:          { type: "trap",          label: "陷阱！" },
  merchants:      { type: "shop",          label: "行腳商人" },
  chests:         { type: "chest",         label: "發現寶箱" },
  rest:           { type: "rest",          label: "休息區" },
};

function pickWeightedKey(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, v]) => s + v.weight, 0);
  let r = Math.random() * total;
  for (const [key, val] of entries) {
    r -= val.weight;
    if (r <= 0) return key;
  }
  return entries[0][0];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function posKey(x, y) {
  return `${x},${y}`;
}

export function isAdjacent(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function getAdjacentPositions(pos) {
  return [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x, y: pos.y - 1 },
  ].filter(p => p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE);
}

// 生成樹式區域擴張：從隨機起點開始，每次從邊界隨機挑一格併入，保證所有格子連通
function growRegion(targetCount) {
  const start = {
    x: Math.floor(Math.random() * GRID_SIZE),
    y: Math.floor(Math.random() * GRID_SIZE),
  };
  const region = new Map([[posKey(start.x, start.y), start]]);
  let frontier = getAdjacentPositions(start);

  while (region.size < targetCount && frontier.length > 0) {
    const idx = Math.floor(Math.random() * frontier.length);
    const cell = frontier.splice(idx, 1)[0];
    const key = posKey(cell.x, cell.y);
    if (region.has(key)) continue;
    region.set(key, cell);
    for (const n of getAdjacentPositions(cell)) {
      if (!region.has(posKey(n.x, n.y))) frontier.push(n);
    }
  }
  return { start, cells: [...region.values()] };
}

// BFS 找離起點最遠的格子（放樓梯）
function bfsFarthest(cells, start) {
  const inRegion = new Set(cells.map(c => posKey(c.x, c.y)));
  const dist = new Map([[posKey(start.x, start.y), 0]]);
  const queue = [start];
  let farthest = start;
  let maxDist = 0;
  while (queue.length > 0) {
    const cur = queue.shift();
    const d = dist.get(posKey(cur.x, cur.y));
    if (d > maxDist) { maxDist = d; farthest = cur; }
    for (const n of getAdjacentPositions(cur)) {
      const k = posKey(n.x, n.y);
      if (inRegion.has(k) && !dist.has(k)) {
        dist.set(k, d + 1);
        queue.push(n);
      }
    }
  }
  return farthest;
}

// ── 第 1、2 層：5×5 迷霧格子（最大 25 格，戰鬥不連續） ─────────
export function generateGridFloor(floorIndex, difficultyTier) {
  const config = EXCAVATION_FLOOR_CONFIG[Math.min(floorIndex, 1)] || EXCAVATION_FLOOR_CONFIG[0];
  // 地圖擴大：20 ~ 23 格 (接近 25 格滿版)
  const roomCount = 20 + Math.floor(Math.random() * 4);
  const { start, cells } = growRegion(roomCount);
  const stairs = bfsFarthest(cells, start);

  const startKey = posKey(start.x, start.y);
  const stairsKey = posKey(stairs.x, stairs.y);
  const otherCells = cells.filter(c => {
    const k = posKey(c.x, c.y);
    return k !== startKey && k !== stairsKey;
  });

  // 根據權重隨機挑選房型
  const types = [];
  // 第 2 層保底 1 精英
  if (floorIndex === 1) {
    types.push({ type: "elite_battle", label: "精英怪" });
  }
  while (types.length < otherCells.length) {
    const key = pickWeightedKey(config.roomTypes);
    const meta = WEIGHT_ROOM_MAP[key] || WEIGHT_ROOM_MAP.general_events;
    types.push({ ...meta });
  }

  let assigned = shuffle(types).slice(0, otherCells.length);

  // 防呆與修復：戰鬥不連續 (避免兩間戰鬥房相鄰)
  for (let i = 0; i < otherCells.length; i++) {
    const c1 = otherCells[i];
    const t1 = assigned[i]?.type;
    if (t1 === "battle" || t1 === "elite_battle") {
      // 檢查是否與任何已放置的相鄰戰鬥房衝突
      const hasAdjacentBattle = otherCells.some((c2, j) => {
        if (i === j) return false;
        const t2 = assigned[j]?.type;
        return (t2 === "battle" || t2 === "elite_battle") && isAdjacent(c1, c2);
      });
      if (hasAdjacentBattle) {
        // 尋找一個非戰鬥房間進行交換
        const swapIdx = assigned.findIndex((t, j) => {
          if (j === i) return false;
          if (t.type === "battle" || t.type === "elite_battle") return false;
          // 交換後確保新位置也不與戰鬥相鄰
          const targetCell = otherCells[j];
          const neighborHasBattle = otherCells.some((c3, k) => {
            if (k === j || k === i) return false;
            const t3 = assigned[k]?.type;
            return (t3 === "battle" || t3 === "elite_battle") && isAdjacent(targetCell, c3);
          });
          return !neighborHasBattle;
        });
        if (swapIdx !== -1) {
          [assigned[i], assigned[swapIdx]] = [assigned[swapIdx], assigned[i]];
        }
      }
    }
  }

  const rooms = [
    {
      id: `f${floorIndex}_${start.x}_${start.y}`,
      type: "entrance",
      label: "樓層入口",
      pos: { ...start },
      cleared: true,
    },
    {
      id: `f${floorIndex}_${stairs.x}_${stairs.y}`,
      type: "stairs",
      label: floorIndex >= 1 ? "通往王關" : "通往下一層",
      pos: { ...stairs },
      cleared: false,
    },
    ...otherCells.map((c, i) => ({
      id: `f${floorIndex}_${c.x}_${c.y}`,
      type: assigned[i].type,
      label: assigned[i].label,
      pos: { ...c },
      cleared: false,
    })),
  ];

  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  for (const r of rooms) grid[r.pos.y][r.pos.x] = r.id;

  return {
    size: GRID_SIZE,
    grid,
    rooms,
    startPos: { ...start },
    stairsPos: { ...stairs },
  };
}

export function stripGridForSync(gridFloor) {
  if (!gridFloor) return gridFloor;
  const { grid, ...rest } = gridFloor;
  return rest;
}

// ── 第 3 層：分支王關 ────────────────────────────────────────
const BRANCH_META = {
  A: { label: "左道 · 暗影迴廊", icon: "🌑" },
  B: { label: "中道 · 石像大廳", icon: "🗿" },
  C: { label: "右道 · 熔岩棧道", icon: "🌋" },
};

// 回傳 { entrance, branches:{A,B,C 各 rooms:[3 抽 + 固定商人 + 休息]}, boss, treasure }
export function generateBranchFloor() {
  const floor3Config = EXCAVATION_FLOOR_CONFIG[2]?.roomTypes || {
    monsters: { weight: 30 },
    traps: { weight: 30 },
    events: { weight: 30 },
    general_events: { weight: 10 },
  };

  const branches = {};
  for (const key of ["A", "B", "C"]) {
    const branchTypes = [
      { type: "shop", label: "神秘商人" },
      { type: "rest", label: "休息區" },
    ];
    // 3 格從權重抽
    for (let i = 0; i < 3; i++) {
      const k = pickWeightedKey(floor3Config);
      const meta = WEIGHT_ROOM_MAP[k] || WEIGHT_ROOM_MAP.monsters;
      branchTypes.push({ ...meta });
    }

    const assigned = shuffle(branchTypes);
    const rooms = assigned.map((r, i) => ({
      id: `b${key}r${i}`,
      type: r.type,
      label: r.label,
      cleared: false,
    }));

    branches[key] = { key, ...BRANCH_META[key], rooms };
  }

  return {
    entrance: { id: "b_entrance", type: "entrance", label: "王關入口", cleared: true },
    branches,
    boss: { id: "b_boss", type: "boss_battle", label: "Boss", cleared: false },
    treasure: { id: "b_treasure", type: "treasure", label: "寶藏房", cleared: false },
  };
}
