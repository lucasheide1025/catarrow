// src/components/admin/AdminGuestAccounts.jsx — 訪客帳號管理
// 2026-07-11 新增：專用於檢視所有訪客帳號 (accountType==="guest")，方便教練升級/刪除
import { useState, useEffect } from "react";
import { subscribeKidAccounts, convertGuestToOfficial, deleteMember } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { fmtDT } from "../../lib/constants";
import { Card, Btn, Inp, TA, Modal, Spinner, Empty, ConfirmModal, useToast, SearchBar } from "../shared/UI";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { firebaseConfig } from "../../lib/firebase";
import { initializeApp, deleteApp } from "firebase/app";

export default function AdminGuestAccounts() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [allAccounts, setAllAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [convertModal, setConvertModal] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [statsModal, setStatsModal] = useState(false);

  useEffect(() => {
    const unsub = subscribeKidAccounts(list => {
      const guests = list.filter(a => a.accountType === "guest");
      setAllAccounts(guests);
      setLoading(false);
    });
    return () => unsub?.();
  }, []);

  const displayed = search.trim()
    ? allAccounts.filter(a => {
        const q = search.toLowerCase();
        return (a.name || "").toLowerCase().includes(q)
          || (a.contactRaw || "").toLowerCase().includes(q)
          || (a.email || "").toLowerCase().includes(q)
          || (a.id || "").toLowerCase().includes(q);
      })
    : allAccounts;

  async function handleDelete(acc) {
    try {
      await deleteMember(acc.id, profile.id);
      toast("訪客帳號已刪除 ✓");
    } catch (e) { toast("刪除失敗：" + (e?.message || "")); }
    setDelConfirm(null);
  }

  const totalGuests = allAccounts.length;
  const hasBooking = allAccounts.filter(a => a.bookingStats?.totalBookings > 0).length;
  const totalBookings = allAccounts.reduce((s, a) => s + (a.bookingStats?.totalBookings || 0), 0);

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />

      <div className="flex items-center justify-between">
        <h2 className="text-white font-black text-xl">🎫 訪客帳號管理</h2>
        <Btn v="primary" size="sm" onClick={() => setStatsModal(true)}>📊 統計摘要</Btn>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="👤" label="總訪客數" value={totalGuests} />
        <StatCard icon="📅" label="有預約紀錄" value={hasBooking} />
        <StatCard icon="🎯" label="預約總筆數" value={totalBookings} />
      </div>

      <div className="bg-blue-900/20 border border-blue-400/30 rounded-xl px-4 py-3 text-blue-300 text-xs leading-relaxed">
        💡 訪客帳號是透過官網預約頁面註冊的使用者。教練可以在此檢視聯絡資料、預約統計，
        並將訪客「轉正式」為正式學員（保留遊戲資料和預約紀錄）。
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="搜尋姓名、信箱、電話、ID…" />

      {displayed.length === 0 && (
        <Empty message={search ? "沒有符合條件的訪客帳號" : "目前沒有任何訪客帳號"} />
      )}

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {displayed.map(a => (
          <GuestCard key={a.id} account={a}
            onConvert={() => setConvertModal(a)}
            onDelete={() => setDelConfirm(a)}
          />
        ))}
      </div>

      {convertModal && (
        <ConvertGuestModal account={convertModal}
          onClose={() => setConvertModal(null)}
          operatorId={profile.id} toast={toast} />
      )}

      {statsModal && <StatsModal accounts={allAccounts} onClose={() => setStatsModal(false)} />}

      <ConfirmModal open={!!delConfirm} title="確認刪除訪客帳號"
        message={`確定要刪除「${delConfirm?.name || delConfirm?.id || ""}」這個訪客帳號嗎？\\n該帳號的遊戲進度、預約統計都會一併移除，此操作無法復原。`}
        onConfirm={() => handleDelete(delConfirm)} onCancel={() => setDelConfirm(null)} />
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <Card className="p-4 flex flex-col items-center gap-1">
      <span className="text-2xl">{icon}</span>
      <span className="text-white font-black text-2xl">{value}</span>
      <span className="text-gray-400 text-xs">{label}</span>
    </Card>
  );
}

function GuestCard({ account: a, onConvert, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const lastLogin = a.lastLoginAt?.toDate?.() ? fmtDT(a.lastLoginAt) : "—";
  const joinDate = a.createdAt?.toDate?.() ? fmtDT(a.createdAt) : "—";
  const bookingStats = a.bookingStats || {};
  // 最後一次預約時間（建立/改期時更新，取消不動；用於 14 天回訪提醒信對照）
  const lastBookingMs = bookingStats.lastBookingAt?.toMillis?.() || 0;
  const lastBooking = lastBookingMs ? fmtDT(bookingStats.lastBookingAt) : "—";
  const daysSinceBooking = lastBookingMs ? Math.floor((Date.now() - lastBookingMs) / 86400000) : null;
  // 逾 14 天未預約＝符合自動「回來玩玩」提醒信條件（functions/bookingReminder.js REMINDER_DELAY_DAYS=14）
  const isDormant = daysSinceBooking != null && daysSinceBooking >= 14;

  return (
    <Card className="p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-black text-white text-sm truncate">{a.name || "（未命名）"}</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-blue-600/30 text-blue-300">🎫 訪客</span>
          </div>
          <div className="text-gray-400 text-xs mt-0.5">
            📧 {a.contactRaw || a.email || "—"}
          </div>
        </div>
        <span className="text-gray-500 text-xs cursor-pointer flex-shrink-0" onClick={() => setExpanded(v => !v)}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {bookingStats.totalBookings > 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-2 text-xs mt-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-400 font-bold">📋 預約明細</span>
            {isDormant && (
              <span className="bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded-full font-bold"
                title="超過 14 天未預約，符合自動「回來玩玩」提醒信寄送條件">
                😴 逾 {daysSinceBooking} 天未預約
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 text-gray-400">
            <span>總筆數：{bookingStats.totalBookings || 0}</span>
            <span>進行中：{bookingStats.totalActive || 0}</span>
            <span>已完成：{bookingStats.totalCompleted || 0}</span>
            <span>已取消：{bookingStats.totalCancelled || 0}</span>
          </div>
          <div className="text-gray-500 border-t border-white/5 pt-1">
            🗓 最後一次預約：<span className="text-gray-300">{lastBooking}</span>
          </div>
        </div>
      ) : (
        <div className="text-gray-500 text-xs">尚無預約紀錄</div>
      )}

      {expanded && (
        <div className="border-t border-white/10 pt-2 mt-1 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
            <span>🆔 {a.id?.slice(0, 12)}…</span>
            <span>🪙 {a.coins || 0}</span>
            <span>📅 加入：{joinDate}</span>
            <span>🔑 最近登入：{lastLogin}</span>
          </div>
          <div className="flex gap-2">
            <Btn v="primary" size="sm" className="flex-1" onClick={onConvert}>✅ 轉正式</Btn>
            <button onClick={onDelete} className="text-red-300 hover:text-red-500 text-xs px-1.5 py-1 flex-shrink-0">🗑 刪除</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ConvertGuestModal({ account, onClose, operatorId, toast }) {
  const [form, setForm] = useState({
    email: account.email || "",
    password: "",
    name: account.name || "",
    nickname: "",
    archerNo: "", archerNoDate: "",
    joinDate: new Date().toISOString().slice(0, 10),
    phone: account.contactRaw || (account.email || ""),
    note: "由訪客帳號轉正式",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // 官網註冊的訪客（registerGuestWithPassword）已經有自己的 Firebase Auth
  // email/password 帳號，member 文件帶 email + hasPassword:true。
  // ⚠️ 這種**不能再建帳號** —— 拿同一個 email 去 createUserWithEmailAndPassword 必然撞
  // auth/email-already-in-use，轉正因此永遠失敗（使用者實測「信箱帳號重複」）。
  // 正確做法是沿用既有 uid 與 email，只補學籍欄位。
  // QR 碼匿名訪客沒有 email 欄位（只有 contactRaw），仍需設一組帳密才能登入。
  const hasOwnLogin = !!(account.email || account.hasPassword);
  const existingEmail = (account.email || account.contactRaw || "").trim();

  async function save() {
    if (!form.name) { setErr("請填寫姓名"); return; }

    // ── 已有自己的登入憑證：原地轉正，完全不碰 Firebase Auth ──
    if (hasOwnLogin) {
      setSaving(true);
      setErr("");
      try {
        const { email: _email, password: _password, ...rest } = form;
        await convertGuestToOfficial(account.id, { ...rest, email: existingEmail }, account.uid, operatorId);
        toast("已轉為正式會員 🐱");
        onClose();
      } catch (e) { setErr(e.message); }
      setSaving(false);
      return;
    }

    // ── QR 匿名帳號：必須建立一組登入憑證 ──
    if (!form.email || !form.password) { setErr("這個帳號沒有登入憑證，請設定信箱與密碼"); return; }
    setSaving(true);
    setErr("");
    const tmpApp = initializeApp(firebaseConfig, "tmp_convert_" + Date.now() + "_" + Math.random().toString(36).slice(2));
    const tmpAuth = getAuth(tmpApp);
    try {
      const email = form.email.trim();
      const cred = await createUserWithEmailAndPassword(tmpAuth, email, form.password);
      const { email: _email, password: _password, ...rest } = form;
      await convertGuestToOfficial(account.id, { ...rest, email }, cred.user.uid, operatorId);
      toast("已轉為正式會員 🐱");
      onClose();
    } catch (e) {
      setErr(e?.code === "auth/email-already-in-use"
        ? "這個信箱已經有帳號了。若就是這位學生本人的帳號，請確認是否已經轉正過。"
        : e.message);
    }
    finally { deleteApp(tmpApp).catch(() => {}); }
    setSaving(false);
  }

  const f = (k, label, type) => (
    <Inp key={k} label={label} type={type || "text"} value={form[k] || ""}
      onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
  );

  return (
    <Modal open wide onClose={onClose} title={"轉正式 — " + (account.name || account.id)}>
      <div className="flex flex-col gap-5">
        <div className="bg-amber-900/20 border border-amber-400/30 rounded-xl px-3 py-2 text-amber-300 text-xs">
          原本的遊戲資料（金幣/預約紀錄等）會原封不動保留在同一份記錄，僅補上正式學籍欄位。
          訪客的預約紀錄會繼續保留在該帳號下。
        </div>
        <div>
          <div className="text-slate-400 text-xs font-bold mb-3">🔑 登入資訊</div>
          {hasOwnLogin ? (
            // 已經有自己的帳密：沿用即可，不要再讓教練設一組（會撞 email 重複而無法轉正）
            <div className="bg-emerald-900/20 border border-emerald-400/30 rounded-xl px-3 py-2.5 text-emerald-200 text-xs leading-relaxed">
              ✅ 這個帳號已經有自己的登入信箱：<span className="font-black">{existingEmail}</span>
              <div className="text-emerald-300/70 mt-1">
                轉正後沿用原本的信箱與密碼登入，不需要重新設定，遊戲與預約紀錄也完整保留。
              </div>
            </div>
          ) : (
            <>
              <div className="bg-slate-800/60 border border-slate-600/40 rounded-xl px-3 py-2 text-slate-300 text-xs mb-3 leading-relaxed">
                這是 QR 碼臨時帳號，沒有登入憑證，通常不需要轉正式。
                <div className="text-slate-400 mt-1">若確定要轉，請設定一組信箱與密碼，學生之後才能登入。</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {f("email", "電子信箱", "email")}
                {f("password", "初始密碼", "password")}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="text-slate-400 text-xs font-bold mb-3">👤 基本資料</div>
          <div className="grid grid-cols-2 gap-3">
            {f("name", "姓名")}{f("nickname", "暱稱")}
            {f("archerNo", "射手證編號")}{f("archerNoDate", "領取日期", "date")}
            {f("joinDate", "加入日期", "date")}{f("phone", "聯絡電話", "tel")}
          </div>
          <TA label="備註" value={form.note} rows={2}
            onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
        </div>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={save} disabled={saving}>{saving ? "轉換中…" : "確認轉正式"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function StatsModal({ accounts, onClose }) {
  const total = accounts.length;
  const withBooking = accounts.filter(a => a.bookingStats?.totalBookings > 0);
  const totalBookings = accounts.reduce((s, a) => s + (a.bookingStats?.totalBookings || 0), 0);
  const totalCompleted = accounts.reduce((s, a) => s + (a.bookingStats?.totalCompleted || 0), 0);
  const totalActive = accounts.reduce((s, a) => s + (a.bookingStats?.totalActive || 0), 0);
  const totalCancelled = accounts.reduce((s, a) => s + (a.bookingStats?.totalCancelled || 0), 0);
  const withCoins = accounts.filter(a => (a.coins || 0) > 0);
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentActive = accounts.filter(a => {
    const t = a.lastLoginAt?.toMillis?.() || 0;
    return t > oneWeekAgo;
  });

  return (
    <Modal open onClose={onClose} title="📊 訪客帳號統計" wide>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["👤", total, "總訪客數"],
            ["📅", withBooking.length, "有預約紀錄"],
            ["🎯", totalBookings, "預約總筆數"],
            ["✅", totalCompleted, "已完成預約"],
            ["🔄", totalActive, "進行中"],
            ["❌", totalCancelled, "已取消"],
            ["🪙", withCoins.length, "有金幣紀錄"],
            ["⚡", recentActive.length, "近一週活躍"],
          ].map(([icon, val, label]) => (
            <div key={label} className="rounded-xl border border-white/10 p-4 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-3xl mb-1">{icon}</div>
              <div className="text-white font-black text-2xl">{val}</div>
              <div className="text-gray-400 text-xs">{label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="text-gray-400 text-xs font-bold mb-2">📋 預約狀態分布</div>
          {totalBookings > 0 ? (
            <>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-700">
                <div className="bg-green-500 h-full transition-all" style={{ width: ((totalCompleted / totalBookings) * 100) + "%" }} />
                <div className="bg-blue-500 h-full transition-all" style={{ width: ((totalActive / totalBookings) * 100) + "%" }} />
                <div className="bg-red-500 h-full transition-all" style={{ width: ((totalCancelled / totalBookings) * 100) + "%" }} />
              </div>
              <div className="flex gap-3 text-xs mt-2 text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />已完成 {totalCompleted}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />進行中 {totalActive}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />已取消 {totalCancelled}</span>
              </div>
            </>
          ) : (
            <div className="text-gray-500 text-xs text-center py-2">尚無預約資料</div>
          )}
        </div>

        <Btn v="secondary" onClick={onClose}>關閉</Btn>
      </div>
    </Modal>
  );
}
