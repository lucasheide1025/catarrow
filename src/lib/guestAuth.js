// src/lib/guestAuth.js
// 訪客/兒童帳號的匿名登入 + 跨次造訪接續邏輯（見 .trellis/tasks/07-09-guest-kid-mode-overhaul）
import { signInAnonymously, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import {
  collection, query, where, limit, getDocs, addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { auth, db, firebaseConfig } from "./firebase";

const C_MEMBERS = "members";
const GUEST_STARTER_COINS = 500;

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
      const data = existing.data();
      const starterPatch = data.starterCoinsGranted ? {} : {
        coins: (data.coins || 0) + GUEST_STARTER_COINS,
        starterCoinsGranted: true,
      };
      const sessionPatch = sessionSourceId ? { lastSessionSourceId: sessionSourceId } : {};
      await updateDoc(existing.ref, { uid, lastLoginAt: serverTimestamp(), ...sessionPatch });
      if (Object.keys(starterPatch).length > 0) await updateDoc(existing.ref, starterPatch);
      return { ok: true, id: existing.id, ...data, ...starterPatch, uid, ...sessionPatch, isNew: false };
    }

    const ref = await addDoc(collection(db, C_MEMBERS), {
      accountType, contactHash, contactRaw: contact,
      sessionSourceId: sessionSourceId || null,
      lastSessionSourceId: sessionSourceId || null,
      uid,
      name: accountType === "kid" ? "小小射手" : "訪客射手",
      coins: GUEST_STARTER_COINS,
      starterCoinsGranted: true,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    return { ok: true, id: ref.id, accountType, uid, coins: GUEST_STARTER_COINS, isNew: true };
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
// ── Google 登入（訪客預約用）─────────────────────────────
// 只負責「跳 Google 視窗 → 拿到 email / 姓名 / uid」，不寫資料庫。
// 為什麼不順便存檔？因為預約還需要「電話」，Google 不會給電話，
// 電話要留到 UI 那格讓客人自己填，所以存檔（含電話）放到步驟 3。
export async function signInWithGoogle() {
  // 一律開隔離的臨時 App：預約頁可能開在「教練已登入」的裝置上，
  // 客人用自己的 Google 登入絕不能蓋掉教練的登入狀態（比照你密碼登入的做法）。
  const tmpApp = initializeApp(firebaseConfig, "pubbook_google_" + Date.now());
  const tmpAuth = getAuth(tmpApp);
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(tmpAuth, provider);
    const email = (result.user.email || "").trim();
    const name  = result.user.displayName || "";
    const uid   = result.user.uid;
    if (!email) return { ok: false, reason: "無法取得 Google Email，請改用其他方式登入" };

    // 防呆（修 2026-07-11 事件）：若這個 Google 帳號的 uid 已對應到「正式學員/教練」文件，
    //   就擋下來、不讓它走訪客預約——避免跟正式帳號在 members 層混淆，也提醒使用者其實有
    //   正式帳號可用（主登入頁現在也支援 Google 登入）。查不到或查詢失敗就放行（fail-open，
    //   這只是額外保護，不能擋住一般新客）。教練/正式學員文件都有 uid；訪客文件不寫 uid。
    try {
      const dupSnap = await getDocs(query(collection(db, C_MEMBERS), where("uid", "==", uid), limit(5)));
      const isOfficial = dupSnap.docs.some(d => {
        const t = d.data()?.accountType;
        return t !== "guest" && t !== "kid";
      });
      if (isOfficial) {
        return { ok: false, reason: "這個 Google 帳號已經是正式學員／教練帳號，請改用主系統登入（登入頁也支援 Google 登入），不要走訪客預約。" };
      }
    } catch { /* 查詢失敗（如未登入無 list 權限）就放行，不擋一般新客 */ }

    return { ok: true, email, name, uid };
  } catch (e) {
    if (e?.code === "auth/popup-closed-by-user") return { ok: false, reason: "已取消 Google 登入" };
    if (e?.code === "auth/popup-blocked")        return { ok: false, reason: "瀏覽器擋了登入視窗，請允許彈出視窗後再試" };
    return { ok: false, reason: e?.message || "Google 登入失敗，請稍後再試" };
  } finally {
    deleteApp(tmpApp).catch(() => {});
  }
}

// ── 社群登入後存檔（Google/FB/LINE 共用）─────────────────────
// signInWithGoogle() 只負責「證明身份、拿到 email」，這支負責「把 email＋電話存成訪客帳號」。
// 身份一律以 email 為準（算 contactHash 找回舊記錄），跟密碼註冊/登入同一套邏輯，
// 所以同一個 email 不管用密碼還是 Google 進來，都會接到「同一筆」members 文件。
// 這支只碰 Firestore、不碰 Auth，所以不用像 signInWithGoogle 那樣開隔離臨時 App。
export async function saveGuestFromSocial({ name, email, phone, uid, provider = "google" }) {
  const trimmedEmail = (email || "").trim();
  if (!trimmedEmail)           return { ok: false, reason: "缺少 Email" };
  if (!phone || !phone.trim()) return { ok: false, reason: "請留下電話，方便有狀況時聯絡你" };
  try {
    const contactHash = await sha256(normalizeContact(trimmedEmail));
    const q = query(
      collection(db, C_MEMBERS),
      where("accountType", "==", "guest"),
      where("contactHash", "==", contactHash),
      limit(1)
    );
    const snap = await getDocs(q);

    // ⚠️ 絕對不能把 Google 拿到的 uid 寫進訪客文件的「uid」欄位！
    //   useAuth.js 用 where("uid","==",fbUser.uid) 解析教練/會員登入。若教練本人用自己的
    //   Google 帳號測預約登入，signInWithGoogle 拿到的就是教練的 uid；一旦寫進訪客文件，
    //   useAuth 會同時撈到教練文件與這筆訪客文件 → 教練帳號讀不到（2026-07-11 踩過）。
    //   訪客身份本來就靠 contactHash + sessionStorage，不需要這個 uid；改存 socialUid 當純參考。
    if (!snap.empty) {
      const existing = snap.docs[0];
      await updateDoc(existing.ref, {
        socialUid: uid || null, phone: phone.trim(), socialProvider: provider, lastLoginAt: serverTimestamp(),
      });
      return { ok: true, id: existing.id, ...existing.data(), phone: phone.trim(), isNew: false };
    }

    const ref = await addDoc(collection(db, C_MEMBERS), {
      accountType: "guest", contactHash, contactRaw: trimmedEmail,
      sessionSourceId: null, socialUid: uid || null, socialProvider: provider,
      name: (name || "").trim() || "訪客射手",
      email: trimmedEmail, phone: phone.trim(),
      coins: 0, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(),
    });
    return { ok: true, id: ref.id, accountType: "guest",
      name: (name || "").trim() || "訪客射手", email: trimmedEmail, phone: phone.trim(),
      coins: 0, isNew: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "登入失敗，請稍後再試" };
  }
}
