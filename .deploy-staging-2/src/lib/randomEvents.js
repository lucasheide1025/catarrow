// src/lib/randomEvents.js
// type: "buff"=有利 / "debuff"=不利 / "neutral"=中性
// effect: { archerHP, archerATK, monsterHP, extraDmg, skipCounter, healArcher }

export const RANDOM_EVENTS = [

  // ── 教練介入（有利）──
  { id: "coach_stab",    type: "buff",    icon: "🎯", title: "教練補刀！",
    desc: "「讓我來！」教練從側邊默默補了一箭，怪物直接失血 30！",
    effect: { extraDmg: 30 } },
  { id: "coach_block",   type: "buff",    icon: "🛡️", title: "教練擋下反擊！",
    desc: "教練拿弓撥開了怪物的爪子，「先別管我，繼續射！」本回合反擊無效！",
    effect: { skipCounter: true } },
  { id: "coach_cheer",   type: "buff",    icon: "📣", title: "教練大喊加油！",
    desc: "「來啊！你可以的！放！」一聲吼，全身力量爆發，ATK 本回合 +12！",
    effect: { archerATK: 12 } },
  { id: "coach_cure",    type: "buff",    icon: "💊", title: "教練遞來能量棒",
    desc: "「先補體力，射箭靠的是持久力。」一口氣吃掉，HP 回復 25！",
    effect: { healArcher: 25 } },

  // ── 環境事件（有利）──
  { id: "aircon_fixed",  type: "buff",    icon: "❄️", title: "空調突然好了！",
    desc: "「維修終於到了！」室溫驟降，汗水消失，手不再抖，ATK +15！",
    effect: { archerATK: 15 } },
  { id: "cat_distract",  type: "buff",    icon: "🐱", title: "貓咪衝向怪物！",
    desc: "「哈吉！你幹嘛—」貓咪不管三七二十一衝上去，怪物被嚇到失血 30！",
    effect: { monsterHP: -30 } },
  { id: "audience_hype", type: "buff",    icon: "👏", title: "觀眾瘋狂加油！",
    desc: "全場突然集體鼓掌，震耳欲聾，氣勢暴漲，ATK 本回合 +12！",
    effect: { archerATK: 12 } },
  { id: "bubble_tea",    type: "buff",    icon: "🧋", title: "喝了一口珍奶",
    desc: "「謝謝！」珍珠一顆一顆Q彈下肚，甜甜的，HP 回復 35！",
    effect: { healArcher: 35 } },

  // ── 玩家狀態（有利）──
  { id: "hot_hand",      type: "buff",    icon: "🔥", title: "手感爆發！",
    desc: "今天不知為何每箭都帶著火焰，手感神準，ATK 本回合大幅提升 +20！",
    effect: { archerATK: 20 } },
  { id: "salary_thought",type: "buff",    icon: "💰", title: "突然想到薪水",
    desc: "「等等，下個月還有獎金！」怒火一湧而上，ATK 暴漲 +18！",
    effect: { archerATK: 18 } },
  { id: "zone",          type: "buff",    icon: "🧘", title: "進入心流狀態",
    desc: "呼吸變得極規律，眼前只剩靶心在無限放大…雜念全消，ATK +25，如有神助！",
    effect: { archerATK: 25 } },

  // ── 怪物事件（有利）──
  { id: "zombie_slip",   type: "buff",    icon: "🍌", title: "殭屍踩到香蕉皮！",
    desc: "「咻——啪！」殭屍高速滑倒，兩眼發直，這回合反擊無效！",
    effect: { skipCounter: true } },
  { id: "zombie_self",   type: "buff",    icon: "🤕", title: "殭屍自殘",
    desc: "殭屍不小心咬了自己的手指，「咬壞了！」慌亂中失血 40！",
    effect: { monsterHP: -40 } },
  { id: "zombie_sneeze", type: "buff",    icon: "🤧", title: "殭屍打噴嚏",
    desc: "「哈啾——！！」殭屍打了個驚天大噴嚏，整個人呆了一回合，反擊無效！",
    effect: { skipCounter: true } },

  // ── 環境事件（不利）──
  { id: "power_cut",     type: "debuff",  icon: "🔌", title: "突然停電！",
    desc: "「蛤？！」燈全滅，靶消失在黑暗中，眼睛調適中……ATK 本回合 -15！",
    effect: { archerATK: -15 } },
  { id: "sweaty_hands",  type: "debuff",  icon: "💦", title: "手汗發作",
    desc: "空調當機，室溫飆升，弓把滑如塗油，ATK 本回合 -12！",
    effect: { archerATK: -12 } },
  { id: "phone_ring",    type: "debuff",  icon: "📱", title: "手機突然響",
    desc: "「媽媽你待會再打！」分心了整整三秒，ATK 本回合 -10！",
    effect: { archerATK: -10 } },
  { id: "rent_up",       type: "debuff",  icon: "🏠", title: "包租婆漲租金！",
    desc: "「漲多少？！」腦子裡開始算錢，心情大崩，HP -20！",
    effect: { archerHP: -20 } },

  // ── 玩家狀態（不利）──
  { id: "blank_mind",    type: "debuff",  icon: "😶", title: "腦袋突然空白",
    desc: "「呃…弓是怎麼拉的來著？」瞬間忘記技術，ATK 本回合 -18！",
    effect: { archerATK: -18 } },
  { id: "hungry",        type: "debuff",  icon: "🍱", title: "肚子餓了",
    desc: "「下午到底有沒有吃東西？」體力急速滑落，HP -15！",
    effect: { archerHP: -15 } },
  { id: "cramp",         type: "debuff",  icon: "😣", title: "手抽筋！",
    desc: "「啊啊啊！」手指突然鎖死，疼痛難忍，ATK 本回合 -15！",
    effect: { archerATK: -15 } },

  // ── 怪物強化（不利）──
  { id: "zombie_berserk",type: "debuff",  icon: "😡", title: "殭屍狂暴化！",
    desc: "「嗷嗚—！！」殭屍怒目圓睜，全速衝刺，直接撞上來造成 25 傷害！",
    effect: { archerHP: -25 } },
  { id: "zombie_shield", type: "debuff",  icon: "🪨", title: "殭屍撿到石頭",
    desc: "殭屍舉起路邊的大石頭，往自己腦袋一拍補血，同時順手砸你 HP +25（怪物回血）！",
    effect: { monsterHP: 25 } },

  // ── 中性搞笑 ──
  { id: "photographer",  type: "neutral", icon: "📸", title: "有人在拍照",
    desc: "「你等一下！讓我擺個帥的姿勢——」鏡頭前的壓力反而激發潛能，ATK +10！",
    effect: { archerATK: 10 } },
  { id: "cute_cat",      type: "neutral", icon: "😸", title: "哈吉在旁邊喵",
    desc: "哈吉走過來，對著你「喵——」一聲，然後繼續走。心情莫名變好，HP 回復 20！",
    effect: { healArcher: 20 } },

];

// ── 決鬥專屬事件池 ────────────────────────────────────────
export const DUEL_EVENTS = [

  // 傷害加成
  { id: "d_tailwind",   type: "buff",    icon: "💨", title: "順風！",
    desc: "風向突然有利，箭矢穿空而過，速度與準度俱佳，本回合全員傷害 +20！",
    effect: { extraDmg: 20 } },
  { id: "d_hot_hand",   type: "buff",    icon: "🔥", title: "全員手感爆發！",
    desc: "今天不知道水土有什麼問題，所有人手感都神準，本回合全員傷害 +22！",
    effect: { extraDmg: 22 } },
  { id: "d_crowd",      type: "buff",    icon: "👏", title: "觀眾起立鼓掌！",
    desc: "「嘩——！」全場起立，掌聲如雷，雙方氣勢都大漲，本回合全員傷害 +25！",
    effect: { extraDmg: 25 } },
  { id: "d_silence",    type: "buff",    icon: "🔕", title: "靶場靜默！",
    desc: "靶場突然落針可聞，所有人注意力完全凝聚，本回合全員傷害 +18！",
    effect: { extraDmg: 18 } },
  { id: "d_adrenaline", type: "buff",    icon: "⚡", title: "腎上腺素飆升！",
    desc: "決鬥進入白熱化，「現在——是關鍵！」腎上腺素暴衝，本回合全員傷害 +30！",
    effect: { extraDmg: 30 } },
  { id: "d_photo",      type: "neutral", icon: "📸", title: "有人在直播！",
    desc: "場邊架起了手機開直播，所有人都不想在鏡頭前丟臉，本回合傷害 +10！",
    effect: { extraDmg: 10 } },
  { id: "d_rain",       type: "neutral", icon: "🌧️", title: "移到室內靶場！",
    desc: "外面突然傾盆大雨，改到室內視野更好，感覺準度提升了，本回合全員傷害 +12！",
    effect: { extraDmg: 12 } },
  { id: "d_coach_fire", type: "buff",    icon: "📣", title: "教練點火！",
    desc: "「你們今天必須分出高下！去！」在教練咆哮聲中，本回合全員傷害 +15！",
    effect: { extraDmg: 15 } },

  // 回血
  { id: "d_water",      type: "buff",    icon: "🧋", title: "中場補水！",
    desc: "「先停一下，補充水分！」珍奶一口氣喝掉，雙方全員回復 35 HP！",
    effect: { healArcher: 35 } },
  { id: "d_energy",     type: "buff",    icon: "🍫", title: "能量棒補給！",
    desc: "場邊工作人員跑來送補給，「撐住啊！」雙方全員回復 25 HP！",
    effect: { healArcher: 25 } },
  { id: "d_ice",        type: "buff",    icon: "🩹", title: "教練緊急冰敷！",
    desc: "「手腕冰一下，不然等下抽筋！」教練強制冰敷，雙方全員回復 30 HP！",
    effect: { healArcher: 30 } },
  { id: "d_stretch",    type: "buff",    icon: "🤸", title: "中場拉筋！",
    desc: "裁判宣布短暫休息，大家伸展放鬆，「啊～」舒服，雙方全員回復 20 HP！",
    effect: { healArcher: 20 } },
  { id: "d_aircon",     type: "neutral", icon: "❄️", title: "空調修好了！",
    desc: "靶場空調終於修好，冷風吹來，身體舒適，雙方全員回復 20 HP！",
    effect: { healArcher: 20 } },
  { id: "d_cat",        type: "neutral", icon: "🐱", title: "哈吉亂入！",
    desc: "道館的貓突然衝進靶場，繞了三圈又自己跑走，全場笑翻，雙方全員回復 15 HP！",
    effect: { healArcher: 15 } },

  // 純效果/中性
  { id: "d_phone",      type: "neutral", icon: "📱", title: "手機突然響！",
    desc: "「誰的！！！」全場尷尬三秒。沒有特殊效果，但氣氛輕鬆了許多，繼續！",
    effect: {} },
  { id: "d_headwind",   type: "debuff",  icon: "🌬️", title: "強風逆向吹！",
    desc: "「這什麼鬼天氣！」強烈逆風亂了準心，雙方均無法獲得本回合加成。",
    effect: {} },
  { id: "d_mistarget",  type: "debuff",  icon: "🎯", title: "靶架被風吹歪！",
    desc: "靶架歪了，裁判跑去重新固定。「等一下！」本回合無特殊效果，稍事休息。",
    effect: {} },

  // 特殊決鬥事件
  { id: "betrayal",     type: "duel_special", icon: "🗡️", title: "隊員叛變！",
    desc: "「我不幹了！換隊！」有人突然倒戈，兩隊各有一名成員強制交換！",
    effect: {} },
];

export const EVENT_CHANCE = 0.2;

export function drawRandomEvent(mode = "monster") {
  const pool = mode === "duel" ? DUEL_EVENTS : RANDOM_EVENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function shouldTriggerEvent() {
  return Math.random() < EVENT_CHANCE;
}
