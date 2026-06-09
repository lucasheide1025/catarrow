// src/lib/randomEvents.js
// 打怪隨機事件池

// type: "buff"=對玩家有利 / "debuff"=對玩家不利 / "neutral"=中性有趣
// effect: { archerHP, archerATK, archerDEF, monsterHP, skipCounter, extraDmg, healArcher, bonusDice }
export const RANDOM_EVENTS = [

  // ── 教練介入（有利）──
  { id: "coach_stab",    type: "buff",    icon: "🎯", title: "教練補刀！",
    desc: "教練從旁邊默默射了一箭，「這支算你的。」",
    effect: { extraDmg: 8 } },
  { id: "coach_block",   type: "buff",    icon: "🛡️", title: "教練擋下反擊！",
    desc: "教練拿弓打了殭屍的腳，這回合反擊無效！",
    effect: { skipCounter: true } },
  { id: "coach_cheer",   type: "buff",    icon: "📣", title: "教練大喊加油！",
    desc: "「你可以的！」ATK 本回合 +5！",
    effect: { archerATK: 5 } },
  { id: "coach_cure",    type: "buff",    icon: "💊", title: "教練遞來能量棒",
    desc: "「先補充體力。」回復 10 HP。",
    effect: { healArcher: 10 } },

  // ── 環境事件（有利）──
  { id: "aircon_fixed",  type: "buff",    icon: "❄️", title: "空調突然好了！",
    desc: "室溫下降，手不再抖，骰子 +2！",
    effect: { bonusDice: 2 } },
  { id: "cat_distract",  type: "buff",    icon: "🐱", title: "貓咪衝向怪物！",
    desc: "胖胖衝上去咬了殭屍一口，怪物 -8 HP！",
    effect: { monsterHP: -8 } },
  { id: "audience_hype", type: "buff",    icon: "👏", title: "觀眾瘋狂加油！",
    desc: "全場鼓掌，氣勢大漲，ATK 本回合 +4！",
    effect: { archerATK: 4 } },
  { id: "bubble_tea",    type: "buff",    icon: "🧋", title: "喝了一口珍奶",
    desc: "甜甜的珍珠奶茶，回復 15 HP！",
    effect: { healArcher: 15 } },

  // ── 玩家狀態（有利）──
  { id: "hot_hand",      type: "buff",    icon: "🔥", title: "手感爆發！",
    desc: "今天手感神準，骰子 +3！",
    effect: { bonusDice: 3 } },
  { id: "salary_thought",type: "buff",    icon: "💰", title: "突然想到薪水",
    desc: "想到下個月薪水，怒火湧現，ATK +6！",
    effect: { archerATK: 6 } },
  { id: "zone",          type: "buff",    icon: "🧘", title: "進入心流狀態",
    desc: "雜念全消，骰子 +4，如有神助！",
    effect: { bonusDice: 4 } },

  // ── 怪物事件（有利）──
  { id: "zombie_slip",   type: "buff",    icon: "🍌", title: "殭屍踩到香蕉皮！",
    desc: "殭屍滑倒，這回合反擊無效！",
    effect: { skipCounter: true } },
  { id: "zombie_self",   type: "buff",    icon: "🤕", title: "殭屍自殘",
    desc: "殭屍不小心咬了自己，失血 12 HP！",
    effect: { monsterHP: -12 } },
  { id: "zombie_sneeze", type: "buff",    icon: "🤧", title: "殭屍打噴嚏",
    desc: "殭屍打了個超大噴嚏，呆了一回合，反擊無效！",
    effect: { skipCounter: true } },

  // ── 環境事件（不利）──
  { id: "power_cut",     type: "debuff",  icon: "🔌", title: "突然停電！",
    desc: "燈全滅，靶在黑暗中，骰子 -2！",
    effect: { bonusDice: -2 } },
  { id: "sweaty_hands",  type: "debuff",  icon: "💦", title: "手汗發作",
    desc: "空調壞了，手全是汗，骰子 -2！",
    effect: { bonusDice: -2 } },
  { id: "phone_ring",    type: "debuff",  icon: "📱", title: "手機突然響",
    desc: "媽媽來電，分心了，這回合 ATK -3！",
    effect: { archerATK: -3 } },
  { id: "rent_up",       type: "debuff",  icon: "🏠", title: "包租婆漲租金！",
    desc: "想到漲租，心情低落，HP -8！",
    effect: { archerHP: -8 } },

  // ── 玩家狀態（不利）──
  { id: "blank_mind",    type: "debuff",  icon: "😶", title: "腦袋突然空白",
    desc: "突然忘記怎麼射箭，骰子 -3！",
    effect: { bonusDice: -3 } },
  { id: "hungry",        type: "debuff",  icon: "🍱", title: "肚子餓了",
    desc: "下午沒吃東西，體力下滑，HP -5！",
    effect: { archerHP: -5 } },
  { id: "cramp",         type: "debuff",  icon: "😣", title: "手抽筋！",
    desc: "突然手指抽筋，ATK 本回合 -4！",
    effect: { archerATK: -4 } },

  // ── 怪物強化（不利）──
  { id: "zombie_berserk",type: "debuff",  icon: "😡", title: "殭屍狂暴化！",
    desc: "殭屍憤怒值爆表，本回合反擊傷害 ×1.5！",
    effect: { counterMult: 1.5 } },
  { id: "zombie_shield", type: "debuff",  icon: "🪨", title: "殭屍撿到石頭",
    desc: "殭屍舉起石頭當盾，DEF 本回合 +5！",
    effect: { monsterDEF: 5 } },

  // ── 中性搞笑 ──
  { id: "photographer",  type: "neutral", icon: "📸", title: "有人在拍照",
    desc: "旁邊有人在拍抖音，你帥帥地射出一箭，骰子 +1！",
    effect: { bonusDice: 1 } },
  { id: "cute_cat",      type: "neutral", icon: "😸", title: "哈吉在旁邊喵",
    desc: "哈吉喵了一聲給你加油，心情好了，HP +5！",
    effect: { healArcher: 5 } },
];

// 每回合觸發機率（0~1）
export const EVENT_CHANCE = 0.2;

// 隨機抽一個事件
export function drawRandomEvent() {
  return RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
}

// 判斷是否觸發
export function shouldTriggerEvent() {
  return Math.random() < EVENT_CHANCE;
}
