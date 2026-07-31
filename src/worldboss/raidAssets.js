// src/worldboss/raidAssets.js
// 討伐場地背景。八個族各一張（scripts/gen-raid-art.py 生成，1024×512）。
// 王的立繪不在這裡——沿用既有的 /worldboss/*.webp 與 WorldBossSVG 的像素 fallback。

export const RAID_ARENAS = Object.freeze([
  "ghost", "forest", "poison", "office", "exam", "western", "coach", "cat",
]);

export function raidBackground(family) {
  const key = RAID_ARENAS.includes(family) ? family : "coach";
  return `/assets/raid/raid_bg_${key}.webp`;
}
