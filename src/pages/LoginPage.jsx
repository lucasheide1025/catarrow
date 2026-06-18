import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { setErr("請填寫帳號和密碼"); return; }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setErr("帳號或密碼錯誤");
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      padding:"24px", fontFamily:"sans-serif",
      background:"#0f172a",
      backgroundImage:"url(/ui/login-bg.webp)",
      backgroundSize:"cover", backgroundPosition:"center",
    }}>
      {/* 暗色遮罩確保可讀性 */}
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", pointerEvents:"none" }} />
      <div style={{
        position:"relative", zIndex:1,
        background:"rgba(15,23,42,0.82)", backdropFilter:"blur(18px)",
        borderRadius:"24px", padding:"36px 32px", width:"100%", maxWidth:"360px",
        border:"1px solid rgba(255,255,255,0.12)",
        boxShadow:"0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}>
        <div style={{textAlign:"center", marginBottom:"28px"}}>
          <div style={{fontSize:"52px", marginBottom:"8px", filter:"drop-shadow(0 0 12px rgba(99,102,241,0.7))"}}>🎯</div>
          <h1 style={{fontSize:"20px", fontWeight:"900", color:"#f1f5f9", margin:"0 0 4px", letterSpacing:"0.02em"}}>貓小隊射箭場</h1>
          <p style={{fontSize:"12px", color:"rgba(148,163,184,0.8)", margin:0, letterSpacing:"0.08em"}}>CATARROW · BAREBOW ARCHERY</p>
        </div>
        <div style={{display:"flex", flexDirection:"column", gap:"12px"}}>
          <input
            value={email}
            onChange={e => { setEmail(e.target.value); setErr(""); }}
            placeholder="電子信箱"
            type="email"
            style={{
              padding:"11px 15px", fontSize:"14px", outline:"none",
              background:"rgba(255,255,255,0.07)", color:"#f1f5f9",
              border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px",
            }}
          />
          <input
            value={password}
            onChange={e => { setPassword(e.target.value); setErr(""); }}
            placeholder="密碼"
            type="password"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{
              padding:"11px 15px", fontSize:"14px", outline:"none",
              background:"rgba(255,255,255,0.07)", color:"#f1f5f9",
              border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px",
            }}
          />
          {err && <p style={{color:"#f87171", fontSize:"13px", textAlign:"center", margin:0}}>{err}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              padding:"13px", border:"none", borderRadius:"12px",
              fontSize:"15px", fontWeight:"900", cursor:"pointer", marginTop:"4px",
              background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg,#6366f1,#2563eb)",
              color:"white", boxShadow: loading ? "none" : "0 4px 20px rgba(99,102,241,0.45)",
              transition:"all 0.2s",
            }}
          >
            {loading ? "登入中…" : "⚔️ 進入射箭場"}
          </button>
        </div>
      </div>
    </div>
  );
}