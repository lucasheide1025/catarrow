// src/lib/arrowMilestone.js
// 固定門檻：每天每個門檻只觸發一次，不循環
// 2026-07-19 使用者改版：改成每 30 箭一階、共 16 階（30~480）。
// 每階固定給 轉蛋幣×1 ＋ 箭露 30，另外依段落給寶箱與建築包：
//   30/60/90    木寶箱   ×1、金幣木寶箱   ×1、T1 建築包 ×1
//   120         咪咪箱×1、木寶箱   ×5、金幣木寶箱   ×5、T1 建築包 ×5
//   150/180/210 鐵寶箱   ×1、金幣鐵寶箱   ×1、T2 建築包 ×1
//   240         咪咪箱×1、貓貓箱×1、鐵寶箱×5、金幣鐵寶箱×5、T2 建築包 ×5
//   270/300/330 黃金寶箱 ×1、金幣黃金寶箱 ×1、T3 建築包 ×1
//   360         咪咪箱×1、貓貓箱×1、黃金寶箱×5、金幣黃金寶箱×5、T3 建築包 ×5
//   390/420/450 神話寶箱 ×1、金幣神話寶箱 ×1、T4 建築包 ×1
//   480         咪咪箱×1、貓貓箱×1、神話寶箱×5、金幣神話寶箱×5、T4 建築包 ×5
// 480 之後不再有門檻 —— 使用者規格「你該休息了」，由 REST_MESSAGE 呈現。
const ARROWDEW_PER_MILESTONE = 30;

// chestType：材料寶箱類型（itemData.CHEST_TYPES）
// coinTier：金幣寶箱階級（lootTable.COIN_CHEST_TIERS）——「金幣黃金寶箱」對應
//   fierce（金幣金寶箱）、神話對應 mythic（金幣傳說寶箱），這兩階最貼近使用者的說法
const STEP_WOOD   = { chestType:"wood",   coinTier:"common", packTier:1 };
const STEP_IRON   = { chestType:"iron",   coinTier:"rare",   packTier:2 };
const STEP_GOLD   = { chestType:"gold",   coinTier:"fierce", packTier:3 };
const STEP_MYTHIC = { chestType:"mythic", coinTier:"mythic", packTier:4 };

// 一般階：各 ×1；大關（每段第 4 階）：各 ×5 並附咪咪箱／貓貓箱
const normalStep = (arrows, step, label) => ({
  arrows, label, ...step,
  chestCount:1, coinChestCount:1, packCount:1, mimiBoxes:0, catBoxes:0,
});
// type:"big" 會讓前台走全螢幕慶祝（BigMilestonePopup）。
// ⚠️ 舊版資料表沒有任何一筆帶 type，所以那個慶祝畫面實際上從來沒被觸發過 ——
// 現在四個大關（120/240/360/480）才會全螢幕，其餘走頂部 toast，不干擾練習節奏。
const bigStep = (arrows, step, label, catBoxes = 1) => ({
  arrows, label, type:"big", ...step,
  chestCount:5, coinChestCount:5, packCount:5, mimiBoxes:1, catBoxes,
});

export const ALL_MILESTONES = [
  normalStep(30,  STEP_WOOD,   "30箭！開始了！"),
  normalStep(60,  STEP_WOOD,   "60箭！"),
  normalStep(90,  STEP_WOOD,   "90箭！"),
  // 120 是第一個大關，使用者規格只給咪咪箱（貓貓箱從 240 起才有）
  bigStep(120,    STEP_WOOD,   "120箭！百箭勇者！", 0),
  normalStep(150, STEP_IRON,   "150箭！"),
  normalStep(180, STEP_IRON,   "180箭！"),
  normalStep(210, STEP_IRON,   "210箭！"),
  bigStep(240,    STEP_IRON,   "240箭！超人射手！"),
  normalStep(270, STEP_GOLD,   "270箭！"),
  normalStep(300, STEP_GOLD,   "300箭！三百之壁！"),
  normalStep(330, STEP_GOLD,   "330箭！"),
  bigStep(360,    STEP_GOLD,   "360箭！黃金射手！"),
  normalStep(390, STEP_MYTHIC, "390箭！"),
  normalStep(420, STEP_MYTHIC, "420箭！"),
  normalStep(450, STEP_MYTHIC, "450箭！"),
  bigStep(480,    STEP_MYTHIC, "480箭！神話級的一天！"),
];

// 最後一個門檻之後就該收工了（使用者規格）
export const FINAL_MILESTONE_ARROWS = 480;
export const REST_MESSAGE = "你該休息了 🌙 今天的練習已經非常充足，讓身體記住這份手感吧。";

// 傳入今日舊箭數、新箭數，回傳中間跨越的里程碑（每個門檻只算一次）
export function getMilestonesReached(oldTotal, newTotal) {
  if (newTotal <= oldTotal || newTotal <= 0) return [];
  return ALL_MILESTONES.filter(m => oldTotal < m.arrows && newTotal >= m.arrows);
}

export function getRewardsForMilestone(ms) {
  return {
    gachaCoins: 1,
    arrowdew: ARROWDEW_PER_MILESTONE,
    mimiBoxes: ms.mimiBoxes || 0,
    catBoxes: ms.catBoxes || 0,
    chestType: ms.chestType || null,
    chestCount: ms.chestCount || 0,
    coinTier: ms.coinTier || null,
    coinChestCount: ms.coinChestCount || 0,
    packTier: ms.packTier || null,
    packCount: ms.packCount || 0,
  };
}

const WARM_MESSAGES = [
  "每一次拉弓，都是在練習信任自己。",
  "今天的箭，正在塑造明天更穩的手。",
  "不用完美，你只需要持續出現在靶場。",
  "累積的每一支箭，都是你給自己的禮物。",
  "你做到了！這種堅持，才是最強的技術。",
  "射箭從來不是跟別人比，而是跟昨天的自己比。",
  "今天來了，就已經很棒了。",
  "射箭是讓身心放慢的魔法，謝謝你給自己這段時間。",
  "每一支箭落點，都是你今天留下的證明。",
  "累積的不只是箭，還有你對自己的信心。",
  "哇！又多射了幾支，箭靶表示壓力很大 😄",
  "你的弓現在一定很開心被使用了！",
  "一箭一箭的累積，這就是射手的路。",
  "放鬆，呼吸，放手——你已經做得很好了。",
  "每次練習都讓你離心中那個最好的自己近一步。",
];

const BIG_MESSAGES = [
  "今天的你，把 {N} 支箭全都留在了靶場。這是一種很勇敢的事。",
  "射了 {N} 支箭。不是因為你必須，而是因為你選擇來這裡。這已經很了不起。",
  "{N} 支箭！你的身體記住了今天每一次拉弓的感覺，明天的你會更好。",
  "一百支箭之後，什麼叫做專注、什麼叫做放鬆——你今天都親身體驗到了。你值得好好休息。",
];

export function getWarmMessage() {
  return WARM_MESSAGES[Math.floor(Math.random() * WARM_MESSAGES.length)];
}

export function getBigMessage(totalArrows) {
  const msg = BIG_MESSAGES[Math.floor(Math.random() * BIG_MESSAGES.length)];
  return msg.replace("{N}", totalArrows);
}
