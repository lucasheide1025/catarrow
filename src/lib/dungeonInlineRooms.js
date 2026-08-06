// src/lib/dungeonInlineRooms.js — 地下城「輕量房」規則層（2026-08-06）
//
// ─────────────────────────────────────────────────────────────
// 為什麼有這支：作者回報「現在的房間每次踩到都要進去選擇，久了會疲乏」。
// 根因不是內容不夠，而是**所有房間的互動重量一致** —— 不論是「+5% ATK 的一般
// 事件」還是「精英戰」，都要開全螢幕舞台、點兩次按鈕才能離開。
//
// 房間因此分成兩級：
//   重量房 Stage Room —— 進全螢幕舞台，有演出、有決策
//     battle / elite_battle / trap / event(特殊) / chest / shop / rest
//   輕量房 Inline Room —— 站上去就結算，格子上浮動文字＋音效，**永不離開地圖**
//     quick_event / empty / coin_pouch / mini_chest / scout
//
// 地圖擴大到兩倍（5×5→7×7、20~23→40~46 格）之後，重量房維持原本的絕對數量，
// 多出來的格子全部給輕量房 —— 探索感變濃，但「要認真應付的房間」反而更少。
//
// ⚠️ **`general_event` 房型已廢除**，全部併進 `quick_event`。
//    一般事件設計上就是「踩到即結算、無選擇」（見 dungeonEventPool.js 檔頭），
//    為它開一個全螢幕舞台是純粹的疲乏來源。廢掉之後「進入事件」只剩下真正
//    要做選擇的特殊事件，那個動作才重新有份量。
//
// 這支是**純函式、零副作用**，單人（DungeonExpedition）與組隊（TeamExpeditionBattle）
// 共用同一份規則。實際寫入由呼叫端負責。
// ─────────────────────────────────────────────────────────────

import { GENERAL_EVENTS } from "./dungeonEventPool";
import { MATERIALS } from "./monsterMaterials";

export const INLINE_ROOM_TYPES = Object.freeze([
  "quick_event", "empty", "coin_pouch", "mini_chest", "scout",
]);

const INLINE_ROOM_TYPE_SET = new Set(INLINE_ROOM_TYPES);

// 舊存檔相容：接線前產生的 activeExpedition / expeditionMapState 可能還有
// type:"general_event" 的房間。視同 quick_event，不可讓它掉進 UI 的 default 分支
// 變成卡死的空白畫面。
export const LEGACY_INLINE_ALIASES = Object.freeze({ general_event: "quick_event" });

export function normalizeInlineRoomType(type) {
  return LEGACY_INLINE_ALIASES[type] || type;
}

export function isInlineRoom(type) {
  return INLINE_ROOM_TYPE_SET.has(normalizeInlineRoomType(type));
}

// 填滿重量房配額之後、剩餘格子的抽取權重
export const INLINE_ROOM_WEIGHTS = Object.freeze([
  { type: "quick_event", weight: 40 },
  { type: "empty",       weight: 25 },
  { type: "coin_pouch",  weight: 20 },
  { type: "mini_chest",  weight: 15 },
  { type: "scout",       weight: 10 },
]);

export const INLINE_ROOM_META = Object.freeze({
  quick_event: { icon: "💬", label: "奇遇" },
  empty:       { icon: "🚪", label: "空房間" },
  coin_pouch:  { icon: "🪙", label: "錢袋" },
  mini_chest:  { icon: "🎁", label: "迷你寶箱" },
  scout:       { icon: "🔭", label: "瞭望點" },
});

// scout 揭開的迷霧半徑（曼哈頓距離）
export const SCOUT_REVEAL_RADIUS = 2;

const COIN_POUCH_RANGE = Object.freeze({ min: 20, max: 60 });
const MINI_CHEST_ARROWDEW_RANGE = Object.freeze({ min: 8, max: 20 });
const MINI_CHEST_POTION_ID = "carry_heal_basic";

// 迷你寶箱的內容比例：素材是主打，藥水與箭露是配角
const MINI_CHEST_MATERIAL_CHANCE = 0.5;   // 0 ~ 0.5
const MINI_CHEST_POTION_CHANCE   = 0.75;  // 0.5 ~ 0.75，其餘給箭露

// 素材階級表，與 dungeonChestLoot.js::CHEST_MATERIAL_TIERS 同源
const MATERIAL_TIERS = Object.freeze(["common", "rare", "elite", "fierce", "boss", "mythic"]);

/**
 * 迷你寶箱的素材階級：**永遠比地下城低一階，最低 T1**。
 *
 * 這是刻意的價值保護 —— 寶箱房（重量房，開全螢幕有稀有度演出）給的是**同階**素材，
 * 是唯一的同階來源。迷你寶箱既然踩到就結算、不用進畫面，就不該搶走寶箱房的定位。
 * 降一階之後它變成「穩定的低階素材補給」，而寶箱房仍是「這一階素材」的唯一途徑。
 *
 *   T1 → T1（已是最低，不再降）
 *   T2 → T1
 *   T3 → T2 …以此類推
 */
export function miniChestMaterialTier(difficultyTier) {
  const tierNumber = Math.min(MATERIAL_TIERS.length, Math.max(1, Number(difficultyTier) || 1));
  return MATERIAL_TIERS[Math.max(0, tierNumber - 2)];
}

// 數量：作者拍板「不用怕給玩家太多」，降一階已經保護了寶箱房的價值。
// 對照組：寶箱房是「同階 × tier 數量」（T3 = 3 個 T3 素材）。
// 這裡是「低一階 × tier+1 數量」（T3 = 4 個 T2 素材）—— 量更多但階級更低。
export function miniChestMaterialQuantity(difficultyTier) {
  return Math.min(MATERIAL_TIERS.length, Math.max(1, Number(difficultyTier) || 1)) + 1;
}

// 一般事件池切兩半：有效果的給 quick_event，純劇情的（effect:{}）給 empty 當文案。
// 那 11 則本來就沒有任何數值（一顆石頭、凝視虛空、牆壁研討會…），
// 拿它們當空房間的台詞，比硬寫「這裡什麼都沒有」有味道，也不必新增文案資產。
const EFFECTIVE_GENERAL_EVENTS = GENERAL_EVENTS.filter(
  event => event.effect && Object.keys(event.effect).length > 0,
);
const FLAVOUR_GENERAL_EVENTS = GENERAL_EVENTS.filter(
  event => !event.effect || Object.keys(event.effect).length === 0,
);

function pickFrom(list, random) {
  if (!list.length) return null;
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

// 一般事件可能有 random 效果池（見 dungeonEventPool 的特殊事件選項）；
// 這裡在回傳前就擲定，讓浮動反饋徽章顯示的數值 = 實際套用的數值
// （applyEventEffect / buildTeamEventResolution 對沒有 random 的 effect 都冪等，安全）。
function resolveRandomEffect(effect = {}, random) {
  if (!Array.isArray(effect.random) || effect.random.length === 0) return { ...effect };
  const index = Math.min(effect.random.length - 1, Math.floor(random() * effect.random.length));
  return { ...(effect.random[index] || {}) };
}

function randomInt(range, random) {
  const span = range.max - range.min;
  return range.min + Math.floor(random() * (span + 1));
}

/**
 * 抽一份迷你寶箱素材（降一階、最低 T1）。該族該階沒有素材就回 null。
 *
 * 刻意用 monsterMaterials.js 的 MATERIALS，與寶箱房（dungeonChestLoot.js）同一份資料 ——
 * 發出打造系統不認得的 id 會變成玩家背包裡的死素材。
 *
 * ⚠️ **第 7 族寶箱族（treasure）沒有素材鏈**，這裡會回 null。
 *    那不是缺漏：寶箱房用的是同一份 MATERIALS，所以它在隱藏地下城（100% 寶箱族）
 *    本來就發不出素材，補償走 calculateExpeditionRewards 的 ×3 金幣／箭露。
 *    迷你寶箱因此退回藥水／箭露，與寶箱房行為一致。
 */
export function rollMiniChestMaterial(family, difficultyTier, random = Math.random) {
  const tier = miniChestMaterialTier(difficultyTier);
  const pool = MATERIALS.filter(material => material.family === family && material.tier === tier);
  const picked = pickFrom(pool, random);
  if (!picked) return null;
  return {
    id: picked.id,
    name: picked.name,
    icon: picked.icon,
    family: picked.family,
    tier: picked.tier,
    quantity: miniChestMaterialQuantity(difficultyTier),
  };
}

export function pickInlineRoomType(random = Math.random) {
  const total = INLINE_ROOM_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of INLINE_ROOM_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return INLINE_ROOM_WEIGHTS[0].type;
}

const signedPercent = value => `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;

// effect → 浮動反饋要顯示的短句。刻意比全螢幕舞台的 badge 更短：
// 這東西會浮在地圖格子上方 1.6 秒，不是可以慢慢讀的面板。
export function formatInlineBadges(effect = {}) {
  const badges = [];
  if (effect.hp)       badges.push(`HP ${signedPercent(effect.hp)}`);
  if (effect.atk)      badges.push(`ATK ${signedPercent(effect.atk)}`);
  if (effect.def)      badges.push(`DEF ${signedPercent(effect.def)}`);
  if (effect.dmg)      badges.push(`傷害 ${signedPercent(effect.dmg)}`);
  if (effect.gold)     badges.push(`${effect.gold > 0 ? "+" : ""}${effect.gold} 🪙`);
  if (effect.arrowDew) badges.push(`+${effect.arrowDew} 箭露`);
  if (effect.item)     badges.push("獲得 回復藥");
  if (effect.material) badges.push(`${effect.material.name} ×${effect.material.quantity}`);
  return badges;
}

/**
 * 踩到一間輕量房 → 這次到底發生什麼事。
 *
 * @param {object} room     地圖房間物件（至少要有 type）
 * @param {object} ctx      { family, difficultyTier, random }
 * @returns {{ roomType:string, effect:object, toast:{icon:string,title:string,desc:string,badges:string[]}, revealRadius:number }}
 *
 * effect 刻意與 GENERAL_EVENTS 的 effect 同構（hp/atk/def/dmg/gold/item），
 * 讓單人的 applyEventEffect() 與組隊的 buildTeamEventResolution() 都能直接吃，
 * 不必為輕量房寫第二套效果套用邏輯。
 * 額外的鍵有兩個，呼叫端要自己接：
 *   `arrowDew` → addArrowdew()      （迷你寶箱）
 *   `material` → addMaterials()     （迷你寶箱，{id,name,icon,family,tier,quantity}）
 * 兩者都要排除 guest/kid（見 memory: 正式資料層用 accountType 排除體驗帳號）。
 */
export function resolveInlineRoom(room, { family = "ghost", difficultyTier = 1, random = Math.random } = {}) {
  const roomType = normalizeInlineRoomType(room?.type);
  const meta = INLINE_ROOM_META[roomType] || INLINE_ROOM_META.empty;
  const base = { roomType, effect: {}, revealRadius: 0 };

  if (roomType === "quick_event") {
    const event = pickFrom(EFFECTIVE_GENERAL_EVENTS, random);
    const effect = resolveRandomEffect(event?.effect || {}, random);
    return {
      ...base,
      effect,
      toast: {
        icon: event?.icon || meta.icon,
        title: event?.title || meta.label,
        desc: event?.desc || "",
        badges: formatInlineBadges(effect),
      },
    };
  }

  if (roomType === "coin_pouch") {
    const gold = randomInt(COIN_POUCH_RANGE, random);
    const effect = { gold };
    return {
      ...base,
      effect,
      toast: { icon: meta.icon, title: "撿到錢袋", desc: "沉甸甸的，裡面叮噹作響。", badges: formatInlineBadges(effect) },
    };
  }

  if (roomType === "mini_chest") {
    const roll = random();
    // 素材優先。抽不到（該族該階沒有素材）就往下走，不讓玩家開到空箱。
    const material = roll < MINI_CHEST_MATERIAL_CHANCE
      ? rollMiniChestMaterial(family, difficultyTier, random)
      : null;
    const effect = material
      ? { material }
      : roll < MINI_CHEST_POTION_CHANCE
        ? { item: MINI_CHEST_POTION_ID }
        : { arrowDew: randomInt(MINI_CHEST_ARROWDEW_RANGE, random) };
    return {
      ...base,
      effect,
      toast: { icon: material?.icon || meta.icon, title: "迷你寶箱", desc: "小小一個，但裡面有東西。", badges: formatInlineBadges(effect) },
    };
  }

  if (roomType === "scout") {
    return {
      ...base,
      revealRadius: SCOUT_REVEAL_RADIUS,
      toast: { icon: meta.icon, title: "瞭望點", desc: "站上高處，附近的路看清楚了。", badges: ["周圍視野展開"] },
    };
  }

  // empty（含未知型別的保底）
  const flavour = pickFrom(FLAVOUR_GENERAL_EVENTS, random);
  return {
    ...base,
    roomType: "empty",
    toast: {
      icon: flavour?.icon || meta.icon,
      title: flavour?.title || meta.label,
      desc: flavour?.desc || "什麼都沒有。",
      badges: [],
    },
  };
}
