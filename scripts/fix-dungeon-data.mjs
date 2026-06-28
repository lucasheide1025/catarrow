// Fix dungeonData.js — shop items, events, contract params, badge labels
import { readFileSync, writeFileSync } from "fs";
const f = "src/lib/dungeonData.js";
let c = readFileSync(f, "utf8");

// === 1. Replace DUNGEON_SHOP_ITEMS (8 items, no contract_reset) ===
const newShop = `export const DUNGEON_SHOP_ITEMS = [
  { id:"hp_potion",      name:"回復藥",      icon:"🧪", desc:"立即回復 30% 最大血量",        cost:50,  effect:"hp_restore",     value:0.3  },
  { id:"hp_max_boost",   name:"生命上限符",   icon:"💚", desc:"永久提升 30% 最大血量（僅此局）", cost:100, effect:"hp_max_boost",   value:0.3  },
  { id:"atk_boost",      name:"ATK 提升符",  icon:"⚔️", desc:"本次地下城 ATK ×1.2",         cost:80,  effect:"atk_mult",       value:1.2  },
  { id:"atk_large",      name:"ATK 狂戰符",  icon:"🔥", desc:"本次地下城 ATK ×1.5",          cost:150, effect:"atk_mult",       value:1.5  },
  { id:"def_boost",      name:"DEF 提升符",  icon:"🛡️", desc:"本次地下城 DEF ×1.2",         cost:80,  effect:"def_mult",       value:1.2  },
  { id:"def_large",      name:"DEF 鐵壁符",  icon:"🏰", desc:"本次地下城 DEF ×1.5",          cost:150, effect:"def_mult",       value:1.5  },
  { id:"revival",        name:"復活符",      icon:"💫", desc:"下次陣亡自動復活（30% HP）",   cost:100, effect:"revival"                   },
  { id:"revival_front",  name:"前衛復活藥",  icon:"💊", desc:"復活一名倒地前衛（轉回前衛+50%HP）", cost:120, effect:"revival_front"             },
];`;

const oldShopIdx = c.indexOf("export const DUNGEON_SHOP_ITEMS = [");
const shopEnd = c.indexOf("\n];\n\n// ── 隨機事件", oldShopIdx);
c = c.slice(0, oldShopIdx) + newShop + c.slice(shopEnd + 1);

// === 2. Replace DUNGEON_EVENTS (21 items) ===
const newEvents = `export const DUNGEON_EVENTS = [
  // ── 原有常用事件 ──
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
  // ── 新增事件 ──
  { id:"fairy_blessing",icon:"🧚",  title:"妖精祝福",   desc:"妖精圍繞，全隊回復 40% 最大血量",               type:"buff",    effect:{ type:"hp_restore_all",    value:0.4  } },
  { id:"dark_ritual",   icon:"🔮", title:"黑暗儀式",   desc:"黑暗力量籠罩，隨機一名隊友本層 ATK ×0.5",      type:"debuff",  effect:{ type:"atk_buff_one",      value:0.5  } },
  { id:"golden_fountain",icon:"⛲", title:"黃金噴泉",   desc:"發現黃金噴泉！每人各獲得 80 金幣",               type:"buff",    effect:{ type:"gold_bonus",        value:80   } },
  { id:"time_warp",     icon:"⏳", title:"時光扭曲",   desc:"時間扭曲，怪物無法反擊（本層怪物不反擊）",       type:"buff",    effect:{ type:"skip_counter",      value:true } },
  { id:"sleepy_dust",   icon:"💤", title:"睡眠花粉",   desc:"吸入睡眠花粉，怪物沉睡一回合（不反擊）",         type:"buff",    effect:{ type:"skip_counter",      value:true } },
  { id:"defense_boost", icon:"🛡️", title:"守護結界",   desc:"結界展開，本層全隊 DEF ×1.5",                    type:"buff",    effect:{ type:"def_mult_all",      value:1.5  } },
  { id:"defense_break", icon:"💔", title:"防禦崩壞",   desc:"結界碎裂，本層怪物 DEF ×1.5（更難擊破）",         type:"debuff",  effect:{ type:"monster_def_mult",  value:1.5  } },
  { id:"mimic_chest",   icon:"🎁", title:"寶箱怪！",   desc:"寶箱竟然是怪物！全隊受到 15% 最大血量傷害",      type:"debuff",  effect:{ type:"hp_lose_all",       value:0.15 } },
  { id:"wish_well",     icon:"🤞", title:"許願井",     desc:"許願成功！隨機一名成員獲得雙倍傷害加成",         type:"buff",    effect:{ type:"atk_buff_one",      value:2.0  } },
  { id:"poison_swamp",  icon:"🟢",  title:"毒沼澤",     desc:"毒氣瀰漫，全隊受到 20% 最大血量傷害",            type:"debuff",  effect:{ type:"hp_lose_all",       value:0.2  } },
];`;

const oldEventIdx = c.indexOf("export const DUNGEON_EVENTS = [");
const eventEnd = c.indexOf("\n];\n\n// ── 地下城長度", oldEventIdx);
c = c.slice(0, oldEventIdx) + newEvents + c.slice(eventEnd + 1);

// === 3. Fix assignContracts (x_crit param 6~10, target_score 20~50) ===
c = c.replace(
  "if (type === \"score_gate\")   param = 6 + Math.floor(Math.random() * 3); // 6, 7, 8\n    if (type === \"target_score\") param = 6 + Math.floor(Math.random() * 5); // 6~10",
  'if (type === "x_crit")       param = 6 + Math.floor(Math.random() * 5); // 6~10\n    if (type === "target_score") param = 20 + Math.floor(Math.random() * 31); // 20~50'
);

// === 4. Fix rerollContract (same param changes) ===
c = c.replace(
  "if (type === \"score_gate\")   param = 6 + Math.floor(Math.random() * 3);\n  if (type === \"target_score\") param = 6 + Math.floor(Math.random() * 5);",
  'if (type === "x_crit")       param = 6 + Math.floor(Math.random() * 5);\n  if (type === "target_score") param = 20 + Math.floor(Math.random() * 31);'
);

// === 5. Fix getContractBadge — add new types ===
const oldBadge = `  switch (c) {
    case "standard":     return { label:"標準",    color:"#94a3b8" };
    case "hit_count":    return { label:"命中",    color:"#4ade80" };
    case "score_gate":   return { label:\`≥\${p}分\`, color:"#60a5fa" };
    case "all_hit":      return { label:"全中",    color:"#f97316" };
    case "x_crit":       return { label:"X爆",     color:"#a78bfa" };
    case "target_score": return { label:\`\${p}分×2\`,color:"#fbbf24" };
    default:             return null;
  }`;

const newBadge = `  switch (c) {
    case "standard":     return { label:"標準",    color:"#94a3b8" };
    case "hit_count":    return { label:"命中",    color:"#4ade80" };
    case "score_gate":   return { label:\`≥\${p}分\`, color:"#60a5fa" };
    case "all_hit":      return { label:"全中",    color:"#f97316" };
    case "x_crit":       return { label:\`\${p}爆\`,  color:"#a78bfa" };
    case "target_score": return { label:\`≥\${p}分\`,color:"#fbbf24" };
    case "reversal":     return { label:"逆轉",    color:"#fb923c" };
    case "odd_only":     return { label:"單數",    color:"#67e8f9" };
    case "even_only":    return { label:"雙數",    color:"#f9a8d4" };
    default:             return null;
  }`;

c = c.replace(oldBadge, newBadge);

// === 6. Fix calcDungeonContractDmg — add reversal, odd_only, even_only, total_score check ===
// Need to replace the whole function. Let me find it.
const calcStart = c.indexOf("export function calcDungeonContractDmg");
const calcEnd = c.indexOf("\n// ══════════════════════════════════════════════════════════════\n// ▼▼▼  新版", calcStart);

const newCalc = `export function calcDungeonContractDmg(arrows, atk, monsterDef, contract, resolveHitPartFn, dmgMult = 1) {
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

    // 得分關：低於門檻 → 無傷害
    if (type === "score_gate" && score < 6) {
      arrowBreakdown.push({ label: arrow.label, partIcon:"🚫", partName:"未達門檻", dmg:0, isCrit:false });
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

    // 逆轉關
    if (type === "reversal") {
      if (score === 6) {
        // 6分 → 爆擊
        const base = 8 + (atk || 10) * 0.7 + score * 1.2 - (monsterDef || 0) * 0.35;
        const m    = 0.85 + Math.random() * 0.3;
        let d = Math.max(1, Math.round(base * pMult * m));
        d = Math.round(d * dmgMult);
        totalDmg += d; crits++;
        arrowBreakdown.push({ label: arrow.label, partIcon: part.icon, partName: part.name, partMult: pMult, dmg: d, isCrit: true });
        continue;
      } else if (score === 7) {
        // 7分 → 必中（正常傷害）
        const base = 8 + (atk || 10) * 0.7 + score * 1.2 - (monsterDef || 0) * 0.35;
        const m    = 0.85 + Math.random() * 0.3;
        let d = Math.max(1, Math.round(base * pMult * m));
        d = Math.round(d * dmgMult);
        totalDmg += d;
        arrowBreakdown.push({ label: arrow.label, partIcon: part.icon, partName: part.name, partMult: pMult, dmg: d, isCrit: false });
        continue;
      } else {
        // 8/9/10/X → 脫靶
        arrowBreakdown.push({ label: arrow.label, partIcon:"🚫", partName:"逆轉脫靶", dmg:0, isCrit:false });
        continue;
      }
    }

    let d, isCrit;
    if (type === "hit_count") {
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
}`;

c = c.slice(0, calcStart) + newCalc + c.slice(calcEnd);

// Write
writeFileSync(f, c, "utf8");
console.log("Done! File length:", c.length);
console.log("Has contract_reset in SHOP:", c.includes("export const DUNGEON_SHOP_ITEMS") && c.slice(c.indexOf("DUNGEON_SHOP_ITEMS"), c.indexOf("DUNGEON_SHOP_ITEMS") + 500).includes("contract_reset") ? "BAD" : "OK");
console.log("Has scroll:", c.includes("scroll") ? "BAD (old event)" : "OK");
console.log("Has contract_swap:", c.includes("contract_swap") ? "BAD (old event)" : "OK");
console.log("Has hp_max_boost:", c.includes("hp_max_boost") ? "OK" : "BAD");
console.log("Has atlas_large:", c.includes("atk_large") ? "OK" : "BAD");
console.log("Has reversal badge:", c.includes("reversal") && c.includes("fb923c") ? "OK" : "BAD");
console.log("Has odd_only logic:", c.includes("odd_only") ? "OK" : "BAD");
