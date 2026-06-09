// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { Spinner } from "./components/shared/UI";
import LoginPage    from "./pages/LoginPage";
import AdminApp     from "./pages/AdminApp";
import MemberApp    from "./pages/MemberApp";

function AppRoutes() {
  const { role, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  if (!role)   return <LoginPage />;
  if (role === "admin")  return <AdminApp />;
  return <MemberApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
