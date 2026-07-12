// src/lib/cohort.js
// 期數生計算
//   1期生：2022/07/16 ~ 2022/12/31
//   2期生：2023/01/01 ~ 2023/06/30
//   3期生：2023/07/01 ~ 2023/12/31
//   4期生：2024/01/01 ~ 2024/06/30
//   5期生：2024/07/01 ~ 2024/12/31
//   之後每半年一期遞增
//
// joinDate 空白 / 無效 → 回傳 0（0期生，顯示「期數未知」）
// joinDate 早於 2022/07/16 → 回傳 0（同上）

export function getCohort(joinDate) {
  if (!joinDate) return 0;
  const d = new Date(joinDate);
  if (isNaN(d.getTime())) return 0;

  const start = new Date("2022-07-16");
  if (d < start) return 0;

  const y = d.getFullYear();
  const isFirstHalf = d.getMonth() < 6; // 0-5 月 = 上半年

  if (y === 2022) return 1;              // 2022 下半年 = 1 期
  // 2023 起：上半年、下半年各一期
  return (y - 2023) * 2 + (isFirstHalf ? 2 : 3);
}

// 期數稀有度（越早越稀有）
export function cohortRarity(n) {
  if (n === 0) return "common";
  if (n === 1) return "legendary";       // 創始元老
  if (n <= 3) return "epic";
  if (n <= 5) return "rare";
  return "common";
}

// 期數標籤
export function cohortLabel(n) {
  if (n === 0) return "0期生";
  return `第 ${n} 期生`;
}

// 期數稱號（圖鑑用）
export function cohortTitle(n) {
  if (n === 0) return "期數未知";
  if (n === 1) return "創始元老";
  if (n <= 3) return "資深射手";
  if (n <= 5) return "中生代";
  return "新生代";
}