"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CAT_BATTLE_MODE_POLICIES = exports.CAT_BATTLE_ARCHETYPES = void 0;
exports.getCatBattleArchetype = getCatBattleArchetype;
exports.getCatBondScaling = getCatBondScaling;
exports.getCatStrongSkillChance = getCatStrongSkillChance;
const trait = (name, summary) => Object.freeze({
  name,
  summary
});
const CAT_BATTLE_ARCHETYPES = exports.CAT_BATTLE_ARCHETYPES = Object.freeze({
  daming: Object.freeze({
    type: "heal",
    title: "腐蝕療癒師",
    frequency: "balanced",
    passive: trait("腐蝕照護", "每回合治療主人並施加腐蝕；溢出治療轉為護盾。"),
    strongSkill: trait("暖心守護", "大幅追加治療，並提供較弱的全隊回復。"),
    synergy: trait("應援治療", "應援專精提高治療與溢出護盾。"),
    status: {
      id: "cat_corrosion",
      name: "腐蝕"
    }
  }),
  gege: Object.freeze({
    type: "heal",
    title: "弱化淨化師",
    frequency: "balanced",
    passive: trait("安定療癒", "每回合治療主人並造成弱化侵蝕傷害。"),
    strongSkill: trait("清心療癒", "追加治療、降低怪物攻擊，並為全隊淨化一項異常。"),
    synergy: trait("抗性支援", "適合搭配異常抗性、治療與應援專精。"),
    status: {
      id: "cat_weakness",
      name: "衰弱侵蝕"
    }
  }),
  meimei: Object.freeze({
    type: "heal",
    title: "脈衝引爆師",
    frequency: "high",
    passive: trait("療癒脈衝", "高頻治療並累積脈衝感染。"),
    strongSkill: trait("脈衝引爆", "引爆剩餘感染傷害並追加治療。"),
    synergy: trait("異常連鎖", "適合搭配中毒、燃燒等持續傷害卡片。"),
    status: {
      id: "cat_pulse",
      name: "脈衝感染"
    }
  }),
  niuniu: Object.freeze({
    type: "attack",
    title: "精準獵手",
    frequency: "balanced",
    passive: trait("弱點追擊", "9、10、X 命中越多，貓咪協戰傷害越高。"),
    strongSkill: trait("精準穿透", "依高品質命中追加穿透傷害並施加破防。"),
    synergy: trait("精準穿甲", "適合搭配精準、穿甲與高品質命中加成。")
  }),
  haji: Object.freeze({
    type: "attack",
    title: "連擊獵手",
    frequency: "high",
    passive: trait("連擊步伐", "全部有效命中時累積連擊，逐回合提高協戰傷害。"),
    strongSkill: trait("疾風連爪", "依連擊層數發動多段攻擊並施加小幅破防。"),
    synergy: trait("連擊爆發", "適合搭配爆擊與異常累積卡片。")
  }),
  baobao: Object.freeze({
    type: "attack",
    title: "終結獵手",
    frequency: "burst",
    passive: trait("殘血追獵", "怪物生命越低，協戰傷害越高。"),
    strongSkill: trait("終結重擊", "對低生命怪物造成大型終結傷害。"),
    synergy: trait("獵王終結", "適合搭配終結、獵王與破盾效果。")
  }),
  youyou: Object.freeze({
    type: "defense",
    title: "均衡守護者",
    frequency: "balanced",
    passive: trait("穩定守護", "每回合為主人建立均衡護盾。"),
    strongSkill: trait("同心護盾", "強化個人護盾並提供較弱、不可疊加的全隊護盾。"),
    synergy: trait("護盾應援", "適合搭配護盾、減傷與應援專精。")
  }),
  xiaoan: Object.freeze({
    type: "defense",
    title: "生命堡壘",
    frequency: "high",
    passive: trait("厚實守備", "以高生命建立穩定護盾。"),
    strongSkill: trait("不倒守護", "準備一次致命攔截；每場只能成功一次。"),
    synergy: trait("低血守勢", "適合搭配 HP、守勢與回復效果。")
  }),
  diandian: Object.freeze({
    type: "defense",
    title: "反攻鐵壁",
    frequency: "burst",
    passive: trait("吸收反擊", "護盾實際吸收的傷害會轉為下一回合 ATK。"),
    strongSkill: trait("極限格擋", "建立大型個人護盾，強化下一回合反攻。"),
    synergy: trait("防禦反攻", "適合搭配 DEF、反傷與應援專精。")
  })
});
const CAT_BATTLE_MODE_POLICIES = exports.CAT_BATTLE_MODE_POLICIES = Object.freeze({
  normal: Object.freeze({
    maxHpDamagePct: .025,
    damageCapFromCatAtk: 1,
    shieldPctCap: .2,
    allowDeathGuard: true,
    blockScale: 1
  }),
  boss: Object.freeze({
    maxHpDamagePct: .008,
    damageCapFromCatAtk: .8,
    shieldPctCap: .16,
    allowDeathGuard: true,
    blockScale: .75
  }),
  worldboss: Object.freeze({
    maxHpDamagePct: .001,
    damageCapFromCatAtk: .5,
    shieldPctCap: .1,
    allowDeathGuard: false,
    blockScale: .45
  })
});
function getCatBattleArchetype(catId) {
  return CAT_BATTLE_ARCHETYPES[catId] || CAT_BATTLE_ARCHETYPES.daming;
}
function getCatBondScaling(bondLevel = 0) {
  const level = Math.max(0, Math.min(50, Math.floor(Number(bondLevel) || 0)));
  return {
    level,
    powerMultiplier: 1 + level * .012,
    procBonus: level * .0015,
    pityRound: 4
  };
}
function getCatStrongSkillChance(catId, bondLevel = 0) {
  const cat = getCatBattleArchetype(catId);
  const base = {
    high: .35,
    balanced: .25,
    burst: .18
  }[cat.frequency] || .25;
  return Math.min(.45, base + getCatBondScaling(bondLevel).procBonus);
}
