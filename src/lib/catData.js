// src/lib/catData.js — 貓貓陪練系統資料定義

// ── 九隻貓咪 ─────────────────────────────────────────────────
export const CATS = {
  daming: {
    id: "daming", name: "大娘", color: "玳瑁貓",
    personality: "霸氣老大姐，默默守護著每一隻後輩。",
    isDeceased: false,
    palette: { base: "#d97706", patch: "#78350f", light: "#fef3c7" },
  },
  gege: {
    id: "gege", name: "哥哥", color: "橘白貓",
    personality: "溫柔大哥，總是第一個迎接新成員。",
    isDeceased: false,
    palette: { base: "#f97316", patch: "#ffffff", light: "#ffedd5" },
  },
  meimei: {
    id: "meimei", name: "妹妹", color: "橘貓",
    personality: "活潑好動，喜歡在箭場追飛箭。",
    isDeceased: false,
    palette: { base: "#f97316", patch: "#fed7aa", light: "#fff7ed" },
  },
  niuniu: {
    id: "niuniu", name: "妞妞", color: "乳牛貓",
    personality: "黑白分明，做事一板一眼，是最嚴格的裁判。",
    isDeceased: false,
    palette: { base: "#1c1917", patch: "#ffffff", light: "#f5f5f4" },
  },
  haji: {
    id: "haji", name: "哈吉", color: "布偶貓",
    personality: "安靜夢幻，總是靠在靶架旁打盹。",
    isDeceased: false,
    palette: { base: "#fef9c3", patch: "#c4a882", light: "#fffbeb" },
  },
  baobao: {
    id: "baobao", name: "寶寶", color: "橘貓",
    personality: "黏人小傢伙，喜歡窩在弓袋裡睡覺。",
    isDeceased: false,
    palette: { base: "#fb923c", patch: "#fbbf24", light: "#fff7ed" },
  },
  youyou: {
    id: "youyou", name: "悠悠", color: "橘貓",
    personality: "走路慢慢悠悠，但眼神銳利，看穿一切。",
    isDeceased: false,
    palette: { base: "#ea580c", patch: "#fed7aa", light: "#fff7ed" },
  },
  xiaoan: {
    id: "xiaoan", name: "小安", color: "玳瑁貓",
    personality: "膽小卻勇敢，每次冒險都嚇到爪子發抖，但從未退縮。",
    isDeceased: false,
    palette: { base: "#92400e", patch: "#d97706", light: "#fef3c7" },
  },
  diandian: {
    id: "diandian", name: "顛顛", color: "黑貓",
    personality: "神秘莫測，據說能看見箭場的靈氣流動。",
    isDeceased: false,
    palette: { base: "#18181b", patch: "#374151", light: "#52525b" },
  },
};

export const CAT_IDS = Object.keys(CATS);

// ── 三種類型 ─────────────────────────────────────────────────
export const CAT_TYPES = {
  attack: {
    id: "attack", label: "攻擊型", icon: "⚔️",
    desc: "增加暴擊機率和傷害加成",
    skills: [
      { bond: 0,  name: "利爪一擊",  desc: "10% 機率暴擊 +20%" },
      { bond: 5,  name: "連環撲擊",  desc: "10% 機率連續觸發兩次傷害" },
      { bond: 10, name: "全力一擊",  desc: "5% 機率本箭傷害 ×3" },
    ],
    color: "#ef4444",
  },
  defense: {
    id: "defense", label: "防禦型", icon: "🛡️",
    desc: "減少 Boss 反擊傷害並回復 HP",
    skills: [
      { bond: 0,  name: "護主擋架",  desc: "10% 機率抵消 Boss 反擊 30%" },
      { bond: 5,  name: "療傷舔傷",  desc: "10% 機率回復 HP +50" },
      { bond: 10, name: "生命連結",  desc: "5% 機率完全免疫本次 Boss 反擊" },
    ],
    color: "#3b82f6",
  },
  allround: {
    id: "allround", label: "全能型", icon: "✨",
    desc: "均衡加成，掉寶率和金幣加成",
    skills: [
      { bond: 0,  name: "幸運爪印",  desc: "10% 機率掉寶 +1" },
      { bond: 5,  name: "金幣嗅覺",  desc: "10% 機率金幣獎勵 +20%" },
      { bond: 10, name: "全場加持",  desc: "5% 機率全屬性 +15% 持續一回合" },
    ],
    color: "#f59e0b",
  },
};

// ── 羈絆等級閾值 ──────────────────────────────────────────────
// bond 數值 → 等級 1-10+
export const BOND_THRESHOLDS = [0, 10, 25, 45, 70, 100, 140, 190, 250, 320, 400];
// BOND_THRESHOLDS[i] = 到達第 i 等需要的羈絆值（0-indexed，level = index）

export function getBondLevel(bond) {
  let lv = 0;
  for (let i = 0; i < BOND_THRESHOLDS.length; i++) {
    if (bond >= BOND_THRESHOLDS[i]) lv = i;
    else break;
  }
  return lv; // 0–10
}

export function getBondProgress(bond) {
  const lv = getBondLevel(bond);
  const cur = BOND_THRESHOLDS[lv] || 0;
  const next = BOND_THRESHOLDS[lv + 1];
  if (!next) return { lv, pct: 100, toNext: 0 };
  return { lv, pct: Math.round(((bond - cur) / (next - cur)) * 100), toNext: next - bond };
}

// ── 章節羈絆需求 ──────────────────────────────────────────────
// ch 1 = bond lv 0（一獲得就解鎖），ch11 = 只有 isDeceased 的貓才有
export const CHAPTER_BOND_LV = [null, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10];
//                                    ch1 ch2 ch3 ch4 ch5 ch6 ch7 ch8 ch9 ch10 ch11

// ── 章節定義（故事文字留白，等現實故事提供後填入）────────────
export function getCatChapters(catId, isDeceased = false) {
  const chapters = [
    { ch: 1,  title: "第一次相遇",          bondLv: 0,  story: "", thought: "", cliffhanger: "" },
    { ch: 2,  title: "箭場的秘密",           bondLv: 2,  story: "", thought: "", cliffhanger: "" },
    { ch: 3,  title: "神秘羽毛",             bondLv: 3,  story: "", thought: "", cliffhanger: "" },
    { ch: 4,  title: "森林裡的新朋友",       bondLv: 4,  story: "", thought: "", cliffhanger: "" },
    { ch: 5,  title: "迷路的冒險",           bondLv: 5,  story: "", thought: "", cliffhanger: "" },
    { ch: 6,  title: "守護箭場的誓言",       bondLv: 6,  story: "", thought: "", cliffhanger: "" },
    { ch: 7,  title: "地下城探索",           bondLv: 7,  story: "", thought: "", cliffhanger: "" },
    { ch: 8,  title: "世界王來襲",           bondLv: 8,  story: "", thought: "", cliffhanger: "" },
    { ch: 9,  title: "夥伴的約定",           bondLv: 9,  story: "", thought: "", cliffhanger: "" },
    { ch: 10, title: "成為貓小隊英雄",       bondLv: 10, story: "", thought: "", cliffhanger: "" },
  ];
  if (isDeceased) {
    chapters.push({
      ch: 11, title: "彩虹橋的另一端",       bondLv: 10, story: "", thought: "", cliffhanger: "",
      isMemorial: true,
      blessings: [], // { memberId, memberName, text, createdAt }
    });
  }
  return chapters;
}

// ── 羈絆加成（取決於類型和羈絆等級）────────────────────────
export function getCatBattleBonus(catType, bondLevel) {
  const lv = bondLevel || 0;
  if (catType === "attack")  return { atkMult: 1 + lv * 0.02, critsBonus: lv * 0.01 };
  if (catType === "defense") return { defBonus: lv * 3, hpRegen: lv * 2 };
  // allround
  return { lootBonus: lv * 0.02, coinBonus: lv * 0.02 };
}

// ── 抽貓機率（開貓貓箱）────────────────────────────────────
export function drawRandomCat(ownedCatIds = []) {
  const unowned = CAT_IDS.filter(id => !ownedCatIds.includes(id));
  if (unowned.length === 0) return null; // 全都有了
  return unowned[Math.floor(Math.random() * unowned.length)];
}
