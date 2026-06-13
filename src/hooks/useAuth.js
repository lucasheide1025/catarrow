// src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
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
      const [adminSnap, memberSnap] = await Promise.all([
        getDoc(doc(db, "admins", fbUser.uid)),
        getDocs(memberQuery),
      ]);

      const isAdmin   = adminSnap.exists();
      const adminData = isAdmin ? adminSnap.data() : null;
      let   memberDoc = memberSnap.empty ? null : memberSnap.docs[0];

      // 教練 uid 欄位缺失時，用 email 備用查詢並補寫 uid
      if (!memberDoc && isAdmin) {
        try {
          const emailSnap = await getDocs(query(collection(db, "members"), where("email", "==", fbUser.email)));
          if (!emailSnap.empty) {
            memberDoc = emailSnap.docs[0];
            updateDoc(doc(db, "members", memberDoc.id), { uid: fbUser.uid }).catch(() => {});
          }
        } catch (e) { console.warn("教練 email 備用查詢失敗：", e.message); }
      }

      // 設定 profile，立即解除 loading
      if (memberDoc) {
        setRole(isAdmin ? "admin" : "member");
        setProfile({
          id:  memberDoc.id,
          uid: fbUser.uid,
          ...(isAdmin ? adminData : {}),
          ...memberDoc.data(),
          ...(isAdmin ? { isAdmin: true } : {}),
        });
      } else if (isAdmin) {
        setRole("admin");
        setProfile({ id: fbUser.uid, uid: fbUser.uid, ...adminData, isAdmin: true });
      } else {
        console.warn("⚠️ Auth 有此帳號，但 members 找不到 uid 符合的文件！");
        setProfile(null);
      }
      setLoading(false);

      // 背景更新最後登入時間（傳正確的 member doc id，不阻塞登入）
      if (memberDoc) updateLastLogin(memberDoc.id).catch(() => {});

      // 即時訂閱：profile 有變動時自動更新（裝備、積分等）
      profileUnsub = onSnapshot(memberQuery, (snapshot) => {
        if (snapshot.empty) return;
        const doc = snapshot.docs[0];
        setProfile(prev => prev ? { ...prev, ...doc.data(), id: doc.id } : prev);
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

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ currentUser, profile, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}