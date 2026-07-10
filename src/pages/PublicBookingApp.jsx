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
import { createBooking, getBookingsForMember, cancelBooking } from "../lib/bookingDb";
import { PLAN_TYPES, durationLabel, totalPrice } from "../lib/bookingSchedule";
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
  // Google 登入：登入後拿到 {email,name,uid}，再讓客人補填電話才存檔
  const [googleInfo, setGoogleInfo]   = useState(null);
  const [googlePhone, setGooglePhone] = useState("");

  // ④ 送出
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr]   = useState("");
  const [done, setDone] = useState(false);

  // ⑤ 會員中心（登入後：預約查詢/取消、個資、改密碼、學籍、進遊戲）
  const [showMine, setShowMine]       = useState(false);
  const [myBookings, setMyBookings]   = useState([]);
  const [loadingMine, setLoadingMine] = useState(false);
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
    setShowLogin(false); // 前台登入入口用完關掉
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
    setGoogleInfo({ email: res.email, name: res.name, uid: res.uid });
    setGooglePhone("");
  }

  // 補填完電話 → 存成訪客帳號（email＋電話）→ finishAuth 會自動送出預約
  async function handleGooglePhoneConfirm() {
    if (!googlePhone.trim()) { setAuthErr("電話為必填，方便有狀況時第一時間聯絡你"); return; }
    setAuthBusy(true);
    const res = await saveGuestFromSocial({
      name: googleInfo.name, email: googleInfo.email,
      phone: googlePhone, uid: googleInfo.uid,
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
    setMyBookings(res.ok ? res.bookings.filter(b => b.status === "confirmed") : []);
    setMemberDoc(mDoc);
    setEditName(mDoc?.name || profile.name || "");
    setEditPhone(mDoc?.phone || profile.phone || "");
    setLoadingMine(false);
  }
  useEffect(() => { if (showMine) loadMemberCenter(); }, [showMine]); // eslint-disable-line

  async function handleCancelBooking(id) {
    const res = await cancelBooking(id);
    if (res.ok) loadMemberCenter();
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
    window.location.href = "/?guest=1";
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setProfile(null); setShowMine(false);
    setSelectedSlot(null); setSlotConfirmed(false); setDone(false);
    setGoogleInfo(null);
    setName(""); setEmail(""); setPhone(""); setPassword(""); setGooglePhone("");
  }

  async function handleSubmitBooking() {
    if (!selectedSlot || !profile) return;
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
      profile.id, profile.name,
      { email: profile.email, phone: profile.phone },
      planType, durationHours, participantCount, isNewStudent,
      selectedSlot.date, selectedSlot.startTime, selectedSlot.endTime,
      "online_public", "", intake,
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
          <button onClick={() => { setDone(false); setSelectedSlot(null); setSlotConfirmed(false); setShowMine(true); }}
            style={{ width: "100%", padding: "12px 0", borderRadius: 14, border: "1px solid rgba(124,58,237,.4)", background: "rgba(124,58,237,.15)", color: "#c4b5fd", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            📋 查看我的預約
          </button>
          <button onClick={handleLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,.45)", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>登出</button>
        </div>
      </div>
    );
  }

  // ── ⑤ 會員中心（登入後：學籍/預約/個資/改密碼/進遊戲）──────────
  if (profile && showMine) {
    const acct = memberDoc?.accountType;
    const isEnrolled = !!acct && acct !== "guest" && acct !== "kid"; // 正式生
    const canChangePw = !!memberDoc?.hasPassword; // email＋密碼註冊的才有密碼
    return (
      <div style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => setShowMine(false)} style={{ background: "none", border: "none", color: "#c4b5fd", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← 返回預約</button>
            <span style={{ color: "white", fontSize: 16, fontWeight: 900 }}>會員中心</span>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>登出</button>
          </div>

          {/* 帳號 / 學籍狀態 */}
          <div style={cardStyle}>
            <div style={{ color: "white", fontWeight: 900, fontSize: 16 }}>{memberDoc?.name || profile.name}</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 2 }}>{profile.email}</div>
            <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: isEnrolled ? "rgba(34,197,94,.15)" : "rgba(251,191,36,.12)", border: `1px solid ${isEnrolled ? "rgba(34,197,94,.4)" : "rgba(251,191,36,.35)"}`, color: isEnrolled ? "#86efac" : "#fde68a", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
              {isEnrolled ? "🎓 正式生" : "🆕 尚未入籍（訪客）"}
            </div>
          </div>

          {/* 進入訪客學籍系統（遊戲）*/}
          <button onClick={enterGuestGame}
            style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "linear-gradient(90deg,#7c3aed,#4f46e5)", color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
            🎮 進入訪客學籍系統（打怪／學籍）
          </button>

          {/* 我的預約 */}
          <div style={cardStyle}>
            <div style={sectionTitle}>📋 我的預約</div>
            {loadingMine ? <div style={hintStyle}>載入中…</div>
              : myBookings.length === 0 ? <div style={hintStyle}>目前沒有預約</div>
              : myBookings.slice().sort((a, b) => `${a.date}_${a.startTime}`.localeCompare(`${b.date}_${b.startTime}`)).map(b => (
                <div key={b.id} style={{ background: "rgba(255,255,255,.05)", borderRadius: 12, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{b.date}　{b.startTime}-{b.endTime}</div>
                    <div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, marginTop: 2 }}>{PLAN_TYPES.find(p => p.id === b.planType)?.label || b.planType}・{durationLabel(b.durationHours || 1)}・{b.participantCount || 1}人・NT$ {totalPrice(b.planType, b.durationHours || 1, b.participantCount || 1)}</div>
                  </div>
                  <button onClick={() => handleCancelBooking(b.id)} style={{ flexShrink: 0, background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.4)", color: "#f87171", borderRadius: 10, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>取消</button>
                </div>
              ))}
          </div>

          {/* 個人資料 */}
          <div style={cardStyle}>
            <div style={sectionTitle}>👤 個人資料</div>
            <label style={{ ...labelStyle, marginTop: 8 }}>姓名
              <input value={editName} onChange={e => { setEditName(e.target.value); setProfileMsg(""); }} style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, marginTop: 8 }}>電話
              <input value={editPhone} onChange={e => { setEditPhone(e.target.value); setProfileMsg(""); }} style={inputStyle} />
            </label>
            {profileMsg && <div style={{ color: profileMsg.includes("✓") ? "#86efac" : "#f87171", fontSize: 12, fontWeight: 700, marginTop: 6 }}>{profileMsg}</div>}
            <button onClick={handleSaveProfile} disabled={savingProfile} style={{ ...smallBtn, marginTop: 10 }}>{savingProfile ? "儲存中…" : "儲存個人資料"}</button>
          </div>

          {/* 修改密碼 */}
          <div style={cardStyle}>
            <div style={sectionTitle}>🔒 修改密碼</div>
            {canChangePw ? (
              <>
                <input value={oldPw} onChange={e => { setOldPw(e.target.value); setPwMsg(""); }} placeholder="目前密碼" type="password" style={{ ...inputStyle, marginTop: 8 }} />
                <input value={newPw} onChange={e => { setNewPw(e.target.value); setPwMsg(""); }} placeholder="新密碼（至少6碼）" type="password" style={{ ...inputStyle, marginTop: 8 }} />
                {pwMsg && <div style={{ color: pwMsg.includes("✓") ? "#86efac" : "#f87171", fontSize: 12, fontWeight: 700, marginTop: 6 }}>{pwMsg}</div>}
                <button onClick={handleChangePassword} disabled={savingPw} style={{ ...smallBtn, marginTop: 10 }}>{savingPw ? "處理中…" : "更新密碼"}</button>
              </>
            ) : (
              <div style={{ ...hintStyle, textAlign: "left", padding: "8px 0" }}>你是用 Google 登入，沒有密碼、也不需要密碼。下次一樣用 Google 登入即可。</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── ③ 時段已確認、或按了前台「登入」→ 顯示身份表單 ─────────────
  if ((slotConfirmed || showLogin) && !profile) {
    return (
      <div style={wrapStyle}>
        <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          {slotConfirmed && selectedSlot ? (
            <div style={{ background: "rgba(37,99,235,.15)", border: "1px solid rgba(37,99,235,.4)", borderRadius: 12, padding: "10px 14px", color: "#93c5fd", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
              已選擇：{selectedSlot.date}　{selectedSlot.startTime}-{selectedSlot.endTime}・{participantCount}人
              <button onClick={() => { setSlotConfirmed(false); setSelectedSlot(null); }} style={{ display: "block", margin: "6px auto 0", background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>
                重新選時段
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => { setShowLogin(false); setAuthErr(""); setGoogleInfo(null); }} style={{ background: "none", border: "none", color: "#c4b5fd", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← 返回</button>
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
              <input value={googlePhone} onChange={e => setGooglePhone(e.target.value)}
                placeholder="聯絡電話（必填）" style={inputStyle} autoFocus />
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
        <a href="https://archery.catgroup.com.tw/"
          style={{ color: "rgba(255,255,255,.55)", fontSize: 13, fontWeight: 700, textDecoration: "none", alignSelf: "flex-start" }}>
          ← 返回首頁
        </a>
        {profile && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <button onClick={() => setShowMine(true)}
              style={{ background: "rgba(124,58,237,.2)", border: "1px solid rgba(124,58,237,.4)", color: "#c4b5fd", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              📋 我的預約
            </button>
            <button onClick={handleLogout}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", fontSize: 13, textDecoration: "underline", cursor: "pointer", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              登出（{profile.name || profile.email}）
            </button>
          </div>
        )}
        {!profile && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => { setShowLogin(true); setAuthTab("login"); setAuthErr(""); }}
              style={{ background: "none", border: "1px solid rgba(124,58,237,.4)", color: "#c4b5fd", borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              已有帳號？登入
            </button>
          </div>
        )}
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

        {/* ── 提醒 ── */}
        <div style={{ background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 12, padding: "10px 14px", color: "#fde68a", fontSize: 12.5, lineHeight: 1.8 }}>
          ⚠️ 5 歲以下無法參與射箭；10 歲以下需大人全程陪同。<br />
          👕 建議穿短袖；場內有貓咪，會過敏或不喜歡貓的朋友請斟酌。
        </div>

        {/* ── 非必填問卷 ── */}
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>以下皆為選填，幫助我們更了解你（可不填）：</div>

        <label style={labelStyle}>有接觸過射箭嗎？
          <select value={intakeExp} onChange={e => setIntakeExp(e.target.value)} style={inputStyle}>
            <option style={optStyle} value="">不指定</option>
            <option style={optStyle} value="新手">新手</option>
            <option style={optStyle} value="接觸過">接觸過（夜市、觀光景點、體驗課）</option>
            <option style={optStyle} value="熟悉">熟悉（可自行操作）</option>
          </select>
        </label>

        <label style={labelStyle}>想了解的弓種
          <select value={intakeBow} onChange={e => setIntakeBow(e.target.value)} style={inputStyle}>
            <option style={optStyle} value="">不指定</option>
            <option style={optStyle} value="競技反曲弓">競技反曲弓</option>
            <option style={optStyle} value="美式獵弓">美式獵弓</option>
            <option style={optStyle} value="傳統弓">傳統弓</option>
            <option style={optStyle} value="沒概念">沒概念</option>
          </select>
        </label>

        <label style={labelStyle}>來射箭的目的
          <select value={intakePurpose} onChange={e => setIntakePurpose(e.target.value)} style={inputStyle}>
            <option style={optStyle} value="">不指定</option>
            <option style={optStyle} value="純粹玩樂">純粹玩樂</option>
            <option style={optStyle} value="體驗">體驗</option>
            <option style={optStyle} value="正式學習">正式學習</option>
          </select>
        </label>

        <label style={labelStyle}>是否需要介紹電子射箭系統
          <select value={intakeSystemIntro} onChange={e => setIntakeSystemIntro(e.target.value)} style={inputStyle}>
            <option style={optStyle} value="">不指定</option>
            <option style={optStyle} value="是">是</option>
            <option style={optStyle} value="否">否</option>
          </select>
        </label>

        <label style={labelStyle}>其他備註需求
          <textarea value={intakeRemark} onChange={e => setIntakeRemark(e.target.value)} rows={2}
            placeholder="有任何特殊需求可以在這裡告訴我們" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
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
