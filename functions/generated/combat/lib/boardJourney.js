"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JOURNEY_SHOOTING_TILES = exports.JOURNEY_MAP_META = exports.JOURNEY_MAP_IDS = exports.JOURNEY_DAILY_DICE = exports.BASE_TILE_WEIGHTS = void 0;
exports.applyJourneyMultipliers = applyJourneyMultipliers;
exports.applyShortcutPos = applyShortcutPos;
exports.applyTrapPos = applyTrapPos;
exports.combineRewards = combineRewards;
exports.emptyMapState = emptyMapState;
exports.findNextTile = findNextTile;
exports.generateJourney = generateJourney;
exports.lockedJourneyTier = lockedJourneyTier;
exports.mergeBuffs = mergeBuffs;
exports.nextPos = nextPos;
exports.normalizeVillageBoard = normalizeVillageBoard;
exports.randomSeed = randomSeed;
exports.rollDice = rollDice;
exports.rollJourneyDice = rollJourneyDice;
exports.rollTileType = rollTileType;
exports.seedRandom = seedRandom;
exports.tileWeights = tileWeights;
exports.windingPath = windingPath;
var _boardData = require("./boardData");
// src/lib/boardJourney.js
// 貓貓村探索地圖重製（08-07-village-board-journey-redesign）Phase 1 資料層。
// 7 張直線旅程地圖的「旅程生成」純函式——全部確定性：
// 同一 seed → 同一 length/cells/path（client 顯示與 DB 結算共用同一條路線）。
// 規格見 .trellis/tasks/08-07-village-board-journey-redesign/design.md。

// ── 7 張地圖（沿用採集點＝建築 id）────────────────────────
const JOURNEY_MAP_IDS = exports.JOURNEY_MAP_IDS = _boardData.BOARD_MODES.map(m => m.id);
const JOURNEY_MAP_META = exports.JOURNEY_MAP_META = Object.fromEntries(_boardData.BOARD_MODES.map(m => [m.id, m]));
// 每日補滿（全地圖共用）。⚠️ 與 villageBoardDb.js 的 DAILY_DICE 同值——
// 這裡不 import 它是因為 villageBoardDb 綁 firebase（純模組會拖進依賴）；改值時兩處要同步。
const JOURNEY_DAILY_DICE = exports.JOURNEY_DAILY_DICE = 15;

// 旅程中「需要射箭」的格子：只有怪物格與終點 Boss。
// ⚠️ 採集格（mining）在新旅程中不射箭——踩到直接給資源＋演示畫面。
//    TILE_TYPES.mining.shooting 目前仍為 true，是為了不影響仍在線上的舊版棋盤
//    （Phase 2 換 UI 時一併修正）；新旅程一律以本集合判斷。
const JOURNEY_SHOOTING_TILES = exports.JOURNEY_SHOOTING_TILES = new Set(["monster", "boss"]);

// ── 確定性 PRNG（mulberry32，不需套件）────────────────────
function seedRandom(seed) {
  let a = seed >>> 0 || 1;
  return function next() {
    a |= 0;
    a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── 格子權重（每張地圖可微調家族風味）────────────────────
// 不含 start/boss——那兩個是固定端點（起點 0、終點 length-1）。
const BASE_TILE_WEIGHTS = exports.BASE_TILE_WEIGHTS = {
  material: 18,
  mining: 10,
  monster: 8,
  arrowdew: 7,
  coins: 8,
  gacha: 3,
  potion: 3,
  chest: 6,
  catbond: 4,
  fate: 4,
  opp: 4,
  camp: 4,
  empower: 3,
  catmate: 3,
  trap: 3,
  shortcut: 2,
  market: 2,
  scenery: 8,
  fork: 3,
  // 分岔路口：玩家二選一（穩妥素材路／冒險怪物路）
  cardgacha: 2 // 🃏 抽卡房（08-08）：稀有格，踩到開抽卡（免費 1 張／付費 3 張）
};
const MODE_WEIGHT_TWEAKS = {
  mine: {
    mining: 16
  },
  // 星屑礦坑：礦多
  farm: {
    material: 22,
    scenery: 6
  },
  // 月芽農田：物產豐饒
  harbor: {
    potion: 5,
    arrowdew: 9
  },
  // 霧潮港口：水氣與藥水
  hunting: {
    monster: 11,
    trap: 4
  },
  // 巡林狩獵場：獵物與陷阱
  market: {
    coins: 12,
    gacha: 4,
    market: 3
  },
  // 喧鬧市集：金幣與轉蛋
  warehouse: {
    chest: 9,
    material: 16
  },
  // 古罐倉庫：藏寶多
  archery: {
    arrowdew: 10
  } // 藏金靶場：箭露豐沛
};
function tileWeights(modeId) {
  return {
    ...BASE_TILE_WEIGHTS,
    ...(MODE_WEIGHT_TWEAKS[modeId] || {})
  };
}

// 依權重抽一格
function rollTileType(rnd, modeId) {
  const w = tileWeights(modeId);
  const entries = Object.entries(w);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = rnd() * total;
  for (const [type, v] of entries) {
    r -= v;
    if (r <= 0) return type;
  }
  return entries[entries.length - 1][0];
}

// 分岔路口：從 from 之後找前方最近的目標格（跳過去）。
// 找不到就回傳 null（呼叫端退回固定步數）。maxLookahead 上限避免跑到終點外。
function findNextTile(cells, from, targetTypes, maxLookahead = 15) {
  if (!Array.isArray(cells)) return null;
  const targets = new Set(targetTypes);
  for (let i = (from || 0) + 1; i <= Math.min(cells.length - 1, (from || 0) + maxLookahead); i += 1) {
    if (targets.has(cells[i])) return i;
  }
  return null;
}

// ── 一次旅程：同 seed 恆等 ────────────────────────────────
// 回傳 { modeId, seed, length, cells:["start",...,"boss"], path:[{x,y}] }
function generateJourney(modeId, seed) {
  const rnd = seedRandom(seed);
  const length = 100 + Math.floor(rnd() * 101); // 100~200
  const cells = ["start"];
  for (let i = 1; i < length - 1; i += 1) cells.push(rollTileType(rnd, modeId));
  cells.push("boss");
  const path = windingPath(length, rnd);
  return {
    modeId,
    seed,
    length,
    cells,
    path
  };
}

// ── 蜿蜒幾何：水平為主、分段折返 ──────────────────────────
// 每段 6~10 格直線、上下兩條主線（y=1 / y=3）交替＋每段 -1~1 微起伏。
// path[i] = { x:i, y }——x 單調遞增，UI 直接照座標絕對定位、橫向捲動。
function windingPath(length, rnd) {
  const path = [];
  let x = 0,
    row = 0,
    remaining = length;
  while (remaining > 0) {
    const segLen = Math.min(remaining, 6 + Math.floor(rnd() * 5)); // 6~10
    row += 1;
    const rowY = row % 2 === 1 ? 1 : 3; // 上下兩條主線
    const jitter = Math.floor(rnd() * 3) - 1; // -1~1 微起伏
    for (let k = 0; k < segLen; k += 1) {
      path.push({
        x,
        y: rowY + jitter
      });
      x += 1;
    }
    remaining -= segLen;
  }
  return path;
}

// ── 旅程位置／獎勵數學（純函式，DB 與 UI 共用）──────────────
function nextPos(pos = 0, roll = 0, length = 0) {
  return Math.max(0, Math.min(Math.max(0, length - 1), pos + roll));
}
function applyTrapPos(pos = 0, length = 0, back = 0) {
  return Math.max(0, Math.min(Math.max(0, length - 1), pos - back));
}
function applyShortcutPos(pos = 0, length = 0, ahead = 0) {
  return Math.max(0, Math.min(Math.max(0, length - 1), pos + ahead));
}
// 🎲 探索骰子 1~15（08-07 玩家要求）：一趟 100~200 格，1~6 太慢、擲 15 顆也不太動；
// 改大骰讓推進有感。上限 15 刻意「可能一格都不到終點的一半」，保留旅程長度感。
function rollDice() {
  return 1 + Math.floor(Math.random() * 15);
}
// 多骰（強化格 diceCount buff）：一次擲 count 顆骰子，回傳每顆與總和（單人/組隊共用）。
// count 夾在 1~MAX_DICE_COUNT（防呆）；單顆＝既有 rollDice 行為。
function rollJourneyDice(count = 1) {
  const n = Math.min(_boardData.MAX_DICE_COUNT, Math.max(1, Number(count) || 1));
  const rolls = Array.from({
    length: n
  }, () => rollDice());
  return {
    rolls,
    total: rolls.reduce((a, b) => a + b, 0)
  };
}
function randomSeed() {
  return 1 + Math.floor(Math.random() * 0x7ffffffe);
}

// 加成疊加規則（重踩同種 buff 格累積，不是覆寫）——上限常數在 boardData.js 與文案共用。
function round2(n) {
  return Math.round(n * 100) / 100;
}

// 合併 buff 格（camp/empower/catmate）的 buffs 到旅程狀態
// reward 可帶 reward.buffs（campMult/catmate）與 reward.nextShootMult
// ⚠️ 同類疊加：campMult/nextShootMult 相乘、catmate 為層數（+5%/層）——
//    舊資料的 catmate:true 視為 1 層（Number(true)=1），自然相容。
function mergeBuffs(existing = {}, reward = {}) {
  const out = {
    ...existing
  };
  const b = reward.buffs || {};
  if (b.campMult != null) out.campMult = round2(Math.min(_boardData.MAX_CAMP_MULT, (Number(out.campMult) || 1) * b.campMult));
  if (b.catmate === true) out.catmate = Math.min(_boardData.MAX_CATMATE_STACKS, (Number(out.catmate) || 0) + 1);
  if (reward.nextShootMult != null) out.nextShootMult = Math.min(_boardData.MAX_SHOOT_MULT, (Number(out.nextShootMult) || 1) * reward.nextShootMult);
  // 多骰：跟其他加成一樣「已有就疊加」（08-07 玩家要求）——骰子數相加、上限 MAX_DICE_COUNT。
  // 例：已有 2 骰再抽到 2 骰 → 下一次擲 4 顆；抽到 3 骰 → 下一次擲 5 顆但夾到 4。
  if (reward.diceCount != null) out.diceCount = Math.min(_boardData.MAX_DICE_COUNT, (Number(out.diceCount) || 0) + (Number(reward.diceCount) || 0));
  return out;
}

// 套用旅程 buff 倍率：shootMult（強化，含金幣/箭露/貓XP/資源）、
// campMult（營地，只乘村資源）。返回值為新的 reward（不原地修改）。
function applyJourneyMultipliers(reward, {
  shootMult = 1,
  campMult = 1
} = {}) {
  if (shootMult === 1 && campMult === 1) return reward;
  const out = {
    ...reward
  };
  if (shootMult !== 1) {
    if (out.coins) out.coins = Math.max(1, Math.round(out.coins * shootMult));
    if (out.arrowdew) out.arrowdew = Math.max(1, Math.round(out.arrowdew * shootMult));
    if (out.catXP) out.catXP = Math.max(1, Math.round(out.catXP * shootMult));
  }
  if (out.villageResources) {
    const v = {};
    for (const [k, n] of Object.entries(out.villageResources)) {
      v[k] = Math.max(1, Math.round(n * campMult * shootMult));
    }
    out.villageResources = v;
  }
  return out;
}

// 合併兩個 reward descriptor（採集 C 混合選項用）
function combineRewards(a = {}, b = {}) {
  const out = {
    coins: (a.coins || 0) + (b.coins || 0),
    arrowdew: (a.arrowdew || 0) + (b.arrowdew || 0),
    gachaToken: (a.gachaToken || 0) + (b.gachaToken || 0),
    catXP: (a.catXP || 0) + (b.catXP || 0),
    catBond: (a.catBond || 0) + (b.catBond || 0),
    villageResources: {
      ...(a.villageResources || {})
    },
    familyMaterials: {
      ...(a.familyMaterials || {})
    },
    potions: [...(a.potions || []), ...(b.potions || [])],
    chests: [...(a.chests || []), ...(b.chests || [])]
  };
  for (const [k, n] of Object.entries(b.villageResources || {})) out.villageResources[k] = (out.villageResources[k] || 0) + n;
  for (const [k, n] of Object.entries(b.familyMaterials || {})) out.familyMaterials[k] = (out.familyMaterials[k] || 0) + n;
  return out;
}

// ── per-map 資料模型（純函式，DB 寫入前先過這裡）────────────
// tier：進場選的階級（0＝未選，結算時退回建築上限）
function emptyMapState() {
  return {
    seed: 0,
    pos: 0,
    length: 0,
    clears: 0,
    tier: 0,
    buffs: {}
  };
}

// 階級鎖定：地圖選好 T 幾就固定到走完（08-07 玩家需求）。
// length>0 表示旅程已開走（含完成後自動重開的新一趟）→ 鎖定既有 tier；
// 只有「還沒開始（length=0）」或「舊資料沒記錄過 tier（遷移前）」才接受新選值。
function lockedJourneyTier(mapState = {}, pickedTier) {
  if (!mapState || !mapState.length) return pickedTier; // 未開始 → 用新選的
  return mapState.tier || pickedTier || 1; // 進行中 → 鎖定；無 tier 舊資料才接受新選
}

// 標準化 members.villageBoard：補齊 7 圖欄位＋舊單一狀態遷移。
// 遷移規則：舊 boardPos 塞進「舊 mode 那張圖」的 pos（length 用舊棋盤 28），
// lapCount 併入該圖 clears。⚠️ 「只保留一次」的保證在**寫入邊界**——
// DB 層寫入 maps 後應清掉 boardPos/lapCount/mode 舊欄位，否則每次 normalize 都會重塞
// 過時的 boardPos（冪等但可能蓋掉玩家已完成的新旅程）。
function normalizeVillageBoard(vb = {}) {
  // ⚠️ hasLegacy 要排除「每日重置的假資料」：ensureDailyDice 每天寫 boardPos:0/lapCount:0，
  //    若把 0 當 legacy 遷移，全新玩家會被誤判成「舊 mode 那張圖已開始」。
  const hasLegacy = typeof vb.boardPos === "number" && (vb.boardPos > 0 || (vb.lapCount || 0) > 0);
  const legacyMode = vb.mode && JOURNEY_MAP_META[vb.mode] ? vb.mode : null;
  const maps = {};
  for (const id of JOURNEY_MAP_IDS) {
    const m = emptyMapState();
    const old = vb.maps && vb.maps[id];
    if (old) {
      Object.assign(m, old);
      if (!m.buffs || typeof m.buffs !== "object") m.buffs = {};
    } else if (hasLegacy && legacyMode === id) {
      // 舊棋盤 28 格＝一趟舊「圈」：保留位置、種子與圈數
      m.pos = vb.boardPos || 0;
      m.length = 28;
      m.seed = vb.boardSeed || 0;
      m.clears = vb.lapCount || 0;
    }
    maps[id] = m;
  }
  return {
    dice: vb.dice ?? JOURNEY_DAILY_DICE,
    diceGrantedDate: vb.diceGrantedDate || "",
    maps,
    pendingEvent: vb.pendingEvent || null
  };
}
