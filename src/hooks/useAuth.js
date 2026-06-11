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

      // 1. 檢查是否為 Admin（教練）
      const adminSnap = await getDoc(doc(db, "admins", fbUser.uid));

      if (adminSnap.exists()) {
        setRole("admin");
        const adminData = adminSnap.data();

        // ✅ 教練也用 query 找 members，確保 profile.id = members document ID
        // 這樣所有用 profile.id 讀庫存、打怪記錄的地方都能對到正確文件
        const memberQuery = query(
          collection(db, "members"),
          where("uid", "==", fbUser.uid)
        );

        profileUnsub = onSnapshot(memberQuery, async (snapshot) => {
          if (!snapshot.empty) {
            const memberDoc = snapshot.docs[0];
            setProfile({
              id: memberDoc.id,
              uid: fbUser.uid,
              ...adminData,
              ...memberDoc.data(),
              isAdmin: true,
            });
            setLoading(false);
          } else {
            // uid 欄位缺失或不符：用 email 備用查詢，找到後自動補寫 uid
            try {
              const emailSnap = await getDocs(
                query(collection(db, "members"), where("email", "==", fbUser.email))
              );
              if (!emailSnap.empty) {
                const memberDoc = emailSnap.docs[0];
                // 自動修正 members 文件的 uid 欄位，下次登入直接命中
                updateDoc(doc(db, "members", memberDoc.id), { uid: fbUser.uid }).catch(() => {});
                setProfile({
                  id: memberDoc.id,
                  uid: fbUser.uid,
                  ...adminData,
                  ...memberDoc.data(),
                  isAdmin: true,
                });
              } else {
                // 真的沒有 member 文件（純管理者）
                setProfile({ id: fbUser.uid, uid: fbUser.uid, ...adminData, isAdmin: true });
              }
            } catch (e) {
              console.warn("教練 members 備用查詢失敗：", e.message);
              setProfile({ id: fbUser.uid, uid: fbUser.uid, ...adminData, isAdmin: true });
            }
            setLoading(false);
          }
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