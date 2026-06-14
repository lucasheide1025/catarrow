// src/lib/monsterData.js
// 六族36隻怪物 + 射手數值公式 + 匹配系統
import { calcEquipBonus } from "./constants";

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
};

// ── 36隻怪物 ─────────────────────────────────────────────
export const MONSTERS = [

  // ════ 鬼怪族 ════
  {
    id:"ghost_1", family:"ghost", tier:"common",
    name:"好兄弟", icon:"👻",
    hp:80,  atk:12, def:5,
    desc:"在路邊徘徊的無名鬼魂，看到食物就停下來。",
  },
  {
    id:"ghost_2", family:"ghost", tier:"rare",
    name:"魔神仔", icon:"🌀",
    hp:160, atk:24, def:12,
    desc:"會把人帶到奇怪的地方，找不到回家的路。",
  },
  {
    id:"ghost_3", family:"ghost", tier:"elite",
    name:"林投姐", icon:"🌿",
    hp:280, atk:40, def:22,
    desc:"在林投樹下等待復仇，長髮遮面令人膽寒。",
  },
  {
    id:"ghost_4", family:"ghost", tier:"fierce",
    name:"城隍爺", icon:"⚖️",
    hp:440, atk:62, def:38,
    desc:"掌管生死簿，善惡到頭終有報。",
  },
  {
    id:"ghost_5", family:"ghost", tier:"boss",
    name:"十八王公", icon:"🐺",
    hp:650, atk:88, def:58,
    desc:"義犬成神，靈力無邊，香火鼎盛。",
  },
  {
    id:"ghost_6", family:"ghost", tier:"mythic",
    name:"地獄閻羅", icon:"👹",
    hp:1000, atk:140, def:95,
    desc:"陰間最高審判者，生死輪迴皆在一念之間。",
  },

  // ════ 山林族 ════
  {
    id:"mountain_1", family:"mountain", tier:"common",
    name:"山豬精", icon:"🐗",
    hp:90,  atk:14, def:8,
    desc:"台灣山林的橫衝直撞王者，遇到就跑。",
  },
  {
    id:"mountain_2", family:"mountain", tier:"rare",
    name:"百步蛇王", icon:"🐍",
    hp:150, atk:28, def:10,
    desc:"劇毒無比，百步之內必取人命。",
  },
  {
    id:"mountain_3", family:"mountain", tier:"elite",
    name:"山魈", icon:"🦊",
    hp:260, atk:44, def:24,
    desc:"山中精靈，能幻化人形，誘人深入山林。",
  },
  {
    id:"mountain_4", family:"mountain", tier:"fierce",
    name:"霧社巨人", icon:"🗿",
    hp:480, atk:70, def:50,
    desc:"霧氣中現形的巨人，腳踩山嶺如履平地。",
  },
  {
    id:"mountain_5", family:"mountain", tier:"boss",
    name:"食人巨熊", icon:"🐻",
    hp:700, atk:95, def:72,
    desc:"深山中的巨熊之王，曾吞食無數獵人，掌風能劈裂巨木。",
  },
  {
    id:"mountain_6", family:"mountain", tier:"mythic",
    name:"深山惡蛟", icon:"🐲",
    hp:1100, atk:150, def:105,
    desc:"盤踞深山水潭的千年惡蛟，興風作浪，吞雲吐霧禍害山民。",
  },

  // ════ 毒蟲族 ════
  {
    id:"insect_1", family:"insect", tier:"common",
    name:"大蟑螂", icon:"🪳",
    hp:70,  atk:10, def:4,
    desc:"台灣最強生存者，打不死的神話。",
  },
  {
    id:"insect_2", family:"insect", tier:"rare",
    name:"虎頭蜂", icon:"🐝",
    hp:140, atk:26, def:8,
    desc:"台灣山林頭號殺手，蜂群一出無人生還。",
  },
  {
    id:"insect_3", family:"insect", tier:"elite",
    name:"蜈蚣精", icon:"🐛",
    hp:250, atk:42, def:20,
    desc:"百腳精怪，毒液能腐蝕一切，令人聞風喪膽。",
  },
  {
    id:"insect_4", family:"insect", tier:"fierce",
    name:"蠍子王", icon:"🦂",
    hp:420, atk:66, def:44,
    desc:"毒刺一揮，五臟俱毀，連神明都要退三步。",
  },
  {
    id:"insect_5", family:"insect", tier:"boss",
    name:"蜘蛛女王", icon:"🕷️",
    hp:680, atk:90, def:65,
    desc:"織出命運之網，凡落網者皆逃不過宿命。",
  },
  {
    id:"insect_6", family:"insect", tier:"mythic",
    name:"蟲神", icon:"🦋",
    hp:1050, atk:145, def:100,
    desc:"所有蟲類的神祇，萬蟲朝聖，天地變色。",
  },

  // ════ 職場族 ════
  {
    id:"workplace_1", family:"workplace", tier:"common",
    name:"奧客", icon:"😤",
    hp:75,  atk:11, def:6,
    desc:"無理取鬧專業戶，投訴書寫到手抽筋。",
  },
  {
    id:"workplace_2", family:"workplace", tier:"rare",
    name:"爛主管", icon:"🗣️",
    hp:155, atk:25, def:14,
    desc:"PUA語錄信手拈來，讓你懷疑人生的那種。",
  },
  {
    id:"workplace_3", family:"workplace", tier:"elite",
    name:"壞老闆", icon:"💸",
    hp:270, atk:43, def:26,
    desc:"畫餅充飢大師，承諾從不兌現，年終永遠0元。",
  },
  {
    id:"workplace_4", family:"workplace", tier:"fierce",
    name:"黑心包租婆", icon:"🏚️",
    hp:450, atk:68, def:46,
    desc:"每個月準時漲租，浴室有謎之內衣三年未取。",
  },
  {
    id:"workplace_5", family:"workplace", tier:"boss",
    name:"財閥總裁", icon:"🤵",
    hp:720, atk:98, def:78,
    desc:"壟斷市場、操控輿論，笑容背後是無盡的算計。",
  },
  {
    id:"workplace_6", family:"workplace", tier:"mythic",
    name:"資本魔王", icon:"💰",
    hp:1200, atk:155, def:110,
    desc:"剝削制度的化身，讓打工人永遠無法翻身的終極BOSS。",
  },

  // ════ 考試族 ════
  {
    id:"exam_1", family:"exam", tier:"common",
    name:"小考", icon:"📝",
    hp:65,  atk:9,  def:3,
    desc:"突然宣布的小考，讓你昨晚的遊戲白打了。",
  },
  {
    id:"exam_2", family:"exam", tier:"rare",
    name:"段考", icon:"📚",
    hp:145, atk:22, def:11,
    desc:"三個月的努力在這兩天決勝負，壓力山大。",
  },
  {
    id:"exam_3", family:"exam", tier:"elite",
    name:"期末考", icon:"😱",
    hp:265, atk:41, def:23,
    desc:"所有科目同時來臨，睡眠成為奢侈品。",
  },
  {
    id:"exam_4", family:"exam", tier:"fierce",
    name:"學測魔王", icon:"🎯",
    hp:430, atk:65, def:42,
    desc:"十二年寒窗的終極審判，一試定終身的殘酷。",
  },
  {
    id:"exam_5", family:"exam", tier:"boss",
    name:"國考煉獄", icon:"📜",
    hp:690, atk:92, def:70,
    desc:"考了五年還在考，人生黃金歲月全押在這裡。",
  },
  {
    id:"exam_6", family:"exam", tier:"mythic",
    name:"升學制度本體", icon:"🏫",
    hp:1150, atk:148, def:108,
    desc:"無法打倒的終極存在，它不是怪物，它是系統。",
  },

  // ════ 西方怪物族 ════
  {
    id:"temple_1", family:"temple", tier:"common",
    name:"哥布林", icon:"👺",
    hp:85,  atk:13, def:7,
    desc:"西方森林裡的小型魔物，貪財又狡猾，成群結隊偷襲旅人。",
  },
  {
    id:"temple_2", family:"temple", tier:"rare",
    name:"骷髏劍士", icon:"💀",
    hp:165, atk:27, def:15,
    desc:"從墓地爬出的不死戰士，揮舞生鏽長劍，越夜越強。",
  },
  {
    id:"temple_3", family:"temple", tier:"elite",
    name:"狼人", icon:"🐺",
    hp:290, atk:46, def:28,
    desc:"月圓之夜化身狼形，速度與利爪令獵人聞風喪膽。",
  },
  {
    id:"temple_4", family:"temple", tier:"fierce",
    name:"吸血鬼伯爵", icon:"🧛",
    hp:460, atk:72, def:52,
    desc:"古堡中的不死貴族，優雅外表下藏著嗜血的獠牙。",
  },
  {
    id:"temple_5", family:"temple", tier:"boss",
    name:"巫妖王", icon:"🧙",
    hp:710, atk:96, def:75,
    desc:"捨棄肉身追求永生的大法師，麾下亡靈大軍聽令行事。",
  },
  {
    id:"temple_6", family:"temple", tier:"mythic",
    name:"末日惡龍", icon:"🐉",
    hp:1080, atk:143, def:102,
    desc:"噴吐烈焰的西方巨龍，所到之處化為焦土，勇者的終極試煉。",
  },
];

// ── 身體部位（殭屍靶紙模式）────────────────────────────
export const BODY_PARTS = [
  { id:"head",   name:"頭部",   icon:"💀", mult:2.0, locked:false },
  { id:"neck",   name:"頸部",   icon:"🎯", mult:1.8, locked:false },
  { id:"chest",  name:"胸腔",   icon:"❤️", mult:1.5, locked:false },
  { id:"belly",  name:"腹部",   icon:"🫁", mult:1.2, locked:false },
  { id:"arm",    name:"手臂",   icon:"💪", mult:1.0, locked:false },
  { id:"groin",  name:"鼠蹊",   icon:"⚡", mult:1.6, locked:false },
  { id:"heart",  name:"心臟",   icon:"❤️‍🔥", mult:3.0, locked:true  }, // 需先命中胸腔
  { id:"lung",   name:"肺葉",   icon:"🫁", mult:2.5, locked:true  }, // 需先命中胸腔
  { id:"kidney", name:"腎臟",   icon:"🫘", mult:2.2, locked:true  }, // 需先命中腹部
  { id:"balls",  name:"要害",   icon:"💥", mult:2.8, locked:true  }, // 需先命中鼠蹊
  { id:"miss",   name:"脫靶",   icon:"💨", mult:0,   locked:false },
];

// ── 依分數判定命中部位 ───────────────────────────────────
// isX = true → X 環，保證頭/頸（一定爆擊）；10 = 一定命中；9~M 按比例脫靶

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

  // 9~1 分：脫靶率按比例遞增（9分=5%, 8分=15%, 7分=25%…1分=85%）
  const missRate = Math.max(0, 0.95 - score * 0.10);
  if (Math.random() < missRate) return _bp("miss");

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

// ── 六族各抽1隻（依射手戰力匹配，不烙單）────────────────
// 每族保證有1隻，共6隻選怪
export function drawMatchedMonsters(archerPower) {
  const tierPool = getTierPoolByPower(archerPower);
  const families = ["ghost","mountain","insect","workplace","exam","temple"];
  const result = [];

  families.forEach(family => {
    // 篩選該族在可出現階級內的怪物
    const candidates = MONSTERS.filter(m =>
      m.family === family && tierPool.includes(m.tier)
    );
    if (candidates.length === 0) {
      // fallback：取該族最低階
      const fallback = MONSTERS.filter(m => m.family === family)
        .sort((a,b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
      if (fallback.length > 0) result.push(fallback[0]);
    } else {
      // 隨機從候選中抽1隻
      result.push(candidates[Math.floor(Math.random() * candidates.length)]);
    }
  });

  return result;
}

// tier 排序（用於 fallback）
const TIER_ORDER = ["common","rare","elite","fierce","boss","mythic"];