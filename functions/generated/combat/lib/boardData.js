"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TRAP_EVENTS = exports.TILE_TYPES = exports.SCORE_BAND_MIN_RATIO = exports.MONSTER_BAND_TABLE = exports.MINING_BAND_TABLE = exports.MAX_SHOOT_MULT = exports.MAX_DICE_COUNT = exports.MAX_CATMATE_STACKS = exports.MAX_CAMP_MULT = exports.JOURNEY_BUFF_INFO = exports.BOSS_REWARD_RANGE = exports.BOARD_SIZE = exports.BOARD_MODE_MAP = exports.BOARD_MODES = exports.BOARD_LAYOUT = void 0;
exports.bossDuelState = bossDuelState;
exports.buffActive = buffActive;
exports.buffValueLabel = buffValueLabel;
exports.getModeTierCap = getModeTierCap;
exports.miningBandFor = miningBandFor;
exports.rollTileReward = rollTileReward;
exports.rollTrapEvent = rollTrapEvent;
exports.scoreToBand = scoreToBand;
exports.trapEffectOf = trapEffectOf;
var _catVillageGathering = require("./catVillageGathering");
var _villageData = require("./villageData");
var _monsterEconomyCatalog = require("./monsterEconomyCatalog");
// src/lib/boardData.js
// 貓貓村大富翁：棋盤佈局、6 採集模式、純函式獎勵計算。
// 規格見 docs/second_brain/village-board-spec.md。
//
// 6 模式 ＝ 冒險六大族 ＝ 六經濟體 ＝ 六採集任務（沿用 catVillageGathering 的 GATHERING_SITES）：
//   site.id 同時是「村建築 id」→ getBuildingStage(建築等級) 決定該模式可刷的素材階級上限（T1~T5）。

// ── 6 模式（家族/資源/建築）──────────────────────────────
const BOARD_MODES = exports.BOARD_MODES = _catVillageGathering.GATHERING_SITES.map(s => ({
  id: s.id,
  // 也是村建築 id
  family: s.race,
  // mountain/insect/ghost/workplace/exam/temple
  familyName: s.raceName,
  resource: s.resource,
  // ore/melon/fish/meat/driedfish/can
  resourceName: s.resourceName,
  name: s.name,
  icon: s.icon,
  palette: s.palette
}));
const BOARD_MODE_MAP = exports.BOARD_MODE_MAP = Object.fromEntries(BOARD_MODES.map(m => [m.id, m]));

// 該模式可刷的素材階級上限＝對應建築的 stage（T1~T5；T6 暫維持地下城專屬）
function getModeTierCap(modeId, villageBuildings = {}) {
  const lvl = villageBuildings[modeId] || 1;
  return Math.max(1, Math.min(5, (0, _villageData.getBuildingStage)(lvl)));
}

// ── 格子類型 ─────────────────────────────────────────────
const TILE_TYPES = exports.TILE_TYPES = {
  start: {
    id: "start",
    icon: "🏁",
    label: "起點",
    shooting: false
  },
  material: {
    id: "material",
    icon: "📦",
    label: "素材",
    shooting: false
  },
  mining: {
    id: "mining",
    icon: "⛏️",
    label: "挖礦",
    shooting: true
  },
  monster: {
    id: "monster",
    icon: "👾",
    label: "怪物",
    shooting: true
  },
  arrowdew: {
    id: "arrowdew",
    icon: "💧",
    label: "箭露",
    shooting: false
  },
  coins: {
    id: "coins",
    icon: "🪙",
    label: "金幣",
    shooting: false
  },
  gacha: {
    id: "gacha",
    icon: "🎰",
    label: "扭蛋幣",
    shooting: false
  },
  potion: {
    id: "potion",
    icon: "🧪",
    label: "藥水",
    shooting: false
  },
  // 寶箱格不射箭（2026-07-30 改版）：踩到就直接隨機抽 1~5 箱，階級用進場選的 T。
  chest: {
    id: "chest",
    icon: "🎁",
    label: "寶箱",
    shooting: false
  },
  catbond: {
    id: "catbond",
    icon: "🐱",
    label: "貓咪羈絆",
    shooting: false
  },
  fate: {
    id: "fate",
    icon: "🎴",
    label: "命運",
    shooting: false
  },
  opp: {
    id: "opp",
    icon: "🎴",
    label: "機會",
    shooting: false
  },
  // ── 探索地圖重製新增（08-07-village-board-journey-redesign）────
  // 旅程格：營地/強化/貓夥伴/陷阱/捷徑/市集/風景/終點 Boss
  camp: {
    id: "camp",
    icon: "🏕️",
    label: "營地",
    shooting: false
  },
  empower: {
    id: "empower",
    icon: "✨",
    label: "強化",
    shooting: false
  },
  catmate: {
    id: "catmate",
    icon: "🐾",
    label: "貓夥伴",
    shooting: false
  },
  trap: {
    id: "trap",
    icon: "🕳️",
    label: "陷阱",
    shooting: false
  },
  shortcut: {
    id: "shortcut",
    icon: "🌉",
    label: "捷徑",
    shooting: false
  },
  market: {
    id: "market",
    icon: "🎪",
    label: "市集",
    shooting: false
  },
  scenery: {
    id: "scenery",
    icon: "🌄",
    label: "風景",
    shooting: false
  },
  fork: {
    id: "fork",
    icon: "🔀",
    label: "分岔路",
    shooting: false
  },
  boss: {
    id: "boss",
    icon: "⚔️",
    label: "終點 Boss",
    shooting: true
  },
  // 🃏 抽卡房（08-08）：踩到開抽卡 overlay——免費抽 1 張／付費抽 3 張（金幣），
  //    池＝該 T 階級的「普通怪」卡片（排除小王/大王/世界王）。
  cardgacha: {
    id: "cardgacha",
    icon: "🃏",
    label: "抽卡房",
    shooting: false
  }
};

// 28 格固定環形佈局（index 0 = 起點，順時針）。同類盡量分散。
const BOARD_LAYOUT = exports.BOARD_LAYOUT = ["start", "material", "coins", "mining", "fate", "arrowdew", "material", "monster", "opp", "material", "chest", "gacha", "material", "mining", "catbond", "fate", "material", "coins", "monster", "potion", "material", "opp", "mining", "arrowdew", "chest", "material", "catbond", "monster"];
const BOARD_SIZE = exports.BOARD_SIZE = BOARD_LAYOUT.length; // 28

// ── 陷阱事件（08-08：多種不同事件，不再是單一「後退+扣金」）──
// 每種事件有自己的 icon/label/說明與懲罰（back＝後退格數、loseCoins/loseArrowdew/loseDice）。
// 純函式：rollTrapEvent(tier) 隨機抽一種；trapEffectOf(type, tier) 依型別取懲罰量。
// 單人（settleJourneyTile）與組隊（roomRollAndMove/claimBoardSettle）共用同一張表。
const TRAP_EVENTS = exports.TRAP_EVENTS = [{
  type: "snake",
  icon: "🐍",
  label: "蛇咬！",
  desc: "踩到蛇窩，被咬了一口",
  back: 1,
  loseCoins: [10, 30]
}, {
  type: "quicksand",
  icon: "🟤",
  label: "流沙！",
  desc: "腳陷流沙，費力爬出來",
  back: 3,
  loseArrowdew: [5, 20]
}, {
  type: "thief",
  icon: "🥷",
  label: "竊賊！",
  desc: "被小賊摸走了金幣",
  back: 1,
  loseCoins: [30, 80]
}, {
  type: "dice",
  icon: "🎲",
  label: "骰子被偷！",
  desc: "纏住貓尾巴，骰子滾掉了",
  back: 2,
  loseDice: 1
}, {
  type: "dew",
  icon: "💧",
  label: "箭露灑了！",
  desc: "打翻箭露瓶，漏了一地",
  back: 2,
  loseArrowdew: [15, 50]
}];
const TRAP_TYPE_MAP = Object.fromEntries(TRAP_EVENTS.map(e => [e.type, e]));

// 隨機抽一種陷阱事件（tier 影響懲罰量）
function rollTrapEvent(tier = 1) {
  return trapEffectOf(TRAP_EVENTS[Math.floor(Math.random() * TRAP_EVENTS.length)].type, tier);
}

// 依型別取該事件的懲罰量（back 固定、loseCoins/Arrowdew 隨機區間、loseDice 固定）
function trapEffectOf(type, tier = 1) {
  const t = Math.max(1, Math.min(6, Number(tier) || 1));
  const ev = TRAP_TYPE_MAP[type] || TRAP_EVENTS[0];
  const out = {
    type: ev.type,
    icon: ev.icon,
    label: ev.label,
    desc: ev.desc,
    back: ev.back
  };
  if (ev.loseCoins) out.loseCoins = randInt(ev.loseCoins[0], ev.loseCoins[1]) * t;
  if (ev.loseArrowdew) out.loseArrowdew = randInt(ev.loseArrowdew[0], ev.loseArrowdew[1]) * t;
  if (ev.loseDice) out.loseDice = ev.loseDice;
  return out;
}

// ── 完成度分數帶（6 箭）────────────────────────────────────
// scoreRatio: 0~1（命中總分 / 滿分）。回傳 { band, monsterMult, miningMult, chestCount }
// 這是全地圖「射箭格」的單一分帶真源——怪物格/終點 Boss 都用它，不另立門檻。
// 門檻抽成常數（SCORE_BAND_MIN_RATIO）供說明書/UI 共用，改平衡時文案自動跟上、不漂移。
const SCORE_BAND_MIN_RATIO = exports.SCORE_BAND_MIN_RATIO = {
  S: 0.85,
  A: 0.65,
  B: 0.40
}; // 其餘歸 C
const SCORE_BAND_BONUS = {
  S: {
    monsterMult: 3.0,
    miningMult: 1.8,
    chestCount: 3
  },
  A: {
    monsterMult: 2.0,
    miningMult: 1.5,
    chestCount: 2
  },
  B: {
    monsterMult: 1.5,
    miningMult: 1.2,
    chestCount: 1
  },
  C: {
    monsterMult: 1.0,
    miningMult: 1.0,
    chestCount: 1
  }
};
function scoreToBand(scoreRatio = 0) {
  const r = Math.max(0, Math.min(1, scoreRatio));
  const band = r >= SCORE_BAND_MIN_RATIO.S ? "S" : r >= SCORE_BAND_MIN_RATIO.A ? "A" : r >= SCORE_BAND_MIN_RATIO.B ? "B" : "C";
  return {
    band,
    ...SCORE_BAND_BONUS[band]
  };
}

// ── 怪物格獎勵分層表（6 箭完成度四階）──────────────────────
// 統一四階：S≥85% / A≥65% / B≥40% / C<40%。
// mult＝村資源倍率、mats＝家族素材數、chest＝額外寶箱機率——逐階遞減，
// 不再用舊的「過/不過」二階（當時 threshold 沒傳 → 恆過 → 平獎 ×1.5，S/A 分不出差別）。
const MONSTER_BAND_TABLE = exports.MONSTER_BAND_TABLE = {
  S: {
    mult: 2.0,
    mats: 4,
    chest: 0.40
  },
  A: {
    mult: 1.4,
    mats: 3,
    chest: 0.25
  },
  B: {
    mult: 1.0,
    mats: 2,
    chest: 0.10
  },
  C: {
    mult: 0.6,
    mats: 1,
    chest: 0.0
  }
};

// ── 採集格分層表（進度制，不射箭）──────────────────────────
// gatheringProgress 0~180% → 五階完成度，mult＝村資源倍率。
// 與 C 三選一的實際產出對齊：140(豐收)/100(完成)。
const MINING_BAND_TABLE = exports.MINING_BAND_TABLE = [{
  min: 180,
  label: "大豐收",
  mult: 1.8
}, {
  min: 130,
  label: "豐收",
  mult: 1.5
}, {
  min: 100,
  label: "完成",
  mult: 1.2
}, {
  min: 50,
  label: "半成品",
  mult: 0.8
}, {
  min: 0,
  label: "安慰獎",
  mult: 0.5
}];

// 依 gatheringProgress 查採集分層（純函式，測試用）
function miningBandFor(progressPct) {
  const p = Math.max(0, Math.min(180, Number(progressPct) || 0));
  return MINING_BAND_TABLE.find(t => p >= t.min) || MINING_BAND_TABLE[MINING_BAND_TABLE.length - 1];
}

// ── 終點 Boss 獎勵範圍（rollTileReward boss 分支與說明書共用）──────────
// coins/arrowdew/catXP 為「×T 前」的基底範圍，實際再乘分帶倍率 f
//（S×1.5 / A×1.0 / B×0.75 / C×0.5）；matsBase 為素材基底數，每帶再加
// round(monsterMult×2)（S 12 / A 10 / B 9 / C 8）。改平衡時說明書自動跟上。
const BOSS_REWARD_RANGE = exports.BOSS_REWARD_RANGE = {
  coins: [300, 600],
  arrowdew: [60, 120],
  catXP: [150, 300],
  matsBase: 6
};

// ── 終點 Boss 決戰狀態（BossDuel 演出用；單一真源可測試）──
// score60：6 箭分數 0~60。血條 = 100 − 完成度%（打掉多少 Boss HP）；
// S 帶（≥85%）＝Boss 倒下。獎勵帶與 scoreToBand 同一張表（不另立門檻）。
function bossDuelState(score60) {
  const ratio = Math.min(1, Math.max(0, Number(score60) || 0) / 60);
  const band = scoreToBand(ratio);
  return {
    ratio,
    band: band.band,
    hpLeft: Math.max(0, 100 - ratio * 100),
    downed: ratio >= 0.85
  };
}

// ── 加成疊加上限（與 mergeBuffs 共用；JOURNEY_BUFF_INFO 文案直接吃，改這裡就同步）──
// 營地：每踩一次 村資源 ×1.2 相乘（上限 ×3）
// 強化：每踩一次 下一個射箭格獎勵 ×2 相乘（上限 ×8，打完消耗）
// 貓夥伴：每踩一次 射箭分數 +5% 相加（上限 5 層＝+25%，完成度本來就封頂 100%）
const MAX_CAMP_MULT = exports.MAX_CAMP_MULT = 3;
const MAX_SHOOT_MULT = exports.MAX_SHOOT_MULT = 8;
const MAX_CATMATE_STACKS = exports.MAX_CATMATE_STACKS = 5;
// 多骰疊加上限：踩強化格抽到多骰時相加（2+2=4 顆），上限 4 顆骰（4~60 步，一趟 1/3 左右）。
const MAX_DICE_COUNT = exports.MAX_DICE_COUNT = 4;

// ── 旅程加成說明（buff chips 點開的詳細文案，玩家向）──────────────
// 三種 buff 格（camp/empower/catmate）的顯示與說明共用同一份資料，
// UI（單人/組隊）直接吃這裡，避免兩處文案漂移。
// field＝buffs 物件欄位；icon/name＝頂列短標籤與彈窗標題；desc＝說明彈窗的完整解釋。
const JOURNEY_BUFF_INFO = exports.JOURNEY_BUFF_INFO = [{
  field: "campMult",
  icon: "🏕️",
  name: "營地",
  desc: `每踩到一次：本趟旅程拿到的「村莊資源」（礦石・甜瓜・魚…）再 ×1.2，可疊加（最多 ×${MAX_CAMP_MULT}）。踩兩次＝×1.44。完成旅程後重置。`
}, {
  field: "nextShootMult",
  icon: "✨",
  name: "強化",
  desc: `每踩到一次：下一個「怪物格 或 終點決戰」的獎勵再 ×2（金幣・箭露・貓咪經驗・村資源），可疊加（最多 ×${MAX_SHOOT_MULT}）。打完那場就消耗掉。`
}, {
  field: "diceCount",
  icon: "🎲",
  name: "多骰",
  desc: `踩到強化格時隨機獲得：下一次擲骰骰 2 顆或 3 顆骰子（每顆 1~15），已有則相加（最多 ×${MAX_DICE_COUNT}）。一次移動距離大增，用完就消失。`
}, {
  field: "catmate",
  icon: "🐾",
  name: "貓夥伴",
  desc: `每踩到一次：打怪／終點決戰時，輸入的 6 箭分數再 +5%（最多 +${MAX_CATMATE_STACKS * 5}%），更容易達到 S／A 高獎勵帶（例如 62% 會算成 67%＝A 帶）。`
}];

// 目前疊層的數值標籤（彈窗「啟用中」徽章用）：×1.44 / ×4 / +10% / ×2 骰（裸值，分隔由呼叫端加）
function buffValueLabel(buffs = {}, field) {
  if (field === "campMult") {
    const v = Number(buffs.campMult);
    return v > 1 ? `×${v}` : "";
  }
  if (field === "nextShootMult") {
    const v = Number(buffs.nextShootMult);
    return v > 1 ? `×${v}` : "";
  }
  if (field === "diceCount") {
    const n = Number(buffs.diceCount) || 0;
    return n > 1 ? `×${n} 骰` : "";
  }
  if (field === "catmate") {
    const n = Number(buffs.catmate) || 0;
    return n > 0 ? `+${n * 5}%` : "";
  }
  return "";
}

// 該加成目前是否啟用中（buffs 物件欄位值判定）
function buffActive(buffs = {}, field) {
  if (field === "campMult") return Number(buffs.campMult) > 1;
  if (field === "nextShootMult") return Number(buffs.nextShootMult) > 1;
  if (field === "diceCount") return (Number(buffs.diceCount) || 0) > 1;
  if (field === "catmate") return Boolean(buffs.catmate);
  return false;
}

// ── 小工具 ───────────────────────────────────────────────
function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
// 在 1~cap 加權抽一個階級，權重偏向「選定的高階」（以房主的 T 為主），但仍保留低階變化。
function rollTier(tierCap) {
  const cap = Math.min(6, Math.max(1, tierCap || 1));
  const weights = [];
  for (let t = 1; t <= cap; t++) weights.push({
    t,
    w: t
  }); // 高階權重高 → 以 cap 為主
  const total = weights.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of weights) {
    r -= x.w;
    if (r <= 0) return x.t;
  }
  return cap;
}

// ── 獎勵計算（純函式）────────────────────────────────────
// ctx = { mode:BOARD_MODES項, tierCap, partyMult=1, scoreRatio(射箭格用) }
// 回傳統一 reward descriptor，由 villageBoardDb 套用到 Firestore。
function rollTileReward(tileType, ctx = {}) {
  const {
    mode,
    tierCap = 1,
    partyMult = 1,
    scoreRatio = 0,
    tier
  } = ctx;
  const r = emptyReward();
  const scale = n => Math.max(1, Math.round(n * partyMult));
  // 玩家在前頁選的 tier（上限受建築 stage 限制）；未選則用建築上限
  const T = tier ? Math.max(1, Math.min(tier, tierCap)) : tierCap;
  switch (tileType) {
    case "material":
      {
        // 家族素材 ×3~6（隨機抽多種材料）
        const count = scale(randInt(3, 6));
        addRandomFamilyMat(r, mode.family, T, count);
        break;
      }
    case "mining":
      {
        // 採集進度制（不射箭）：gatheringProgress 0~180% → 五階完成度（MINING_BAND_TABLE）
        // ⚠️ 基底資源也要乘 partyMult（組隊版採集不射箭，8 人房跟單人一樣多不公平）——
        //    單人 partyMult=1 不受影響。
        const progressPct = ctx.gatheringProgress || 0;
        const tierInfo = miningBandFor(progressPct);
        const base = randInt(6, 15);
        r.villageResources[mode.resource] = (r.villageResources[mode.resource] || 0) + Math.max(1, Math.round(base * tierInfo.mult * partyMult));
        if (Math.random() < 0.15) {
          if (Math.random() < 0.5) r.villageResources.fur = (r.villageResources.fur || 0) + scale(1);else addRandomFamilyMat(r, mode.family, T, scale(1));
        }
        r.band = tierInfo.label;
        r.progressPct = Math.max(0, Math.min(180, progressPct));
        break;
      }
    case "monster":
      {
        // 6 箭完成度 → 四階分帶（scoreToBand + MONSTER_BAND_TABLE）判定獎勵大小。
        // 舊邏輯是「過/不過」二階（threshold 沒傳 → 恆過 → 平獎 ×1.5），
        // 已統一成 S/A/B/C：資源 S×2.0/A×1.4/B×1.0/C×0.6、素材 4/3/2/1、寶箱 40%/25%/10%/0%。
        const band = scoreToBand(scoreRatio);
        const tierInfo = MONSTER_BAND_TABLE[band.band] || MONSTER_BAND_TABLE.C;
        const base = randInt(6, 15);
        r.villageResources[mode.resource] = (r.villageResources[mode.resource] || 0) + scale(Math.round(base * tierInfo.mult));
        addRandomFamilyMat(r, mode.family, T, scale(tierInfo.mats));
        if (Math.random() < tierInfo.chest) r.chests.push({
          kind: "family",
          family: mode.family,
          tier: T
        });
        r.band = band.band;
        r.passed = band.band !== "C"; // 相容欄位：組隊版 UI 自己算 passed，這裡僅供參考
        r.threshold = ctx.threshold || 0;
        break;
      }
    case "chest":
      {
        // 不射箭：直接隨機 1~5 箱。階級固定用進場選的 T（不再 rollTier 隨機降階），
        // 「T 幾就給 T 幾」對玩家比較好理解，也讓進場選階真的有意義。
        const chestCount = randInt(1, 5);
        for (let i = 0; i < chestCount; i++) {
          r.chests.push({
            kind: Math.random() < 0.5 ? "family" : "universal",
            family: mode.family,
            tier: T
          });
        }
        r.chestCount = chestCount;
        break;
      }
    case "arrowdew":
      r.arrowdew = scale(randInt(15, 50) * T);
      break;
    case "coins":
      r.coins = scale(randInt(80, 400) * T);
      break;
    case "gacha":
      r.gachaToken = scale(randInt(1, 3));
      break;
    case "potion":
      r.potions.push(rollPotionByTier(T));
      break;
    case "catbond":
      r.catXP = scale(randInt(50, 150));
      r.catBond = randInt(1, 2);
      break;
    case "start":
      {
        // 繞圈普通一輪包
        addRandomFamilyMat(r, mode.family, T, scale(3));
        r.arrowdew = scale(randInt(15, 40) * T);
        r.coins = scale(randInt(50, 150) * T);
        r.lap = true;
        break;
      }
    // ── 探索地圖重製新增格子 ────────────────────────────────
    // ⚠️ 以下新欄位（buffs/nextShootMult/trapBack/loseCoins/jumpAhead/…）由
    //    settle 層（villageBoardDb Phase 2）消費，**不會**被 applyBoardReward 套用——
    //    寫 settle 時記得逐一處理，否則會悄悄消失。
    case "camp":
      // 營地：不直接給獎勵，設定本趟後續資源格 ×1.2
      r.buffs = {
        ...(r.buffs || {}),
        campMult: 1.2
      };
      r.band = "營地";
      break;
    case "empower":
      {
        // 強化效果池（08-07 新增多骰）：
        //   50% → 下一射箭格獎勵 ×2（nextShootMult，疊加如舊）
        //   25% → 下一次擲骰骰 2 顆骰子（diceCount，用完即消耗）
        //   25% → 下一次擲骰骰 3 顆骰子（一次移動距離大增）
        const r2 = Math.random();
        if (r2 < 0.5) {
          r.nextShootMult = 2;
          r.band = "強化";
        } else {
          r.diceCount = r2 < 0.75 ? 2 : 3;
          r.band = `多骰 ×${r.diceCount}`;
        }
        break;
      }
    case "catmate":
      // 貓夥伴：本趟隨行貓加成（射箭完成度上限 +5%，settle 端套用）
      r.buffs = {
        ...(r.buffs || {}),
        catmate: true
      };
      r.band = "貓夥伴";
      break;
    case "trap":
      {
        // 陷阱：多種不同事件（蛇咬/流沙/竊金/骰子/箭露），由 rollTrapEvent 決定
        const ev = rollTrapEvent(T);
        Object.assign(r, ev);
        r.trapType = ev.type;
        r.band = ev.label;
        break;
      }
    case "shortcut":
      // 捷徑：直接前進 3~5 格（由 settle/UI 套用）
      r.jumpAhead = randInt(3, 5);
      r.band = "捷徑";
      break;
    case "market":
      {
        // 市集：第一期佔位——小機率金幣＋「市集整修中」；完整市集第二期
        if (Math.random() < 0.5) r.coins = scale(randInt(20, 80) * T);
        r.marketPlaceholder = true;
        r.band = "市集整修中";
        break;
      }
    case "scenery":
      // 風景：純 flavor＋微獎勵
      r.coins = scale(randInt(1, 5));
      r.scenery = true;
      r.band = "風景";
      break;
    case "boss":
      {
        // 終點 Boss：按 6 箭完成度分帶 S/A/B/C 判定獎勵大小（無失敗）
        const band = scoreToBand(scoreRatio);
        // 分帶倍率（乘 band.monsterMult×0.5）：S ×1.5 / A ×1.0 / B ×0.75 / C ×0.5——
        // 與怪物格共用同一張 scoreToBand 分帶表，高低分帶範圍不重疊，打越高獎越大。
        // 基底範圍吃 BOSS_REWARD_RANGE（說明書直接引用，改平衡自動同步）。
        const f = band.monsterMult * 0.5;
        r.coins = scale(Math.round(randInt(BOSS_REWARD_RANGE.coins[0], BOSS_REWARD_RANGE.coins[1]) * T * f));
        r.arrowdew = scale(Math.round(randInt(BOSS_REWARD_RANGE.arrowdew[0], BOSS_REWARD_RANGE.arrowdew[1]) * T * f));
        addRandomFamilyMat(r, mode.family, T, scale(BOSS_REWARD_RANGE.matsBase + Math.round(band.monsterMult * 2)));
        r.chests.push({
          kind: "family",
          family: mode.family,
          tier: T
        });
        if (band.band === "S") r.chests.push({
          kind: "universal",
          family: mode.family,
          tier: T
        });
        r.catXP = scale(Math.round(randInt(BOSS_REWARD_RANGE.catXP[0], BOSS_REWARD_RANGE.catXP[1]) * f)); // 隨分帶（與金幣/箭露一致）
        r.band = band.band;
        r.boss = true;
        break;
      }
    case "fork":
      {
        // 分岔路口：不在此結算——由旅程 UI 開二選一（chooseForkPath 跳去目標格）
        r.fork = true;
        r.band = "分岔路";
        break;
      }
    case "cardgacha":
      {
        // 抽卡房：不在此給獎勵——由旅程 UI 開抽卡 overlay（免費 1 張／付費 3 張）
        r.cardgacha = true;
        r.band = "抽卡房";
        break;
      }
    default:
      break;
  }
  return r;
}
function emptyReward() {
  return {
    coins: 0,
    arrowdew: 0,
    gachaToken: 0,
    catXP: 0,
    catBond: 0,
    villageResources: {},
    familyMaterials: {},
    potions: [],
    chests: [],
    band: null,
    lap: false
  };
}
function addFamilyMat(r, family, tier, count) {
  const id = `${family}_m${Math.min(6, tier)}`;
  r.familyMaterials[id] = (r.familyMaterials[id] || 0) + count;
}

// 家族素材：每份獨立在 1~tierCap 抽階級（偏向高階，以房主選的 T 為主），
// 再從「新怪物該族該階的 3 種普通材料」隨機取一種（getNormalMaterialPool）。
// 這樣才會掉到新怪的材料，而不是永遠只掉舊材料 family_m{t}。
function addRandomFamilyMat(r, family, tierCap, count) {
  for (let i = 0; i < count; i++) {
    const t = rollTier(tierCap);
    const pool = (0, _monsterEconomyCatalog.getNormalMaterialPool)({
      family,
      exactTier: t
    });
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    const id = pick ? pick.id : `${family}_m${t}`; // 找不到才退回舊材料
    r.familyMaterials[id] = (r.familyMaterials[id] || 0) + 1;
  }
}
function rollPotionByTier(tier) {
  // 藥水品質隨階級（實作端對照 itemData 藥水表；先給階級標記由 db 解析）
  const q = Math.min(3, Math.ceil(tier / 2)); // 1~3
  return {
    tier: q
  };
}
