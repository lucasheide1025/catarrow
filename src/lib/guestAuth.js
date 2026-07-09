// src/lib/guestAuth.js
// 訪客/兒童帳號的匿名登入 + 跨次造訪接續邏輯（見 .trellis/tasks/07-09-guest-kid-mode-overhaul）
import { signInAnonymously } from "firebase/auth";
import {
  collection, query, where, limit, getDocs, addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const C_MEMBERS = "members";

// email 轉小寫去空白；電話只留數字
export function normalizeContact(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (s.includes("@")) return s.toLowerCase();
  return s.replace(/[^0-9]/g, "");
}

// 瀏覽器原生 sha256（不需要後端函式）
export async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// 掃碼進站的核心流程：匿名登入 → 用聯絡方式找回舊記錄，找不到就新建
// accountType: "guest" | "kid"
export async function resolveGuestSession(contact, accountType, sessionSourceId = null) {
  if (!contact) return { ok: false, reason: "請輸入信箱或電話" };
  if (accountType !== "guest" && accountType !== "kid") return { ok: false, reason: "帳號類型錯誤" };

  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    const uid = auth.currentUser.uid;
    const contactHash = await sha256(normalizeContact(contact));

    const q = query(
      collection(db, C_MEMBERS),
      where("accountType", "==", accountType),
      where("contactHash", "==", contactHash),
      limit(1)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const existing = snap.docs[0];
      await updateDoc(existing.ref, { uid, lastLoginAt: serverTimestamp() });
      return { ok: true, id: existing.id, ...existing.data(), uid, isNew: false };
    }

    const ref = await addDoc(collection(db, C_MEMBERS), {
      accountType, contactHash, contactRaw: contact,
      sessionSourceId: sessionSourceId || null,
      uid,
      name: accountType === "kid" ? "小小射手" : "訪客射手",
      coins: 0,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    return { ok: true, id: ref.id, accountType, uid, coins: 0, isNew: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "系統忙碌，請稍後再試" };
  }
}
