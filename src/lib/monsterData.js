// src/lib/monsterData.js
// 打怪模式：怪物資料 + 部位定義 + 射手數值計算 + 傷害公式

import { calcBadgePoints, getCertLevel } from "./constants";
import { getCohort } from "./cohort";

// ─── 怪物清單 ────────────────────────────────────────────
export const MONSTERS = [
  { id: "zombie_a",   name: "殭屍甲",     icon: "🧟",  hp: 80,  atk: 8,  def: 3,  desc: "入門怪，動作遲緩，適合初次挑戰",         tier: "easy"   },
  { id: "zombie_b",   name: "殭屍乙",     icon: "🧟‍♂️", hp: 100, atk: 10, def: 5,  desc: "裝甲殭屍，皮厚一點，標準難度",           tier: "normal" },
  { id: "slime_a",    name: "史萊姆",     icon: "🫧",  hp: 60,  atk: 6,  def: 0,  desc: "軟爛史萊姆，防禦為零，最好入手",         tier: "easy"   },
  { id: "slime_b",    name: "黏液史萊姆", icon: "🟢",  hp: 150, atk: 8,  def: 2,  desc: "巨大史萊姆，血條拉長，耐磨型",           tier: "normal" },
  { id: "orc",        name: "獸人戰士",   icon: "👹",  hp: 120, atk: 15, def: 8,  desc: "蠻力獸人，攻擊超高，正面硬剛有風險",     tier: "hard"   },
  { id: "bad_boss",   name: "壞老闆",     icon: "👔",  hp: 90,  atk: 12, def: 4,  desc: "西裝魔王，慣老闆附身，中等難度",         tier: "normal" },
  { id: "obnoxious",  name: "奧客",       icon: "😤",  hp: 70,  atk: 18, def: 0,  desc: "無理取鬧奧客，攻擊暴高但防禦為零，賭注大", tier: "hard" },
  { id: "bad_mgr",    name: "爛主管",     icon: "🗣️",  hp: 110, atk: 12, def: 10, desc: "PUA主管，防禦奇高，打持久戰",             tier: "hard"   },
  { id: "landlady",   name: "黑心包租婆", icon: "👵",  hp: 100, atk: 14, def: 6,  desc: "台灣特色怪，攻防均衡的中等挑戰",         tier: "normal" },
  { id: "final_exam", name: "期末考",     icon: "📝",  hp: 200, atk: 18, def: 12, desc: "終極BOSS，血厚攻高防強，為高手而設",     tier: "boss"   },
];

export const TIER_LABEL = {
  easy:   { label: "入門",  color: "#22c55e" },
  normal: { label: "普通",  color: "#3b82f6" },
  hard:   { label: "困難",  color: "#f59e0b" },
  boss:   { label: "BOSS",  color: "#ef4444" },
};

// ─── 部位定義 ────────────────────────────────────────────
export const BODY_PARTS = [
  { id: "head",   name: "頭部",   icon: "💀", mult: 2.0,  locked: null,    scoreRange: [50, 60] },
  { id: "neck",   name: "頸部",   icon: "🎯", mult: 1.5,  locked: null,    scoreRange: [44, 55] },
  { id: "chest",  name: "胸部",   icon: "🫁", mult: 1.2,  locked: null,    scoreRange: [35, 50] },
  { id: "belly",  name: "腹部",   icon: "🥊", mult: 1.0,  locked: null,    scoreRange: [25, 40] },
  { id: "arm",    name: "手部",   icon: "💪", mult: 0.8,  locked: null,    scoreRange: [15, 30] },
  { id: "groin",  name: "鼠蹊部", icon: "⚡", mult: 1.8,  locked: null,    scoreRange: [42, 58] },
  { id: "heart",  name: "心臟",   icon: "❤️", mult: 3.0,  locked: "chest", scoreRange: [55, 60] },
  { id: "kidney", name: "腎臟",   icon: "🫘", mult: 2.5,  locked: "belly", scoreRange: [52, 60] },
  { id: "lung",   name: "肺臟",   icon: "🫧", mult: 2.0,  locked: "chest", scoreRange: [50, 60] },
  { id: "balls",  name: "蛋蛋",   icon: "💥", mult: 3.5,  locked: "groin", scoreRange: [56, 60] },
  { id: "miss",   name: "脫靶",   icon: "💨", mult: 0,    locked: null,    scoreRange: [0,  8]  },
];

// ─── 根據單箭分數隨機判定命中部位 ────────────────────────
// 規則：
//   M(0)   → 必定脫靶
//   1~5    → 高機率脫靶，偶爾命中手部/腹部
//   6~7    → 低分部位為主（手部/腹部）
//   8~9    → 中等部位（腹部/胸部/鼠蹊）
//   10(X)  → 高等部位為主（胸部/頸部/頭部），完全不脫靶
//   器官   → 需先解鎖對應部位才有機率觸發
export function resolveHitPart(score, unlockedParts) {
  if (score === 0) return BODY_PARTS.find(p => p.id === "miss");

  // 建立候選部位權重表（依分數調整）
  let candidates;

  if (score <= 5) {
    candidates = [
      { id: "miss",  w: 60 },
      { id: "arm",   w: 25 },
      { id: "belly", w: 15 },
    ];
  } else if (score <= 7) {
    candidates = [
      { id: "miss",  w: 10 },
      { id: "arm",   w: 35 },
      { id: "belly", w: 35 },
      { id: "chest", w: 15 },
      { id: "groin", w: 5  },
    ];
  } else if (score <= 9) {
    candidates = [
      { id: "arm",   w: 10 },
      { id: "belly", w: 25 },
      { id: "chest", w: 30 },
      { id: "groin", w: 20 },
      { id: "neck",  w: 10 },
      { id: "head",  w: 5  },
    ];
  } else {
    // 10分(X)：完全不脫靶，以高部位為主
    candidates = [
      { id: "chest", w: 25 },
      { id: "groin", w: 20 },
      { id: "neck",  w: 25 },
      { id: "head",  w: 30 },
    ];
  }

  // 器官加成（需解鎖，在高分時有額外機率）
  if (score >= 9) {
    if (unlockedParts.has("chest")) candidates.push({ id: "heart", w: score === 10 ? 8 : 3 });
    if (unlockedParts.has("belly")) candidates.push({ id: "kidney", w: score === 10 ? 6 : 2 });
    if (unlockedParts.has("chest")) candidates.push({ id: "lung",   w: score === 10 ? 5 : 2 });
  }
  if (score >= 10 && unlockedParts.has("groin")) {
    candidates.push({ id: "balls", w: 10 });
  }

  // 加權抽籤
  const total = candidates.reduce((s, c) => s + c.w, 0);
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= c.w;
    if (r <= 0) return BODY_PARTS.find(p => p.id === c.id) || BODY_PARTS.find(p => p.id === "belly");
  }
  return BODY_PARTS.find(p => p.id === "belly");
}

// ─── 傷害計算 ────────────────────────────────────────────
// 基礎公式：(分數/60) × 射手ATK × 部位倍率 × 隨機(0.85~1.15) - 怪物DEF
// 最低傷害1
export function calcDamage({ score, archerATK, monsterDEF, partMult, isCrit = false }) {
  if (partMult === 0) return 0;
  // 新公式：底數5 + ATK貢獻 + 分數加成，再乘部位倍率
  // X(10分)對ATK20/DEF0史萊姆 約 15~20傷害，感覺合理
  const scorePct = Math.max(0, Math.min(1, score / 10));  // 0~1（10分=滿）
  const randFact = 0.85 + Math.random() * 0.30;           // 0.85~1.15
  const critMult = isCrit ? 2.0 : 1.0;
  const base     = 5 + archerATK * 0.6 + score * 0.8;    // 底數+ATK貢獻+分數加成
  const def      = Math.max(0, monsterDEF * 0.4);         // DEF抵消40%底數
  const raw      = (base - def) * partMult * randFact * critMult;
  return Math.max(1, Math.round(raw));
}

// 怪物反擊傷害
export function calcCounterDamage({ monsterATK, archerDEF, headStunned = false, isCrit = false }) {
  const rand = Math.floor(Math.random() * 7) - 3; // -3 到 +3
  const critMult = isCrit ? 1.8 : 1.0;
  const base = Math.max(0, Math.round((monsterATK - archerDEF * 0.5 + rand) * critMult));
  return headStunned ? Math.max(0, Math.ceil(base / 2)) : base;
}

// ─── 射手數值計算 ────────────────────────────────────────
function normalizeEquipment(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return [];
}

export function calcArcherStats({ member, certification, certRecords, dexStats }) {
  let hp = 100;
  if (dexStats) hp += Math.min(10, Math.floor(dexStats.totalUnlocked / 10));
  const certLevel = certification?.level || "none";
  if (certLevel === "gold") hp += 10;
  else if (certLevel === "blue") hp += 5;
  hp += Math.min(10, Math.floor((member?.dailyQuestCount || 0) / 5));
  const achPts = calcBadgePoints(member, "achievement");
  hp += Math.min(5, Math.floor(achPts / 10));
  const defAcc = (member?.accessorySets || []).find(s => s.isDefault) || (member?.accessorySets || [])[0];
  if (defAcc) hp += Math.min(5, Math.floor(_countFields(defAcc) / 2));

  let atk = 10;
  const fatPts = calcBadgePoints(member, "fatCat");
  atk += Math.min(5, Math.floor(fatPts / 5));
  const LEVEL_BONUS = { 入門:1, 初級:2, 中級:3, 進階:4, 精英:5, 菁英:5 };
  let bowBonus = 0;
  ["recurve_bare","compound","traditional"].forEach(bk => {
    const recs = (certRecords || []).filter(r => r.bowType === bk);
    if (!recs.length) return;
    const best = Math.max(...recs.map(r => r.score || 0));
    const lv = getCertLevel(bk, best);
    if (lv) bowBonus += LEVEL_BONUS[lv] || 0;
  });
  atk += Math.min(10, bowBonus);
  const defBow = normalizeEquipment(member?.equipment).find(s => s.isDefault) || normalizeEquipment(member?.equipment)[0];
  if (defBow) atk += Math.min(5, Math.floor(Object.values(defBow.fields || {}).filter(v => v && String(v).trim()).length / 3));

  let def = 10;
  const scrPts = calcBadgePoints(member, "score");
  def += Math.min(5, Math.floor(scrPts / 5));
  const defArmor = (member?.armorSets || []).find(s => s.isDefault) || (member?.armorSets || [])[0];
  if (defArmor) def += Math.min(5, Math.floor(_countFields(defArmor) / 2));
  if (member?.joinDate) {
    const years = Math.floor((Date.now() - new Date(member.joinDate).getTime()) / (1000*60*60*24*365));
    def += Math.min(5, years);
  }
  const cohort = getCohort(member?.joinDate);
  if (cohort === 1) def += 5;
  else if (cohort <= 3) def += 3;
  else if (cohort <= 5) def += 2;
  else if (cohort > 5) def += 1;

  return { hp, atk, def };
}

function _countFields(obj) {
  if (!obj) return 0;
  let count = 0;
  const skip = new Set(["id","type","label"]);
  Object.entries(obj).forEach(([k,v]) => {
    if (skip.has(k)) return;
    if (typeof v === "object" && v !== null) Object.values(v).forEach(fv => { if (fv && String(fv).trim()) count++; });
    else if (v && String(v).trim()) count++;
  });
  return count;
}