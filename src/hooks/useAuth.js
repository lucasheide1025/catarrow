// src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { doc, getDoc, onSnapshot, query, where, collection } from "firebase/firestore";
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
      console.log("🔑 當前登入的 Auth UID:", fbUser.uid);

      // 1. 檢查是否為 Admin（教練）
      const adminSnap = await getDoc(doc(db, "admins", fbUser.uid));

      if (adminSnap.exists()) {
        setRole("admin");
        const adminData = adminSnap.data();

        // 🎯 教練也訂閱自己的 members 文件，合併進 profile。
        //    ⚠️ 合併順序：admin 先鋪底，members 的資料「蓋在上面」。
        //    因為徽章、裝備、檢定的「真實值」都存在 members，admins 那份可能是舊的 0，
        //    所以要讓 members 優先，避免被 admin 的舊值蓋掉。
        const memberRef = doc(db, "members", fbUser.uid);

        profileUnsub = onSnapshot(memberRef, (snap) => {
          if (snap.exists()) {
            setProfile({
              id: fbUser.uid,
              uid: fbUser.uid,
              ...adminData,     // admin 身分欄位先鋪底
              ...snap.data(),   // members 的真實資料蓋上去（徽章、裝備、檢定…）
              isAdmin: true,
            });
          } else {
            // 沒有對應 member 文件（純管理者）
            setProfile({ id: fbUser.uid, uid: fbUser.uid, ...adminData, isAdmin: true });
          }
          setLoading(false);
        }, (err) => {
          console.warn("讀取教練 members 文件失敗，改用 admin 資料：", err.message);
          setProfile({ id: fbUser.uid, uid: fbUser.uid, ...adminData, isAdmin: true });
          setLoading(false);
        });

        await updateLastLogin(fbUser.uid);

      } else {
        // 2. 一般射手：用 uid 欄位找 member 文件
        setRole("member");
        const memberQuery = query(
          collection(db, "members"),
          where("uid", "==", fbUser.uid)
        );

        profileUnsub = onSnapshot(memberQuery, (snapshot) => {
          if (!snapshot.empty) {
            const memberDoc = snapshot.docs[0];
            console.log("🎯 成功對接會員資料！Document ID 為:", memberDoc.id);
            setProfile({
              id: memberDoc.id,
              uid: fbUser.uid,
              ...memberDoc.data(),
            });
          } else {
            console.warn("⚠️ Auth 有此帳號，但 members 找不到 uid 符合的文件！");
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("讀取 members 發生錯誤:", error);
          setLoading(false);
        });

        await updateLastLogin(fbUser.uid);
      }
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