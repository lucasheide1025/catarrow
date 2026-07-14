// src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, linkWithCredential } from "firebase/auth";
import { auth } from "../lib/firebase";
import { doc, getDoc, getDocs, updateDoc, onSnapshot, query, where, collection } from "firebase/firestore";
import { db } from "../lib/firebase";
import { updateLastLogin } from "../lib/db";

const AuthContext = createContext(null);

// 待連結的 Google 憑證：當同一個 email 已用密碼註冊、專案又是「一個 email 一個帳號」設定時，
// signInWithPopup 會丟 account-exists-with-different-credential。此時先把 Google 憑證暫存這裡，
// 等使用者用密碼登入後再 linkWithCredential 綁上去（見 loginWithGoogle / linkGoogleWithPassword）。
let pendingGoogleCred = null;

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile]         = useState(null);
  const [role, setRole]               = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    let profileUnsub = null;

    const authUnsub = onAuthStateChanged(auth, async (fbUser) => {
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }

      if (!fbUser) {
        setCurrentUser(null); setProfile(null); setRole(null);
        setLoading(false);
        return;
      }

      setCurrentUser(fbUser);

      // admin 檢查與 member 查詢同時發出，不用等一個回來再發另一個
      const memberQuery = query(collection(db, "members"), where("uid", "==", fbUser.uid));
      let adminSnap, memberSnap;
      try {
        [adminSnap, memberSnap] = await Promise.all([
          getDoc(doc(db, "admins", fbUser.uid)),
          getDocs(memberQuery),
        ]);
      } catch (e) {
        console.warn("登入查詢失敗，嘗試只查 members：", e.message);
        adminSnap = { exists: () => false };
        try { memberSnap = await getDocs(memberQuery); }
        catch { memberSnap = { empty: true, docs: [] }; }
      }

      const isAdmin   = adminSnap.exists();
      const adminData = isAdmin ? adminSnap.data() : null;
      let   memberDoc = memberSnap.empty ? null : memberSnap.docs[0];

      // uid 欄位缺失時，用 email 備用查詢（教練與一般會員都適用）
      if (!memberDoc) {
        try {
          const emailSnap = await getDocs(
            query(collection(db, "members"), where("email", "==", fbUser.email))
          );
          if (!emailSnap.empty) {
            memberDoc = emailSnap.docs[0];
            // 自動補寫 uid，下次登入直接命中
            updateDoc(doc(db, "members", memberDoc.id), { uid: fbUser.uid }).catch(() => {});
          }
        } catch (e) { console.warn("email 備用查詢失敗：", e.message); }
      }

      // 設定 profile，立即解除 loading
      if (memberDoc) {
        const mData = memberDoc.data();
        // ⚠️ 訪客/兒童帳號（accountType in ["guest","kid"]）不該透過主 App 的
        // onAuthStateChanged 自動登入——它們只透過 ?guest=1 / ?kid=xxx URL 參數
        // 由 App.jsx 直接渲染 GuestApp 來處理自己的 auth（resolveGuestSession），
        // 不經過 useAuth.js。如果讓 useAuth 設了 profile，會導致「登入過訪客帳號後
        // 切回學籍系統，無論如何都會變成訪客帳號」（2026-07-11 回報）。
        if (mData.accountType === "guest" || mData.accountType === "kid") {
          setRole(null);
          setProfile(null);
          setCurrentUser(fbUser);
          setLoading(false);
          return;
        }
        setRole(isAdmin ? "admin" : "member");
        setProfile({
          id:  memberDoc.id,
          uid: fbUser.uid,
          ...(isAdmin ? adminData : {}),
          ...mData,
          ...(isAdmin ? { isAdmin: true } : {}),
        });
      } else if (isAdmin) {
        setRole("admin");
        setProfile({ id: fbUser.uid, uid: fbUser.uid, ...adminData, isAdmin: true });
      } else {
        console.warn("⚠️ Auth 有此帳號，但 members 找不到對應文件！");
        setProfile(null);
      }
      setLoading(false);

      // 背景更新最後登入時間（傳正確的 member doc id，不阻塞登入）
      if (memberDoc) updateLastLogin(memberDoc.id).catch(() => {});

      // 即時訂閱：profile 有變動時自動更新（裝備、積分等）
      profileUnsub = onSnapshot(memberQuery, (snapshot) => {
        if (snapshot.empty) return;
        const doc = snapshot.docs[0];
        setProfile(prev => prev ? { uid: prev.uid, isAdmin: prev.isAdmin, ...doc.data(), id: doc.id } : prev);
      }, () => {});
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  async function login(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      const error = new Error("Email and password are required");
      error.code = "auth/missing-credentials";
      throw error;
    }
    const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    return cred.user;
  }

  async function resetPassword(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      const error = new Error("Email is required");
      error.code = "auth/missing-email";
      throw error;
    }
    await sendPasswordResetEmail(auth, normalizedEmail);
  }

  // 用 Google 登入主 App（教練/會員帳號若是 Google 帳號用這個）。
  //
  // 防堵孤兒帳號（2026-07-12）：Google 一登入成功，Firebase Auth 當下就建了帳號，這步無法阻止。
  // 若這人根本還不是學員（admin/members 都查無），這個帳號會殘留在 Auth，害教練日後用同一個
  // email 新增學員時撞 auth/email-already-in-use，而且會員/訪客中心都看不到（因為它只在 Auth 層）。
  // 對策：剛登入的使用者可以刪自己 → 三查（admin uid / members uid / members email）都確定沒有，
  // 就 delete() 掉這個剛建的孤兒帳號並拋出清楚錯誤。
  // ⚠️ 只有「查詢成功且確定為空」才刪；查詢失敗（網路/權限）一律不刪，避免誤刪正式會員。
  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    let cred;
    try {
      cred = await signInWithPopup(auth, provider);
    } catch (e) {
      // 同一個 email 已用密碼註冊、且專案設「一個 email 一個帳號」→ 需先用密碼登入再連結。
      // 暫存 Google 憑證，丟出特殊碼讓登入頁引導輸入密碼後呼叫 linkGoogleWithPassword。
      if (e?.code === "auth/account-exists-with-different-credential") {
        pendingGoogleCred = GoogleAuthProvider.credentialFromError(e);
        const err = new Error("需要先用密碼登入以連結 Google");
        err.code = "auth/link-password-required";
        err.email = e?.customData?.email || "";
        throw err;
      }
      throw e;
    }
    const uid = cred.user.uid;
    const email = cred.user.email;

    let hasMember;
    try {
      const [adminSnap, memberSnap] = await Promise.all([
        getDoc(doc(db, "admins", uid)),
        getDocs(query(collection(db, "members"), where("uid", "==", uid))),
      ]);
      hasMember = adminSnap.exists() || !memberSnap.empty;
      if (!hasMember && email) {
        const emailSnap = await getDocs(query(collection(db, "members"), where("email", "==", email)));
        hasMember = !emailSnap.empty;
      }
    } catch (e) {
      // 查詢失敗 → 不確定有沒有會員，寧可不刪，照常放行交給 onAuthStateChanged 處理
      console.warn("Google 登入會員檢查失敗，跳過孤兒清理：", e?.message);
      return cred.user;
    }

    if (!hasMember) {
      try { await cred.user.delete(); }        // 剛登入屬 recent auth，可直接刪自己
      catch { await signOut(auth); }           // 萬一刪除失敗，至少登出不留登入狀態
      const err = new Error("此 Google 帳號尚未建立學員資料");
      err.code = "auth/no-member-profile";
      throw err;
    }
    return cred.user;
  }

  // 用密碼登入既有帳號後，把先前待連結的 Google 憑證綁上去，讓密碼與 Google 兩種登入方式共存。
  // 綁定成功後這個帳號同時擁有 password + google.com 兩個 provider，之後直接 Google 登入就能進。
  async function linkGoogleWithPassword(email, password) {
    if (!pendingGoogleCred) {
      const e = new Error("沒有待連結的 Google 憑證，請重新用 Google 登入");
      e.code = "auth/no-pending-link";
      throw e;
    }
    const cred = await signInWithEmailAndPassword(auth, email, password); // 先證明擁有既有帳號
    const gCred = pendingGoogleCred;
    pendingGoogleCred = null;
    try {
      await linkWithCredential(cred.user, gCred);
    } catch (e) {
      // 已連結過 / 憑證被別的帳號用 → 使用者其實已用密碼登入成功，忽略連結錯誤即可
      if (e?.code !== "auth/provider-already-linked" && e?.code !== "auth/credential-already-in-use") {
        console.warn("linkWithCredential:", e?.code, e?.message);
      }
    }
    return cred.user;
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ currentUser, profile, role, loading, login, resetPassword, loginWithGoogle, linkGoogleWithPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
