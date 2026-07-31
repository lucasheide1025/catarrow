// src/worldboss/domain/raidReport.js
// ─────────────────────────────────────────────────────────────
// 討伐結果 → `attackWorldBoss()` 要的 `roundResults`。
//
// ⚠️ 為什麼要獨立一支純函式：這是**整場戰鬥唯一寫進 Firestore 的數字**。
//    寫錯就是玩家白打一場，而且沒有第二次機會（每日一次）。
//    寫在元件裡就只能靠真的打一場王來驗——那代價太高了。
//
// ⚠️ 組隊時**只算自己的傷害**（各扣各的次數、各寫各的）。
//    log 裡有全隊的箭，直接加總會把隊友的傷害也記到自己頭上。
// ─────────────────────────────────────────────────────────────

/** 一回合的 log → { dmg, arrows }。dmg 只算 memberId 自己的。 */
export function roundResultFromLog(log = [], memberId = null) {
  const events = Array.isArray(log) ? log : [];
  const mine = e => memberId == null || e.memberId === memberId;

  const arrows = events
    .filter(e => e.type === "arrow" && mine(e))
    .map(e => ({ label: e.label ?? "", score: Number(e.damage) || 0 }));

  // 自己的箭 ＋ 自己的貓陪練 ＋ 自己造成的反擊都算
  const dmg = events
    .filter(e => (e.type === "arrow" || e.type === "catAssist") && mine(e))
    .reduce((sum, e) => sum + (Number(e.damage) || 0), 0);

  return { dmg: Math.round(dmg), arrows };
}

/**
 * 全場的回合結果。
 * ⚠️ 一箭都沒打也要回**一筆**——`attackWorldBoss` 用 `roundResults.length`
 *    當回合數，空陣列會讓這次出擊完全沒有紀錄（等於次數白扣）。
 */
export function raidRoundResults(rounds = [], finalState = null, memberId = null) {
  const list = (Array.isArray(rounds) ? rounds : []).filter(Boolean);
  if (list.length) return list;
  const me = (finalState?.members || []).find(m => m.memberId === memberId);
  const fallback = Number(me?.damage) || Number(finalState?.totals?.damage) || 0;
  return [{ dmg: Math.round(fallback), arrows: [] }];
}

/** 這一場自己總共打了多少（UI 與送出前的對帳都用這個） */
export function raidTotalDamage(rounds = []) {
  return (Array.isArray(rounds) ? rounds : [])
    .reduce((sum, r) => sum + (Number(r?.dmg) || 0), 0);
}
