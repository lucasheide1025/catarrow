import { CHEST_TYPES } from "./itemData";
import { COIN_CHEST_TIERS } from "./lootTable";

export const EXPEDITION_DROP_MULTIPLIER = 2;

const MATERIAL_CHEST_BY_TIER = {
  common: "wood",
  rare: "iron",
  elite: "gold",
  fierce: "epic",
  boss: "mythic",
  mythic: "mythic",
};

function makeMaterialChest(monster, index) {
  const type = MATERIAL_CHEST_BY_TIER[monster?.tier] || "wood";
  return {
    id: `exp_mat_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    kind: "material",
    type,
    family: monster?.family || "ghost",
    tier: monster?.tier || "common",
    from: `地下城：${monster?.name || "怪物"}`,
    ts: Date.now() + index,
  };
}

function makeExpeditionCoinChest(monster, index) {
  const coinTier = monster?.tier || "common";
  const info = COIN_CHEST_TIERS[coinTier] || COIN_CHEST_TIERS.common;
  return {
    id: `exp_coin_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    kind: "coin",
    type: "coin",
    coinTier,
    family: "coin",
    tier: monster?.tier || "common",
    from: `地下城：${monster?.name || "怪物"}`,
    ts: Date.now() + index,
    name: info.name,
    icon: info.icon,
    color: info.color,
    min: info.min,
    max: info.max,
  };
}

export function createExpeditionKillLoot(monster) {
  if (!monster) return emptyExpeditionLoot();
  const materialChests = Array.from(
    { length: EXPEDITION_DROP_MULTIPLIER },
    (_, index) => makeMaterialChest(monster, index),
  );
  const coinChests = Array.from(
    { length: EXPEDITION_DROP_MULTIPLIER },
    (_, index) => makeExpeditionCoinChest(
      monster,
      EXPEDITION_DROP_MULTIPLIER + index,
    ),
  );
  return {
    chests: [...materialChests, ...coinChests],
    defeated: [{
      id: monster.id,
      name: monster.name,
      icon: monster.icon,
      family: monster.family,
      tier: monster.tier,
      variant: monster.variant || "normal",
    }],
    treasure: [],
    bonusCoins: 0,
    bonusArrowDew: 0,
  };
}

export function emptyExpeditionLoot() {
  return {
    chests: [],
    defeated: [],
    treasure: [],
    bonusCoins: 0,
    bonusArrowDew: 0,
  };
}

export function mergeExpeditionLoot(...parts) {
  return parts.filter(Boolean).reduce((result, part) => ({
    chests: [...result.chests, ...(part.chests || [])],
    defeated: [...result.defeated, ...(part.defeated || [])],
    treasure: [...result.treasure, ...(part.treasure || [])],
    bonusCoins: result.bonusCoins + (part.bonusCoins || 0),
    bonusArrowDew: result.bonusArrowDew + (part.bonusArrowDew || 0),
  }), emptyExpeditionLoot());
}

export function cloneExpeditionChests(chests, memberId) {
  const now = Date.now();
  return (chests || []).map((chest, index) => ({
    ...chest,
    id: `exp_${memberId}_${now}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    ts: now + index,
  }));
}

export function summarizeExpeditionChests(chests) {
  const summary = new Map();
  for (const chest of chests || []) {
    const config = chest.kind === "coin"
      ? COIN_CHEST_TIERS[chest.coinTier] || COIN_CHEST_TIERS.common
      : CHEST_TYPES[chest.type] || CHEST_TYPES.wood;
    const key = `${chest.kind}:${chest.type}:${chest.coinTier || ""}:${chest.family || ""}`;
    const current = summary.get(key);
    if (current) {
      current.count += 1;
    } else {
      summary.set(key, {
        key,
        count: 1,
        icon: config.icon,
        name: config.name,
        family: chest.kind === "material" ? chest.family : null,
      });
    }
  }
  return [...summary.values()];
}

export function getExpeditionRewardPreview(boss) {
  if (!boss) return null;
  const materialType = MATERIAL_CHEST_BY_TIER[boss.tier] || "wood";
  const materialChest = CHEST_TYPES[materialType] || CHEST_TYPES.wood;
  const coinChest = COIN_CHEST_TIERS[boss.tier] || COIN_CHEST_TIERS.common;
  return {
    multiplier: EXPEDITION_DROP_MULTIPLIER,
    materialChest: { ...materialChest, family: boss.family },
    coinChest,
  };
}

export function collectBattleStats(log) {
  const stats = {};
  for (const round of log || []) {
    for (const player of round.playerLog || []) {
      const current = stats[player.id] || {
        id: player.id,
        name: player.name || "射手",
        dmgDealt: 0,
        dmgTaken: 0,
        crits: 0,
        rounds: 0,
      };
      current.dmgDealt += player.dmg || 0;
      current.dmgTaken += player.ctr || 0;
      current.crits += player.crits || 0;
      current.rounds += 1;
      stats[player.id] = current;
    }
  }
  return stats;
}

export function mergeExpeditionStats(base = {}, addition = {}) {
  const merged = { ...base };
  for (const [id, stat] of Object.entries(addition || {})) {
    const current = merged[id] || {
      id,
      name: stat.name || "射手",
      dmgDealt: 0,
      dmgTaken: 0,
      crits: 0,
      rounds: 0,
    };
    merged[id] = {
      ...current,
      name: stat.name || current.name,
      dmgDealt: current.dmgDealt + (stat.dmgDealt || 0),
      dmgTaken: current.dmgTaken + (stat.dmgTaken || 0),
      crits: current.crits + (stat.crits || 0),
      rounds: current.rounds + (stat.rounds || 0),
    };
  }
  return merged;
}

export function buildExpeditionParty(members = {}, hostId, stats = {}) {
  const rows = Object.entries(members)
    .filter(([, member]) => member != null)
    .map(([id, member]) => ({
      id,
      name: member.name || stats[id]?.name || "射手",
      alive: member.alive !== false,
      dmgDealt: stats[id]?.dmgDealt || 0,
      dmgTaken: stats[id]?.dmgTaken || 0,
      crits: stats[id]?.crits || 0,
    }));
  const mvp = [...rows].sort((a, b) => b.dmgDealt - a.dmgDealt)[0];
  return {
    leaderId: hostId,
    members: rows.map(member => ({
      ...member,
      isMvp: Boolean(mvp?.dmgDealt > 0 && member.id === mvp.id),
    })),
  };
}
