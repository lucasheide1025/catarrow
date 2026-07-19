import { gradeCurveBonus } from "./equipGradeCurve";

// ─── 年度檢定預設分數 ──────────────────────────────────────
export const CERT_DEFAULT_SCORES = {
  recurve_full: { 入門:60, 初級:90, 中級:108, 進階:126, 精英:144 },
  recurve_bare: { 入門:60, 初級:90, 中級:108, 進階:126, 精英:144 },
  compound:     { 入門:54, 初級:81, 中級:99,  進階:114, 精英:132 },
  traditional:  { 入門:48, 初級:72, 中級:90,  進階:102, 菁英:114 },
};

export const CERT_LEVELS = {
  recurve_full: ["入門","初級","中級","進階","精英"],
  recurve_bare: ["入門","初級","中級","進階","精英"],
  compound:     ["入門","初級","中級","進階","精英"],
  traditional:  ["入門","初級","中級","進階","菁英"],
};

export const CERT_HALF = [
  { value:"first",  label:"上半年（1月～6月）"  },
  { value:"second", label:"下半年（7月～12月）" },
];

// 依分數查詢達到的最高階級
export function getCertLevelByScores(bowType, score, scoreTable) {
  if (!score || score === 0) return null;
  const levels = CERT_LEVELS[bowType] || [];
  const table  = scoreTable?.[bowType] || CERT_DEFAULT_SCORES[bowType] || {};
  let result = null;
  for (const lv of levels) {
    if (score >= (table[lv] || 9999)) result = lv;
  }
  return result;
}
export function fmtDT(ts) {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("zh-TW", { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}

export function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("zh-TW", { year:"numeric", month:"2-digit", day:"2-digit" });
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function thisYear() {
  return new Date().getFullYear();
}

export const COMP_TYPES = ["實體賽","積分賽","挑戰賽","臨時任務賽","年度檢定"];

export const COMP_TYPE_COLOR = {
  "實體賽":   { text:"text-purple-600", darkText:"text-purple-400", bg:"bg-purple-100 text-purple-700" },
  "積分賽":   { text:"text-blue-600",   darkText:"text-blue-400",   bg:"bg-blue-100 text-blue-700"     },
  "挑戰賽":   { text:"text-orange-600", darkText:"text-orange-400", bg:"bg-orange-100 text-orange-700" },
  "臨時任務賽":{ text:"text-green-600", darkText:"text-green-400",  bg:"bg-green-100 text-green-700"   },
  "年度檢定": { text:"text-teal-600",   darkText:"text-teal-400",   bg:"bg-teal-100 text-teal-700"     },
};

export const EVENT_POINTS = { 0:3, 1:2, 2:1 };

// ─── 徽章分數權重（集中管理，杜絕各算各的）──────────────────
// 肥貓章 / 積分章：銅 1、銀 10、金 50
// 成就章：銀 1、金 2、黑 3
export const BADGE_WEIGHTS = {
  fatCat:      { bronze: 1, silver: 10, gold: 50 },
  score:       { bronze: 1, silver: 10, gold: 50 },
  achievement: { silver: 1, gold: 2,  black: 3 },
};

// 計算單一章別的總分。type 可為 "fatCat" | "score" | "achievement"
// 也接受排行榜用的別名 "fatcat" / "achieve"
export function calcBadgePoints(member, type) {
  const map = { fatcat: "fatCat", achieve: "achievement" };
  const key = map[type] || type;
  const weight = BADGE_WEIGHTS[key];
  const data = member?.[key];
  if (!weight || !data) return 0;
  let pts = 0;
  for (const color of Object.keys(weight)) {
    pts += (weight[color] || 0) * (data[color] || 0);
  }
  return pts;
}

export function calcAge(joinDate) {
  if (!joinDate) return "";
  const j = new Date(joinDate), n = new Date();
  let y = n.getFullYear() - j.getFullYear();
  let m = n.getMonth() - j.getMonth();
  if (m < 0) { y--; m += 12; }
  return `${y}年${m}月`;
}

export function formatArcherNo(no) {
  return no ? `CA-${String(no).padStart(4,"0")}` : "—";
}

export function getMonthRange(year, month) {
  const start = new Date(year, month-1, 1);
  const end   = new Date(year, month, 0);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate:   end.toISOString().split("T")[0],
    label:     `${year}年${month}月`,
  };
}

export const BOW_TYPES = {
  recurve_bare: {
    label: "競技反曲弓（裸弓）", short: "裸弓", icon: "🏹",
    thresholds: { 入門:60, 初級:90, 中級:108, 進階:126, 精英:144 },
  },
  recurve_full: {
    label: "競技反曲弓（全配）", short: "全配", icon: "🎯",
    thresholds: { 入門:60, 初級:90, 中級:108, 進階:126, 精英:144 },
  },
  compound: {
    label: "美式獵弓", short: "獵弓", icon: "🦅",
    thresholds: { 入門:54, 初級:81, 中級:99, 進階:114, 精英:132 },
  },
  traditional: {
    label: "傳統弓", short: "傳統", icon: "🌿",
    thresholds: { 入門:48, 初級:72, 中級:90, 進階:102, 菁英:114 },
  },
};

export function getCertLevel(bowType, score) {
  if (!score || score === 0) return null;
  const bt = BOW_TYPES[bowType];
  if (!bt) return null;
  let level = null;
  for (const [name, pts] of Object.entries(bt.thresholds)) {
    if (score >= pts) level = name;
  }
  return level;
}

// 級別由低到高的順序（用於比大小、配色深淺）
export const CERT_LEVEL_ORDER = ["入門", "初級", "中級", "進階", "精英", "菁英"];
 
// 級別 → 樣式（越高越華麗）。回傳 Tailwind class 字串。
// variant: "solid"（實心徽章）| "soft"（深色底頁用）| "softLight"（淺色底頁用，AdminApp 未遷移前使用）
export function certLevelStyle(level, variant = "solid") {
  const styles = {
    入門: {
      solid: "bg-gray-400 text-white",
      soft:  "bg-white/10 text-gray-300 border border-white/15",
      softLight: "bg-gray-100 text-gray-600 border border-gray-200",
    },
    初級: {
      solid: "bg-emerald-500 text-white",
      soft:  "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30",
      softLight: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    },
    中級: {
      solid: "bg-blue-500 text-white",
      soft:  "bg-blue-500/15 text-blue-300 border border-blue-400/30",
      softLight: "bg-blue-50 text-blue-700 border border-blue-200",
    },
    進階: {
      solid: "bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white",
      soft:  "bg-purple-500/15 text-purple-300 border border-purple-400/30",
      softLight: "bg-purple-50 text-purple-700 border border-purple-200",
    },
    精英: {
      solid: "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 text-amber-950 shadow-md shadow-amber-200",
      soft:  "bg-amber-500/15 text-amber-300 border border-amber-400/30",
      softLight: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-300",
    },
  };
  // 傳統弓的「菁英」與其他弓的「精英」同級
  styles["菁英"] = styles["精英"];

  const fallback = {
    solid: "bg-gray-300 text-gray-600",
    soft: "bg-white/10 text-gray-400 border border-white/15",
    softLight: "bg-gray-50 text-gray-500 border border-gray-200",
  };
  return (styles[level] || fallback)[variant] || fallback[variant];
}
 
// 比較兩個分數誰高（給「再考刷分」用）。回傳 true 代表 newScore 比 oldScore 高。
export function isHigherScore(newScore, oldScore) {
  return Number(newScore || 0) > Number(oldScore || 0);
}

// ─── 裝備系統 ──────────────────────────────────────────────
export const EQUIP_GRADES = [
  { id: "common", name: "普通", color: "#94a3b8", glow: "#64748b" },
  { id: "rare",   name: "稀有", color: "#60a5fa", glow: "#3b82f6" },
  { id: "elite",  name: "精英", color: "#4ade80", glow: "#22c55e" },
  { id: "epic",   name: "史詩", color: "#c084fc", glow: "#a855f7" },
  { id: "legend", name: "傳說", color: "#fbbf24", glow: "#f59e0b" },
  { id: "mythic", name: "神話", color: "#f472b6", glow: "#ec4899" },
];

// 10 個裝備欄位定義（id 對應 member.equipment 的 key）
export const EQUIP_SLOT_DEFS = [
  { id: "bow",       name: "弓",         icon: "🏹", stat: "atk" },
  { id: "arrow",     name: "箭",         icon: "🪃", stat: "atk" },
  { id: "absorber",  name: "箭震吸收器", icon: "🔧", stat: "atk" },
  { id: "module",    name: "配件模組",   icon: "⚙️", stat: "atk" },
  { id: "chest",     name: "護胸",       icon: "🦺", stat: "def" },
  { id: "arm",       name: "護臂",       icon: "🛡️", stat: "def" },
  { id: "hand",      name: "手部",       icon: "🧤", stat: "def" },
  { id: "nutrition", name: "營養品",     icon: "🍎", stat: "hp"  },
  { id: "quiver",    name: "箭袋",       icon: "🎒", stat: "hp"  },
  { id: "toolkit",   name: "工具包",     icon: "🧰", stat: "hp"  },
];

// 計算裝備對戰鬥屬性的加成
// 2026-07-19：改用 equipGradeCurve 的凸曲線（品級步長遞增＋突破跳兩步），
// 取代舊的「每品 +5、每級 +1」直線。理由與逐格數值見 equipGradeCurve.js。
// HP 欄位再乘 5。
export function getEquipSlotBonus(slotOrStat, equipment) {
  if (!equipment?.grade) return 0;
  const stat = typeof slotOrStat === "string" ? slotOrStat : slotOrStat?.stat;
  const rawBonus = gradeCurveBonus(equipment.grade, equipment.plusLevel || 0);
  if (!rawBonus) return 0;
  return stat === "hp" ? rawBonus * 5 : rawBonus;
}

export function calcEquipBonus(equipment) {
  let atkBonus = 0, defBonus = 0, hpBonus = 0;
  if (!equipment) return { atkBonus, defBonus, hpBonus };
  for (const slot of EQUIP_SLOT_DEFS) {
    const e = equipment[slot.id];
    if (!e?.grade) continue;
    const bonus = getEquipSlotBonus(slot, e);
    if (slot.stat === "atk") atkBonus += bonus;
    else if (slot.stat === "def") defBonus += bonus;
    else if (slot.stat === "hp") hpBonus += bonus;
  }
  return { atkBonus, defBonus, hpBonus };
}
