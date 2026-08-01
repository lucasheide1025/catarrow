// src/lib/tournamentDb.js
// 🏛️ 對外賽事的歷史排行榜。
//
// ⚠️ 一場賽事＝一顆文件，選手成績直接放在裡面（一場最多幾十人，遠低於 1MB）。
//    這份是**存檔**不是即時榜：沒有人需要監聽它，開頁面才讀一次就好。
//
// ⚠️ 只有教練能寫（規則裡用 isAdmin），但**所有人都能讀**——
//    對外賽事的成績本來就是要給大家看的。
import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { normalizeDate, normalizeEntry, validateTournament } from "../worldboss/domain/tournament";

const T = "tournaments";

function humanError(e) {
  const msg = String(e?.message || e || "");
  if (/insufficient permissions|permission-denied/i.test(msg)) {
    return "資料庫權限不足（tournaments）——請教練到 Firebase Console 貼上規則";
  }
  if (/offline|unavailable|network/i.test(msg)) return "網路連不上，稍後再試";
  return msg || "操作失敗";
}

/** 新增或更新一場賽事。id 給了就是更新。 */
export async function saveTournament(t, { adminId = null } = {}) {
  const check = validateTournament(t);
  if (!check.ok) return { ok: false, reason: check.errors[0], errors: check.errors };
  try {
    const id = t.id || `${normalizeDate(t.date)}_${Math.random().toString(36).slice(2, 8)}`;
    await setDoc(doc(db, T, id), {
      id,
      name: String(t.name).trim(),
      date: normalizeDate(t.date),
      type: t.type || "other",
      note: String(t.note || "").trim(),
      // ⚠️ 存之前一律正規化：手打的資料什麼都可能有
      entries: check.entries.filter(e => e.name).map((e, i) => normalizeEntry(e, i)),
      sourceMatchId: t.sourceMatchId || null,
      updatedAt: serverTimestamp(),
      ...(t.id ? {} : { createdAt: serverTimestamp(), createdBy: adminId || null }),
    }, { merge: true });
    return { ok: true, id };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

/** 讀全部。⚠️ 不做即時監聽——這是存檔，開頁面讀一次就好。 */
export async function listTournaments() {
  try {
    const snap = await getDocs(query(collection(db, T), orderBy("date", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // 還沒建索引或權限問題時退回不排序，至少讀得到
    try {
      const snap = await getDocs(collection(db, T));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { return []; }
  }
}

export async function getTournament(id) {
  if (!id) return null;
  try {
    const s = await getDoc(doc(db, T, id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch { return null; }
}

export async function deleteTournament(id) {
  if (!id) return { ok: false, reason: "參數錯誤" };
  try {
    await deleteDoc(doc(db, T, id));
    return { ok: true };
  } catch (e) { return { ok: false, reason: humanError(e) }; }
}

export const TOURNAMENT_COLLECTION = T;
