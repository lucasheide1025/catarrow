// src/lib/randomEvents.js
// 打怪隨機事件池

// type: "buff"=對玩家有利 / "debuff"=對玩家不利 / "neutral"=中性有趣
// effect: { archerHP, archerATK, monsterHP, extraDmg, skipCounter, healArcher }
export const RANDOM_EVENTS = [

  // ── 教練介入（有利）──
  { id: "coach_stab",    type: "buff",    icon: "🎯", title: "教練補刀！",
    desc: "教練從旁邊默默射了一箭，「這支算你的。」怪物直接受到 30 傷害！",
    effect: { extraDmg: 30 } },
  { id: "coach_block",   type: "buff",    icon: "🛡️", title: "教練擋下反擊！",
    desc: "教練拿弓打了殭屍的腳，這回合反擊無效！",
    effect: { skipCounter: true } },
  { id: "coach_cheer",   type: "buff",    icon: "📣", title: "教練大喊加油！",
    desc: "「你可以的！」ATK 本回合 +12！",
    effect: { archerATK: 12 } },
  { id: "coach_cure",    type: "buff",    icon: "💊", title: "教練遞來能量棒",
    desc: "「先補充體力。」回復 25 HP。",
    effect: { healArcher: 25 } },

  // ── 環境事件（有利）──
  { id: "aircon_fixed",  type: "buff",    icon: "❄️", title: "空調突然好了！",
    desc: "室溫下降，手不再抖，ATK +15！",
    effect: { archerATK: 15 } },
  { id: "cat_distract",  type: "buff",    icon: "🐱", title: "貓咪衝向怪物！",
    desc: "胖胖衝上去咬了殭屍一口，怪物直接失血 30 HP！",
    effect: { monsterHP: -30 } },
  { id: "audience_hype", type: "buff",    icon: "👏", title: "觀眾瘋狂加油！",
    desc: "全場鼓掌，氣勢大漲，ATK 本回合 +12！",
    effect: { archerATK: 12 } },
  { id: "bubble_tea",    type: "buff",    icon: "🧋", title: "喝了一口珍奶",
    desc: "甜甜的珍珠奶茶，回復 35 HP！",
    effect: { healArcher: 35 } },

  // ── 玩家狀態（有利）──
  { id: "hot_hand",      type: "buff",    icon: "🔥", title: "手感爆發！",
    desc: "今天手感神準，ATK 本回合大幅提升 +20！",
    effect: { archerATK: 20 } },
  { id: "salary_thought",type: "buff",    icon: "💰", title: "突然想到薪水",
    desc: "想到下個月薪水，怒火湧現，ATK +18！",
    effect: { archerATK: 18 } },
  { id: "zone",          type: "buff",    icon: "🧘", title: "進入心流狀態",
    desc: "雜念全消，ATK +25，如有神助！",
    effect: { archerATK: 25 } },

  // ── 怪物事件（有利）──
  { id: "zombie_slip",   type: "buff",    icon: "🍌", title: "殭屍踩到香蕉皮！",
    desc: "殭屍滑倒，這回合反擊無效！",
    effect: { skipCounter: true } },
  { id: "zombie_self",   type: "buff",    icon: "🤕", title: "殭屍自殘",
    desc: "殭屍不小心咬了自己，失血 40 HP！",
    effect: { monsterHP: -40 } },
  { id: "zombie_sneeze", type: "buff",    icon: "🤧", title: "殭屍打噴嚏",
    desc: "殭屍打了個超大噴嚏，呆了一回合，反擊無效！",
    effect: { skipCounter: true } },

  // ── 環境事件（不利）──
  { id: "power_cut",     type: "debuff",  icon: "🔌", title: "突然停電！",
    desc: "燈全滅，靶在黑暗中，ATK 本回合 -15！",
    effect: { archerATK: -15 } },
  { id: "sweaty_hands",  type: "debuff",  icon: "💦", title: "手汗發作",
    desc: "空調壞了，手全是汗，ATK 本回合 -12！",
    effect: { archerATK: -12 } },
  { id: "phone_ring",    type: "debuff",  icon: "📱", title: "手機突然響",
    desc: "媽媽來電，分心了，這回合 ATK -10！",
    effect: { archerATK: -10 } },
  { id: "rent_up",       type: "debuff",  icon: "🏠", title: "包租婆漲租金！",
    desc: "想到漲租，心情崩潰，HP -20！",
    effect: { archerHP: -20 } },

  // ── 玩家狀態（不利）──
  { id: "blank_mind",    type: "debuff",  icon: "😶", title: "腦袋突然空白",
    desc: "突然忘記怎麼射箭，ATK 本回合 -18！",
    effect: { archerATK: -18 } },
  { id: "hungry",        type: "debuff",  icon: "🍱", title: "肚子餓了",
    desc: "下午沒吃東西，體力下滑，HP -15！",
    effect: { archerHP: -15 } },
  { id: "cramp",         type: "debuff",  icon: "😣", title: "手抽筋！",
    desc: "突然手指抽筋，ATK 本回合 -15！",
    effect: { archerATK: -15 } },

  // ── 怪物強化（不利）──
  { id: "zombie_berserk",type: "debuff",  icon: "😡", title: "殭屍狂暴化！",
    desc: "殭屍憤怒值爆表，猛衝過來，你受到 25 傷害！",
    effect: { archerHP: -25 } },
  { id: "zombie_shield", type: "debuff",  icon: "🪨", title: "殭屍撿到石頭",
    desc: "殭屍舉起石頭打傷自己順手補了 25 HP！",
    effect: { monsterHP: 25 } },

  // ── 中性搞笑 ──
  { id: "photographer",  type: "neutral", icon: "📸", title: "有人在拍照",
    desc: "旁邊有人在拍抖音，你帥帥地射出一箭，ATK +10！",
    effect: { archerATK: 10 } },
  { id: "cute_cat",      type: "neutral", icon: "😸", title: "哈吉在旁邊喵",
    desc: "哈吉喵了一聲給你加油，心情好了，HP 回復 20！",
    effect: { healArcher: 20 } },
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
