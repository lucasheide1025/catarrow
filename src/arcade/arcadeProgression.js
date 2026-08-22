// src/arcade/arcadeProgression.js — 訪客 Arcade 本機養成單一真本（純函式）
// 永久資料只屬於目前瀏覽器；不依賴學籍資料、Firestore 或正式卡片/裝備系統。

export const ARCADE_PROFILE_SCHEMA_VERSION = 2;
export const PLAYER_MAX_LEVEL = 30;

export const STARTER_EQUIPMENT = Object.freeze({
  weapon: "starter_bow",
  armor: "practice_guard",
  accessory: "cat_paw_charm",
});

export const ARCADE_EQUIPMENT = Object.freeze({
  starter_bow: {
    id: "starter_bow", slot: "weapon", icon: "🏹", name: "新手木弓",
    desc: "簡單可靠的入門武器。",
  },
  practice_guard: {
    id: "practice_guard", slot: "armor", icon: "🛡️", name: "練習護具",
    desc: "增加生命與防禦。",
  },
  cat_paw_charm: {
    id: "cat_paw_charm", slot: "accessory", icon: "🐾", name: "貓爪護符",
    desc: "同行貓送你的幸運護符。",
  },
});

export const EQUIPMENT_UPGRADE_COSTS = Object.freeze([80, 140, 220, 320, 450]);

export const ARCADE_CARDS = Object.freeze({
  poison: { id: "poison", icon: "☠️", name: "毒箭", desc: "高分命中時可讓怪物中毒。", status: "poison" },
  burn: { id: "burn", icon: "🔥", name: "灼熱箭", desc: "高分命中時可附加灼燒。", status: "burn" },
  armor_break: { id: "armor_break", icon: "🔨", name: "破甲箭", desc: "高分命中時可削弱怪物防禦。", status: "armorBreak" },
  guard: { id: "guard", icon: "🛡️", name: "守護卡", desc: "裝備時 DEF +1。", status: "guard" },
});

export const STARTER_CARDS = Object.freeze(["poison", "burn", "armor_break", "guard"]);
export const STARTER_EQUIPPED_CARDS = Object.freeze(["poison", "guard"]);
export const CARD_UPGRADE_COSTS = Object.freeze([60, 120]);

function clampLevel(level) {
  return Math.max(1, Math.min(PLAYER_MAX_LEVEL, Math.floor(Number(level) || 1)));
}

function normalizeEquipSlot(existing, itemId) {
  const level = Math.max(0, Math.min(5, Math.floor(Number(existing?.level) || 0)));
  return { itemId: existing?.itemId || itemId, level };
}

function starterCardOwned(existing = {}) {
  const owned = { ...existing };
  for (const id of STARTER_CARDS) {
    const prev = owned[id];
    if (prev && typeof prev === "object") {
      owned[id] = { level: Math.max(1, Math.min(3, Number(prev.level) || 1)), shards: Math.max(0, Number(prev.shards) || 0) };
    } else {
      owned[id] = { level: 1, shards: 0 };
    }
  }
  return owned;
}

/** 舊 profile → 現行本機 schema；永遠不會清掉未知欄位。 */
export function normalizeArcadeProfile(profile) {
  if (!profile || typeof profile !== "object") return profile || null;
  const playerLevel = clampLevel(profile.playerLevel ?? profile.catLevel ?? 1);
  const playerXp = Math.max(0, Math.floor(Number(profile.playerXp ?? profile.xp) || 0));
  const existingEquipment = profile.equipment || {};
  const existingCards = profile.cards || {};
  const owned = starterCardOwned(existingCards.owned || {});
  // 只有舊檔／首次建立尚未有 equipped 陣列時才發送預設卡組。
  // 一旦玩家已經有明確 equipped（即使是 [] 或只裝 1 張），必須尊重玩家選擇，
  // 否則每次 normalize 都會把剛卸下的 starter card 自動裝回去。
  const hasExplicitEquipped = Array.isArray(existingCards.equipped);
  const equippedSource = hasExplicitEquipped ? existingCards.equipped : STARTER_EQUIPPED_CARDS;
  const equipped = [...new Set(equippedSource.filter((id) => owned[id]))].slice(0, 2);

  return {
    ...profile,
    schemaVersion: ARCADE_PROFILE_SCHEMA_VERSION,
    revision: Math.max(0, Math.floor(Number(profile.revision) || 0)),
    updatedAt: Math.max(0, Number(profile.updatedAt) || Number(profile.lastPlayedAt) || 0),
    playerLevel,
    playerXp,
    // 舊欄位暫時保留為唯讀相容別名；新程式一律使用 playerLevel/playerXp。
    catLevel: playerLevel,
    xp: playerXp,
    coins: Math.max(0, Math.floor(Number(profile.coins) || 0)),
    inventory: { ...(profile.inventory || {}) },
    equipment: {
      weapon: normalizeEquipSlot(existingEquipment.weapon, STARTER_EQUIPMENT.weapon),
      armor: normalizeEquipSlot(existingEquipment.armor, STARTER_EQUIPMENT.armor),
      accessory: normalizeEquipSlot(existingEquipment.accessory, STARTER_EQUIPMENT.accessory),
    },
    cards: { ...existingCards, owned, equipped },
    settledRuns: Array.isArray(profile.settledRuns) ? profile.settledRuns.filter(Boolean).slice(-40) : [],
  };
}

export function xpForPlayerLevel(level) {
  return clampLevel(level) * 100;
}

export function playerLevelProgress(level, xp) {
  if (clampLevel(level) >= PLAYER_MAX_LEVEL) return 100;
  return Math.min(100, Math.round((Math.max(0, Number(xp) || 0) / xpForPlayerLevel(level)) * 100));
}

function equipmentBonus(itemId, level = 0) {
  const lv = Math.max(0, Math.min(5, Number(level) || 0));
  if (itemId === "starter_bow") return { hp: 0, atk: 1 + lv + (lv >= 5 ? 1 : 0), def: 0 };
  if (itemId === "practice_guard") return { hp: 5 + lv * 5, atk: 0, def: 1 + Math.floor(lv / 2) };
  if (itemId === "cat_paw_charm") return { hp: lv * 2, atk: Math.floor((lv + 1) / 3), def: Math.floor(lv / 4) };
  return { hp: 0, atk: 0, def: 0 };
}

/** 訪客所有戰鬥模式唯一的能力 adapter。 */
export function getArcadePlayerStats(profile) {
  const p = normalizeArcadeProfile(profile) || {};
  const level = clampLevel(p.playerLevel);
  const levelBonus = {
    hp: (level - 1) * 5,
    atk: Math.floor(level / 5),
    def: Math.floor(level / 5),
  };
  const equipBonus = { hp: 0, atk: 0, def: 0 };
  for (const slot of ["weapon", "armor", "accessory"]) {
    const equipped = p.equipment?.[slot];
    const b = equipmentBonus(equipped?.itemId, equipped?.level);
    equipBonus.hp += b.hp;
    equipBonus.atk += b.atk;
    equipBonus.def += b.def;
  }
  const guardLevel = p.cards?.equipped?.includes("guard")
    ? Math.max(1, Number(p.cards?.owned?.guard?.level) || 1)
    : 0;
  const cardDef = guardLevel;
  return {
    level,
    maxHp: 100 + levelBonus.hp + equipBonus.hp,
    atk: 10 + levelBonus.atk + equipBonus.atk,
    def: 5 + levelBonus.def + equipBonus.def + cardDef,
    levelBonus,
    equipmentBonus: equipBonus,
    cardBonus: { def: cardDef },
  };
}

/**
 * Adapter for visitor-only combat status cards.
 * Guard is already reflected in getArcadePlayerStats().def, so it is excluded here.
 */
export function getArcadeEquippedCardEffects(profile) {
  const p = normalizeArcadeProfile(profile);
  if (!p) return [];
  return (p.cards?.equipped || []).flatMap((id) => {
    const def = ARCADE_CARDS[id];
    const owned = p.cards?.owned?.[id];
    if (!def || !owned || def.status === "guard") return [];
    const level = Math.max(1, Math.min(3, Number(owned.level) || 1));
    return [{
      id,
      status: def.status,
      level,
      chance: [0.15, 0.20, 0.25][level - 1],
    }];
  });
}

/**
 * 多人房只同步這份已計算的戰鬥快照；永久 profile、金幣、背包與裝備物件都不進房間。
 */
export function buildArcadeCombatSnapshot(profile) {
  const stats = getArcadePlayerStats(profile);
  return {
    level: stats.level,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    cardEffects: getArcadeEquippedCardEffects(profile).map((fx) => ({
      id: fx.id,
      status: fx.status,
      level: Math.max(1, Math.min(3, Number(fx.level) || 1)),
      chance: Math.max(0, Math.min(1, Number(fx.chance) || 0)),
    })),
  };
}

function stableHash01(seed) {
  let h = 2166136261;
  const text = String(seed || "");
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function arcadeHighQualityHitCount(arrows = []) {
  return (arrows || []).filter((arrow) => {
    if (arrow && typeof arrow === "object") {
      if (arrow.label === "X") return true;
      return Number(arrow.score) >= 9;
    }
    return Number(arrow) === 11 || Number(arrow) >= 9;
  }).length;
}

export function mergeArcadeStatus(statuses = [], incoming = {}) {
  if (!incoming?.id) return [...(statuses || [])];
  const list = (statuses || []).filter((s) => s?.id);
  const index = list.findIndex((s) => s.id === incoming.id);
  const next = {
    id: incoming.id,
    level: Math.max(1, Math.min(3, Number(incoming.level) || 1)),
    duration: Math.max(1, Math.min(2, Number(incoming.duration) || 2)),
  };
  if (index < 0) return [...list, next].slice(-4);
  const prev = list[index];
  list[index] = {
    ...prev,
    level: Math.max(Number(prev.level) || 1, next.level),
    duration: Math.max(Number(prev.duration) || 1, next.duration),
  };
  return list;
}

/** 高品質箭（9/10/X）才有資格觸發；seed 讓權威多人回合可重算。 */
export function applyArcadeCardProcs({ cardEffects = [], statuses = [], qualityHits = 0, seed = "" } = {}) {
  let next = [...(statuses || [])];
  const procs = [];
  if (Number(qualityHits) <= 0) return { statuses: next, procs };
  (cardEffects || []).forEach((fx, index) => {
    if (!["poison", "burn", "armorBreak"].includes(fx?.status)) return;
    const chance = Math.max(0, Math.min(1, Number(fx.chance) || 0));
    if (stableHash01(`${seed}:${fx.id || fx.status}:${index}`) >= chance) return;
    const applied = { id: fx.status, level: Math.max(1, Math.min(3, Number(fx.level) || 1)), duration: 2 };
    next = mergeArcadeStatus(next, applied);
    procs.push(applied);
  });
  return { statuses: next, procs };
}

export function arcadeEffectiveDefense(def, statuses = []) {
  const base = Math.max(0, Number(def) || 0);
  const armor = (statuses || []).find((s) => s?.id === "armorBreak");
  if (!armor) return base;
  const pct = [0, 0.15, 0.20, 0.25][Math.max(1, Math.min(3, Number(armor.level) || 1))];
  return Math.max(0, Math.round(base * (1 - pct)));
}

/** poison/burn 每回合 tick；所有多人異常最多保留 2 回合。 */
export function tickArcadeStatuses(statuses = []) {
  let damage = 0;
  const next = [];
  for (const status of statuses || []) {
    const level = Math.max(1, Math.min(3, Number(status?.level) || 1));
    if (status?.id === "poison") damage += 2 + level * 2;
    if (status?.id === "burn") damage += 3 + level * 3;
    const duration = Math.max(0, (Number(status?.duration) || 1) - 1);
    if (duration > 0) next.push({ ...status, level, duration });
  }
  return { damage, statuses: next };
}

export function arcadeCardUpgradeCost(profile, cardId) {
  const p = normalizeArcadeProfile(profile);
  const card = p?.cards?.owned?.[cardId];
  if (!card) return null;
  const level = Math.max(1, Math.min(3, Number(card.level) || 1));
  return level >= 3 ? null : CARD_UPGRADE_COSTS[level - 1];
}

export function upgradeArcadeCard(profile, cardId) {
  const p = normalizeArcadeProfile(profile);
  const current = p?.cards?.owned?.[cardId];
  if (!current || !ARCADE_CARDS[cardId]) return { ok: false, reason: "找不到這張卡片", updated: p };
  const level = Math.max(1, Math.min(3, Number(current.level) || 1));
  if (level >= 3) return { ok: false, reason: "卡片已強化到 Lv.3", updated: p };
  const cost = arcadeCardUpgradeCost(p, cardId);
  if ((p.coins || 0) < cost) return { ok: false, reason: `金幣不足！需要 ${cost}`, updated: p };
  return {
    ok: true,
    cost,
    updated: {
      ...p,
      coins: p.coins - cost,
      cards: {
        ...p.cards,
        owned: { ...p.cards.owned, [cardId]: { ...current, level: level + 1 } },
      },
    },
  };
}

export function toggleArcadeCard(profile, cardId) {
  const p = normalizeArcadeProfile(profile);
  if (!p?.cards?.owned?.[cardId] || !ARCADE_CARDS[cardId]) {
    return { ok: false, reason: "尚未持有這張卡片", updated: p };
  }
  const equipped = [...(p.cards.equipped || [])];
  const index = equipped.indexOf(cardId);
  if (index >= 0) {
    equipped.splice(index, 1);
    return { ok: true, equipped: false, updated: { ...p, cards: { ...p.cards, equipped } } };
  }
  if (equipped.length >= 2) return { ok: false, reason: "最多只能裝備 2 張卡片", updated: p };
  equipped.push(cardId);
  return { ok: true, equipped: true, updated: { ...p, cards: { ...p.cards, equipped } } };
}

/** XP + 升級獎勵；輸入/輸出都保留完整 profile。 */
export function applyPlayerXp(profile, xpGained) {
  let updated = normalizeArcadeProfile(profile);
  let level = updated.playerLevel;
  let xp = updated.playerXp + Math.max(0, Math.floor(Number(xpGained) || 0));
  let levelsGained = 0;
  const rewards = [];

  while (level < PLAYER_MAX_LEVEL && xp >= xpForPlayerLevel(level)) {
    xp -= xpForPlayerLevel(level);
    level += 1;
    levelsGained += 1;
    const coinReward = 50 * level;
    rewards.push({ type: "coins", amount: coinReward, msg: `升級獎勵 +${coinReward} 金幣！` });
    if (level % 3 === 0) rewards.push({ type: "item", itemId: "cat_fur", amount: 1, msg: "🎁 贈送貓毛 ×1！" });
    if (level % 5 === 0) rewards.push({ type: "item", itemId: "lucky_clover", amount: 1, msg: "🎁 贈送幸運草 ×1！" });
  }
  if (level >= PLAYER_MAX_LEVEL) xp = 0;

  updated = { ...updated, playerLevel: level, playerXp: xp, catLevel: level, xp };
  for (const reward of rewards) {
    if (reward.type === "coins") {
      updated = { ...updated, coins: (updated.coins || 0) + reward.amount };
    } else {
      const inventory = { ...(updated.inventory || {}) };
      inventory[reward.itemId] = (inventory[reward.itemId] || 0) + reward.amount;
      updated = { ...updated, inventory };
    }
  }
  return { updated, levelsGained, rewards };
}

export function equipmentUpgradeCost(profile, slot) {
  const p = normalizeArcadeProfile(profile);
  const lv = p?.equipment?.[slot]?.level ?? 0;
  return lv >= 5 ? null : EQUIPMENT_UPGRADE_COSTS[lv];
}

export function upgradeArcadeEquipment(profile, slot) {
  const p = normalizeArcadeProfile(profile);
  if (!p?.equipment?.[slot]) return { ok: false, reason: "找不到裝備槽位", updated: p };
  const current = p.equipment[slot];
  if (current.level >= 5) return { ok: false, reason: "已強化到 +5", updated: p };
  const cost = equipmentUpgradeCost(p, slot);
  if ((p.coins || 0) < cost) return { ok: false, reason: `金幣不足！需要 ${cost}`, updated: p };
  return {
    ok: true,
    cost,
    updated: {
      ...p,
      coins: p.coins - cost,
      equipment: { ...p.equipment, [slot]: { ...current, level: current.level + 1 } },
    },
  };
}

/**
 * 單場冒險冪等結算。settlement.id 已存在時絕不再發一次獎勵。
 * settlement: { id, coins, xp, inventoryDelta, consumed, stats }
 */
export function applyArcadeSettlement(profile, settlement = {}) {
  const p = normalizeArcadeProfile(profile);
  const id = String(settlement.id || "").trim();
  if (!id) return { ok: false, reason: "missing_settlement_id", updated: p, alreadySettled: false };
  if (p.settledRuns.includes(id)) return { ok: true, updated: p, alreadySettled: true, levelsGained: 0, rewards: [] };

  const inventory = { ...(p.inventory || {}) };
  for (const [itemId, count] of Object.entries(settlement.consumed || {})) {
    inventory[itemId] = Math.max(0, (inventory[itemId] || 0) - Math.max(0, Number(count) || 0));
  }
  for (const [itemId, count] of Object.entries(settlement.inventoryDelta || {})) {
    inventory[itemId] = Math.max(0, (inventory[itemId] || 0) + (Number(count) || 0));
  }

  const s = settlement.stats || {};
  const prevStats = p.statistics || {};
  const statistics = {
    ...prevStats,
    battles: (prevStats.battles || 0) + (s.battles || 0),
    kills: (prevStats.kills || 0) + (s.kills || 0),
    treasures: (prevStats.treasures || 0) + (s.treasures || 0),
    xCount: (prevStats.xCount || 0) + (s.xCount || 0),
    bestDamage: Math.max(prevStats.bestDamage || 0, s.bestDamage || 0),
    bestFloor: Math.max(prevStats.bestFloor || 0, s.bestFloor || 0),
  };

  let next = {
    ...p,
    coins: (p.coins || 0) + Math.max(0, Math.floor(Number(settlement.coins) || 0)),
    inventory,
    statistics,
    settledRuns: [...p.settledRuns, id].slice(-40),
    lastPlayedAt: Date.now(),
  };
  const levelResult = applyPlayerXp(next, settlement.xp || 0);
  next = levelResult.updated;
  return {
    ok: true,
    updated: next,
    alreadySettled: false,
    levelsGained: levelResult.levelsGained,
    rewards: levelResult.rewards,
  };
}
