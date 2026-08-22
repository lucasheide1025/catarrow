"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WB_CARD_KEYS = exports.WB_CARDS = void 0;
exports.buildWorldBossCardSnapshot = buildWorldBossCardSnapshot;
exports.describeWorldBossEffect = describeWorldBossEffect;
exports.resolveWorldBossCardEffects = resolveWorldBossCardEffects;
var _worldBossData = require("./worldBossData");
// src/lib/worldBossCards.js
// 世界王專屬卡片定義：24 張，一隻王對應一張，只從世界秘寶箱/族寶箱開出

const FAMILY_CARD_META = {
  coach: {
    typeLabel: "傳說教練",
    rarity: "LEGEND",
    frame: "#facc15"
  },
  cat: {
    typeLabel: "貓貓王",
    rarity: "FAMILIAR",
    frame: "#f97316"
  },
  ghost: {
    typeLabel: "幽靈族王",
    rarity: "SPECTER",
    frame: "#818cf8"
  },
  forest: {
    typeLabel: "山林族王",
    rarity: "GUARDIAN",
    frame: "#86efac"
  },
  poison: {
    typeLabel: "毒蟲族王",
    rarity: "VENOM",
    frame: "#fcd34d"
  },
  office: {
    typeLabel: "職場族王",
    rarity: "TYRANT",
    frame: "#fca5a5"
  },
  exam: {
    typeLabel: "考試族王",
    rarity: "ORACLE",
    frame: "#c4b5fd"
  },
  western: {
    typeLabel: "神殿族王",
    rarity: "ANCIENT",
    frame: "#4ade80"
  },
  treasure: {
    typeLabel: "寶箱族王",
    rarity: "ANCIENT",
    frame: "#fbbf24"
  }
};
const V2_EFFECTS = {
  head_coach: [{
    kind: "damage_pct",
    pct: .12
  }, {
    kind: "armor_pierce_pct",
    pct: .15
  }],
  wife: [{
    kind: "damage_pct",
    pct: .10
  }, {
    kind: "damage_reduce_pct",
    pct: .10
  }],
  yumi: [{
    kind: "damage_pct",
    pct: .10
  }, {
    kind: "burn",
    atkPct: .20,
    duration: 3
  }],
  cat_daming: [{
    kind: "heal_pct",
    pct: .12
  }],
  cat_gege: [{
    kind: "damage_pct",
    pct: .06
  }, {
    kind: "heal_pct",
    pct: .06
  }],
  cat_meimei: [{
    kind: "damage_pct",
    pct: .08
  }, {
    kind: "heal_pct",
    pct: .03
  }],
  cat_niuniu: [{
    kind: "boss_damage_pct",
    pct: .10
  }],
  cat_haji: [{
    kind: "damage_pct",
    pct: .10
  }],
  cat_baobao: [{
    kind: "damage_pct",
    pct: .07
  }, {
    kind: "damage_reduce_pct",
    pct: .04
  }],
  cat_youyou: [{
    kind: "damage_reduce_pct",
    pct: .10
  }],
  cat_xiaoan: [{
    kind: "damage_pct",
    pct: .05
  }, {
    kind: "damage_reduce_pct",
    pct: .07
  }],
  cat_diandian: [{
    kind: "damage_reduce_pct",
    pct: .06
  }, {
    kind: "heal_pct",
    pct: .06
  }]
};
for (const family of ["ghost", "forest", "poison", "office", "exam", "western", "treasure"]) {
  V2_EFFECTS[`${family}_boss_small`] = [{
    kind: "family_damage_pct",
    family: _worldBossData.WB_FAMILY_TO_DUNGEON_FAMILY[family],
    pct: .12
  }];
  V2_EFFECTS[`${family}_boss`] = [{
    kind: "family_damage_pct",
    family: _worldBossData.WB_FAMILY_TO_DUNGEON_FAMILY[family],
    pct: .08
  }, {
    kind: "family_reduce_pct",
    family: _worldBossData.WB_FAMILY_TO_DUNGEON_FAMILY[family],
    pct: .08
  }];
}
const pct = value => `${Math.round(Math.abs(value) * 100)}%`;
const FAMILY_LABEL = {
  ghost: "鬼怪",
  mountain: "山林",
  insect: "昆蟲",
  workplace: "職場",
  exam: "考試",
  temple: "神殿"
};
function describeWorldBossEffect(effect) {
  if (!effect) return "";
  if (effect.kind === "damage_pct") return `造成傷害 ${effect.pct < 0 ? "-" : "+"}${pct(effect.pct)}`;
  if (effect.kind === "damage_reduce_pct") return `受到傷害 ${effect.pct < 0 ? "+" : "-"}${pct(effect.pct)}`;
  if (effect.kind === "heal_pct") return `治療效果 +${pct(effect.pct)}`;
  if (effect.kind === "armor_pierce_pct") return `無視敵人 ${pct(effect.pct)} 防禦`;
  if (effect.kind === "burn") return `命中附加灼燒 ${effect.duration} 回合（每回合 ATK ${pct(effect.atkPct)}）`;
  if (effect.kind === "boss_damage_pct") return `對首領傷害 +${pct(effect.pct)}`;
  if (effect.kind === "family_damage_pct") return `對${FAMILY_LABEL[effect.family] || effect.family}族傷害 +${pct(effect.pct)}`;
  if (effect.kind === "family_reduce_pct") return `受到${FAMILY_LABEL[effect.family] || effect.family}族傷害 -${pct(effect.pct)}`;
  return "";
}
function resolveWorldBossCardEffects({
  equippedCardKeys = [],
  enemyFamily = null,
  enemyClass = null
} = {}) {
  const modifiers = {
    damagePct: 0,
    damageReducePct: 0,
    healPct: 0,
    armorPiercePct: 0,
    burn: null
  };
  let generalDamagePct = 0;
  let scopedDamagePct = 0;
  const activeEffects = [],
    inactiveEffects = [];
  [...new Set(equippedCardKeys)].forEach(key => {
    (V2_EFFECTS[key] || []).forEach(effect => {
      const active = effect.kind === "family_damage_pct" || effect.kind === "family_reduce_pct" ? effect.family === enemyFamily : effect.kind === "boss_damage_pct" ? enemyClass === "boss" : true;
      (active ? activeEffects : inactiveEffects).push({
        key,
        ...effect
      });
      if (!active) return;
      if (effect.kind === "damage_pct") generalDamagePct += effect.pct;else if (effect.kind === "family_damage_pct" || effect.kind === "boss_damage_pct") scopedDamagePct += effect.pct;else if (effect.kind === "damage_reduce_pct" || effect.kind === "family_reduce_pct") modifiers.damageReducePct += effect.pct;else if (effect.kind === "heal_pct") modifiers.healPct += effect.pct;else if (effect.kind === "armor_pierce_pct") modifiers.armorPiercePct += effect.pct * 100;else if (effect.kind === "burn") modifiers.burn = {
        chancePct: 100,
        strengthPct: effect.atkPct * 100,
        duration: effect.duration
      };
    });
  });
  modifiers.damagePct = Math.min(.25, generalDamagePct) + Math.min(.20, scopedDamagePct);
  modifiers.damageReducePct = Math.min(.20, Math.max(0, modifiers.damageReducePct));
  modifiers.healPct = Math.min(.30, Math.max(0, modifiers.healPct));
  return {
    modifiers,
    activeEffects,
    inactiveEffects
  };
}
function getArtPath(bossKey, boss) {
  if (boss?.family === "cat" && boss.catId) return `/cats/${boss.catId}.webp`;
  return `/worldboss/${boss?.pixelKey || bossKey}.webp`;
}
function makeCardMeta(bossKey, boss) {
  const familyMeta = FAMILY_CARD_META[boss.family] || FAMILY_CARD_META.coach;
  return {
    artPath: getArtPath(bossKey, boss),
    serial: `WB-${String(Object.keys(_worldBossData.WORLD_BOSSES).indexOf(bossKey) + 1).padStart(3, "0")}`,
    typeLabel: familyMeta.typeLabel,
    rarity: familyMeta.rarity,
    frameColor: boss.accent || familyMeta.frame,
    bgColor: boss.bg || "#1c1917",
    statLine: "專屬被動",
    effectText: "",
    roleLabel: "戰術型",
    lore: boss.desc,
    hp: boss.hp || 0,
    atk: boss.atk || 0,
    def: boss.def || 0
  };
}

// v2 全部是固定專屬被動；statMode 保留為 UI 相容欄位，但不再接受屬性選擇。
function buildWbCard(bossKey) {
  const boss = _worldBossData.WORLD_BOSSES[bossKey];
  if (!boss) return null;
  return {
    bossKey,
    name: boss.name,
    icon: boss.family === "coach" ? "👑" : boss.family === "cat" ? "🐱" : "🗡️",
    title: boss.title,
    flavor: boss.desc,
    family: boss.family,
    statMode: "passive",
    stat: null,
    ...makeCardMeta(bossKey, boss),
    version: 2,
    effects: V2_EFFECTS[bossKey] || []
  };
}
const WB_CARDS = exports.WB_CARDS = Object.keys(_worldBossData.WORLD_BOSSES).reduce((acc, key) => {
  if (!V2_EFFECTS[key]) return acc;
  const card = buildWbCard(key);
  if (card) acc[key] = {
    ...card,
    effectText: (card.effects || []).map(describeWorldBossEffect).join("｜")
  };
  return acc;
}, {});
const WB_CARD_KEYS = exports.WB_CARD_KEYS = Object.keys(WB_CARDS);
function buildWorldBossCardSnapshot(collection = {}) {
  return {
    effectVersion: 2,
    equippedCardKeys: (collection.equipped || []).filter(entry => entry && typeof entry !== "string" && entry.source === "wb" && WB_CARDS[entry.key]).map(entry => entry.key)
  };
}
