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

/** 🏆 比賽模式：每次上場隨機換一張戰場，同一場比賽射一整天才不會膩 */
export function randomRaidBackground(rand = Math.random) {
  return raidBackground(RAID_ARENAS[Math.floor(rand() * RAID_ARENAS.length)]);
}

// ── 隊友外觀（scripts/gen-raid-chars.py 生成）──────────────
// ⚠️ 這些不拿弓：本機模型畫弓的成功率很低，常常變成一條白色幽靈狀的線。
//    改拿近戰/輔助裝備反而辨識度更高（作者 2026-07-31 指示）。
export const RAID_ARCHERS = Object.freeze([
  { id: "grey", name: "灰紋", gear: "長棍" },
  { id: "calico", name: "三花", gear: "圓盾" },
  { id: "siamese", name: "暹羅", gear: "地圖" },
  { id: "tuxedo", name: "賓士", gear: "短劍" },
  { id: "ginger", name: "橘子", gear: "彎刀" },
  { id: "smoke", name: "煙灰", gear: "水晶球" },
  { id: "cream", name: "奶油", gear: "提燈" },
  { id: "black", name: "夜影", gear: "短矛" },
]);

export function raidArcherArt(id) {
  return `/assets/raid/archer_${id || "grey"}.webp`;
}

// 依 memberId 穩定挑一個外觀——同一個人每次都長同一張，不會忽男忽女
export function archerForMember(memberId, index = 0) {
  const key = String(memberId || "");
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return RAID_ARCHERS[(key ? h : index) % RAID_ARCHERS.length].id;
}

// 結算勳章
export const RAID_MEDALS = Object.freeze({
  victory: "/assets/raid/medal_victory.webp",   // 討伐成功
  breaker: "/assets/raid/medal_breaker.webp",   // 破防貢獻
  lasthit: "/assets/raid/medal_lasthit.webp",   // 最後一擊
});

export const RAID_LOBBY_BG = "/assets/raid/lobby_bg.webp";

// ── 擊倒演出用的「拉弓射擊」姿勢 ──────────────────────────
// ⚠️ 這是**唯一需要弓**的素材（側身拉弓的姿勢，成功率比正面持弓高很多）。
//    隊伍列的 archer_* 刻意沒有弓——兩套不要混用。
export const RAID_SHOOTERS = Object.freeze(["shoot_a", "shoot_b", "shoot_c", "shoot_d"]);

export function raidShooterArt(id) {
  return `/assets/raid/${RAID_SHOOTERS.includes(id) ? id : "shoot_a"}.webp`;
}
