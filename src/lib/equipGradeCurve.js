// src/lib/equipGradeCurve.js
// T7~T9 預覽品級（2026-07-19）
//
// ⚠️ 這裡「只放顯示用的品級定義」，不碰任何加成公式。
// 加成一律走 constants.js 的 getEquipSlotBonus：(品級index × 5 + 1) + plusLevel，HP ×5。
// 曾經想改成凸曲線讓突破更有手感，但那會把神話+4 從 30 拉到 59、ATK 四格合計
// 120 → 236，而怪物防禦最高才 200 出頭 —— 直接壓垮既有戰鬥平衡，因此撤回。
// 要調難度請改 equipData.js 的「材料需求」曲線，不要動這裡的數值。
//
// 上古/天啟/永恆刻意不放進 EQUIP_GRADES：upgradeEquipSlot 的 isMaxGrade 是用
// EQUIP_GRADES.length - 1 判斷，放進去玩家就會真的升上未實裝的品級。

// 顯示用的品級 index，接在神話（index 5）後面
export const PREVIEW_GRADE_INDEX = Object.freeze({
  ancient: 6, apocalypse: 7, eternal: 8,
});

export const PREVIEW_GRADES = Object.freeze([
  { id: "ancient",    name: "上古", color: "#22d3ee", glow: "#06b6d4" },
  { id: "apocalypse", name: "天啟", color: "#fb7185", glow: "#e11d48" },
  { id: "eternal",    name: "永恆", color: "#e0e7ff", glow: "#818cf8" },
]);

export const PREVIEW_GRADE_PREFIX = Object.freeze({
  ancient: "【上古】", apocalypse: "【天啟】", eternal: "【永恆】",
});

// 預覽品級的加成數值，沿用現行直線公式，好讓 UI 能接著神話往下顯示
export function previewGradeBonus(gradeId, plusLevel = 0) {
  const idx = PREVIEW_GRADE_INDEX[gradeId];
  if (idx === undefined) return 0;
  return idx * 5 + 1 + Math.max(0, Math.min(4, plusLevel || 0));
}
