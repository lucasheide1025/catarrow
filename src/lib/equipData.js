// src/lib/equipData.js — 裝備品項定義（真實品牌）
// 每個欄位有多種品牌選擇，外觀不同但同品級加成相同
// 玩家裝備存在 member.equipment[slotId] = { itemId, grade, plusLevel }
//   grade: "common"|"rare"|"elite"|"epic"|"legend"|"mythic"
//   plusLevel: 0~4（+5 時升一個品級，重置為 0）

// ── 升級材料需求表 ───────────────────────────────────────────
// 只保留金幣費用；材料需求改由 generateRandomMats() 動態產生並存入 Firestore
export const EQUIP_UPGRADE_COST = {
  common: { gold: 100  },
  rare:   { gold: 300  },
  elite:  { gold: 800  },
  epic:   { gold: 2000 },
  legend: { gold: 5000 },
};

// ── 隨機材料生成 ─────────────────────────────────────────────
// 升級完成後呼叫，產生下一次的材料需求（六族隨機交叉）
// 結果存入 member.rpgEquip[slotId].nextMats，確保同一次升級材料不變
const _FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple"];
const _GRADE_MAT_TIER = {
  common: { main: "m1", key: "m2" },
  rare:   { main: "m2", key: "m3" },
  elite:  { main: "m3", key: "m4" },
  epic:   { main: "m4", key: "m5" },
  legend: { main: "m5", key: "m6" },
};

export function generateRandomMats(grade) {
  const tiers = _GRADE_MAT_TIER[grade];
  if (!tiers) return null;
  const shuffled = [..._FAMILIES].sort(() => Math.random() - 0.5);
  return {
    materials: [
      { id: `${shuffled[0]}_${tiers.main}`, count: 3 },
      { id: `${shuffled[1]}_${tiers.main}`, count: 2 },
    ],
    keyItem: { id: `${shuffled[2]}_${tiers.key}`, count: 1, note: "升級關鍵素材" },
  };
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
