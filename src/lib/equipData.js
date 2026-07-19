import { EXPANSION_MATERIALS } from "./monsterExpansionCatalog";
import { isMonsterExpansionEnabled } from "./monsterExpansionFeature";

// src/lib/equipData.js — 裝備品項定義（真實品牌）
// 每個欄位有多種品牌選擇，外觀不同但同品級加成相同
// 玩家裝備存在 member.equipment[slotId] = { itemId, grade, plusLevel }
//   grade: "common"|"rare"|"elite"|"epic"|"legend"|"mythic"
//   plusLevel: 0~4（+5 時升一個品級，重置為 0）

// ── 升級材料需求表 ───────────────────────────────────────────
// 只保留金幣費用；材料需求改由 generateRandomMats() 動態產生並存入 Firestore
// 金幣費用（2026-07-11 在曲線基礎上整體 +30%，抑制升級速度）
// 傳說/神話金幣依 economy-loot-catalog §6「現有裝備精煉新增門檻」提高（2026-07-19）
export const EQUIP_UPGRADE_COST = {
  common: { gold: 130   },
  rare:   { gold: 390   },
  elite:  { gold: 1040  },
  epic:   { gold: 2600  },
  legend: { gold: 12000 },
  mythic: { gold: 30000 },
};

// 稀有+4突破到精英起，品階突破必須消耗王房取得的王之印記。
export const KING_SEAL_BREAKTHROUGH_COST = {
  elite: 1, epic: 3, legend: 6, mythic: 10,
};

// ── 隨機材料生成 ─────────────────────────────────────────────
// 升級完成後呼叫，產生下一次的材料需求（六族隨機交叉）
// 結果存入 member.rpgEquip[slotId].nextMats，確保同一次升級材料不變
// 擴充關閉時的後備材料池（舊的六族 × 六階 = 36 種）
const _FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];

// 每個品級吃「該階 / 下一階 / 再下一階」三個 tier 的材料，值是 tierIndex（1~6）。
// 傳說的再下一階（T7）與神話的下一階都不存在（T7~T9 只顯示不實裝），故留 null，
// 對應的 kinds 也設為 0 —— 神話改成吃滿該階材料來維持重量。
const _GRADE_MAT_TIER = {
  common: { main: 1, next: null, next2: null },
  rare:   { main: 2, next: 3,    next2: 4 },
  elite:  { main: 3, next: 4,    next2: 5 },
  epic:   { main: 4, next: 5,    next2: 6 },
  legend: { main: 5, next: 6,    next2: null },
  mythic: { main: 6, next: null, next2: null },
};

// 某個 tier 可用的一般材料 id 池。
// 擴充開啟時走完整清冊：7 族 × 每族每階 3 種 = 每階 21 種可選。
// 舊寫法是寫死 `${family}_m${tier}`，只認得六族各 1 種（全清冊 252 種裡只用到 36 種），
// 導致寶藏族整族、以及每族每階另外 2 種材料玩家打得到卻永遠用不掉。
function normalMaterialPool(tierIndex, expansionEnabled, expansionMaterials) {
  if (expansionEnabled) {
    const pool = expansionMaterials
      .filter(material => material.kind === "normal" && material.tierIndex === tierIndex)
      .map(material => material.id);
    if (pool.length) return pool;
  }
  // 後備：擴充關閉（或清冊缺該階）時退回舊的六族材料，避免產生玩家拿不到的 id
  return _FAMILIES.map(family => `${family}_m${tierIndex}`);
}

// 從材料池挑出「玩家持有最多」的那一種。完全沒有庫存時回 null（交回純隨機）。
// 同樣持有量時隨機挑一個，避免每次都固定同一種、看起來像壞掉。
function pickMostHeldId(pool, inventory) {
  if (!inventory) return null;
  let best = 0;
  let ties = [];
  for (const id of pool) {
    const owned = Math.max(0, Number(inventory[id]) || 0);
    if (owned <= 0) continue;
    if (owned > best) { best = owned; ties = [id]; }
    else if (owned === best) ties.push(id);
  }
  if (!ties.length) return null;
  return ties[Math.floor(Math.random() * ties.length)];
}

// 升級材料需求：同一品級內隨 plusLevel 遞增（曲線），避免「+0 跟 +4 一樣便宜」秒升。
// 掉落率刻意不動（保留打怪掉寶的即時回饋，學生多巴胺），改用墊高「消耗」來拉長升級節奏。
// 每個 plusLevel 的三種材料數量：mainA=主族、mainB=副族（同 tier）、key=關鍵素材（高一階 tier）。
// 2026-07-12：在前一版曲線上增加 50%，零碎數量無條件進位。
// 2026-07-19 改版：材料需求改為「依品級分級」，不再所有品級共用同一張表。
// 舊版每個品級都要 284 個材料 —— 普通裝跟神話裝一樣重，只有金幣差 230 倍，
// 對新學生太硬、對老玩家太鬆。新規格（使用者拍板）：
//   普通    2 種該階，無下一階，突破到稀有不需突破材料      → 合計 122
//   稀有    3 種該階 + 2 種下一階，+3 起再加 1 種再下一階   → 合計 228
//   精英以上 4 種該階 + 3 種下一階 + 1 種再下一階            → 合計 313
//   傳說/神話 因為 T7 未實裝而遞減種類，神話改吃滿六族      → 304 / 366
const _GRADE_MAT_KINDS = {
  common: { current: 2, next: 0, next2: 0 },
  rare:   { current: 3, next: 2, next2: 1 },
  elite:  { current: 4, next: 3, next2: 1 },
  epic:   { current: 4, next: 3, next2: 1 },
  legend: { current: 4, next: 3, next2: 0 },
  mythic: { current: 6, next: 0, next2: 0 },
};

// 稀有的「再下一階」只在 +3 以上才要求（使用者指定的門檻）
const _NEXT2_MIN_PLUS = { rare: 3 };

export function matKindsFor(grade, plusLevel = 0) {
  const kinds = _GRADE_MAT_KINDS[grade];
  if (!kinds) return null;
  const tiers = _GRADE_MAT_TIER[grade];
  const level = Math.max(0, Math.min(4, plusLevel || 0));
  const minPlus = _NEXT2_MIN_PLUS[grade] || 0;
  return {
    current: kinds.current,
    // tier 不存在就沒得要求，避免產生玩家無從取得的材料 id
    next:  tiers?.next  ? kinds.next : 0,
    next2: tiers?.next2 && level >= minPlus ? kinds.next2 : 0,
  };
}

// 每一「種」材料要幾個，隨 plusLevel 遞增
const _PLUS_MAT_COUNTS = {
  0: { current: 6,  next: 2, next2: 1 },
  1: { current: 8,  next: 3, next2: 1 },
  2: { current: 12, next: 4, next2: 2 },
  3: { current: 15, next: 5, next2: 2 },
  4: { current: 20, next: 6, next2: 3 },
};

export function matCountsFor(plusLevel) {
  return _PLUS_MAT_COUNTS[Math.max(0, Math.min(4, plusLevel || 0))];
}

// 已存的 nextMats 數量是否符合「目前這條曲線」。用來偵測舊格式（舊的固定 3/2/1）並觸發重算。
// 只比對數量不比對家族——家族本來就隨機、不該當作判斷依據。
// 判斷已存的 nextMats 是否符合「目前這條曲線」。不符就會重算並存回（等同自動重置舊需求清單）。
// 新格式：materials 內含 4 種該階 + 2 種下一階（下一階以 tierRole:"next" 標記），不再使用 keyItem。
export function isMatsCurveCurrent(nextMats, grade, plusLevel) {
  const mats = nextMats?.materials;
  if (!Array.isArray(mats)) return false;
  if (nextMats?.keyItem) return false; // 舊格式（materials + keyItem）→ 一律重算
  const kinds = matKindsFor(grade, plusLevel);
  if (!kinds) return false;
  // 新格式每一筆都標了 tierRole（王素材是 "boss"，不列入種類檢查）。
  // 沒標的是舊資料 → 直接判定為過期，讓它重算收斂。
  if (mats.some(m => !m?.tierRole)) return false;
  const byRole = role => mats.filter(m => m.tierRole === role);
  const groups = { current: byRole("current"), next: byRole("next"), next2: byRole("next2") };
  const c = matCountsFor(plusLevel);
  return ["current", "next", "next2"].every(role =>
    groups[role].length === kinds[role] && groups[role].every(m => m.count === c[role]),
  );
}

// ── 高階精煉的王素材門檻（economy-loot-catalog §6，2026-07-19）──────────
// 史詩+4→傳說0：小王×1；傳說 0→1/1→2/2→3/3→4：小王 1/1/2/2；
// 傳說+4→神話0：大王×1；神話 0→1/1→2/2→3/3→4：大王 1/1/2/2。
// 素材 Tier 取「目前品級」對應階（epic=T4、legend=T5、mythic=T6），與 _GRADE_MAT_TIER 一致。
const _GRADE_TIER_INDEX = { common:1, rare:2, elite:3, epic:4, legend:5, mythic:6 };

export function bossMatRequirementFor(grade, plusLevel = 0) {
  const level = Math.max(0, Math.min(4, plusLevel || 0));
  if (grade === "epic")   return level === 4 ? { kind:"miniBoss", count:1 } : null;
  if (grade === "legend") return level === 4 ? { kind:"boss", count:1 }
    : { kind:"miniBoss", count:[1, 1, 2, 2][level] };
  if (grade === "mythic") return level === 4 ? null // 神話+4 已是頂點，無下一階
    : { kind:"boss", count:[1, 1, 2, 2][level] };
  return null;
}

// 從擴充素材清冊挑一個符合 階級/種類 的王素材；挑不到回傳 null（呼叫端會略過）。
// 不再先鎖定家族再挑 —— 舊寫法先從六族抽一族，寶藏族的王素材永遠不會被選中。
function pickBossMaterialId(tierIndex, kind, expansionMaterials) {
  const pool = expansionMaterials.filter(material =>
    material.tierIndex === tierIndex && material.kind === kind,
  );
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export function generateRandomMats(grade, plusLevel = 0, options = {}) {
  const tiers = _GRADE_MAT_TIER[grade];
  if (!tiers) return null;
  const c = matCountsFor(plusLevel);
  const kinds = matKindsFor(grade, plusLevel);
  if (!kinds) return null;

  // 預設值直接取真實模組，呼叫端不必傳（漏傳會讓功能靜默失效）；options 只給測試覆寫用。
  // inventory：玩家目前的材料庫存 { materialId: 數量 }，用來保底（見下方）。
  const {
    expansionEnabled = isMonsterExpansionEnabled(),
    expansionMaterials = EXPANSION_MATERIALS,
    inventory = null,
  } = options;

  // ⚠️ 每個 tier 各自從自己的池子洗牌抽，不能共用同一份洗好的清單再切片：
  // 精英以上要 4+3+1 = 8 種。不同 tier 的材料 id 本來就不同，跨 tier 不會撞 id。
  //
  // guarantee：該階材料改用「保底」抽法（使用者指定）。每階有 21 種候選但一次只要 4 種，
  // 純隨機常常整組都是玩家手上沒有的，進度感直接歸零。因此固定讓第一種是玩家
  // 「持有最多」的材料，剩下的才隨機——至少永遠有一格看得到進度。
  const pickIds = (tierIndex, n, guarantee = false) => {
    const pool = normalMaterialPool(tierIndex, expansionEnabled, expansionMaterials);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const mostHeld = guarantee ? pickMostHeldId(pool, inventory) : null;
    if (!mostHeld) return shuffled.slice(0, n);
    // 保底那一種要從隨機清單剔除，否則會出現重複 id
    return [mostHeld, ...shuffled.filter(id => id !== mostHeld)].slice(0, n);
  };

  const roleSpecs = [
    { role: "current", tier: tiers.main,  kinds: kinds.current, count: c.current, note: null, guarantee: true },
    { role: "next",    tier: tiers.next,  kinds: kinds.next,    count: c.next,    note: "下一階素材" },
    { role: "next2",   tier: tiers.next2, kinds: kinds.next2,   count: c.next2,   note: "再下一階素材" },
  ];
  const materials = roleSpecs.flatMap(spec => {
    if (!spec.tier || spec.kinds <= 0) return [];
    return pickIds(spec.tier, spec.kinds, spec.guarantee).map(id => ({
      id,
      count: spec.count,
      tierRole: spec.role,
      ...(spec.note ? { note: spec.note } : {}),
    }));
  });

  // 王素材門檻只在擴充開啟時加入：王素材唯一來源是地下城王房（同一個 flag 之後），
  // 若在 flag 關閉時就要求，玩家將無從取得，高階精煉會直接卡死。
  if (expansionEnabled) {
    const requirement = bossMatRequirementFor(grade, plusLevel);
    if (requirement) {
      const bossId = pickBossMaterialId(_GRADE_TIER_INDEX[grade], requirement.kind, expansionMaterials);
      if (bossId) {
        materials.push({
          id: bossId,
          count: requirement.count,
          tierRole: "boss",
          note: requirement.kind === "boss" ? "大王素材" : "小王素材",
        });
      }
    }
  }

  // keyItem 停用（下一階素材已併入 materials）；保留欄位為 null 讓舊呼叫端不會壞。
  return { materials, keyItem: null };
}

// ── 裝備品項資料表 ───────────────────────────────────────────
// 同一個 slotId 的品項效果相同，玩家選自己喜歡的品牌
export const EQUIP_ITEMS = {

  // ─ 弓（ATK）───────────────────────────────────────────────
  bow: [
    {
      id: "bow_hoyt",
      name: "Hoyt Formula XI",
      brand: "Hoyt",
      icon: "🏹",
      desc: "美國 Hoyt 旗艦反曲弓把手，穩定性一流。",
    },
    {
      id: "bow_winwin",
      name: "Win&Win WIAWIS ATF",
      brand: "Win&Win",
      icon: "🏹",
      desc: "韓國 Win&Win 頂級碳纖維把手，輕量高剛性。",
    },
    {
      id: "bow_sf",
      name: "SF Archery Forged+",
      brand: "SF Archery",
      icon: "🏹",
      desc: "韓國 SF 鍛造鋁合金把手，入門到競技的首選。",
    },
    {
      id: "bow_mybo",
      name: "Mybo Era",
      brand: "Mybo",
      icon: "🏹",
      desc: "英國 Mybo 新世代競技把手，人體工學設計。",
    },
  ],

  // ─ 箭（ATK）────────────────────────────────────────────────
  arrow: [
    {
      id: "arr_easton_x10",
      name: "Easton X10",
      brand: "Easton",
      icon: "🪃",
      desc: "奧運金牌常客，Easton 旗艦競技碳箭。",
    },
    {
      id: "arr_easton_ace",
      name: "Easton ACE",
      brand: "Easton",
      icon: "🪃",
      desc: "Easton 進階碳箭，精準度優異的訓練利器。",
    },
    {
      id: "arr_goldtip",
      name: "Gold Tip Platinum Pierce",
      brand: "Gold Tip",
      icon: "🪃",
      desc: "美國 Gold Tip 旗艦競技碳箭，超小直徑設計。",
    },
    {
      id: "arr_skylon",
      name: "Skylon Brixy",
      brand: "Skylon",
      icon: "🪃",
      desc: "歐洲品牌 Skylon，兼顧精準與耐用。",
    },
  ],

  // ─ 箭震吸收器（ATK）────────────────────────────────────────
  absorber: [
    {
      id: "abs_spigarelli",
      name: "Spigarelli Anti-Vibration",
      brand: "Spigarelli",
      icon: "🔧",
      desc: "義大利 Spigarelli 品牌，減震效果業界頂尖。",
    },
    {
      id: "abs_shibuya",
      name: "Shibuya Ultima RC",
      brand: "Shibuya",
      icon: "🔧",
      desc: "日本 Shibuya 精密製造，傳遞穩定感受。",
    },
    {
      id: "abs_cartel",
      name: "Cartel Midas ABS",
      brand: "Cartel",
      icon: "🔧",
      desc: "韓國 Cartel 高CP值減震器，適合訓練使用。",
    },
  ],

  // ─ 配件模組（ATK）──────────────────────────────────────────
  module: [
    {
      id: "mod_beiter",
      name: "Beiter Clicker",
      brand: "Beiter",
      icon: "⚙️",
      desc: "德國 Beiter 精密拉距器，一致性的重要工具。",
    },
    {
      id: "mod_cavalier",
      name: "Cavalier Elite Button",
      brand: "Cavalier",
      icon: "⚙️",
      desc: "英國 Cavalier 彈性調整箭壓鈕，細膩調整。",
    },
    {
      id: "mod_wiawis",
      name: "WIAWIS AMB Sight",
      brand: "Win&Win",
      icon: "⚙️",
      desc: "Win&Win 高階瞄準器，精確的風偏調整系統。",
    },
  ],

  // ─ 護胸（DEF）──────────────────────────────────────────────
  chest: [
    {
      id: "chest_fivics",
      name: "Fivics Tachyon Chest Guard",
      brand: "Fivics",
      icon: "🦺",
      desc: "韓國 Fivics 競技護胸，輕薄全包覆設計。",
    },
    {
      id: "chest_cartel",
      name: "Cartel CX-500 Chest Guard",
      brand: "Cartel",
      icon: "🦺",
      desc: "Cartel 護胸，透氣網眼材質，長時間訓練首選。",
    },
    {
      id: "chest_shibuya",
      name: "Shibuya Duet Chest Guard",
      brand: "Shibuya",
      icon: "🦺",
      desc: "Shibuya 日本製護胸，貼合身形設計。",
    },
  ],

  // ─ 護臂（DEF）──────────────────────────────────────────────
  arm: [
    {
      id: "arm_fivics",
      name: "Fivics Tachyon Arm Guard",
      brand: "Fivics",
      icon: "🛡️",
      desc: "Fivics 輕量護臂，不影響射箭動作的極薄設計。",
    },
    {
      id: "arm_beiter",
      name: "Beiter Arm Guard",
      brand: "Beiter",
      icon: "🛡️",
      desc: "德國 Beiter 精工護臂，三點固定超穩固。",
    },
    {
      id: "arm_cartel",
      name: "Cartel Arm Guard Short",
      brand: "Cartel",
      icon: "🛡️",
      desc: "Cartel 短型護臂，適合長袖衣物搭配使用。",
    },
  ],

  // ─ 手部（DEF）──────────────────────────────────────────────
  hand: [
    {
      id: "hand_shibuya",
      name: "Shibuya Ultima Tab",
      brand: "Shibuya",
      icon: "🧤",
      desc: "Shibuya 旗艦指墊，多層皮革完美觸感。",
    },
    {
      id: "hand_beiter",
      name: "Beiter Finger Tab",
      brand: "Beiter",
      icon: "🧤",
      desc: "德國 Beiter 競技指墊，獨特磁力扣設計。",
    },
    {
      id: "hand_aae",
      name: "AAE Elite Tab",
      brand: "AAE",
      icon: "🧤",
      desc: "美國 AAE 競技指墊，優質牛皮製成。",
    },
  ],

  // ─ 營養品（HP）─────────────────────────────────────────────
  nutrition: [
    {
      id: "nut_powerbar",
      name: "PowerBar Performance Bar",
      brand: "PowerBar",
      icon: "🍎",
      desc: "運動員指定補給，持久能量的最佳選擇。",
    },
    {
      id: "nut_gu",
      name: "GU Energy Gel",
      brand: "GU",
      icon: "🍎",
      desc: "比賽前 15 分鐘補充，快速提升專注力。",
    },
    {
      id: "nut_clif",
      name: "Clif Shot Bloks",
      brand: "Clif",
      icon: "🍎",
      desc: "馬拉松運動員愛用，持久穩定的能量補給。",
    },
  ],

  // ─ 箭袋（HP）───────────────────────────────────────────────
  quiver: [
    {
      id: "quiver_fivics",
      name: "Fivics Tachyon Hip Quiver",
      brand: "Fivics",
      icon: "🎒",
      desc: "Fivics 腰掛箭袋，多隔層設計，容量超大。",
    },
    {
      id: "quiver_avalon",
      name: "Avalon Tec X Quiver",
      brand: "Avalon",
      icon: "🎒",
      desc: "Avalon 競技箭袋，快取設計讓連射更流暢。",
    },
    {
      id: "quiver_cartel",
      name: "Cartel Quiver Pro",
      brand: "Cartel",
      icon: "🎒",
      desc: "Cartel 標準型箭袋，耐用防水，入門首選。",
    },
  ],

  // ─ 工具包（HP）─────────────────────────────────────────────
  toolkit: [
    {
      id: "tool_avalon",
      name: "Avalon Tool Kit Pro",
      brand: "Avalon",
      icon: "🧰",
      desc: "Avalon 完整工具組，含六角扳手、調弦器、潤滑油。",
    },
    {
      id: "tool_cartel",
      name: "Cartel Field Tool Set",
      brand: "Cartel",
      icon: "🧰",
      desc: "Cartel 野外修復組，輕巧攜帶，比賽急救必備。",
    },
    {
      id: "tool_fivics",
      name: "Fivics Maintenance Kit",
      brand: "Fivics",
      icon: "🧰",
      desc: "Fivics 精密保養套組，含防鏽保養液。",
    },
  ],
};

// 取得指定欄位的所有品項
export function getItemsForSlot(slotId) {
  return EQUIP_ITEMS[slotId] || [];
}

// 以 itemId 查詢品項資料
export function getEquipItem(itemId) {
  for (const items of Object.values(EQUIP_ITEMS)) {
    const found = items.find(i => i.id === itemId);
    if (found) return found;
  }
  return null;
}

import { EQUIP_GRADES } from "./constants";

// 品級前綴（顯示用）
export const GRADE_PREFIX = {
  common: "【普通】",
  rare:   "【稀有】",
  elite:  "【精英】",
  epic:   "【史詩】",
  legend: "【傳說】",
  mythic: "【神話】",
};

// 計算單一欄位的品級 index（+1 = ATK/DEF 加成，+5 = HP 加成）
export function gradeBonus(gradeId) {
  const idx = EQUIP_GRADES.findIndex(g => g.id === gradeId);
  return idx < 0 ? 0 : idx + 1;
}
