// src/lib/expeditionEvents.js — 探險隊 2.0 純邏輯（事件池／路線／投資／士氣／結算）
// 設計來源：docs/second_brain/expedition-v2-spec.md
import { EXPEDITION_MISSIONS } from "./expeditionData";
import { makeFamilyMaterialChest } from "./itemData";
import { makeCoinChest } from "./lootTable";
import { SHOP_GOODS } from "./shopGoodsCatalog";

// ── 投資檔位（六檔，只追加 T1~T5 射手，不使用箭露）────────────
// 頂端刻意遞減：傳說只比奢華多 ~9% 獎勵卻多 20% 射手 → 懲罰不理性梭哈
export const EXPEDITION_INVEST = {
  1: { label: "標準",   emoji: "🎒", archerMult: 1,   mult: 1.0,  desc: "基礎補給，穩穩出發" },
  2: { label: "輕裝",   emoji: "🍱", archerMult: 1.5, mult: 1.12, desc: "追加口糧，獎勵 ×1.12" },
  3: { label: "充裕",   emoji: "🥾", archerMult: 2,   mult: 1.3,  desc: "追加補給，獎勵 ×1.3" },
  4: { label: "奢華",   emoji: "💎", archerMult: 2.5, mult: 1.6,  desc: "奢華補給，獎勵 ×1.6" },
  5: { label: "傳說",   emoji: "🏆", archerMult: 3,   mult: 1.75, desc: "傳說補給，獎勵 ×1.75＋卡包機率提升" },
  6: { label: "神話",   emoji: "👑", archerMult: 4,   mult: 2.0,  desc: "神話補給，獎勵 ×2.0＋保底族系寶箱" },
};

// ── 探險戰利品掉落機率（依任務難度；投資檔位乘倍率，cap 0.95）──
// material=通用材料寶箱  family=指定種族寶箱（純隨機）  coin=金幣寶箱
// cardPack=怪物卡包（極低）  goods=商店武器/裝備/料理（入 village.shop.stock）
export const EXPEDITION_LOOT_RATES = {
  1: { material: 0.20, family: 0.08, coin: 0.10, cardPack: 0.005, goods: 0.15 },
  2: { material: 0.28, family: 0.12, coin: 0.15, cardPack: 0.010, goods: 0.20 },
  3: { material: 0.36, family: 0.16, coin: 0.20, cardPack: 0.015, goods: 0.25 },
  4: { material: 0.44, family: 0.20, coin: 0.25, cardPack: 0.020, goods: 0.30 },
  5: { material: 0.52, family: 0.25, coin: 0.30, cardPack: 0.030, goods: 0.35 },
};

// 探險隊能帶回材料的七族（與打怪擴充素材家族一致）
export const EXPEDITION_FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple", "treasure"];

// 任務難度 → 通用材料寶箱型別 / 怪物階級名稱
const MATERIAL_CHEST_TYPE_BY_TIER = { 1: "wood", 2: "iron", 3: "gold", 4: "epic", 5: "mythic" };
const MONSTER_TIER_NAME = ["common", "rare", "elite", "fierce", "boss", "mythic"];

// 依任務難度＋投資檔位擲探險戰利品
// 回傳 { chests: [寶箱物件], shopGoods: { goodId: count } }；rng 可注入以便測試
export function rollExpeditionLoot(missionTier, investTier = 1, rng = Math.random) {
  const tier = Math.max(1, Math.min(5, Number(missionTier) || 1));
  const invest = EXPEDITION_INVEST[investTier] || EXPEDITION_INVEST[1];
  const rates = EXPEDITION_LOOT_RATES[tier] || EXPEDITION_LOOT_RATES[1];
  const mult = Math.min(2.5, Math.max(1, invest.mult));
  const roll = key => rng() < Math.min(0.95, rates[key] * mult);
  const chests = [];
  const shopGoods = {};
  const now = Date.now();

  // 通用材料寶箱（wood/iron/gold/epic/mythic）
  if (roll("material")) {
    chests.push({
      id: `exp_mat_${now}_${Math.random().toString(36).slice(2, 8)}`,
      type: MATERIAL_CHEST_TYPE_BY_TIER[tier],
      family: null,
      tier: MONSTER_TIER_NAME[tier - 1],
      from: "貓貓探險隊",
      ts: now,
    });
  }
  // 指定種族寶箱（純隨機族＋階）
  if (roll("family")) {
    const family = EXPEDITION_FAMILIES[Math.floor(rng() * EXPEDITION_FAMILIES.length)];
    const tierIndex = 1 + Math.floor(rng() * 6);
    chests.push(makeFamilyMaterialChest(family, tierIndex, "貓貓探險隊"));
  }
  // 金幣寶箱
  if (roll("coin")) {
    chests.push(makeCoinChest(MONSTER_TIER_NAME[tier - 1], "貓貓探險隊"));
  }
  // 怪物卡包（極低機率；傳說/神話額外 +5%）
  const cardPackRate = Math.min(0.95, (rates.cardPack + (investTier >= 5 ? 0.05 : 0)) * mult);
  if (rng() < cardPackRate) {
    chests.push({
      id: `exp_pack_${now}_${Math.random().toString(36).slice(2, 8)}`,
      type: "card_pack",
      family: "special",
      tier: "special",
      from: "貓貓探險隊",
      ts: now,
    });
  }
  // 商店武器/裝備/料理（同難度 tier 的商品，1~2 種 × 1~2 件）
  if (roll("goods")) {
    const pool = SHOP_GOODS.filter(g => g.tier === tier);
    const kinds = 1 + Math.floor(rng() * Math.min(2, pool.length || 1));
    const used = new Set();
    for (let i = 0; i < kinds && pool.length; i++) {
      const good = pool[Math.floor(rng() * pool.length)];
      if (!good || used.has(good.id)) continue;
      used.add(good.id);
      shopGoods[good.id] = 1 + Math.floor(rng() * 2);
    }
  }
  // 神話保底：必定 1 個族系寶箱
  if (investTier === 6) {
    const family = EXPEDITION_FAMILIES[Math.floor(rng() * EXPEDITION_FAMILIES.length)];
    const tierIndex = 1 + Math.floor(rng() * 6);
    chests.push(makeFamilyMaterialChest(family, tierIndex, "貓貓探險隊・神話補給"));
  }
  return { chests, shopGoods };
}

// 各難度的路線事件點（進度比例）
const ROUTE_POINTS = {
  1: [0.3, 0.7],
  2: [0.25, 0.5, 0.75],
  3: [0.25, 0.55, 0.85],
  4: [0.2, 0.45, 0.65, 0.85],
  5: [0.2, 0.45, 0.65, 0.85],
};

// 士氣時間衰減（只對 T3+ 長任務）：每 6 小時 -2，最多扣到底
const MORALE_DECAY_PER_6H = 2;
const MORALE_DECAY_MAX = { 1: 0, 2: 0, 3: 8, 4: 16, 5: 24 };

export const MORALE_MAX = 100;

// ── 事件池（≥10 種；所有選擇都不會虧本）──────────────────────
// 獎勵格式：
//   { key:"material", resource, min, max }      → tier 自動跟隨任務難度
//   { key:"special",  special:"arrowdew"|"gachaToken"|"catBond", min, max }
export const EXPEDITION_EVENTS = [
  {
    id: "old_chest", name: "古老寶箱", emoji: "🎒", minTier: 1,
    desc: "路上發現一個半埋在土裡的古老寶箱，鎖頭已經生鏽。",
    choices: [
      { label: "🔓 撬開寶箱", type: "gamble", rate: 0.7, morale: 2,
        success: [{ key: "material", resource: "fur", min: 2, max: 4 }] },
      { label: "🏷️ 記下位置回村通報", type: "guarantee", morale: 3,
        reward: [{ key: "material", resource: "ore", min: 1, max: 2 }] },
    ],
  },
  {
    id: "stray_cat", name: "受傷小貓", emoji: "🐾", minTier: 1,
    desc: "草叢裡有隻受傷的小貓，用圓圓的眼睛看著你。",
    choices: [
      { label: "🏠 帶回村裡照顧", type: "gamble", rate: 0.65, morale: 3,
        success: [
          { key: "special", special: "catBond", min: 1, max: 2 },
          { key: "material", resource: "fur", min: 1, max: 2 },
        ] },
      { label: "🍞 留下點心後離開", type: "guarantee", morale: 2,
        reward: [{ key: "special", special: "catBond", min: 1, max: 1 }] },
    ],
  },
  {
    id: "forest_fog", name: "迷路森林", emoji: "🌲", minTier: 1,
    desc: "霧越來越濃，眼前出現三條一模一樣的岔路。",
    choices: [
      { label: "🧭 相信直覺前進", type: "gamble", rate: 0.6, morale: 1,
        success: [{ key: "material", resource: "ore", min: 2, max: 4 }] },
      { label: "🛖 原地紮營等霧散", type: "guarantee", morale: 5, reward: [] },
    ],
  },
  {
    id: "storm", name: "暴風雨", emoji: "⚡", minTier: 2,
    desc: "烏雲壓頂，豆大的雨點已經落了下來。",
    choices: [
      { label: "🌪️ 趁亂搜索", type: "gamble", rate: 0.5, morale: 1,
        success: [{ key: "special", special: "arrowdew", min: 10, max: 25 }] },
      { label: "⛺ 躲進岩洞避難", type: "guarantee", morale: 4, reward: [] },
    ],
  },
  {
    id: "mushroom", name: "發光菇叢", emoji: "🍄", minTier: 1,
    desc: "一片發出柔和螢光的菇叢，看起來很特別。",
    choices: [
      { label: "🧺 小心採集", type: "gamble", rate: 0.8, morale: 1,
        success: [{ key: "material", resource: "potion", min: 1, max: 2 }] },
      { label: "📸 拍照留念", type: "guarantee", morale: 3, reward: [] },
    ],
  },
  {
    id: "stream", name: "清澈溪流", emoji: "🐟", minTier: 1,
    desc: "清澈見底的小溪，肥美的魚兒游來游去。",
    choices: [
      { label: "🎣 下水抓魚", type: "gamble", rate: 0.7, morale: 1,
        success: [{ key: "material", resource: "fish", min: 2, max: 4 }] },
      { label: "💧 喝口水休息", type: "guarantee", morale: 3, reward: [] },
    ],
  },
  {
    id: "ruins", name: "古老遺跡", emoji: "🗿", minTier: 3,
    desc: "坍塌的石柱遺跡，牆上刻著不明的符文。",
    choices: [
      { label: "🔥 深入探索", type: "gamble", rate: 0.6, morale: 2,
        success: [
          { key: "material", resource: "ore", min: 2, max: 3 },
          { key: "material", resource: "potion", min: 1, max: 1 },
        ] },
      { label: "📜 描繪符文地圖", type: "guarantee", morale: 2,
        reward: [{ key: "material", resource: "ore", min: 1, max: 2 }] },
    ],
  },
  {
    id: "hunter_hut", name: "獵人小屋", emoji: "🏠", minTier: 2,
    desc: "林間小屋門口，獵人正低頭處理今天的獵物。",
    choices: [
      { label: "🤝 請教狩獵技巧", type: "gamble", rate: 0.7, morale: 2,
        success: [{ key: "material", resource: "meat", min: 2, max: 4 }] },
      { label: "🙏 道謝離開", type: "guarantee", morale: 3, reward: [] },
    ],
  },
  {
    id: "meteor", name: "流星雨", emoji: "🌠", minTier: 2,
    desc: "夜空劃過絢麗的流星雨，傳說許願會實現。",
    choices: [
      { label: "🙏 對流星許願", type: "gamble", rate: 0.5, morale: 1,
        success: [{ key: "special", special: "gachaToken", min: 1, max: 1 }] },
      { label: "✨ 靜靜欣賞美景", type: "guarantee", morale: 4, reward: [] },
    ],
  },
  {
    id: "butterfly", name: "稀有蝴蝶", emoji: "🦋", minTier: 2,
    desc: "一隻散發七彩光芒的蝴蝶，正停在花上歇息。",
    choices: [
      { label: "🪤 悄悄追捕", type: "gamble", rate: 0.6, morale: 1,
        success: [{ key: "material", resource: "fur", min: 2, max: 3 }] },
      { label: "🌼 靜靜觀察", type: "guarantee", morale: 3,
        reward: [{ key: "special", special: "catBond", min: 1, max: 1 }] },
    ],
  },
  {
    id: "cliff", name: "陡峭山崖", emoji: "🏔️", minTier: 3,
    desc: "前方是陡峭山崖，崖壁上閃爍著礦石的光澤。",
    choices: [
      { label: "🧗 冒險攀爬", type: "gamble", rate: 0.65, morale: 1,
        success: [{ key: "material", resource: "ore", min: 3, max: 5 }] },
      { label: "↩️ 繞路而行", type: "guarantee", morale: 3, reward: [] },
    ],
  },
  {
    id: "merchant", name: "流浪商人", emoji: "🎪", minTier: 1,
    desc: "一位揹著大包袱的流浪商人，笑著向你招手。",
    choices: [
      { label: "🗣️ 聽他講冒險故事", type: "gamble", rate: 0.7, morale: 2,
        success: [{ key: "special", special: "arrowdew", min: 5, max: 15 }] },
      { label: "👋 微笑婉拒", type: "guarantee", morale: 2, reward: [] },
    ],
  },
];

// ── 路線生成 ────────────────────────────────────────────────
// 依難度抽事件（minTier 過濾、同趟不重複），綁定進度檢查點
export function generateExpeditionRoute(tier) {
  const points = ROUTE_POINTS[tier] || ROUTE_POINTS[1];
  const pool = EXPEDITION_EVENTS.filter(ev => ev.minTier <= tier);
  // Fisher–Yates shuffle（可注入 rng 以便測試）
  const rng = arguments.length > 1 ? arguments[1] : Math.random;
  const picked = [];
  const bag = [...pool];
  for (let i = 0; i < points.length && bag.length; i++) {
    const idx = Math.floor(rng() * bag.length);
    picked.push(bag.splice(idx, 1)[0].id);
  }
  return points.map((at, i) => ({
    id: picked[i] || null,
    at,
    resolved: null,
  }));
}

export function getExpeditionEventById(id) {
  return EXPEDITION_EVENTS.find(ev => ev.id === id) || null;
}

// 該難度會抽幾個事件
const EVENT_COUNT_MAP = Object.fromEntries(
  Object.entries(ROUTE_POINTS).map(([tier, pts]) => [tier, pts.length])
);
export function eventCountForTier(tier) {
  return EVENT_COUNT_MAP[tier] || 2;
}

// ── 事件選擇判定（不虧本：失敗＝無獎勵，絕不扣任何東西）──────
function buildEventRewards(entries, missionTier) {
  const out = {};
  for (const entry of entries) {
    const raw = entry.min + Math.random() * (entry.max - entry.min + 1);
    const count = Math.max(1, Math.round(raw));
    if (entry.key === "material") {
      const tier = Math.max(1, Math.min(5, missionTier));
      out[`${entry.resource}_t${tier}`] = (out[`${entry.resource}_t${tier}`] || 0) + count;
    } else {
      out[entry.special] = (out[entry.special] || 0) + count;
    }
  }
  return out;
}

// 回傳 { choice, success, rewards, moraleDelta }
export function resolveExpeditionEventChoice(event, choiceIdx, missionTier) {
  const choice = event?.choices?.[choiceIdx];
  if (!choice) return { choice: null, success: false, rewards: {}, moraleDelta: 0 };
  if (choice.type === "gamble") {
    const success = Math.random() < choice.rate;
    return {
      choice: choiceIdx,
      success,
      rewards: success ? buildEventRewards(choice.success, missionTier) : {},
      moraleDelta: success ? (choice.morale || 0) : 0,
    };
  }
  return {
    choice: choiceIdx,
    success: true,
    rewards: buildEventRewards(choice.reward || [], missionTier),
    moraleDelta: choice.morale || 0,
  };
}

// 已解事件總獎勵（供結算聚合）
export function sumResolvedEventRewards(resolvedEvents = []) {
  const out = {};
  for (const r of resolvedEvents) {
    if (!r?.rewards) continue;
    for (const [key, count] of Object.entries(r.rewards)) {
      out[key] = (out[key] || 0) + (Number(count) || 0);
    }
  }
  return out;
}

// ── 士氣 ────────────────────────────────────────────────────
// 時間衰減（T3+ 長任務才會有）：elapsedHours 以任務實際經過小時計
export function calcMoraleDecay(tier, elapsedHours) {
  const max = MORALE_DECAY_MAX[tier] || 0;
  if (max <= 0) return 0;
  return Math.min(max, Math.floor(elapsedHours / 6) * MORALE_DECAY_PER_6H);
}

export function moraleMultiplier(morale) {
  const m = Math.max(0, Math.min(MORALE_MAX, morale));
  return 1 + (m / MORALE_MAX) * 0.2; // ×1.0 ~ ×1.2，基礎獎勵永不縮水
}

// ── 結算聚合 ────────────────────────────────────────────────
// base = calcExpeditionRewards 的基礎獎勵；eventResolved 為已解事件物件陣列
// missionTier 用於擲探險戰利品（寶箱／卡包／商店商品），併入 final.chests / final.shopGoods
export function aggregateExpeditionRewards(base, eventResolved, investTier, morale, missionTier) {
  const invest = EXPEDITION_INVEST[investTier] || EXPEDITION_INVEST[1];
  const eventBonus = sumResolvedEventRewards(eventResolved);
  const moraleMult = moraleMultiplier(morale);
  const final = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(eventBonus)]);
  for (const key of keys) {
    const raw = (Number(base[key]) || 0) + (Number(eventBonus[key]) || 0);
    if (raw <= 0) continue;
    final[key] = Math.round(raw * invest.mult * moraleMult);
    if (key === "catXP") final[key] = Math.min(800, final[key]);
  }
  // 探險戰利品（寶箱／卡包／商店商品）
  const loot = rollExpeditionLoot(missionTier, investTier);
  if (loot.chests.length) final.chests = loot.chests;
  if (Object.keys(loot.shopGoods).length) final.shopGoods = loot.shopGoods;
  return final;
}

// 投資的追加花費（在基本射手花費之上，六檔皆不使用箭露）：
// 回傳 { arrowdew: 0, archerCost }，archerCost 是「追加」的各階射手數
export function calcInvestCost(baseArcherCost, investTier) {
  const invest = EXPEDITION_INVEST[investTier] || EXPEDITION_INVEST[1];
  if (investTier === 1) return { arrowdew: 0, archerCost: {} };
  const archerCost = {};
  for (const [key, need] of Object.entries(baseArcherCost || {})) {
    const extra = Math.ceil((Number(need) || 0) * (invest.archerMult - 1));
    if (extra > 0) archerCost[key] = extra;
  }
  return { arrowdew: 0, archerCost };
}

// 投資後總射手花費（含基本）＝基本 × 倍率（進位）
export function totalArcherCost(baseArcherCost, investTier) {
  const invest = EXPEDITION_INVEST[investTier] || EXPEDITION_INVEST[1];
  const out = {};
  for (const [key, need] of Object.entries(baseArcherCost || {})) {
    out[key] = Math.ceil((Number(need) || 0) * invest.archerMult);
  }
  return out;
}
