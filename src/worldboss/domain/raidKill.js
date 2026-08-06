// src/worldboss/domain/raidKill.js
// ─────────────────────────────────────────────────────────────
// 尾刀：誰打倒的、**用什麼方式打倒的**、以及尾刀獎勵。
//
// ⚠️ 世界王的血是**全伺服器共享**的（作者 2026-07-31 提醒），所以獎勵是三層：
//
//   ① 參戰獎勵（未擊殺）  `raidRewards.js`   每次出擊結束就發
//   ② **尾刀獎勵（擊殺）** 本檔                 只有補到最後一刀的人／隊
//   ③ 全服擊倒發放        `worldBossDb.js`    王死掉時，全體參戰者按傷害佔比分
//
//   三層互不取代：①是「今天有來」、②是「那一刀是你補的」、③是「這隻王終於倒了」。
//
// 既有的 `worldBossDb.js` 已經有 `lastHitBy: { memberId, memberName, weapon, killerStyle,
// finishingArrow }` 這個形狀，欄位都在，只是 killerStyle 一直沒有有趣的內容——這裡把它填滿。
// ─────────────────────────────────────────────────────────────

import { LAST_HIT_EXTRA } from "../../lib/worldBossData";

/**
 * 擊倒方式。**由上而下比對，第一個成立的就是它**——所以特別的排前面，
 * 不然「綠點擊倒」會把所有更有趣的情況都吃掉。
 */
export const KILL_STYLES = Object.freeze([
  {
    id: "red_bullseye", icon: "🎯", name: "一箭穿心", rarity: "legendary",
    flavour: "正中最小的那個點。牠連怎麼倒的都不知道。",
    match: c => c.bySpot === "red" && c.bullseye,
  },
  {
    id: "burst_finish", icon: "💥", name: "破防終結", rarity: "epic",
    flavour: "全場一起把牠的防線敲開，然後你補上了那一刀。",
    match: c => c.burst,
  },
  {
    id: "stagger_finish", icon: "💫", name: "趁虛而入", rarity: "epic",
    flavour: "牠還沒站穩，這一刀就到了。",
    match: c => c.staggered,
  },
  {
    id: "cat_finish", icon: "🐾", name: "貓貓收頭", rarity: "epic",
    flavour: "最後一下不是箭——是牠自己咬下去的。",
    match: c => c.byCat,
  },
  {
    id: "red_finish", icon: "🔴", name: "致命一擊", rarity: "rare",
    flavour: "最小的弱點，最痛的一箭。",
    match: c => c.bySpot === "red",
  },
  {
    id: "combo_finish", icon: "🏹", name: "連射終結", rarity: "rare",
    flavour: "一箭接一箭，沒有一支落空。",
    match: c => (c.combo || 0) >= 5,
  },
  {
    id: "overkill", icon: "💀", name: "過度殺傷", rarity: "rare",
    flavour: "牠只剩一點血，而你完全沒有留手。",
    match: c => c.damage >= Math.max(1, c.hpBefore) * 3,
  },
  {
    id: "full_team", icon: "🤝", name: "全員突擊", rarity: "rare",
    flavour: "八個人站成一排，牠沒有活路。",
    match: c => (c.teamSize || 1) >= 8,
  },
  {
    id: "solo_slay", icon: "🗡️", name: "單騎討伐", rarity: "epic",
    flavour: "沒有隊友，沒有支援，就你跟牠。",
    match: c => (c.teamSize || 1) === 1,
  },
  {
    id: "lucky_finish", icon: "✨", name: "湊巧的一箭", rarity: "common",
    flavour: "沒中弱點，但牠就是倒了。",
    match: c => !c.bySpot && !c.byCat,
  },
  {
    id: "steady_finish", icon: "🟢", name: "穩紮穩打", rarity: "common",
    flavour: "不花俏，但夠了。",
    match: () => true,          // 保底：一定會有一個成立
  },
]);

export const KILL_RARITY_COLOR = Object.freeze({
  legendary: "#f5b942", epic: "#c084fc", rare: "#60a5fa", common: "#94a3b8",
});

/**
 * 判斷這一刀是怎麼補的。
 * context: { bySpot, bullseye, burst, staggered, byCat, combo, damage, hpBefore, teamSize }
 */
export function detectKillStyle(context = {}) {
  const c = { combo: 0, damage: 0, hpBefore: 1, teamSize: 1, ...context };
  const style = KILL_STYLES.find(s => s.match(c)) || KILL_STYLES[KILL_STYLES.length - 1];
  return {
    id: style.id, icon: style.icon, name: style.name,
    flavour: style.flavour, rarity: style.rarity,
    color: KILL_RARITY_COLOR[style.rarity],
  };
}

/**
 * 尾刀獎勵。沿用既有的 `LAST_HIT_EXTRA`（貓貓箱 + 卡包），
 * 再依擊倒方式的稀有度給金幣加碼——好看的擊倒方式值得多給一點。
 */
export const KILL_STYLE_COIN_BONUS = Object.freeze({
  legendary: 800, epic: 400, rare: 200, common: 100,
});

export function lastHitReward(style) {
  const rarity = style?.rarity || "common";
  return {
    ...LAST_HIT_EXTRA,                                   // { catBoxes: 1, cardPacks: 1 }
    coins: KILL_STYLE_COIN_BONUS[rarity] || KILL_STYLE_COIN_BONUS.common,
    style: style || null,
  };
}

/** 全服播報用的一句話：誰、用什麼方式、打倒了誰 */
export function killAnnouncement({ killerName, bossName, style, teamNames = [] } = {}) {
  const who = teamNames.length > 1
    ? `${killerName} 與 ${teamNames.length - 1} 位隊友`
    : (killerName || "某位射手");
  return `${style?.icon || "⚔️"} ${who} 以「${style?.name || "最後一擊"}」討伐了 ${bossName || "世界王"}！`;
}

/** 從 raidFlow 的 log 找出補刀的那一下（bossDown 前面最近的一次傷害事件） */
export function findKillingBlow(log = []) {
  const downIdx = log.findIndex(e => e.type === "bossDown");
  if (downIdx < 0) return null;
  for (let i = downIdx - 1; i >= 0; i -= 1) {
    const e = log[i];
    if (e.type === "arrow" || e.type === "catAssist") return e;
  }
  return null;
}

/**
 * 擊倒演出的**重播 payload**。
 *
 * ⚠️ 作者 2026-07-31 澄清：其他玩家原本只看得到一行文字廣播
 *    （`MemberApp.jsx:656` 的 toast「XXX 給予最後一擊」）——
 *    **要讓全服都看到那段終結演出重播一次**，所以演出必須能從「存下來的資料」重現，
 *    不能依賴當下的戰鬥 state（別人的裝置上根本沒有那份 state）。
 *
 * 只存演出需要的東西：誰、幾個人、什麼方式、王是誰。刻意精簡——
 * 這份會寫進全服共用的王文件，每個欄位都是所有人的讀取成本。
 */
export function buildKillPayload({
  bossKey, bossName, killerId, killerName, byCat = false, catName = null,
  style, members = [], eventId = null, at = Date.now(),
} = {}) {
  if (!style) return null;
  return {
    v: 1, at, eventId, bossKey: bossKey || null, bossName: bossName || "",
    killerId: killerId || null, killerName: killerName || "某位射手",
    byCat: !!byCat, catName: catName || null,
    style: { id: style.id, icon: style.icon, name: style.name, flavour: style.flavour, rarity: style.rarity, color: style.color },
    // 演出只需要 id 與名字（用來挑射手姿勢與顯示人數），不搬整份成員資料
    cast: (members || []).slice(0, 5).map(m => ({ memberId: m.memberId, name: m.name })),
    // 立繪最多排 5 位，但**名字要全部列出來**（作者 2026-07-31）——
    // 演出最後會跳「所有參戰人的名字」，八個名字比八張立繪便宜得多。
    names: (members || []).map(m => m.name).filter(Boolean),
    teamSize: (members || []).length || 1,
  };
}

/** 這個重播還新不新鮮——太舊的不要跳出來嚇人（例如三天前打倒的） */
// ⚠️ 2026-08-06：10 分鐘太短——玩家隔幾小時再登入就看不到擊倒演出了。
//    放寬到 24 小時：當天登入都能看到第一次重播。看過的重播由
//    MemberApp（localStorage）／大廳（sessionStorage）各自的 seen 標記擋掉。
export const KILL_REPLAY_FRESH_MS = 24 * 60 * 60 * 1000;

export function isKillReplayFresh(payload, now = Date.now()) {
  if (!payload || payload.v !== 1) return false;
  return now - (payload.at || 0) <= KILL_REPLAY_FRESH_MS;
}

/** 這個玩家看過這次擊倒了沒（避免每次開 App 都重播同一場） */
export function shouldReplayKill(payload, seenAt = 0, now = Date.now()) {
  if (!isKillReplayFresh(payload, now)) return false;
  return (payload.at || 0) > (seenAt || 0);
}
