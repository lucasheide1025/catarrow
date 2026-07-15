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
import { registerGuestWithPassword, loginGuestWithPassword, signInWithGoogle, saveGuestFromSocial, getGuestProfile, updateGuestProfile, changeGuestPassword } from "../lib/guestAuth";
import { createBooking, getBookingsForMember, cancelBooking, rescheduleBooking } from "../lib/bookingDb";
import { PLAN_TYPES, durationLabel, totalPrice } from "../lib/bookingSchedule";
import DateSlotPicker from "../components/booking/DateSlotPicker";
import PlanDurationPicker from "../components/booking/PlanDurationPicker";
import ParticipantCountPicker from "../components/booking/ParticipantCountPicker";
import "./PublicBookingApp.css";


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

  // 官網「會員登入」按鈕會帶 ?login=1 進來 → 直接打開前台登入畫面（未登入時才有意義）
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("login") === "1") {
      setShowLogin(true);
    }
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
  // Google 登入：登入後拿到 {email,name,uid}，再讓客人補填電話才存檔
  const [googleInfo, setGoogleInfo]   = useState(null);
  const [googlePhone, setGooglePhone] = useState("");

  // ④ 送出
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState("");
  const [done, setDone] = useState(false);
  const [pendingAuthSubmit, setPendingAuthSubmit] = useState(false); // 未登入時按送出 → 先登入，登入後自動送出
  // 登入修復的孤兒帳號可能沒電話 → 送出預約前先補（online_public 強制要電話）
  const [phonePrompt, setPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput]   = useState("");
  const [phoneErr, setPhoneErr]       = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);

  // ⑤ 會員中心（登入後：預約查詢/取消/改期、個資、改密碼、學籍、進遊戲）
  const [showMine, setShowMine]             = useState(false);
  const [myBookings, setMyBookings]         = useState([]);
  const [allBookings, setAllBookings]       = useState([]); // 含已取消的全部預約
  const [loadingMine, setLoadingMine]       = useState(false);
  const [memberTab, setMemberTab]           = useState("active"); // "active" | "history"
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [cancelTarget, setCancelTarget]     = useState(null);
  const [rescheduleErr, setRescheduleErr]   = useState("");
  const [memberDoc, setMemberDoc]     = useState(null); // 完整會員資料（accountType/hasPassword/socialProvider…）
  const [editName, setEditName]       = useState("");
  const [editPhone, setEditPhone]     = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg]   = useState("");
  const [oldPw, setOldPw]             = useState("");
  const [newPw, setNewPw]             = useState("");
  const [savingPw, setSavingPw]       = useState(false);
  const [pwMsg, setPwMsg]             = useState("");

  // ⑥ 前台登入入口（回訪訪客不用先選時段就能登入）
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (!cancelTarget && !rescheduleTarget) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [cancelTarget, rescheduleTarget]);

  // ⑦ 非必填問卷（intake）
  const [intakeExp, setIntakeExp]                 = useState(""); // 有接觸過射箭嗎
  const [intakeBow, setIntakeBow]                 = useState(""); // 想了解的弓種
  const [intakePurpose, setIntakePurpose]         = useState(""); // 來射箭的目的
  const [intakeRemark, setIntakeRemark]           = useState(""); // 其他備註
  const [intakeSystemIntro, setIntakeSystemIntro] = useState(""); // 是否需要介紹電子射箭系統

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
    setShowLogin(false);
    // 找回舊記錄且已經有預約紀錄 → 預設取消勾選「第一次來體驗」，仍可自己改
    setIsNewStudent(!(res.bookingStats?.totalBookings > 0));
  }

  // 按「用 Google 登入」→ 跳 Google 視窗，拿到 email/姓名/uid（還沒存檔，因為要補電話）
  async function handleGoogleLogin() {
    setAuthErr("");
    setAuthBusy(true);
    const res = await signInWithGoogle();
    setAuthBusy(false);
    if (!res.ok) { setAuthErr(res.reason || "Google 登入失敗"); return; }
    setGoogleInfo({ email: res.email, name: res.name, uid: res.uid, usedTempApp: res.usedTempApp });
    setGooglePhone("");
  }

  // 補填完電話 → 存成訪客帳號（email＋電話）→ finishAuth 會自動送出預約
  async function handleGooglePhoneConfirm() {
    if (!googlePhone.trim()) { setAuthErr("電話為必填，方便有狀況時第一時間聯絡你"); return; }
    setAuthBusy(true);
    const res = await saveGuestFromSocial({
      name: googleInfo.name, email: googleInfo.email,
      phone: googlePhone, uid: googleInfo.uid,
      usedTempApp: googleInfo.usedTempApp,
    });
    setAuthBusy(false);
    if (!res.ok) { setAuthErr(res.reason || "登入失敗"); return; }
    setGoogleInfo(null);
    finishAuth(res); // 沿用現成的：設 profile → useEffect 自動送出預約
  }

  // ── 會員中心：載入預約＋會員資料 ──
  async function loadMemberCenter() {
    if (!profile?.id) return;
    setLoadingMine(true);
    const [res, mDoc] = await Promise.all([
      getBookingsForMember(profile.id),
      getGuestProfile(profile.id),
    ]);
    setAllBookings(res.ok ? res.bookings : []);
    setMyBookings(res.ok ? res.bookings.filter(b => b.status === "confirmed") : []);
    setMemberDoc(mDoc);
    setEditName(mDoc?.name || profile.name || "");
    setEditPhone(mDoc?.phone || profile.phone || "");
    setLoadingMine(false);
  }
  useEffect(() => { if (showMine) loadMemberCenter(); }, [showMine]); // eslint-disable-line

  async function handleCancelBooking(id) {
    const res = await cancelBooking(id);
    setCancelTarget(null);
    if (res.ok) loadMemberCenter();
  }

  async function handleReschedule(newSlot) {
    if (!rescheduleTarget) return;
    setRescheduleErr("");
    const res = await rescheduleBooking(rescheduleTarget.id, newSlot.date, newSlot.startTime, newSlot.endTime);
    if (!res.ok) { setRescheduleErr(res.reason || "改期失敗"); return; }
    setRescheduleTarget(null);
    setRescheduleErr("");
    await loadMemberCenter();
  }

  async function handleSaveProfile() {
    setProfileMsg("");
    setSavingProfile(true);
    const res = await updateGuestProfile(profile.id, { name: editName, phone: editPhone });
    setSavingProfile(false);
    if (!res.ok) { setProfileMsg(res.reason || "更新失敗"); return; }
    setProfileMsg("已更新 ✓");
    const updated = { ...profile, name: (editName.trim() || profile.name), phone: editPhone.trim() };
    setProfile(updated);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  }

  async function handleChangePassword() {
    setPwMsg("");
    if (!oldPw || !newPw) { setPwMsg("請填寫目前密碼與新密碼"); return; }
    setSavingPw(true);
    const res = await changeGuestPassword(profile.email, oldPw, newPw);
    setSavingPw(false);
    if (!res.ok) { setPwMsg(res.reason || "改密碼失敗"); return; }
    setPwMsg("密碼已更新 ✓");
    setOldPw(""); setNewPw("");
  }

  function enterGuestGame() {
    // 進入訪客學籍系統（遊戲）。用同一個 email 進去會歸戶到同一個帳號。
    // 2026-07-12 修復：把姓名跟信箱預先寫進 sessionStorage，讓 GuestApp 直接讀取、
    // 自動填入聯絡方式與姓名，不用客戶端再手動打一次。
    const prefKey = 'guest_prefill';
    try {
      sessionStorage.setItem(prefKey, JSON.stringify({
        email: profile.email || (memberDoc?.email) || '',
        name: profile.name || (memberDoc?.name) || '',
        phone: profile.phone || (memberDoc?.phone) || '',
      }));
    } catch { /* ignore */ }
    window.location.href = "/?guest=1";
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setProfile(null); setShowMine(false);
    setSelectedSlot(null); setSlotConfirmed(false); setDone(false);
    setGoogleInfo(null);
    setCancelTarget(null); setRescheduleTarget(null);
    setName(""); setEmail(""); setPhone(""); setPassword(""); setGooglePhone("");
  }

  async function handleSubmitOrAuth() {
    if (!selectedSlot) return;
    if (!profile) {
      setPendingAuthSubmit(true);
      setShowLogin(true);
      return;
    }
    await handleSubmitBooking();
  }

  async function handleSubmitBooking() {
    if (!selectedSlot || !profile) return;
    // 沒有電話（多半是登入自我修復接回的孤兒帳號）→ 先跳一格補電話再送出
    if (!profile.phone?.trim()) {
      setPhoneInput(profile.phone || "");
      setPhoneErr("");
      setPhonePrompt(true);
      return;
    }
    await doSubmitBooking(profile);
  }

  // 真正送出（用傳入的 prof，避免 setState 非同步還沒生效就送出舊資料）
  async function doSubmitBooking(prof) {
    setSubmitErr("");
    setSubmitting(true);
    const intake = {
      experience: intakeExp || "",
      bowInterest: intakeBow || "",
      purpose: intakePurpose || "",
      remark: (intakeRemark || "").trim(),
      needSystemIntro: intakeSystemIntro || "",
    };
    const res = await createBooking(
      prof.id, prof.name,
      { email: prof.email, phone: prof.phone },
      planType, durationHours, participantCount, isNewStudent,
      selectedSlot.date, selectedSlot.startTime, selectedSlot.endTime,
      "online_public", "", intake,
    );
    setSubmitting(false);
    if (!res.ok) { setSubmitErr(res.reason || "預約失敗，請稍後再試"); return; }
    setPendingAuthSubmit(false);
    setDone(true);
  }

  // 補電話 → 存進會員文件 + 更新本地 profile → 直接用新資料送出
  async function handlePhoneConfirmAndSubmit() {
    const p = phoneInput.trim();
    if (!p) { setPhoneErr("電話為必填，方便有狀況時第一時間聯絡你"); return; }
    setPhoneSaving(true);
    const res = await updateGuestProfile(profile.id, { phone: p });
    setPhoneSaving(false);
    if (!res.ok) { setPhoneErr(res.reason || "電話儲存失敗，請稍後再試"); return; }
    const updated = { ...profile, phone: p };
    setProfile(updated);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setPhonePrompt(false);
    await doSubmitBooking(updated);
  }

  // 登入/註冊成功（profile 剛被設定）且 pendingAuthSubmit == true → 直接送出，不用使用者再多按一次
  useEffect(() => {
    if (profile && pendingAuthSubmit && selectedSlot && !submitting && !done) {
      handleSubmitBooking();
    }
  }, [profile, pendingAuthSubmit, selectedSlot, submitting, done]);

  const wrapStyle = { minHeight: "100vh", background: "#0f0a1e", fontFamily: "sans-serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" };

  // ── 完成畫面 ──────────────────────────────────────────────
  if (done) {
    return (
      <div className="public-booking-legacy-shell" style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 60 }}>
          <div style={{ fontSize: 56 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "white", textAlign: "center" }}>預約成功！</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.65)", textAlign: "center", lineHeight: 1.8 }}>
            {selectedSlot?.date}　{selectedSlot?.startTime}－{selectedSlot?.endTime}・{durationLabel(durationHours)}<br />
            我們會保留這個時段給您，現場請提早 10 分鐘到櫃檯報到
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", textAlign: "center" }}>
            下次要再約，直接用 Email／密碼登入就能找回這筆帳號，不用重填資料
          </div>
          <button onClick={() => { setDone(false); setSelectedSlot(null); setSlotConfirmed(false); }} style={submitButtonStyle(false)}>
            ➕ 再約一個時段
          </button>
          <button onClick={() => { setDone(false); setSelectedSlot(null); setSlotConfirmed(false); setShowMine(true); }}
            style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "1px solid rgba(124,58,237,.4)", background: "rgba(124,58,237,.15)", color: "#c4b5fd", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            📋 查看我的預約
          </button>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,.45)", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>登出</button>
        </div>
      </div>
    );
  }

  // ── 補電話（登入修復的孤兒帳號送出預約前）──────────────────
  if (profile && phonePrompt) {
    return (
      <div className="public-booking-legacy-shell" style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16, marginTop: 60 }}>
          <div style={{ fontSize: 40, textAlign: "center" }}>📱</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "white", textAlign: "center" }}>差一個電話就完成</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", textAlign: "center", lineHeight: 1.7 }}>
            有狀況時我們才能第一時間聯絡你，留一個電話就送出預約。
          </div>
          <input value={phoneInput} onChange={e => { setPhoneInput(e.target.value); setPhoneErr(""); }}
            name="phone" autoComplete="tel" inputMode="tel" aria-label="聯絡電話" placeholder="聯絡電話（必填）" style={inputStyle} autoFocus />
          {phoneErr && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>{phoneErr}</div>}
          <button onClick={handlePhoneConfirmAndSubmit} disabled={phoneSaving} style={submitButtonStyle(phoneSaving)}>
            {phoneSaving ? "處理中…" : "✅ 儲存並送出預約"}
          </button>
          <button onClick={() => setPhonePrompt(false)}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,.45)", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>返回</button>
        </div>
      </div>
    );
  }

  // ── ⑤ 送出中或錯誤（蓋在 main section 上方，由 slotConfirmed 或 pendingAuthSubmit 觸發）──
  if (profile && (submitting || submitErr)) {
    return (
      <div className="public-booking-legacy-shell" style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 60 }}>
          {submitErr ? (
            <>
              <div style={{ color: "#f87171", fontSize: 14, fontWeight: 700, textAlign: "center" }}>{submitErr}</div>
              <button onClick={() => { setSubmitErr(""); handleSubmitOrAuth(); }} style={submitButtonStyle(false)}>重試</button>
              <button onClick={() => { setSelectedSlot(null); setSubmitErr(""); setPendingAuthSubmit(false); }} style={submitButtonStyle(false)}>重新選時段</button>
            </>
          ) : (
            <div style={{ color: "rgba(255,255,255,.6)", fontSize: 14 }}>送出中…</div>
          )}
        </div>
      </div>
    );
  }

  // ── ⑥ 會員中心（登入後：學籍/預約/個資/改密碼/進遊戲）──────────
  if (profile && showMine) {
    const acct = memberDoc?.accountType;
    const isEnrolled = !!acct && acct !== "guest" && acct !== "kid";
    const canChangePw = !!memberDoc?.hasPassword;
    const historyBookings = allBookings.filter(b => b.status !== "confirmed");
    const activeBookings = myBookings; // confirmed

    return (
      <div className="public-booking-legacy-shell" style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
          {/* ── 頂欄 ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => setShowMine(false)} style={{ background: "none", border: "none", color: "#c4b5fd", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← 返回預約</button>
            <span style={{ color: "white", fontSize: 16, fontWeight: 900 }}>會員中心</span>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>登出</button>
          </div>

          {/* ── 帳號 / 學籍狀態 ── */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "white", flexShrink: 0 }}>
                {(memberDoc?.name || profile.name || "?").charAt(0)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "white", fontWeight: 900, fontSize: 16 }}>{memberDoc?.name || profile.name}</div>
                <div style={{ color: "rgba(255,255,255,.45)", fontSize: 12, marginTop: 1 }}>{profile.email}</div>
              </div>
            </div>
            <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: isEnrolled ? "rgba(34,197,94,.15)" : "rgba(251,191,36,.12)", border: `1px solid ${isEnrolled ? "rgba(34,197,94,.4)" : "rgba(251,191,36,.35)"}`, color: isEnrolled ? "#86efac" : "#fde68a", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
              {isEnrolled ? "🎓 正式生" : "🆕 尚未入籍（訪客）"}
            </div>
            {allBookings.length > 0 && (
              <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.5)" }}>
                <span>📅 共 {allBookings.length} 筆預約</span>
                <span>✅ {activeBookings.length} 筆進行中</span>
              </div>
            )}
          </div>

          {/* ── 進入訪客學籍系統（遊戲）── */}
          <button onClick={enterGuestGame}
            style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "linear-gradient(90deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
            🎮 進入訪客學籍系統（打怪／學籍）
          </button>

          {/* ── 預約 tabs ── */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setMemberTab("active")}
              style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: memberTab === "active" ? "2px solid #7c3aed" : "2px solid rgba(255,255,255,.15)", background: memberTab === "active" ? "rgba(124,58,237,.2)" : "rgba(255,255,255,.05)", color: memberTab === "active" ? "#c4b5fd" : "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>
              📋 進行中{activeBookings.length ? `（${activeBookings.length}）` : ""}
            </button>
            <button onClick={() => setMemberTab("history")}
              style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: memberTab === "history" ? "2px solid #7c3aed" : "2px solid rgba(255,255,255,.15)", background: memberTab === "history" ? "rgba(124,58,237,.2)" : "rgba(255,255,255,.05)", color: memberTab === "history" ? "#c4b5fd" : "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>
              🕐 歷史記錄{historyBookings.length ? `（${historyBookings.length}）` : ""}
            </button>
          </div>

          {/* ── 預約列表 ── */}
          <div style={cardStyle}>
            <div style={sectionTitle}>{memberTab === "active" ? "📋 進行中的預約" : "🕐 歷史記錄"}</div>
            {loadingMine ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid rgba(255,255,255,.1)", borderTopColor: "#7c3aed", animation: "spin 1s linear infinite" }} />
              </div>
            ) : memberTab === "active" ? (
              activeBookings.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>目前沒有進行中的預約</div>
              ) : (
                activeBookings.slice().sort((a, b) => `${a.date}_${a.startTime}`.localeCompare(`${b.date}_${b.startTime}`)).map(b => (
                  renderBookingCard(b, true, { onReschedule: setRescheduleTarget, onCancel: setCancelTarget })
                ))
              )
            ) : (
              historyBookings.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>尚無歷史記錄</div>
              ) : (
                historyBookings.slice().sort((a, b) => `${b.date}_${b.startTime}`.localeCompare(`${a.date}_${a.startTime}`)).map(b => (
                  renderBookingCard(b, false, { onReschedule: setRescheduleTarget, onCancel: setCancelTarget })
                ))
              )
            )}
          </div>

          {/* ── 個人資料 ── */}
          <div style={cardStyle}>
            <div style={sectionTitle}>👤 個人資料</div>
            <label style={{ ...labelStyle, marginTop: 8 }}>姓名
              <input value={editName} onChange={e => { setEditName(e.target.value); setProfileMsg(""); }} name="name" autoComplete="name" style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>電話
              <input value={editPhone} onChange={e => { setEditPhone(e.target.value); setProfileMsg(""); }} name="phone" autoComplete="tel" inputMode="tel" style={inputStyle} />
            </label>
            {profileMsg && <div style={{ color: profileMsg.includes("✓") ? "#86efac" : "#f87171", fontSize: 12, fontWeight: 700, marginTop: 6 }}>{profileMsg}</div>}
            <button onClick={handleSaveProfile} disabled={savingProfile} style={{ ...smallBtn, marginTop: 10 }}>{savingProfile ? "儲存中…" : "儲存個人資料"}</button>
          </div>

          {/* ── 修改密碼 ── */}
          <div style={cardStyle}>
            <div style={sectionTitle}>🔒 修改密碼</div>
            {canChangePw ? (
              <>
                <label style={{ ...labelStyle, marginTop: 8 }}>目前密碼<input value={oldPw} onChange={e => { setOldPw(e.target.value); setPwMsg(""); }} name="current-password" autoComplete="current-password" placeholder="目前密碼" type="password" style={inputStyle} /></label>
                <label style={{ ...labelStyle, marginTop: 8 }}>新密碼<input value={newPw} onChange={e => { setNewPw(e.target.value); setPwMsg(""); }} name="new-password" autoComplete="new-password" placeholder="至少 6 碼" type="password" style={inputStyle} /></label>
                {pwMsg && <div style={{ color: pwMsg.includes("✓") ? "#86efac" : "#f87171", fontSize: 12, fontWeight: 700, marginTop: 6 }}>{pwMsg}</div>}
                <button onClick={handleChangePassword} disabled={savingPw} style={{ ...smallBtn, marginTop: 10 }}>{savingPw ? "處理中…" : "更新密碼"}</button>
              </>
            ) : (
              <div style={{ ...hintStyle, textAlign: "left", padding: "8px 0" }}>你是用 Google 登入，沒有密碼、也不需要密碼。下次一樣用 Google 登入即可。</div>
            )}
          </div>
        </div>

        {/* ── 取消確認 Modal ── */}
        {cancelTarget && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overscrollBehavior: "contain" }} onClick={() => setCancelTarget(null)}>
            <div role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title" tabIndex={-1} autoFocus style={{ background: "#1e1b4b", border: "1px solid rgba(124,58,237,.3)", borderRadius: 20, padding: 24, maxWidth: 360, width: "100%" }} onClick={e => e.stopPropagation()}>
              <div id="cancel-booking-title" style={{ color: "white", fontWeight: 900, fontSize: 16, marginBottom: 8 }}>確認取消預約</div>
              <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, lineHeight: 1.7 }}>確定要取消 {cancelTarget.date} {cancelTarget.startTime}－{cancelTarget.endTime}（{durationLabel(cancelTarget.durationHours || 1)}）的預約嗎？</div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setCancelTarget(null)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,.2)", background: "transparent", color: "rgba(255,255,255,.6)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>返回</button>
                <button onClick={() => handleCancelBooking(cancelTarget.id)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "white", fontSize: 14, fontWeight: 900, cursor: "pointer" }}>確認取消</button>
              </div>
            </div>
          </div>
        )}

        {/* ── 改期 Modal ── */}
        {rescheduleTarget && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflowY: "auto", overscrollBehavior: "contain" }} onClick={() => { setRescheduleTarget(null); setRescheduleErr(""); }}>
            <div role="dialog" aria-modal="true" aria-labelledby="reschedule-booking-title" tabIndex={-1} autoFocus style={{ background: "#1e1b4b", border: "1px solid rgba(124,58,237,.3)", borderRadius: 20, padding: 24, maxWidth: 420, width: "100%", margin: "auto" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span id="reschedule-booking-title" style={{ color: "white", fontWeight: 900, fontSize: 16 }}>改期</span>
                <button aria-label="關閉改期視窗" onClick={() => setRescheduleTarget(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginBottom: 16 }}>
                原時段：{rescheduleTarget.date} {rescheduleTarget.startTime}-{rescheduleTarget.endTime}（{durationLabel(rescheduleTarget.durationHours || 1)}・{rescheduleTarget.participantCount || 1}人）
              </div>
              {rescheduleErr && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{rescheduleErr}</div>}
              <ReschedulePicker booking={rescheduleTarget} onConfirm={handleReschedule} onCancel={() => { setRescheduleTarget(null); setRescheduleErr(""); }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── ③ showLogin（含前台登入入口 或是 按了送出但未登入）→ 顯示身份表單 ─────────────
  if (showLogin && !profile) {
    return (
      <div className="public-booking-legacy-shell" style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          {selectedSlot ? (
            <div style={{ background: "rgba(37,99,235,.15)", border: "1px solid rgba(37,99,235,.4)", borderRadius: 12, padding: "10px 14px", color: "#93c5fd", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
              已選擇：{selectedSlot.date}　{selectedSlot.startTime}－{selectedSlot.endTime}・{durationLabel(durationHours)}・{participantCount}人
              <button onClick={() => { setPendingAuthSubmit(false); setSelectedSlot(null); }} style={{ display: "block", margin: "6px auto 0", background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>
                重新選時段
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => { setShowLogin(false); setPendingAuthSubmit(false); setAuthErr(""); setGoogleInfo(null); }} style={{ background: "none", border: "none", color: "#c4b5fd", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← 返回</button>
              <span style={{ color: "white", fontSize: 16, fontWeight: 900 }}>登入</span>
              <span style={{ width: 40 }} />
            </div>
          )}

          {googleInfo ? (
            // ── Google 登入成功 → 只差一格電話 ──
            <>
              <div style={{ color: "#93c5fd", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                已用 Google 登入：{googleInfo.email}
              </div>
              <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12, textAlign: "center", lineHeight: 1.7 }}>
                再留一個電話就完成——電話為必填，有狀況我們才能第一時間聯絡你。
              </div>
              <input value={googlePhone} onChange={e => setGooglePhone(e.target.value)} name="phone" autoComplete="tel" inputMode="tel"
                aria-label="聯絡電話" placeholder="聯絡電話（必填）" style={inputStyle} autoFocus />
              {authErr && <div style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>{authErr}</div>}
              <button onClick={handleGooglePhoneConfirm} disabled={authBusy} style={submitButtonStyle(authBusy)}>
                {authBusy ? "處理中…" : "✅ 完成並預約"}
              </button>
              <button onClick={() => { setGoogleInfo(null); setAuthErr(""); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 12, textDecoration: "underline", cursor: "pointer" }}>
                改用其他方式
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setAuthTab("register"); setAuthErr(""); }}
                  style={tabButtonStyle(authTab === "register")}>第一次來（註冊）</button>
                <button onClick={() => { setAuthTab("login"); setAuthErr(""); }}
                  style={tabButtonStyle(authTab === "login")}>已有帳號（登入）</button>
              </div>

              {authTab === "register" ? (
                <>
                  <label style={labelStyle}>姓名<input value={name} onChange={e => setName(e.target.value)} name="name" autoComplete="name" placeholder="請輸入姓名" style={inputStyle} autoFocus /></label>
                  <label style={labelStyle}>Email<input value={email} onChange={e => setEmail(e.target.value)} name="email" autoComplete="email" inputMode="email" placeholder="name@example.com" type="email" style={inputStyle} /></label>
                  <label style={labelStyle}>電話<input value={phone} onChange={e => setPhone(e.target.value)} name="phone" autoComplete="tel" inputMode="tel" placeholder="聯絡電話" style={inputStyle} /></label>
                  <label style={labelStyle}>設定密碼<input value={password} onChange={e => setPassword(e.target.value)} name="new-password" autoComplete="new-password" placeholder="至少 6 碼" type="password" style={inputStyle} /></label>
                </>
              ) : (
                <>
                  <label style={labelStyle}>Email<input value={email} onChange={e => setEmail(e.target.value)} name="email" autoComplete="email" inputMode="email" placeholder="name@example.com" type="email" style={inputStyle} autoFocus /></label>
                  <label style={labelStyle}>密碼<input value={password} onChange={e => setPassword(e.target.value)} name="current-password" autoComplete="current-password" placeholder="密碼" type="password" style={inputStyle} /></label>
                </>
              )}

              {authErr && <div role="alert" aria-live="polite" style={{ color: "#f87171", fontSize: 13, fontWeight: 700 }}>{authErr}</div>}
              <button onClick={handleAuth} disabled={authBusy} style={submitButtonStyle(authBusy)}>
                {authBusy ? "處理中…" : authTab === "register" ? "🚀 完成註冊並預約" : "🔑 登入並預約"}
              </button>

              <div style={{ textAlign: "center", color: "rgba(255,255,255,.35)", fontSize: 12, margin: "4px 0" }}>或</div>
              <button onClick={handleGoogleLogin} disabled={authBusy}
                style={{ width: "100%", minHeight: 48, borderRadius: 12, border: "1px solid rgba(255,255,255,.25)",
                  background: "#fff", color: "#1f2937", fontWeight: 800, cursor: authBusy ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontWeight: 900, color: "#4285F4" }}>G</span> 用 Google 登入
              </button>
            </>
          )}
        </div>
      </div>
    );
  }



  // ── ① 選方案+人數+時段（尚未選好時段的畫面）──
  return (
    <main className="public-booking-shell">
      <div className="public-booking-page">
        <header className="public-booking-header">
          <a href="https://archery.catgroup.com.tw/" className="public-booking-back">← 返回首頁</a>
          <button className="public-booking-account" onClick={() => profile ? setShowMine(true) : (setShowLogin(true), setAuthTab("login"), setAuthErr(""))}>
            {profile ? "我的預約" : "會員登入"}
          </button>
        </header>
        <section className="public-booking-hero">
          <p className="public-booking-kicker">CATGROUP ARCHERY</p>
          <h1>把時間留給一場<br />專注而自在的射箭體驗</h1>
          <p>選擇方案、日期與時段，登入後即可完成預約。</p>
          <div className="public-booking-actions">
            <a href="#booking-form" className="public-booking-primary">立即預約</a>
            <button onClick={() => profile ? setShowMine(true) : (setShowLogin(true), setAuthTab("login"))} className="public-booking-secondary">{profile ? "查看我的預約" : "會員中心登入"}</button>
          </div>
        </section>

        <div className="public-booking-notice"><strong>預約提醒</strong><span>已有學籍的學員請使用學員 App；訪客與體驗課可直接在此預約。</span></div>

        <section id="booking-form" className="public-booking-grid">
          <div className="public-booking-main">
            <div className="public-booking-card"><span className="public-booking-step">01</span><h2>選擇課程方案</h2>
              <PlanDurationPicker planType={planType} durationHours={durationHours}
                onChange={({ planType: pt, durationHours: dh }) => { setPlanType(pt); setDurationHours(dh); setSelectedSlot(null); }} />
              <ParticipantCountPicker value={participantCount} onChange={n => { setParticipantCount(n); setSelectedSlot(null); }} />
            </div>
            <div className="public-booking-card"><span className="public-booking-step">02</span><h2>選擇日期與時段</h2>
              <DateSlotPicker selected={selectedSlot} onSelect={s => setSelectedSlot(s)} durationHours={durationHours}
                participantCount={participantCount} availabilityDisplay="public" bookingWindow="public-month" />
            </div>
          </div>
          <aside className="public-booking-summary">
            <span className="public-booking-step">03</span><h2>確認預約內容</h2>
            <dl>
              <div><dt>方案</dt><dd>{PLAN_TYPES.find(p => p.id === planType)?.label || planType}</dd></div>
              <div><dt>時數</dt><dd>{durationLabel(durationHours)}</dd></div><div><dt>人數</dt><dd>{participantCount} 人</dd></div>
              <div><dt>日期</dt><dd>{selectedSlot?.date || "尚未選擇"}</dd></div>
              <div><dt>時間</dt><dd>{selectedSlot ? `${selectedSlot.startTime}－${selectedSlot.endTime}` : "尚未選擇"}</dd></div>
              <div className="public-booking-total"><dt>總金額</dt><dd>NT$ {totalPrice(planType, durationHours, participantCount)}</dd></div>
            </dl>
            <button onClick={handleSubmitOrAuth} disabled={!selectedSlot || submitting} className="public-booking-submit">
              {submitting ? "送出中…" : profile ? "送出預約" : "登入並完成預約"}
            </button>
          </aside>
        </section>

        <label className="public-booking-first-visit">
          <input type="checkbox" checked={isNewStudent} onChange={e => setIsNewStudent(e.target.checked)}
            style={{ width: 16, height: 16 }} />
          是否為第一次來體驗
        </label>

        {/* ── 提醒 ── */}
        <div className="public-booking-safety">
          ⚠️ 5 歲以下無法參與射箭；10 歲以下需大人全程陪同。<br />
          👕 建議穿短袖；場內有貓咪，會過敏或不喜歡貓的朋友請斟酌。
        </div>

        {/* ── 非必填問卷 ── */}
        <details className="public-booking-optional" open>
        <summary>其他需求（選填）</summary><div className="public-booking-optional-fields">
        <label style={labelStyle}>有接觸過射箭嗎？
          <select name="archery-experience" value={intakeExp} onChange={e => setIntakeExp(e.target.value)} style={inputStyle}>
            <option style={optStyle} value="">不指定</option>
            <option style={optStyle} value="新手">新手</option>
            <option style={optStyle} value="接觸過">接觸過（夜市、觀光景點、體驗課）</option>
            <option style={optStyle} value="熟悉">熟悉（可自行操作）</option>
          </select>
        </label>

        <label style={labelStyle}>想了解的弓種
          <select name="bow-interest" value={intakeBow} onChange={e => setIntakeBow(e.target.value)} style={inputStyle}>
            <option style={optStyle} value="">不指定</option>
            <option style={optStyle} value="競技反曲弓">競技反曲弓</option>
            <option style={optStyle} value="美式獵弓">美式獵弓</option>
            <option style={optStyle} value="傳統弓">傳統弓</option>
            <option style={optStyle} value="沒概念">沒概念</option>
          </select>
        </label>

        <label style={labelStyle}>來射箭的目的
          <select name="visit-purpose" value={intakePurpose} onChange={e => setIntakePurpose(e.target.value)} style={inputStyle}>
            <option style={optStyle} value="">不指定</option>
            <option style={optStyle} value="純粹玩樂">純粹玩樂</option>
            <option style={optStyle} value="體驗">體驗</option>
            <option style={optStyle} value="正式學習">正式學習</option>
          </select>
        </label>

        <label style={labelStyle}>是否需要介紹電子射箭系統
          <select name="system-introduction" value={intakeSystemIntro} onChange={e => setIntakeSystemIntro(e.target.value)} style={inputStyle}>
            <option style={optStyle} value="">不指定</option>
            <option style={optStyle} value="是">是</option>
            <option style={optStyle} value="否">否</option>
          </select>
        </label>

        <label style={labelStyle}>其他備註需求
          <textarea name="booking-note" value={intakeRemark} onChange={e => setIntakeRemark(e.target.value)} rows={2}
            placeholder="有任何特殊需求可以在這裡告訴我們" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </label></div></details>
        <div aria-live="polite" role="status">{submitErr}</div>
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%", padding: "14px 16px", borderRadius: 14, border: "2px solid rgba(124,58,237,.4)",
  background: "rgba(255,255,255,.06)", color: "white", fontSize: 16, outline: "none", boxSizing: "border-box",
  // colorScheme:"dark" 讓 <select> 展開的原生下拉用深色渲染，避免白底白字看不見
  colorScheme: "dark",
};

// <option> 深色底＋白字：colorScheme 在部分瀏覽器不生效，直接給每個 option 上這個最可靠
const optStyle = { background: "#1a1030", color: "#ffffff" };

const labelStyle = {
  display: "flex", flexDirection: "column", gap: 6,
  fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.75)",
};

const cardStyle    = { background: "rgba(255,255,255,.06)", borderRadius: 16, padding: "14px 16px" };
const sectionTitle = { color: "white", fontWeight: 900, fontSize: 15 };
const hintStyle    = { color: "rgba(255,255,255,.5)", fontSize: 13, textAlign: "center", padding: "12px 0" };
const smallBtn     = { width: "100%", padding: "11px 0", borderRadius: 12, border: "none", background: "linear-gradient(90deg,#fbbf24,#f59e0b)", color: "#7c2d12", fontWeight: 800, fontSize: 14, cursor: "pointer" };

// ── 預約卡片渲染函式（模組層級，避免每次 render 重建元件）──
function renderBookingCard(b, showActions, callbacks) {
  const { onReschedule, onCancel } = callbacks;
  const statusLabel = b.status === "cancelled" ? "已取消" : b.status === "confirmed" ? "已確認" : b.status;
  return (
    <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{b.date}　{b.startTime}-{b.endTime}</span>
          {b.status !== "confirmed" && (
            <span style={{ fontSize: 11, color: "#f87171", fontWeight: 600, background: "rgba(239,68,68,.12)", borderRadius: 999, padding: "1px 8px" }}>{statusLabel}</span>
          )}
        </div>
        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, marginTop: 2 }}>
          {PLAN_TYPES.find(p => p.id === b.planType)?.label || b.planType}・{durationLabel(b.durationHours || 1)}・{b.participantCount || 1}人・NT$ {totalPrice(b.planType, b.durationHours || 1, b.participantCount || 1)}
        </div>
      </div>
      {showActions && b.status === "confirmed" && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onReschedule(b)}
            style={{ background: "rgba(96,165,250,.15)", border: "1px solid rgba(96,165,250,.35)", color: "#93c5fd", borderRadius: 10, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>改期</button>
          <button onClick={() => onCancel(b)}
            style={{ background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.4)", color: "#f87171", borderRadius: 10, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>取消</button>
        </div>
      )}
    </div>
  );
}

// ── 改期時段選擇器（模組層級元件）──
function ReschedulePicker({ booking, onConfirm, onCancel }) {
  const [slot, setSlot] = useState(null);
  const durationHours = booking.durationHours || 1;
  const participantCount = booking.participantCount || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <DateSlotPicker selected={slot} onSelect={setSlot} durationHours={durationHours} participantCount={participantCount} availabilityDisplay="public" bookingWindow="public-month" />
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,.2)", background: "transparent", color: "rgba(255,255,255,.6)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>取消</button>
        <button disabled={!slot} onClick={() => onConfirm(slot)}
          style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: slot ? "linear-gradient(135deg,#7c3aed,#2563eb)" : "rgba(255,255,255,.1)", color: slot ? "white" : "rgba(255,255,255,.3)", fontSize: 14, fontWeight: 900, cursor: slot ? "pointer" : "default" }}>
          確認改期
        </button>
      </div>
    </div>
  );
}

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
