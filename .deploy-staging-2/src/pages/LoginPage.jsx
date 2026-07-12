import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login, loginWithGoogle, linkGoogleWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");     // 有值＝進入「輸入密碼連結 Google」模式
  const [linkPassword, setLinkPassword] = useState("");

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

  async function handleGoogleLogin() {
    setErr("");
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      if (e?.code === "auth/popup-closed-by-user") setErr("已取消 Google 登入");
      else if (e?.code === "auth/popup-blocked")   setErr("瀏覽器擋了登入視窗，請允許彈出視窗後再試");
      else if (e?.code === "auth/no-member-profile") setErr("這個 Google 帳號還沒有學員資料，請先請教練建立帳號，再用 Google 登入。");
      else if (e?.code === "auth/link-password-required") {
        setLinkEmail(e.email || email || "");
        setErr("這個 Email 已有密碼帳號，輸入密碼即可連結 Google（連結後兩種方式都能登入）。");
      }
      else setErr("Google 登入失敗，請稍後再試");
    }
    setLoading(false);
  }

  async function handleLinkGoogle() {
    if (!linkPassword) { setErr("請輸入你的密碼"); return; }
    setLoading(true); setErr("");
    try {
      await linkGoogleWithPassword(linkEmail, linkPassword);
      // 成功後 onAuthStateChanged 接手自動進入 App
    } catch (e) {
      if (e?.code === "auth/wrong-password" || e?.code === "auth/invalid-credential") setErr("密碼錯誤，請再試一次");
      else if (e?.code === "auth/no-pending-link") { setLinkEmail(""); setErr("連結逾時，請重新用 Google 登入"); }
      else setErr("連結失敗，請稍後再試");
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
          {err && <p style={{color: linkEmail ? "#c7d2fe" : "#f87171", fontSize:"13px", textAlign:"center", margin:0}}>{err}</p>}

          {linkEmail && (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px", padding:"12px",
              background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.35)", borderRadius:"12px" }}>
              <div style={{ fontSize:"12px", color:"#c7d2fe" }}>連結 Google：{linkEmail}</div>
              <input
                value={linkPassword}
                onChange={e => setLinkPassword(e.target.value)}
                placeholder="輸入你的密碼"
                type="password"
                onKeyDown={e => e.key === "Enter" && handleLinkGoogle()}
                style={{ padding:"11px 15px", fontSize:"14px", outline:"none",
                  background:"rgba(255,255,255,0.07)", color:"#f1f5f9",
                  border:"1px solid rgba(255,255,255,0.15)", borderRadius:"12px" }}
              />
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={handleLinkGoogle} disabled={loading}
                  style={{ flex:1, padding:"11px", border:"none", borderRadius:"12px", fontWeight:"900",
                    fontSize:"14px", cursor:"pointer", color:"white",
                    background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg,#6366f1,#2563eb)" }}>
                  {loading ? "連結中…" : "連結並登入"}
                </button>
                <button onClick={() => { setLinkEmail(""); setLinkPassword(""); setErr(""); }}
                  style={{ padding:"11px 14px", borderRadius:"12px", fontWeight:"800", fontSize:"14px",
                    cursor:"pointer", color:"#cbd5e1", background:"rgba(255,255,255,0.06)",
                    border:"1px solid rgba(255,255,255,0.15)" }}>
                  取消
                </button>
              </div>
            </div>
          )}
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

          <div style={{ textAlign:"center", color:"rgba(148,163,184,0.6)", fontSize:"12px", margin:"2px 0" }}>或</div>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              padding:"12px", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.25)",
              fontSize:"14px", fontWeight:"800", cursor: loading ? "default" : "pointer",
              background:"#fff", color:"#1f2937",
              display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
            }}
          >
            <span style={{ fontWeight:900, color:"#4285F4" }}>G</span> 使用 Google 登入
          </button>
        </div>
      </div>
    </div>
  );
}