// src/lib/monsterData.js
// 六族 36 隻怪物 + 匹配系統 + 戰鬥公式

// ── 階級定義 ──────────────────────────────────────────────
export const TIER_LABEL = {
  common:    { label:"普通",   color:"#6b7280", bg:"#f3f4f6", stars:1 },
  rare:      { label:"稀有",   color:"#3b82f6", bg:"#eff6ff", stars:2 },
  elite:     { label:"精英",   color:"#8b5cf6", bg:"#f5f3ff", stars:3 },
  tough:     { label:"強悍",   color:"#f59e0b", bg:"#fffbeb", stars:4 },
  boss:      { label:"頭目",   color:"#ef4444", bg:"#fef2f2", stars:5 },
  myth:      { label:"神話",   color:"#ec4899", bg:"#fdf2f8", stars:6 },
};

// ── 族群定義 ──────────────────────────────────────────────
export const FAMILY_LABEL = {
  ghost:     { label:"鬼怪族", icon:"👻", color:"#7c3aed" },
  mountain:  { label:"山林族", icon:"🌿", color:"#065f46" },
  poison:    { label:"毒蟲族", icon:"🐛", color:"#15803d" },
  workplace: { label:"職場族", icon:"💼", color:"#1e40af" },
  exam:      { label:"考試族", icon:"📝", color:"#92400e" },
  temple:    { label:"廟會族", icon:"🏮", color:"#9f1239" },
};

// ── 36 隻怪物 ─────────────────────────────────────────────
// HP/ATK/DEF 依階級分層：
// common: HP 80~120   ATK 8~15   DEF 5~10
// rare:   HP 150~220  ATK 18~28  DEF 12~20
// elite:  HP 280~380  ATK 32~45  DEF 22~32
// tough:  HP 450~600  ATK 50~70  DEF 35~50
// boss:   HP 700~950  ATK 80~110 DEF 55~80
// myth:   HP 1200~1800 ATK 130~160 DEF 90~120

export const MONSTERS = [

  // ══ 鬼怪族 ══
  {
    id:"ghost_1", family:"ghost", tier:"common",
    name:"好兄弟", icon:"👤",
    hp:90, atk:10, def:6,
    desc:"在路邊徘徊，對人畜無害，但靠太近會讓你背脊發涼",
  },
  {
    id:"ghost_2", family:"ghost", tier:"rare",
    name:"魔神仔", icon:"🌫️",
    hp:180, atk:22, def:15,
    desc:"專門迷路人的小妖精，被牠帶著走就回不了家了",
  },
  {
    id:"ghost_3", family:"ghost", tier:"elite",
    name:"林投姐", icon:"👩",
    hp:320, atk:38, def:25,
    desc:"冤死的女子化為厲鬼，長髮遮面，怨氣沖天",
  },
  {
    id:"ghost_4", family:"ghost", tier:"tough",
    name:"城隍爺", icon:"⚖️",
    hp:520, atk:62, def:42,
    desc:"掌管陰間司法，公正嚴明，但也鐵面無私",
  },
  {
    id:"ghost_5", family:"ghost", tier:"boss",
    name:"十八王公", icon:"🐺",
    hp:820, atk:95, def:65,
    desc:"義犬成神，靈驗無比，保佑漁民，但外人冒犯必受懲罰",
  },
  {
    id:"ghost_6", family:"ghost", tier:"myth",
    name:"地獄閻羅", icon:"👹",
    hp:1500, atk:145, def:100,
    desc:"主宰生死輪迴，掌管十殿地獄，威震陰陽兩界",
  },

  // ══ 山林族 ══
  {
    id:"mountain_1", family:"mountain", tier:"common",
    name:"山豬精", icon:"🐗",
    hp:110, atk:13, def:8,
    desc:"台灣山林中的野豬化成精怪，脾氣暴躁，一言不合就衝",
  },
  {
    id:"mountain_2", family:"mountain", tier:"rare",
    name:"百步蛇王", icon:"🐍",
    hp:165, atk:25, def:13,
    desc:"台灣最毒的蛇王，百步之內必死，排灣族的守護靈",
  },
  {
    id:"mountain_3", family:"mountain", tier:"elite",
    name:"山魈", icon:"🦍",
    hp:360, atk:42, def:28,
    desc:"深山中的古老妖怪，力大無窮，專吃迷路的登山客",
  },
  {
    id:"mountain_4", family:"mountain", tier:"tough",
    name:"霧社巨人", icon:"🗿",
    hp:580, atk:68, def:45,
    desc:"霧社山中沉睡的石巨人，被驚醒後憤怒無比",
  },
  {
    id:"mountain_5", family:"mountain", tier:"boss",
    name:"玉山靈獸", icon:"🦁",
    hp:880, atk:100, def:70,
    desc:"守護台灣最高峰的神獸，雲霧為身，雷電為爪",
  },
  {
    id:"mountain_6", family:"mountain", tier:"myth",
    name:"台灣龍神", icon:"🐉",
    hp:1600, atk:150, def:105,
    desc:"沉眠於中央山脈萬年的巨龍，甦醒時山河震動",
  },

  // ══ 毒蟲族 ══
  {
    id:"poison_1", family:"poison", tier:"common",
    name:"大蟑螂精", icon:"🪳",
    hp:85, atk:9, def:7,
    desc:"台灣最不死的生物進化成精，打不死、藥不死，令人崩潰",
  },
  {
    id:"poison_2", family:"poison", tier:"rare",
    name:"虎頭蜂王", icon:"🐝",
    hp:175, atk:24, def:14,
    desc:"台灣山林第一殺手，整窩出動時連山豬都要逃命",
  },
  {
    id:"poison_3", family:"poison", tier:"elite",
    name:"蜈蚣精", icon:"🐛",
    hp:310, atk:40, def:24,
    desc:"百足妖怪，毒液腐蝕一切，鑽地如履平地",
  },
  {
    id:"poison_4", family:"poison", tier:"tough",
    name:"蠍子王", icon:"🦂",
    hp:490, atk:65, def:40,
    desc:"沙漠毒王來到台灣，毒尾一掃就能癱瘓整片山頭",
  },
  {
    id:"poison_5", family:"poison", tier:"boss",
    name:"蜘蛛女王", icon:"🕷️",
    hp:800, atk:92, def:62,
    desc:"結網千里，獵物一旦踏入就永遠出不來",
  },
  {
    id:"poison_6", family:"poison", tier:"myth",
    name:"蟲神", icon:"🦋",
    hp:1400, atk:140, def:95,
    desc:"統御萬蟲的始祖神明，蟲鳴即詛咒，一念萬蟲至",
  },

  // ══ 職場族 ══
  {
    id:"workplace_1", family:"workplace", tier:"common",
    name:"奧客", icon:"😤",
    hp:95, atk:11, def:6,
    desc:"無理取鬧、得理不饒人，服務業最大的噩夢",
  },
  {
    id:"workplace_2", family:"workplace", tier:"rare",
    name:"爛主管", icon:"👔",
    hp:170, atk:23, def:16,
    desc:"什麼都不懂卻什麼都要管，PUA功力一流",
  },
  {
    id:"workplace_3", family:"workplace", tier:"elite",
    name:"壞老闆", icon:"💰",
    hp:340, atk:44, def:27,
    desc:"畫餅充饑大師，慣老闆代表，員工只是工具",
  },
  {
    id:"workplace_4", family:"workplace", tier:"tough",
    name:"黑心包租婆", icon:"🏠",
    hp:510, atk:60, def:44,
    desc:"月月漲租，百般刁難，房屋破舊還要你感恩戴德",
  },
  {
    id:"workplace_5", family:"workplace", tier:"boss",
    name:"財閥總裁", icon:"🏦",
    hp:860, atk:98, def:68,
    desc:"壟斷市場、操控政策，資本帝國的主人",
  },
  {
    id:"workplace_6", family:"workplace", tier:"myth",
    name:"資本主義魔王", icon:"🌐",
    hp:1650, atk:155, def:110,
    desc:"無形之手操控一切，貧富差距是牠存在的養分",
  },

  // ══ 考試族 ══
  {
    id:"exam_1", family:"exam", tier:"common",
    name:"小考惡靈", icon:"📋",
    hp:80, atk:8, def:5,
    desc:"突襲毫無準備的學生，一張小考卷能讓人崩潰一整天",
  },
  {
    id:"exam_2", family:"exam", tier:"rare",
    name:"段考魔人", icon:"📚",
    hp:160, atk:20, def:12,
    desc:"考前複習範圍廣如宇宙，睡眠剝奪專家",
  },
  {
    id:"exam_3", family:"exam", tier:"elite",
    name:"期末考怪獸", icon:"📖",
    hp:300, atk:36, def:22,
    desc:"一次考完整學期，報復性補眠之前必須先過牠這關",
  },
  {
    id:"exam_4", family:"exam", tier:"tough",
    name:"學測巨獸", icon:"🎯",
    hp:480, atk:58, def:38,
    desc:"決定命運的一天，十二年寒窗全押在這裡",
  },
  {
    id:"exam_5", family:"exam", tier:"boss",
    name:"國考魔王", icon:"📜",
    hp:850, atk:90, def:60,
    desc:"考了十年還沒上，但又停不下來，人生陷阱之王",
  },
  {
    id:"exam_6", family:"exam", tier:"myth",
    name:"升學制度本體", icon:"🏛️",
    hp:1800, atk:160, def:120,
    desc:"台灣教育焦慮的終極型態，打倒它，解放所有學生",
  },

  // ══ 廟會族 ══
  {
    id:"temple_1", family:"temple", tier:"common",
    name:"七爺", icon:"⚫",
    hp:100, atk:12, def:9,
    desc:"謝必安，高帽黑袍，舌長面黑，看似嚇人卻護佑善良",
  },
  {
    id:"temple_2", family:"temple", tier:"rare",
    name:"八爺", icon:"⬜",
    hp:190, atk:26, def:18,
    desc:"范無救，矮胖白臉，七爺八爺合力才能捉拿惡鬼",
  },
  {
    id:"temple_3", family:"temple", tier:"elite",
    name:"千里眼", icon:"👁️",
    hp:350, atk:45, def:30,
    desc:"看穿千里之外，無所遁形，善惡皆在眼中",
  },
  {
    id:"temple_4", family:"temple", tier:"tough",
    name:"順風耳", icon:"👂",
    hp:540, atk:66, def:46,
    desc:"聽聞萬里之聲，謊言在牠面前毫無意義",
  },
  {
    id:"temple_5", family:"temple", tier:"boss",
    name:"虎爺", icon:"🐯",
    hp:900, atk:105, def:72,
    desc:"土地公的坐騎，財神的護法，咬錢招財，咬惡驅邪",
  },
  {
    id:"temple_6", family:"temple", tier:"myth",
    name:"媽祖護法", icon:"🌊",
    hp:1700, atk:148, def:108,
    desc:"護佑台灣海峽千年，風浪為令，神兵天將隨侍在側",
  },
];

// ── 部位定義（同前）────────────────────────────────────────
export const BODY_PARTS = [
  { id:"head",   name:"頭部",   icon:"💀", mult:2.0, locked:false },
  { id:"neck",   name:"頸部",   icon:"🎯", mult:1.8, locked:false },
  { id:"chest",  name:"胸腔",   icon:"💢", mult:1.2, locked:false },
  { id:"belly",  name:"腹部",   icon:"🤢", mult:1.0, locked:false },
  { id:"arm",    name:"手臂",   icon:"💪", mult:0.7, locked:false },
  { id:"groin",  name:"鼠蹊",   icon:"⚡", mult:1.5, locked:false },
  { id:"heart",  name:"心臟",   icon:"❤️", mult:2.5, locked:true  },
  { id:"kidney", name:"腎臟",   icon:"🫘", mult:2.2, locked:true  },
  { id:"lung",   name:"肺葉",   icon:"🫁", mult:2.0, locked:true  },
  { id:"balls",  name:"要害",   icon:"😱", mult:2.8, locked:true  },
  { id:"miss",   name:"脫靶",   icon:"💨", mult:0,   locked:false },
];

// ── 部位命中判定 ──────────────────────────────────────────
export function resolveHitPart(score, unlockedParts) {
  const unlocked = unlockedParts || new Set();
  if (score === 0) return { ...BODY_PARTS.find(p=>p.id==="miss"), id:"miss" };

  const rand = Math.random();

  if (score >= 10) {
    // X/10：不脫靶，高部位為主
    if (rand < 0.15 && unlocked.has("chest")) return BODY_PARTS.find(p=>p.id==="heart");
    if (rand < 0.30 && unlocked.has("belly")) return BODY_PARTS.find(p=>p.id==="kidney");
    if (rand < 0.42 && unlocked.has("chest")) return BODY_PARTS.find(p=>p.id==="lung");
    if (rand < 0.55 && unlocked.has("groin")) return BODY_PARTS.find(p=>p.id==="balls");
    if (rand < 0.70) return BODY_PARTS.find(p=>p.id==="head");
    if (rand < 0.83) return BODY_PARTS.find(p=>p.id==="neck");
    if (rand < 0.92) return BODY_PARTS.find(p=>p.id==="groin");
    return BODY_PARTS.find(p=>p.id==="chest");
  }
  if (score >= 8) {
    // 8~9：不脫靶，中等部位
    if (rand < 0.10 && unlocked.has("chest")) return BODY_PARTS.find(p=>p.id==="heart");
    if (rand < 0.22 && unlocked.has("belly")) return BODY_PARTS.find(p=>p.id==="kidney");
    if (rand < 0.35) return BODY_PARTS.find(p=>p.id==="head");
    if (rand < 0.50) return BODY_PARTS.find(p=>p.id==="neck");
    if (rand < 0.65) return BODY_PARTS.find(p=>p.id==="chest");
    if (rand < 0.80) return BODY_PARTS.find(p=>p.id==="belly");
    return BODY_PARTS.find(p=>p.id==="arm");
  }
  if (score >= 6) {
    // 6~7：10%脫靶
    if (rand < 0.10) return BODY_PARTS.find(p=>p.id==="miss");
    if (rand < 0.30) return BODY_PARTS.find(p=>p.id==="chest");
    if (rand < 0.50) return BODY_PARTS.find(p=>p.id==="belly");
    if (rand < 0.65) return BODY_PARTS.find(p=>p.id==="arm");
    if (rand < 0.80) return BODY_PARTS.find(p=>p.id==="groin");
    return BODY_PARTS.find(p=>p.id==="neck");
  }
  // 1~5：40%脫靶
  if (rand < 0.40) return BODY_PARTS.find(p=>p.id==="miss");
  if (rand < 0.60) return BODY_PARTS.find(p=>p.id==="arm");
  if (rand < 0.75) return BODY_PARTS.find(p=>p.id==="belly");
  if (rand < 0.88) return BODY_PARTS.find(p=>p.id==="chest");
  return BODY_PARTS.find(p=>p.id==="groin");
}

// ── 射手戰力計算 ──────────────────────────────────────────
// 輸出 power 值（0~100+）用於匹配怪物階級
export function calcArcherPower({ hp, atk, def }) {
  // 正規化到 0~100，考慮未來上限 HP:400 ATK:160 DEF:120
  const hpScore  = Math.min(hp  / 400  * 40, 40);
  const atkScore = Math.min(atk / 160  * 35, 35);
  const defScore = Math.min(def / 120  * 25, 25);
  return Math.round(hpScore + atkScore + defScore);
}

// ── 依射手戰力取可用階級清單 ─────────────────────────────
// 有重疊區間讓玩家可挑戰稍難或稍易的怪物
export function getAvailableTiers(power) {
  if (power < 20) return ["common"];
  if (power < 35) return ["common","rare"];
  if (power < 50) return ["rare","elite"];
  if (power < 65) return ["elite","tough"];
  if (power < 80) return ["tough","boss"];
  return ["boss","myth"];
}

// ── 匹配選怪：六族各出1隻，依射手戰力匹配階級 ──────────
// 回傳 6 隻怪物（每族1隻），若該族該階無怪則往上/下補
export function matchMonsters(archerStats) {
  const power  = calcArcherPower(archerStats);
  const tiers  = getAvailableTiers(power);
  const TIER_ORDER = ["common","rare","elite","tough","boss","myth"];
  const families = ["ghost","mountain","poison","workplace","exam","temple"];

  return families.map(family => {
    // 在可用階級中隨機挑一個
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    // 找該族該階的怪
    let candidate = MONSTERS.find(m => m.family===family && m.tier===tier);
    // 沒有就往下找最近的
    if (!candidate) {
      for (const t of TIER_ORDER) {
        candidate = MONSTERS.find(m => m.family===family && m.tier===t);
        if (candidate) break;
      }
    }
    return candidate;
  }).filter(Boolean);
}

// ── 射手數值計算 ──────────────────────────────────────────
export function calcArcherStats({ member, certification, certRecords, dexStats }) {
  // HP：基礎100 + 圖鑑/8(上限+50) + 藍/金證(+10/+20) + 報到次數/4(上限+30) + 成就章分/8(上限+20) + 飾品欄位數(上限+20)
  let hp = 100;
  if (dexStats)            hp += Math.min(50, Math.floor(dexStats.totalUnlocked / 8 * 10));
  if (certification?.level === "blue") hp += 10;
  if (certification?.level === "gold") hp += 20;
  const checkins = member?.dailyQuestCount || 0;
  hp += Math.min(30, Math.floor(checkins / 4));
  const achPts = ((member?.achievement?.black||0)*3 + (member?.achievement?.gold||0)*2 + (member?.achievement?.silver||0));
  hp += Math.min(20, Math.floor(achPts / 8));
  const accCount = (member?.accessorySets || []).reduce((s,set) => s + Object.values(set).filter(v=>v&&typeof v==="string"&&v.trim()).length, 0);
  hp += Math.min(20, accCount);
  hp = Math.min(400, hp);

  // ATK：基礎10 + 肥貓章分/4(上限+30) + 三弓檢定級別合計(上限+50) + 弓組欄位數/2(上限+30) + 賽事積分/20(上限+40)
  let atk = 10;
  const fatPts = ((member?.fatCat?.gold||0)*50 + (member?.fatCat?.silver||0)*10 + (member?.fatCat?.bronze||0));
  atk += Math.min(30, Math.floor(fatPts / 4));
  const BOW_CERT_SCORES = certRecords || [];
  const certBonus = BOW_CERT_SCORES.reduce((s, r) => {
    const lvMap = { 入門:1, 初級:2, 中級:3, 進階:4, 精英:5, 菁英:5 };
    return s + (lvMap[r.level] || 0);
  }, 0);
  atk += Math.min(50, certBonus * 3);
  const bowCount = (member?.equipment || []).length;
  atk += Math.min(30, Math.floor(bowCount / 2) * 10);
  atk += Math.min(40, Math.floor((member?.eventPoints||0) / 20));
  atk = Math.min(160, atk);

  // DEF：基礎10 + 積分章分/4(上限+30) + 防具欄位數(上限+30) + 射齡年*3(上限+30) + 期數生(上限+20)
  let def = 10;
  const scorePts = ((member?.score?.gold||0)*50 + (member?.score?.silver||0)*10 + (member?.score?.bronze||0));
  def += Math.min(30, Math.floor(scorePts / 4));
  const armorCount = (member?.armorSets || []).reduce((s,set) => s + Object.values(set).filter(v=>v&&typeof v==="string"&&v.trim()).length, 0);
  def += Math.min(30, armorCount * 3);
  const joinYear = member?.joinDate ? new Date().getFullYear() - new Date(member.joinDate).getFullYear() : 0;
  def += Math.min(30, joinYear * 3);
  if (dexStats?.cohort != null) def += Math.min(20, Math.max(1, 6 - dexStats.cohort));
  def = Math.min(120, def);

  return { hp, atk, def };
}

// ── 傷害公式 ─────────────────────────────────────────────
// 調整係數讓神話怪 (HP 1800) 需要約 8~12 回合才能擊倒
export function calcDamage({ score, archerATK, monsterDEF, partMult }) {
  if (!score || score <= 0 || !partMult) return 0;
  const base = 8 + archerATK * 0.7 + score * 1.2 - monsterDEF * 0.5;
  const dmg  = Math.max(1, Math.round(base * partMult * (0.85 + Math.random() * 0.3)));
  return dmg;
}

// ── 怪物反擊公式 ──────────────────────────────────────────
export function calcCounterDamage({ monsterATK, archerDEF, headStunned, isCrit }) {
  const base = Math.max(1, monsterATK * 0.6 - archerDEF * 0.4);
  const mult = isCrit ? 1.8 : headStunned ? 0.5 : 1.0;
  return Math.max(1, Math.round(base * mult * (0.8 + Math.random() * 0.4)));
}
