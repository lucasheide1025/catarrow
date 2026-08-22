"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildMultiMonsterLoadout = buildMultiMonsterLoadout;
Object.defineProperty(exports, "consumeCatDeathGuard", {
  enumerable: true,
  get: function () {
    return _catBattleEngine.consumeCatDeathGuard;
  }
});
Object.defineProperty(exports, "createCatBattleState", {
  enumerable: true,
  get: function () {
    return _catBattleEngine.createCatBattleState;
  }
});
Object.defineProperty(exports, "resolveCatRound", {
  enumerable: true,
  get: function () {
    return _catBattleEngine.resolveCatRound;
  }
});
var _adventurerCombatStats = require("./adventurerCombatStats");
var _catCombat = require("./catCombat");
var _catBattleEngine = require("./catBattleEngine");
const stable = value => JSON.stringify(value, Object.keys(value || {}).sort());
function hash(value) {
  let out = 2166136261;
  for (const char of String(value || "")) out = Math.imul(out ^ char.charCodeAt(0), 16777619);
  return (out >>> 0).toString(16);
}
function buildMultiMonsterLoadout({
  member = {},
  sharedData = {},
  equipSpec = null,
  enemyFamily = null,
  enemyClass = "normal"
} = {}) {
  const stats = (0, _adventurerCombatStats.buildAdventurerCombatStats)({
    member,
    sharedData,
    equipSpec,
    enemyFamily,
    enemyClass
  });
  const catId = member?.equippedCat?.catId || "";
  const authoritativeCat = (sharedData.cats || []).find(cat => cat?.catId === catId) || (catId ? member.equippedCat : null);
  const cat = authoritativeCat ? (0, _catCombat.calcCatCombatStats)(authoritativeCat, catId) : null;
  const snapshot = {
    version: 2,
    memberId: member.id || null,
    baseStats: {
      hp: stats.hp,
      atk: stats.atk,
      def: stats.def
    },
    statSources: stats.statSources,
    cards: stats.cards,
    cat: cat ? {
      ...cat,
      battleState: (0, _catBattleEngine.createCatBattleState)()
    } : null,
    statuses: []
  };
  snapshot.sourceFingerprint = hash(stable({
    member,
    sharedData,
    enemyFamily,
    enemyClass
  }));
  return snapshot;
}
