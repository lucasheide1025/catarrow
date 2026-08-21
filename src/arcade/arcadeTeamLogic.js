// src/arcade/arcadeTeam.js — 組隊純邏輯（可單元測試）
// 規格 §14-16：掃 QR／代碼加入、Team Attack、Combo 倍率。
// 最高原則：Cloud for coordination——雲端只協調，不搬整份 visitorProfile。
import { ARCADE_MONSTERS, ARCADE_BOSS, MOON_BOSS, ABYSS_DEEP_BOSS, RED_MIN } from "./arcadeBattle";

export const TEAM_MIN_PLAYERS = 2;
export const TEAM_MAX_PLAYERS = 8;
export const TEAM_ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 房間 6 小時自動過期
export const TEAM_PERFECT_MIN = 30; // 完美配合：每人本回合 ≥30 分

// ── 心跳／逾時清理（M3.1：避免隊長離線讓整房卡死）──────────────
export const HOST_HEARTBEAT_MS = 25000;    // 客戶端心跳間隔（元件掛載期間每 25 秒一次）
export const CLEANUP_INTERVAL_MS = 45000;  // 客戶端主動清理間隔
export const HOST_STALE_MS = 75000;        // 大廳：房主超過 75 秒沒心跳 → 可被接管
export const PLAYER_STALE_MS = 180000;     // 戰鬥/大廳：超過 3 分鐘沒心跳 → 移出戰局
export const RESULT_RETENTION_MS = 30 * 60 * 1000; // 結果頁保留 30 分鐘後清理

/** lastAt 距今超過 staleMs（或從未有心跳）→ 視為離線 */
export function isStaleAt(lastAt, now, staleMs) {
  return !lastAt || now - lastAt > staleMs;
}

/** 把離線玩家從名單中分離（純函式） */
export function pruneStaleRoster(players, now, staleMs) {
  const list = Object.values(players || {});
  const active = list.filter((p) => !isStaleAt(p.lastAt, now, staleMs));
  const removed = list.filter((p) => isStaleAt(p.lastAt, now, staleMs));
  return { active, removed };
}

/** 倍率 → 顯示名稱（存 profile 的 bestCombo 是數值，顯示時再轉 label） */
export function comboLabel(mult) {
  if (mult >= 1.5) return "TEAM BREAK";
  if (mult >= 1.25) return "COMBO ×1.25";
  if (mult > 1) return "COMBO ×1.1";
  return "TEAM ATTACK";
}

/** 組隊模式成就統計（存訪客本機 profile.teamStats[mode]） */
export function emptyTeamStats() {
  return { wins: 0, bestCombo: 1, bestTimeMs: 0 };
}

/**
 * 通關後更新指定模式的成就統計（純函式，回傳新的 teamStats 物件）：
 *   wins       通關次數 +1
 *   bestCombo  該模式歷史最高 Combo 倍率（數值，顯示時用 comboLabel）
 *   bestTimeMs 最速通關（毫秒，越小越好；0 表示尚未有紀錄）
 */
export function updateTeamStats(teamStats, mode, { bestCombo = 1, timeMs = 0 } = {}) {
  const prev = { ...emptyTeamStats(), ...(teamStats?.[mode] || {}) };
  const next = {
    wins: (prev.wins || 0) + 1,
    bestCombo: Math.max(prev.bestCombo || 1, bestCombo || 1),
    bestTimeMs: timeMs > 0 ? (prev.bestTimeMs > 0 ? Math.min(prev.bestTimeMs, timeMs) : timeMs) : prev.bestTimeMs || 0,
  };
  return { ...(teamStats || {}), [mode]: next };
}

/** 毫秒 → 「m:ss」顯示（0 = 無紀錄） */
export function formatTeamDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 5 位數房間碼（隊長建立，朋友用代碼或 QR 加入） */
export function makeRoomCode() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function isValidRoomCode(code) {
  return /^\d{5}$/.test(String(code || ""));
}

/** 房號輸入正規化：只保留數字，最多 5 位。 */
export function normalizeRoomCode(code) {
  return String(code || "").replace(/\D/g, "").slice(0, 5);
}

/**
 * 判斷某 visitor 對既有組隊房能做什麼：
 * waiting 新玩家可加入；已開戰只允許仍在 players 的原隊員重連。
 */
export function decideTeamRoomEntry(room, visitorId, now = Date.now()) {
  if (!room) return { action: "reject", reason: "not-found", clearResume: true };
  if (room.kind && room.kind !== "team") return { action: "reject", reason: "wrong-kind", clearResume: true };
  if (room.expiresAt && room.expiresAt < now) return { action: "reject", reason: "expired", clearResume: true };
  // 原隊員即使剛好在 result/defeat 重新整理，也應能回去看自己的結算。
  if (visitorId && room.players?.[visitorId]) return { action: "reconnect", reason: null, clearResume: false };
  if (room.status === "result" || room.status === "defeat") {
    return { action: "reject", reason: "finished", clearResume: true };
  }
  if (room.status === "waiting") return { action: "join", reason: null, clearResume: false };
  return { action: "reject", reason: "started", clearResume: true };
}

/** 同一個權威 round 才恢復尚未送出的本機箭；遠端已前進就丟棄舊箭。 */
export function resumeArrowsForRoom(saved, roomRound) {
  if (!saved || !Array.isArray(saved.arrows)) return null;
  return Number(saved.round || 0) === Number(roomRound || 0) ? saved.arrows : null;
}

/** 一支箭 ≥5 分算一次 Hit（規格 §16 Combo 的計數單位） */
export function hitsOfArrows(arrows) {
  return (arrows || []).filter((a) => a >= 5).length;
}

/**
 * Team Combo（規格 §16）：
 *   3 Hits ×1.1 / 6 Hits ×1.25 / 9 Hits TEAM BREAK ×1.5
 *   完美配合：全員本輪 ≥30 分 → Team Damage ×1.5（與 combo 疊乘、上限 ×2.0）
 * players: [{ score, hits }]
 */
export function teamCombo(players) {
  const list = Array.isArray(players) ? players : [];
  const hits = list.reduce((s, p) => s + (p.hits || 0), 0);
  let comboMult = 1;
  let comboName = "TEAM ATTACK";
  if (hits >= 9) { comboMult = 1.5; comboName = "TEAM BREAK"; }
  else if (hits >= 6) { comboMult = 1.25; comboName = "COMBO ×1.25"; }
  else if (hits >= 3) { comboMult = 1.1; comboName = "COMBO ×1.1"; }
  const perfect = list.length > 0 && list.every((p) => (p.score || 0) >= TEAM_PERFECT_MIN);
  const totalMult = Math.min(2.0, comboMult * (perfect ? 1.5 : 1));
  return { hits, comboMult, comboName, perfect, totalMult };
}

/**
 * 怪物依玩家人數縮放（2~8 人）：
 *   HP ×(1 + 人數)，防禦 +max(0, 人數-2)，攻擊 +max(0, 人數-2)×2
 * 人越多怪越強（血/防/攻一起長），但每人分擔的難度大致持平。
 */
export function scaleMonsterForParty(monster, playerCount) {
  const n = Math.max(1, playerCount || 1);
  const k = 1 + n;
  const hp = Math.round(monster.hp * k);
  const extra = Math.max(0, n - 2);
  return {
    ...monster,
    hp,
    maxHp: hp,
    def: (monster.def || 0) + extra,
    atk: (monster.atk || 0) + extra * 2,
  };
}

/** 同一怪物反擊 beat 套用到回合開始時仍存活的全體玩家。 */
export function applyPartyMonsterAttack(players, attack, enabled = true) {
  const amount = Math.max(0, Number(attack) || 0);
  const partyDamage = [];
  const nextPlayers = (players || []).map((player) => {
    const hpBefore = Math.max(0, Number.isFinite(Number(player?.hp)) ? Number(player.hp) : 100);
    const wasAlive = player?.alive !== false && hpBefore > 0;
    if (!enabled || !wasAlive || amount <= 0) return { ...player, hp: hpBefore, maxHp: Number(player?.maxHp) || 100, alive: wasAlive };
    const hpAfter = Math.max(0, hpBefore - amount);
    const applied = hpBefore - hpAfter;
    const alive = hpAfter > 0;
    partyDamage.push({ visitorId: player.visitorId, amount: applied, hpBefore, hpAfter, alive });
    return { ...player, hp: hpAfter, maxHp: Number(player?.maxHp) || 100, alive };
  });
  const defeat = nextPlayers.length > 0 && nextPlayers.every((player) => !player.alive || Number(player.hp) <= 0);
  return { players: nextPlayers, partyDamage, defeat };
}

/** Safely clears a roster member's round fields, including already-downed players who did not submit. */
export function accumulateTeamPlayerStats(player, roundDamage = 0) {
  const p = player || {};
  const damage = Number(roundDamage) || 0;
  return {
    score: (Number(p.score) || 0) + (Number(p.roundScore) || 0),
    shots: (Number(p.shots) || 0) + (Number(p.roundShots) || 0),
    hitCount: (Number(p.hitCount) || 0) + (Number(p.roundHits) || 0),
    scoreSqSum: (Number(p.scoreSqSum) || 0) + (Number(p.roundScoreSq) || 0),
    damage: (Number(p.damage) || 0) + damage,
    xCount: (Number(p.xCount) || 0) + (Number(p.roundX) || 0),
    bestRoundDamage: Math.max(Number(p.bestRoundDamage) || 0, damage),
  };
}

/** 組隊可選的冒險模式（與單人三模式對應） */
export const TEAM_MODES = [
  { id: "forest", icon: "🌲", name: "貓森遺跡", difficulty: "★☆☆", desc: `新手推薦：${ARCADE_MONSTERS[0].name} → ${ARCADE_MONSTERS[1].name} → ${ARCADE_MONSTERS[2].name} → ${ARCADE_BOSS.name}` },
  { id: "moon",   icon: "🌙", name: "月夜迷城", difficulty: "★★☆", desc: `${MOON_BOSS.name}壓軸：${ARCADE_MONSTERS[4].name}／${ARCADE_MONSTERS[3].name}隨機出沒` },
  { id: "abyss",  icon: "🔥", name: "深淵巢穴", difficulty: "★★★", desc: `深淵縮放怪層層疊強，${ABYSS_DEEP_BOSS.name}鎮守最深處` },
];

export function teamModeById(id) {
  return TEAM_MODES.find((m) => m.id === id) || TEAM_MODES[0];
}

/**
 * 組隊冒險序列（三模式可選）：三關各有叉路 → BOSS 戰（世界王風格）。
 *   forest 貓森遺跡：三隻既有怪物 → 學籍世界王外觀（新手友好）
 *   moon   月夜迷城：既有怪物池 → 月夜世界王外觀（神秘事件叉路多）
 *   abyss  深淵巢穴：深淵縮放怪三連 → 深淵世界王外觀（最硬、獎勵最豐）
 * 叉路由房主選擇（規格：組隊要討論、不要求投票）。
 * BOSS 戰：團隊目標（全隊總分打斷大招）＋各自攻擊目標（依位置不同），士氣歸零即團滅。
 */
export function buildTeamAdventure(mode = "forest", playerCount) {
  const n = Math.max(TEAM_MIN_PLAYERS, playerCount || TEAM_MIN_PLAYERS);
  const goblin = scaleMonsterForParty(ARCADE_MONSTERS[0], n);
  const beetle = scaleMonsterForParty(ARCADE_MONSTERS[1], n);
  const wolf = scaleMonsterForParty(ARCADE_MONSTERS[2], n);
  const turtle = scaleMonsterForParty(ARCADE_MONSTERS[3], n);
  const ghost = scaleMonsterForParty(ARCADE_MONSTERS[4], n);
  // 深淵關：用深淵樓層縮放（比普通怪強一點，有深淵風）
  const abyss = scaleMonsterForParty({
    ...ARCADE_MONSTERS[0],
    id: "abyss_goblin",
    name: "深淵哥布林",
    hp: 90,
    def: 4,
    atk: 10,
    rewardCoins: 30,
    task: "🔥 深淵關：怪物又硬又痛，小心！",
  }, n);

  if (mode === "moon") {
    return {
      dungeon: "🌙 月夜迷城",
      stages: [
        { stage: "forest", label: "🌲 貓森關", monster: goblin, routes: ["treasure", "elite"] },
        { stage: "moon",   label: "🌙 月夜關", monster: ghost,  routes: ["treasure", "event", "elite"] },
        { stage: "abyss",  label: "🔥 深淵關", monster: turtle, routes: ["deep", "rest"] },
      ],
      boss: scaleMonsterForParty({ ...MOON_BOSS, skillName: "月夜狼嚎" }, n),
      stageIdx: 0,
    };
  }
  if (mode === "abyss") {
    const abyss2 = scaleMonsterForParty({
      ...ARCADE_MONSTERS[2],
      id: "abyss_wolf",
      name: `深淵${ARCADE_MONSTERS[2].name}`,
      hp: 120,
      def: 5,
      atk: 14,
      rewardCoins: 40,
      task: "🔥 深淵關：怪物又硬又痛，小心！",
    }, n);
    const abyss3 = scaleMonsterForParty({
      ...ARCADE_MONSTERS[3],
      id: "abyss_turtle",
      name: `深淵${ARCADE_MONSTERS[3].name}`,
      hp: 150,
      def: 7,
      atk: 12,
      rewardCoins: 50,
      task: "🔥 深淵關：怪物又硬又痛，小心！",
    }, n);
    return {
      dungeon: "🔥 深淵巢穴",
      stages: [
        { stage: "abyss", label: "🔥 深淵關", monster: abyss,  routes: ["treasure", "elite"] },
        { stage: "abyss", label: "🔥 深淵關", monster: abyss2, routes: ["treasure", "event", "elite"] },
        { stage: "abyss", label: "🔥 深淵關", monster: abyss3, routes: ["deep", "rest"] },
      ],
      boss: scaleMonsterForParty(ABYSS_DEEP_BOSS, n),
      stageIdx: 0,
    };
  }
  // forest（預設）
  return {
    dungeon: "🌲 貓森遺跡",
    stages: [
      { stage: "forest", label: "🌲 貓森關", monster: goblin, routes: ["treasure", "elite"] },
      { stage: "moon",   label: "🌙 月夜關", monster: beetle, routes: ["treasure", "event", "elite"] },
      { stage: "abyss",  label: "🔥 深淵關", monster: wolf,   routes: ["deep", "rest"] },
    ],
    boss: scaleMonsterForParty(ARCADE_BOSS, n),
    stageIdx: 0,
  };
}

// ── 叉路（房主選）──────────────────────────────────────────
export const TEAM_ROUTES = {
  treasure: { id: "treasure", icon: "📦", label: "寶箱路", desc: "全隊開寶箱（下場攻擊變強）", tone: "#c97b2d" },
  elite:    { id: "elite",    icon: "⚔️", label: "菁英路", desc: "下場怪物變強，獎勵 ×2", tone: "#b23b2e" },
  event:    { id: "event",    icon: "❓", label: "神秘事件", desc: "全隊隨機事件（好壞都有）", tone: "#2b3a67" },
  deep:     { id: "deep",     icon: "🔥", label: "深入險境", desc: "BOSS 更狂暴，但獎勵 ×1.5", tone: "#a33a2d" },
  rest:     { id: "rest",     icon: "🛏️", label: "稍作休息", desc: "全隊恢復士氣 20", tone: "#58a05f" },
};

export function routeById(id) {
  return TEAM_ROUTES[id] || null;
}

/** 菁英路：下場怪物變強、獎勵 ×2（保留縮放後血量） */
export function eliteVariant(monster) {
  const hp = Math.round((monster.hp || 100) * 1.5);
  return {
    ...monster,
    id: `elite_${monster.id}`,
    name: `精英${monster.name}`,
    hp,
    maxHp: hp,
    atk: (monster.atk || 0) + 3,
    def: (monster.def || 0) + 2,
    rewardCoins: Math.round((monster.rewardCoins || 0) * 2),
    task: `⚔️ 菁英路：${monster.name} 變強了！但獎勵 ×2`,
  };
}

// 月夜關神秘事件（全隊共用，好壞都有）
const TEAM_EVENTS = [
  { id: "heal",   icon: "🍙", text: "流浪貓商人出現，全隊恢復 15 士氣！", good: true, spirit: 15 },
  { id: "catnip", icon: "🌿", text: "發現貓薄荷！接下來的戰鬥全隊攻擊變強。", good: true, atkBuff: 1.2 },
  { id: "coins",  icon: "🪙", text: "撿到一個錢袋！獲得 20 金幣。", good: true, coins: 20 },
  { id: "ambush", icon: "⚠️", text: "是陷阱！全隊士氣 -10。", good: false, spirit: -10 },
  { id: "mystery", icon: "✨", text: "一陣神秘光芒……什麼都沒發生？", good: null },
];

export function rollTeamEvent(rng = Math.random) {
  return TEAM_EVENTS[Math.floor(rng() * TEAM_EVENTS.length)];
}

// ── BOSS 戰：團隊目標 ＋ 各自攻擊目標 ───────────────────────
export const TEAM_BOSS_TEAM_MIN = 50; // 全隊總分門檻（人數縮放：× (n/2)）
export const TEAM_BOSS_SPIRIT_START = 100;
export const TEAM_BOSS_SPIRIT_LOST = 25; // 沒打斷大招 → 全隊士氣 -25
export const TEAM_BOSS_SPIRIT_GAIN = 20; // 休息路恢復

// 各自攻擊目標＝**靶面上的彩色弱點圈**（人越多圈越多，玩家瞄準自己的圈射）。
// 依玩家位置分配（2~8 人取前 N 個）：
//   color  = 圈色（沿用世界王語意：綠最大好打 → 紅最小最痛）
//   size   = 圈在立繪上的視覺大小（僅殘留供舊 UI 參考）
//   bonus  = 命中弱點圈的個人傷害加成
//   radius = 圈在靶面上的半徑（1.0 ＝ 靶紙邊緣，越小越難瞄）
//   dmgPct = 每支射進圈的箭額外給的固定傷害（BOSS 最大血量比例）
// 命中判定：BOSS 戰用靶面落點（箭的 nx/ny 在圈內）；非靶面仍走舊的記分板 check。
export const PERSONAL_GOALS = [
  { id: "red2",    desc: "射進你的圈！", color: "#f87171", size: 34, bonus: 1.6, radius: 0.10, dmgPct: 0.0040, check: (arrows) => arrows.filter((a) => a >= 8).length >= 2 },
  { id: "bull1",   desc: "射進你的圈！", color: "#fb923c", size: 40, bonus: 1.5, radius: 0.13, dmgPct: 0.0030, check: (arrows) => arrows.some((a) => a === 10 || a === 11) },
  { id: "total35", desc: "射進你的圈！", color: "#fbbf24", size: 46, bonus: 1.4, radius: 0.15, dmgPct: 0.0020, check: (arrows) => arrows.reduce((s, a) => s + Math.min(10, Math.max(0, a)), 0) >= 35 },
  { id: "hi3",     desc: "射進你的圈！", color: "#4ade80", size: 52, bonus: 1.3, radius: 0.17, dmgPct: 0.0010, check: (arrows) => arrows.filter((a) => a >= 6).length >= 3 },
  { id: "total30", desc: "射進你的圈！", color: "#22d3ee", size: 46, bonus: 1.35, radius: 0.15, dmgPct: 0.0022, check: (arrows) => arrows.reduce((s, a) => s + Math.min(10, Math.max(0, a)), 0) >= 30 },
  { id: "hi4",     desc: "射進你的圈！", color: "#a78bfa", size: 52, bonus: 1.25, radius: 0.17, dmgPct: 0.0012, check: (arrows) => arrows.filter((a) => a >= 5).length >= 4 },
  { id: "red1x",   desc: "射進你的圈！", color: "#f87171", size: 38, bonus: 1.5, radius: 0.12, dmgPct: 0.0035, check: (arrows) => arrows.some((a) => a >= 9) },
  { id: "noMiss",  desc: "射進你的圈！", color: "#4ade80", size: 56, bonus: 1.2, radius: 0.20, dmgPct: 0.0008, check: (arrows) => arrows.length > 0 && arrows.every((a) => a >= 1) },
];

/**
 * 把 N 個弱點圈放到靶面上（純函式）：每個玩家一個圈、不重疊、整個圈在靶內。
 * 回傳 [{ ...goal, cx, cy }]（cx/cy 為 -1..1 的歸一化座標，1.0 ＝ 靶紙半徑）。
 */
export function rollBossRings(count, rng = Math.random) {
  const n = Math.max(1, Math.min(PERSONAL_GOALS.length, count || 1));
  const placed = [];
  for (const g of PERSONAL_GOALS.slice(0, n)) {
    const r = g.radius;
    const maxR = Math.max(0, 0.86 - r); // 圈心可放範圍：扣掉圈自己的半徑＋邊距
    let pos = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * maxR;
      const cx = Math.cos(angle) * dist;
      const cy = Math.sin(angle) * dist;
      const clash = placed.some((p) => Math.hypot(p.cx - cx, p.cy - cy) < p.radius + r + 0.03);
      if (!clash) { pos = { cx, cy }; break; }
    }
    if (!pos) pos = { cx: 0, cy: 0 }; // 幾乎不會發生；兜底放中心
    placed.push({ ...g, cx: pos.cx, cy: pos.cy });
  }
  return placed;
}

/** 依目標 id 取弱點圈樣式（顏色/大小/加成）；找不到給中性灰 */
export function goalSpotStyle(goalId) {
  const g = PERSONAL_GOALS.find((x) => x.id === goalId);
  return g ? { color: g.color, size: g.size, bonus: g.bonus } : { color: "#94a3b8", size: 44, bonus: 1.2 };
}

/** 依玩家順序分配個人目標（回傳 [ {id, desc, pos:{cx,cy,radius}, color, bonus, dmgPct}, ... ]）
 * 每個圈有靶面位置——BOSS 戰時玩家瞄準自己的圈射。 */
export function assignPersonalGoals(playerCount, rng = Math.random) {
  const rings = rollBossRings(playerCount, rng);
  return rings.map((g) => ({
    id: g.id,
    desc: g.desc,
    color: g.color,
    bonus: g.bonus,
    dmgPct: g.dmgPct,
    pos: { cx: g.cx, cy: g.cy, radius: g.radius },
  }));
}

export function personalGoalById(id) {
  return PERSONAL_GOALS.find((g) => g.id === id) || null;
}

/** 檢查個人目標是否達成。
 *  BOSS 靶面模式：arrows 是落點物件 [{ nx, ny }]、ring 是 { cx, cy, radius } → 射進圈即達成。
 *  舊記分板模式（無落點）→ 沿用分數門檻 check（向後相容，測試與非靶面使用）。 */
export function checkPersonalGoal(goalId, arrows, ring) {
  const g = PERSONAL_GOALS.find((x) => x.id === goalId);
  if (!g) return true;
  const list = Array.isArray(arrows) ? arrows : [];
  const hasPos = list.some((a) => a && typeof a === "object" && a.nx != null && a.ny != null);
  if (hasPos && ring && ring.cx != null && ring.radius > 0) {
    // ⚠️ 陣列可能混 null（未填的箭格）——逐支判斷時要先過濾
    return list.some((a) => a && Math.hypot(a.nx - ring.cx, a.ny - ring.cy) <= ring.radius);
  }
  return g.check(list);
}

/**
 * BOSS 戰回合結算（純函式）：
 *  團隊目標：全隊總分 ≥ 門檻 → 打斷大招（全隊傷害 ×1.5）＋士氣不扣
 *  個人目標：達成 → 自己傷害滿額；沒達成 → 自己傷害減半
 *  沒打斷大招 → 全隊士氣 -25，並對所有存活玩家造成 Boss ATK；全員 HP 歸零才團滅
 * room: { monster, monsterHp, teamGoals: { teamMin, personal: [ {id,desc} ] }, spirit, stageIdx }
 * players: [{ roundScore, roundHits, personalGoalId }]
 */
export function resolveTeamBossRound(room, players) {
  const monster = room.monster;
  const activePlayers = players.filter((p) => p.alive !== false && (p.hp === undefined || Number(p.hp) > 0));
  const teamMin = room.teamGoals?.teamMin || TEAM_BOSS_TEAM_MIN;
  const totalScore = activePlayers.reduce((s, p) => s + (p.roundScore || 0), 0);
  const combo = teamCombo(activePlayers.map((p) => ({ score: p.roundScore || 0, hits: p.roundHits || 0 })));
  const teamInterrupted = totalScore >= teamMin;
  const teamMult = (teamInterrupted ? 1.5 : 1) * (room.teamGoals?.atkBuff || 1);

  // 每人：瞄準自己的弱點圈射（靶面落點判定）→ 命中傷害滿額×加成；沒命中 → 傷害減半
  const perPlayer = activePlayers.map((p) => {
    const goals = room.teamGoals?.personal || [];
    // ⚠️ 兜底：重連可能丟失 personalGoalId → 依玩家在名單的位置還原自己的圈
    const ring = goals.find((g) => g.id === p.personalGoalId)
      || goals[activePlayers.indexOf(p) % Math.max(1, goals.length)] || null;
    const spot = goalSpotStyle(p.personalGoalId);
    // 靶面落點（BOSS 戰）：每支箭的 nx/ny 在圈內 → 一次弱點命中
    const shots = Array.isArray(p.roundArrows)
      ? p.roundArrows.filter((a) => a && typeof a === "object" && a.nx != null && a.ny != null)
      : [];
    const weakHits = ring && ring.pos
      ? shots.filter((a) => Math.hypot(a.nx - ring.pos.cx, a.ny - ring.pos.cy) <= ring.pos.radius).length
      : 0;
    // 有落點 → 以命中圈數判定；無落點（舊記分板）→ 退回分數門檻
    const met = shots.length > 0
      ? weakHits > 0
      : checkPersonalGoal(p.personalGoalId, p.roundArrows, ring?.pos);
    const full = Math.max(1, Math.max(0, Math.round((p.roundScore || 0) * combo.totalMult * teamMult)) - (monster.def || 0));
    // 命中：滿額 × 圈加成 ×（多支進圈再疊 8%/支，最多 ×1.24）；沒中：減半
    const dmg = met
      ? Math.max(1, Math.round(full * spot.bonus * (1 + 0.08 * Math.max(0, weakHits - 1))))
      : Math.max(1, Math.round(full / 2));
    return {
      visitorId: p.visitorId,
      nickname: p.nickname || "隊友",
      catName: p.catName || "貓貓",
      catImage: p.catImage || "",
      score: p.roundScore || 0,
      hits: p.roundHits || 0,
      met, weakHits, dmg, raw: full, spotColor: spot.color,
    };
  });
  const dmg = perPlayer.reduce((s, x) => s + x.dmg, 0);

  const monsterHp = Math.max(0, (room.monsterHp || monster.hp) - dmg);
  const victory = monsterHp <= 0;
  const spirit = victory ? room.spirit : Math.max(0, (room.spirit || TEAM_BOSS_SPIRIT_START) - (teamInterrupted ? 0 : TEAM_BOSS_SPIRIT_LOST));
  const counter = applyPartyMonsterAttack(players, monster.atk, !victory && !teamInterrupted);
  const defeat = !victory && counter.defeat;

  const log = [];
  log.push({ kind: "info", text: `🎯 全隊總分 ${totalScore} 分（目標 ${teamMin}）` });
  if (combo.hits >= 3) log.push({ kind: "cat", text: `🔥 ${combo.hits} Hits → ${combo.comboName}` });
  perPlayer.forEach((x) => {
    const name = players.find((p) => p.visitorId === x.visitorId)?.nickname || "隊友";
    log.push(x.met
      ? (x.weakHits > 1
        ? { kind: "cat", text: `🎯 ${name} 命中弱點圈 ×${x.weakHits}！（傷害加成）` }
        : { kind: "cat", text: `🎯 ${name} 命中弱點圈！（傷害加成）` })
      : { kind: "danger", text: `❌ ${name} 沒射中弱點圈（傷害減半）` });
  });
  if (teamInterrupted) {
    log.push({ kind: "info", text: `💥 打斷大招！${monster.name} 的蓄力被中斷了！` });
  } else {
    log.push({ kind: "danger", text: `🌋 ${monster.name} 大招命中！全隊士氣 -${TEAM_BOSS_SPIRIT_LOST}` });
  }
  log.push({ kind: "enemy", text: `💥 ${monster.name} 受到 ${dmg} 傷害！` });
  if (victory) log.push({ kind: "info", text: `🎉 擊敗 ${monster.name}！` });
  if (defeat) log.push({ kind: "danger", text: "💀 全隊 HP 歸零……團隊潰散了！" });

  return {
    combo, totalScore, teamInterrupted, perPlayer, dmg, monsterHp,
    partyDamage: counter.partyDamage,
    victory, spirit, defeat, log, comboLabel: combo.comboName,
  };
}

/** 普通關（非 BOSS）回合結算（純函式）：總分 × combo 倍率 − 防禦 = 傷害 */
export function resolveTeamRound(room, players) {
  const monster = room.monster;
  const activePlayers = players.filter((p) => p.alive !== false && (p.hp === undefined || Number(p.hp) > 0));
  const combo = teamCombo(activePlayers.map((p) => ({ score: p.roundScore || 0, hits: p.roundHits || 0 })));
  const totalScore = activePlayers.reduce((s, p) => s + (p.roundScore || 0), 0);
  const atkBuff = room.atkBuff || 1; // 寶箱路/神秘事件：全隊攻擊變強
  const dmg = Math.max(1, Math.round(totalScore * combo.totalMult * atkBuff - (monster.def || 0)));
  const monsterHp = Math.max(0, (room.monsterHp || monster.hp) - dmg);
  const victory = monsterHp <= 0;
  const counter = applyPartyMonsterAttack(players, monster.atk, !victory);
  // A → B → C 依 roster 播放；個人傷害加總必須精確等於真正扣掉的 dmg。
  const weights = activePlayers.map((p) => Math.max(0, (p.roundScore || 0) * combo.totalMult * atkBuff));
  const weightSum = weights.reduce((s, v) => s + v, 0);
  const shares = weights.map((w, i) => {
    const exact = weightSum > 0 ? (dmg * w) / weightSum : (i === 0 ? dmg : 0);
    return { i, base: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let remainder = dmg - shares.reduce((s, x) => s + x.base, 0);
  [...shares].sort((a, b) => b.frac - a.frac || a.i - b.i).forEach((x) => {
    if (remainder > 0) { shares[x.i].base += 1; remainder -= 1; }
  });
  const perPlayer = activePlayers.map((p, i) => ({
    visitorId: p.visitorId,
    nickname: p.nickname || "隊友",
    catName: p.catName || "貓貓",
    catImage: p.catImage || "",
    score: p.roundScore || 0,
    hits: p.roundHits || 0,
    dmg: shares[i]?.base || 0,
    met: true,
  }));
  const log = [];
  log.push({ kind: "info", text: `🎯 全隊總分 ${totalScore} 分！` });
  if (combo.hits >= 3) {
    log.push({ kind: "cat", text: `🔥 ${combo.hits} Hits → ${combo.comboName}` });
  }
  if (combo.perfect) {
    log.push({ kind: "cat", text: "✨ 完美配合！全員都射得很棒！" });
  }
  log.push({ kind: "enemy", text: `💥 ${monster.name} 受到 ${dmg} 傷害！` });
  if (victory) log.push({ kind: "info", text: `🎉 擊敗 ${monster.name}！` });
  return {
    combo,
    totalScore,
    perPlayer,
    dmg,
    monsterHp,
    victory,
    defeat: !victory && counter.defeat,
    partyDamage: counter.partyDamage,
    log,
    comboLabel: combo.comboName,
  };
}

/** 組隊冒險評價：打完 4 隻（含 Boss）全通 → S；團滅給安慰等級 */
export function teamGrade(kills, defeated = false) {
  if (defeated) return { grade: "C", bonusMult: 1.0, label: "團隊潰散…下次再來！" };
  if (kills >= 4) return { grade: "S", bonusMult: 1.5, label: "完美團隊！" };
  if (kills >= 3) return { grade: "A", bonusMult: 1.3, label: "默契滿分！" };
  if (kills >= 2) return { grade: "B", bonusMult: 1.1, label: "開始配合了！" };
  return { grade: "C", bonusMult: 1.0, label: "冒險初體驗…" };
}

export { RED_MIN };
