// src/lib/dungeonData.js — 地下城模式資料表與工具函式

// ── 任務類型（Contract）────────────────────────────────────────
export const CONTRACT_TYPES = {
  standard:     { id:"standard",     name:"標準關",    icon:"⚔️",  desc:"六箭正常計算傷害",                    color:"text-slate-300",  bg:"bg-slate-700/50"  },
  score_gate:   { id:"score_gate",   name:"得分關",    icon:"🎯",  desc:"低於 {param} 分依比例降低傷害，每差1分 -10%",  color:"text-blue-300",   bg:"bg-blue-900/40"   },
  hit_count:    { id:"hit_count",    name:"命中關",    icon:"🏹",  desc:"命中即固定傷害，分數無關",            color:"text-green-300",  bg:"bg-green-900/40"  },
  all_hit:      { id:"all_hit",      name:"M懲罰關",   icon:"⚠️",  desc:"每發脫靶（M）扣除 10% 傷害",         color:"text-yellow-300", bg:"bg-yellow-900/40" },
  x_crit:       { id:"x_crit",       name:"X爆擊關",  icon:"✨",  desc:"只有X算爆擊，其他傷害減半",          color:"text-purple-300", bg:"bg-purple-900/40" },
  target_score: { id:"target_score", name:"超越分數關", icon:"🎪", desc:"6箭總分 > {param} 才有傷害，未達標全部歸零", color:"text-rose-300",   bg:"bg-rose-900/40"   },
  reversal:     { id:"reversal",     name:"逆轉關",    icon:"🔄",  desc:"分數反轉：6↔X, 7↔10, 8↔9 後正常計算", color:"text-orange-300", bg:"bg-orange-900/40" },
  odd_only:     { id:"odd_only",     name:"單數關",    icon:"7️⃣",  desc:"只算 7、9、X，其他分數視同脫靶",        color:"text-cyan-300",   bg:"bg-cyan-900/40"   },
  even_only:    { id:"even_only",    name:"雙數關",    icon:"8️⃣",  desc:"只算 6、8、10，其他分數視同脫靶",       color:"text-pink-300",   bg:"bg-pink-900/40"   },
};
const CONTRACT_IDS = Object.keys(CONTRACT_TYPES);

// ── 商店物品 ──────────────────────────────────────────────────
export const DUNGEON_SHOP_ITEMS = [
  { id:"hp_potion",      name:"回復藥",      icon:"🧪", desc:"立即回復 30% 最大血量",        cost:50,  effect:"hp_restore",     value:0.3  },
  { id:"hp_max_boost",   name:"生命上限符",   icon:"💚", desc:"永久提升 30% 最大血量（僅此局）", cost:100, effect:"hp_max_boost",   value:0.3  },
  { id:"atk_boost",      name:"ATK 提升符",  icon:"⚔️", desc:"本次地下城 ATK ×1.2",         cost:80,  effect:"atk_mult",       value:1.2  },
  { id:"atk_large",      name:"ATK 狂戰符",  icon:"🔥", desc:"本次地下城 ATK ×1.5",          cost:150, effect:"atk_mult",       value:1.5  },
  { id:"def_boost",      name:"DEF 提升符",  icon:"🛡️", desc:"本次地下城 DEF ×1.2",         cost:80,  effect:"def_mult",       value:1.2  },
  { id:"def_large",      name:"DEF 鐵壁符",  icon:"🏰", desc:"本次地下城 DEF ×1.5",          cost:150, effect:"def_mult",       value:1.5  },
  { id:"revival",        name:"復活符",      icon:"💫", desc:"下次陣亡自動復活（30% HP）",   cost:100, effect:"revival"                   },
  { id:"revival_front",  name:"前衛復活藥",  icon:"💊", desc:"復活一名倒地前衛（轉回前衛+50%HP）", cost:120, effect:"revival_front"             },
];

// ── 隨機事件 ─────────────────────────────────────────────────
export const DUNGEON_EVENTS = [
  { id:"healing_rain",  icon:"🌧️", title:"天降甘霖",   desc:"神秘力量降臨，全隊回復 25% 最大血量",          type:"buff",    effect:{ type:"hp_restore_all",    value:0.25 } },
  { id:"cursed_fog",    icon:"🌫️", title:"詛咒之霧",   desc:"毒霧瀰漫，本層全隊 ATK ×0.8",                  type:"debuff",  effect:{ type:"atk_debuff_all",    value:0.8  } },
  { id:"cursed_spray",  icon:"☁️",  title:"詛咒噴霧",   desc:"強烈毒霧侵襲，本層全隊 ATK ×0.7",               type:"debuff",  effect:{ type:"atk_debuff_all",    value:0.7  } },
  { id:"blessed_wind",  icon:"🌬️", title:"祝福之風",   desc:"微風吹拂，本層全隊 ATK ×1.2",                    type:"buff",    effect:{ type:"atk_debuff_all",    value:1.2  } },
  { id:"star_shower",   icon:"⭐",  title:"流星雨",     desc:"流星劃過天際，全隊士氣大振 ATK ×1.2",           type:"buff",    effect:{ type:"atk_debuff_all",    value:1.2  } },
  { id:"lucky_charm",   icon:"🍀", title:"幸運符文",   desc:"獲得祝福，本層金幣掉落 ×2",                    type:"buff",    effect:{ type:"gold_mult",         value:2    } },
  { id:"monster_fear",  icon:"😱", title:"怪物受驚",   desc:"下一層怪物 HP ×0.7",                           type:"buff",    effect:{ type:"monster_hp_mult",   value:0.7  } },
  { id:"team_boost",    icon:"💪", title:"隊友激勵",   desc:"隨機一名隊友本層 ATK ×1.5",                    type:"buff",    effect:{ type:"atk_buff_one",      value:1.5  } },
  { id:"treasure",      icon:"📦", title:"隱藏寶箱",   desc:"發現寶箱！每人各獲得 40 金幣",                 type:"buff",    effect:{ type:"gold_bonus",        value:40   } },
  { id:"reinforcement", icon:"👹", title:"敵軍增援",   desc:"怪物召來援軍，本層怪物 ATK ×1.3",             type:"debuff",  effect:{ type:"monster_atk_mult",  value:1.3  } },
  { id:"cursed_arrows", icon:"🏹", title:"詛咒之箭",   desc:"箭矢受詛，本層全隊傷害 ×0.75",                type:"debuff",  effect:{ type:"dmg_mult_all",      value:0.75 } },
  { id:"fairy_blessing",icon:"🧚",  title:"妖精祝福",   desc:"妖精圍繞，全隊回復 40% 最大血量",               type:"buff",    effect:{ type:"hp_restore_all",    value:0.4  } },
  { id:"dark_ritual",   icon:"🔮", title:"黑暗儀式",   desc:"黑暗力量籠罩，隨機一名隊友本層 ATK ×0.5",      type:"debuff",  effect:{ type:"atk_buff_one",      value:0.5  } },
  { id:"golden_fountain",icon:"⛲", title:"黃金噴泉",   desc:"發現黃金噴泉！每人各獲得 80 金幣",               type:"buff",    effect:{ type:"gold_bonus",        value:80   } },
  { id:"time_warp",     icon:"⏳", title:"時光扭曲",   desc:"時間扭曲，怪物無法反擊（本層怪物不反擊）",       type:"buff",    effect:{ type:"skip_counter",      value:true } },
  { id:"sleepy_dust",   icon:"💤", title:"睡眠花粉",   desc:"吸入睡眠花粉，怪物沉睡一回合（不反擊）",         type:"buff",    effect:{ type:"skip_counter",      value:true } },
  { id:"defense_boost", icon:"🛡️", title:"守護結界",   desc:"結界展開，本層全隊 DEF ×1.5",                    type:"buff",    effect:{ type:"def_mult_all",      value:1.5  } },
  { id:"wish_well",     icon:"🤞", title:"許願井",     desc:"許願成功！隨機一名成員獲得雙倍傷害加成",         type:"buff",    effect:{ type:"atk_buff_one",      value:2.0  } },
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
    if (type === "x_crit")       param = 6 + Math.floor(Math.random() * 5); // 6~10
    if (type === "target_score") param = 20 + Math.floor(Math.random() * 31); // 20~50
    result[id] = { type, param };
  }
  return result;
}

// ── 重抽單人任務 ─────────────────────────────────────────────
export function rerollContract() {
  const type  = CONTRACT_IDS[Math.floor(Math.random() * CONTRACT_IDS.length)];
  let   param = null;
  if (type === "x_crit")       param = 6 + Math.floor(Math.random() * 5);
  if (type === "target_score") param = 20 + Math.floor(Math.random() * 31);
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

  // 超越分數關：先算總分
  if (type === "target_score") {
    const totalScore = arrows.reduce((s, a) => s + (a.label === "X" ? 11 : (a.score || 0)), 0);
    if (totalScore < (param ?? 20)) {
      return {
        dmg: 0, crits: 0,
        arrowBreakdown: arrows.map(a => ({
          label: a.label || "M", partIcon:"🚫", partName:"未達門檻", dmg:0, isCrit:false,
        })),
      };
    }
  }

  let totalDmg = 0, crits = 0;
  const arrowBreakdown = [];
  const unlocked = new Set();

  for (const arrow of arrows) {
    const score = arrow.score ?? 0;
    const isXHit = arrow.label === "X" || (type === "hit_count" && score > 0);
    const part  = resolveHitPartFn(score, unlocked, isXHit);

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

    // 單數關：只算 7/9/X
    if (type === "odd_only" && ![7,9].includes(score) && arrow.label !== "X") {
      arrowBreakdown.push({ label: arrow.label, partIcon:"🚫", partName:"非單數", dmg:0, isCrit:false });
      continue;
    }

    // 雙數關：只算 6/8/10
    if (type === "even_only" && ![6,8,10].includes(score)) {
      arrowBreakdown.push({ label: arrow.label, partIcon:"🚫", partName:"非雙數", dmg:0, isCrit:false });
      continue;
    }

    // 逆轉關：分數映射（6↔X, 7↔10, 8↔9）
    // ⚠️ 注意：先用翻轉後分數重新判定部位，避免原始分數導致高脫靶率
    if (type === "reversal") {
      const revMap = { 6:11, 7:10, 8:9, 9:8, 10:7 };
      const revScore = arrow.label === "X" ? 6 : (revMap[score] ?? score);
      const revIsXHit = revScore >= 11; // X 分數是 11
      const revPart  = resolveHitPartFn(revScore, unlocked, revIsXHit);
      if (!revPart) {
        arrowBreakdown.push({ label: arrow.label || "M", partIcon:"💨", partName:"脫靶", dmg:0, isCrit:false });
        continue;
      }
      if (revPart.id === "chest") unlocked.add("chest");
      if (revPart.id === "belly") unlocked.add("belly");
      if (revPart.id === "groin") unlocked.add("groin");
      if (!revScore || revPart.mult === 0) {
        arrowBreakdown.push({ label: arrow.label, partIcon:"💨", partName:"脫靶", dmg:0, isCrit:false });
        continue;
      }
      const base = 8 + (atk || 10) * 0.7 + revScore * 1.2 - (monsterDef || 0) * 0.35;
      const m    = 0.85 + Math.random() * 0.3;
      const isCrit = m > 1.05 || revPart.mult >= 1.8;
      let d = Math.max(1, Math.round(base * revPart.mult * m));
      d = Math.round(d * dmgMult);
      totalDmg += d;
      if (isCrit) crits++;
      arrowBreakdown.push({
        label: arrow.label, partIcon: revPart.icon,
        partName: revPart.name, partMult: revPart.mult, dmg: d, isCrit,
        note: "逆轉",
      });
      continue;
    }

    let d, isCrit;
    if (type === "hit_count") {
      // 命中關：命中必定爆擊，瞄準頭/頸部位
      const base = 8 + (atk || 10) * 0.7 - (monsterDef || 0) * 0.35;
      const m    = 0.85 + Math.random() * 0.3;
      isCrit = true;
      d = Math.max(1, Math.round(base * pMult * m));
    } else {
      const base = 8 + (atk || 10) * 0.7 + score * 1.2 - (monsterDef || 0) * 0.35;
      const m    = 0.85 + Math.random() * 0.3;
      isCrit = m > 1.05 || pMult >= 1.8;
      d = Math.max(1, Math.round(base * pMult * m));
    }

    // 指定分數爆擊關
    if (type === "x_crit") {
      if (score === param) {
        d = d * 2;
        isCrit = true;
      } else {
        d = Math.round(d * 0.5);
        isCrit = false;
      }
    }

    // 得分關：依比例降低傷害（X/10視同9分，threshold 上限9）
    if (type === "score_gate") {
      const _thresh = Math.min(param ?? 9, 9);
      const _eff = Math.min(score, 9);
      if (_eff < _thresh) {
        d = Math.round(d * Math.max(0, 1 - (_thresh - _eff) * 0.1));
      }
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

  // M懲罰關：每個脫靶 -10% 總傷害（最多 -100%）
  if (type === "all_hit") {
    const mCount = arrows.filter(a => (a.score ?? 0) === 0).length;
    totalDmg = Math.round(totalDmg * Math.max(0, 1 - mCount * 0.1));
  }

  return { dmg: totalDmg, crits, arrowBreakdown };
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  平衡性常數  ▼▼▼
// ══════════════════════════════════════════════════════════════

// ── 每樓層怪物強度遞增曲線（floorIndex → 額外 tier offset）──
// 讓深層樓層的怪物基礎數值更高，避免前期後期感受一致
// floor 0=首層無加成, floor 4=第5層開始 +1 tier, floor 6=第7層 +2 tier
export const FLOOR_TIER_OFFSET = [0, 0, 0, 0, 0, 1, 1, 2, 2, 3];

// ── 每層對怪物數值的額外乘數（在 hostScale / 人數縮放之外）──
// 讓怪物 HP/ATK/DEF 隨樓層深度逐步上升
// floor 0 是起始層（正常 1.0），最後一層 Boss 層達約 2.0x
export const FLOOR_STAT_SCALE = [1.0, 1.0, 1.05, 1.1, 1.2, 1.3, 1.5, 1.7, 2.0, 2.2];

// ── 每層獎勵倍率（遞增）────────────────────────────────────
// 金幣/掉落物/經驗值隨深度指數成長
// 讓玩家有動力深入探索
// floor 0=首層 1.0x, 最後一層 Boss 層達約 2.5x
export const FLOOR_REWARD_SCALE = [1.0, 1.0, 1.1, 1.2, 1.35, 1.5, 1.7, 1.9, 2.2, 2.5];

// ── 難度對獎勵的加成倍率────────────────────────────────────
export const DIFFICULTY_REWARD_MULT = {
  normal:   1.0,
  advanced: 1.5,
  hard:     2.0,
  hell:     3.0,
};

// ── 動態難度調整參數────────────────────────────────────────
export const DYNAMIC_DIFFICULTY = {
  enabled: true,
  // 每多一回合（超出 3 回合），怪物 +5% 經驗回饋（soft catch-up）
  rewardBonusPerExtraRound: 0.05,
  // 每陣亡一人次，下一層難度 -2%（降低挫敗感）
  difficultyReductionPerDeath: 0.02,
  // 每被反擊命中一次，下一層獎勵 +3%（鼓勵高風險玩法）
  rewardBonusPerCounterHit: 0.01,
  // 最大累積調整幅度
  maxAdjustment: 0.4,
};

// ══════════════════════════════════════════════════════════════
// ▼▼▼  新版地下城地圖系統（Phase 1）  ▼▼▼
// ══════════════════════════════════════════════════════════════

// ── 房間類型 metadata ─────────────────────────────────────────
export const ROOM_TYPE_META = {
  entrance: { label:"入口",   icon:"🚪",  color:"#64748b", nodeColor:"#0f172a" },
  monster:  { label:"怪物房", icon:"⚔️",  color:"#ef4444", nodeColor:"#7f1d1d" },
  elite:    { label:"精英怪", icon:"💀",  color:"#f97316", nodeColor:"#7c2d12" },
  boss:     { label:"Boss",   icon:"👑",  color:"#fbbf24", nodeColor:"#78350f" },
  chest:    { label:"寶箱",   icon:"📦",  color:"#4ade80", nodeColor:"#14532d" },
  trap:     { label:"陷阱",   icon:"🪤",  color:"#f87171", nodeColor:"#450a0a" },
  merchant: { label:"商人",   icon:"🛒",  color:"#60a5fa", nodeColor:"#1e3a5f" },
  rest:     { label:"休息",   icon:"💤",  color:"#a78bfa", nodeColor:"#2e1065" },
  teleport: { label:"傳送",   icon:"🌀",  color:"#e879f9", nodeColor:"#581c87" },
  hidden:   { label:"隱藏",   icon:"❓",  color:"#a78bfa", nodeColor:"#2e1065" },
  event:    { label:"特殊",   icon:"✨",  color:"#fde68a", nodeColor:"#713f12" },
  stairs:   { label:"樓梯",   icon:"🪜",  color:"#94a3b8", nodeColor:"#1e293b" },
};

export function getRoomMeta(type) {
  return ROOM_TYPE_META[type] || ROOM_TYPE_META.monster;
}

// 從 connections 找出 currentRoomId 的所有鄰接房間
// 支援舊格式 [a,b] 陣列（靜態地圖）與新格式 {a,b} 物件（生成地圖）
export function getReachableRooms(floorData, currentRoomId) {
  const reachable = new Set();
  for (const conn of (floorData.connections || [])) {
    const a = Array.isArray(conn) ? conn[0] : conn.a;
    const b = Array.isArray(conn) ? conn[1] : conn.b;
    if (a === currentRoomId) reachable.add(b);
    if (b === currentRoomId) reachable.add(a);
  }
  return reachable;
}

export function getDungeonFloor(dungeon, floorIndex) {
  return dungeon?.floors?.[floorIndex] || null;
}

// 戰鬥房合約的地圖短標籤
export function getContractBadge(room) {
  const c = room?.meta?.contract;
  if (!c) return null;
  const p = room?.meta?.contractParam;
  switch (c) {
    case "standard":     return { label:"標準",    color:"#94a3b8" };
    case "hit_count":    return { label:"命中",    color:"#4ade80" };
    case "score_gate":   return { label:`≥${p}分`, color:"#60a5fa" };
    case "all_hit":      return { label:"M罰",     color:"#f97316" };
    case "x_crit":       return { label:"X爆",     color:"#a78bfa" };
    case "target_score": return { label:`≥${p}分`,color:"#fbbf24" };
    case "reversal":     return { label:"逆轉",    color:"#fb923c" };
    case "odd_only":     return { label:"單數",    color:"#67e8f9" };
    case "even_only":    return { label:"雙數",    color:"#f9a8d4" };
    default:             return null;
  }
}

// ── 地下城 24 地圖系統（6族 × 4難度）────────────────────────
const FAMILY_META = {
  ghost:     { label:"幽冥系", emoji:"👻", loot:{ common:["shadow_stone","bone_fragment"],  rare:["void_crystal","lich_essence"],    boss:["shadow_crown","lich_scepter","void_eye"]    }, names:{ normal:"幽靈廢墟",   advanced:"幽冥地窖",   hard:"亡靈禁地",   hell:"死神殿堂"   } },
  mountain:  { label:"山嶺系", emoji:"⛰️", loot:{ common:["rough_stone","mountain_herb"],   rare:["ore_crystal","peak_core"],        boss:["summit_gem","mountain_throne","peak_essence"] }, names:{ normal:"山麓探道",   advanced:"岩壁迷宮",   hard:"險峰試煉",   hell:"天柱巔峰"   } },
  insect:    { label:"昆蟲系", emoji:"🦋", loot:{ common:["insect_shell","silk_thread"],     rare:["wing_dust","queen_pheromone"],    boss:["queen_crystal","hive_core","ancient_silk"]   }, names:{ normal:"草叢探索",   advanced:"蟲穴迷宮",   hard:"蟲后禁地",   hell:"螞蟻帝國"   } },
  workplace: { label:"職場系", emoji:"💼", loot:{ common:["memo_paper","coffee_bean"],       rare:["boss_seal","overtime_crystal"],   boss:["gold_badge","ceo_key","annual_report"]       }, names:{ normal:"職場初探",   advanced:"會議室迷宮", hard:"加班煉獄",   hell:"企業黑洞"   } },
  exam:      { label:"考試系", emoji:"📝", loot:{ common:["exam_paper","pencil_stub"],       rare:["answer_key","study_crystal"],     boss:["diploma","exam_god_seal","knowledge_core"]   }, names:{ normal:"小考練習場", advanced:"期中考迷宮", hard:"聯考禁地",   hell:"最終試驗"   } },
  temple:    { label:"神廟系", emoji:"🏛️", loot:{ common:["stone_tablet","incense_ash"],     rare:["relic_fragment","divine_jade"],   boss:["oracle_staff","divine_crown","eternal_flame"]}, names:{ normal:"神廟前廳",   advanced:"神廟迷宮",   hard:"神聖禁地",   hell:"神明試煉"   } },
};

const DIFFICULTY_META = {
  normal:   { label:"普通", icon:"🌱", color:"#4ade80", floorCount:4, bossModifier:{ hp:1.5, atk:1.5, def:1.5 }, bossTier:2 },
  advanced: { label:"進階", icon:"⚔️", color:"#60a5fa", floorCount:5, bossModifier:{ hp:1.5, atk:1.2, def:1.2 }, bossTier:4 },
  hard:     { label:"困難", icon:"🔥", color:"#f97316", floorCount:6, bossModifier:{ hp:1.4 },                    bossTier:5 },
  hell:     { label:"地獄", icon:"💀", color:"#ef4444", floorCount:7, bossModifier:null,                          bossTier:6 },
};

function mkNormal(bm) {
  return [
    { floor:1, startRoomId:"f1r1",
      rooms:[
        { id:"f1r1", type:"monster",  x:2, y:0, label:"入口通道", meta:{ tier:1, contract:"standard" } },
        { id:"f1r2", type:"chest",    x:0, y:1, label:"隱藏儲物" },
        { id:"f1r3", type:"trap",     x:2, y:1, label:"陷阱走廊" },
        { id:"f1r4", type:"monster",  x:4, y:1, label:"守衛室",   meta:{ tier:1, contract:"hit_count" } },
        { id:"f1r5", type:"stairs",   x:2, y:2, label:"通往深處" },
      ],
      connections:[["f1r1","f1r2"],["f1r1","f1r3"],["f1r1","f1r4"],["f1r2","f1r5"],["f1r3","f1r5"],["f1r4","f1r5"]],
    },
    { floor:2, startRoomId:"f2r1",
      rooms:[
        { id:"f2r1", type:"monster",  x:2, y:0, label:"深處通道", meta:{ tier:1, contract:"score_gate", contractParam:6 } },
        { id:"f2r2", type:"rest",     x:0, y:1, label:"休息室" },
        { id:"f2r3", type:"merchant", x:2, y:1, label:"流浪商人" },
        { id:"f2r4", type:"elite",    x:4, y:1, label:"精英守衛", meta:{ tier:2, contract:"target_score", contractParam:8 } },
        { id:"f2r5", type:"boss",     x:2, y:2, label:"首領",     meta:{ tier:2, ...(bm ? {bossModifier:bm}:{}), contract:"score_gate", contractParam:7 } },
      ],
      connections:[["f2r1","f2r2"],["f2r1","f2r3"],["f2r1","f2r4"],["f2r2","f2r5"],["f2r3","f2r5"],["f2r4","f2r5"]],
    },
  ];
}

function mkAdvanced(bm) {
  return [
    { floor:1, startRoomId:"f1r1",
      rooms:[
        { id:"f1r1", type:"monster",  x:2, y:0, label:"入口通道", meta:{ tier:3, contract:"standard" } },
        { id:"f1r2", type:"chest",    x:0, y:1, label:"隱藏寶庫" },
        { id:"f1r3", type:"trap",     x:2, y:1, label:"機關走廊" },
        { id:"f1r4", type:"monster",  x:4, y:1, label:"巡邏隊",   meta:{ tier:3, contract:"hit_count" } },
        { id:"f1r5", type:"event",    x:1, y:2, label:"古老祭壇" },
        { id:"f1r6", type:"stairs",   x:3, y:2, label:"通往二層" },
      ],
      connections:[["f1r1","f1r2"],["f1r1","f1r3"],["f1r1","f1r4"],["f1r2","f1r5"],["f1r3","f1r5"],["f1r4","f1r6"],["f1r5","f1r6"]],
    },
    { floor:2, startRoomId:"f2r1",
      rooms:[
        { id:"f2r1", type:"monster",  x:2, y:0, label:"中層通道", meta:{ tier:3, contract:"score_gate", contractParam:6 } },
        { id:"f2r2", type:"elite",    x:0, y:1, label:"精英守衛", meta:{ tier:3, contract:"all_hit" } },
        { id:"f2r3", type:"rest",     x:2, y:1, label:"休息室" },
        { id:"f2r4", type:"merchant", x:4, y:1, label:"神秘商人" },
        { id:"f2r5", type:"monster",  x:1, y:2, label:"深層巡邏", meta:{ tier:4, contract:"score_gate", contractParam:7 } },
        { id:"f2r6", type:"stairs",   x:3, y:2, label:"通往三層" },
      ],
      connections:[["f2r1","f2r2"],["f2r1","f2r3"],["f2r1","f2r4"],["f2r2","f2r5"],["f2r3","f2r5"],["f2r3","f2r6"],["f2r4","f2r6"],["f2r5","f2r6"]],
    },
    { floor:3, startRoomId:"f3r1",
      rooms:[
        { id:"f3r1", type:"event",    x:2, y:0, label:"詭異現象" },
        { id:"f3r2", type:"monster",  x:0, y:1, label:"最深通道", meta:{ tier:4, contract:"score_gate", contractParam:8 } },
        { id:"f3r3", type:"rest",     x:2, y:1, label:"最後的休息" },
        { id:"f3r4", type:"elite",    x:4, y:1, label:"精英護衛", meta:{ tier:4, contract:"x_crit" } },
        { id:"f3r5", type:"boss",     x:2, y:2, label:"深淵首領", meta:{ tier:4, ...(bm ? {bossModifier:bm}:{}), contract:"all_hit" } },
      ],
      connections:[["f3r1","f3r2"],["f3r1","f3r3"],["f3r1","f3r4"],["f3r2","f3r5"],["f3r3","f3r5"],["f3r4","f3r5"]],
    },
  ];
}

function mkHard(bm) {
  return [
    { floor:1, startRoomId:"f1r1",
      rooms:[
        { id:"f1r1", type:"monster",  x:2, y:0, label:"危險通道", meta:{ tier:4, contract:"score_gate", contractParam:6 } },
        { id:"f1r2", type:"trap",     x:0, y:1, label:"致命機關" },
        { id:"f1r3", type:"elite",    x:2, y:1, label:"精英衛士", meta:{ tier:4, contract:"all_hit" } },
        { id:"f1r4", type:"chest",    x:4, y:1, label:"隱藏寶庫" },
        { id:"f1r5", type:"stairs",   x:2, y:2, label:"通往深層" },
      ],
      connections:[["f1r1","f1r2"],["f1r1","f1r3"],["f1r1","f1r4"],["f1r2","f1r5"],["f1r3","f1r5"],["f1r4","f1r5"]],
    },
    { floor:2, startRoomId:"f2r1",
      rooms:[
        { id:"f2r1", type:"monster",  x:2, y:0, label:"中層巡邏", meta:{ tier:4, contract:"score_gate", contractParam:7 } },
        { id:"f2r2", type:"event",    x:0, y:1, label:"神秘現象" },
        { id:"f2r3", type:"elite",    x:2, y:1, label:"強化精英", meta:{ tier:4, contract:"target_score", contractParam:9 } },
        { id:"f2r4", type:"merchant", x:4, y:1, label:"商人" },
        { id:"f2r5", type:"monster",  x:1, y:2, label:"深層怪物", meta:{ tier:5, contract:"hit_count" } },
        { id:"f2r6", type:"stairs",   x:3, y:2, label:"通往三層" },
      ],
      connections:[["f2r1","f2r2"],["f2r1","f2r3"],["f2r1","f2r4"],["f2r2","f2r5"],["f2r3","f2r5"],["f2r3","f2r6"],["f2r4","f2r6"],["f2r5","f2r6"]],
    },
    { floor:3, startRoomId:"f3r1",
      rooms:[
        { id:"f3r1", type:"elite",    x:2, y:0, label:"最強精英", meta:{ tier:5, contract:"x_crit" } },
        { id:"f3r2", type:"chest",    x:0, y:1, label:"Boss前寶庫" },
        { id:"f3r3", type:"trap",     x:2, y:1, label:"致命陷阱" },
        { id:"f3r4", type:"rest",     x:4, y:1, label:"最後休息" },
        { id:"f3r5", type:"boss",     x:2, y:2, label:"試煉首領", meta:{ tier:5, ...(bm ? {bossModifier:bm}:{}), contract:"score_gate", contractParam:8 } },
      ],
      connections:[["f3r1","f3r2"],["f3r1","f3r3"],["f3r1","f3r4"],["f3r2","f3r5"],["f3r3","f3r5"],["f3r4","f3r5"]],
    },
  ];
}

function mkHell(bm) {
  return [
    { floor:1, startRoomId:"f1r1",
      rooms:[
        { id:"f1r1", type:"monster",  x:2, y:0, label:"地獄入口", meta:{ tier:5, contract:"score_gate", contractParam:7 } },
        { id:"f1r2", type:"trap",     x:0, y:1, label:"奪命陷阱" },
        { id:"f1r3", type:"elite",    x:2, y:1, label:"地獄精英", meta:{ tier:5, contract:"all_hit" } },
        { id:"f1r4", type:"stairs",   x:4, y:1, label:"通往深淵" },
      ],
      connections:[["f1r1","f1r2"],["f1r1","f1r3"],["f1r2","f1r4"],["f1r3","f1r4"]],
    },
    { floor:2, startRoomId:"f2r1",
      rooms:[
        { id:"f2r1", type:"monster",  x:2, y:0, label:"深淵巡邏", meta:{ tier:5, contract:"score_gate", contractParam:7 } },
        { id:"f2r2", type:"event",    x:0, y:1, label:"詛咒現象" },
        { id:"f2r3", type:"elite",    x:2, y:1, label:"深淵精英", meta:{ tier:5, contract:"target_score", contractParam:9 } },
        { id:"f2r4", type:"chest",    x:4, y:1, label:"地獄寶庫" },
        { id:"f2r5", type:"merchant", x:1, y:2, label:"地獄商人" },
        { id:"f2r6", type:"stairs",   x:3, y:2, label:"通往第三層" },
      ],
      connections:[["f2r1","f2r2"],["f2r1","f2r3"],["f2r1","f2r4"],["f2r2","f2r5"],["f2r3","f2r5"],["f2r3","f2r6"],["f2r4","f2r6"],["f2r5","f2r6"]],
    },
    { floor:3, startRoomId:"f3r1",
      rooms:[
        { id:"f3r1", type:"monster",  x:2, y:0, label:"神魔通道", meta:{ tier:6, contract:"score_gate", contractParam:8 } },
        { id:"f3r2", type:"trap",     x:0, y:1, label:"神魔陷阱" },
        { id:"f3r3", type:"elite",    x:2, y:1, label:"神魔精英", meta:{ tier:6, contract:"all_hit" } },
        { id:"f3r4", type:"rest",     x:4, y:1, label:"短暫喘息" },
        { id:"f3r5", type:"stairs",   x:2, y:2, label:"最終之路" },
      ],
      connections:[["f3r1","f3r2"],["f3r1","f3r3"],["f3r1","f3r4"],["f3r2","f3r5"],["f3r3","f3r5"],["f3r4","f3r5"]],
    },
    { floor:4, startRoomId:"f4r1",
      rooms:[
        { id:"f4r1", type:"event",    x:2, y:0, label:"最終現象" },
        { id:"f4r2", type:"chest",    x:0, y:1, label:"最終寶庫" },
        { id:"f4r3", type:"elite",    x:2, y:1, label:"守門精英", meta:{ tier:6, contract:"x_crit" } },
        { id:"f4r4", type:"rest",     x:4, y:1, label:"最後休息" },
        { id:"f4r5", type:"boss",     x:2, y:2, label:"神魔首領", meta:{ tier:6, ...(bm ? {bossModifier:bm}:{}), contract:"all_hit" } },
      ],
      connections:[["f4r1","f4r2"],["f4r1","f4r3"],["f4r1","f4r4"],["f4r2","f4r5"],["f4r3","f4r5"],["f4r4","f4r5"]],
    },
  ];
}

const _mkMap = { normal:mkNormal, advanced:mkAdvanced, hard:mkHard, hell:mkHell };
export const DIFFICULTY_CONFIGS = Object.entries(DIFFICULTY_META).map(([id, m]) => ({ id, ...m }));
export const FAMILY_CONFIGS = Object.entries(FAMILY_META).map(([id, m]) => ({ id, label:m.label, emoji:m.emoji, names:m.names }));
export const DUNGEON_MAPS = Object.entries(FAMILY_META).flatMap(([family, fm]) =>
  Object.entries(DIFFICULTY_META).map(([difficulty, dm]) => ({
    id: `${family}_${difficulty}`,
    name: fm.names[difficulty],
    emoji: fm.emoji,
    family, difficulty, difficultyLabel: dm.label,
    description: `${fm.label} · ${dm.label}難度 · ${dm.floorCount}層`,
    enabled: true,
    floorCount: dm.floorCount,
    floors: _mkMap[difficulty](dm.bossModifier),
    loot: fm.loot,
  }))
);

// ── 隨機 2D 格子地圖生成 ──────────────────────────────────────
// 每層格子大小（漸進封頂）
export const FLOOR_GRID_CONFIGS = [
  { cols:2, rows:2 },  // floor 0: 4 rooms
  { cols:2, rows:3 },  // floor 1: 6 rooms
  { cols:3, rows:3 },  // floor 2: 9 rooms
  { cols:3, rows:4 },  // floor 3: 12 rooms
  { cols:4, rows:4 },  // floor 4: 16 rooms
  { cols:4, rows:4 },  // floor 5: 16 rooms (cap)
];

export const DIFFICULTY_FLOOR_COUNTS = {
  normal:   4,
  advanced: 5,
  hard:     6,
  hell:     7,
};

const GRID_ROOM_WEIGHTS = [
  { type:"monster",  w:32 },
  { type:"elite",    w:10 },
  { type:"chest",    w:14 },
  { type:"rest",     w:14 },
  { type:"trap",     w:9  },
  { type:"merchant", w:9  },
  { type:"event",    w:5  },
  { type:"teleport", w:5  },
  { type:"hidden",   w:2  }, // 低機率直接出現，通常從探索發現
];

function _pickWeighted(weights) {
  const total = weights.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of weights) { r -= e.w; if (r <= 0) return e.type; }
  return weights[0].type;
}

function _dungeonDifficulty(dungeonId) { return dungeonId?.split("_")[1] || "normal"; }
function _dungeonTier(dungeonId) {
  return { normal:1, advanced:3, hard:4, hell:5 }[_dungeonDifficulty(dungeonId)] || 1;
}

// 精英強化：隨機選一種高難度合約
const ELITE_CONTRACTS = ["x_crit", "reversal", "score_gate", "all_hit", "odd_only", "even_only"];
function _pickEliteContract(tier) {
  const type = ELITE_CONTRACTS[Math.floor(Math.random() * ELITE_CONTRACTS.length)];
  let param = null;
  if (type === "x_crit")       param = 6 + Math.floor(Math.random() * 5);
  if (type === "score_gate")   param = Math.min(6 + Math.floor(tier / 2), 9);
  if (type === "odd_only" || type === "even_only") param = null;
  return { tier: tier + 1, contract: type, contractParam: param }; // 精英 tier+1
}

function _roomMeta(type, tier) {
  if (!["monster","elite","boss"].includes(type)) return undefined;
  if (type === "monster") return { tier, contract:"standard" };
  if (type === "elite")   return _pickEliteContract(tier);
  return { tier, contract:"score_gate", contractParam: Math.min(6 + tier, 9) };
}

// ── 隱藏房間發現機率（進入普通房間後觸發）─────────────────────
export const HIDDEN_ROOM_DISCOVER_CHANCE = 0.08; // 8%
const HIDDEN_TRIGGER_TYPES = ["monster", "elite", "chest", "trap", "event"];

// 檢查該房間類型能否觸發隱藏房間發現
export function canTriggerHiddenRoom(roomType) {
  return HIDDEN_TRIGGER_TYPES.includes(roomType);
}

// 擲骰決定是否發現隱藏房間，並回傳新房間的資料
export function rollHiddenRoomDiscovery(floorData, currentRoomId, tier) {
  if (Math.random() > HIDDEN_ROOM_DISCOVER_CHANCE) return null;
  if (!floorData) return null;
  const allIds = new Set(floorData.rooms.map(r => r.id));
  // 找一個與已探索房間相鄰的空位（往右/往下偏移 1 格，避開已有房間的位置）
  const currentRoom = floorData.rooms.find(r => r.id === currentRoomId);
  if (!currentRoom) return null;
  // 嘗試在 (currentX+1, currentY) 或 (currentX, currentY+1) 找空位
  const candidates = [
    { x: currentRoom.x + 1, y: currentRoom.y },
    { x: currentRoom.x,     y: currentRoom.y + 1 },
    { x: currentRoom.x - 1, y: currentRoom.y },
    { x: currentRoom.x,     y: currentRoom.y - 1 },
  ];
  for (const { x, y } of candidates) {
    const candidateId = `hidden_${x}_${y}`;
    if (!allIds.has(candidateId) && x >= 0 && y >= 0) {
      const rewardTier = Math.min(9, tier + 2);
      return {
        id: candidateId,
        type: "hidden",
        x, y,
        label: "隱藏房間",
        meta: { tier: rewardTier, coins: 20 + Math.floor(Math.random() * 60) },
      };
    }
  }
  return null;
}

function _gridConns(fi, cols, rows) {
  const c = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      if (col + 1 < cols) c.push({ a:`f${fi}c${col}r${row}`, b:`f${fi}c${col+1}r${row}` });
      if (row + 1 < rows) c.push({ a:`f${fi}c${col}r${row}`, b:`f${fi}c${col}r${row+1}` });
    }
  return c;
}

function _regularFloor(fi, cols, rows, tier) {
  // 入口固定在 (0,0)，樓梯在 row≥1 的隨機位置（避免與入口同行）
  const stairRow = 1 + Math.floor(Math.random() * (rows - 1));
  const stairCol = Math.floor(Math.random() * cols);
  const rooms = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const isEntry = row === 0 && col === 0;
      const isStair = row === stairRow && col === stairCol;
      const type    = isEntry ? "entrance" : isStair ? "stairs" : _pickWeighted(GRID_ROOM_WEIGHTS);
      const meta    = _roomMeta(type, tier);
      const room    = { id:`f${fi}c${col}r${row}`, type, x:col, y:row, label:ROOM_TYPE_META[type]?.label || type };
      if (meta) room.meta = meta;
      rooms.push(room);
    }
  }
  return { floor:fi+1, startRoomId:`f${fi}c0r0`, rooms, connections:_gridConns(fi, cols, rows) };
}

function _bossFloor(fi, tier, bossModifier) {
  // 固定線性路線：入口 → 精英（1 間）→ 休息 → 商店/寶箱（隨機二出一）→ Boss
  const hasShop = Math.random() < 0.5;
  const layout = [
    { col:0, row:0, type:"entrance", label:"入口通道" },
    { col:0, row:1, type:"elite",    label:"精英守衛" },
    { col:0, row:2, type:"rest",     label:"休息室"   },
    { col:1, row:0, type: hasShop ? "merchant" : "chest", label: hasShop ? "神秘商人" : "隱藏寶庫" },
    { col:1, row:1, type:"boss",     label:"BOSS"     },
  ];
  const rooms = layout.map(({ col, row, type, label }) => {
    const meta = _roomMeta(type, tier);
    const room = { id:`f${fi}c${col}r${row}`, type, x:col, y:row, label };
    if (meta) {
      room.meta = (type === "boss" && bossModifier) ? { ...meta, bossModifier } : meta;
    }
    return room;
  });
  // 手動線性連接（一條路到底）
  const conns = [
    { a:`f${fi}c0r0`, b:`f${fi}c0r1` },  // entrance → elite
    { a:`f${fi}c0r1`, b:`f${fi}c0r2` },  // elite → rest
    { a:`f${fi}c0r2`, b:`f${fi}c1r0` },  // rest → shop/chest
    { a:`f${fi}c1r0`, b:`f${fi}c1r1` },  // shop/chest → boss
  ];
  return { floor:fi+1, startRoomId:`f${fi}c0r0`, rooms, connections:conns, isBossFloor:true };
}

export function generateDungeonFloors(dungeonId) {
  const difficulty = _dungeonDifficulty(dungeonId);
  const diffMeta   = DIFFICULTY_META[difficulty] || DIFFICULTY_META.normal;
  const floorCount = diffMeta.floorCount || 4;
  const tier       = _dungeonTier(dungeonId);
  const bossTier   = diffMeta.bossTier   || tier;     // Boss 使用更高階的 tier
  const bossMod    = diffMeta.bossModifier || null;   // Boss HP/ATK/DEF 加成
  return Array.from({ length: floorCount }, (_, fi) => {
    if (fi === floorCount - 1) return _bossFloor(fi, bossTier, bossMod);
    const cfg = FLOOR_GRID_CONFIGS[Math.min(fi, FLOOR_GRID_CONFIGS.length - 1)];
    return _regularFloor(fi, cfg.cols, cfg.rows, tier);
  });
}
