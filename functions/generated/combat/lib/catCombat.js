"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calcCatCombatStats = calcCatCombatStats;
var _catData = require("./catData");
var _catLevel = require("./catLevel");
function calcCatCombatStats(catData = {}, catIdOverride = null) {
  const catId = catIdOverride || catData.catId || "";
  const type = _catData.CAT_TYPE_MAP[catId] || catData.type || "allround";
  const catLevel = (0, _catLevel.catLevelFromXP)(catData.catXP || 0);
  const level = (0, _catLevel.catLevelBonus)(catLevel);
  const equip = (0, _catData.calcCatEquipBonus)(catData.equip || {});
  const bondLv = (0, _catData.getBondLevel)(catData.bond || 0);
  const base = _catData.CAT_COMBAT_BASE[type] || _catData.CAT_COMBAT_BASE.allround;
  const build = _catData.CAT_BUILD_PROFILES[catId] || {
    allocation: {
      hp: 1,
      atk: 1,
      def: 1
    },
    title: "標準配點",
    trait: "無額外個體修正"
  };
  const bondMult = 1 + Math.min(50, bondLv) / 50 * 0.5;
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
    catDEF: Math.round(rawDEF * (type === "defense" || type === "allround" ? bondMult : 1) * build.allocation.def)
  };
}
