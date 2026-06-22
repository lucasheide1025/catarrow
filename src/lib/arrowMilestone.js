// src/lib/arrowMilestone.js
// 固定門檻：每天每個門檻只觸發一次，不循環
const ALL_MILESTONES = [
  { arrows:   6, catBoxes: 0, label: "6箭！" },
  { arrows:  12, catBoxes: 0, label: "12箭！" },
  { arrows:  24, catBoxes: 0, label: "24箭！" },
  { arrows:  30, catBoxes: 0, label: "30箭！" },
  { arrows:  60, catBoxes: 0, label: "60箭！" },
  { arrows:  90, catBoxes: 0, label: "90箭！" },
  { arrows: 120, catBoxes: 1, label: "120箭！百箭勇者！" },
  { arrows: 150, catBoxes: 0, label: "150箭！" },
  { arrows: 180, catBoxes: 0, label: "180箭！" },
  { arrows: 200, catBoxes: 0, label: "200箭！" },
  { arrows: 240, catBoxes: 1, label: "240箭！超人射手！" },
];

// 傳入今日舊箭數、新箭數，回傳中間跨越的里程碑（每個門檻只算一次）
export function getMilestonesReached(oldTotal, newTotal) {
  if (newTotal <= oldTotal || newTotal <= 0) return [];
  return ALL_MILESTONES.filter(m => oldTotal < m.arrows && newTotal >= m.arrows);
}

export function getRewardsForMilestone(ms) {
  return { gachaCoins: 1, catBoxes: ms.catBoxes || 0 };
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
