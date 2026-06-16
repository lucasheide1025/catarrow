// src/lib/worldBossData.js — 世界大 Boss 資料定義

// ── Boss 清單 ──────────────────────────────────────────────────
export const WORLD_BOSSES = {
  head_coach: {
    name: "主教練",       title: "永恆弓聖",
    desc: "道館最強的存在。傳說從未被任何射手擊敗過，他的每一箭都是天崩地裂的示範。",
    hp: 200000, atk: 200, def: 120, pixelKey: "head_coach",
    family: "coach", bg: "#0f172a", accent: "#f59e0b",
  },
  wife: {
    name: "師母",         title: "隱世弓后",
    desc: "外表溫柔，實則功力深不可測。見過她真正發怒的人，箭靶上找不到完整的環。",
    hp: 130000, atk: 160, def: 90, pixelKey: "wife",
    family: "coach", bg: "#4a044e", accent: "#f0abfc",
  },
  yumi: {
    name: "YUMI教練",    title: "速射之神",
    desc: "速度快到讓人以為她有三隻手。每次教學課結束，靶場都要更換新靶。",
    hp: 100000, atk: 140, def: 70, pixelKey: "yumi",
    family: "coach", bg: "#064e3b", accent: "#6ee7b7",
  },
  cat_orange: {
    name: "肥橘貓王",    title: "日照橘霸",
    desc: "掌管箭場所有曬太陽領域的霸主。被打擾午睡時，ATK 會莫名翻倍。",
    hp: 60000, atk: 80, def: 40, pixelKey: "cat_orange",
    family: "cat", bg: "#431407", accent: "#fb923c",
  },
  cat_black: {
    name: "暗夜貓皇",    title: "虛空掌印",
    desc: "深夜箭場的統治者，眼睛在黑暗中發光，靶心也會自動移位讓他覺得好玩。",
    hp: 65000, atk: 95, def: 45, pixelKey: "cat_black",
    family: "cat", bg: "#0c0a09", accent: "#a8a29e",
  },
  cat_white: {
    name: "白毛貓聖",    title: "純潔裁判",
    desc: "負責評判所有箭的飛行姿態是否優雅。只要他不滿意，X環都算不算數。",
    hp: 55000, atk: 70, def: 55, pixelKey: "cat_white",
    family: "cat", bg: "#1e3a5f", accent: "#e2e8f0",
  },
  ghost_boss: {
    name: "怨靈大君",    title: "千年怨魂",
    desc: "箭場建立前就存在於此。每當有人丟掉靶紙，他就會更憤怒一分。",
    hp: 80000, atk: 120, def: 60, pixelKey: "ghost_boss",
    family: "ghost", bg: "#1e1b4b", accent: "#818cf8",
  },
  forest_boss: {
    name: "山林守護神",  title: "翠林仙尊",
    desc: "管轄箭場周圍所有樹木。有人說他會移動樹枝讓風向改變，毀掉你的完美一箭。",
    hp: 75000, atk: 110, def: 55, pixelKey: "forest_boss",
    family: "forest", bg: "#14532d", accent: "#86efac",
  },
  poison_boss: {
    name: "毒蟲之母",    title: "蟲族女王",
    desc: "夏天箭場的真正老大。蚊子、蜜蜂全聽她指揮，專門在你拉弓到一半時出現。",
    hp: 72000, atk: 105, def: 50, pixelKey: "poison_boss",
    family: "poison", bg: "#451a03", accent: "#fcd34d",
  },
  office_boss: {
    name: "職場終極魔王", title: "工時永恆者",
    desc: "用無止盡的加班和報表消耗射手的意志。據說他的技能就是讓你忘記來練習。",
    hp: 85000, atk: 130, def: 65, pixelKey: "office_boss",
    family: "office", bg: "#450a0a", accent: "#fca5a5",
  },
  exam_boss: {
    name: "考試恐懼之神", title: "白卷支配者",
    desc: "出現時，所有人的肌肉記憶都會消失。你的第一直覺永遠是錯的，他保證。",
    hp: 78000, atk: 115, def: 55, pixelKey: "exam_boss",
    family: "exam", bg: "#2e1065", accent: "#c4b5fd",
  },
  western_boss: {
    name: "古龍皇帝",     title: "西境霸主",
    desc: "從遠古傳說中走出的龍族王者。弓箭對他而言是玩具，但他尊重真正的射手。",
    hp: 90000, atk: 140, def: 70, pixelKey: "western_boss",
    family: "western", bg: "#0c1a0c", accent: "#4ade80",
  },
};

// Boss 鍵值陣列（用於隨機抽取）
export const WORLD_BOSS_KEYS = Object.keys(WORLD_BOSSES);

// ── HP 階段 ────────────────────────────────────────────────────
export function getBossPhase(currentHP, maxHP) {
  const pct = maxHP > 0 ? currentHP / maxHP : 0;
  if (pct > 0.8) return 4; // 完整
  if (pct > 0.5) return 3; // 輕傷
  if (pct > 0.2) return 2; // 重傷
  return 1;                 // 瀕死
}

export const PHASE_LABELS = {
  4: { label: "完整", color: "#22c55e" },
  3: { label: "輕傷", color: "#eab308" },
  2: { label: "重傷", color: "#f97316" },
  1: { label: "瀕死", color: "#ef4444" },
};

// ── 參戰人數加成 ──────────────────────────────────────────────
// 每多一人參戰，進場時 ATK/DEF 加成 +5%，最高 +100%（20人）
export function getParticipantBonus(count) {
  const bonus = Math.min(count * 0.05, 1.0);
  return { atkMult: 1 + bonus, defMult: 1 + bonus * 0.5, label: `+${Math.round(bonus * 100)}%` };
}

// ── 獎勵設定預設值 ────────────────────────────────────────────
export const DEFAULT_REWARD = {
  catBoxes:   1,   // 貓貓箱數量
  goldChests: 2,   // 黃金寶箱數量
  coins:      500, // 金幣
  cardChance: 0.10, // 10% 卡片掉落
};

// 未擊殺但時間到 → 安慰獎
export const CONSOLATION_REWARD = { goldChests: 1, coins: 100 };

// 最後一擊額外獎勵
export const LAST_HIT_EXTRA = { catBoxes: 1, cardPacks: 1 };

// ── 10 種擊殺公告 ─────────────────────────────────────────────
// {name} = 觸發最後一擊的玩家，{weapon} = 弓具名稱
export const KILL_ANNOUNCEMENTS = [
  // 1. 遊戲梗
  `【系統廣播】{name} 觸發隱藏連段，以【{weapon}】射出第 30 發必殺箭，BOSS 血條瞬間歸零。全域廣播：FIRST KILL！所有參戰勇者的名字將永遠刻在這片天空。{name} 從 BOSS 身上撕下【貓貓箱】與【圖片收集卡包】，並獲得了這場戰役的永久紀念。`,

  // 2. 時勢梗
  `【擊殺快報】在 AI 取代一切的時代，{name} 選擇用一把【{weapon}】，以最原始的方式告訴 BOSS：科技再強，也敵不過人的手感。一箭貫心，BOSS 倒在了演算法觸及不到的地方。戰利品：【貓貓箱】與【圖片收集卡包】——這是 AI 永遠學不來的。`,

  // 3. 迷因梗
  `【重大事件】BOSS 血量剩 1。全場射手集體看向 {name}。\n{name}：「不要看我，我只是剛好路過——」\n＊一箭＊\nBOSS 已永久下線。{name} 裝作若無其事地收下【貓貓箱】與【圖片收集卡包】，轉頭假裝在滑手機。`,

  // 4. 射箭梗
  `【擊殺通報】教練說：放鬆肩膀、穩住後手、對準弱點。{name} 全部做到了，只差 BOSS 沒有繃環而已。X 環落在要害，BOSS 應聲倒地。這一箭，打到了定型記憶裡。{name} 收走【貓貓箱】與【圖片收集卡包】——今天最漂亮的一射。`,

  // 5. 箭場梗
  `【緊急廣播】場務廣播：最後一輪，請準備取箭。{name} 是最後一位射手，也是終結者。等所有人取完箭，BOSS 才發現自己還插著一支——{name} 的最後一發。場務：「可以收靶了。」{name}：「我要取的是【貓貓箱】。」`,

  // 6. 遊戲梗 2
  `【SSR 掉落】{name} 以【{weapon}】連續命中弱點 ×5，觸發稱號解鎖：【真正的射手】，暴擊倍率 ×∞，畫面閃白，BOSS 爆炸成像素粒子。掉落物：【貓貓箱】【圖片收集卡包】，稀有度 SSR。全員確認：這個人沒有開掛。（真的沒有。）`,

  // 7. 迷因梗 2
  `【終戰報告】BOSS 低頭一看，發現 {name} 還沒射完。\nBOSS：「等等我還沒——」\n箭：「你說什麼？」\nBOSS 已永久下線。{name} 一臉平靜地走向 BOSS，撿起【貓貓箱】和【圖片收集卡包】，這個表情叫做「我早就知道了」。`,

  // 8. 時勢梗 2
  `【省錢快報】物價飛漲，萬物皆貴，但 {name} 這一箭是免費的。BOSS 倒在了預算之內。【貓貓箱】與【圖片收集卡包】到手，今天 CP 值最高的決策：來打 BOSS。下次 BOSS 也別想逃過通膨的審判。`,

  // 9. 射箭梗 2
  `【最終結算】X、X、X、X、X…… BOSS 數著每一支箭，以為還有機會活命。{name} 拉開【{weapon}】，沒有表情，沒有台詞，只有第 30 發落在正中核心。射箭就是這樣，靶不說話，BOSS 也學會了。【貓貓箱】＋【圖片收集卡包】，沉默收下。`,

  // 10. 箭場梗 2
  `【收工通知】下課鈴聲響起，教練說：收器材。{name} 說：等一下。一轉身，三步走位，以【{weapon}】拉弓放箭。BOSS 應聲倒地，器材繼續收。【貓貓箱】與【圖片收集卡包】輕描淡寫地塞進弓袋，一句話也沒說——今天沒事了。`,
];

// 隨機取一則公告並填入變數
export function buildKillAnnouncement(memberName, weaponName) {
  const template = KILL_ANNOUNCEMENTS[Math.floor(Math.random() * KILL_ANNOUNCEMENTS.length)];
  return template
    .replace(/\{name\}/g, memberName)
    .replace(/\{weapon\}/g, weaponName || "訪客弓組");
}

// ── 成就徽章定義 ──────────────────────────────────────────────
export const WORLD_BOSS_ACHIEVEMENTS = {
  // 各 Boss 擊殺成就
  slay_head_coach:   { name: "弒師之名",   icon: "👨‍🏫", desc: "成功擊殺主教練",   rarity: "legendary" },
  slay_wife:         { name: "尊師重道（誤）", icon: "👩‍🦰", desc: "成功擊殺師母",     rarity: "legendary" },
  slay_yumi:         { name: "快手之上",    icon: "🏹", desc: "成功擊殺 YUMI 教練", rarity: "epic"      },
  slay_cat_orange:   { name: "橘子剋星",    icon: "🟠", desc: "成功擊殺肥橘貓王",   rarity: "rare"      },
  slay_cat_black:    { name: "夜行者",      icon: "🖤", desc: "成功擊殺暗夜貓皇",   rarity: "rare"      },
  slay_cat_white:    { name: "純潔終結者",  icon: "🤍", desc: "成功擊殺白毛貓聖",   rarity: "rare"      },
  slay_ghost_boss:   { name: "驅邪大師",    icon: "👻", desc: "成功擊殺怨靈大君",   rarity: "epic"      },
  slay_forest_boss:  { name: "山林征服者",  icon: "🌲", desc: "成功擊殺山林守護神", rarity: "epic"      },
  slay_poison_boss:  { name: "蟲族剋星",    icon: "🐛", desc: "成功擊殺毒蟲之母",   rarity: "epic"      },
  slay_office_boss:  { name: "按時下班",    icon: "💼", desc: "成功擊殺職場終極魔王", rarity: "epic"     },
  slay_exam_boss:    { name: "滿分神話",    icon: "📝", desc: "成功擊殺考試恐懼之神", rarity: "epic"    },
  slay_western_boss: { name: "龍族剋星",    icon: "🐉", desc: "成功擊殺古龍皇帝",   rarity: "epic"      },
  // 特殊成就
  last_hit:          { name: "終結者",      icon: "⚡", desc: "觸發大 Boss 最後一擊", rarity: "legendary" },
  participate_10:    { name: "世界守護者",  icon: "🌍", desc: "參與 10 次世界大 Boss 挑戰", rarity: "rare" },
  top_damage:        { name: "傷害之王",    icon: "💥", desc: "在一次大 Boss 中造成最高傷害", rarity: "epic" },
};

// ── AI 機器人設定 ─────────────────────────────────────────────
export const BOT_TIERS = [
  { id: "weak",   label: "見習弓手", cost: 100, atkMult: 0.5, avgScore: 5, icon: "🤖" },
  { id: "normal", label: "正式弓手", cost: 100, atkMult: 0.8, avgScore: 7, icon: "🦾" },
  { id: "elite",  label: "精銳弓手", cost: 100, atkMult: 1.2, avgScore: 9, icon: "🏅" },
];

export function drawRandomBot() {
  const weights = [0.5, 0.35, 0.15]; // weak / normal / elite
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i];
    if (r < cum) return BOT_TIERS[i];
  }
  return BOT_TIERS[0];
}

// 機器人模擬一回合傷害（6 箭）
export function simulateBotRound(bot, bossAtk, bossDef) {
  let dmg = 0;
  const arrows = [];
  for (let i = 0; i < 6; i++) {
    const score = Math.max(0, Math.round((bot.avgScore + (Math.random() * 4 - 2))));
    const atk   = Math.round(60 * bot.atkMult);
    const base  = 8 + atk * 0.7 + score * 1.2 - bossDef * 0.35;
    const mult  = 0.85 + Math.random() * 0.3;
    const hit   = Math.max(0, Math.round(base * mult));
    dmg += hit;
    arrows.push({ label: score === 0 ? "M" : String(score), score, dmg: hit });
  }
  return { dmg, arrows };
}
