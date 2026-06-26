// src/lib/runeData.js — 地下城符文系統

export const RUNES = [
  {
    id:    "revival_1",
    name:  "復活符文",
    grade: "rare",
    icon:  "💫",
    desc:  "陣亡時自動復活，回復 20% 最大血量（只發生一次）",
    effect:{ type:"revival", value:0.2, count:1 },
    color: "#a78bfa",
  },
  {
    id:    "revival_2",
    name:  "多重復活符文",
    grade: "epic",
    icon:  "✨",
    desc:  "陣亡時可復活兩次，每次回復 20% 最大血量",
    effect:{ type:"revival", value:0.2, count:2 },
    color: "#c084fc",
  },
  {
    id:    "atk_up",
    name:  "強攻符文",
    grade: "uncommon",
    icon:  "⚔️",
    desc:  "攻擊力 +15%",
    effect:{ type:"atk_mult", value:1.15 },
    color: "#f87171",
  },
  {
    id:    "def_up",
    name:  "守護符文",
    grade: "uncommon",
    icon:  "🛡️",
    desc:  "受到傷害 -15%",
    effect:{ type:"def_mult", value:1.15 },
    color: "#60a5fa",
  },
  {
    id:    "cat_boost",
    name:  "貓靈符文",
    grade: "rare",
    icon:  "🐾",
    desc:  "貓貓陪練傷害 +25%",
    effect:{ type:"cat_atk_mult", value:1.25 },
    color: "#fb923c",
  },
  {
    id:    "dmg_up",
    name:  "暴烈符文",
    grade: "uncommon",
    icon:  "🔥",
    desc:  "所有傷害 +10%",
    effect:{ type:"dmg_mult", value:1.1 },
    color: "#f59e0b",
  },
  {
    id:    "hp_up",
    name:  "生命符文",
    grade: "uncommon",
    icon:  "❤️",
    desc:  "最大血量 +20%",
    effect:{ type:"hp_mult", value:1.2 },
    color: "#4ade80",
  },
];

export const RUNE_GRADES = {
  uncommon: { label:"普通", color:"#9ca3af" },
  rare:     { label:"稀有", color:"#60a5fa" },
  epic:     { label:"史詩", color:"#a78bfa" },
};

export function getRuneById(id) {
  return RUNES.find(r => r.id === id) || null;
}
