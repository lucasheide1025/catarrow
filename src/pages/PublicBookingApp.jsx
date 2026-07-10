// src/pages/PublicBookingApp.jsx — 新生隱藏入口：先選時段+人數，確認後才Email+密碼註冊/登入（07-10-booking-system-student-pilot ＋ 07-10-public-booking-password-auth ＋ 07-10-booking-ui-polish-headcount）
//
// 比照 src/pages/GuestApp.jsx 的獨立頂層元件模式：不掛進 AuthProvider，自己管理 profile state。
// ⚠️ 這個頁面刻意「不公開連結」——不出現在官網、不進主導覽選單，只透過 App.jsx 一個不易猜測的
// query 參數進入（見 prd.md「風險提醒」）。這個檔案本身不能被任何導覽/連結引用到，
// 否則等於自己洩漏了隱藏入口（實作後務必用 grep 全專案確認沒有殘留連結）。
//
// 流程：
//   ① 選方案+時數+人數+時段（不用先登入，人數會即時檢查該時段是否塞得下）
//   ② 選完先看「確認預約」（完整顯示方案/時數/人數/金額），按確認才往下走
//   ③ 確認後才出現「註冊」／「登入」——註冊留密碼，之後回訪可以直接登入找回同一筆記錄
//   ④ 登入/註冊成功後自動用①②選好的內容送出，不用再點一次
// 註冊/登入都呼叫 guestAuth.js 的 registerGuestWithPassword/loginGuestWithPassword，
// 那邊已經處理好「隔離臨時Firebase App、不能動到這台裝置上教練自己的登入」這件事，
// 這個檔案不需要、也不應該自己碰 Firebase Auth。
import { useState, useEffect } from "react";
import { registerGuestWithPassword, loginGuestWithPassword } from "../lib/guestAuth";
import { createBooking } from "../lib/bookingDb";
import DateSlotPicker from "../components/booking/DateSlotPicker";
import PlanDurationPicker from "../components/booking/PlanDurationPicker";
import ParticipantCountPicker from "../components/booking/ParticipantCountPicker";
import ConfirmBookingModal from "../components/booking/ConfirmBookingModal";

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

  // ① 方案/人數/時段選擇（不用登入就能選）
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [planType, setPlanType] = useState("general");
  const [durationHours, setDurationHours] = useState(1);
  const [participantCount, setParticipantCount] = useState(1);
  const [isNewStudent, setIsNewStudent] = useState(true); // 這個入口大多是新客，預設勾選，回訪舊客可自己取消

  // ② 確認預約
  const [slotConfirmed, setSlotConfirmed] = useState(false);

  // ③ 註冊/登入表單
  const [authTab, setAuthTab] = useState("register"); // "register" | "login"
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr]   = useState("");

  // ④ 送出
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState("");
  const [done, setDone] = useState(false);

  async function handleAuth() {
    setAuthErr("");
    if (authTab === "register") {
      if (!name.trim() || !email.trim() || !phone.trim() || !password) { setAuthErr("姓名／Email／電話／密碼皆為必填"); return; }
      setAuthBusy(true);
      const res = await registerGuestWithPassword(name, email, phone, password);
      setAuthBusy(false);
      if (!res.ok) { setAuthErr(res.reason || "註冊失敗，請稍後再試"); return; }
      finishAuth(res);
    } else {
      if (!email.trim() || !password) { setAuthErr("Email／密碼皆為必填"); return; }
      setAuthBusy(true);
      const res = await loginGuestWithPassword(email, password);
      setAuthBusy(false);
      if (!res.ok) { setAuthErr(res.reason || "登入失敗，請稍後再試"); return; }
      finishAuth(res);
    }
  }

  function finishAuth(res) {
    const profileObj = { id: res.id, name: res.name || name.trim() || "訪客射手", email: res.email || email.trim(), phone: res.phone || phone.trim() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(profileObj));
    setProfile(profileObj);
    // 找回舊記錄且已經有預約紀錄 → 預設取消勾選「第一次來體驗」，仍可自己改
    setIsNewStudent(!(res.bookingStats?.totalBookings > 0));
  }

  async function handleSubmitBooking() {
    if (!selectedSlot || !profile) return;
    setSubmitErr("");
    setSubmitting(true);
    const res = await createBooking(
      profile.id, profile.name,
      { email: profile.email, phone: profile.phone },
      planType, durationHours, participantCount, isNewStudent,
      selectedSlot.date, selectedSlot.startTime, selectedSlot.endTime,
      "online_public",
    );
    setSubmitting(false);
    if (!res.ok) { setSubmitErr(res.reason || "預約失敗，請稍後再試"); return; }
    setDone(true);
  }

  // 登入/註冊成功（profile 剛被設定）且時段已經確認過 → 直接送出，不用使用者再多按一次
  useEffect(() => {
    if (profile && slotConfirmed && selectedSlot && !submitting && !done) {
      handleSubmitBooking();
    }
  }, [profile]); // eslint-disable-line

  const wrapStyle = { minHeight: "100vh", background: "#0f0a1e", fontFamily: "sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" };

  // ── 完成畫面 ──────────────────────────────────────────────
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
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", textAlign: "center" }}>
            下次要再約，直接用 Email／密碼登入就能找回這筆帳號，不用重填資料
          </div>
          <button onClick={() => { setDone(false); setSelectedSlot(null); setSlotConfirmed(false); }} style={submitButtonStyle(false)}>
            ➕ 再約一個時段
          </button>
        </div>
      </div>
    );
  }

  // ── ③ 時段已確認但還沒登入/註冊 → 顯示身份表單 ─────────────
  if (slotConfirmed && !profile) {
    return (
      <div style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          <div style={{ background: "rgba(37,99,235,.15)", border: "1px solid rgba(37,99,235,.4)", borderRadius: 12, padding: "10px 14px", color: "#93c5fd", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
            已選擇：{selectedSlot.date}　{selectedSlot.startTime}-{selectedSlot.endTime}・{participantCount}人
            <button onClick={() => { setSlotConfirmed(false); setSelectedSlot(null); }} style={{ display: "block", margin: "6px auto 0", background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>
              重新選時段
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setAuthTab("register"); setAuthErr(""); }}
              style={tabButtonStyle(authTab === "register")}>第一次來（註冊）</button>
            <button onClick={() => { setAuthTab("login"); setAuthErr(""); }}
              style={tabButtonStyle(authTab === "login")}>已有帳號（登入）</button>
          </div>

          {authTab === "register" ? (
            <>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="姓名" style={inputStyle} autoFocus />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="電話" style={inputStyle} />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="設定密碼（至少6碼）" type="password" style={inputStyle} />
            </>
          ) : (
            <>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={inputStyle} autoFocus />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="密碼" type="password" style={inputStyle} />
            </>
          )}

          {authErr && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>{authErr}</div>}
          <button onClick={handleAuth} disabled={authBusy} style={submitButtonStyle(authBusy)}>
            {authBusy ? "處理中…" : authTab === "register" ? "🚀 完成註冊並預約" : "🔑 登入並預約"}
          </button>
        </div>
      </div>
    );
  }

  // ── 已登入但還在等自動送出（正常情況下這個畫面只會閃現一下）──
  if (profile && slotConfirmed && (submitting || submitErr)) {
    return (
      <div style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 60 }}>
          {submitErr ? (
            <>
              <div style={{ color: "#f87171", fontSize: 14, fontWeight: 700, textAlign: "center" }}>{submitErr}</div>
              <button onClick={() => { setSlotConfirmed(false); setSelectedSlot(null); setSubmitErr(""); }} style={submitButtonStyle(false)}>重新選時段</button>
            </>
          ) : (
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 14 }}>送出中…</div>
          )}
        </div>
      </div>
    );
  }

  // ── ① 選方案+人數+時段（尚未選好時段的畫面）──
  return (
    <div style={wrapStyle}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
        <div style={{ fontSize: 48, textAlign: "center" }}>🏹</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "white", textAlign: "center" }}>貓小隊射箭場・線上約課</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", textAlign: "center", lineHeight: 1.6 }}>
          先選想來的方案跟時段，選完再留資料
        </div>

        <PlanDurationPicker planType={planType} durationHours={durationHours}
          onChange={({ planType: pt, durationHours: dh }) => { setPlanType(pt); setDurationHours(dh); setSelectedSlot(null); }} />
        <ParticipantCountPicker value={participantCount}
          onChange={n => { setParticipantCount(n); setSelectedSlot(null); }} />
        <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 16, padding: 16 }}>
          <DateSlotPicker selected={selectedSlot} onSelect={s => setSelectedSlot(s)}
            durationHours={durationHours} participantCount={participantCount} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,.75)", fontWeight: 700, cursor: "pointer" }}>
          <input type="checkbox" checked={isNewStudent} onChange={e => setIsNewStudent(e.target.checked)}
            style={{ width: 16, height: 16 }} />
          是否為第一次來體驗
        </label>
      </div>

      {selectedSlot && !slotConfirmed && (
        <ConfirmBookingModal slot={selectedSlot} planType={planType} durationHours={durationHours}
          participantCount={participantCount} confirmLabel="確認，下一步"
          onConfirm={() => setSlotConfirmed(true)}
          onCancel={() => setSelectedSlot(null)} />
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "14px 16px", borderRadius: 14, border: "2px solid rgba(124,58,237,.4)",
  background: "rgba(255,255,255,.06)", color: "white", fontSize: 16, outline: "none", boxSizing: "border-box",
};

function tabButtonStyle(active) {
  return {
    flex: 1, padding: "10px 12px", borderRadius: 12, border: active ? "2px solid #7c3aed" : "2px solid rgba(255,255,255,.15)",
    background: active ? "rgba(124,58,237,.2)" : "rgba(255,255,255,.05)", color: active ? "#c4b5fd" : "rgba(255,255,255,.6)",
    fontSize: 13, fontWeight: 900, cursor: "pointer",
  };
}

function submitButtonStyle(disabled) {
  return {
    width: "100%", padding: 16, borderRadius: 14, border: "none",
    background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "white", fontSize: 16, fontWeight: 900,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
  };
}
