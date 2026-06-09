// src/lib/monsterData.js
// 打怪模式：怪物資料 + 部位定義 + 射手數值計算

import { calcBadgePoints, getCertLevel } from "./constants";
import { getCohort } from "./cohort";
// normalizeEquipment 內嵌，避免跨層 import 問題
function normalizeEquipment(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return [];
}

// ─── 怪物清單 ────────────────────────────────────────────
export const MONSTERS = [
  { id: "zombie_a",   name: "殭屍甲",     icon: "🧟",  hp: 80,  atk: 12, def: 3,  desc: "入門怪，動作遲緩，適合初次挑戰",       tier: "easy"   },
  { id: "zombie_b",   name: "殭屍乙",     icon: "🧟‍♂️", hp: 100, atk: 15, def: 8,  desc: "裝甲殭屍，皮厚一點，標準難度",         tier: "normal" },
  { id: "slime_a",    name: "史萊姆",     icon: "🫧",  hp: 60,  atk: 8,  def: 0,  desc: "軟爛史萊姆，防禦為零，最好入手",       tier: "easy"   },
  { id: "slime_b",    name: "黏液史萊姆", icon: "🟢",  hp: 150, atk: 10, def: 2,  desc: "巨大史萊姆，血條拉長，耐磨型",         tier: "normal" },
  { id: "orc",        name: "獸人戰士",   icon: "👹",  hp: 120, atk: 20, def: 10, desc: "蠻力獸人，攻擊超高，正面硬剛有風險",   tier: "hard"   },
  { id: "bad_boss",   name: "壞老闆",     icon: "👔",  hp: 90,  atk: 18, def: 5,  desc: "西裝魔王，慣老闆附身，中等難度",       tier: "normal" },
  { id: "obnoxious",  name: "奧客",       icon: "😤",  hp: 70,  atk: 25, def: 0,  desc: "無理取鬧奧客，攻擊暴高但防禦為零，賭注大", tier: "hard" },
  { id: "bad_mgr",    name: "爛主管",     icon: "🗣️",  hp: 110, atk: 15, def: 12, desc: "PUA主管，防禦奇高，打持久戰",           tier: "hard"   },
  { id: "landlady",   name: "黑心包租婆", icon: "👵",  hp: 100, atk: 20, def: 8,  desc: "台灣特色怪，攻防均衡的中等挑戰",       tier: "normal" },
  { id: "final_exam", name: "期末考",     icon: "📝",  hp: 200, atk: 25, def: 15, desc: "終極BOSS，血厚攻高防強，為高手而設",   tier: "boss"   },
];

// ─── 難度標籤 ────────────────────────────────────────────
export const TIER_LABEL = {
  easy:   { label: "入門",   color: "#22c55e" },
  normal: { label: "普通",   color: "#3b82f6" },
  hard:   { label: "困難",   color: "#f59e0b" },
  boss:   { label: "BOSS",   color: "#ef4444" },
};

// ─── 部位定義 ────────────────────────────────────────────
// locked: 需先命中哪個部位才能選（器官加成）
export const BODY_PARTS = [
  { id: "head",    name: "頭部",   icon: "💀", mult: 2.0,  locked: null,    desc: "命中後怪物本回合反擊傷害減半" },
  { id: "neck",    name: "頸部",   icon: "🎯", mult: 1.5,  locked: null,    desc: "" },
  { id: "chest",   name: "胸部",   icon: "🫁", mult: 1.2,  locked: null,    desc: "解鎖心臟和肺臟攻擊" },
  { id: "belly",   name: "腹部",   icon: "🥊", mult: 1.0,  locked: null,    desc: "解鎖腎臟攻擊" },
  { id: "arm",     name: "手部",   icon: "💪", mult: 0.8,  locked: null,    desc: "" },
  { id: "groin",   name: "鼠蹊部", icon: "⚡", mult: 1.8,  locked: null,    desc: "解鎖蛋蛋攻擊" },
  // 器官（需解鎖）
  { id: "heart",   name: "心臟",   icon: "❤️", mult: 3.0,  locked: "chest", desc: "致命要害，需先命中胸部" },
  { id: "kidney",  name: "腎臟",   icon: "🫘", mult: 2.5,  locked: "belly", desc: "要害，需先命中腹部" },
  { id: "lung",    name: "肺臟",   icon: "🫧", mult: 2.0,  locked: "chest", desc: "需先命中胸部" },
  { id: "balls",   name: "蛋蛋",   icon: "💥", mult: 3.5,  locked: "groin", desc: "最高傷害，需先命中鼠蹊部" },
  { id: "miss",    name: "脫靶",   icon: "💨", mult: 0,    locked: null,    desc: "沒中，傷害為零" },
];

// ─── 傷害計算 ────────────────────────────────────────────
// 基礎公式：(射手ATK - 怪物DEF) × 部位倍率 + 骰子(1~6) + Buff加成
// 最低傷害1（不會回血）
export function calcDamage({ archerATK, monsterDEF, partMult, diceResult, buffBonus = 0 }) {
  if (partMult === 0) return 0; // 脫靶
  const base = Math.max(1, archerATK - monsterDEF);
  const dmg  = Math.round(base * partMult + diceResult + buffBonus);
  return Math.max(1, dmg);
}

// 怪物反擊傷害
// headStunned: 本回合是否命中頭部（傷害減半）
export function calcCounterDamage({ monsterATK, archerDEF, headStunned = false }) {
  const rand = Math.floor(Math.random() * 7) - 3; // -3 到 +3
  const base = Math.max(0, monsterATK - archerDEF + rand);
  return headStunned ? Math.ceil(base / 2) : base;
}

// 骰子（D6）
export function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

// ─── 射手數值計算 ────────────────────────────────────────
export function calcArcherStats({ member, certification, certRecords, dexStats }) {
  // ── HP ──
  let hp = 100;
  // 圖鑑收集：每10個 +1，上限 +10
  if (dexStats) hp += Math.min(10, Math.floor(dexStats.totalUnlocked / 10));
  // 射手證
  const certLevel = certification?.level || "none";
  if (certLevel === "gold") hp += 10;
  else if (certLevel === "blue") hp += 5;
  // 報到次數：每5次 +1，上限 +10
  hp += Math.min(10, Math.floor((member?.dailyQuestCount || 0) / 5));
  // 成就章：每10分 +1，上限 +5
  const achPts = calcBadgePoints(member, "achievement");
  hp += Math.min(5, Math.floor(achPts / 10));
  // 預設飾品填寫欄位：每2個 +1，上限 +5
  const defAccessory = (member?.accessorySets || []).find(s => s.isDefault) || (member?.accessorySets || [])[0];
  if (defAccessory) {
    const filled = _countFilledFields(defAccessory);
    hp += Math.min(5, Math.floor(filled / 2));
  }

  // ── ATK ──
  let atk = 10;
  // 肥貓章：每5分 +1，上限 +5
  const fatPts = calcBadgePoints(member, "fatCat");
  atk += Math.min(5, Math.floor(fatPts / 5));
  // 三弓檢定
  const LEVEL_BONUS = { 入門: 1, 初級: 2, 中級: 3, 進階: 4, 精英: 5, 菁英: 5 };
  const bows = ["recurve_bare", "compound", "traditional"];
  let bowBonus = 0;
  bows.forEach(bk => {
    const recs = (certRecords || []).filter(r => r.bowType === bk);
    if (!recs.length) return;
    const best = Math.max(...recs.map(r => r.score || 0));
    const lv = getCertLevel(bk, best);
    if (lv) bowBonus += LEVEL_BONUS[lv] || 0;
  });
  atk += Math.min(10, bowBonus);
  // 預設弓組填寫欄位：每3個 +1，上限 +5
  const defBow = normalizeEquipment(member?.equipment).find(s => s.isDefault) || normalizeEquipment(member?.equipment)[0];
  if (defBow) {
    const filled = Object.values(defBow.fields || {}).filter(v => v && String(v).trim()).length;
    atk += Math.min(5, Math.floor(filled / 3));
  }

  // ── DEF ──
  let def = 10;
  // 積分章：每5分 +1，上限 +5
  const scrPts = calcBadgePoints(member, "score");
  def += Math.min(5, Math.floor(scrPts / 5));
  // 預設防具填寫欄位：每2個 +1，上限 +5
  const defArmor = (member?.armorSets || []).find(s => s.isDefault) || (member?.armorSets || [])[0];
  if (defArmor) {
    const filled = _countFilledFields(defArmor);
    def += Math.min(5, Math.floor(filled / 2));
  }
  // 射齡：每年 +1，上限 +5
  if (member?.joinDate) {
    const years = Math.floor((Date.now() - new Date(member.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365));
    def += Math.min(5, years);
  }
  // 期數生：1期+5 2-3期+3 4-5期+2 6期以上+1
  const cohort = getCohort(member?.joinDate);
  if (cohort === 1) def += 5;
  else if (cohort <= 3) def += 3;
  else if (cohort <= 5) def += 2;
  else if (cohort > 5) def += 1;

  return { hp, atk, def };
}

// ── 計算物件裡填了幾個欄位（防具/飾品用）──
function _countFilledFields(obj) {
  if (!obj) return 0;
  let count = 0;
  const skip = new Set(["id", "type", "label"]);
  Object.entries(obj).forEach(([k, v]) => {
    if (skip.has(k)) return;
    if (typeof v === "object" && v !== null) {
      Object.values(v).forEach(fv => { if (fv && String(fv).trim()) count++; });
    } else if (v && String(v).trim()) count++;
  });
  return count;
}