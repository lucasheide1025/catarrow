import {
  CAT_BUILD_PROFILES,
  CAT_COMBAT_BASE,
  CAT_TYPE_MAP,
  calcCatEquipBonus,
  getBondLevel,
} from "./catData";
import { catLevelBonus, catLevelFromXP } from "./catLevel";

export function calcCatCombatStats(catData = {}, catIdOverride = null) {
  const catId = catIdOverride || catData.catId || "";
  const type = CAT_TYPE_MAP[catId] || catData.type || "allround";
  const catLevel = catLevelFromXP(catData.catXP || 0);
  const level = catLevelBonus(catLevel);
  const equip = calcCatEquipBonus(catData.equip || {});
  const bondLv = getBondLevel(catData.bond || 0);
  const base = CAT_COMBAT_BASE[type] || CAT_COMBAT_BASE.allround;
  const build = CAT_BUILD_PROFILES[catId] || {
    allocation: { hp: 1, atk: 1, def: 1 },
    title: "標準配點",
    trait: "無額外個體修正",
  };
  const bondMult = type === "allround" ? 1 + bondLv * 0.03 : 1 + bondLv * 0.05;
  const rawHP = base.hp + level.hp + equip.hpBonus;
  const rawATK = base.atk + bondLv + level.atk + equip.atkBonus;
  const rawDEF = base.def + level.def + equip.defBonus;
  return {
    catId,
    type,
    catLevel,
    bondLv,
    profile: build,
    catHP: Math.round(rawHP * (type === "defense" || type === "allround" ? bondMult : 1) * build.allocation.hp),
    catATK: Math.round(rawATK * (type === "attack" || type === "allround" ? bondMult : 1) * build.allocation.atk),
    catDEF: Math.round(rawDEF * (type === "defense" || type === "allround" ? bondMult : 1) * build.allocation.def),
  };
}
