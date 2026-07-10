// src/pages/PublicBookingApp.jsx — 新生隱藏入口：公開自助註冊＋約課（07-10-booking-system-student-pilot）
//
// 比照 src/pages/GuestApp.jsx 的獨立頂層元件模式：不掛進 AuthProvider，自己管理 profile state。
// ⚠️ 這個頁面刻意「不公開連結」——不出現在官網、不進主導覽選單，只透過 App.jsx 一個不易猜測的
// query 參數進入（見 prd.md「風險提醒」）。這個檔案本身不能被任何導覽/連結引用到，
// 否則等於自己洩漏了隱藏入口（實作後務必用 grep 全專案確認沒有殘留連結）。
import { useState, useEffect } from "react";
import { resolveGuestSession } from "../lib/guestAuth";
import { createBooking } from "../lib/bookingDb";
import { PLAN_TYPES } from "../lib/bookingSchedule";
import DateSlotPicker from "../components/booking/DateSlotPicker";

const SESSION_KEY = "public_booking_profile";

export default function PublicBookingApp() {
  // <meta name="robots" content="noindex,nofollow">：這個 App 平常都在登入後面，沒有既有的
  // per-route meta 管理機制，這裡用最小侵入的方式手動插入/移除，避免哪天不小心被搜尋引擎收錄。
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  });
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState("");

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [planType, setPlanType] = useState("general");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState("");
  const [done, setDone] = useState(false);

  async function handleRegister() {
    setErr("");
    if (!name.trim() || !email.trim() || !phone.trim()) { setErr("姓名／Email／電話皆為必填"); return; }
    setBusy(true);
    // 沿用既有訪客機制：用 email 找回/建立同一筆 members 文件（accountType:"guest"），
    // 跨次造訪同一組 email 會接續同一筆記錄，不會重複建立（design.md §4.2）。
    const res = await resolveGuestSession(email.trim(), "guest", null);
    setBusy(false);
    if (!res.ok) { setErr(res.reason || "註冊失敗，請稍後再試"); return; }
    const profileObj = { id: res.id, name: name.trim() || res.name, email: email.trim(), phone: phone.trim() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(profileObj));
    setProfile(profileObj);
  }

  async function handleSubmitBooking() {
    if (!selectedSlot) { setSubmitErr("請先選擇時段"); return; }
    setSubmitErr("");
    setSubmitting(true);
    const res = await createBooking(
      profile.id, profile.name,
      { email: profile.email, phone: profile.phone },
      planType, selectedSlot.date, selectedSlot.startTime, selectedSlot.endTime,
      "online_public",
    );
    setSubmitting(false);
    if (!res.ok) { setSubmitErr(res.reason || "預約失敗，請稍後再試"); return; }
    setDone(true);
  }

  const wrapStyle = { minHeight: "100vh", background: "#0f0a1e", fontFamily: "sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" };

  // ── 步驟一：姓名/email/電話 ──────────────────────────────
  if (!profile) {
    return (
      <div style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16, marginTop: 32 }}>
          <div style={{ fontSize: 48, textAlign: "center" }}>🏹</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "white", textAlign: "center" }}>貓小隊射箭場・線上約課</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", textAlign: "center", lineHeight: 1.6 }}>
            第一次來？留下姓名、Email、電話即可開始預約
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="姓名"
            style={inputStyle} autoFocus />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            style={inputStyle} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="電話"
            style={inputStyle} />
          {err && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>{err}</div>}
          <button onClick={handleRegister} disabled={busy} style={submitButtonStyle(busy)}>
            {busy ? "處理中…" : "🚀 開始預約"}
          </button>
        </div>
      </div>
    );
  }

  // ── 步驟二：完成畫面 ──────────────────────────────────────
  if (done) {
    return (
      <div style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 60 }}>
          <div style={{ fontSize: 56 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "white", textAlign: "center" }}>預約成功！</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.65)", textAlign: "center", lineHeight: 1.8 }}>
            {selectedSlot?.date}　{selectedSlot?.startTime}-{selectedSlot?.endTime}<br />
            我們會保留這個時段給您，現場請提早 10 分鐘到櫃檯報到
          </div>
          <button onClick={() => { setDone(false); setSelectedSlot(null); }} style={submitButtonStyle(false)}>
            ➕ 再約一個時段
          </button>
        </div>
      </div>
    );
  }

  // ── 步驟三：選時段 + 方案 + 送出 ──────────────────────────
  return (
    <div style={wrapStyle}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,.6)", textAlign: "center" }}>嗨，{profile.name}！選一個想來的時段吧</div>
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 16, padding: 16 }}>
          <DateSlotPicker selected={selectedSlot} onSelect={s => { setSelectedSlot(s); setSubmitErr(""); }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,.5)", fontWeight: 700 }}>方案類別</label>
          <select value={planType} onChange={e => setPlanType(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>
            {PLAN_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        {selectedSlot && (
          <div style={{ background: "rgba(37,99,235,.15)", border: "1px solid rgba(37,99,235,.4)", borderRadius: 12, padding: "10px 14px", color: "#93c5fd", fontSize: 13, fontWeight: 700 }}>
            已選擇：{selectedSlot.date}　{selectedSlot.startTime}-{selectedSlot.endTime}
          </div>
        )}
        {submitErr && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>{submitErr}</div>}
        <button onClick={handleSubmitBooking} disabled={submitting || !selectedSlot} style={submitButtonStyle(submitting || !selectedSlot)}>
          {submitting ? "送出中…" : "確認預約"}
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "14px 16px", borderRadius: 14, border: "2px solid rgba(124,58,237,.4)",
  background: "rgba(255,255,255,.06)", color: "white", fontSize: 16, outline: "none", boxSizing: "border-box",
};

function submitButtonStyle(disabled) {
  return {
    width: "100%", padding: 16, borderRadius: 14, border: "none",
    background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "white", fontSize: 16, fontWeight: 900,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}
