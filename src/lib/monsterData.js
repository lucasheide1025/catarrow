// src/lib/monsterData.js
// 六族36隻怪物 + 射手數值公式 + 匹配系統
import { calcEquipBonus, getCertLevelByScores } from "./constants";
import { getAllEquipmentRuneBonus } from "./equipmentRuneData";
import { archerLevelBonus } from "./archerLevel";

// ── 階級定義 ─────────────────────────────────────────────
export const TIER_LABEL = {
  common:    { label:"普通",   color:"#6b7280", bg:"#f3f4f6" },
  rare:      { label:"稀有",   color:"#3b82f6", bg:"#eff6ff" },
  elite:     { label:"精英",   color:"#8b5cf6", bg:"#f5f3ff" },
  fierce:    { label:"強悍",   color:"#f97316", bg:"#fff7ed" },
  boss:      { label:"頭目",   color:"#ef4444", bg:"#fef2f2" },
  mythic:    { label:"神話",   color:"#fbbf24", bg:"#fffbeb" },
};

// ── 六大家族定義 ──────────────────────────────────────────
export const FAMILIES = {
  ghost:     { label:"鬼怪族", icon:"👻", color:"#6366f1" },
  mountain:  { label:"山林族", icon:"🏔️", color:"#16a34a" },
  insect:    { label:"毒蟲族", icon:"🦂", color:"#ca8a04" },
  workplace: { label:"職場族", icon:"💼", color:"#dc2626" },
  exam:      { label:"考試族", icon:"📝", color:"#7c3aed" },
  temple:    { label:"西方怪物族", icon:"🏰", color:"#ea580c" },
  treasure:  { label:"寶箱族",   icon:"📦", color:"#fbbf24" },
};

// ── 36隻怪物 ─────────────────────────────────────────────
export const MONSTERS = [

  // ════ 鬼怪族 ════
  {
    id:"ghost_1", family:"ghost", tier:"common",
    name:"鏡幕幽姬", icon:"👻",
    hp:250, atk:20, def:14,
    desc:"以薄霧幽鏡護身的初階靈姬，安靜守望陰陽交界。",
  },
  {
    id:"ghost_2", family:"ghost", tier:"rare",
    name:"霧徑幻姬", icon:"🌀",
    hp:400, atk:35, def:24,
    desc:"穿行霧徑的幻術使，會悄悄扭轉旅人的方向。",
  },
  {
    id:"ghost_3", family:"ghost", tier:"elite",
    name:"林投守姬", icon:"🌿",
    hp:650, atk:55, def:40,
    desc:"持鐮守護林投幽境的靈姬，能號令葉影迎敵。",
  },
  {
    id:"ghost_4", family:"ghost", tier:"fierce",
    name:"幽城女判", icon:"⚖️",
    hp:1000, atk:82, def:68,
    desc:"執掌幽城判牒與裁決短刃，追索所有未結之案。",
  },
  {
    id:"ghost_5", family:"ghost", tier:"boss",
    name:"海誓靈姬", icon:"🐺",
    hp:1600, atk:125, def:105,
    desc:"守望海崖古祠的誓約靈姬，以鈴聲維繫不滅誓火。",
  },
  {
    id:"ghost_6", family:"ghost", tier:"mythic",
    name:"幽府判令姬", icon:"👹",
    hp:2500, atk:175, def:155,
    desc:"手持魂鑰與判令的幽府使者，能將亡魂送回既定之路。",
  },

  // ════ 山林族 ════
  {
    id:"mountain_1", family:"mountain", tier:"common",
    name:"竹徑採露女", icon:"🎋",
    hp:270, atk:18, def:15,
    desc:"穿行竹徑採集晨露的清秀女子，會以竹筒潑灑露水迎敵。",
  },
  {
    id:"mountain_2", family:"mountain", tier:"rare",
    name:"青簍藥獵", icon:"🌿",
    hp:432, atk:32, def:26,
    desc:"背負青藤藥簍的山林藥師，以短弩射出麻痺藥矢。",
  },
  {
    id:"mountain_3", family:"mountain", tier:"elite",
    name:"鹿鈴祝女", icon:"🔔",
    hp:702, atk:51, def:43,
    desc:"手持鹿鈴杖的古林祝女，以鈴音擾亂入林者的步伐。",
  },
  {
    id:"mountain_4", family:"mountain", tier:"fierce",
    name:"紫晶峰衛", icon:"🛡️",
    hp:1080, atk:75, def:73,
    desc:"駐守高山堡寨的紫晶重衛，能以長盾反震來襲攻勢。",
  },
  {
    id:"mountain_5", family:"mountain", tier:"boss",
    name:"金茸靈獸使", icon:"🐾",
    hp:1728, atk:115, def:113,
    desc:"披著金茸的傳說馭獸使，與唯一的靈獸伙伴默契共擊。",
  },
  {
    id:"mountain_6", family:"mountain", tier:"mythic",
    name:"星瀑司雨姬", icon:"🌧️",
    hp:2700, atk:161, def:167,
    desc:"掌管天嶺星雨的神女，揮動長兵便能引落星瀑與風雨。",
  },

  // ════ 毒蟲族 ════
  {
    id:"insect_1", family:"insect", tier:"common",
    name:"大蟑螂", icon:"🪳",
    hp:213, atk:23, def:12,
    desc:"台灣最強生存者，打不死的神話。",
  },
  {
    id:"insect_2", family:"insect", tier:"rare",
    name:"虎頭蜂", icon:"🐝",
    hp:340, atk:40, def:20,
    desc:"台灣山林頭號殺手，蜂群一出無人生還。",
  },
  {
    id:"insect_3", family:"insect", tier:"elite",
    name:"蜈蚣精", icon:"🐛",
    hp:553, atk:63, def:34,
    desc:"百腳精怪，毒液能腐蝕一切，令人聞風喪膽。",
  },
  {
    id:"insect_4", family:"insect", tier:"fierce",
    name:"蠍子王", icon:"🦂",
    hp:850, atk:94, def:58,
    desc:"毒刺一揮，五臟俱毀，連神明都要退三步。",
  },
  {
    id:"insect_5", family:"insect", tier:"boss",
    name:"蜘蛛女王", icon:"🕷️",
    hp:1360, atk:144, def:89,
    desc:"織出命運之網，凡落網者皆逃不過宿命。",
  },
  {
    id:"insect_6", family:"insect", tier:"mythic",
    name:"蟲神", icon:"🦋",
    hp:2125, atk:201, def:132,
    desc:"所有蟲類的神祇，萬蟲朝聖，天地變色。",
  },

  // ════ 職場族 ════
  {
    id:"workplace_1", family:"workplace", tier:"common",
    name:"奧客", icon:"😤",
    hp:250, atk:22, def:14,
    desc:"無理取鬧專業戶，投訴書寫到手抽筋。",
  },
  {
    id:"workplace_2", family:"workplace", tier:"rare",
    name:"爛主管", icon:"🗣️",
    hp:400, atk:38, def:24,
    desc:"PUA語錄信手拈來，讓你懷疑人生的那種。",
  },
  {
    id:"workplace_3", family:"workplace", tier:"elite",
    name:"壞老闆", icon:"💸",
    hp:650, atk:59, def:40,
    desc:"畫餅充飢大師，承諾從不兌現，年終永遠0元。",
  },
  {
    id:"workplace_4", family:"workplace", tier:"fierce",
    name:"黑心包租婆", icon:"🏚️",
    hp:1000, atk:89, def:68,
    desc:"每個月準時漲租，浴室有謎之內衣三年未取。",
  },
  {
    id:"workplace_5", family:"workplace", tier:"boss",
    name:"財閥總裁", icon:"🤵",
    hp:1600, atk:135, def:105,
    desc:"壟斷市場、操控輿論，笑容背後是無盡的算計。",
  },
  {
    id:"workplace_6", family:"workplace", tier:"mythic",
    name:"資本魔王", icon:"💰",
    hp:2500, atk:189, def:155,
    desc:"剝削制度的化身，讓打工人永遠無法翻身的終極BOSS。",
  },

  // ════ 考試族 ════
  {
    id:"exam_1", family:"exam", tier:"common",
    name:"小考", icon:"📝",
    hp:238, atk:19, def:13,
    desc:"突然宣布的小考，讓你昨晚的遊戲白打了。",
  },
  {
    id:"exam_2", family:"exam", tier:"rare",
    name:"段考", icon:"📚",
    hp:380, atk:33, def:23,
    desc:"三個月的努力在這兩天決勝負，壓力山大。",
  },
  {
    id:"exam_3", family:"exam", tier:"elite",
    name:"期末考", icon:"😱",
    hp:618, atk:52, def:38,
    desc:"所有科目同時來臨，睡眠成為奢侈品。",
  },
  {
    id:"exam_4", family:"exam", tier:"fierce",
    name:"學測魔王", icon:"🎯",
    hp:950, atk:78, def:65,
    desc:"十二年寒窗的終極審判，一試定終身的殘酷。",
  },
  {
    id:"exam_5", family:"exam", tier:"boss",
    name:"國考煉獄", icon:"📜",
    hp:1520, atk:119, def:100,
    desc:"考了五年還在考，人生黃金歲月全押在這裡。",
  },
  {
    id:"exam_6", family:"exam", tier:"mythic",
    name:"升學制度本體", icon:"🏫",
    hp:2375, atk:166, def:147,
    desc:"無法打倒的終極存在，它不是怪物，它是系統。",
  },

  // ════ 西方怪物族 ════
  {
    id:"temple_1", family:"temple", tier:"common",
    name:"哥布林", icon:"👺",
    hp:263, atk:21, def:15,
    desc:"西方森林裡的小型魔物，貪財又狡猾，成群結隊偷襲旅人。",
  },
  {
    id:"temple_2", family:"temple", tier:"rare",
    name:"骷髏劍士", icon:"💀",
    hp:420, atk:37, def:25,
    desc:"從墓地爬出的不死戰士，揮舞生鏽長劍，越夜越強。",
  },
  {
    id:"temple_3", family:"temple", tier:"elite",
    name:"狼人", icon:"🐺",
    hp:683, atk:58, def:42,
    desc:"月圓之夜化身狼形，速度與利爪令獵人聞風喪膽。",
  },
  {
    id:"temple_4", family:"temple", tier:"fierce",
    name:"吸血鬼伯爵", icon:"🧛",
    hp:1050, atk:86, def:71,
    desc:"古堡中的不死貴族，優雅外表下藏著嗜血的獠牙。",
  },
  {
    id:"temple_5", family:"temple", tier:"boss",
    name:"巫妖王", icon:"🧙",
    hp:1680, atk:131, def:110,
    desc:"捨棄肉身追求永生的大法師，麾下亡靈大軍聽令行事。",
  },
  {
    id:"temple_6", family:"temple", tier:"mythic",
    name:"末日惡龍", icon:"🐉",
    hp:2625, atk:184, def:163,
    desc:"噴吐烈焰的西方巨龍，所到之處化為焦土，勇者的終極試煉。",
  },


  // ════ 寶箱族 ════
  {
    id:"treasure_1", family:"treasure", tier:"common",
    name:"寶箱怪", icon:"📦",
    hp:100, atk:5, def:15,
    desc:"偽裝成寶箱的怪物，不會攻擊只會防禦，打開它會噴出金幣。",
  },
  {
    id:"treasure_2", family:"treasure", tier:"rare",
    name:"黃金寶箱怪", icon:"📦",
    hp:180, atk:8, def:30,
    desc:"鍍金的寶箱怪，防禦力更高，擊破後獲得大量金幣。",
  },
  {
    id:"treasure_3", family:"treasure", tier:"elite",
    name:"鑽石寶箱怪", icon:"💎",
    hp:280, atk:12, def:50,
    desc:"鑲滿鑽石的寶箱怪，堅硬無比，擊破獎勵豐厚。",
  },
  {
    id:"treasure_4", family:"treasure", tier:"fierce",
    name:"祕銀寶箱怪", icon:"📦",
    hp:420, atk:18, def:85,
    desc:"祕銀打造的寶箱怪，傳說擊破它能獲得稀有收藏品。",
  },
  {
    id:"treasure_5", family:"treasure", tier:"boss",
    name:"遠古寶箱怪", icon:"🗡️",
    hp:650, atk:25, def:130,
    desc:"存在千年的遠古寶箱怪，守護著無數珍寶，攻擊力不高但極難擊破。",
  },
  {
    id:"treasure_6", family:"treasure", tier:"mythic",
    name:"神話寶箱巨像", icon:"👑",
    hp:1000, atk:35, def:190,
    desc:"傳說中的終極寶箱巨像，擊破它將獲得無法想像的財富與寶物。",
  },

  // ════ 寶箱族·真（不會反擊，只是打起來比較久）════
  {
    id:"treasure_1_real", family:"treasure", tier:"common",
    name:"安分寶箱怪", icon:"📦",
    hp:80, atk:1, def:20,
    desc:"貨真價實的寶箱，完全不會反擊，輕鬆打開就有金幣。",
  },
  {
    id:"treasure_2_real", family:"treasure", tier:"rare",
    name:"安分黃金寶箱怪", icon:"📦",
    hp:140, atk:1, def:35,
    desc:"鍍金但性情溫和的寶箱怪，不會反擊，防禦力較高。",
  },
  {
    id:"treasure_3_real", family:"treasure", tier:"elite",
    name:"安分鑽石寶箱怪", icon:"💎",
    hp:220, atk:1, def:60,
    desc:"鑲滿鑽石卻毫無敵意的寶箱怪，堅硬但不會還手。",
  },
  {
    id:"treasure_4_real", family:"treasure", tier:"fierce",
    name:"安分祕銀寶箱怪", icon:"📦",
    hp:340, atk:1, def:95,
    desc:"祕銀打造、性情溫馴的寶箱怪，慢慢打就能擊破。",
  },
  {
    id:"treasure_5_real", family:"treasure", tier:"boss",
    name:"安分遠古寶箱怪", icon:"🗡️",
    hp:500, atk:1, def:150,
    desc:"存在千年卻毫無攻擊性的遠古寶箱怪，防禦極高但完全不會反擊。",
  },
  {
    id:"treasure_6_real", family:"treasure", tier:"mythic",
    name:"安分神話寶箱巨像", icon:"👑",
    hp:800, atk:1, def:220,
    desc:"傳說中溫馴的終極寶箱巨像，堅不可摧但從不主動攻擊。",
  },

  // ════ 寶箱族·王（隱藏地下城王房專屬，不進入一般寶箱怪抽池）════
  // 小王、大王各自都有 T1~T6 完整強度曲線，避免低難度地城遇到過強的固定版本
  { id:"treasure_king_small_1", family:"treasure", tier:"common", isKing:true,
    name:"寶箱小王", icon:"👑", hp:120, atk:6, def:18,
    desc:"低階隱藏地下城的守護者，擊敗後獲得大量金幣、材料與寶物。" },
  { id:"treasure_king_small_2", family:"treasure", tier:"rare", isKing:true,
    name:"寶箱小王", icon:"👑", hp:215, atk:10, def:35,
    desc:"低階隱藏地下城的守護者，擊敗後獲得大量金幣、材料與寶物。" },
  { id:"treasure_king_small_3", family:"treasure", tier:"elite", isKing:true,
    name:"寶箱小王", icon:"👑", hp:335, atk:14, def:60,
    desc:"低階隱藏地下城的守護者，擊敗後獲得大量金幣、材料與寶物。" },
  { id:"treasure_king_small_4", family:"treasure", tier:"fierce", isKing:true,
    name:"寶箱小王", icon:"👑", hp:505, atk:22, def:100,
    desc:"低階隱藏地下城的守護者，擊敗後獲得大量金幣、材料與寶物。" },
  { id:"treasure_king_small_5", family:"treasure", tier:"boss", isKing:true,
    name:"寶箱小王", icon:"👑", hp:780, atk:30, def:155,
    desc:"低階隱藏地下城的守護者，擊敗後獲得大量金幣、材料與寶物。" },
  { id:"treasure_king_small_6", family:"treasure", tier:"mythic", isKing:true,
    name:"寶箱小王", icon:"👑", hp:1200, atk:42, def:230,
    desc:"低階隱藏地下城的守護者，擊敗後獲得大量金幣、材料與寶物。" },

  { id:"treasure_king_big_1", family:"treasure", tier:"common", isKing:true,
    name:"寶箱大王", icon:"👑", hp:160, atk:8, def:25,
    desc:"高階隱藏地下城的終極守護者，擊敗後獲得海量獎勵與稀有符文。" },
  { id:"treasure_king_big_2", family:"treasure", tier:"rare", isKing:true,
    name:"寶箱大王", icon:"👑", hp:290, atk:13, def:48,
    desc:"高階隱藏地下城的終極守護者，擊敗後獲得海量獎勵與稀有符文。" },
  { id:"treasure_king_big_3", family:"treasure", tier:"elite", isKing:true,
    name:"寶箱大王", icon:"👑", hp:450, atk:19, def:80,
    desc:"高階隱藏地下城的終極守護者，擊敗後獲得海量獎勵與稀有符文。" },
  { id:"treasure_king_big_4", family:"treasure", tier:"fierce", isKing:true,
    name:"寶箱大王", icon:"👑", hp:670, atk:29, def:135,
    desc:"高階隱藏地下城的終極守護者，擊敗後獲得海量獎勵與稀有符文。" },
  { id:"treasure_king_big_5", family:"treasure", tier:"boss", isKing:true,
    name:"寶箱大王", icon:"👑", hp:1040, atk:40, def:210,
    desc:"高階隱藏地下城的終極守護者，擊敗後獲得海量獎勵與稀有符文。" },
  { id:"treasure_king_big_6", family:"treasure", tier:"mythic", isKing:true,
    name:"寶箱大王", icon:"👑", hp:1600, atk:56, def:305,
    desc:"高階隱藏地下城的終極守護者，擊敗後獲得海量獎勵與稀有符文。" },
];

// ── 身體部位（殭屍靶紙模式）────────────────────────────
export const BODY_PARTS = [
  { id:"head",   name:"頭部",   icon:"💀", mult:1.25, locked:false },
  { id:"neck",   name:"頸部",   icon:"🎯", mult:1.20, locked:false },
  { id:"chest",  name:"胸腔",   icon:"❤️", mult:1.10, locked:false },
  { id:"belly",  name:"腹部",   icon:"🫁", mult:1.05, locked:false },
  { id:"arm",    name:"手臂",   icon:"💪", mult:1.0, locked:false },
  { id:"groin",  name:"鼠蹊",   icon:"⚡", mult:1.15, locked:false },
  { id:"heart",  name:"心臟",   icon:"❤️‍🔥", mult:1.50, locked:true  }, // 需先命中胸腔
  { id:"lung",   name:"肺葉",   icon:"🫁", mult:1.35, locked:true  }, // 需先命中胸腔
  { id:"kidney", name:"腎臟",   icon:"🫘", mult:1.30, locked:true  }, // 需先命中腹部
  { id:"balls",  name:"要害",   icon:"💥", mult:1.40, locked:true  }, // 需先命中鼠蹊
  { id:"miss",   name:"脫靶",   icon:"💨", mult:0,   locked:false },
];

// ── 依分數判定命中部位 ───────────────────────────────────
// isX = true → X 環，保證頭/頸（一定爆擊）；10 = 一定命中。
// 1~9 全部命中，只有 M（score=0）才是脫靶。

// Map 查詢比 Array.find 更穩定，避免 find 因任何原因回傳 undefined
const _BP_MAP = {};
for (const p of BODY_PARTS) { _BP_MAP[p.id] = p; }
// 查不到就保底用手臂，徹底杜絕 undefined
const _bp = id => _BP_MAP[id] || _BP_MAP["arm"] || BODY_PARTS[4];
const _pick = pool => _bp(pool[Math.floor(Math.random() * pool.length)]);

export function resolveHitPart(score, unlockedParts, isX = false) {
  const unlocked = unlockedParts instanceof Set ? unlockedParts : new Set(unlockedParts || []);

  if (score === 0) return _bp("miss");

  // X 環：保證命中頭部或頸部（一定爆擊）
  if (isX) {
    if (unlocked.has("chest") && Math.random() < 0.35)
      return _bp(Math.random() < 0.5 ? "heart" : "lung");
    return _bp(Math.random() < 0.5 ? "head" : "neck");
  }

  // 10 分：一定命中，不脫靶，命中高等部位
  if (score === 10) {
    if (unlocked.has("chest") && Math.random() < 0.30)
      return _bp(Math.random() < 0.5 ? "heart" : "lung");
    if (unlocked.has("groin") && Math.random() < 0.25)
      return _bp("balls");
    return _pick(["head","neck","groin","chest"]);
  }

  // 8~9 分：中上部位
  if (score >= 8) {
    if (unlocked.has("chest") && Math.random() < 0.15)
      return _bp(Math.random() < 0.5 ? "heart" : "lung");
    if (unlocked.has("belly") && Math.random() < 0.12)
      return _bp("kidney");
    return _pick(["chest","neck","belly","arm","groin"]);
  }

  // 5~7 分：中等部位
  if (score >= 5) return _pick(["belly","arm","chest"]);

  // 1~4 分：低等部位
  return _pick(["arm","belly"]);
}

// ── 傷害公式 ─────────────────────────────────────────────
// 射手 ATK 上限 160、怪物 DEF 上限 120
// 分數 0~10，傷害範圍設計在 5~200
export function calcDamage({ score, archerATK, monsterDEF, partMult }) {
  if (!score || partMult === 0) return 0;
  const base = 8 + archerATK * 0.7 + score * 1.2 - monsterDEF * 0.35;
  const dmg  = Math.max(1, Math.round(base * partMult * (0.85 + Math.random() * 0.3)));
  return dmg;
}

// 怪物反擊傷害
export function calcCounterDamage({ monsterATK, archerDEF, headStunned, isCrit }) {
  let base = monsterATK * 0.6 - archerDEF * 0.4 + 5;
  if (headStunned) base *= 0.5;
  if (isCrit)      base *= 1.8;
  return Math.max(1, Math.round(base * (0.8 + Math.random() * 0.4)));
}

// ── 射手數值計算 ─────────────────────────────────────────
// HP 上限 400 / ATK 上限 160 / DEF 上限 120
/**
 * 🏅 實體榮譽加成（三種章）—— **不設上限**。
 *
 * ⚠️ 這一層**刻意放在三圍夾制之外**（見 calcArcherStats 末段），跟等級加成同一層。
 *    放進夾制裡的話，老手早就頂到天花板，再拿章完全沒有感覺。
 *
 * ⚠️ **不設上限是作者的決定**（2026-08-03）：「我就是煞車，而且這遊戲會繼續往上攀升」。
 *    章是教練親手發的實體徽章，發放速度本身就是節流閥；而遊戲數值本來就會隨改版成長。
 *    → **不要因為「看起來會通膨」就自己加回上限。**
 *
 * ⚠️ 難度排序（作者確認，不要從點數權重推）：
 *      🐱 肥貓章 最難 → ATK，單顆最重
 *      🏆 積分章 中間 → DEF
 *      🏅 成就章 最好拿 → HP（HP 單位大、又會被等級稀釋，權重實際最輕）
 */
export const HONOR_BONUS_PER_BADGE = Object.freeze({
  fatCat:      { bronze: 1, silver: 4, gold: 12 },            // → ATK
  score:       { bronze: 1, silver: 3, gold: 9 },             // → DEF
  achievement: { silver: 3, gold: 8, black: 15 },             // → HP
});

const badgeSum = (owned, table) =>
  Object.entries(table).reduce((sum, [rank, value]) => sum + (Number(owned?.[rank]) || 0) * value, 0);

/** 三種章換算成三圍。回傳的是**要加在夾制之外**的量。 */
export function calcHonorBonus(member) {
  return {
    hp:  badgeSum(member?.achievement, HONOR_BONUS_PER_BADGE.achievement),
    atk: badgeSum(member?.fatCat, HONOR_BONUS_PER_BADGE.fatCat),
    def: badgeSum(member?.score, HONOR_BONUS_PER_BADGE.score),
  };
}

/**
 * 🎯 射手證（`certification.level`）。⚠️ 跟三弓檢定 `certRecords` 是**兩回事**。
 *
 * 作者定案（2026-08-03）：
 *   藍證 → ATK +10、DEF +10、HP +100
 *   金證 → 藍證的量 **再額外 ×1.05**
 *
 * ⚠️ 跟三種章一樣放在**三圍夾制之外**。放進去的話老手頂到天花板就完全沒感覺。
 * ⚠️ 金證的 5% 是乘在 **calcArcherStats 的回傳值**上（含三種章），
 *    但**不含等級加成**——那一層是在外面加的，這裡碰不到。
 *    要讓 5% 也吃到等級加成，得改所有戰鬥呼叫點，目前刻意不做。
 */
export const CERT_BONUS = Object.freeze({
  flat: { hp: 100, atk: 10, def: 10 },
  goldMultiplier: 1.05,
});

/** 有沒有射手證（藍或金都算） */
const hasCert = level => level === "blue" || level === "gold";

/** 把射手證套到已經算完的三圍上。⚠️ 一定要在所有夾制之後呼叫。 */
export function applyCertBonus(stats, certification) {
  const level = certification?.level;
  if (!hasCert(level)) return { ...stats };
  const { flat, goldMultiplier } = CERT_BONUS;
  const mult = level === "gold" ? goldMultiplier : 1;
  return {
    hp:  Math.round((stats.hp  + flat.hp)  * mult),
    atk: Math.round((stats.atk + flat.atk) * mult),
    def: Math.round((stats.def + flat.def) * mult),
  };
}

export function calcArcherStats({ member, certification, certRecords, dexStats }) {
  const joinYear  = member?.joinDate ? new Date(member.joinDate).getFullYear() : new Date().getFullYear();
  const ageYears  = Math.max(0, new Date().getFullYear() - joinYear);

  // ── HP ──────────────────────────────────────────────────
  // 基礎 100 + 圖鑑/8（上限+30）
  // + 報到次數/4（上限+30）+ 成就章分/5（上限+25）
  // + 飾品欄位數×3（上限+20）+ 射齡×5（上限+30）
  let hp = 200;
  if (dexStats) hp += Math.min(30, Math.floor(dexStats.totalUnlocked / 8));
  const checkinCount = member?.dailyQuestCount || 0;
  hp += Math.min(30, Math.floor(checkinCount / 4));
  const accSlots = (member?.accessorySets || []).reduce((s,set) => s + Object.values(set).filter(Boolean).length, 0);
  hp += Math.min(20, accSlots * 3);
  hp += Math.min(30, ageYears * 5);
  hp = Math.min(800, hp);

  // ── ATK ─────────────────────────────────────────────────
  // 基礎 15 + 肥貓章分/4（上限+30）+ 三弓檢定總等×3（上限+40）
  // + 弓組欄位數×4（上限+30）+ 賽事積分/10（上限+20）
  // + 報到任務/5（上限+25）
  let atk = 15;
  const certLevelScore = (certRecords || []).reduce((s, r) => {
    const lv = { 入門:1, 初級:2, 中級:3, 進階:4, 精英:5, 菁英:5 };
    // ⚠️ 舊資料沒有 level 欄位（upsertCertRecord 以前只存 score）→
    //    用分數現算，否則「考了檢定但 ATK 完全沒加」的 bug 會留在老會員身上。
    const lvName = r.level || getCertLevelByScores(r.bowType, r.score) || null;
    return s + (lv[lvName] || 0);
  }, 0);
  // 🎯 射手證：×3 上限 40（維持原值——ATK 的額度要讓給更難的肥貓章）
  atk += Math.min(40, certLevelScore * 3);
  const bowSlots = (member?.equipment || []).length;
  atk += Math.min(30, bowSlots * 4);
  atk += Math.min(20, Math.floor((member?.eventPoints||0) / 10));
  atk += Math.min(30, Math.floor(checkinCount / 5));
  atk = Math.min(160, atk);

  // ── DEF ─────────────────────────────────────────────────
  // 基礎 10 + 積分章分/4（上限+30）+ 防具欄位數×3（上限+30）
  // + 射齡×4（上限+20）+ 期數生+（上限+15）
  let def = 10;
  const armorSlots = (member?.armorSets || []).reduce((s,set) => s + Object.values(set).filter(v=>v&&typeof v==="string"&&v.trim()).length, 0);
  def += Math.min(30, armorSlots * 3);
  // 射齡 25 → 20，讓出 5 點給積分章（⚠️ DEF 各項上限總和必須剛好等於天花板 120）
  def += Math.min(20, ageYears * 4);
  if (dexStats?.cohortBonus) def += Math.min(15, dexStats.cohortBonus);
  def = Math.min(120, def);

  // ── RPG 裝備加成 ─────────────────────────────────────────
  const equip = calcEquipBonus(member?.rpgEquip);
  hp  = Math.min(800, hp  + equip.hpBonus);
  atk = Math.min(160, atk + equip.atkBonus);
  def = Math.min(120, def + equip.defBonus);
  const runeBonus = getAllEquipmentRuneBonus(member?.rpgEquip);
  hp  = Math.min(800, Math.round(hp  * (1 + runeBonus.hp)));
  atk = Math.min(160, Math.round(atk * (1 + runeBonus.atk)));
  def = Math.min(120, Math.round(def * (1 + runeBonus.def)));

  // ── 🏅 實體榮譽（三種章）：**夾制之外、不設上限** ────────────
  // ⚠️ 一定要在所有 Math.min 之後才加。放進去的話老手早就頂到天花板，
  //    再拿章完全沒有感覺——那正是 2026-08-03 之前的狀況。
  const honor = calcHonorBonus(member);
  hp  += honor.hp;
  atk += honor.atk;
  def += honor.def;

  // ── 🎯 射手證：藍證固定量、金證再 ×1.05（同樣在夾制之外）────
  return applyCertBonus({ hp, atk, def }, certification);
}

/**
 * 📊 三圍來源明細（給「我的」頁顯示用）。
 *
 * ⚠️ 為什麼需要：2026-08-03 把章與證改成無上限、且移到夾制之外之後，
 *    一個 3 金肥貓章的老手多了 +36 ATK——**但畫面上沒有任何地方告訴他**。
 *    加成再大，看不到就等於沒有；玩家不會因此想去拿章。
 *
 * ⚠️ 實作刻意**重用 calcArcherStats**（把章／證拔掉再算一次）而不是自己重算一份公式，
 *    否則哪天有人改了公式，這裡就會靜靜地顯示錯的數字。
 *
 * @returns [{ key, label, hp, atk, def, note }] —— 依顯示順序
 */
export function describeStatSources({ member, certification, certRecords, dexStats, archerLevel = 1 }) {
  const stripped = { ...(member || {}), fatCat: null, score: null, achievement: null };
  // 檢定加成拆成獨立一行（玩家才看得到「考檢定會變強」）：
  //   基礎 = 完全不含檢定；檢定行 = 有檢定跟沒檢定的差。兩段相加跟以前一樣。
  const baseNoCert = calcArcherStats({ member: stripped, certification: null, certRecords: [], dexStats });
  const baseWithCert = calcArcherStats({ member: stripped, certification: null, certRecords, dexStats });
  const certExam = {
    hp: baseWithCert.hp - baseNoCert.hp,
    atk: baseWithCert.atk - baseNoCert.atk,
    def: baseWithCert.def - baseNoCert.def,
  };
  const honor = calcHonorBonus(member);
  // 證的效果 = 「有證」跟「沒證」的差（含它把章也一起放大的部分）
  const beforeCert = { hp: baseWithCert.hp + honor.hp, atk: baseWithCert.atk + honor.atk, def: baseWithCert.def + honor.def };
  const afterCert = applyCertBonus(beforeCert, certification);
  const level = archerLevelBonus(archerLevel);

  const rows = [
    { key: "base", label: "基礎（裝備・報到・射齡…）", ...baseNoCert },
  ];
  if (certExam.hp || certExam.atk || certExam.def) {
    rows.push({ key: "certExam", label: "🎖️ 年度檢定（三弓級別）", ...certExam, note: "考到越高級，ATK 加成越多（上限+40）" });
  }
  if (honor.hp || honor.atk || honor.def) {
    rows.push({ key: "honor", label: "🏅 榮譽章（肥貓・積分・成就）", ...honor, note: "無上限，收越多越多" });
  }
  const certLevel = certification?.level;
  if (certLevel === "blue" || certLevel === "gold") {
    rows.push({
      key: "cert",
      label: certLevel === "gold" ? "🎯 金證（固定量＋5%）" : "🎯 藍證",
      hp: afterCert.hp - beforeCert.hp,
      atk: afterCert.atk - beforeCert.atk,
      def: afterCert.def - beforeCert.def,
    });
  }
  if (level.hp || level.atk || level.def) {
    rows.push({ key: "level", label: `📈 射手等級 ${archerLevel}`, ...level });
  }
  return rows;
}

/** 明細的合計（應該等於實際三圍，用來自我驗證） */
export function sumStatSources(rows = []) {
  return rows.reduce((acc, r) => ({
    hp: acc.hp + (r.hp || 0), atk: acc.atk + (r.atk || 0), def: acc.def + (r.def || 0),
  }), { hp: 0, atk: 0, def: 0 });
}

// ── 戰力評分（用於怪物匹配）─────────────────────────────
export function calcArcherPower(stats) {
  return Math.round(stats.hp * 0.4 + stats.atk * 1.5 + stats.def * 1.0);
}

// ── 依戰力取可出現的階級範圍 ────────────────────────────
// 一律包含 common 到目前解鎖上限的所有 tier
// 確保玩家無論戰力多高，低階怪物仍可出現→圖鑑可收集完整
export function getTierPoolByPower(power) {
  if (power >= 400) return ["common","rare","elite","fierce","boss","mythic"];
  if (power >= 280) return ["common","rare","elite","fierce","boss"];
  if (power >= 180) return ["common","rare","elite","fierce"];
  if (power >= 100) return ["common","rare","elite"];
  if (power >= 50)  return ["common","rare"];
  return ["common"];
}

// ── 變體倍率 ─────────────────────────────────────────────
// 弱化/強化改成「浮動」——每隻怪各自在區間內隨機（2026-07-12）。
// 原本固定值造成「弱化過頭(×0.6沒存在感)、強化過頭(×1.5/1.4太痛)」，改成收窄的浮動區間。
// normal 維持基準 1.0；boss 是設計好的關卡王，維持固定不浮動。
const VARIANT_RANGE = {
  weak:   { hp: [0.78, 0.92], atk: [0.78, 0.92], def: [0.78, 0.92] },
  strong: { hp: [1.15, 1.40], atk: [1.10, 1.30], def: [1.10, 1.30] },
};
const VARIANT_FIXED = {
  normal: { hp: 1.0, atk: 1.0, def: 1.0 },
  boss:   { hp: 2.0, atk: 1.6, def: 1.6 },
};

// 新戰鬥公式已把環數與部位獨立相乘。依平均 7~8 分、正常部位命中
// 校準各階級的回合數，避免高 ATK 玩家一回合蒸發中高階怪物。
const TIER_COMBAT_HP_MULTIPLIER = {
  common: 0.95,
  rare:   1.00,
  elite:  1.05,
  fierce: 1.10,
  boss:   1.00,
  mythic: 1.10,
};

// ── 依戰力隨機選變體 ────────────────────────────────────
// 戰力越高，出現強化的機率越高；弱化不受戰力影響
function pickVariant(archerPower) {
  const r = Math.random();
  if (r < 0.3) return "weak";
  if (archerPower >= 300) return r < 0.7 ? "strong" : "normal";
  if (archerPower >= 150) return r < 0.6 ? "normal" : "strong";
  return "normal";
}

const r2 = value => Math.round(value * 100) / 100;

// ── 對怪物套用變體（回傳新物件，不修改原資料）───────────
export function applyVariant(monster, variant) {
  const range = VARIANT_RANGE[variant];
  let mult;
  if (range) {
    // 一隻怪只擲一次 t，三圍用同一個 t 內插 → 強弱一致（不會血厚但攻低）。擲一次固定在該怪身上，整場不變。
    const t = Math.random();
    const lerp = ([lo, hi]) => lo + (hi - lo) * t;
    mult = { hp: lerp(range.hp), atk: lerp(range.atk), def: lerp(range.def) };
  } else {
    mult = VARIANT_FIXED[variant] || VARIANT_FIXED.normal;
  }
  const combatHpMult = TIER_COMBAT_HP_MULTIPLIER[monster.tier] || 1;
  return {
    ...monster,
    variant,
    // 變體的實際倍率要留下來給 UI 顯示：弱化 0.78~0.92、強悍 1.15~1.4 是**隨機落點**，
    // 只寫「強悍」兩個字玩家無從得知這隻到底強多少（同樣寫強悍的兩隻可能差 25%）。
    variantMult: { hp: r2(mult.hp), atk: r2(mult.atk), def: r2(mult.def) },
    hp:  Math.round(monster.hp * combatHpMult * mult.hp),
    atk: Math.round(monster.atk * mult.atk),
    def: Math.round(monster.def * mult.def),
  };
}

// ── 七族各抽1隻（依射手戰力匹配，不烙單）────────────────
// 含寶箱族；王怪仍只會在王房出現。
export function drawMatchedMonsters(archerPower) {
  const tierPool = getTierPoolByPower(archerPower);
  const families = ["ghost","mountain","insect","workplace","exam","temple","treasure"];
  const result = [];

  families.forEach(family => {
    // 篩選該族在可出現階級內的怪物
    // ⚠️ 必須排除 isKing：王怪只該從王房取得，不該出現在一般打怪清單
    const candidates = MONSTERS.filter(m =>
      m.family === family && tierPool.includes(m.tier) && !m.isKing
    );
    let monster;
    if (candidates.length === 0) {
      // fallback：取該族最低階
      const fallback = MONSTERS.filter(m => m.family === family && !m.isKing)
        .sort((a,b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
      if (fallback.length === 0) return;
      monster = fallback[0];
    } else {
      // 隨機從候選中抽1隻
      monster = candidates[Math.floor(Math.random() * candidates.length)];
    }
    // 賦予隨機變體
    const variant = pickVariant(archerPower);
    result.push(applyVariant(monster, variant));
  });

  return result;
}

// tier 排序（用於 fallback 及地下城篩選）
export const TIER_ORDER = ["common","rare","elite","fierce","boss","mythic"];

// 怪物階級 → T 數字（T1~T6）。抽不出來回 null，呼叫端就不顯示徽章。
//
// ⚠️ **為什麼階級要用數字顯示，不用中文**：
//    TIER_LABEL.fierce 是「強悍」，而 VARIANT_LABEL.strong 也是「強悍」，連顏色都同樣是 #f97316。
//    TIER_LABEL.common「普通」跟 VARIANT_LABEL.normal「普通」同樣撞名。
//    畫面上出現「強悍」時玩家分不出那是 T4 階級還是強化變體 —— 作者實際因此把 T4 的
//    晶尾小蠍誤認成 T3（2026-08-06 回報）。階級一律走 T1~T6 數字，中文只留給變體。
export function monsterTierNumber(monster) {
  const index = Number(monster?.tierIndex);
  if (Number.isFinite(index) && index >= 1 && index <= TIER_ORDER.length) return index;
  const found = TIER_ORDER.indexOf(monster?.tier);
  return found >= 0 ? found + 1 : null;
}

// ── 混種抽怪（終戰模式用）────────────────────────────────
// 從六族中隨機抽不同種的怪物，確保每場不重複
const FAMILY_KEYS = ["ghost","mountain","insect","workplace","exam","temple"];

/**
 * 從六族隨機抽指定數量的怪物（各自不同族）
 * @param {number} count - 數量（上限 6）
 * @param {string} variant - weak/normal/strong
 * @param {number} tier - 難度 (1-6)
 * @returns {Array} 怪物物件陣列（已套用變體）
 */
export function drawMixedMonsterPool(count, variant, tier) {
  const tierKey = TIER_ORDER[Math.max(0, Math.min(5, (tier || 1) - 1))];
  const shuffled = [...FAMILY_KEYS].sort(() => Math.random() - 0.5);
  const selectedFamilies = shuffled.slice(0, Math.min(count, 6));

  return selectedFamilies.map(family => {
    // 5% 低機率彩蛋：換成寶箱族（真假隨機）
    if (Math.random() < 0.05) {
      const treasurePool = MONSTERS.filter(m => m.family === "treasure" && m.tier === tierKey && !m.isKing);
      const treasureMonster = treasurePool[Math.floor(Math.random() * treasurePool.length)];
      if (treasureMonster) return applyVariant(treasureMonster, variant);
    }
    // ⚠️ 必須排除 isKing：小王/大王只該出現在王房。
    // 舊寫法只有上面的寶箱族彩蛋有擋 isKing，這條主線沒擋，導致一般樓層
    // 有機率刷出王怪（使用者實際回報：單人／組隊打怪都會遇到）。
    const candidates = MONSTERS.filter(m =>
      m.family === family && m.tier === tierKey && !m.isKing
    );
    let monster;
    if (candidates.length === 0) {
      const fallback = MONSTERS.filter(m => m.family === family && !m.isKing)
        .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
      monster = fallback[0] || MONSTERS.find(m => m.family === family);
    } else {
      monster = candidates[Math.floor(Math.random() * candidates.length)];
    }
    if (!monster) return null;
    return applyVariant(monster, variant);
  }).filter(Boolean);
}

// 從寶箱族抽指定數量（真假隨機混，不含王）；隱藏地下城樓層1/2/一般房用
// variant 比照一般族系用法：weak/normal/strong，跟樓層強弱分層一致
export function drawTreasureMonsterPool(count, variant, tier) {
  const tierKey = TIER_ORDER[Math.max(0, Math.min(5, (tier || 1) - 1))];
  const candidates = MONSTERS.filter(m => m.family === "treasure" && m.tier === tierKey && !m.isKing);
  const picks = [];
  for (let i = 0; i < count; i++) {
    const monster = candidates[Math.floor(Math.random() * candidates.length)];
    if (monster) picks.push(applyVariant(monster, variant));
  }
  return picks;
}

// 寶箱王：小王/大王各自都有 T1~T6 強度曲線，先照地城難度定階級，再隨機選小王或大王（50/50）
export function drawTreasureKing(difficultyTier) {
  const tierKey = TIER_ORDER[Math.max(0, Math.min(5, (difficultyTier || 1) - 1))];
  const line = Math.random() < 0.5 ? "treasure_king_small" : "treasure_king_big";
  const king = MONSTERS.find(m => m.isKing && m.tier === tierKey && m.id.startsWith(line));
  return applyVariant(king, "boss");
}

export function drawExpeditionBoss(difficultyTier, family = null) {
  const tierKey = TIER_ORDER[Math.max(0, Math.min(5, (difficultyTier || 1) - 1))];
  const familyKey = FAMILY_KEYS.includes(family)
    ? family
    : FAMILY_KEYS[Math.floor(Math.random() * FAMILY_KEYS.length)];
  const monster = MONSTERS.find(m => m.family === familyKey && m.tier === tierKey)
    || MONSTERS.find(m => m.tier === tierKey)
    || MONSTERS[0];
  return applyVariant(monster, "boss");
}

/**
 * 根據樓層決定終戰模式的怪物組合
 * @param {number} floorIndex - 0=第1層, 1=第2層, 2=第3層
 * @param {number} difficultyTier - 難度 (1-6)
 * @returns {{ monsters: Array, elite: Object|null, boss: Object|null }}
 */
export function drawFloorMonsters(floorIndex, difficultyTier, options = {}) {
  const isTreasureRun = options.family === "treasure";
  if (floorIndex === 0) {
    // 第1層：探索層，2-3 隻弱化怪
    const count = 2 + Math.floor(Math.random() * 2);
    return {
      monsters: isTreasureRun
        ? drawTreasureMonsterPool(count, "weak", difficultyTier)
        : drawMixedMonsterPool(count, "weak", difficultyTier),
      elite: null, boss: null,
    };
  }
  if (floorIndex === 1) {
    // 第2層：一般房固定普通，精英房固定強悍
    const count = 3 + Math.floor(Math.random() * 2);
    const elite = isTreasureRun
      ? drawTreasureMonsterPool(1, "strong", difficultyTier)[0]
      : drawMixedMonsterPool(1, "strong", difficultyTier)[0];
    return {
      monsters: isTreasureRun
        ? drawTreasureMonsterPool(count, "normal", difficultyTier)
        : drawMixedMonsterPool(count, "normal", difficultyTier),
      elite: elite || null, boss: null,
    };
  }
  // 第3層：分支遭遇固定強悍，王房使用地下城建立時已固定的 Boss
  const elite = isTreasureRun
    ? drawTreasureMonsterPool(1, "strong", difficultyTier)[0]
    : drawMixedMonsterPool(1, "strong", difficultyTier)[0];
  const fixedBoss = options.fixedBoss
    ? (options.fixedBoss.variant === "boss"
      ? { ...options.fixedBoss }
      : applyVariant(options.fixedBoss, "boss"))
    : (isTreasureRun ? drawTreasureKing(difficultyTier) : drawExpeditionBoss(difficultyTier, options.family));
  return {
    monsters: isTreasureRun
      ? drawTreasureMonsterPool(3, "strong", difficultyTier)
      : drawMixedMonsterPool(3, "strong", difficultyTier),
    elite: elite || null,
    boss: fixedBoss || null,
  };
}
