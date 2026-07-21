// src/zombie/domain/mapEngine.js
// ═══════════════════════════════════════════════════════════════
//  🗺️ 殭屍生存 — 地圖探索引擎（純函數）
//  隨機節點地圖生成 + 5 區探索邏輯 + 地圖揭示
// ═══════════════════════════════════════════════════════════════

import { ZONE_TYPE, ZONE_ENCOUNTER_RATES } from "./types";

// ═════════════════════════════════════════════════════════════
//  事件類型
// ═════════════════════════════════════════════════════════════

export const MAP_EVENT = {
  NODE_VISITED:     "node_visited",
  NODE_REVEALED:    "node_revealed",
  ENCOUNTER_TRIGGER:"encounter_trigger",
  MOVED:            "moved",
  EXTRACTION_FOUND: "extraction_found",
  BOSS_SIGHTED:     "boss_sighted",
  MAP_PURCHASED:    "map_purchased",
  INTEL_CHANGED:    "intel_changed",
};

// ═════════════════════════════════════════════════════════════
//  地點類型池（依場景決定戰鬥機率與戰利品傾向）
// ═════════════════════════════════════════════════════════════

/**
 * @typedef {object} LocationType
 * @property {string}  id
 * @property {string}  label       — 含 emoji 的顯示名稱
 * @property {string}  zoneType    — ZONE_TYPE 其一
 * @property {number}  combatChance — 0-1 進入此節點時觸發戰鬥的機率
 * @property {string}  lootHint    — 戰利品提示（UI 顯示用）
 * @property {boolean} isSafeZone
 * @property {boolean} [bossGuarded]
 * @property {number}  weight      — 選取權重（越高越常見）
 */

/** 所有可用地點類型 */
export const LOCATION_TYPES = [
  {
    id: "supermarket",
    label: "🏪 超市",
    zoneType: ZONE_TYPE.NORMAL,
    combatChance: 0.20,
    lootHint: "食物、飲水、日用品",
    isSafeZone: false,
    weight: 20,
  },
  {
    id: "gas_station",
    label: "⛽ 加油站",
    zoneType: ZONE_TYPE.NORMAL,
    combatChance: 0.30,
    lootHint: "燃料、工具、打火機",
    isSafeZone: false,
    weight: 18,
  },
  {
    id: "residential",
    label: "🏠 住宅區",
    zoneType: ZONE_TYPE.NORMAL,
    combatChance: 0.25,
    lootHint: "食物、水、一般物資",
    isSafeZone: false,
    weight: 20,
  },
  {
    id: "hospital",
    label: "🏥 廢棄醫院",
    zoneType: ZONE_TYPE.DANGER,
    combatChance: 0.40,
    lootHint: "醫療包、抑制劑、血清",
    isSafeZone: false,
    weight: 15,
  },
  {
    id: "police_station",
    label: "🏢 警察局",
    zoneType: ZONE_TYPE.DANGER,
    combatChance: 0.60,
    lootHint: "武器、彈藥、防具",
    isSafeZone: false,
    weight: 12,
  },
  {
    id: "factory",
    label: "🏭 廢棄工廠",
    zoneType: ZONE_TYPE.DANGER,
    combatChance: 0.45,
    lootHint: "工具、零件、材料",
    isSafeZone: false,
    weight: 14,
  },
  {
    id: "bank",
    label: "🏦 銀行",
    zoneType: ZONE_TYPE.DANGER,
    combatChance: 0.35,
    lootHint: "金幣、保險箱（低機率高價值）",
    isSafeZone: false,
    weight: 10,
  },
  {
    id: "park",
    label: "🌲 森林公園",
    zoneType: ZONE_TYPE.NORMAL,
    combatChance: 0.50,
    lootHint: "草藥、野生食物（有迷路風險）",
    isSafeZone: false,
    weight: 12,
  },
  {
    id: "church",
    label: "⛪ 教堂",
    zoneType: ZONE_TYPE.SAFE,
    combatChance: 0.10,
    lootHint: "醫療、心理補給",
    isSafeZone: true,
    weight: 10,
  },
  {
    id: "pharmacy",
    label: "💊 藥局",
    zoneType: ZONE_TYPE.NORMAL,
    combatChance: 0.25,
    lootHint: "藥品、醫療用品",
    isSafeZone: false,
    weight: 14,
  },
  {
    id: "school",
    label: "🏫 學校",
    zoneType: ZONE_TYPE.NORMAL,
    combatChance: 0.35,
    lootHint: "補給品、工具",
    isSafeZone: false,
    weight: 14,
  },
  {
    id: "underground",
    label: "🚇 地下隧道",
    zoneType: ZONE_TYPE.RESTRICTED,
    combatChance: 0.70,
    lootHint: "特殊零件、隱藏物資",
    isSafeZone: false,
    weight: 8,
  },
];

/**
 * 依權重從地點池中隨機挑選不重複的節點
 * @param {number} count  — 需要挑選的數量
 * @param {object} [filter] — 過濾條件（如 { zoneType, minCombat, maxCombat }）
 * @param {number} [seed]  — 隨機種子
 * @returns {LocationType[]}
 */
function pickRandomLocations(count, filter = {}, seed) {
  let pool = [...LOCATION_TYPES];

  if (filter.zoneType) {
    pool = pool.filter(l => l.zoneType === filter.zoneType);
  }
  if (filter.minCombat !== undefined) {
    pool = pool.filter(l => l.combatChance >= filter.minCombat);
  }
  if (filter.maxCombat !== undefined) {
    pool = pool.filter(l => l.combatChance <= filter.maxCombat);
  }

  // 簡單的種子隨機（若無 seed 則用 Math.random）
  const random = seed != null
    ? seededRandom(seed)
    : () => Math.random();

  const result = [];
  const available = [...pool];

  for (let i = 0; i < count && available.length > 0; i++) {
    const totalWeight = available.reduce((s, l) => s + l.weight, 0);
    let roll = random() * totalWeight;
    let picked = 0;
    for (let j = 0; j < available.length; j++) {
      roll -= available[j].weight;
      if (roll <= 0) { picked = j; break; }
    }
    result.push(available[picked]);
    available.splice(picked, 1);
  }

  return result;
}

/** 簡易線性同餘隨機產生器（含 seed） */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ═════════════════════════════════════════════════════════════
//  節點地圖生成
// ═════════════════════════════════════════════════════════════

/**
 * 生成隨機地圖 — 固定主幹結構 + 隨機地點分支
 *
 * 結構：
 *               start
 *              /     \
 *     leftBranch[0]  rightBranch[0]
 *          |              |
 *     leftBranch[1]  rightBranch[1]
 *          |              |
 *     leftBranch[2]  rightBranch[2]
 *           \            /
 *            bridge ── military_base
 *              |
 *         extraction_heli
 *
 * boss_room 連接到最深層的一個分支末端
 *
 * @param {object} [options]
 * @param {number} [options.seed]       — 隨機種子（同 seed 產生相同地圖）
 * @param {string} [options.difficulty] — "easy"|"normal"|"hard"
 * @returns {{ nodes: Object<string, ZombieMapNode>, mapId: string }}
 */
export function generateMap(options = {}) {
  const { seed, difficulty = "normal" } = options;

  // 依難度決定分支節點數（簡單少一點、困難多一點）
  const branchLength = difficulty === "easy" ? 2 : difficulty === "hard" ? 4 : 3;

  // 從地點池隨機挑選左右分支的節點
  const leftLocations = pickRandomLocations(branchLength, {}, seed);
  // 用 seed+1 讓左右分支不同
  const rightLocations = pickRandomLocations(branchLength, {}, seed != null ? seed + 1 : undefined);

  // 建立左右分支 ID
  const leftIds = leftLocations.map((_, i) => `left_${i}`);
  const rightIds = rightLocations.map((_, i) => `right_${i}`);

  // boss_room 連接到左分支最深處
  const bossParentId = leftIds[leftIds.length - 1];

  const nodes = {};

  // ── 固定節點 ──────────────────────────────────────────

  nodes.start = {
    id: "start",
    label: "🏠 安全屋起點",
    zoneType: ZONE_TYPE.SAFE,
    connectedNodeIds: [leftIds[0], rightIds[0]],
    isExtractionPoint: false,
    isSafeZone: true,
    combatChance: 0,
  };

  nodes.bridge = {
    id: "bridge",
    label: "🌉 大橋",
    zoneType: ZONE_TYPE.DANGER,
    connectedNodeIds: [leftIds[leftIds.length - 1], rightIds[rightIds.length - 1], "military_base", "extraction_heli"],
    isExtractionPoint: true,
    extractionType: "conditional",
    isSafeZone: false,
    combatChance: 0.40,
  };

  nodes.military_base = {
    id: "military_base",
    label: "🏰 軍事基地",
    zoneType: ZONE_TYPE.HIGH_RISK,
    connectedNodeIds: ["bridge"],
    isExtractionPoint: true,
    extractionType: "guaranteed",
    isSafeZone: false,
    bossGuarded: true,
    combatChance: 0.75,
    lootHint: "軍用武器、防具、彈藥箱",
  };

  nodes.boss_room = {
    id: "boss_room",
    label: "👑 王座之間",
    zoneType: ZONE_TYPE.RESTRICTED,
    connectedNodeIds: [bossParentId],
    isExtractionPoint: false,
    isSafeZone: false,
    bossGuarded: true,
    combatChance: 1.0,
  };

  nodes.extraction_heli = {
    id: "extraction_heli",
    label: "🚁 直升機撤離點",
    zoneType: ZONE_TYPE.SAFE,
    connectedNodeIds: ["bridge"],
    isExtractionPoint: true,
    extractionType: "quick",
    isSafeZone: true,
    combatChance: 0,
  };

  // ── 左分支隨機節點 ────────────────────────────────────
  leftLocations.forEach((loc, i) => {
    const id = leftIds[i];
    const prev = i === 0 ? "start" : leftIds[i - 1];
    const next = i === leftIds.length - 1 ? "bridge" : leftIds[i + 1];
    // boss_room 連到左分支最深處
    const extra = i === leftIds.length - 1 ? ["boss_room"] : [];

    nodes[id] = {
      id,
      label: loc.label,
      zoneType: loc.zoneType,
      connectedNodeIds: [prev, next, ...extra],
      isExtractionPoint: false,
      isSafeZone: loc.isSafeZone,
      combatChance: loc.combatChance,
      lootHint: loc.lootHint,
    };
  });

  // ── 右分支隨機節點 ────────────────────────────────────
  rightLocations.forEach((loc, i) => {
    const id = rightIds[i];
    const prev = i === 0 ? "start" : rightIds[i - 1];
    const next = i === rightIds.length - 1 ? "bridge" : rightIds[i + 1];

    nodes[id] = {
      id,
      label: loc.label,
      zoneType: loc.zoneType,
      connectedNodeIds: [prev, next],
      isExtractionPoint: false,
      isSafeZone: loc.isSafeZone,
      combatChance: loc.combatChance,
      lootHint: loc.lootHint,
    };
  });

  const mapId = `map_${seed ?? "rand"}_${Date.now()}`;

  return { nodes, mapId };
}

/**
 * 生成固定地圖（保留舊版相容）
 * @returns {Object<string, ZombieMapNode>}
 */
export function generateFixedMap() {
  return generateMap({ seed: 42, difficulty: "normal" }).nodes;
}

// ═════════════════════════════════════════════════════════════
//  地圖狀態管理
// ═════════════════════════════════════════════════════════════

/**
 * 建立初始地圖狀態
 * @param {string} [mapId="map_default"]
 * @param {object} [options]
 * @param {number} [options.intelAccuracy=70]
 * @param {boolean} [options.mapPurchased=false]
 * @param {number} [options.seed] — 地圖隨機種子（傳入則產生固定種子地圖）
 * @param {string} [options.difficulty] — "easy"|"normal"|"hard"
 * @returns {ZombieMapState}
 */
export function createMapState(mapId = "map_default", options = {}) {
  const { intelAccuracy = 70, mapPurchased = false, seed, difficulty } = options;
  const { nodes } = generateMap({ seed, difficulty });

  const startNode = nodes.start;
  const revealed = new Set([startNode.id]);

  if (startNode.connectedNodeIds) {
    for (const neighborId of startNode.connectedNodeIds) {
      revealed.add(`partial_${neighborId}`);
    }
  }

  return {
    mapId,
    currentNodeId: "start",
    revealedNodeIds: Array.from(revealed),
    nodes: { ...nodes },
    intelAccuracy,
    mapPurchased,
  };
}

/**
 * 購買地圖（揭示所有節點位置）
 * @param {ZombieMapState} mapState
 * @returns {{ mapState: ZombieMapState, events: object[] }}
 */
export function purchaseMap(mapState) {
  if (mapState.mapPurchased) {
    return { mapState, events: [] };
  }

  const allNodeIds = Object.keys(mapState.nodes);
  const events = [{
    type: MAP_EVENT.MAP_PURCHASED,
    payload: { revealedCount: allNodeIds.length },
  }];

  return {
    mapState: {
      ...mapState,
      mapPurchased: true,
      revealedNodeIds: allNodeIds,
      intelAccuracy: Math.min(100, mapState.intelAccuracy + 10),
    },
    events,
  };
}

// ═════════════════════════════════════════════════════════════
//  節點探索
// ═════════════════════════════════════════════════════════════

/**
 * 移動到目標節點
 * @param {ZombieMapState} mapState
 * @param {string} targetNodeId
 * @returns {{ mapState: ZombieMapState, events: object[], valid: boolean, reason?: string, encounterTriggered?: boolean }}
 */
export function moveToNode(mapState, targetNodeId) {
  const currentNode = mapState.nodes[mapState.currentNodeId];
  const targetNode = mapState.nodes[targetNodeId];
  const events = [];

  if (!currentNode || !targetNode) {
    return { mapState, events, valid: false, reason: "node_not_found" };
  }

  if (!currentNode.connectedNodeIds.includes(targetNodeId)) {
    return { mapState, events, valid: false, reason: "not_connected" };
  }

  const revealedSet = new Set(mapState.revealedNodeIds.filter(
    id => !id.startsWith("partial_")
  ));
  revealedSet.add(targetNodeId);
  revealedSet.add(mapState.currentNodeId);

  if (targetNode.connectedNodeIds) {
    for (const neighborId of targetNode.connectedNodeIds) {
      const neighbor = mapState.nodes[neighborId];
      if (neighbor) {
        if (mapState.mapPurchased) {
          revealedSet.add(neighborId);
        } else {
          const partialKey = `partial_${neighborId}`;
          if (!revealedSet.has(neighborId)) {
            revealedSet.add(partialKey);
          }
        }
      }
    }
  }

  events.push({
    type: MAP_EVENT.MOVED,
    payload: { from: mapState.currentNodeId, to: targetNodeId, label: targetNode.label },
  });

  events.push({
    type: MAP_EVENT.NODE_VISITED,
    payload: { nodeId: targetNodeId, label: targetNode.label, zoneType: targetNode.zoneType },
  });

  if (targetNode.isExtractionPoint) {
    events.push({
      type: MAP_EVENT.EXTRACTION_FOUND,
      payload: {
        nodeId: targetNodeId,
        extractionType: targetNode.extractionType,
        label: targetNode.label,
      },
    });
  }

  if (targetNode.bossGuarded) {
    events.push({
      type: MAP_EVENT.BOSS_SIGHTED,
      payload: { nodeId: targetNodeId, label: targetNode.label },
    });
  }

  // ═══ 除錯模式：強制觸發戰鬥（100%） ═══
  // 測試完成後請還原為正常邏輯：
  //   const useCombatChance = targetNode.combatChance !== undefined;
  //   const rate = useCombatChance
  //     ? targetNode.combatChance
  //     : (ZONE_ENCOUNTER_RATES[targetNode.zoneType] || 0);
  //   const encounterTriggered = Math.random() < rate;
  const encounterTriggered = true;
  const useCombatChance = false;
  const rate = 1.0;

  if (encounterTriggered) {
    events.push({
      type: MAP_EVENT.ENCOUNTER_TRIGGER,
      payload: {
        nodeId: targetNodeId,
        zoneType: targetNode.zoneType,
        rate,
        source: useCombatChance ? "location_type" : "zone_base",
      },
    });
  }

  return {
    mapState: {
      ...mapState,
      currentNodeId: targetNodeId,
      revealedNodeIds: Array.from(revealedSet),
    },
    events,
    valid: true,
    encounterTriggered,
  };
}

/**
 * 取得當前節點可到達的相鄰節點
 * @param {ZombieMapState} mapState
 * @returns {ZombieMapNode[]}
 */
export function getReachableNodes(mapState) {
  const currentNode = mapState.nodes[mapState.currentNodeId];
  if (!currentNode) return [];

  return currentNode.connectedNodeIds
    .map(id => mapState.nodes[id])
    .filter(Boolean);
}

/**
 * 檢查是否可以撤離
 * @param {ZombieMapState} mapState
 * @returns {{ canExtract: boolean, extractionType?: string, node?: ZombieMapNode }}
 */
export function canExtract(mapState) {
  const currentNode = mapState.nodes[mapState.currentNodeId];
  if (!currentNode || !currentNode.isExtractionPoint) {
    return { canExtract: false };
  }
  return {
    canExtract: true,
    extractionType: currentNode.extractionType,
    node: currentNode,
  };
}

/**
 * 標記 BOSS 為已清除
 * @param {ZombieMapState} mapState
 * @param {string} nodeId
 * @returns {ZombieMapState}
 */
export function clearBoss(mapState, nodeId) {
  const node = mapState.nodes[nodeId];
  if (!node || !node.bossGuarded) return mapState;

  return {
    ...mapState,
    nodes: {
      ...mapState.nodes,
      [nodeId]: { ...node, bossCleared: true },
    },
  };
}

// ═════════════════════════════════════════════════════════════
//  情報系統
// ═════════════════════════════════════════════════════════════

/**
 * 更新情報正確率
 * @param {ZombieMapState} mapState
 * @param {number} delta
 * @returns {{ mapState: ZombieMapState, events: object[] }}
 */
export function updateIntel(mapState, delta) {
  const newAccuracy = Math.max(0, Math.min(100, mapState.intelAccuracy + delta));
  const events = [{
    type: MAP_EVENT.INTEL_CHANGED,
    payload: { from: mapState.intelAccuracy, to: newAccuracy, delta },
  }];

  return {
    mapState: { ...mapState, intelAccuracy: newAccuracy },
    events,
  };
}

// ═════════════════════════════════════════════════════════════
//  2.5D 等角佈局 — 自動計算每個節點的 grid 座標
// ═════════════════════════════════════════════════════════════

/**
 * 為地圖節點計算等角佈局座標 (gridX, gridY)
 *
 * 佈局規則：
 *   start          → 頂部中央 (3, 0)
 *   left_NNN       → 左側欄 (2, depth)
 *   right_NNN      → 右側欄 (4, depth)
 *   bridge         → 中央收斂點 (3, maxDepth+1)
 *   extraction_heli → bridge 正下方 (3, bridgeDepth+1)
 *   military_base  → 右側 (5, bridgeDepth)
 *   boss_room      → 左側末梢 (1, leftBranchMaxDepth+1)
 *
 * @param {Object<string, ZombieMapNode>} nodes
 * @returns {Object<string, {gridX: number, gridY: number}>}
 */
export function computeNodeLayout(nodes) {
  // BFS 計算 depth
  const depth = {};
  const queue = ["start"];
  depth["start"] = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    const node = nodes[current];
    if (!node) continue;
    for (const neighborId of node.connectedNodeIds) {
      if (depth[neighborId] === undefined && nodes[neighborId]) {
        depth[neighborId] = depth[current] + 1;
        queue.push(neighborId);
      }
    }
  }

  // 找出左右分支的最大深度
  let leftMaxDepth = 0;
  let rightMaxDepth = 0;
  for (const [id, d] of Object.entries(depth)) {
    if (id.startsWith("left_")) leftMaxDepth = Math.max(leftMaxDepth, d);
    if (id.startsWith("right_")) rightMaxDepth = Math.max(rightMaxDepth, d);
  }
  const bridgeDepth = Math.max(leftMaxDepth, rightMaxDepth);

  const positions = {};

  for (const [id, node] of Object.entries(nodes)) {
    const d = depth[id];
    if (d === undefined) continue;

    if (id === "start") {
      positions[id] = { gridX: 3, gridY: 0 };
    } else if (id.startsWith("left_")) {
      positions[id] = { gridX: 2, gridY: d };
    } else if (id.startsWith("right_")) {
      positions[id] = { gridX: 4, gridY: d };
    } else if (id === "bridge") {
      positions[id] = { gridX: 3, gridY: bridgeDepth + 1 };
    } else if (id === "extraction_heli") {
      positions[id] = { gridX: 3, gridY: bridgeDepth + 2 };
    } else if (id === "military_base") {
      positions[id] = { gridX: 5, gridY: bridgeDepth + 1 };
    } else if (id === "boss_room") {
      positions[id] = { gridX: 1, gridY: leftMaxDepth + 1 };
    } else {
      // Fallback: 未知節點置中
      positions[id] = { gridX: 3, gridY: d };
    }
  }

  return positions;
}

// ── 輔助查詢 ──────────────────────────────────────────────

/**
 * 取得節點的顯示標籤（考量揭露狀態）
 * @param {ZombieMapState} mapState
 * @param {string} nodeId
 * @returns {string}
 */
export function getNodeDisplayLabel(mapState, nodeId) {
  const node = mapState.nodes[nodeId];
  if (!node) return "❓ 未知區域";

  const isFullyRevealed = mapState.revealedNodeIds.includes(nodeId);
  const isPartiallyRevealed = mapState.revealedNodeIds.includes(`partial_${nodeId}`);

  if (isFullyRevealed) return node.label;
  if (isPartiallyRevealed) {
    const zoneIcons = { safe:"🟢", normal:"🟡", danger:"🟠", high_risk:"🔴", restricted:"⚫" };
    return `${zoneIcons[node.zoneType] || "❓"} ???`;
  }
  return "❓ 未探索";
}
