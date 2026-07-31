// src/worldboss/domain/raidCards.js
// 世界王卡的判定與外框樣式。
//
// ⚠️ 判定方式沿用既有的 `WorldBossCardBadge`：裝備陣列裡 `source === "wb"` 就是世界王卡。
//    不要另外發明一套（卡片系統只有一個真相來源）。
// ⚠️ 顏色沿用戰鬥畫面的 FRAME_TIERS.worldboss（`BattleScreen.jsx:98`）＝金邊 #f5b942。

export const WB_FRAME = Object.freeze({
  color: "#f5b942",
  glow: "rgba(245,185,66,.65)",
  icon: "👑",
  label: "世界王卡",
});

/**
 * 這個人有沒有裝備世界王卡。
 * equipped 可能是字串陣列（舊格式，一律不是世界王卡）或物件陣列。
 */
export function hasWorldBossCard(equipped) {
  if (!Array.isArray(equipped)) return false;
  return equipped.some(e => e && typeof e === "object" && e.source === "wb");
}

/** 裝了幾張（世界王卡上限 3 張，UI 可以顯示張數） */
export function worldBossCardCount(equipped) {
  if (!Array.isArray(equipped)) return 0;
  return equipped.filter(e => e && typeof e === "object" && e.source === "wb").length;
}

// UI 用：立繪外框的樣式（沒有卡就回 null，呼叫端直接展開）
export function wbFrameStyle(has) {
  if (!has) return null;
  return {
    boxShadow: `0 0 0 2px ${WB_FRAME.color}, 0 0 10px 2px ${WB_FRAME.glow}`,
    borderRadius: 10,
  };
}
