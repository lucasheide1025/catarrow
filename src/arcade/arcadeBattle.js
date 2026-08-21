// src/arcade/arcadeBattle.js — 訪客冒險戰鬥引擎（純函式，可單元測試）
// 6 箭一回合：每箭 0~10 分，總分 = 傷害。怪物有特殊射箭條件（規格 §9），
// 貓咪自動技能（§12）、寶箱（§13）都藏在底層，UI 只顯示玩家看得懂的文字。

import { WORLD_BOSSES } from "../lib/worldBossData";

export const ARROWS_PER_ROUND = 6;
export const MAX_ARROW = 10;
export const RED_MIN = 8;        // 「紅區」= 單箭 ≥8
export const BULLSEYE = 10;      // 「黃心」= 單箭 10 分
export const STEALTH_TARGET = 40; // 幽靈隱身：6 箭總分 ≥40 才能找到
export const BOSS_INTERRUPT = 36; // 訪客 Boss：新手約每箭 6 分即可打斷大招
export const BOSS_RING_MISS_MULT = 0.8; // 沒中弱點仍保留 80% 傷害，避免新手王戰拖太久
export const PLAYER_MAX_HP = 100;
export const RESCUE_DAMAGE = 5;  // 全脫靶時的貓咪救援

// ── 訪客怪物 identity ─────────────────────────────────────
// gameplay id 可保持舊版相容，但畫面名稱與圖片永遠由同一個 sourceMonsterId 配對。
// sourceMonsterId 對應學籍系統 public/monsters/{id}.webp 的既有怪物外觀。
const ARCADE_MONSTER_IDENTITIES = Object.freeze({
  goblin: { sourceMonsterId: "temple_1", name: "哥布林", emoji: "👺" },
  beetle: { sourceMonsterId: "insect_1", name: "大蟑螂", emoji: "🪳" },
  wolf:   { sourceMonsterId: "temple_3", name: "狼人", emoji: "🐺" },
  turtle: { sourceMonsterId: "temple_2", name: "骷髏劍士", emoji: "💀" },
  ghost:  { sourceMonsterId: "ghost_1", name: "鏡幕幽姬", emoji: "👻" },
});

function buildArcadeMonster(id, combat) {
  const identity = ARCADE_MONSTER_IDENTITIES[id];
  if (!identity) throw new Error(`Unknown arcade monster identity: ${id}`);
  return {
    id,
    ...identity,
    image: `/monsters/${identity.sourceMonsterId}.webp`,
    ...combat,
  };
}

export const ARCADE_MONSTERS = [
  buildArcadeMonster("goblin", { hp: 60, def: 0, atk: 6, ability: "none", rewardCoins: 15,
    task: "🎯 本回合：盡量射高分！" }),
  buildArcadeMonster("beetle", { hp: 80, def: 2, atk: 8, ability: "none", rewardCoins: 18,
    task: "🎯 本回合：盡量射高分！" }),
  buildArcadeMonster("wolf", { hp: 100, def: 2, atk: 12, ability: "dodge", rewardCoins: 25,
    task: `🎯 至少 2 箭進紅區（≥${RED_MIN} 分），就能閃避敵人的突進！` }),
  buildArcadeMonster("turtle", { hp: 120, def: 5, atk: 8, ability: "break", rewardCoins: 25,
    task: `🎯 射中 1 箭黃心（${BULLSEYE} 分），就能擊破防禦！` }),
  buildArcadeMonster("ghost", { hp: 90, def: 0, atk: 10, ability: "stealth", rewardCoins: 22,
    task: `🎯 本回合總分 ≥ ${STEALTH_TARGET}，才能找到隱身目標！` }),
];

// ── 訪客版世界王 adapter ───────────────────────────────────
// 名稱／稱號／外觀沿用學籍系統 WORLD_BOSSES；HP/ATK/DEF 完全是訪客版，不回寫也不修改正式世界王。
export function buildVisitorWorldBoss(worldBossKey, combat) {
  const source = WORLD_BOSSES[worldBossKey];
  if (!source) throw new Error(`Unknown world boss: ${worldBossKey}`);
  const imageKey = source.pixelKey || worldBossKey;
  return {
    id: combat.id || `visitor_${worldBossKey}`,
    worldBossKey,
    name: source.name,
    title: source.title,
    desc: source.desc,
    emoji: combat.emoji || "👑",
    image: `/worldboss/${imageKey}.webp`,
    hp: combat.hp ?? 115,
    def: combat.def ?? 1,
    atk: combat.atk ?? 5,
    ability: "boss",
    rewardCoins: combat.rewardCoins ?? 60,
    skillName: combat.skillName || source.title || "世界王之怒",
    task: combat.task || `🎯 總分 ≥ ${BOSS_INTERRUPT}，打斷 ${source.name} 的大招！`,
  };
}

export const ARCADE_BOSS = buildVisitorWorldBoss("forest_boss_small", {
  id: "forest_worldboss", hp: 115, def: 1, atk: 5, rewardCoins: 60,
});

// ── 單人 Boss 靶面弱點圈（世界王語意）─────────────────────────
// 王戰改用靶面點擊輸入：自己的弱點圈畫在靶面上，射進圈 = 弱點攻擊。
// 命中 → 傷害 ×bonus（多支進圈再疊 8%/支）；全脫圈仍保留大部分傷害，避免新手卡王。
// 打斷大招（總分 ≥ BOSS_INTERRUPT）機制不變，圈只影響傷害。
export const SOLO_RING = {
  id: "solo",
  desc: "射進你的圈！",
  color: "#f87171",
  radius: 0.13, // 圈在靶面上的半徑（1.0 ＝ 靶紙半徑，越小越難瞄）
  bonus: 1.35,  // 命中弱點圈有感加成，但不讓新手一回合秒王
};

/** 為單人 Boss 戰隨機置一個弱點圈（整個圈在靶內） */
export function rollSoloRing(rng = Math.random) {
  const r = SOLO_RING.radius;
  const maxR = Math.max(0, 0.86 - r); // 圈心可放範圍：扣掉圈自己的半徑＋邊距
  const angle = rng() * Math.PI * 2;
  const dist = Math.sqrt(rng()) * maxR;
  return { ...SOLO_RING, cx: Math.cos(angle) * dist, cy: Math.sin(angle) * dist };
}

export function arcadeMonsterById(id) {
  return ARCADE_MONSTERS.find((m) => m.id === id) || null;
}

// ── 貓森遺跡（第一座地下城，規格 §17）────────────────────────
// 小怪 → 小怪 → 狼王 → Boss，每勝一場開寶箱。
export function buildAdventure() {
  return {
    dungeon: "🌲 貓森遺跡",
    fights: [
      arcadeMonsterById("goblin"),
      arcadeMonsterById("beetle"),
      arcadeMonsterById("wolf"),
    ],
    boss: ARCADE_BOSS,
  };
}

export function clampArrow(v) {
  return Math.max(0, Math.min(MAX_ARROW, Math.round(v) || 0));
}

/** 單支箭的分數：數字（記分板）或靶面落點物件 { nx, ny, score }（王戰靶面） */
export function scoreOfArrow(a) {
  if (typeof a === "number") return Math.min(10, Math.max(0, a));
  if (a && typeof a === "object" && typeof a.score === "number") return Math.min(10, Math.max(0, a.score));
  return 0;
}

export function formatArrow(v) {
  return v <= 0 ? "X" : String(v);
}

// 紅區箭數（單箭 ≥ RED_MIN）
export function redZoneCount(arrows) {
  return arrows.filter((a) => a >= RED_MIN).length;
}

// ── 回合結算（純函式）───────────────────────────────────────
// state: { playerHp, monsterHp(本回合前的怪物現存血), cat, monster, atkBuff=1, skillChanceBuff=0 }
// arrows: 長度 6 的 0~10 陣列
// rng: 注入亂數（測試可固定）
export function resolveRound(state, arrows, rng = Math.random) {
  const { playerHp, cat, monster, atkBuff = 1, skillChanceBuff = 0 } = state;
  const monsterHpBefore = state.monsterHp ?? monster.hp;
  const scores = arrows.map(scoreOfArrow); // -1=未填視為 0；11=X 內十計 10
  const total = scores.reduce((a, b) => a + b, 0);
  const log = [];
  let stealthReduced = false;
  let breakApplied = false;
  let bossInterrupted = false;
  let dodge = false;

  let dmg = total;

  // 幽靈隱身：找不到 → 傷害只剩 30%
  if (monster.ability === "stealth") {
    if (total >= STEALTH_TARGET) {
      log.push({ kind: "info", text: `👻 找到幽靈了！${monster.name} 無所遁形！` });
    } else {
      stealthReduced = true;
      dmg = Math.round(dmg * 0.3);
      log.push({ kind: "info", text: `👻 ${monster.name} 隱身中，只造成 ${dmg} 傷害！` });
    }
  }

  // 破防型怪物：1 箭黃心 → 本回合傷害 ×1.5
  if (monster.ability === "break" && scores.some((a) => a === BULLSEYE)) {
    breakApplied = true;
    dmg = Math.round(dmg * 1.5);
    log.push({ kind: "info", text: "🐢 破甲成功！傷害大幅提升！" });
  }

  // 道具／Buff（火焰箭）
  if (atkBuff > 1) {
    dmg = Math.round(dmg * atkBuff);
    log.push({ kind: "info", text: "🏹 火焰箭發威，攻擊變強了！" });
  }

  // 怪物防禦
  if (monster.def > 0) {
    const reduced = Math.max(0, dmg - monster.def);
    if (reduced !== dmg) dmg = reduced;
  }

  // 單人 Boss 靶面弱點圈（世界王語意）：射進圈 → 傷害加成；全脫圈仍保留 80% 傷害。
  // 打斷大招（總分 ≥ BOSS_INTERRUPT）機制不變，圈只影響傷害。
  let weakHits = 0;
  let ringMet = null;
  const ring = state.ring;
  const shots = arrows.filter((a) => a && typeof a === "object" && a.nx != null && a.ny != null);
  if (monster.ability === "boss" && shots.length > 0 && ring && ring.cx != null) {
    weakHits = shots.filter((a) => Math.hypot(a.nx - ring.cx, a.ny - ring.cy) <= ring.radius).length;
    ringMet = weakHits > 0;
    if (ringMet) {
      dmg = Math.round(dmg * ring.bonus * (1 + 0.08 * Math.max(0, weakHits - 1)));
      log.push({ kind: "cat", text: `🎯 命中弱點圈 ×${weakHits}！（傷害加成）` });
    } else {
      dmg = Math.round(dmg * BOSS_RING_MISS_MULT);
      log.push({ kind: "danger", text: "❌ 沒射中弱點圈（仍保留 80% 傷害）" });
    }
  }

  // 貓咪自動技能（§12）
  let catEvent = null;
  if (total <= 0) {
    // 全脫靶 → 貓咪救援
    catEvent = { type: "rescue", extra: RESCUE_DAMAGE, text: `🐱 ${cat.name}：「${cat.lines.rescue}」💥 貓咪救援 +${RESCUE_DAMAGE}！` };
    dmg = RESCUE_DAMAGE;
    log.push({ kind: "cat", text: catEvent.text });
  } else if (rng() < (cat.skill.chance + (skillChanceBuff || 0))) {
    catEvent = rollCatSkill(cat, dmg, rng);
    if (catEvent.type === "atk") dmg += catEvent.extra;
    log.push({ kind: "cat", text: catEvent.text });
  }

  const monsterHp = Math.max(0, monsterHpBefore - dmg);
  const victory = monsterHp <= 0;

  // 怪物反擊
  let counter = 0;
  let healAfter = 0;
  if (!victory) {
    if (monster.ability === "dodge" && redZoneCount(scores) >= 2) {
      dodge = true;
      log.push({ kind: "info", text: `🐺 ${monster.name} 撲空，閃避成功！` });
    } else {
      let c = Math.max(1, monster.atk + Math.round(rng() * 4) - 2);
      if (monster.ability === "boss") {
        if (total >= BOSS_INTERRUPT) {
          bossInterrupted = true;
          c = Math.max(1, Math.round(c * 0.4));
          log.push({ kind: "info", text: `💥 打斷大招！${monster.name} 的蓄力被中斷了！` });
        } else {
          c = Math.round(c * 2);
          log.push({ kind: "danger", text: `🌋 ${monster.name} 大招命中！` });
        }
      }
      if (catEvent && catEvent.type === "def") {
        c = Math.max(0, Math.round(c * (1 - catEvent.reduction)));
      }
      counter = c;
      log.push({ kind: "enemy", text: `💢 ${monster.name} 反擊 -${counter}` });
    }
  }

  let playerHpAfter = Math.max(0, playerHp - counter);
  // 治療技能：反擊後補血
  if (catEvent && catEvent.type === "heal") {
    healAfter = catEvent.healed;
    playerHpAfter = Math.min(PLAYER_MAX_HP, playerHpAfter + catEvent.healed);
  }
  const defeat = playerHpAfter <= 0;

  return {
    arrows, total, dmg, monsterHp, playerHp: playerHpAfter,
    victory, defeat, log, catEvent,
    stealthReduced, breakApplied, dodge, bossInterrupted, counter,
    weakHits, ringMet,
  };
}

function rollCatSkill(cat, dmg, rng) {
  const s = cat.skill;
  if (s.type === "heal") {
    const mult = cat.id === "daming" ? 1.25 : cat.id === "gege" ? 1.15 : 1;
    const healed = Math.round((10 + rng() * 8) * mult);
    return { type: "heal", healed, extra: 0, text: `💚 ${cat.name} 使出治療，恢復 ${healed} 生命！` };
  }
  if (s.type === "def") {
    let reduction;
    if (cat.id === "diandian") reduction = 0.65 + rng() * 0.15;
    else if (cat.id === "youyou") reduction = 0.55 + rng() * 0.2;
    else reduction = 0.5 + rng() * 0.2;
    return { type: "def", reduction, extra: 0, text: `🛡️ ${cat.name} 挺身擋下攻擊！` };
  }
  // atk 追擊
  const mult = cat.id === "baobao" ? 0.45 + rng() * 0.2 : 0.35 + rng() * 0.15;
  const extra = Math.max(3, Math.round(dmg * mult));
  return { type: "atk", extra, text: `⚔️ ${cat.name} 追擊 +${extra}！` };
}

// ── 冒險評價（§25）：依剩餘生命比例 ─────────────────────────
export function gradeAdventure(playerHp) {
  const pct = playerHp / PLAYER_MAX_HP;
  if (pct >= 0.7) return { grade: "S", bonusMult: 1.5, label: "無傷大冒險！" };
  if (pct >= 0.5) return { grade: "A", bonusMult: 1.3, label: "漂亮的冒險！" };
  if (pct >= 0.3) return { grade: "B", bonusMult: 1.1, label: "穩穩的冒險！" };
  return { grade: "C", bonusMult: 1.0, label: "驚險的冒險！" };
}

// ── M2：月夜迷城（選路）＋深淵巢穴（撤退/繼續）──────────────────

export const ADVENTURE_TYPES = {
  forest: { id: "forest", icon: "🌲", name: "貓森遺跡", difficulty: "★☆☆", desc: "新手推薦：小怪 → 寶箱 → Boss" },
  moon:   { id: "moon",   icon: "🌙", name: "月夜迷城", difficulty: "★★☆", desc: "選路冒險：寶箱／神秘事件／菁英怪" },
  abyss:  { id: "abyss",  icon: "🔥", name: "深淵巢穴", difficulty: "★★★", desc: "高風險高報酬：繼續深入還是撤退" },
};

// ── 月夜迷城：岔路選擇 ──────────────────────────────────────
export const MOON_ROUTES = [
  { id: "treasure", icon: "📦", label: "寶箱路", desc: "看起來有寶箱", tone: "#c97b2d" },
  { id: "event",    icon: "❓", label: "神秘事件", desc: "未知的相遇", tone: "#2b3a67" },
  { id: "elite",    icon: "⚔️", label: "菁英怪", desc: "危險的獵人", tone: "#b23b2e" },
];

export const MOON_ROUTE_COUNT = 3;

export const MOON_BOSS = buildVisitorWorldBoss("western_boss_small", {
  id: "moon_worldboss", emoji: "🌕", hp: 115, def: 1, atk: 6, rewardCoins: 80,
});

// 神秘事件（好壞都有，娛樂優先）
const MOON_EVENTS = [
  { id: "heal",   icon: "🍙", text: "流浪貓商人出現，遞來貓咪飯糰！恢復 20 生命。", good: true },
  { id: "catnip", icon: "🌿", text: "發現貓薄荷！接下來的戰鬥貓咪特別有精神（技能率 +15%）。", good: true },
  { id: "coins",  icon: "🪙", text: "撿到一個錢袋！獲得 20 金幣。", good: true },
  { id: "ambush", icon: "⚠️", text: "是陷阱！被怪物偷襲，受到 12 傷害。", good: false },
  { id: "mystery", icon: "✨", text: "一陣神秘光芒……什麼都沒發生？", good: null },
];

export function rollMoonEvent(rng = Math.random) {
  return MOON_EVENTS[Math.floor(rng() * MOON_EVENTS.length)];
}

export function buildMoonLabyrinth() {
  return {
    dungeon: "🌙 月夜迷城",
    entry: arcadeMonsterById("goblin"),
    randomFight: () => ARCADE_MONSTERS[Math.floor(Math.random() * ARCADE_MONSTERS.length)],
    boss: MOON_BOSS,
  };
}

// 菁英怪：更強、獎勵更多
export function eliteVariant(monster) {
  return {
    ...monster,
    id: `${monster.id}_elite`,
    name: `精英${monster.name}`,
    hp: Math.round(monster.hp * 1.6),
    def: monster.def + 2,
    atk: Math.round(monster.atk * 1.4),
    rewardCoins: Math.round(monster.rewardCoins * 2),
    elite: true,
  };
}

// ── 深淵巢穴：樓層縮放 ＋ 撤退/繼續 ─────────────────────────
export const ABYSS_START_FLOOR = 1;
export const ABYSS_MAX_FLOOR = 12;

export function abyssMonsterForFloor(floor, lootMult = 1) {
  const base = ARCADE_MONSTERS[(floor - 1) % ARCADE_MONSTERS.length];
  const scale = 1 + (floor - 1) * 0.35;
  return {
    ...base,
    id: `${base.id}_abyss_${floor}`,
    name: `深淵${base.name}`,
    hp: Math.round(base.hp * scale),
    def: base.def + Math.floor((floor - 1) / 2),
    atk: Math.round(base.atk * (1 + (floor - 1) * 0.12)),
    rewardCoins: Math.round(base.rewardCoins * lootMult * (1 + (floor - 1) * 0.4) * (floor % 2 === 0 ? 1.5 : 1)),
    floor,
    task: `🎯 深淵第 ${floor} 層：盡量射高分！（戰利品 ×${lootMult}）`,
  };
}

export function abyssGrade(floorsCleared) {
  if (floorsCleared >= 6) return { grade: "S", label: "深淵征服者！", bonusMult: 1.5 };
  if (floorsCleared >= 4) return { grade: "A", label: "深淵好手！", bonusMult: 1.3 };
  if (floorsCleared >= 2) return { grade: "B", label: "深淵探險家！", bonusMult: 1.1 };
  return { grade: "C", label: "深淵新手…", bonusMult: 1.0 };
}

// ── 深淵王座（第 12 層最深處的世界王戰）──────────────────────
// 三種模式都使用學籍系統既有世界王 identity，但訪客版戰鬥數值完全獨立。
// 打到最深處（ABYSS_MAX_FLOOR）才出現：raid 深色舞台＋過場＋靶面弱點圈。
export const ABYSS_DEEP_BOSS = buildVisitorWorldBoss("ghost_boss", {
  id: "abyss_worldboss", emoji: "👹", hp: 115, def: 1, atk: 7, rewardCoins: 200,
});

/** 深淵世界王（獎勵隨 lootMult 縮放，與其他樓層一致） */
export function abyssDeepBoss(lootMult = 1) {
  return {
    ...ABYSS_DEEP_BOSS,
    rewardCoins: Math.round(ABYSS_DEEP_BOSS.rewardCoins * lootMult),
    task: `👹 深淵王座：總分 ≥ ${BOSS_INTERRUPT}，打斷 ${ABYSS_DEEP_BOSS.name} 的大招！（戰利品 ×${lootMult}）`,
  };
}
