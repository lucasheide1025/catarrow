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

// ── 決鬥專屬事件池（靶場競技情境）────────────────────────────
export const DUEL_EVENTS = [

  // 傷害加成
  { id: "d_tailwind",   type: "buff",    icon: "💨", title: "順風！",
    desc: "風向突然有利，箭矢飛得又快又準，本回合全員傷害 +20！",
    effect: { extraDmg: 20 } },
  { id: "d_hot_hand",   type: "buff",    icon: "🔥", title: "全員手感爆發！",
    desc: "今天不知為何所有人都手感神準，本回合全員傷害 +22！",
    effect: { extraDmg: 22 } },
  { id: "d_crowd",      type: "buff",    icon: "👏", title: "觀眾起立鼓掌！",
    desc: "觀眾全體起立，掌聲震天，氣勢大漲，本回合全員傷害 +25！",
    effect: { extraDmg: 25 } },
  { id: "d_silence",    type: "buff",    icon: "🔕", title: "靶場靜默！",
    desc: "靶場突然一片死寂，所有人注意力完全集中，本回合全員傷害 +18！",
    effect: { extraDmg: 18 } },
  { id: "d_adrenaline", type: "buff",    icon: "⚡", title: "腎上腺素飆升！",
    desc: "決鬥進入白熱化，所有人腎上腺素暴衝，本回合全員傷害 +30！",
    effect: { extraDmg: 30 } },
  { id: "d_photo",      type: "neutral", icon: "📸", title: "有人在拍片！",
    desc: "場邊有人開直播，大家都帥帥地射出這輪，本回合傷害 +10！",
    effect: { extraDmg: 10 } },
  { id: "d_rain",       type: "neutral", icon: "🌧️", title: "轉移室內！",
    desc: "外面突然下大雨，改到室內靶場，視野更好，本回合全員傷害 +12！",
    effect: { extraDmg: 12 } },
  { id: "d_coach_fire", type: "buff",    icon: "📣", title: "教練點火！",
    desc: "教練突然大吼：「不行你們今天要分出高下！」，本回合全員傷害 +15！",
    effect: { extraDmg: 15 } },

  // 回血
  { id: "d_water",      type: "buff",    icon: "🧋", title: "中場補水！",
    desc: "比賽暫停補充水分，喝個珍奶，雙方全員回復 35 HP！",
    effect: { healArcher: 35 } },
  { id: "d_energy",     type: "buff",    icon: "🍫", title: "能量棒補給！",
    desc: "場邊工作人員送來能量棒，雙方全員回復 25 HP！",
    effect: { healArcher: 25 } },
  { id: "d_ice",        type: "buff",    icon: "🩹", title: "教練緊急冰敷！",
    desc: "教練拿出冰袋幫大家冰敷手腕，雙方全員回復 30 HP！",
    effect: { healArcher: 30 } },
  { id: "d_stretch",    type: "buff",    icon: "🤸", title: "中場拉筋！",
    desc: "裁判宣布短暫休息，大家伸展放鬆，雙方全員回復 20 HP！",
    effect: { healArcher: 20 } },
  { id: "d_aircon",     type: "neutral", icon: "❄️", title: "空調修好了！",
    desc: "靶場空調終於修好，溫度舒適，雙方全員回復 20 HP！",
    effect: { healArcher: 20 } },
  { id: "d_cat",        type: "neutral", icon: "🐱", title: "哈吉亂入！",
    desc: "道館的貓突然衝進靶場，繞了一圈又跑掉，全場笑翻，雙方全員回復 15 HP！",
    effect: { healArcher: 15 } },

  // 純效果/中性
  { id: "d_phone",      type: "neutral", icon: "📱", title: "手機突然響！",
    desc: "有人忘記靜音，全場尷尬 3 秒，本回合無特殊效果，繼續！",
    effect: {} },
  { id: "d_headwind",   type: "debuff",  icon: "🌬️", title: "逆風干擾！",
    desc: "突然吹起強烈逆風，雙方箭矢都受到干擾，本回合無特殊效果。",
    effect: {} },
  { id: "d_mistarget",  type: "debuff",  icon: "🎯", title: "靶子跑掉了！",
    desc: "靶架被風吹歪，裁判重新固定，雙方都沒有額外效果。",
    effect: {} },

  // 叛變（決鬥專屬特殊）
  { id: "betrayal",     type: "duel_special", icon: "🗡️", title: "隊員叛變！",
    desc: "有人突然倒戈！兩隊各有一名成員強制交換！",
    effect: {} },
];

// 每回合觸發機率（0~1）
export const EVENT_CHANCE = 0.2;

// 隨機抽一個事件
export function drawRandomEvent(mode = "monster") {
  const pool = mode === "duel" ? DUEL_EVENTS : RANDOM_EVENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 判斷是否觸發
export function shouldTriggerEvent() {
  return Math.random() < EVENT_CHANCE;
}
