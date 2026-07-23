// src/lib/itemData.js
// 寶箱系統 + 藥劑系統（2026-06-28 改版）
// 藥水分兩大類：攜帶型(carry, 9種) / 投擲型(throw, 7種)

import { drawMaterial, MATERIALS } from "./monsterMaterials";
import { MONSTERS } from "./monsterData";
import { EXPANSION_MATERIALS, EXPANSION_MONSTER_BY_ID } from "./monsterExpansionCatalog";

// ── 寶箱類型 ─────────────────────────────────────────────
export const CHEST_TYPES = {
  wood:   { id:"wood",   name:"通用材料木箱",   icon:"📦", color:"#a16207", potionChance:0,
            desc:"通用箱：開出六大族該階普通材料（每族 ×1）。" },
  iron:   { id:"iron",   name:"通用材料鐵箱",   icon:"🧰", color:"#64748b", potionChance:0,
            desc:"通用箱：開出六大族該階普通材料（每族 1~2 個）。" },
  gold:   { id:"gold",   name:"通用材料金箱", icon:"🎁", color:"#f59e0b", potionChance:0,
            desc:"通用箱：開出六大族該階普通+小王材料（每族 1~3 個）。" },
  epic:   { id:"epic",   name:"通用材料史詩箱", icon:"💜", color:"#a78bfa", potionChance:0,
            desc:"通用箱：開出六大族該階普通+小王材料（每族 1~4 個）。" },
  mythic: { id:"mythic", name:"通用材料神話箱", icon:"🔮", color:"#a855f7", potionChance:0,
            desc:"通用箱：開出六大族該階全部材料（每族 1~5 個）。" },
  cat:    { id:"cat",    name:"貓貓箱",   icon:"🐱", color:"#ec4899", potionChance:0,
            desc:"神秘的貓貓箱！90% 機率隨機掉落一種章碎片×1，集10片可合成對應章！" },
  potion:   { id:"potion",   name:"藥水箱",   icon:"🧪", color:"#06b6d4", potionChance:1,
              desc:"專屬藥水箱！必定開出一瓶藥水，機率依實用度調整。" },
  card_pack: { id:"card_pack", name:"圖片收集卡包", icon:"🃏", color:"#6366f1", potionChance:0,
               desc:"開啟獲得 3 張怪物卡片！36 種怪物都有機率，越稀有越難抽！" },
  cat_box:   { id:"cat_box",   name:"貓貓箱", icon:"🎐", color:"#ec4899", potionChance:0,
               desc:"神秘貓貓箱！90% 機率隨機掉落一種章碎片×1。" },
  wb_relic:  { id:"wb_relic",  name:"世界秘寶箱", icon:"🗝️", color:"#facc15", potionChance:0,
               desc:"只有世界王才會掉落的稀世寶箱！開啟獲得大量金幣，並有機率開出這隻王的專屬卡片。" },
  mimi_box:  { id:"mimi_box",  name:"咪咪箱", icon:"😺", color:"#f43f5e", potionChance:0,
               desc:"神秘咪咪箱！開啟後隨機獲得一隻貓咪夥伴，已擁有全部時給羈絆經驗！" },
  // ══ 新素材箱系統（2026-07-22）═══════════════════════════
  family_mat: { id:"family_mat", name:"族系素材箱", icon:"📦", color:"#a16207", potionChance:0,
                 desc:"打開獲得指定家族與階級的普通素材。" },
  mini_boss_mat: { id:"mini_boss_mat", name:"小王素材箱", icon:"🔶", color:"#8b5cf6", potionChance:0,
                    desc:"打開獲得小王階級的隨機素材（跨家族）。" },
  boss_mat: { id:"boss_mat", name:"大王素材箱", icon:"🔴", color:"#ef4444", potionChance:0,
               desc:"打開獲得大王階級的隨機素材（跨家族）。" },
};

// 怪物階級 → 寶箱種類機率
const CHEST_ROLL = {
  common: [["wood",   1.0]],
  rare:   [["wood",   0.7], ["iron",   0.3]],
  elite:  [["iron",   0.8], ["gold",   0.2]],
  fierce: [["iron",   0.4], ["gold",   0.6]],
  boss:   [["gold",   0.6], ["epic",   0.4]],
  mythic: [["epic",   0.6], ["mythic", 0.4]],
};

// 學生模式：同樣可掉較高級寶箱，但機率往低階偏移
const CHEST_ROLL_STUDENT = {
  common: [["wood",   1.0]],
  rare:   [["wood",   0.85], ["iron",  0.15]],
  elite:  [["iron",   0.85], ["gold",  0.15]],
  fierce: [["iron",   0.55], ["gold",  0.45]],
  boss:   [["gold",   0.70], ["epic",  0.30]],
  mythic: [["epic",   0.70], ["mythic",0.30]],
};

// 貓貓箱額外掉落機率（依怪物階級）
const CAT_CHEST_CHANCE = {
  common: 0.01, rare: 0.015, elite: 0.02, fierce: 0.03, boss: 0.04, mythic: 0.05,
};

// 藥水箱額外掉落機率（依怪物階級）
const POTION_CHEST_CHANCE = {
  common: 0.02, rare: 0.04, elite: 0.06, fierce: 0.08, boss: 0.12, mythic: 0.18,
};

export function rollChestType(tier, mode) {
  const table = (mode === "student" ? CHEST_ROLL_STUDENT : CHEST_ROLL)[tier]
    || CHEST_ROLL.common;
  let r = Math.random();
  for (const [type, p] of table) { r -= p; if (r <= 0) return type; }
  return table[table.length - 1][0];
}

// 產生寶箱（打贏怪物時呼叫）
// 回傳 { mainChest, bonusChest|null, potionChest|null }
// 老手/賽事：bonusChest = 第二個主寶箱（已移除 catChest / 章碎片掉落）
export function makeChests(monster, mode) {
  const now  = Date.now();

  // ── 新族系/王箱掉落（2026-07-23）───────────────────────────
  // 僅適用「擴充素材家族」(ghost/mountain/insect/workplace/exam/temple/treasure)。
  // 傳統打怪家族（forest/dragon/…）或缺 family 時，沿用舊的通用材料箱（舊系統完整保留）。
  // 依怪物 encounter 分箱：normal→族系箱、miniBoss→小王箱、boss→大王箱。
  // encounter/family/tierIndex 優先讀怪物物件，缺就用怪物 id 回查擴充圖鑑（戰鬥物件可能被精簡）。
  const canon = EXPANSION_MONSTER_BY_ID[monster.id] || null;
  const family = monster.family || canon?.family;
  const tierIndex = monster.tierIndex || canon?.tierIndex
    || (MONSTER_TIER_ORDER.indexOf(monster.tier) + 1);
  const encounter = monster.encounter || canon?.encounter
    || (monster.isKing ? "boss" : "normal");
  const useFamilyChest = ALL_FAMILIES.includes(family) && tierIndex >= 1;

  const mkNew = () => encounter === "boss"
    ? makeBossChest(family, tierIndex, monster.name)
    : encounter === "miniBoss"
      ? makeMiniBossChest(family, tierIndex, monster.name)
      : makeFamilyMaterialChest(family, tierIndex, monster.name);
  const mkOld = (extra = 0) => ({
    id: `chest_${now + extra}_${Math.random().toString(36).slice(2, 8)}`,
    type: rollChestType(monster.tier, mode),
    family: monster.family, tier: monster.tier, from: monster.name, ts: now + extra,
  });
  const mk = (extra = 0) => useFamilyChest ? mkNew() : mkOld(extra);

  const mainChest  = mk(0);
  const bonusChest = (mode === "veteran" || mode === "match") ? mk(1) : null;
  const potMult    = (mode === "veteran" || mode === "match") ? 1.5 : mode === "novice" ? 0.5 : 1;
  const potionChance = (POTION_CHEST_CHANCE[monster.tier] || 0.02) * potMult;
  const potionChest = Math.random() < potionChance ? {
    id:   `chest_potion_${now + 2}_${Math.random().toString(36).slice(2, 8)}`,
    type: "potion", family: monster.family, tier: monster.tier, from: monster.name, ts: now + 2,
  } : null;
  return { mainChest, bonusChest, potionChest };
}

// 向下相容舊呼叫（MonsterBattle 會逐步改用 makeChests）
export function makeChest(monster) { return makeChests(monster).mainChest; }

// ── 章碎片定義 ────────────────────────────────────────────
// 10 個碎片 → 合成對應章
export const FRAGMENTS = [
  {
    id: "frag_fatcat_bronze",
    name: "肥貓銅章碎片",
    icon: "🐱",
    color: "#ec4899",
    desc: "集滿 10 個可合成肥貓銅章！",
    craftCount: 10,
    craftResult: { type: "fatcat_bronze", badgeField: "fatCat", badgeLevel: "bronze", label: "肥貓銅章" },
  },
  {
    id: "frag_score_bronze",
    name: "積分銅章碎片",
    icon: "⭐",
    color: "#f59e0b",
    desc: "集滿 10 個可合成積分銅章！",
    craftCount: 10,
    craftResult: { type: "score_bronze", badgeField: "score", badgeLevel: "bronze", label: "積分銅章" },
  },
  {
    id: "frag_achieve_silver",
    name: "成就銀章碎片",
    icon: "🏆",
    color: "#8b5cf6",
    desc: "集滿 10 個可合成成就銀章！",
    craftCount: 10,
    craftResult: { type: "achieve_silver", badgeField: "achievement", badgeLevel: "silver", label: "成就銀章" },
  },
];

export function getFragment(id) { return FRAGMENTS.find(f => f.id === id) || null; }

// ════════════════════════════════════════════════════════════
//  藥劑定義（2026-06-28 改版）
// ════════════════════════════════════════════════════════════
// 兩大類（全模式通用）：
//   carry  - 攜帶型：每回合可選一種喝，消耗一瓶，效果持續該回合
//   throw  - 投擲型：取代一箭，消耗一瓶，即時效果
//
// 效果欄位：
//   攜帶型: hpPct(回血%) / atkPct(ATK+%) / defPct(DEF+%)
//   投擲型: throwDmg(固定傷) / throwPct(比例傷 maxHP%) /
//           throwDmgMin+throwDmgMax(隨機傷) /
//           monAtkPct(降ATK%) / monDefPct(降DEF%) /
//           skipRound(禁反擊, "big")
// recipe 使用村莊資源（非怪物材料）
// ════════════════════════════════════════════════════════════

const carry = ({ id, family, level, name, icon, rarity, effect, effectText, desc, recipe, gold, craftYield, futureFeature }) => ({
  id, family, level, name, icon, rarity, kind:"carry", category:"carry",
  battleModes:["monster","party","dungeon","worldboss"], actionCost:"utility",
  effect, effectText, desc, recipe, gold, craftYield, futureFeature,
  asset:"/consumables/consumable-atlas.webp",
});

const throwable = ({ id, family, name, icon, rarity, effect, effectText, desc, recipe, gold, craftYield, actionCost = "utility", futureFeature }) => ({
  id, family, name, icon, rarity, kind:"throw", category:"throw",
  battleModes:["monster","party","dungeon"], actionCost,
  effect, effectText, desc, recipe, gold, craftYield, futureFeature,
  asset:"/consumables/consumable-atlas.webp",
});

const raid = ({ id, family, name, icon, rarity, effect, effectText, desc, recipe, gold, actionCost = "utility", requiresBot = false }) => ({
  id, family, name, icon, rarity, kind:"raid", category:"raid",
  battleModes:["worldboss"], actionCost, oncePerSortie:true, requiresBot,
  effect, effectText, desc, recipe, gold, craftYield:1,
  asset:"/consumables/consumable-atlas.webp",
});

export const POTION_CATALOG_VERSION = 2;

export const POTIONS = [
  // ══ 攜帶型：HP恢復（3 級）════════════════════════════════
  carry({ id:"carry_heal_basic", family:"heal", level:1, name:"回復藥", icon:"❤️", rarity:"common", effect:{hpPct:15}, effectText:"立即回復 15% HP", desc:"日常使用的鮮魚草本回復藥。", recipe:[{id:"potion_t1",count:2},{id:"fish_t1",count:1}], gold:100, craftYield:3 }),
  carry({ id:"carry_heal_advanced", family:"heal", level:2, name:"高級回復藥", icon:"💗", rarity:"uncommon", effect:{hpPct:30}, effectText:"立即回復 30% HP", desc:"濃縮鮮魚精華的高效回復藥。", recipe:[{id:"potion_t2",count:2},{id:"fish_t2",count:1}], gold:250, craftYield:2 }),
  carry({ id:"carry_power_basic", family:"power", level:1, name:"力量藥", icon:"⚔️", rarity:"common", effect:{atkPct:10}, effectText:"本場戰鬥 ATK +10%", desc:"以動物肉精華提升拉弓力量。", recipe:[{id:"potion_t1",count:2},{id:"meat_t1",count:1}], gold:100, craftYield:3 }),
  carry({ id:"carry_power_advanced", family:"power", level:2, name:"高級力量藥", icon:"🗡️", rarity:"uncommon", effect:{atkPct:20}, effectText:"本場戰鬥 ATK +20%", desc:"強力濃縮的戰鬥增幅藥。", recipe:[{id:"potion_t2",count:2},{id:"meat_t2",count:1}], gold:250, craftYield:2 }),
  carry({ id:"carry_guard_basic", family:"guard", level:1, name:"守護藥", icon:"🛡️", rarity:"common", effect:{defPct:15}, effectText:"本場戰鬥 DEF +15%", desc:"礦物粉調製的基礎守護藥。", recipe:[{id:"potion_t1",count:2},{id:"ore_t1",count:1}], gold:100, craftYield:3 }),
  carry({ id:"carry_guard_advanced", family:"guard", level:2, name:"高級守護藥", icon:"🔰", rarity:"uncommon", effect:{defPct:30}, effectText:"本場戰鬥 DEF +30%", desc:"高密度礦物精華形成堅實防護。", recipe:[{id:"potion_t2",count:2},{id:"ore_t2",count:1}], gold:250, craftYield:2 }),
  carry({ id:"carry_shield_basic", family:"shield", level:1, name:"護盾藥", icon:"🫧", rarity:"common", effect:{shieldPct:10}, effectText:"獲得最大 HP 10% 護盾", desc:"罐頭膠質形成一次額外承傷層。", recipe:[{id:"potion_t1",count:2},{id:"can_t1",count:1}], gold:100, craftYield:3 }),
  carry({ id:"carry_shield_advanced", family:"shield", level:2, name:"高級護盾藥", icon:"🔵", rarity:"uncommon", effect:{shieldPct:20}, effectText:"獲得最大 HP 20% 護盾", desc:"更厚實的防護膜，維持本場戰鬥。", recipe:[{id:"potion_t2",count:2},{id:"can_t2",count:1}], gold:250, craftYield:2 }),
  carry({ id:"carry_regen_basic", family:"regen", level:1, name:"再生藥", icon:"🌱", rarity:"common", effect:{regenPct:4}, effectText:"每大回合回復 4% HP", desc:"瓜瓜草本讓體力緩慢恢復。", recipe:[{id:"potion_t1",count:2},{id:"melon_t1",count:1}], gold:100, craftYield:3 }),
  carry({ id:"carry_regen_advanced", family:"regen", level:2, name:"高級再生藥", icon:"🌿", rarity:"uncommon", effect:{regenPct:8}, effectText:"每大回合回復 8% HP", desc:"長期戰鬥使用的濃縮再生藥。", recipe:[{id:"potion_t2",count:2},{id:"melon_t2",count:1}], gold:250, craftYield:2 }),
  carry({ id:"carry_berserk_basic", family:"berserk", level:1, name:"狂戰藥", icon:"🔥", rarity:"common", effect:{dmgPct:15,defPenaltyPct:10}, effectText:"傷害 +15%、DEF -10%", desc:"以小魚乾辛香料換取高風險爆發。", recipe:[{id:"potion_t1",count:2},{id:"driedfish_t1",count:1}], gold:100, craftYield:3 }),
  carry({ id:"carry_berserk_advanced", family:"berserk", level:2, name:"高級狂戰藥", icon:"💥", rarity:"uncommon", effect:{dmgPct:30,defPenaltyPct:20}, effectText:"傷害 +30%、DEF -20%", desc:"捨棄防守的強烈爆發配方。", recipe:[{id:"potion_t2",count:2},{id:"driedfish_t2",count:1}], gold:250, craftYield:2 }),
  carry({ id:"carry_cleanse_basic", family:"cleanse", level:1, name:"淨化藥", icon:"✨", rarity:"common", effect:{cleanseCount:1}, effectText:"清除 1 個異常狀態（預備）", desc:"異常狀態系統開放後可使用。", recipe:[{id:"potion_t1",count:2},{id:"fish_t1",count:1}], gold:100, craftYield:3, futureFeature:"status_effects" }),
  carry({ id:"carry_cleanse_advanced", family:"cleanse", level:2, name:"高級淨化藥", icon:"🌟", rarity:"uncommon", effect:{cleanseAll:true,statusResistRounds:1}, effectText:"清除全部異常並獲得抗性（預備）", desc:"異常狀態系統開放後可使用。", recipe:[{id:"potion_t2",count:2},{id:"fish_t2",count:1}], gold:250, craftYield:2, futureFeature:"status_effects" }),

  throwable({ id:"throw_knife", family:"damage", name:"投擲小刀", icon:"🔪", rarity:"common", effect:{atkDamagePct:120}, effectText:"造成 ATK 120% 傷害", desc:"取代一箭的穩定攻擊道具。", recipe:[{id:"potion_t1",count:1},{id:"ore_t1",count:2}], gold:100, craftYield:3, actionCost:"arrow" }),
  throwable({ id:"throw_bomb", family:"damage", name:"爆裂彈", icon:"💣", rarity:"common", effect:{atkDamagePct:80,throwDmg:20}, effectText:"造成 ATK 80% +20 傷害", desc:"爆風與碎片同時命中目標。", recipe:[{id:"potion_t1",count:1},{id:"ore_t1",count:2}], gold:100, craftYield:3, actionCost:"arrow" }),
  throwable({ id:"throw_corrosion", family:"damage", name:"腐蝕瓶", icon:"🧫", rarity:"rare", effect:{throwPct:0.06,bossAtkCapPct:250}, effectText:"扣最大 HP 6%（頭目有上限）", desc:"對普通怪物造成高比例腐蝕傷害。", recipe:[{id:"potion_t3",count:1},{id:"can_t2",count:2}], gold:400, craftYield:1, actionCost:"arrow" }),
  throwable({ id:"throw_poison", family:"damage", name:"毒液瓶", icon:"☠️", rarity:"uncommon", effect:{dotAtkPct:40,dotRounds:3}, effectText:"每大回合 ATK 40%，持續 3 回合", desc:"重複使用只刷新持續時間。", recipe:[{id:"potion_t2",count:1},{id:"melon_t2",count:1}], gold:200, craftYield:2, actionCost:"arrow" }),
  throwable({ id:"throw_weaken", family:"debuff", name:"虛弱粉塵", icon:"🌫️", rarity:"uncommon", effect:{monAtkPct:20}, effectText:"本場怪物 ATK -20%", desc:"削弱怪物的攻擊力量。", recipe:[{id:"potion_t2",count:1},{id:"driedfish_t2",count:1}], gold:200, craftYield:2 }),
  throwable({ id:"throw_armor_break", family:"debuff", name:"破甲酸", icon:"🧴", rarity:"uncommon", effect:{monDefPct:25}, effectText:"本場怪物 DEF -25%", desc:"腐蝕護甲，讓後續攻擊更有效。", recipe:[{id:"potion_t2",count:1},{id:"ore_t2",count:1}], gold:200, craftYield:2 }),
  throwable({ id:"throw_hunter_mark", family:"support", name:"獵人標記", icon:"🎯", rarity:"rare", effect:{teamDmgPct:10}, effectText:"全隊對目標傷害 +10%", desc:"強力團隊用品，每個目標只保留一層。", recipe:[{id:"potion_t3",count:1},{id:"fish_t2",count:2}], gold:400, craftYield:1 }),
  throwable({ id:"throw_paralyze", family:"control", name:"麻痺瓶", icon:"🕸️", rarity:"uncommon", effect:{skipRound:"big",bossCounterReducePct:50}, effectText:"停止一次反擊；頭目改為減傷", desc:"普通怪停止反擊，頭目下一次反擊減半。", recipe:[{id:"potion_t2",count:1},{id:"meat_t2",count:1}], gold:200, craftYield:2 }),
  throwable({ id:"throw_smoke", family:"control", name:"煙霧彈", icon:"💨", rarity:"uncommon", effect:{counterReducePct:50}, effectText:"下一次怪物反擊傷害 -50%", desc:"遮蔽怪物視線，降低下一次反擊。", recipe:[{id:"potion_t2",count:1},{id:"melon_t2",count:1}], gold:200, craftYield:2 }),
  throwable({ id:"throw_binding_net", family:"control", name:"束縛網", icon:"🕸️", rarity:"uncommon", effect:{delaySpecial:1}, effectText:"延後一次首領大招（預備）", desc:"特殊攻擊系統開放後可使用。", recipe:[{id:"potion_t2",count:1},{id:"meat_t2",count:1}], gold:200, craftYield:2, futureFeature:"boss_specials" }),

  raid({ id:"raid_bomb", family:"raid_damage", name:"討伐爆彈", icon:"💣", rarity:"rare", effect:{atkDamagePct:180}, effectText:"對世界王造成 ATK 180% 傷害", desc:"世界王專用，取代一箭。", recipe:[{id:"potion_t3",count:1},{id:"ore_t2",count:2}], gold:400, actionCost:"arrow" }),
  raid({ id:"raid_execution_spear", family:"raid_damage", name:"終結獵矛", icon:"🔱", rarity:"rare", effect:{atkDamagePct:120,executeHpPct:25,executeAtkPct:260}, effectText:"ATK 120%；低血量時 260%", desc:"世界王低於 25% HP 時發揮終結威力。", recipe:[{id:"potion_t3",count:1},{id:"meat_t2",count:2}], gold:400, actionCost:"arrow" }),
  raid({ id:"raid_shatter_mark", family:"raid_debuff", name:"碎甲印記", icon:"🔶", rarity:"rare", effect:{sortieDmgPct:12}, effectText:"本次出戰傷害 +12%", desc:"效果只屬於自己的本次出戰。", recipe:[{id:"potion_t3",count:1},{id:"ore_t2",count:2}], gold:400 }),
  raid({ id:"raid_rally_flare", family:"raid_support", name:"集結信號彈", icon:"🎆", rarity:"rare", effect:{botDmgPct:25}, effectText:"本次雇用助手傷害 +25%", desc:"沒有雇用助手時不可使用。", recipe:[{id:"potion_t3",count:1},{id:"can_t2",count:2}], gold:400, requiresBot:true }),
  raid({ id:"raid_suppression_chain", family:"raid_control", name:"鎮壓鎖鏈", icon:"⛓️", rarity:"rare", effect:{counterReducePct:60,delaySpecial:1}, effectText:"下一次反擊 -60%", desc:"未來世界王特殊大招上線後也會延後一次。", recipe:[{id:"potion_t3",count:1},{id:"melon_t2",count:2}], gold:400 }),
].map((item, spriteIndex) => ({ ...item, spriteIndex }));

export function getPotion(id) { return POTIONS.find(p => p.id === id) || null; }

// 攜帶型藥水分類輔助
export const CARRY_POTIONS = POTIONS.filter(p => p.kind === "carry");
export const THROW_POTIONS = POTIONS.filter(p => p.kind === "throw");
export const RAID_POTIONS = POTIONS.filter(p => p.kind === "raid");

// 舊系統 MAX_POTIONS_PER_BATTLE = 3 已移除（新系統改為回合中消耗，無每戰上限）

// ── 材料分層開箱設定 ─────────────────────────────────────
// 怪物 tier 詞彙（T1~T6）
const MONSTER_TIER_ORDER = ["common","rare","elite","fierce","boss","mythic"];

// 每種寶箱開出的材料層數 + 每層最多幾個
const CHEST_TIER_CFG = {
  wood:   { tierCount:1, maxPerTier:1 },
  iron:   { tierCount:2, maxPerTier:2 },
  gold:   { tierCount:3, maxPerTier:3 },
  epic:   { tierCount:4, maxPerTier:4 },
  mythic: { tierCount:6, maxPerTier:5 },
};

const EXPANSION_KINDS_BY_CHEST = {
  wood:new Set(["normal"]),
  iron:new Set(["normal"]),
  gold:new Set(["normal","miniBoss"]),
  epic:new Set(["normal","miniBoss"]),
  mythic:new Set(["normal","miniBoss","boss"]),
};

export function getExpansionChestMaterialPool(chestType, family, tierIndex) {
  const kinds = EXPANSION_KINDS_BY_CHEST[chestType];
  if (!kinds) return [];
  return EXPANSION_MATERIALS.filter(material =>
    material.family === family && material.tierIndex === tierIndex && kinds.has(material.kind),
  );
}

// 藥水箱抽表（權重越高越容易出現）
const POTION_CHEST_TABLE = [
  { id:"carry_heal_basic",      weight:14 },
  { id:"carry_power_basic",     weight:14 },
  { id:"carry_guard_basic",     weight:14 },
  { id:"carry_shield_basic",    weight:10 },
  { id:"carry_regen_basic",     weight:10 },
  { id:"carry_berserk_basic",   weight:8 },
  { id:"throw_knife",           weight:10 },
  { id:"throw_bomb",            weight:8 },
  { id:"carry_heal_advanced",   weight:5 },
  { id:"carry_power_advanced",  weight:5 },
  { id:"carry_guard_advanced",  weight:5 },
  { id:"carry_shield_advanced", weight:4 },
  { id:"carry_regen_advanced",  weight:4 },
  { id:"carry_berserk_advanced",weight:3 },
  { id:"throw_weaken",          weight:4 },
  { id:"throw_armor_break",     weight:4 },
  { id:"throw_paralyze",        weight:2 },
  { id:"throw_smoke",           weight:2 },
  { id:"throw_corrosion",       weight:1 },
  { id:"throw_hunter_mark",     weight:1 },
];

const ALL_FAMILIES = ["ghost","mountain","insect","workplace","exam","temple","treasure"];
// 六大族（不含 treasure 寶箱族）——通用材料寶箱開箱範圍
const SIX_FAMILIES = ["ghost","mountain","insect","workplace","exam","temple"];

// 家族中文名稱對照（新素材箱命名用）
const FAMILY_NAMES = {
  ghost: "幽冥", mountain: "山嶺", insect: "昆蟲",
  workplace: "職場", exam: "考試", temple: "神廟", treasure: "寶箱",
};

// ── 新素材箱生成函式 ────────────────────────────────────

// 族系素材箱：7 家族 × 6 階級 = 42 種，只開出同族同階的普通素材
const FAMILY_CHEST_COLORS = ["#a16207","#65a30d","#0d9488","#2563eb","#7c3aed","#db2777"];
export function makeFamilyMaterialChest(family, tierIndex, source = "掉落") {
  const name = FAMILY_NAMES[family] || family;
  const now = Date.now();
  return {
    id: `chest_fmat_${now}_${Math.random().toString(36).slice(2, 8)}`,
    type: "family_mat",
    family,
    tierIndex,
    tier: ["common","rare","elite","fierce","boss","mythic"][tierIndex - 1] || "common",
    from: source,
    ts: now,
    name: `${name}T${tierIndex}素材箱`,
    icon: "📦",
    color: FAMILY_CHEST_COLORS[(tierIndex - 1) % FAMILY_CHEST_COLORS.length],
  };
}

// 小王素材箱：綁該族該階，開出該族該階「全部」素材（含 normal/miniBoss/boss，2026-07-23 作者拍板）
export function makeMiniBossChest(family, tierIndex, source = "掉落") {
  const name = FAMILY_NAMES[family] || family;
  const now = Date.now();
  return {
    id: `chest_mboss_${now}_${Math.random().toString(36).slice(2, 8)}`,
    type: "mini_boss_mat",
    family,
    tierIndex,
    tier: MONSTER_TIER_ORDER[tierIndex - 1] || "common",
    from: source,
    ts: now,
    name: `${name}小王T${tierIndex}素材箱`,
    icon: "🔶",
    color: "#8b5cf6",
  };
}

// 大王素材箱：綁該族該階，開出該族該階「全部」素材（數量最多）
export function makeBossChest(family, tierIndex, source = "掉落") {
  const name = FAMILY_NAMES[family] || family;
  const now = Date.now();
  return {
    id: `chest_bboss_${now}_${Math.random().toString(36).slice(2, 8)}`,
    type: "boss_mat",
    family,
    tierIndex,
    tier: MONSTER_TIER_ORDER[tierIndex - 1] || "common",
    from: source,
    ts: now,
    name: `${name}大王T${tierIndex}素材箱`,
    icon: "🔴",
    color: "#ef4444",
  };
}

// ── 卡包抽卡（36 隻怪，按稀有度加權）─────────────────────
const CARD_TIER_WEIGHT = { common:50, rare:25, elite:15, fierce:7, boss:2.5, mythic:0.5 };
const CARD_TIER_TOTAL  = Object.values(CARD_TIER_WEIGHT).reduce((a,b) => a+b, 0);

function drawRandomCards(count = 3) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    let r = Math.random() * CARD_TIER_TOTAL;
    let tier = "common";
    for (const [t, w] of Object.entries(CARD_TIER_WEIGHT)) { r -= w; if (r <= 0) { tier = t; break; } }
    const pool = MONSTERS.filter(m => m.tier === tier);
    if (!pool.length) continue;
    const m = pool[Math.floor(Math.random() * pool.length)];
    drawn.push({ monsterId: m.id, name: m.name, icon: m.icon, tier: m.tier, family: m.family });
  }
  return drawn;
}

const WB_RELIC_COIN_RANGE = { min: 400, max: 800 };
const WB_RELIC_MATERIAL_RANGE = { min: 3, max: 7 };

// 世界秘寶箱：金幣 + 世界王專屬材料（卡片改為擊殺當下直接判定，見 worldBossDb.js，不再從這裡掉）
function openWorldBossRelic() {
  const { min, max } = WB_RELIC_COIN_RANGE;
  const coins = min + Math.floor(Math.random() * (max - min + 1));
  const matCount = WB_RELIC_MATERIAL_RANGE.min + Math.floor(Math.random() * (WB_RELIC_MATERIAL_RANGE.max - WB_RELIC_MATERIAL_RANGE.min + 1));
  const wbMaterial = MATERIALS.find(m => m.id === "wb_relic_shard");
  const materials = wbMaterial ? Array.from({ length: matCount }, () => wbMaterial) : [];
  return { coins, materials };
}

// ── 開箱：抽出寶箱內容 ───────────────────────────────────
// 回傳 { materials:[材料物件], potions:[藥劑物件], fragments:[碎片物件], cards:[卡片物件] }
export function openChestContents(chest) {
  // 圖片收集卡包：抽 3 張怪物卡
  if (chest.type === "card_pack") {
    return { materials: [], potions: [], fragments: [], cards: drawRandomCards(3) };
  }

  // 世界秘寶箱：金幣 + 世界王專屬材料
  if (chest.type === "wb_relic") {
    return { potions: [], fragments: [], ...openWorldBossRelic() };
  }

  // 咪咪箱：由 db.js openChest 直接呼叫 openCatBox，這裡只標記類型
  if (chest.type === "mimi_box") {
    return { materials: [], potions: [], fragments: [], isMimiBox: true };
  }

  // 貓貓箱 / cat_box：90% 隨機一種碎片×1，10% 空
  if (chest.type === "cat" || chest.type === "cat_box") {
    if (Math.random() < 0.90) {
      const frag = FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)];
      return { materials: [], potions: [], fragments: [frag] };
    }
    return { materials: [], potions: [], fragments: [] };
  }

  // 藥水箱：必定開出一瓶，按 POTION_CHEST_TABLE 權重抽取
  if (chest.type === "potion") {
    const total = POTION_CHEST_TABLE.reduce((s,p) => s+p.weight, 0);
    let r = Math.random() * total;
    let potionId = POTION_CHEST_TABLE[0].id;
    for (const entry of POTION_CHEST_TABLE) { r -= entry.weight; if (r <= 0) { potionId = entry.id; break; } }
    const potion = getPotion(potionId);
    return { materials: [], potions: potion ? [potion] : [], fragments: [] };
  }

  // ══ 新素材箱（2026-07-22）═══════════════════════════════
  // 族系素材箱：只開出同家族同階級的普通素材
  if (chest.type === "family_mat") {
    const family = chest.family;
    const tierIndex = chest.tierIndex;
    if (!family || !tierIndex || !ALL_FAMILIES.includes(family)) {
      return { materials: [], potions: [], fragments: [] };
    }
    const pool = EXPANSION_MATERIALS.filter(m =>
      m.family === family && m.tierIndex === tierIndex && m.kind === "normal"
    );
    const count = 1 + Math.floor(Math.random() * Math.min(3, pool.length || 1));
    const materials = [];
    for (let i = 0; i < count; i++) {
      if (!pool.length) break;
      materials.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return { materials, potions: [], fragments: [] };
  }

  // 小王/大王素材箱：綁該族該階，開出該族該階「全部」素材（normal+miniBoss+boss 全 kind）。
  // 作者拍板（2026-07-23）：大小王箱開該族全 TX 材料；小王數量略多、大王最多。
  if (chest.type === "mini_boss_mat" || chest.type === "boss_mat") {
    const family = chest.family;
    const tierIndex = chest.tierIndex;
    if (!family || !tierIndex || tierIndex < 1 || !ALL_FAMILIES.includes(family)) {
      return { materials: [], potions: [], fragments: [] };
    }
    const pool = EXPANSION_MATERIALS.filter(m =>
      m.family === family && m.tierIndex === tierIndex
    );
    const count = chest.type === "boss_mat"
      ? 3 + Math.floor(Math.random() * 4)  // 大王 3~6 個
      : 2 + Math.floor(Math.random() * 3); // 小王 2~4 個
    const materials = [];
    for (let i = 0; i < count; i++) {
      if (!pool.length) break;
      materials.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return { materials, potions: [], fragments: [] };
  }

  // ══ 通用材料寶箱（原 wood/iron/gold/epic/mythic，2026-07-23 作者拍板改）══
  // 依「來源怪階級」開出「六大族」該階材料（treasure 寶箱族不含）。
  // kind 依箱等級放寬（EXPANSION_KINDS_BY_CHEST：木/鐵只普通、金/史詩加小王、神話含大王），
  // 每族數量 1~maxPerTier。取代舊的「單一家族分層」開箱。
  const tierCfg = CHEST_TIER_CFG[chest.type];
  if (!tierCfg) return { materials: [], potions: [], fragments: [] };

  const uniTierIndex = Math.max(1, MONSTER_TIER_ORDER.indexOf(chest.tier) + 1);
  const uniKinds = EXPANSION_KINDS_BY_CHEST[chest.type] || new Set(["normal"]);
  const materials = [];
  for (const fam of SIX_FAMILIES) {
    const pool = EXPANSION_MATERIALS.filter(m =>
      m.family === fam && m.tierIndex === uniTierIndex && uniKinds.has(m.kind)
    );
    if (!pool.length) continue;
    const perFam = 1 + Math.floor(Math.random() * tierCfg.maxPerTier);
    for (let i = 0; i < perFam; i++) materials.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  return { materials, potions: [], fragments: [] };
}

// ── 計算戰鬥加成 ────────────────────────────────────────
// 新版支援 carry / throw 兩類藥水：
//   carry -> 回傳 { hpPct, atkPct, defPct } 疊加
//   throw -> 回傳 throwEffects 陣列 + monAtkMult/monDefMult/skipRound
//
// 參數 potionIds: string[] - 該回合使用的藥水 ID 列表
// 回傳 {
//   hpPct: number,      // 攜帶型：HP 恢復 % 總和
//   atkPct: number,     // 攜帶型：ATK +% 總和
//   defPct: number,     // 攜帶型：DEF +% 總和
//   monAtkMult: number, // 投擲型：怪物 ATK 倍率（累乘）
//   monDefMult: number, // 投擲型：怪物 DEF 倍率（累乘）
//   skipRound: string|null, // 投擲型：跳過反擊 "big" | null
//   throwEffects: [],   // 投擲型傷害效果
//   used: [],           // 使用的藥水物件
// }
export function calcPotionBuffs(potionIds) {
  const buffs = {
    hpPct: 0, atkPct: 0, defPct: 0, shieldPct: 0, regenPct: 0, dmgPct: 0, defPenaltyPct: 0,
    monAtkMult: 1, monDefMult: 1,
    skipRound: null,
    throwEffects: [],
    used: [],
  };
  (potionIds || []).forEach(pid => {
    const p = getPotion(pid);
    if (!p) return;
    const e = p.effect || {};
    if (p.kind === "throw") {
      // 投擲型
      const eff = {
        name: p.name, icon: p.icon, effectText: p.effectText,
        dmg:        e.throwDmg    || 0,
        dmgPct:     e.throwPct    || 0,
        dmgMin:     e.throwDmgMin || 0,
        dmgMax:     e.throwDmgMax || 0,
        weaponDmg:  e.weaponDmg   || 0,
        atkDamagePct:e.atkDamagePct || 0,
        dotAtkPct:  e.dotAtkPct || 0,
        dotRounds:  e.dotRounds || 0,
        teamDmgPct: e.teamDmgPct || 0,
        counterReducePct:e.counterReducePct || 0,
        monAtkPct:  e.monAtkPct   || 0,
        monDefPct:  e.monDefPct   || 0,
        skipRound:  e.skipRound   || null,
      };
      buffs.throwEffects.push(eff);
      if (e.monAtkPct) buffs.monAtkMult = Math.max(0.1, buffs.monAtkMult * (1 - e.monAtkPct / 100));
      if (e.monDefPct) buffs.monDefMult = Math.max(0.1, buffs.monDefMult * (1 - e.monDefPct / 100));
      if (e.skipRound) buffs.skipRound = e.skipRound;
    } else {
      // 攜帶型
      if (e.hpPct)  buffs.hpPct  += e.hpPct;
      if (e.atkPct) buffs.atkPct += e.atkPct;
      if (e.defPct) buffs.defPct += e.defPct;
      if (e.shieldPct) buffs.shieldPct = Math.max(buffs.shieldPct, e.shieldPct);
      if (e.regenPct) buffs.regenPct = Math.max(buffs.regenPct, e.regenPct);
      if (e.dmgPct) buffs.dmgPct = Math.max(buffs.dmgPct, e.dmgPct);
      if (e.defPenaltyPct) buffs.defPenaltyPct = Math.max(buffs.defPenaltyPct, e.defPenaltyPct);
    }
    buffs.used.push(p);
  });
  buffs.monAtkMult = Math.max(0.1, buffs.monAtkMult);
  buffs.monDefMult = Math.max(0.1, buffs.monDefMult);
  buffs.hpMult  = 1 + (buffs.hpPct  || 0) / 100;
  buffs.atkMult = 1 + (buffs.atkPct || 0) / 100;
  buffs.defMult = Math.max(0.1, 1 + ((buffs.defPct || 0) - (buffs.defPenaltyPct || 0)) / 100);
  buffs.dmgMult = 1 + (buffs.dmgPct || 0) / 100;
  return buffs;
}
