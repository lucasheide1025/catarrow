// src/App.jsx
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Spinner } from "./components/shared/UI";
import { useState, useEffect } from "react";
import LoginPage   from "./pages/LoginPage";
import AdminApp    from "./pages/AdminApp";
import MemberApp   from "./pages/MemberApp";
import GuestBattle from "./components/member/GuestBattle";
import { getGuestSession, deleteGuestSession } from "./lib/db";
import { initGoalTracker } from "./lib/villageGoalDb";

// ── 訪客路由層：讀 ?guest=TOKEN，驗證後進 GuestBattle ──────
function GuestRoute() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | valid | expired
  const [guestId, setGuestId] = useState(null);

  useEffect(() => {
    const token = searchParams.get("guest");
    if (!token) { setStatus("expired"); return; }

    // token = btoa(guestId)，反解出 guestId
    let id;
    try {
      // btoa 產生的 base64，補回 padding
      const padded = token + "=".repeat((4 - (token.length % 4)) % 4);
      id = atob(padded);
    } catch {
      setStatus("expired");
      return;
    }

    getGuestSession(id)
      .then(session => {
        if (session) { setGuestId(id); setStatus("valid"); }
        else setStatus("expired");
      })
      .catch(() => setStatus("expired"));
  }, []); // eslint-disable-line

  if (status === "loading") return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Spinner />
    </div>
  );

  if (status === "expired") return (
    <div style={{
      minHeight:"100vh", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      gap:16, fontFamily:"sans-serif", padding:24,
      background:"linear-gradient(135deg,#1e1b4b,#312e81)",
    }}>
      <div style={{ fontSize:72 }}>⏰</div>
      <div style={{ fontSize:22, fontWeight:900, color:"white" }}>體驗連結已過期</div>
      <div style={{ fontSize:14, color:"rgba(255,255,255,.6)", textAlign:"center", lineHeight:1.8 }}>
        訪客連結有效期限為 3 小時。<br/>請向教練索取新的體驗連結。
      </div>
    </div>
  );

  return (
    <GuestBattle
      guestId={guestId}
      onExpire={() => {
        deleteGuestSession(guestId).catch(() => {});
        setStatus("expired");
      }}
    />
  );
}

// ── 主路由：有 guest 參數時跳訪客，否則走正常登入流程 ───────
function AppRoutes() {
  const { role, loading } = useAuth();
  const [searchParams] = useSearchParams();

  // 有 guest 參數 → 直接進訪客模式（不管是否已登入）
  if (searchParams.get("guest")) return <GuestRoute />;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner />
    </div>
  );
  if (!role)            return <LoginPage />;
  if (role === "admin") return <AdminApp />;
  return <MemberApp />;
}

export default function App() {
  // 啟動村目標追蹤器（訂閱 active 目標，供 addRoundArrows 貢獻箭數）
  useEffect(() => {
    const unsub = initGoalTracker();
    return () => unsub?.();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
