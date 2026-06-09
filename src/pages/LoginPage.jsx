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
    <div style={{minHeight:"100vh",background:"#f0f4ff",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"sans-serif"}}>
      <div style={{background:"white",borderRadius:"16px",padding:"32px",width:"100%",maxWidth:"360px",boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <div style={{textAlign:"center",marginBottom:"24px"}}>
          <div style={{fontSize:"48px"}}>🎯</div>
          <h1 style={{fontSize:"18px",fontWeight:"900",color:"#1e293b",margin:"8px 0 4px"}}>貓小隊射箭場</h1>
          <p style={{fontSize:"13px",color:"#94a3b8",margin:0}}>Barebow Indoor Archery</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
          <input
            value={email}
            onChange={e => { setEmail(e.target.value); setErr(""); }}
            placeholder="電子信箱"
            type="email"
            style={{padding:"10px 14px",border:"1px solid #e2e8f0",borderRadius:"10px",fontSize:"14px",outline:"none"}}
          />
          <input
            value={password}
            onChange={e => { setPassword(e.target.value); setErr(""); }}
            placeholder="密碼"
            type="password"
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{padding:"10px 14px",border:"1px solid #e2e8f0",borderRadius:"10px",fontSize:"14px",outline:"none"}}
          />
          {err && <p style={{color:"#ef4444",fontSize:"13px",textAlign:"center",margin:0}}>{err}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{padding:"12px",background:"#2563eb",color:"white",border:"none",borderRadius:"10px",fontSize:"15px",fontWeight:"700",cursor:"pointer"}}
          >
            {loading ? "登入中…" : "登入"}
          </button>
        </div>
      </div>
    </div>
  );
}