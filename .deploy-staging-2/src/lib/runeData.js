// src/lib/runeData.js — 符文系統（13類型 × 4階段 = 52種）
// 耐久度：T1=3次 / T2=4次 / T3=5次 / T4=6次，用盡即廢棄，不可修復

// ── 13 種符文類型 ─────────────────────────────────────────────
export const RUNE_TYPES = {
  atk:     { label:"攻擊符文",  icon:"⚔️",  color:"#f87171", desc:"提升射手攻擊力"         },
  def:     { label:"防護符文",  icon:"🛡️",  color:"#60a5fa", desc:"提升射手防禦力"         },
  hp:      { label:"生命符文",  icon:"❤️",  color:"#4ade80", desc:"提升射手最大血量"       },
  atk_def: { label:"戰士符文",  icon:"⚡",   color:"#fbbf24", desc:"強化攻擊與防禦"         },
  atk_hp:  { label:"鬥士符文",  icon:"💢",  color:"#f97316", desc:"強化攻擊與血量"         },
  def_hp:  { label:"守衛符文",  icon:"🔰",  color:"#818cf8", desc:"強化防禦與血量"         },
  full:    { label:"霸王符文",  icon:"👑",  color:"#c084fc", desc:"攻防血三項全面強化"     },
  cat:     { label:"貓靈符文",  icon:"🐱",  color:"#f9a8d4", desc:"強化貓貓夥伴全屬性"     },
  revival: { label:"不死符文",  icon:"💫",  color:"#34d399", desc:"死亡後自動復活一次"     },
  loot:    { label:"掘寶符文",  icon:"⛏️",  color:"#fcd34d", desc:"增加掉落材料數量"       },
  lucky:   { label:"幸運符文",  icon:"🍀",  color:"#a3e635", desc:"提升稀有卡片與符文機率" },
  gold:    { label:"財富符文",  icon:"💰",  color:"#eab308", desc:"增加金幣獲得量"         },
  xp:      { label:"智慧符文",  icon:"📘",  color:"#38bdf8", desc:"增加射手與貓咪XP"       },
};

// ── 各類型各階段效果值 ────────────────────────────────────────
const EFFECTS = {
  atk:     [0.10, 0.15, 0.20, 0.25],
  def:     [0.10, 0.15, 0.20, 0.25],
  hp:      [0.10, 0.15, 0.20, 0.25],
  atk_def: [0.07, 0.12, 0.17, 0.22],
  atk_hp:  [0.07, 0.12, 0.17, 0.22],
  def_hp:  [0.07, 0.12, 0.17, 0.22],
  full:    [0.05, 0.09, 0.13, 0.17],
  cat:     [0.20, 0.35, 0.50, 0.70],
  revival: [0.30, 0.50, 0.70, 1.00],  // 復活後回血比例
  loot:    [1,    2,    3,    5   ],   // 額外材料數量（整數）
  lucky:   [0.05, 0.10, 0.15, 0.25],
  gold:    [0.20, 0.35, 0.50, 0.70],
  xp:      [0.15, 0.25, 0.40, 0.60],
};

const TIER_DURABILITY  = [3, 4, 5, 6];
const TIER_ROMAN       = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ"];
export const TIER_COLOR = { 1:"#94a3b8", 2:"#4ade80", 3:"#818cf8", 4:"#f59e0b" };
export const TIER_NAME  = { 1:"青銅", 2:"翠玉", 3:"紫晶", 4:"黃金" };

// ── 生成 52 種符文定義 ─────────────────────────────────────────
export const RUNES   = {};
export const RUNE_IDS = [];

Object.entries(RUNE_TYPES).forEach(([typeId, t]) => {
  [1, 2, 3, 4].forEach((tier, idx) => {
    const id = `${typeId}_t${tier}`;
    RUNE_IDS.push(id);
    RUNES[id] = {
      id,
      typeId,
      tier,
      label:        `${t.label} ${TIER_ROMAN[idx]}`,
      icon:         t.icon,
      color:        t.color,
      tierColor:    TIER_COLOR[tier],
      tierName:     TIER_NAME[tier],
      desc:         t.desc,
      durability:   TIER_DURABILITY[idx],
      maxDurability:TIER_DURABILITY[idx],
      effect:       EFFECTS[typeId]?.[idx] ?? 0,
    };
  });
});

// ── 最多 3 個插槽，不同類型不重複 ─────────────────────────────
export const MAX_RUNE_SLOTS = 3;

// ── 查詢 ──────────────────────────────────────────────────────
export function getRune(id)      { return RUNES[id] || null; }
export function getRuneType(tid) { return RUNE_TYPES[tid] || null; }

// ── 計算裝備符文加成（傳入 runeId 陣列，每個元素可含 durability）
// 回傳 { atkMult, defMult, hpMult, catMult, xpMult, goldMult,
//         lootBonus, luckyBonus, revivalHpPct }
export function calcRuneBonus(equippedRunes = []) {
  let atkMult = 1, defMult = 1, hpMult = 1;
  let catMult = 1, xpMult = 1, goldMult = 1;
  let lootBonus = 0, luckyBonus = 0, revivalHpPct = 0;

  equippedRunes.forEach(entry => {
    const runeId = typeof entry === "string" ? entry : entry?.runeId;
    if (!runeId) return;
    const r = RUNES[runeId];
    if (!r) return;
    const e = r.effect;
    switch (r.typeId) {
      case "atk":     atkMult  += e; break;
      case "def":     defMult  += e; break;
      case "hp":      hpMult   += e; break;
      case "atk_def": atkMult  += e; defMult += e; break;
      case "atk_hp":  atkMult  += e; hpMult  += e; break;
      case "def_hp":  defMult  += e; hpMult  += e; break;
      case "full":    atkMult  += e; defMult += e; hpMult += e; break;
      case "cat":     catMult  += e; break;
      case "revival": revivalHpPct = Math.max(revivalHpPct, e); break;
      case "loot":    lootBonus   += e; break;
      case "lucky":   luckyBonus  += e; break;
      case "gold":    goldMult    += e; break;
      case "xp":      xpMult      += e; break;
      default: break;
    }
  });

  return { atkMult, defMult, hpMult, catMult, xpMult, goldMult,
           lootBonus, luckyBonus, revivalHpPct };
}

// ── 效果標籤（UI 用）─────────────────────────────────────────
export function runeEffectLabel(runeId) {
  const r = RUNES[runeId];
  if (!r) return "";
  const e = r.effect;
  const pct = `+${Math.round(e * 100)}%`;
  switch (r.typeId) {
    case "atk":     return `ATK ${pct}`;
    case "def":     return `DEF ${pct}`;
    case "hp":      return `HP ${pct}`;
    case "atk_def": return `ATK+DEF ${pct}`;
    case "atk_hp":  return `ATK+HP ${pct}`;
    case "def_hp":  return `DEF+HP ${pct}`;
    case "full":    return `全屬性 ${pct}`;
    case "cat":     return `貓貓 ${pct}`;
    case "revival": return `復活 ${Math.round(e * 100)}% HP`;
    case "loot":    return `材料 +${e}`;
    case "lucky":   return `稀有率 ${pct}`;
    case "gold":    return `金幣 ${pct}`;
    case "xp":      return `XP ${pct}`;
    default:        return "";
  }
}

// ── 地下城掉落符文（依地下城難度掉對應階段）─────────────────
// dungeonTier: 1=普通, 2=困難, 3=菁英, 4=噩夢
export function rollRuneDrop(dungeonTier = 1) {
  const typeIds  = Object.keys(RUNE_TYPES);
  const typeId   = typeIds[Math.floor(Math.random() * typeIds.length)];
  const runeId   = `${typeId}_t${dungeonTier}`;
  return getRune(runeId);
}
