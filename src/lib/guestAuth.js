// src/lib/guestAuth.js
// 訪客/兒童帳號的匿名登入 + 跨次造訪接續邏輯（見 .trellis/tasks/07-09-guest-kid-mode-overhaul）
import { signInAnonymously, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import {
  collection, query, where, limit, getDocs, addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { auth, db, firebaseConfig } from "./firebase";

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
//
// ⚠️ 2026-07-10 修復重大 bug：教練/會員登入中的裝置掃兒童模式 QR code 時，
// 原本會直接沿用主要 auth（跟教練登入共用同一個 Firebase Auth 物件）的 uid，
// 把教練/會員自己的 uid 誤植到新建立的訪客/兒童帳號文件上。
// useAuth.js 用 where("uid","==",fbUser.uid) 查詢，一旦兩筆文件共用同一個 uid，
// 就可能撈到錯的那筆，看起來像「帳號被洗成兒童帳號」（教練本人的文件其實完全沒被動到）。
// 修法：只有在 auth.currentUser 本來就是「匿名」時才能沿用；若目前是真實帳號登入中，
// 一律開一個臨時的第二個 Firebase App 做獨立匿名登入（比照 AdminMembers.jsx 建會員帳號的既有模式），
// 徹底跟主要登入身份隔開，絕不能把真實使用者的 uid 寫到別的 members 文件上。
export async function resolveGuestSession(contact, accountType, sessionSourceId = null) {
  if (!contact) return { ok: false, reason: "請輸入信箱或電話" };
  if (accountType !== "guest" && accountType !== "kid") return { ok: false, reason: "帳號類型錯誤" };

  let tmpApp = null;
  try {
    let workingAuth = auth;
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      // 目前分頁有「真實帳號」登入中（教練/會員）——絕不能沿用它的 uid，改用隔離的臨時 App。
      tmpApp = initializeApp(firebaseConfig, "guest_tmp_" + Date.now());
      workingAuth = getAuth(tmpApp);
    }
    if (!workingAuth.currentUser) await signInAnonymously(workingAuth);
    const uid = workingAuth.currentUser.uid;
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
  } finally {
    if (tmpApp) deleteApp(tmpApp).catch(() => {});
  }
}

// ── 新生自助入口（PublicBookingApp.jsx）：Email＋密碼註冊/登入 ──────
// 07-10-public-booking-password-auth：讓回訪的訪客不用每次都重填姓名/電話，
// 用密碼登入直接找回同一筆記錄。跟 resolveGuestSession 一樣，一律在隔離的
// 臨時 Firebase App 上做（這個頁面可能在教練自己也登入著的裝置上被打開，
// 絕不能碰到主要的 auth 物件——同一個坑，見上面 resolveGuestSession 的說明）。
//
// 身份仍然以 email 的 contactHash 為準，不是 Firebase Auth uid——這樣即使
// 使用者之前用過舊的匿名QR碼流程建立過同一個 email 的記錄，密碼登入時一樣能
// 正確接續回同一筆 members 文件，不會產生重複帳號。
//
// ⚠️ 這組帳號密碼的效力範圍只有這個隱藏頁面本身——不會因此獲得 bookingBetaAccess
// 或能登入完整的學生 App（LoginPage/useAuth.js 走的是完全獨立的登入邏輯）。

export async function registerGuestWithPassword(name, email, phone, password) {
  const trimmedEmail = (email || "").trim();
  if (!trimmedEmail || !password) return { ok: false, reason: "Email 與密碼為必填" };

  const tmpApp = initializeApp(firebaseConfig, "pubbook_reg_" + Date.now());
  const tmpAuth = getAuth(tmpApp);
  try {
    const cred = await createUserWithEmailAndPassword(tmpAuth, trimmedEmail, password);
    const uid = cred.user.uid;
    const contactHash = await sha256(normalizeContact(trimmedEmail));

    const q = query(
      collection(db, C_MEMBERS),
      where("accountType", "==", "guest"),
      where("contactHash", "==", contactHash),
      limit(1)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      // 這個 email 之前用匿名QR碼流程留過記錄——原地接上，不建立新文件
      const existing = snap.docs[0];
      await updateDoc(existing.ref, { uid, hasPassword: true, lastLoginAt: serverTimestamp() });
      return { ok: true, id: existing.id, ...existing.data(), uid, isNew: false };
    }

    const ref = await addDoc(collection(db, C_MEMBERS), {
      accountType: "guest", contactHash, contactRaw: trimmedEmail,
      sessionSourceId: null, uid, hasPassword: true,
      name: (name || "").trim() || "訪客射手",
      email: trimmedEmail, phone: (phone || "").trim(),
      coins: 0, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(),
    });
    return { ok: true, id: ref.id, accountType: "guest", uid, name: (name || "").trim() || "訪客射手", email: trimmedEmail, phone: (phone || "").trim(), coins: 0, isNew: true };
  } catch (e) {
    if (e?.code === "auth/email-already-in-use") return { ok: false, reason: "這個 Email 已經註冊過了，請改用「登入」" };
    if (e?.code === "auth/weak-password")        return { ok: false, reason: "密碼至少需要 6 碼" };
    if (e?.code === "auth/invalid-email")        return { ok: false, reason: "Email 格式不正確" };
    return { ok: false, reason: e?.message || "註冊失敗，請稍後再試" };
  } finally {
    deleteApp(tmpApp).catch(() => {});
  }
}

export async function loginGuestWithPassword(email, password) {
  const trimmedEmail = (email || "").trim();
  if (!trimmedEmail || !password) return { ok: false, reason: "Email 與密碼為必填" };

  const tmpApp = initializeApp(firebaseConfig, "pubbook_login_" + Date.now());
  const tmpAuth = getAuth(tmpApp);
  try {
    const cred = await signInWithEmailAndPassword(tmpAuth, trimmedEmail, password);
    // 密碼驗證通過後改用 contactHash 找回會員文件（不是靠這次登入拿到的 uid 反查）——
    // 理由同註冊那邊：這樣才能正確接續舊的匿名QR碼記錄，身份認定統一以 email 為準。
    const contactHash = await sha256(normalizeContact(trimmedEmail));
    const q = query(
      collection(db, C_MEMBERS),
      where("accountType", "==", "guest"),
      where("contactHash", "==", contactHash),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return { ok: false, reason: "找不到對應的會員記錄，請改用「註冊」或聯絡教練協助" };

    const existing = snap.docs[0];
    await updateDoc(existing.ref, { uid: cred.user.uid, lastLoginAt: serverTimestamp() });
    return { ok: true, id: existing.id, ...existing.data(), uid: cred.user.uid, isNew: false };
  } catch (e) {
    if (e?.code === "auth/invalid-credential" || e?.code === "auth/wrong-password" || e?.code === "auth/user-not-found") {
      return { ok: false, reason: "Email 或密碼不正確" };
    }
    return { ok: false, reason: e?.message || "登入失敗，請稍後再試" };
  } finally {
    deleteApp(tmpApp).catch(() => {});
  }
}
