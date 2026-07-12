// src/App.jsx
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Spinner } from "./components/shared/UI";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { useState, useEffect } from "react";
import LoginPage   from "./pages/LoginPage";
import AdminApp    from "./pages/AdminApp";
import MemberApp   from "./pages/MemberApp";
import GuestApp    from "./pages/GuestApp";
import PublicBookingApp from "./pages/PublicBookingApp";
import { initGoalTracker } from "./lib/villageGoalDb";

// 新生隱藏約課入口的 query 參數值（07-10-booking-system-student-pilot）——刻意用一串不易猜測、
// 沒有規律的字串，不要改成 "booking"/"bk=1" 這種容易猜的形式。這個常數本身只在這裡使用一次，
// 不要匯出到別的檔案或被任何導覽/連結引用，"不公開連結"才是真正的防線，這串值只是多一層保險。
const PUBLIC_BOOKING_TOKEN = "3345b3d554e6";

// ── 主路由：有 guest/kid 參數時跳訪客/兒童模式，否則走正常登入流程 ───────
// 2026-07-09 改版：訪客/兒童帳號改用信箱/電話跨次接續（見 guestAuth.js），
// 不再是 token+3小時過期的一次性連結，舊的 GuestRoute/GuestBattle 已整個淘汰。
function AppRoutes() {
  const { role, loading } = useAuth();
  const [searchParams] = useSearchParams();

  if (searchParams.get("kid"))   return <GuestApp accountType="kid"   sessionSourceId={searchParams.get("kid") === "1" ? null : searchParams.get("kid")} />;
  if (searchParams.get("guest")) return <GuestApp accountType="guest" />;
  if (searchParams.get("bk") === PUBLIC_BOOKING_TOKEN) return <PublicBookingApp />;

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
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<AppRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
