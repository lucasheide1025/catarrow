// src/lib/worldBossData.js — 世界大 Boss 資料定義

import { CATS, CAT_SKILL_GROUPS } from "./catData";

// ── Boss 清單（Phase 2：18 隻，教練3＋貓貓9＋六大族R1~R6）────
// HP 設計基準：10人隊伍持續挑戰 3-7 天才能擊殺
// 六大族→地下城族名對照（world boss family key ↔ monsterData.js FAMILIES key）
export const WB_FAMILY_TO_DUNGEON_FAMILY = {
  ghost: "ghost", forest: "mountain", poison: "insect",
  office: "workplace", exam: "exam", western: "temple",
};

// 貓貓稱號（依 CAT_SKILL_GROUPS 分組風格擬定）
const CAT_TITLES = {
  daming:   "萬箭之母",
  gege:     "引路橘光",
  meimei:   "逐箭橘影",
  niuniu:   "精準判官",
  haji:     "夢遊突擊",
  baobao:   "弓袋霸主",
  youyou:   "慢步鷹眼",
  xiaoan:   "顫爪不退",
  diandian: "暗影觀氣",
};

// 貓貓數值（依 CAT_SKILL_GROUPS：heal 均衡／atk 高攻低防／def 高血高防）
const CAT_STATS = {
  // 攻擊組
  haji:     { hp: 180000, atk: 105, def: 45 },
  baobao:   { hp: 195000, atk: 112, def: 48 },
  niuniu:   { hp: 210000, atk: 118, def: 52 },
  // 治癒組
  meimei:   { hp: 175000, atk: 78,  def: 50 },
  gege:     { hp: 190000, atk: 82,  def: 55 },
  daming:   { hp: 200000, atk: 85,  def: 58 },
  // 防禦組
  youyou:   { hp: 220000, atk: 70,  def: 68 },
  xiaoan:   { hp: 235000, atk: 75,  def: 72 },
  diandian: { hp: 250000, atk: 78,  def: 78 },
};

const CAT_BG    = { daming:"#78350f", gege:"#7c2d12", meimei:"#7c2d12", niuniu:"#0f172a", haji:"#78350f", baobao:"#7c2d12", youyou:"#7c2d12", xiaoan:"#78350f", diandian:"#18181b" };

function buildCatBoss(catId, rTierOffset) {
  const cat = CATS[catId];
  const group = CAT_SKILL_GROUPS[catId]; // heal / atk / def
  const stats = CAT_STATS[catId];
  return {
    name: cat.name, title: CAT_TITLES[catId],
    desc: cat.personality,
    hp: stats.hp, atk: stats.atk, def: stats.def, pixelKey: `cat_${catId}`,
    family: "cat", catId, catGroup: group,
    bg: CAT_BG[catId] || "#1c1917", accent: cat.palette?.light || "#fef3c7",
  };
}

export const WORLD_BOSSES = {
  // ── 教練系列（隱藏王，強於 R6）──
  head_coach: {
    name: "主教練",       title: "永恆弓聖",
    desc: "道館最強的存在。傳說從未被任何射手擊敗過，他的每一箭都是天崩地裂的示範。",
    hp: 1100000, atk: 240, def: 130, pixelKey: "head_coach",
    family: "coach", bg: "#0f172a", accent: "#f59e0b",
  },
  wife: {
    name: "師母",         title: "隱世弓后",
    desc: "外表溫柔，實則功力深不可測。見過她真正發怒的人，箭靶上找不到完整的環。",
    hp: 900000, atk: 215, def: 115, pixelKey: "wife",
    family: "coach", bg: "#4a044e", accent: "#f0abfc",
  },
  yumi: {
    name: "YUMI教練",    title: "速射之神",
    desc: "速度快到讓人以為她有三隻手。每次教學課結束，靶場都要更換新靶。",
    hp: 750000, atk: 190, def: 100, pixelKey: "yumi",
    family: "coach", bg: "#064e3b", accent: "#6ee7b7",
  },

  // ── 貓貓系列（9隻真貓，入門王，強度低於 R1）──
  cat_daming:   buildCatBoss("daming"),
  cat_gege:     buildCatBoss("gege"),
  cat_meimei:   buildCatBoss("meimei"),
  cat_niuniu:   buildCatBoss("niuniu"),
  cat_haji:     buildCatBoss("haji"),
  cat_baobao:   buildCatBoss("baobao"),
  cat_youyou:   buildCatBoss("youyou"),
  cat_xiaoan:   buildCatBoss("xiaoan"),
  cat_diandian: buildCatBoss("diandian"),

  // ── 六大族系列（一族2隻：小王=T1~T3代表／大王=T4~T6代表，族與族之間不刻意排序）──
  ghost_boss_small: {
    name: "纏身女鬼",    title: "夜半哭聲",
    desc: "在你收拾器材時，鏡子裡多了一個不是你的影子。她只是想找人陪她說說話，順便討一支箭。",
    hp: 165000, atk: 60, def: 33, pixelKey: "ghost_boss",
    family: "ghost", familyGroup: "ghost", familyTier: "small", bg: "#1e1b4b", accent: "#818cf8",
  },
  ghost_boss: {
    name: "怨靈大君",    title: "千年怨魂",
    desc: "箭場建立前就存在於此。每當有人丟掉靶紙，他就會更憤怒一分。",
    hp: 470000, atk: 155, def: 85, pixelKey: "ghost_boss",
    family: "ghost", familyGroup: "ghost", familyTier: "big", bg: "#1e1b4b", accent: "#818cf8",
  },
  forest_boss_small: {
    name: "山魈頭領",    title: "迷霧引路",
    desc: "帶你走一條「捷徑」的山中精怪，走著走著你就發現自己繞回了原地，牠在旁邊笑得很開心。",
    hp: 120000, atk: 45, def: 25, pixelKey: "forest_boss",
    family: "forest", familyGroup: "forest", familyTier: "small", bg: "#14532d", accent: "#86efac",
  },
  forest_boss: {
    name: "山林守護神",  title: "翠林仙尊",
    desc: "管轄箭場周圍所有樹木。有人說他會移動樹枝讓風向改變，毀掉你的完美一箭。",
    hp: 340000, atk: 115, def: 65, pixelKey: "forest_boss",
    family: "forest", familyGroup: "forest", familyTier: "big", bg: "#14532d", accent: "#86efac",
  },
  poison_boss_small: {
    name: "蜈蚣蜂王",    title: "夏日惡夢",
    desc: "夏天箭場最讓人尖叫的存在，專門挑你拉弓拉到一半、動彈不得的時候出現在手臂上。",
    hp: 100000, atk: 38, def: 22, pixelKey: "poison_boss",
    family: "poison", familyGroup: "poison", familyTier: "small", bg: "#451a03", accent: "#fcd34d",
  },
  poison_boss: {
    name: "毒蟲之母",    title: "蟲族女王",
    desc: "夏天箭場的真正老大。蚊子、蜜蜂全聽她指揮，專門在你拉弓到一半時出現。",
    hp: 280000, atk: 95, def: 55, pixelKey: "poison_boss",
    family: "poison", familyGroup: "poison", familyTier: "big", bg: "#451a03", accent: "#fcd34d",
  },
  office_boss_small: {
    name: "奧客糾察隊長", title: "投訴連環信",
    desc: "還沒開賣就在門口排隊嫌貴，買完立刻上網寫一篇「教練不推薦」，每天準時報到打卡投訴。",
    hp: 190000, atk: 68, def: 37, pixelKey: "office_boss",
    family: "office", familyGroup: "office", familyTier: "small", bg: "#450a0a", accent: "#fca5a5",
  },
  office_boss: {
    name: "職場終極魔王", title: "工時永恆者",
    desc: "用無止盡的加班和報表消耗射手的意志。據說他的技能就是讓你忘記來練習。",
    hp: 550000, atk: 175, def: 95, pixelKey: "office_boss",
    family: "office", familyGroup: "office", familyTier: "big", bg: "#450a0a", accent: "#fca5a5",
  },
  exam_boss_small: {
    name: "期末考魔王",   title: "熬夜復仇者",
    desc: "前一晚熬夜抱佛腳的報應，在你翻開考卷的瞬間降臨——每一題都似曾相識，每一題都不會寫。",
    hp: 140000, atk: 53, def: 29, pixelKey: "exam_boss",
    family: "exam", familyGroup: "exam", familyTier: "small", bg: "#2e1065", accent: "#c4b5fd",
  },
  exam_boss: {
    name: "考試恐懼之神", title: "白卷支配者",
    desc: "出現時，所有人的肌肉記憶都會消失。你的第一直覺永遠是錯的，他保證。",
    hp: 400000, atk: 135, def: 75, pixelKey: "exam_boss",
    family: "exam", familyGroup: "exam", familyTier: "big", bg: "#2e1065", accent: "#c4b5fd",
  },
  western_boss_small: {
    name: "狼人首領",     title: "月圓獵殺",
    desc: "月圓之夜的箭場外圍傳來低吼，牠只是想確認你有沒有準時交作業（誤），還是想吃了你。",
    hp: 230000, atk: 78, def: 43, pixelKey: "western_boss",
    family: "western", familyGroup: "western", familyTier: "small", bg: "#0c1a0c", accent: "#4ade80",
  },
  western_boss: {
    name: "古龍皇帝",     title: "西境霸主",
    desc: "從遠古傳說中走出的龍族王者。弓箭對他而言是玩具，但他尊重真正的射手。",
    hp: 650000, atk: 200, def: 110, pixelKey: "western_boss",
    family: "western", familyGroup: "western", familyTier: "big", bg: "#0c1a0c", accent: "#4ade80",
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
// 每多一位隊友參戰，ATK +5%
export function getParticipantBonus(count) {
  const bonus = count * 0.05;
  return { atkMult: 1 + bonus, defMult: 1 + bonus * 0.3, label: `+${Math.round(bonus * 100)}%` };
}

// ── 天數上限 ──────────────────────────────────────────────────
export const BOSS_DURATION_MAX_DAYS = 30;

// ── 依 Boss 定位分五檔保底獎勵（entry < low < mid < high < top）───
// 貓貓箱牽涉真實徽章碎片，嚴格控制：rank1 最多 1 個，其餘 0
// 最後一擊額外再給 1 個（見 LAST_HIT_EXTRA）
// 六大族不再跨族排序，改用「小王=low／大王=high」；這一套是「保底獎勵」，
// 跟六大族改版新增的 DROP_TABLE_BY_CATEGORY（比例貨幣/寶箱/王卡）是互補關係，不是取代。
export function getRewardTier(boss) {
  if (!boss) return "mid";
  if (boss.family === "coach") return "top";
  if (boss.family === "cat")   return "entry";
  return boss.familyTier === "small" ? "low" : "high";
}

const REWARD_TABLE = {
  top: {
    // 教練系列（隱藏王，最強檔）
    base:    { coins: 150, woodChests: 1 },
    rank1:   { coins: 1200, goldChests: 4, catBoxes: 1, cardChance: 0.40 },
    rank3:   { coins:  700, goldChests: 3, catBoxes: 0, cardChance: 0.20 },
    rankAll: { coins:  400, goldChests: 1, catBoxes: 0, cardChance: 0.08 },
  },
  high: {
    // 六大族 R5~R6
    base:    { coins: 100, woodChests: 1 },
    rank1:   { coins: 800, goldChests: 3, catBoxes: 1, cardChance: 0.30 },
    rank3:   { coins: 500, goldChests: 2, catBoxes: 0, cardChance: 0.15 },
    rankAll: { coins: 300, goldChests: 1, catBoxes: 0, cardChance: 0.05 },
  },
  mid: {
    // 六大族 R3~R4
    base:    { coins:  80, woodChests: 1 },
    rank1:   { coins: 600, goldChests: 2, catBoxes: 0, cardChance: 0.20 },
    rank3:   { coins: 350, goldChests: 1, catBoxes: 0, cardChance: 0.10 },
    rankAll: { coins: 200, goldChests: 0, catBoxes: 0, cardChance: 0.03 },
  },
  low: {
    // 六大族 R1~R2
    base:    { coins:  60, woodChests: 1 },
    rank1:   { coins: 450, goldChests: 2, catBoxes: 0, cardChance: 0.15 },
    rank3:   { coins: 250, goldChests: 1, catBoxes: 0, cardChance: 0.08 },
    rankAll: { coins: 150, goldChests: 0, catBoxes: 0, cardChance: 0.02 },
  },
  entry: {
    // 貓貓系列（入門王，最低檔）
    base:    { coins:  40, woodChests: 1 },
    rank1:   { coins: 300, goldChests: 1, catBoxes: 0, cardChance: 0.10 },
    rank3:   { coins: 180, goldChests: 0, catBoxes: 0, cardChance: 0.05 },
    rankAll: { coins: 100, goldChests: 0, catBoxes: 0, cardChance: 0.01 },
  },
};

export function getRewardByBossKey(bossKey) {
  const boss = WORLD_BOSSES[bossKey];
  return REWARD_TABLE[getRewardTier(boss)];
}

// 預設值（後台手動建立時使用，中檔）
export const DEFAULT_REWARD = REWARD_TABLE.mid;

// 未擊殺但時間到 → 安慰獎
export const CONSOLATION_REWARD = { goldChests: 1, coins: 100 };

// 最後一擊額外獎勵（疊加在分層之上，貓貓箱限 1）
export const LAST_HIT_EXTRA = { catBoxes: 1, cardPacks: 1 };

// ── 六大族改版：三大類（六族小王/六族大王/貓貓/教練）完整掉落表 ──────
// 比例貨幣池：每人依「自己傷害佔全團總傷害%」分配，下限1，不會拿到0
// chestTierRange：[minTier,maxTier] 對照 monsterData.js tier 順序 common/rare/elite/fierce/boss/mythic（1-indexed）
export const DROP_TABLE_BY_CATEGORY = {
  family_small: {
    chestTierRange: [1, 3], // 材料寶箱（該族），不掉金幣寶箱
    coinsPool: 3000, arrowDewPool: 600, archerXPPool: 2000, catXPPool: 600, bondPool: 60,
    wbCardChance: 0.25, scrolls: 1,
  },
  family_big: {
    chestTierRange: [4, 6],
    coinsPool: 6000, arrowDewPool: 1200, archerXPPool: 4000, catXPPool: 1200, bondPool: 120,
    wbCardChance: 0.25, scrolls: 1,
  },
  cat: {
    coinChests: { count: 5, tierRange: [1, 6] }, // 金幣寶箱 lootTable.js::COIN_CHEST_TIERS
    mimiBoxes: 1, catBoxChance: 0.15, cardPacksRange: [1, 3],
    coinsPool: 2000, arrowDewPool: 400, archerXPPool: 1500, catXPPool: 500, bondPool: 50,
    wbCardChance: 0.20, scrolls: 1,
  },
  coach: {
    coinChests: { count: 5, tierRange: [3, 6] },
    mimiBoxes: 1, catBoxChance: 0.25, cardPacksRange: [1, 3],
    materialChests: { count: 10, tierRange: [1, 6] },
    coinsPool: 10000, arrowDewPool: 2000, archerXPPool: 6000, catXPPool: 2000, bondPool: 200,
    wbCardChance: 0.10, scrolls: 1,
  },
};

export function getDropCategory(boss) {
  if (!boss) return "family_big";
  if (boss.family === "coach") return "coach";
  if (boss.family === "cat")   return "cat";
  return boss.familyTier === "small" ? "family_small" : "family_big";
}

// 王卡重複已擁有時改發的等值金幣
export const WB_CARD_DUPLICATE_COINS = 100;
// 沒裝備貓咪時，貓咪經驗/羈絆值改發等值金幣的換算率（1點經驗/羈絆＝多少金幣）
export const WB_NO_CAT_COIN_RATE = 1;

// ── 排名額外獎勵（疊加在均分獎勵之上，不取代）─────────────────
export const RANK_BONUS = {
  1: { coins: 3000, arrowDew: 500, gachaCoins: 10, catBoxes: 1, mimiBoxes: 1 },
  2: { coins: 2000, arrowDew: 250, gachaCoins: 10, catBoxes: 1, mimiBoxes: 1 },
  3: { coins: 1000, arrowDew: 100, gachaCoins: 10, catBoxes: 1, mimiBoxes: 1 },
  lastHit: { arrowDew: 500, mimiBoxes: 1 },
};

// ── 每隻王專屬的收藏獎盃（尾刀+前三名，疊加在 RANK_BONUS 之上，純收藏+成就）──
export const WB_TROPHY_MAP = {};
// 需在 WORLD_BOSSES 定義完成後才能產生，見檔案底部初始化區塊。

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

// ── 六族小王專屬反擊語錄（網路迷因/生活梗，取代通用台詞池）──────
export const BOSS_QUOTES = {
  ghost_boss_small: [
    ["👻", "半夜三點，我來了！"],
    ["😭", "陪我聊聊天嘛……順便給我一支箭"],
    ["🪞", "鏡子裡的不是你，是我啦！"],
  ],
  forest_boss_small: [
    ["🌫️", "這條路我走了八百年，還是會迷路"],
    ["🔄", "恭喜你，又繞回原地了！"],
    ["😏", "捷徑？我從沒說過是近路"],
  ],
  poison_boss_small: [
    ["🦟", "拉弓拉到一半，是我最愛的時機"],
    ["🐝", "別慌，我只是想跟你打招呼"],
    ["🔥", "夏天限定款，你逃不掉的"],
  ],
  office_boss_small: [
    ["📝", "我要客訴！這箭沒有五星服務！"],
    ["☎️", "轉接給你們主管，我要負評"],
    ["💢", "教練不推薦——已上傳網路"],
  ],
  exam_boss_small: [
    ["😱", "這題昨晚才複習過，現在忘了齁？"],
    ["📄", "翻開考卷的瞬間，記憶重置"],
    ["⏰", "剩五分鐘，你確定要用猜的？"],
  ],
  western_boss_small: [
    ["🐺", "月圓之夜，作業交了沒？"],
    ["🌕", "別怕，我只是想跟你玩"],
    ["🐾", "聞到你緊張的味道了"],
  ],
};

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
  slay_cat_daming:   { name: "老大姐剋星",  icon: "🐈", desc: "成功擊殺大娘（萬箭之母）", rarity: "rare" },
  slay_cat_gege:     { name: "橘光獵人",    icon: "🐱", desc: "成功擊殺哥哥（引路橘光）", rarity: "rare" },
  slay_cat_meimei:   { name: "橘影追蹤者",  icon: "🐾", desc: "成功擊殺妹妹（逐箭橘影）", rarity: "rare" },
  slay_cat_niuniu:   { name: "裁判終結者",  icon: "🐄", desc: "成功擊殺妞妞（精準判官）", rarity: "rare" },
  slay_cat_haji:     { name: "夢遊喚醒者",  icon: "😴", desc: "成功擊殺哈吉（夢遊突擊）", rarity: "rare" },
  slay_cat_baobao:   { name: "弓袋征服者",  icon: "🎒", desc: "成功擊殺寶寶（弓袋霸主）", rarity: "rare" },
  slay_cat_youyou:   { name: "鷹眼挑戰者",  icon: "🦅", desc: "成功擊殺悠悠（慢步鷹眼）", rarity: "rare" },
  slay_cat_xiaoan:   { name: "勇氣試煉者",  icon: "🐾", desc: "成功擊殺小安（顫爪不退）", rarity: "rare" },
  slay_cat_diandian: { name: "靈氣破除者",  icon: "🌑", desc: "成功擊殺顛顛（暗影觀氣）", rarity: "rare" },
  slay_ghost_boss_small:   { name: "初驅邪祟",    icon: "👻", desc: "成功擊殺纏身女鬼",   rarity: "rare" },
  slay_ghost_boss:         { name: "驅邪大師",    icon: "👻", desc: "成功擊殺怨靈大君",   rarity: "epic" },
  slay_forest_boss_small:  { name: "迷霧脫困者",  icon: "🌲", desc: "成功擊殺山魈頭領",   rarity: "rare" },
  slay_forest_boss:        { name: "山林征服者",  icon: "🌲", desc: "成功擊殺山林守護神", rarity: "epic" },
  slay_poison_boss_small:  { name: "夏日倖存者",  icon: "🐛", desc: "成功擊殺蜈蚣蜂王",   rarity: "rare" },
  slay_poison_boss:        { name: "蟲族剋星",    icon: "🐛", desc: "成功擊殺毒蟲之母",   rarity: "epic" },
  slay_office_boss_small:  { name: "客訴終結者",  icon: "💼", desc: "成功擊殺奧客糾察隊長", rarity: "rare" },
  slay_office_boss:        { name: "按時下班",    icon: "💼", desc: "成功擊殺職場終極魔王", rarity: "epic" },
  slay_exam_boss_small:    { name: "熬夜倖存者",  icon: "📝", desc: "成功擊殺期末考魔王", rarity: "rare" },
  slay_exam_boss:          { name: "滿分神話",    icon: "📝", desc: "成功擊殺考試恐懼之神", rarity: "epic" },
  slay_western_boss_small: { name: "月下獵人",    icon: "🐉", desc: "成功擊殺狼人首領",   rarity: "rare" },
  slay_western_boss:       { name: "龍族剋星",    icon: "🐉", desc: "成功擊殺古龍皇帝",   rarity: "epic" },
  // 特殊成就
  last_hit:          { name: "終結者",      icon: "⚡", desc: "觸發大 Boss 最後一擊", rarity: "legendary" },
  participate_10:    { name: "世界守護者",  icon: "🌍", desc: "參與 10 次世界大 Boss 挑戰", rarity: "rare" },
  top_damage:        { name: "傷害之王",    icon: "💥", desc: "在一次大 Boss 中造成最高傷害", rarity: "epic" },
};

// ── 每隻王專屬收藏獎盃（尾刀+前三名，存進 member.dungeonCollectibles）────
// 24 隻王 × 2 種 = 48 件，id 格式：{bossKey}_lasthit_trophy / {bossKey}_top3_trophy
for (const [bossKey, boss] of Object.entries(WORLD_BOSSES)) {
  WB_TROPHY_MAP[`${bossKey}_lasthit_trophy`] = {
    id: `${bossKey}_lasthit_trophy`, name: `${boss.name}・絕殺印`, icon: "⚡",
    desc: `給予「${boss.name}」最後一擊的證明，只有終結牠的人才配擁有。`,
    bossKey, kind: "lastHit",
  };
  WB_TROPHY_MAP[`${bossKey}_top3_trophy`] = {
    id: `${bossKey}_top3_trophy`, name: `${boss.name}・討伐勳章`, icon: "🎖️",
    desc: `在「${boss.name}」戰役中傷害位列前三名的證明。`,
    bossKey, kind: "top3",
  };
}

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
export function simulateBotRound(bot, bossAtk, bossDef, playerAtk = 80) {
  let dmg = 0;
  const arrows = [];
  for (let i = 0; i < 6; i++) {
    const score = Math.max(0, Math.round((bot.avgScore + (Math.random() * 4 - 2))));
    const atk   = Math.round(playerAtk * bot.atkMult);
    const base  = 8 + atk * 0.7 + score * 1.2 - bossDef * 0.35;
    const mult  = 0.85 + Math.random() * 0.3;
    const hit   = Math.max(0, Math.round(base * mult));
    dmg += hit;
    arrows.push({ label: score === 0 ? "M" : String(score), score, dmg: hit });
  }
  return { dmg, arrows };
}
