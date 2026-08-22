// src/lib/expeditionGrid.js
// 遠征模式 5×5 格子樓層生成（單人 / 團隊共用，純函式無副作用）
// 第 1、2 層：generateGridFloor — 隨機連通格子（最大 25 格，戰鬥不連續）
// 第 3 層：generateBranchFloor — 入口 → A/B/C 三選一 → 3 抽 + 固定商人 + 休息 → 王 → 寶箱

import { STAGE_ROOM_QUOTA } from "./dungeonData";
import { INLINE_ROOM_META, pickInlineRoomType } from "./dungeonInlineRooms";
import { createDungeonRouteV2 } from "./dungeonRouteV2";

// 地圖擴大為兩倍（2026-08-06）：5×5／20~23 格 → 7×7／40~46 格。
// 地圖是等角 2.5D + 鏡頭跟隨（DungeonStages::MapViewport），放大不需要改 UI。
export const GRID_SIZE = 7;

// 每層房間總數（含入口與樓梯）。與 STAGE_ROOM_QUOTA 一起構成節奏的兩顆旋鈕。
const ROOM_COUNT_RANGE = { min: 40, max: 46 };

// 重量房（要開全螢幕舞台的）的顯示標籤
const STAGE_ROOM_LABELS = {
  battle:       "戰鬥遭遇",
  elite_battle: "精英怪",
  event:        "特殊事件",
  trap:         "陷阱！",
  shop:         "行腳商人",
  chest:        "發現寶箱",
  rest:         "休息區",
};

function shuffle(arr, random = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
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
function growRegion(targetCount, random = Math.random) {
  const start = {
    x: Math.floor(random() * GRID_SIZE),
    y: Math.floor(random() * GRID_SIZE),
  };
  const region = new Map([[posKey(start.x, start.y), start]]);
  let frontier = getAdjacentPositions(start);

  while (region.size < targetCount && frontier.length > 0) {
    const idx = Math.floor(random() * frontier.length);
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

// 樓梯位置：BFS 算出每格離入口的距離，從「夠遠」的格子中隨機挑一格。
//
// ⚠️ 原本用的是「取最遠點」(bfsFarthest)。在幾乎滿版的方形地圖上（20~23/25、40~46/49），
//    最遠點在幾何上**必然是角落** —— 那不是隨機性不足，是數學必然，所以作者才會覺得
//    「樓梯太固定在周圍」。放大到 7×7 只會讓這個性質更明顯（角落更遠）。
//    改成從距離 ≥ maxDist×STAIRS_MIN_DIST_RATIO 的候選中隨機挑，仍保證要走一段路，
//    但落點在中段～外圈之間浮動，每趟都不一樣。
const STAIRS_MIN_DIST_RATIO = 0.75;

function pickStairs(cells, start, random = Math.random) {
  const inRegion = new Set(cells.map(c => posKey(c.x, c.y)));
  const dist = new Map([[posKey(start.x, start.y), 0]]);
  const queue = [start];
  const reached = [];
  let maxDist = 0;
  while (queue.length > 0) {
    const cur = queue.shift();
    const d = dist.get(posKey(cur.x, cur.y));
    if (d > maxDist) maxDist = d;
    if (d > 0) reached.push({ cell: cur, d });
    for (const n of getAdjacentPositions(cur)) {
      const k = posKey(n.x, n.y);
      if (inRegion.has(k) && !dist.has(k)) {
        dist.set(k, d + 1);
        queue.push(n);
      }
    }
  }
  if (reached.length === 0) return start;
  const threshold = Math.ceil(maxDist * STAIRS_MIN_DIST_RATIO);
  const candidates = reached.filter(r => r.d >= threshold);
  const pool = candidates.length > 0 ? candidates : reached;
  return pool[Math.floor(random() * pool.length)].cell;
}

// ── 第 1、2 層：5×5 迷霧格子（最大 25 格，戰鬥不連續） ─────────
export function generateGridFloor(floorIndex, difficultyTier, random = Math.random) {
  const quota = STAGE_ROOM_QUOTA[Math.min(floorIndex, STAGE_ROOM_QUOTA.length - 1)] || STAGE_ROOM_QUOTA[0];
  const roomCount = ROOM_COUNT_RANGE.min
    + Math.floor(random() * (ROOM_COUNT_RANGE.max - ROOM_COUNT_RANGE.min + 1));
  const { start, cells } = growRegion(roomCount, random);
  const stairs = pickStairs(cells, start, random);

  const startKey = posKey(start.x, start.y);
  const stairsKey = posKey(stairs.x, stairs.y);
  const otherCells = cells.filter(c => {
    const k = posKey(c.x, c.y);
    return k !== startKey && k !== stairsKey;
  });

  // ① 先照配額擺重量房（數量固定，不隨地圖大小浮動）
  const types = [];
  for (const [type, count] of Object.entries(quota)) {
    for (let i = 0; i < count && types.length < otherCells.length; i += 1) {
      types.push({ type, label: STAGE_ROOM_LABELS[type] || type });
    }
  }

  // ② 剩下的格子全部給輕量房（踩到就結算、不離開地圖）
  //    地圖擴大多出來的空間都在這裡消化，重量房的絕對數量因此不變。
  while (types.length < otherCells.length) {
    const type = pickInlineRoomType(random);
    types.push({ type, label: INLINE_ROOM_META[type]?.label || type });
  }

  let assigned = shuffle(types, random).slice(0, otherCells.length);

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
export function generateBranchFloor(seed = `route-${Date.now()}-${Math.random()}`) {
  const branches = {};
  for (const key of ["A", "B", "C"]) {
    const randomRooms = shuffle([
      { type: "chest", label: "寶箱房" },
      { type: "trap", label: "陷阱房" },
      { type: "event", label: "事件房" },
      { type: "elite_battle", label: "精英房" },
    ]).slice(0, 3);
    const assigned = [
      ...randomRooms,
      { type: "rest", label: "休息區" },
      { type: "shop", label: "商人區" },
    ];
    const rooms = assigned.map((r, i) => ({
      id: `b${key}r${i}`,
      type: r.type,
      label: r.label,
      cleared: false,
    }));

    branches[key] = { key, ...BRANCH_META[key], rooms };
  }

  return {
    routeVersion: 2,
    route: createDungeonRouteV2(seed),
    entrance: { id: "b_entrance", type: "entrance", label: "王關入口", cleared: true },
    branches,
    boss: { id: "b_boss", type: "boss_battle", label: "Boss", cleared: false },
    treasure: { id: "b_treasure", type: "treasure", label: "寶藏房", cleared: false },
  };
}

export function getBranchMapLayout() {
  return {
    branchRoomRows: [1, 2, 3, 4, 5],
    bossRow: 6,
    treasureRow: 7,
  };
}
