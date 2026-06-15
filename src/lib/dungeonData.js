// src/lib/dungeonData.js — 地下城模式資料表與工具函式

// ── 任務類型（Contract）────────────────────────────────────────
export const CONTRACT_TYPES = {
  standard:     { id:"standard",     name:"標準關",    icon:"⚔️",  desc:"六箭正常計算傷害",                    color:"text-slate-300",  bg:"bg-slate-700/50"  },
  score_gate:   { id:"score_gate",   name:"得分關",    icon:"🎯",  desc:"需達 {param} 分以上才計傷害",         color:"text-blue-300",   bg:"bg-blue-900/40"   },
  hit_count:    { id:"hit_count",    name:"命中關",    icon:"🏹",  desc:"命中即固定傷害，分數無關",            color:"text-green-300",  bg:"bg-green-900/40"  },
  all_hit:      { id:"all_hit",      name:"全中關",    icon:"💯",  desc:"六箭全中才能造成傷害",               color:"text-yellow-300", bg:"bg-yellow-900/40" },
  x_crit:       { id:"x_crit",       name:"X爆擊關",  icon:"✨",  desc:"只有X算爆擊，其他傷害減半",          color:"text-purple-300", bg:"bg-purple-900/40" },
  target_score: { id:"target_score", name:"指定分數關", icon:"🎪", desc:"命中 {param} 分 → 兩倍傷害",         color:"text-rose-300",   bg:"bg-rose-900/40"   },
};
const CONTRACT_IDS = Object.keys(CONTRACT_TYPES);

// ── 商店物品 ──────────────────────────────────────────────────
export const DUNGEON_SHOP_ITEMS = [
  { id:"hp_potion",      name:"回復藥",      icon:"🧪", desc:"立即回復 30% 最大血量",        cost:50,  effect:"hp_restore",     value:0.3  },
  { id:"atk_boost",      name:"ATK 提升符",  icon:"⚔️", desc:"本次地下城 ATK ×1.2",         cost:80,  effect:"atk_mult",       value:1.2  },
  { id:"def_boost",      name:"DEF 提升符",  icon:"🛡️", desc:"本次地下城 DEF ×1.2",         cost:80,  effect:"def_mult",       value:1.2  },
  { id:"contract_reset", name:"契約重置",    icon:"🎲", desc:"重抽自己的任務類型",            cost:60,  effect:"contract_reset"            },
  { id:"revival",        name:"復活符",      icon:"💫", desc:"下次陣亡自動復活（30% HP）",   cost:100, effect:"revival"                   },
];

// ── 隨機事件 ─────────────────────────────────────────────────
export const DUNGEON_EVENTS = [
  { id:"healing_rain",  icon:"🌧️", title:"天降甘霖",   desc:"神秘力量降臨，全隊回復 25% 最大血量",          type:"buff",    effect:{ type:"hp_restore_all",    value:0.25 } },
  { id:"cursed_fog",    icon:"🌫️", title:"詛咒之霧",   desc:"毒霧瀰漫，本層全隊 ATK ×0.8",                  type:"debuff",  effect:{ type:"atk_debuff_all",    value:0.8  } },
  { id:"lucky_charm",   icon:"🍀", title:"幸運符文",   desc:"獲得祝福，本層金幣掉落 ×2",                    type:"buff",    effect:{ type:"gold_mult",         value:2    } },
  { id:"monster_fear",  icon:"😱", title:"怪物受驚",   desc:"下一層怪物 HP ×0.7",                           type:"buff",    effect:{ type:"monster_hp_mult",   value:0.7  } },
  { id:"team_boost",    icon:"💪", title:"隊友激勵",   desc:"隨機一名隊友本層 ATK ×1.5",                    type:"buff",    effect:{ type:"atk_buff_one",      value:1.5  } },
  { id:"contract_swap", icon:"🔀", title:"契約轉換",   desc:"全隊任務類型重新隨機分配",                     type:"neutral", effect:{ type:"contract_reassign"             } },
  { id:"treasure",      icon:"📦", title:"隱藏寶箱",   desc:"發現寶箱！每人各獲得 40 金幣",                 type:"buff",    effect:{ type:"gold_bonus",        value:40   } },
  { id:"reinforcement", icon:"👹", title:"敵軍增援",   desc:"怪物召來援軍，本層怪物 ATK ×1.3",             type:"debuff",  effect:{ type:"monster_atk_mult",  value:1.3  } },
  { id:"cursed_arrows", icon:"🏹", title:"詛咒之箭",   desc:"箭矢受詛，本層全隊傷害 ×0.75",                type:"debuff",  effect:{ type:"dmg_mult_all",      value:0.75 } },
  { id:"scroll",        icon:"📜", title:"古老卷軸",   desc:"隨機一名成員任務類型改為「標準關」",           type:"neutral", effect:{ type:"contract_standard_one"         } },
];

// ── 地下城長度 ────────────────────────────────────────────────
export const DUNGEON_LENGTHS = {
  short:    { label:"短途（5層）",  icon:"⚡", totalFloors:5  },
  standard: { label:"標準（7層）",  icon:"⚔️", totalFloors:7  },
  long:     { label:"長征（10層）", icon:"🏆", totalFloors:10 },
};

// ── 路線類型 ─────────────────────────────────────────────────
export const PATH_TYPES = {
  shop_normal:  { label:"商店補給",  icon:"🛒", preContent:"shop",  eliteBoost:1.0, desc:"先逛商店再繼續"   },
  event_normal: { label:"神秘岔路",  icon:"❓", preContent:"event", eliteBoost:1.0, desc:"遭遇隨機事件"     },
  direct:       { label:"直衝前進",  icon:"⚔️", preContent:null,   eliteBoost:1.0, desc:"直接挑戰下一層"   },
  elite:        { label:"精英挑戰",  icon:"💀", preContent:null,   eliteBoost:1.5, desc:"精英怪，獎勵更豐" },
};

// ── 抽取路線選項（A ≠ B）────────────────────────────────────
export function generatePathOptions() {
  const keys = Object.keys(PATH_TYPES);
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  return {
    A: { ...PATH_TYPES[shuffled[0]], id:shuffled[0] },
    B: { ...PATH_TYPES[shuffled[1]], id:shuffled[1] },
  };
}

// ── 抽取隨機事件 ─────────────────────────────────────────────
export function drawDungeonEvent() {
  return DUNGEON_EVENTS[Math.floor(Math.random() * DUNGEON_EVENTS.length)];
}

// ── 隨機分配任務（地下城開始時一次，之後持續到購買重置為止）──
export function assignContracts(memberIds) {
  const result = {};
  for (const id of memberIds) {
    const type  = CONTRACT_IDS[Math.floor(Math.random() * CONTRACT_IDS.length)];
    let   param = null;
    if (type === "score_gate")   param = 6 + Math.floor(Math.random() * 3); // 6, 7, 8
    if (type === "target_score") param = 6 + Math.floor(Math.random() * 5); // 6~10
    result[id] = { type, param };
  }
  return result;
}

// ── 重抽單人任務 ─────────────────────────────────────────────
export function rerollContract() {
  const type  = CONTRACT_IDS[Math.floor(Math.random() * CONTRACT_IDS.length)];
  let   param = null;
  if (type === "score_gate")   param = 6 + Math.floor(Math.random() * 3);
  if (type === "target_score") param = 6 + Math.floor(Math.random() * 5);
  return { type, param };
}

// ── 取得任務顯示文字（帶入 param）────────────────────────────
export function getContractDesc(contract) {
  if (!contract) return CONTRACT_TYPES.standard.desc;
  const info = CONTRACT_TYPES[contract.type];
  if (!info) return "";
  return info.desc.replace("{param}", contract.param ?? "");
}

// ── 地下城傷害計算（帶任務類型）─────────────────────────────
// resolveHitPartFn: from monsterData.js
// contract: { type, param }
// dmgMult: 來自 buff/事件加乘（預設 1）
export function calcDungeonContractDmg(arrows, atk, monsterDef, contract, resolveHitPartFn, dmgMult = 1) {
  const type  = contract?.type  || "standard";
  const param = contract?.param ?? null;

  // 全中關：預先檢查 — 有 M 則全部歸零
  if (type === "all_hit" && arrows.some(a => (a.score ?? 0) === 0)) {
    return {
      dmg: 0, crits: 0,
      arrowBreakdown: arrows.map(a => ({
        label: a.label || "M", partIcon:"🛡️", partName:"全部格擋", dmg:0, isCrit:false,
      })),
    };
  }

  let totalDmg = 0, crits = 0;
  const arrowBreakdown = [];
  const unlocked = new Set();

  for (const arrow of arrows) {
    const score = arrow.score ?? 0;
    const part  = resolveHitPartFn(score, unlocked, arrow.label === "X");

    if (!part) {
      arrowBreakdown.push({ label: arrow.label || "M", partIcon:"💨", partName:"脫靶", dmg:0, isCrit:false });
      continue;
    }
    if (part.id === "chest") unlocked.add("chest");
    if (part.id === "belly") unlocked.add("belly");
    if (part.id === "groin") unlocked.add("groin");

    const pMult = part.mult;

    // 脫靶或格擋部位
    if (!score || pMult === 0) {
      arrowBreakdown.push({ label: arrow.label || "M", partIcon:"💨", partName:"脫靶", dmg:0, isCrit:false });
      continue;
    }

    // 得分關：低於門檻 → 無傷害
    if (type === "score_gate" && score < (param ?? 7)) {
      arrowBreakdown.push({ label: arrow.label, partIcon:"🚫", partName:"未達門檻", dmg:0, isCrit:false });
      continue;
    }

    let d, isCrit;
    if (type === "hit_count") {
      // 命中關：分數不計入，使用固定 base
      const base = 8 + (atk || 10) * 0.7 - (monsterDef || 0) * 0.35;
      const m    = 0.85 + Math.random() * 0.3;
      isCrit = m > 1.05;
      d = Math.max(1, Math.round(base * pMult * m));
    } else {
      const base = 8 + (atk || 10) * 0.7 + score * 1.2 - (monsterDef || 0) * 0.35;
      const m    = 0.85 + Math.random() * 0.3;
      isCrit = m > 1.05 || pMult >= 1.8;
      d = Math.max(1, Math.round(base * pMult * m));
    }

    // X 爆擊關：非 X 傷害減半
    if (type === "x_crit" && arrow.label !== "X") {
      d = Math.round(d * 0.5);
      isCrit = false;
    }

    // 指定分數關：命中指定分數 × 2
    if (type === "target_score" && score === (param ?? 8)) {
      d = d * 2;
      isCrit = true;
    }

    // 套用 buff / 事件 dmgMult
    d = Math.round(d * dmgMult);

    totalDmg += d;
    if (isCrit) crits++;
    arrowBreakdown.push({
      label: arrow.label, partIcon: part.icon,
      partName: part.name, partMult: pMult, dmg: d, isCrit,
    });
  }

  return { dmg: totalDmg, crits, arrowBreakdown };
}
