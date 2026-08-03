// src/lib/practiceLogRepair.js
// ─────────────────────────────────────────────────────────────
// 🩹 舊 practiceLogs 的補正計畫（純函式，不碰 Firestore）。
//
// 為什麼需要：2026-08-03 修好了三個寫入端的 bug，但**已經寫進去的舊資料
// 不會自己變對**。這一支負責「看資料、決定每一筆該怎麼處理」，
// 寫入的部分交給 db.js，這樣判斷邏輯才測得到。
//
// ⚠️ **最重要的一條**：不能無腦幫缺 date 的紀錄補 date。
//    舊版世界王（WorldBossAttack）自己寫一筆完整的、attackWorldBoss 內部
//    又寫一筆簡略的。簡略那筆因為缺 date 查不到，等於被藏起來——
//    如果補了 date，就等於**把重複的紀錄復活**，箭數直接翻倍。
//    所以要先判重，判定是重複的就標記跳過，不補。
// ─────────────────────────────────────────────────────────────

import { structuralArrowCount } from "./practiceLogArrows";

/** 判重時間窗：同一次攻擊的兩筆寫入落差不會超過這個秒數 */
export const DUPLICATE_WINDOW_SEC = 180;

const secOf = log => {
  const v = log?.createdAt;
  if (!v) return null;
  if (typeof v?.seconds === "number") return v.seconds;              // Firestore Timestamp
  if (typeof v?.toDate === "function") return v.toDate().getTime() / 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t / 1000 : null;
};

/** 從 createdAt 推出台北日期鍵（yyyy-mm-dd） */
export function dateKeyFromCreatedAt(log) {
  const sec = secOf(log);
  if (sec == null) return null;
  // Firestore 存 UTC；台北固定 UTC+8，沒有日光節約，直接加 8 小時最穩
  const d = new Date((sec + 8 * 3600) * 1000);
  const p = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** 這筆是不是 attackWorldBoss 內建寫的那種簡略世界王紀錄 */
function isTerseWorldBossLog(log) {
  return log?.type === "world_boss" && !log?.roundsString && !log?.rounds;
}

/** 這筆是不是 WorldBossAttack 畫面自己寫的完整世界王紀錄 */
function isRichWorldBossLog(log) {
  return log?.source === "worldboss" && (!!log?.roundsString || !!log?.rounds);
}

/**
 * 決定每一筆要怎麼處理。
 * @returns {{ fixDate:[], fixArrows:[], duplicates:[], unfixable:[], ok:number }}
 */
export function planPracticeLogRepair(logs = []) {
  const list = (logs || []).filter(Boolean);
  const rich = list.filter(isRichWorldBossLog).map(l => ({ sec: secOf(l), bossName: l.bossName }));

  const plan = { fixDate: [], fixArrows: [], duplicates: [], unfixable: [], ok: 0 };

  for (const log of list) {
    const needDate = !log.date;
    // ⚠️ 一定要用 structuralArrowCount（只看實際箭矢資料）。
    //    用 practiceLogArrowCount 的話它會優先相信 totalArrows，
    //    拿來比對永遠相等，就驗不出「totalArrows 本身寫錯」。
    //    舊版世界王那筆簡略紀錄沒有 rounds，總箭數在 `arrows` 欄位裡。
    const arrows = structuralArrowCount(log) || (isTerseWorldBossLog(log) ? Number(log.arrows) || 0 : 0);
    const needArrows = arrows > 0 && Number(log.totalArrows) !== arrows;

    if (needDate && isTerseWorldBossLog(log)) {
      const sec = secOf(log);
      const dup = sec != null && rich.some(r =>
        r.sec != null
        && Math.abs(r.sec - sec) <= DUPLICATE_WINDOW_SEC
        && (!log.bossName || !r.bossName || r.bossName === log.bossName));
      if (dup) {
        // ⚠️ 這筆是重複——維持沒有 date 讓它繼續隱形，不要復活它
        plan.duplicates.push({ id: log.id, reason: "舊版世界王重複紀錄，補 date 會讓箭數翻倍" });
        continue;
      }
    }

    const patch = {};
    if (needDate) {
      const key = dateKeyFromCreatedAt(log);
      if (!key) { plan.unfixable.push({ id: log.id, reason: "沒有 date 也沒有 createdAt，無從推算" }); continue; }
      patch.date = key;
    }
    if (needArrows) patch.totalArrows = arrows;

    if (patch.date && patch.totalArrows !== undefined) {
      plan.fixDate.push({ id: log.id, patch });
    } else if (patch.date) {
      plan.fixDate.push({ id: log.id, patch });
    } else if (patch.totalArrows !== undefined) {
      plan.fixArrows.push({ id: log.id, patch });
    } else {
      plan.ok += 1;
    }
  }
  return plan;
}

/** 這份計畫總共要動幾筆 */
export function repairCount(plan) {
  return (plan?.fixDate?.length || 0) + (plan?.fixArrows?.length || 0);
}
