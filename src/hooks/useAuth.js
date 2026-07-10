// src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../lib/firebase";
import { doc, getDoc, getDocs, updateDoc, onSnapshot, query, where, collection } from "firebase/firestore";
import { db } from "../lib/firebase";
import { updateLastLogin } from "../lib/db";

const AuthContext = createContext(null);

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
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  // 用 Google 登入主 App（教練/會員帳號若是 Google 帳號用這個）。登入後 onAuthStateChanged
  // 會照常用 uid 去 members 找對應文件，找不到就等於沒有這個帳號。
  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ currentUser, profile, role, loading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}