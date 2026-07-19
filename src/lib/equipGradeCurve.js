// src/lib/equipGradeCurve.js
// 裝備品級加成曲線（2026-07-19 改版）
//
// 【為什麼改】舊公式是 (品級index × 5 + 1) + plusLevel，30 個階梯每步都剛好 +1。
// 也就是「普通+4 → 稀有+0」的突破，跟「+1 → +2」的成長一模一樣，但突破要付
// 王之印記＋暴增的金幣（傳說 12000、神話 30000）。付出跳很多、回饋完全沒跳，
// 玩家自然覺得升不升沒差。改成凸曲線後：
//   1. 每個品級的「單級步長」遞增（普通 1 → 神話 3 → 永恆 7）
//   2. 品級突破 = 新品級的 2 個步長，越高階跳越明顯
//   3. 逐格比對 30 個階梯，新值全部 ≥ 舊值 —— 沒有任何現有玩家被削弱
//
// 【上古/天啟/永恆】只有數值定義，不在 EQUIP_GRADES（可取得品級）內，
// 因此無法被升級流程碰到，純粹給 UI 預覽用。要實裝時再加進 EQUIP_GRADES。

// base = 該品級 +0 的加成；step = 該品級內每 +1 的成長
export const GRADE_CURVE = Object.freeze({
  common: { base: 1,   step: 1 },
  rare:   { base: 7,   step: 1 },
  elite:  { base: 13,  step: 1 },
  epic:   { base: 21,  step: 2 },
  legend: { base: 33,  step: 2 },
  mythic: { base: 47,  step: 3 },
  // ↓ T7~T9：僅顯示，未實裝
  ancient:  { base: 67,  step: 4 },
  apocalypse: { base: 93,  step: 5 },
  eternal:  { base: 127, step: 7 },
});

// 尚未實裝、只在圖鑑/預覽顯示的品級
export const PREVIEW_GRADES = Object.freeze([
  { id: "ancient",    name: "上古", color: "#22d3ee", glow: "#06b6d4" },
  { id: "apocalypse", name: "天啟", color: "#fb7185", glow: "#e11d48" },
  { id: "eternal",    name: "永恆", color: "#e0e7ff", glow: "#818cf8" },
]);

export const PREVIEW_GRADE_PREFIX = Object.freeze({
  ancient: "【上古】", apocalypse: "【天啟】", eternal: "【永恆】",
});

// 單一欄位的原始加成（HP 欄位由呼叫端再 ×5）
export function gradeCurveBonus(gradeId, plusLevel = 0) {
  const curve = GRADE_CURVE[gradeId];
  if (!curve) return 0;
  const level = Math.max(0, Math.min(4, plusLevel || 0));
  return curve.base + level * curve.step;
}

// 突破到下一品級能多拿幾點（UI 用來讓玩家看見「值得突破」）
export function breakthroughGain(fromGradeId, toGradeId) {
  return gradeCurveBonus(toGradeId, 0) - gradeCurveBonus(fromGradeId, 4);
}
