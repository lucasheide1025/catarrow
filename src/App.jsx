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
import { CostControlProvider } from "./hooks/useCostControl";

// 新生隱藏約課入口的 query 參數值（07-10-booking-system-student-pilot）——刻意用一串不易猜測、
// 沒有規律的字串，不要改成 "booking"/"bk=1" 這種容易猜的形式。這個常數本身只在這裡使用一次，
// 不要匯出到別的檔案或被任何導覽/連結引用，"不公開連結"才是真正的防線，這串值只是多一層保險。
const PUBLIC_BOOKING_TOKEN = "3345b3d554e6";

// ── 主路由：有 guest/kid 參數時跳訪客/兒童模式，否則走正常登入流程 ───────
// 2026-07-09 改版：訪客/兒童帳號改用信箱/電話跨次接續（見 guestAuth.js），
// 不再是 token+3小時過期的一次性連結，舊的 GuestRoute/GuestBattle 已整個淘汰。
function AppRoutes() {
  const { role, loading, currentUser, logout, profileError } = useAuth();
  const [searchParams] = useSearchParams();

  if (searchParams.get("kid"))   return <GuestApp accountType="kid"   sessionSourceId={searchParams.get("kid") === "1" ? null : searchParams.get("kid")} />;
  if (searchParams.get("guest")) return <GuestApp accountType="guest" />;
  if (searchParams.get("bk") === PUBLIC_BOOKING_TOKEN) return <PublicBookingApp />;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner />
    </div>
  );
  // Auth 登入成功、但 members 查無對應學員資料（email 對不上、uid 未綁定，或帳號類型為訪客/兒童）。
  // 原本這種情況會靜默彈回登入頁，使用者只看到「密碼對了卻進不去」而毫無線索，
  // 教練端也難以判斷。改為明確說明並附上帳號 email，方便教練直接比對學員資料。
  if (!role && currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <div className="text-5xl">🔍</div>
          <h1 className="mt-4 text-xl font-black text-slate-100">
            {profileError === "guest-account" ? "這是體驗帳號，無法登入學籍系統"
              : profileError === "query-failed" ? "資料讀取失敗，暫時無法登入"
              : "登入成功，但查不到學員資料"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {profileError === "guest-account"
              ? "這個 Email 目前被設定為訪客／兒童體驗帳號。請教練到後台把它改為正式學員帳號。"
              : profileError === "query-failed"
                ? "網路或權限問題導致讀不到學員資料，請稍後再試；若持續發生請通知教練。"
                : "這個帳號已通過驗證，但系統找不到對應的學員檔案。請把下面這個 Email 提供給教練確認學員資料設定。"}
          </p>
          <p className="mt-3 break-all rounded-xl bg-slate-800/70 px-3 py-2 text-sm font-bold text-amber-300">
            {currentUser.email || "（此帳號無 Email）"}
          </p>
          <button type="button" onClick={() => logout?.()}
            className="mt-5 min-h-11 w-full rounded-2xl bg-slate-700 px-4 font-black text-slate-100">
            返回登入畫面
          </button>
        </div>
      </div>
    );
  }
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
        <CostControlProvider>
          <BrowserRouter>
            <Routes>
              <Route path="*" element={<AppRoutes />} />
            </Routes>
          </BrowserRouter>
        </CostControlProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
