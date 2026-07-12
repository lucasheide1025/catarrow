import { POTION_CATALOG_VERSION, getPotion } from "./itemData";

export const LEGACY_POTION_MAP = {
  hp_5: "carry_heal_basic",
  hp_10: "carry_heal_basic",
  hp_15: "carry_heal_advanced",
  atk_5: "carry_power_basic",
  atk_10: "carry_power_basic",
  atk_15: "carry_power_advanced",
  def_5: "carry_guard_basic",
  def_10: "carry_guard_basic",
  def_15: "carry_guard_advanced",
  throw_fixed: "throw_knife",
  throw_knife: "throw_knife",
  throw_random: "throw_bomb",
  throw_pct: "throw_corrosion",
  throw_atkdown: "throw_weaken",
  throw_defdown: "throw_armor_break",
  throw_paralyze: "throw_paralyze",
};

export function migratePotionInventory(data = {}) {
  if ((data.catalogVersion || 0) >= POTION_CATALOG_VERSION) {
    return { ...data, items: { ...(data.items || {}) }, migrated: false };
  }
  const items = {};
  for (const [id, rawCount] of Object.entries(data.items || {})) {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (!count) continue;
    const nextId = LEGACY_POTION_MAP[id] || id;
    items[nextId] = (items[nextId] || 0) + count;
  }
  return { ...data, items, catalogVersion: POTION_CATALOG_VERSION, migrated: true };
}

export function isConsumableAvailable(item, mode, features = {}) {
  if (!item) return { ok: false, reason: "找不到這個消耗品" };
  if (!item.battleModes?.includes(mode)) return { ok: false, reason: "此戰鬥模式不能使用" };
  if (item.futureFeature && !features[item.futureFeature]) {
    return { ok: false, reason: "此效果將於後續戰鬥系統開放" };
  }
  return { ok: true };
}

export function getConsumablesForMode(items, mode, features = {}) {
  return (items || []).filter(item => isConsumableAvailable(item, mode, features).ok);
}

export function resolveConsumable(itemOrId, context = {}) {
  const item = typeof itemOrId === "string" ? getPotion(itemOrId) : itemOrId;
  const allowed = isConsumableAvailable(item, context.mode || "monster", context.features || {});
  if (!allowed.ok) return allowed;
  if (item.requiresBot && !(context.botCount > 0)) return { ok: false, reason: "需要先雇用助手" };

  const effect = { ...(item.effect || {}) };
  let damage = 0;
  if (effect.atkDamagePct) damage += Math.round((context.playerAtk || 0) * effect.atkDamagePct / 100);
  if (effect.dotAtkPct) damage += Math.round((context.playerAtk || 0) * effect.dotAtkPct / 100);
  if (effect.throwDmg) damage += effect.throwDmg;
  if (effect.throwPct) {
    let percentDamage = Math.ceil((context.enemyMaxHp || context.enemyHp || 0) * effect.throwPct);
    if (context.isBoss && effect.bossAtkCapPct) {
      percentDamage = Math.min(percentDamage, Math.round((context.playerAtk || 0) * effect.bossAtkCapPct / 100));
    }
    damage += percentDamage;
  }
  if (effect.executeHpPct && context.enemyMaxHp > 0 && context.enemyHp / context.enemyMaxHp <= effect.executeHpPct / 100) {
    damage = Math.round((context.playerAtk || 0) * effect.executeAtkPct / 100);
  }
  return { ok: true, item, effect, damage, consumesArrow: item.actionCost === "arrow" };
}

export function mergeCarryBuff(activeBuffs = {}, item) {
  if (!item || item.category !== "carry" || item.family === "heal") return { ...activeBuffs };
  const current = activeBuffs[item.family];
  if (current && (current.level || 0) > (item.level || 0)) return { ...activeBuffs };
  return { ...activeBuffs, [item.family]: { id: item.id, level: item.level, effect: { ...item.effect } } };
}

export function calculateMaxCrafts(item, resources = {}, coins = 0) {
  if (!item?.recipe?.length) return 0;
  const materialMax = item.recipe.reduce((max, entry) => {
    const possible = Math.floor((resources[entry.id] || 0) / entry.count);
    return Math.min(max, possible);
  }, Number.MAX_SAFE_INTEGER);
  const coinMax = item.gold > 0 ? Math.floor((coins || 0) / item.gold) : Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.min(materialMax, coinMax));
}
