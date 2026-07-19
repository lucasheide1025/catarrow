// src/lib/monsterData.js
// 六族36隻怪物 + 射手數值公式 + 匹配系統
import { calcEquipBonus } from "./constants";
import { getAllEquipmentRuneBonus } from "./equipmentRuneData";

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
    name:"好兄弟", icon:"👻",
    hp:250, atk:20, def:14,
    desc:"在路邊徘徊的無名鬼魂，看到食物就停下來。",
  },
  {
    id:"ghost_2", family:"ghost", tier:"rare",
    name:"魔神仔", icon:"🌀",
    hp:400, atk:35, def:24,
    desc:"會把人帶到奇怪的地方，找不到回家的路。",
  },
  {
    id:"ghost_3", family:"ghost", tier:"elite",
    name:"林投姐", icon:"🌿",
    hp:650, atk:55, def:40,
    desc:"在林投樹下等待復仇，長髮遮面令人膽寒。",
  },
  {
    id:"ghost_4", family:"ghost", tier:"fierce",
    name:"城隍爺", icon:"⚖️",
    hp:1000, atk:82, def:68,
    desc:"掌管生死簿，善惡到頭終有報。",
  },
  {
    id:"ghost_5", family:"ghost", tier:"boss",
    name:"十八王公", icon:"🐺",
    hp:1600, atk:125, def:105,
    desc:"義犬成神，靈力無邊，香火鼎盛。",
  },
  {
    id:"ghost_6", family:"ghost", tier:"mythic",
    name:"地獄閻羅", icon:"👹",
    hp:2500, atk:175, def:155,
    desc:"陰間最高審判者，生死輪迴皆在一念之間。",
  },

  // ════ 山林族 ════
  {
    id:"mountain_1", family:"mountain", tier:"common",
    name:"山豬精", icon:"🐗",
    hp:270, atk:18, def:15,
    desc:"台灣山林的橫衝直撞王者，遇到就跑。",
  },
  {
    id:"mountain_2", family:"mountain", tier:"rare",
    name:"百步蛇王", icon:"🐍",
    hp:432, atk:32, def:26,
    desc:"劇毒無比，百步之內必取人命。",
  },
  {
    id:"mountain_3", family:"mountain", tier:"elite",
    name:"山魈", icon:"🦊",
    hp:702, atk:51, def:43,
    desc:"山中精靈，能幻化人形，誘人深入山林。",
  },
  {
    id:"mountain_4", family:"mountain", tier:"fierce",
    name:"霧社巨人", icon:"🗿",
    hp:1080, atk:75, def:73,
    desc:"霧氣中現形的巨人，腳踩山嶺如履平地。",
  },
  {
    id:"mountain_5", family:"mountain", tier:"boss",
    name:"食人巨熊", icon:"🐻",
    hp:1728, atk:115, def:113,
    desc:"深山中的巨熊之王，曾吞食無數獵人，掌風能劈裂巨木。",
  },
  {
    id:"mountain_6", family:"mountain", tier:"mythic",
    name:"深山惡蛟", icon:"🐲",
    hp:2700, atk:161, def:167,
    desc:"盤踞深山水潭的千年惡蛟，興風作浪，吞雲吐霧禍害山民。",
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
export function calcArcherStats({ member, certification, certRecords, dexStats }) {
  const joinYear  = member?.joinDate ? new Date(member.joinDate).getFullYear() : new Date().getFullYear();
  const ageYears  = Math.max(0, new Date().getFullYear() - joinYear);

  // ── HP ──────────────────────────────────────────────────
  // 基礎 100 + 圖鑑/8（上限+30）+ 藍/金證（+10/+20）
  // + 報到次數/4（上限+30）+ 成就章分/8（上限+20）
  // + 飾品欄位數×3（上限+20）+ 射齡×5（上限+30）
  let hp = 200;
  if (dexStats) hp += Math.min(30, Math.floor(dexStats.totalUnlocked / 8));
  if (certification?.level === "blue") hp += 10;
  if (certification?.level === "gold") hp += 20;
  const checkinCount = member?.dailyQuestCount || 0;
  hp += Math.min(30, Math.floor(checkinCount / 4));
  const achPoints = ((member?.achievement?.black||0)*3 + (member?.achievement?.gold||0)*2 + (member?.achievement?.silver||0));
  hp += Math.min(20, Math.floor(achPoints / 8));
  const accSlots = (member?.accessorySets || []).reduce((s,set) => s + Object.values(set).filter(Boolean).length, 0);
  hp += Math.min(20, accSlots * 3);
  hp += Math.min(30, ageYears * 5);
  hp = Math.min(800, hp);

  // ── ATK ─────────────────────────────────────────────────
  // 基礎 15 + 肥貓章分/4（上限+25）+ 三弓檢定總等×3（上限+40）
  // + 弓組欄位數×4（上限+30）+ 賽事積分/10（上限+20）
  // + 報到任務/5（上限+30）
  let atk = 15;
  const fatPoints = ((member?.fatCat?.gold||0)*50 + (member?.fatCat?.silver||0)*10 + (member?.fatCat?.bronze||0));
  atk += Math.min(25, Math.floor(fatPoints / 4));
  const certLevelScore = (certRecords || []).reduce((s, r) => {
    const lv = { 入門:1, 初級:2, 中級:3, 進階:4, 精英:5, 菁英:5 };
    return s + (lv[r.level] || 0);
  }, 0);
  atk += Math.min(40, certLevelScore * 3);
  const bowSlots = (member?.equipment || []).length;
  atk += Math.min(30, bowSlots * 4);
  atk += Math.min(20, Math.floor((member?.eventPoints||0) / 10));
  atk += Math.min(30, Math.floor(checkinCount / 5));
  atk = Math.min(160, atk);

  // ── DEF ─────────────────────────────────────────────────
  // 基礎 10 + 積分章分/4（上限+25）+ 防具欄位數×3（上限+30）
  // + 射齡×4（上限+25）+ 期數生+（上限+15）+ 金證（+15）
  let def = 10;
  const scorePoints = ((member?.score?.gold||0)*50 + (member?.score?.silver||0)*10 + (member?.score?.bronze||0));
  def += Math.min(25, Math.floor(scorePoints / 4));
  const armorSlots = (member?.armorSets || []).reduce((s,set) => s + Object.values(set).filter(v=>v&&typeof v==="string"&&v.trim()).length, 0);
  def += Math.min(30, armorSlots * 3);
  def += Math.min(25, ageYears * 4);
  if (dexStats?.cohortBonus) def += Math.min(15, dexStats.cohortBonus);
  if (certification?.level === "gold") def += 15;
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

  return { hp, atk, def };
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
    hp:  Math.round(monster.hp * combatHpMult * mult.hp),
    atk: Math.round(monster.atk * mult.atk),
    def: Math.round(monster.def * mult.def),
  };
}

// ── 六族各抽1隻（依射手戰力匹配，不烙單）────────────────
// 每族保證有1隻，每隻隨機賦予弱化/普通/強化變體，共6隻選怪
export function drawMatchedMonsters(archerPower) {
  const tierPool = getTierPoolByPower(archerPower);
  const families = ["ghost","mountain","insect","workplace","exam","temple"];
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
