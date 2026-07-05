// src/lib/adventurerSystem.js — 冒險者公會等級系統

// ── 六大階級 ──────────────────────────────────────────────────
export const RANKS = [
  { name: "青銅", icon: "🥉", color: "#b45309", mult: 1.0, gradient: "linear-gradient(135deg,#92400e,#78350f)" },
  { name: "白銀", icon: "🥈", color: "#94a3b8", mult: 1.3, gradient: "linear-gradient(135deg,#475569,#1e293b)" },
  { name: "黃金", icon: "🥇", color: "#fbbf24", mult: 1.6, gradient: "linear-gradient(135deg,#d97706,#92400e)" },
  { name: "白金", icon: "💎", color: "#e2e8f0", mult: 1.9, gradient: "linear-gradient(135deg,#334155,#0f172a)" },
  { name: "傳說", icon: "🔥", color: "#f87171", mult: 2.2, gradient: "linear-gradient(135deg,#991b1b,#7f1d1d)" },
  { name: "神話", icon: "⚡", color: "#a78bfa", mult: 2.5, gradient: "linear-gradient(135deg,#4c1d95,#2e1065)" },
];

// 每個等級所需 XP（依階級）
const XP_PER_LEVEL = [200, 400, 700, 1100, 1600, 2200];

// 到達 level 所需累積 XP（Lv1 = 0 XP）
export function xpToReachLevel(level) {
  let total = 0;
  for (let l = 1; l < Math.min(level, 61); l++) {
    total += XP_PER_LEVEL[Math.min(Math.floor((l - 1) / 10), 5)];
  }
  return total;
}

// 由累積 XP 計算當前等級（1-60）
export function levelFromXP(totalXP) {
  const tx = totalXP || 0;
  for (let lv = 60; lv >= 1; lv--) {
    if (tx >= xpToReachLevel(lv)) return lv;
  }
  return 1;
}

// 由等級取得階級索引（0-5）
export function rankIdxFromLevel(level) {
  return Math.min(Math.floor((level - 1) / 10), 5);
}

// 由等級取得階級物件
export function rankFromLevel(level) {
  return RANKS[rankIdxFromLevel(level)];
}

// 等級在當前階級內的位置（1-10）
export function levelInRank(level) {
  return ((level - 1) % 10) + 1;
}

// 當前等級 XP 進度
export function xpProgress(totalXP, level) {
  if (level >= 60) return { current: 0, needed: 0, pct: 100 };
  const atLevel = xpToReachLevel(level);
  const needed  = XP_PER_LEVEL[rankIdxFromLevel(level)];
  const current = Math.max(0, (totalXP || 0) - atLevel);
  return { current, needed, pct: Math.min(100, Math.round(current / needed * 100)) };
}

// 是否為晉階等級（Lv10/20/30/40/50）
export function isPromotionLevel(level) {
  return [10, 20, 30, 40, 50].includes(level);
}

// ── 靶紙分數按鈕設定 ──────────────────────────────────────────
export const TARGET_ZONES = {
  cthulhu: [
    { label: "12", val: 12, color: "#fbbf24" },
    { label: "11", val: 11, color: "#fbbf24" },
    { label: "10", val: 10, color: "#ef4444" },
    { label: "9",  val: 9,  color: "#ef4444" },
    { label: "8",  val: 8,  color: "#3b82f6" },
    { label: "7",  val: 7,  color: "#3b82f6" },
    { label: "6",  val: 6,  color: "#475569" },
    { label: "M",  val: 0,  color: "#1e293b" },
  ],
  hostage: [
    { label: "20 討伐",  val: 20,  color: "#ef4444" },
    { label: "10",       val: 10,  color: "#3b82f6" },
    { label: "5",        val: 5,   color: "#10b981" },
    { label: "人質 −50", val: -50, color: "#1e293b", penalty: true },
  ],
  zombie: [
    { label: "11 爆頭", val: 11, color: "#fbbf24" },
    { label: "10 頭部", val: 10, color: "#ef4444" },
    { label: "5 身體",  val: 5,  color: "#3b82f6" },
    { label: "2 脫靶",  val: 2,  color: "#475569" },
  ],
};

export const TARGET_NAME = {
  cthulhu: "克蘇魯靶",
  hostage: "人質靶",
  zombie:  "殭屍靶",
};

// ── 原野射箭標準分數按鈕 ────────────────────────────────────────
export const STANDARD_ZONES = [
  { label: "X", val: 10, color: "#fbbf24" },
  { label: "9", val: 9,  color: "#ef4444" },
  { label: "8", val: 8,  color: "#ef4444" },
  { label: "7", val: 7,  color: "#3b82f6" },
  { label: "6", val: 6,  color: "#3b82f6" },
  { label: "5", val: 5,  color: "#475569" },
  { label: "4", val: 4,  color: "#475569" },
  { label: "3", val: 3,  color: "#64748b" },
  { label: "2", val: 2,  color: "#64748b" },
  { label: "1", val: 1,  color: "#94a3b8" },
  { label: "M", val: 0,  color: "#1e293b" },
];

// ── 晉階任務設定（Lv10/20/30/40/50 各一場原野射箭）────────────
export const PROMOTION_QUESTS = {
  10: { level: 10, fromRank: "青銅", toRank: "白銀", dist: 8,  arrowCount: 6, goal: 25, bonusXP: 400  },
  20: { level: 20, fromRank: "白銀", toRank: "黃金", dist: 10, arrowCount: 6, goal: 32, bonusXP: 600  },
  30: { level: 30, fromRank: "黃金", toRank: "白金", dist: 13, arrowCount: 6, goal: 38, bonusXP: 900  },
  40: { level: 40, fromRank: "白金", toRank: "傳說", dist: 15, arrowCount: 6, goal: 42, bonusXP: 1200 },
  50: { level: 50, fromRank: "傳說", toRank: "神話", dist: 18, arrowCount: 6, goal: 48, bonusXP: 1800 },
};

// ── 任務驗收 ──────────────────────────────────────────────────
export function checkTaskPass(task, arrows) {
  const total = arrows.reduce((s, a) => s + a, 0);
  switch (task.type) {
    case "score":          return total >= task.goal;
    case "hits":           return arrows.filter(a => a > 0).length >= task.goal;
    case "protected_score":return total >= task.goal && !arrows.includes(-50);
    case "headshot":       return arrows.filter(a => a >= 10).length >= task.goal;
    case "one_shot":       return arrows[0] === 20;
    default:               return total >= task.goal;
  }
}

// 任務目標描述
export function taskDesc(task) {
  switch (task.type) {
    case "score":          return `總分達 ${task.goal} 分`;
    case "hits":           return `命中 ${task.goal} 箭以上`;
    case "protected_score":return `保護人質，得分達 ${task.goal} 分`;
    case "headshot":       return `爆頭（10/11分區）${task.goal} 箭以上`;
    case "one_shot":       return `一箭討伐（命中 20 分區）`;
    default:               return `達到目標 ${task.goal}`;
  }
}

// ── 遊戲風任務名稱池（依靶紙 + 類型）────────────────────────────
const QUEST_NAME_POOL = {
  cthulhu_score:          ["遠古者的試煉", "星海封印之戰", "古神凝視下的一矢", "深淵壓制令", "觸手林中突圍", "沉眠者覺醒前夕"],
  cthulhu_hits:           ["觸手獵殺令", "千眼之夜清掃", "遠古軍團殲滅令", "黑翼試射令"],
  zombie_score:           ["屍潮清除令", "荒野防線", "末日前的一輪", "亡者之海突圍", "廢墟掃蕩任務"],
  zombie_headshot:        ["爆頭特攻令", "腦髓破碎任務", "喪屍軍團解體令", "精準擊殺令"],
  hostage_protected_score:["守護聖盾任務", "最後防線", "人質援救作戰", "盾矛並進", "神射手護衛令"],
  hostage_one_shot:       ["神射手的殿試", "一矢定乾坤", "榮耀之箭", "首席狙擊手考核", "公會長的賭注"],
};
function pickQuestName(target, type, rand) {
  const pool = QUEST_NAME_POOL[`${target}_${type}`] || ["懸賞任務"];
  return pool[Math.floor(rand() * pool.length)];
}

// ── 每日任務生成（依日期 seed，全員同一批）──────────────────────
export function makeSeedRand(seed) {
  let s = ((seed * 1664525) + 1013904223) >>> 0;
  return () => {
    s = ((s * 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// bonus: null | { type:"coins", amount:N } | { type:"chest", chestType:"wood"|"iron"|"gold" }
function rollBonus(difficulty, rand) {
  const r = rand();
  if (difficulty === 1) {
    if (r < 0.10) return { type: "chest", chestType: "wood",  icon: "📦", label: "木寶箱" };
    if (r < 0.30) return { type: "coins", amount: 150 + Math.floor(rand() * 150), icon: "💰", label: "金幣寶箱" };
  } else if (difficulty === 2) {
    if (r < 0.12) return { type: "chest", chestType: "iron",  icon: "🧰", label: "鐵寶箱" };
    if (r < 0.30) return { type: "coins", amount: 300 + Math.floor(rand() * 200), icon: "💰", label: "金幣寶箱" };
  } else {
    if (r < 0.18) return { type: "chest", chestType: "gold",  icon: "🎁", label: "黃金寶箱" };
    if (r < 0.35) return { type: "coins", amount: 500 + Math.floor(rand() * 300), icon: "💰", label: "金幣寶箱" };
  }
  return null;
}

export function getDailyGuildTasks(date) {
  const seed = parseInt(date.replace(/-/g, ""), 10);
  const rand = makeSeedRand(seed);
  const ri   = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const qn   = (target, type) => pickQuestName(target, type, rand);
  const bon  = (diff) => rollBonus(diff, rand);

  return [
    // 難度一（一般）
    { id:0, target:"cthulhu", type:"score",            arrowCount:6, goal:ri(30,48), dist:ri(5,8),   difficulty:1, xp:50,  coins:80,  arrowDew:ri(10,20), questName:qn("cthulhu","score"),           bonus:bon(1) },
    { id:1, target:"cthulhu", type:"hits",             arrowCount:6, goal:ri(4,5),   dist:ri(5,8),   difficulty:1, xp:50,  coins:80,  arrowDew:ri(10,20), questName:qn("cthulhu","hits"),            bonus:bon(1) },
    { id:2, target:"zombie",  type:"score",            arrowCount:6, goal:ri(20,35), dist:ri(5,8),   difficulty:1, xp:50,  coins:80,  arrowDew:ri(10,20), questName:qn("zombie","score"),            bonus:bon(1) },
    // 難度二（挑戰）
    { id:3, target:"cthulhu", type:"score",            arrowCount:6, goal:ri(48,60), dist:ri(8,13),  difficulty:2, xp:100, coins:150, arrowDew:ri(20,40), questName:qn("cthulhu","score"),           bonus:bon(2) },
    { id:4, target:"hostage", type:"protected_score",  arrowCount:6, goal:ri(30,50), dist:ri(7,12),  difficulty:2, xp:100, coins:150, arrowDew:ri(20,40), questName:qn("hostage","protected_score"), bonus:bon(2) },
    { id:5, target:"zombie",  type:"headshot",         arrowCount:6, goal:ri(2,4),   dist:ri(7,12),  difficulty:2, xp:100, coins:150, arrowDew:ri(20,40), questName:qn("zombie","headshot"),         bonus:bon(2) },
    { id:6, target:"zombie",  type:"score",            arrowCount:6, goal:ri(35,50), dist:ri(8,13),  difficulty:2, xp:100, coins:150, arrowDew:ri(20,40), questName:qn("zombie","score"),            bonus:bon(2) },
    // 難度三（精英）
    { id:7, target:"hostage", type:"one_shot",         arrowCount:1, goal:20,        dist:ri(10,15), difficulty:3, xp:150, coins:250, arrowDew:ri(40,80), questName:qn("hostage","one_shot"),        bonus:bon(3) },
    { id:8, target:"cthulhu", type:"score",            arrowCount:6, goal:ri(60,72), dist:ri(12,18), difficulty:3, xp:150, coins:250, arrowDew:ri(40,80), questName:qn("cthulhu","score"),           bonus:bon(3) },
    { id:9, target:"hostage", type:"protected_score",  arrowCount:6, goal:ri(60,80), dist:ri(12,18), difficulty:3, xp:150, coins:250, arrowDew:ri(40,80), questName:qn("hostage","protected_score"), bonus:bon(3) },
  ];
}

// ── 每日一般懸賞任務自動生成（從怪物資料，不需範本）────────────

// 懸賞難度 → 可選怪物 tier 對應表
export const DAILY_BOUNTY_TIER_MAP = {
  1: ["common"],
  2: ["common", "rare"],
  3: ["rare", "elite"],
  4: ["elite", "fierce", "boss", "mythic"],
};

// 懸賞難度 → 擊殺數範圍
export const DAILY_BOUNTY_KILL_RANGE = {
  1: { min: 5, max: 10 },
  2: { min: 3, max: 7 },
  3: { min: 2, max: 5 },
  4: { min: 1, max: 3 },
};

// 任務名稱生成池（依怪物族系）
const BOUNTY_NAME_POOL = {
  ghost:     ["靈界異變討伐令", "鬼怪掃蕩令", "陰間通道封鎖任務", "好兄弟驅逐令"],
  mountain:  ["山林猛獸討伐令", "荒野清剿令", "深山異變調查任務", "野獸驅逐令"],
  insect:    ["蟲害撲滅令", "毒蟲清除令", "蟲巢剿滅任務", "害蟲驅逐令"],
  workplace: ["職場整頓令", "社畜解放任務", "職場霸凌討伐令", "辦公室淨化令"],
  exam:      ["考試終結令", "學業突破任務", "考場肅清令", "分數戰爭令"],
  temple:    ["魔物討伐令", "遠征清剿令", "西方來襲防衛任務", "異界侵略阻止令"],
  treasure:  ["寶藏獵取令", "秘寶探索任務", "財寶爭奪戰", "黃金狩獵令"],
};

// 通用名稱（當族系名稱池用完時）
const BOUNTY_GENERIC_NAMES = {
  1: ["簡單委託", "初級討伐令", "雜物清除任務"],
  2: ["一般討伐令", "中等懸賞", "巡邏清剿任務"],
  3: ["精英討伐令", "高難度懸賞", "特殊清剿任務"],
  4: ["傳說討伐令", "終極懸賞", "危機處理任務"],
};

/**
 * 每日一般懸賞自動生成（無需範本）
 * @param {string} dateKey - 日期 key (YYYY-MM-DD)
 * @param {Object} rewards - 難度獎勵表 (DEFAULT_BOUNTY_REWARDS)
 * @param {Function} rand - 偽亂數函式 (0~1)
 * @param {Array} monsters - MONSTERS 陣列
 * @returns {Array} 懸賞任務物件陣列（可直接餵給 publishGuildQuest）
 */
export function generateDailyGeneralBounties(dateKey, rewards, rand, monsters) {
  const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  const results = [];

  [1, 2, 3, 4].forEach(difficulty => {
    const allowedTiers = DAILY_BOUNTY_TIER_MAP[difficulty] || ["common"];
    const killRange    = DAILY_BOUNTY_KILL_RANGE[difficulty] || { min: 1, max: 5 };

    // 從 MONSTERS 中篩選符合 tier 的怪物（排除 treasure 族，因為寶箱怪不是常規狩獵目標）
    const pool = monsters.filter(m =>
      allowedTiers.includes(m.tier) && m.family !== "treasure"
    );
    if (!pool.length) return;

    const monster    = pool[Math.floor(rand() * pool.length)];
    const killCount  = ri(killRange.min, killRange.max);

    // 生成任務名稱
    const familyNames = BOUNTY_NAME_POOL[monster.family];
    // 用 difficulty 和 monster.family 當 seed 偏移，確保同一難度不同天的命名有變化
    const namePool = familyNames && familyNames.length > 0
      ? familyNames
      : (BOUNTY_GENERIC_NAMES[difficulty] || ["討伐令"]);
    const title = pick(namePool);

    // 生成任務描述
    const familyLabel = monster.family === "ghost" ? "鬼怪"
      : monster.family === "mountain" ? "野獸"
      : monster.family === "insect" ? "蟲族"
      : monster.family === "workplace" ? "職場"
      : monster.family === "exam" ? "考試"
      : monster.family === "temple" ? "西方魔物"
      : monster.family === "treasure" ? "寶箱" : "怪物";

    const diffLabel = difficulty === 1 ? "較弱" : difficulty === 2 ? "一般" : difficulty === 3 ? "危險" : "極度危險";
    const desc = `最近公會附近出現${diffLabel}的${familyLabel}「${monster.name}」威脅居民安全，請冒險者前往討伐 ${killCount} 隻。`;

    const r = rewards[difficulty] || { xp: 60, coins: 100, arrowDew: 20, gachaCoins: 1 };

    results.push({
      title,
      desc,
      type: "normal",
      questSubtype: "kill_monster",
      requirement: { monsterId: monster.id, killCount },
      reward: { xp: r.xp, coins: r.coins, arrowDew: r.arrowDew || 0, gachaCoins: r.gachaCoins || 0 },
      bountyDifficulty: difficulty,
      bountySource: "daily_general",
      bountyDateKey: dateKey,
      // 標記來自自動生成，非範本
      autoGenerated: true,
    });
  });

  return results;
}

// ── 雙週懸賞任務自動生成 ──────────────────────────────────────

export function getBiWeeklyPeriodKey() {
  return `bw_${Math.floor(Date.now() / (86400000 * 14))}`;
}

const BOUNTY_TIER_CONFIG = [
  { tier:"common", killMin:10, killMax:20, xp:100,  coins:150,  arrowDew:30,  gachaCoins:1,  count:2 },
  { tier:"rare",   killMin:7,  killMax:12, xp:200,  coins:300,  arrowDew:60,  gachaCoins:2,  count:2 },
  { tier:"elite",  killMin:4,  killMax:8,  xp:350,  coins:500,  arrowDew:100, gachaCoins:3,  count:2 },
  { tier:"fierce", killMin:2,  killMax:5,  xp:500,  coins:700,  arrowDew:150, gachaCoins:5,  count:2 },
  { tier:"boss",   killMin:2,  killMax:4,  xp:700,  coins:1000, arrowDew:200, gachaCoins:7,  count:1 },
  { tier:"mythic", killMin:1,  killMax:2,  xp:1000, coins:1500, arrowDew:300, gachaCoins:10, count:1 },
];

export function generateBiWeeklyBounties(periodKey, monsters) {
  const seed = parseInt(periodKey.replace("bw_", ""), 10);
  const rand = makeSeedRand(seed);
  const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const quests = [];
  for (const cfg of BOUNTY_TIER_CONFIG) {
    const pool = monsters.filter(m => m.tier === cfg.tier);
    if (!pool.length) continue;
    for (let i = 0; i < cfg.count; i++) {
      const monster   = pool[Math.floor(rand() * pool.length)];
      const killCount = ri(cfg.killMin, cfg.killMax);
      quests.push({
        title: `${monster.icon} ${monster.name} 討伐令`,
        desc: `擊殺 ${monster.name} ${killCount} 隻，協助公會清剿威脅。`,
        type: "normal",
        questSubtype: "kill_monster",
        requirement: { monsterId: monster.id, killCount },
        reward: { xp: cfg.xp, coins: cfg.coins, arrowDew: cfg.arrowDew, gachaCoins: cfg.gachaCoins },
        periodTag: periodKey,
        badgeReward: null,
        deadline: null,
        status: "active",
      });
    }
  }
  return quests;
}
