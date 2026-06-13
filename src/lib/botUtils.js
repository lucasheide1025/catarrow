// src/lib/botUtils.js — AI 機器人共用工具

// 組隊打怪（PvE）：較高數值，機器人是隊友
export const PARTY_BOT_STATS = {
  easy:   { hp: 250, atk: 7,  def: 7,  label: "🐣 練習" },
  normal: { hp: 380, atk: 10, def: 9,  label: "🤖 普通" },
  hard:   { hp: 480, atk: 14, def: 11, label: "🔥 強力" },
};

// 決鬥模式（PvP）：對齊 balanceDuelStats 輸出範圍（HP 200~280, ATK 5~14, DEF 2~7）
export const DUEL_BOT_STATS = {
  easy:   { hp: 210, atk: 6,  def: 3,  label: "🐣 練習" },
  normal: { hp: 240, atk: 9,  def: 5,  label: "🤖 普通" },
  hard:   { hp: 272, atk: 13, def: 7,  label: "🔥 強力" },
};

// 向下相容（組隊用）
export const BOT_STATS = PARTY_BOT_STATS;

export const BOT_NAMES = {
  easy:   ["🐣 新手弓手", "🐣 練習機器人", "🐣 木偶射手"],
  normal: ["🤖 普通機器人", "🤖 機器弓手", "🤖 自動射手"],
  hard:   ["🔥 菁英機器人", "🔥 強力弓手", "🔥 鐵牌射手"],
};

export function generateBotArrows(difficulty = "normal", count = 6) {
  // [M, 7, 8, 9, 10] 的機率分佈
  const weights = {
    easy:   [0.12, 0.20, 0.28, 0.22, 0.18],
    normal: [0.05, 0.10, 0.20, 0.30, 0.35],
    hard:   [0.02, 0.05, 0.13, 0.30, 0.50],
  };
  const w = weights[difficulty] || weights.normal;
  const entries = [
    { score: 0,  label: "M"  },
    { score: 7,  label: "7"  },
    { score: 8,  label: "8"  },
    { score: 9,  label: "9"  },
    { score: 10, label: "10" },
  ];
  return Array.from({ length: count }, () => {
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < w.length; i++) {
      cum += w[i];
      if (r < cum) return entries[i];
    }
    return entries[4];
  });
}

export function makeBotId() {
  return `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

export function randomBotName(difficulty) {
  const list = BOT_NAMES[difficulty] || BOT_NAMES.normal;
  return list[Math.floor(Math.random() * list.length)];
}
