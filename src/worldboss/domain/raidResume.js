// src/worldboss/domain/raidResume.js
// 單人討伐的防斷線／防重整：把戰鬥狀態存在本機，重整後接回去繼續打。
//
// 為什麼用 localStorage 不用 Firestore：單人戰鬥全在瀏覽器算（記憶：Client-side Computation），
// 存回雲端只是多花讀寫。組隊才需要 Firestore，因為要跟別人對齊。
//
// ⚠️ 三個一定要擋的情況（每一條都有測試）：
//   ① **已結算的場次不能復活**——`settled` 的狀態直接丟掉，不然玩家重整就能再結算一次
//      ⚠️ 但**還沒結算的完場要存**（2026-08-06 修 bug）：最後一局 `attackWorldBoss`
//      是異步的，存檔在送出前就清掉，重整回來就永遠拿不到獎勵。
//      所以「打完還沒送出獎勵」的場次必須留著，重整回來才能補送。
//   ② **換了王／換了場次不能沿用**——存的 key 綁 bossKey + eventId
//   ③ **太舊的不要接**——超過 EXPIRE_MS 視同放棄（隔天回來不該接上昨天那場）

import { serializeRaidState, hydrateRaidState } from "./raidRoomState";

const KEY = "wb_raid_resume_v1";
export const RESUME_EXPIRE_MS = 6 * 60 * 60 * 1000;   // 6 小時

// 存檔的形狀（純資料，方便測試不碰 localStorage）
// settled = 這場的獎勵已經送出（攻擊次數已扣、傷害已入帳）。
// settlement = 完場那一下的結算快照（killInfo / reward / killPayload），
//              重整後用同一份資料重建結算畫面，不會重 roll 獎勵。
export function buildResumeRecord(state, { bossKey, eventId = null, now = Date.now(), settled = false, settlement = null } = {}) {
  if (!state) return null;
  if (state.finished && settled) return null;         // ① 已結算的完場不存（防再結算一次）
  return {
    v: 1,
    bossKey: bossKey || state.boss?.key || null,
    eventId,
    savedAt: now,
    round: state.round,
    finished: !!state.finished,
    settled: !!settled,
    settlement: state.finished ? settlement : null,
    state: serializeRaidState(state),
  };
}

export function isResumeUsable(record, { bossKey, eventId = null, now = Date.now() } = {}) {
  if (!record || record.v !== 1 || !record.state) return false;
  if (record.finished && record.settled) return false;         // ① 已結算的完場不復活
  if (bossKey && record.bossKey !== bossKey) return false;     // ②
  if ((record.eventId || null) !== (eventId || null)) return false;
  if (now - (record.savedAt || 0) > RESUME_EXPIRE_MS) return false;  // ③
  return true;
}

// ── localStorage 包裝（瀏覽器不可用時一律安靜失敗，不能讓戰鬥壞掉）──
function store() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

export function saveRaidProgress(state, opts = {}) {
  const ls = store();
  if (!ls) return false;
  const record = buildResumeRecord(state, opts);
  try {
    if (!record) { ls.removeItem(KEY); return false; }
    ls.setItem(KEY, JSON.stringify(record));
    return true;
  } catch { return false; }
}

export function loadRaidProgress(opts = {}) {
  const ls = store();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!isResumeUsable(record, opts)) { ls.removeItem(KEY); return null; }
    return { record, state: hydrateRaidState(record.state) };
  } catch {
    try { ls.removeItem(KEY); } catch { /* ignore */ }
    return null;
  }
}

export function clearRaidProgress() {
  const ls = store();
  if (!ls) return;
  try { ls.removeItem(KEY); } catch { /* ignore */ }
}

// UI 用的一句話
export function resumeLabel(record) {
  if (!record) return "";
  const mins = Math.max(0, Math.round((Date.now() - (record.savedAt || 0)) / 60000));
  const when = mins < 1 ? "剛剛" : mins < 60 ? `${mins} 分鐘前` : `${Math.round(mins / 60)} 小時前`;
  if (record.finished) return `${when}的討伐（待領獎勵）`;
  return `${when}的第 ${record.round} 回合`;
}
