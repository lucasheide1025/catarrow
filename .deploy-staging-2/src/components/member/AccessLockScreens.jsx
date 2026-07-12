// src/components/member/AccessLockScreens.jsx
// 學生分級與系統鎖定 — 三種全螢幕/區塊級鎖定畫面
// 詳見 .trellis/tasks/07-04-student-tier-lock/design.md

// 系統維護鎖：一般會員前台全被擋下（教練/射手模式不受影響，呼叫端已判斷過）
export function MaintenanceScreen({ message, onLogout }) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:99999, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:16, padding:24, textAlign:"center",
      background:"linear-gradient(135deg,#0f172a,#1e293b)", fontFamily:"sans-serif",
    }}>
      <div style={{ fontSize:64 }}>🛠️</div>
      <div style={{ fontSize:22, fontWeight:900, color:"#f1f5f9" }}>系統維護中</div>
      <div style={{ fontSize:14, color:"rgba(255,255,255,0.6)", lineHeight:1.8, maxWidth:320 }}>
        {message || "系統正在維護升級，暫時無法使用，請稍候再試。"}
      </div>
      <button onClick={onLogout}
        style={{ marginTop:8, padding:"10px 24px", borderRadius:12, border:"1px solid rgba(255,255,255,0.15)",
          background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.6)", fontSize:13, cursor:"pointer" }}>
        登出
      </button>
    </div>
  );
}

// 帳號凍結：優先權高於 studentTier，全螢幕擋下一切（含報到）
export function FrozenScreen({ onLogout }) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:99999, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:16, padding:24, textAlign:"center",
      background:"linear-gradient(135deg,#1c0a00,#450a0a)", fontFamily:"sans-serif",
    }}>
      <div style={{ fontSize:64 }}>🔒</div>
      <div style={{ fontSize:22, fontWeight:900, color:"#fca5a5" }}>帳號已凍結</div>
      <div style={{ fontSize:14, color:"rgba(255,255,255,0.65)", lineHeight:1.8, maxWidth:320 }}>
        您的帳號目前已被教練凍結，暫時無法使用任何功能。<br />
        若有疑問請直接洽詢教練。
      </div>
      <button onClick={onLogout}
        style={{ marginTop:8, padding:"10px 24px", borderRadius:12, border:"1px solid rgba(255,255,255,0.15)",
          background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.7)", fontSize:13, cursor:"pointer" }}>
        登出
      </button>
    </div>
  );
}

// 頁面級鎖定提示卡：不強制跳轉，附原因說明
export function LockedFeatureCard({ reason, onBack }) {
  return (
    <div style={{ padding:"48px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:16, textAlign:"center" }}>
      <div style={{ fontSize:52 }}>🔒</div>
      <div style={{ fontSize:18, fontWeight:900, color:"var(--text-primary,#f1f5f9)" }}>尚未開放</div>
      <div style={{ fontSize:13, color:"var(--text-secondary,rgba(255,255,255,0.6))", lineHeight:1.8, maxWidth:320 }}>
        {reason || "此功能目前尚未開放，請洽詢教練。"}
      </div>
      {onBack && (
        <button onClick={onBack}
          style={{ marginTop:8, padding:"10px 24px", borderRadius:12, border:"none",
            background:"var(--accent,#2563eb)", color:"white", fontWeight:700, fontSize:13, cursor:"pointer" }}>
          返回
        </button>
      )}
    </div>
  );
}
