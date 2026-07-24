// src/lib/boardData.js
// 貓貓村大富翁：棋盤佈局、6 採集模式、純函式獎勵計算。
// 規格見 docs/second_brain/village-board-spec.md。
//
// 6 模式 ＝ 冒險六大族 ＝ 六經濟體 ＝ 六採集任務（沿用 catVillageGathering 的 GATHERING_SITES）：
//   site.id 同時是「村建築 id」→ getBuildingStage(建築等級) 決定該模式可刷的素材階級上限（T1~T5）。
import { GATHERING_SITES } from "./catVillageGathering";
import { getBuildingStage } from "./villageData";

// ── 6 模式（家族/資源/建築）──────────────────────────────
export const BOARD_MODES = GATHERING_SITES.map(s => ({
  id: s.id,               // 也是村建築 id
  family: s.race,         // mountain/insect/ghost/workplace/exam/temple
  familyName: s.raceName,
  resource: s.resource,   // ore/melon/fish/meat/driedfish/can
  resourceName: s.resourceName,
  name: s.name,
  icon: s.icon,
  palette: s.palette,
}));
export const BOARD_MODE_MAP = Object.fromEntries(BOARD_MODES.map(m => [m.id, m]));

// 該模式可刷的素材階級上限＝對應建築的 stage（T1~T5；T6 暫維持地下城專屬）
export function getModeTierCap(modeId, villageBuildings = {}) {
  const lvl = villageBuildings[modeId] || 1;
  return Math.max(1, Math.min(5, getBuildingStage(lvl)));
}

// ── 格子類型 ─────────────────────────────────────────────
export const TILE_TYPES = {
  start:    { id: "start",    icon: "🏁", label: "起點",     shooting: false },
  material: { id: "material", icon: "📦", label: "素材",     shooting: false },
  mining:   { id: "mining",   icon: "⛏️", label: "挖礦",     shooting: true  },
  monster:  { id: "monster",  icon: "👾", label: "怪物",     shooting: true  },
  arrowdew: { id: "arrowdew", icon: "💧", label: "箭露",     shooting: false },
  coins:    { id: "coins",    icon: "🪙", label: "金幣",     shooting: false },
  gacha:    { id: "gacha",    icon: "🎰", label: "扭蛋幣",   shooting: false },
  potion:   { id: "potion",   icon: "🧪", label: "藥水",     shooting: false },
  chest:    { id: "chest",    icon: "🎁", label: "寶箱",     shooting: true  },
  catbond:  { id: "catbond",  icon: "🐱", label: "貓咪羈絆", shooting: false },
  fate:     { id: "fate",     icon: "🎴", label: "命運",     shooting: false },
  opp:      { id: "opp",      icon: "🎴", label: "機會",     shooting: false },
};

// 28 格固定環形佈局（index 0 = 起點，順時針）。同類盡量分散。
export const BOARD_LAYOUT = [
  "start",
  "material", "coins", "mining", "fate", "arrowdew", "material", "monster",
  "opp", "material", "chest", "gacha", "material", "mining", "catbond",
  "fate", "material", "coins", "monster", "potion", "material", "opp",
  "mining", "arrowdew", "chest", "material", "catbond", "monster",
];
export const BOARD_SIZE = BOARD_LAYOUT.length; // 28

// ── 完成度分數帶（6 箭）────────────────────────────────────
// scoreRatio: 0~1（命中總分 / 滿分）。回傳 { band, monsterMult, miningMult, chestCount }
export function scoreToBand(scoreRatio = 0) {
  const r = Math.max(0, Math.min(1, scoreRatio));
  if (r >= 0.85) return { band: "S", monsterMult: 3.0, miningMult: 1.8, chestCount: 3 };
  if (r >= 0.65) return { band: "A", monsterMult: 2.0, miningMult: 1.5, chestCount: 2 };
  if (r >= 0.40) return { band: "B", monsterMult: 1.5, miningMult: 1.2, chestCount: 1 };
  return { band: "C", monsterMult: 1.0, miningMult: 1.0, chestCount: 1 };
}

// ── 小工具 ───────────────────────────────────────────────
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
// 依 tierCap 加權抽一個階級（越高階機率越低，但 cap 越高整體越好）
function rollTier(tierCap) {
  const weights = [];
  for (let t = 1; t <= tierCap; t++) weights.push({ t, w: Math.max(1, tierCap - t + 1) });
  const total = weights.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of weights) { r -= x.w; if (r <= 0) return x.t; }
  return 1;
}

// ── 獎勵計算（純函式）────────────────────────────────────
// ctx = { mode:BOARD_MODES項, tierCap, partyMult=1, scoreRatio(射箭格用) }
// 回傳統一 reward descriptor，由 villageBoardDb 套用到 Firestore。
export function rollTileReward(tileType, ctx = {}) {
  const { mode, tierCap = 1, partyMult = 1, scoreRatio = 0, tier } = ctx;
  const r = emptyReward();
  const scale = n => Math.max(1, Math.round(n * partyMult));
  // 玩家在前頁選的 tier（上限受建築 stage 限制）；未選則用建築上限
  const T = tier ? Math.max(1, Math.min(tier, tierCap)) : tierCap;

  switch (tileType) {
    case "material": {
      // 家族素材 ×3~6（family_m{tier}）
      const count = scale(randInt(3, 6));
      addFamilyMat(r, mode.family, rollTier(T), count);
      break;
    }
    case "mining": {
      // 村資源 ×6~15 × 完成度加乘；15% 額外皮草/家族素材
      const band = scoreToBand(scoreRatio);
      const base = randInt(6, 15);
      r.villageResources[mode.resource] = (r.villageResources[mode.resource] || 0) + scale(Math.round(base * band.miningMult));
      if (Math.random() < 0.15) {
        if (Math.random() < 0.5) r.villageResources.fur = (r.villageResources.fur || 0) + scale(1);
        else addFamilyMat(r, mode.family, rollTier(T), scale(1));
      }
      r.band = band.band;
      break;
    }
    case "monster": {
      // 6 箭完成度 S/A/B/C → ×挖礦基準；S 送寶箱
      const band = scoreToBand(scoreRatio);
      const base = randInt(6, 15);
      r.villageResources[mode.resource] = (r.villageResources[mode.resource] || 0) + scale(Math.round(base * band.monsterMult));
      addFamilyMat(r, mode.family, rollTier(T), scale(band.band === "S" ? 3 : band.band === "A" ? 2 : 1));
      if (band.band === "S") r.chests.push({ kind: "family", family: mode.family, tier: T });
      r.band = band.band;
      break;
    }
    case "chest": {
      // 6 箭完成度決定箱數 3/2/1
      const band = scoreToBand(scoreRatio);
      for (let i = 0; i < band.chestCount; i++) {
        r.chests.push({ kind: Math.random() < 0.5 ? "family" : "universal", family: mode.family, tier: rollTier(T) });
      }
      r.band = band.band;
      break;
    }
    case "arrowdew": r.arrowdew = scale(randInt(15, 50) * T); break;
    case "coins":    r.coins    = scale(randInt(80, 400) * T); break;
    case "gacha":    r.gachaToken = scale(randInt(1, 3)); break;
    case "potion":   r.potions.push(rollPotionByTier(T)); break;
    case "catbond":  r.catXP = scale(randInt(50, 150)); r.catBond = randInt(1, 2); break;
    case "start": {  // 繞圈普通一輪包
      addFamilyMat(r, mode.family, rollTier(T), scale(3));
      r.arrowdew = scale(randInt(15, 40) * T);
      r.coins = scale(randInt(50, 150) * T);
      r.lap = true;
      break;
    }
    default: break;
  }
  return r;
}

function emptyReward() {
  return { coins: 0, arrowdew: 0, gachaToken: 0, catXP: 0, catBond: 0,
    villageResources: {}, familyMaterials: {}, potions: [], chests: [], band: null, lap: false };
}
function addFamilyMat(r, family, tier, count) {
  const id = `${family}_m${Math.min(6, tier)}`;
  r.familyMaterials[id] = (r.familyMaterials[id] || 0) + count;
}
function rollPotionByTier(tier) {
  // 藥水品質隨階級（實作端對照 itemData 藥水表；先給階級標記由 db 解析）
  const q = Math.min(3, Math.ceil(tier / 2)); // 1~3
  return { tier: q };
}
