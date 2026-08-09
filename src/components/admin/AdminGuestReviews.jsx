import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { adminGuestReviewAction, sendGuestReviewComplaintReply, saveGuestReviewConfig } from "../../lib/guestReviewDb";

const groups = {
  pending: ["pending"],
  private: ["private_unread", "private_read"],
  complaint: ["complaint_open", "complaint_sending", "complaint_send_failed", "complaint_closed"],
  approved: ["approved", "approval_revoked", "publication_withdrawn"],
};

const DEFAULT_CONFIG = {
  enabled: true,
  googlePromptEnabled: true,
  googleReviewUrl: "https://share.google/bqXYZDlWtwruWvV69",
  inviteSubject: "邀請您分享這次射箭體驗",
  inviteText: "謝謝您來到貓小隊！歡迎留下這次體驗的感想。",
  complaintSubject: "貓小隊回覆您的體驗意見",
};

// Firestore Timestamp → 台北時間字串（例：8/9 10:00）
function fmtTaipei(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

// 邀請狀態 → 徽章（文字 / 顏色 / 說明）
function subjectBadge(s) {
  if (s.state === "scheduled") return { label: "已排程", cls: "bg-sky-600", desc: `預計 ${fmtTaipei(s.dueAt)} 寄出` };
  if (s.state === "invite_failed") return { label: "寄送失敗", cls: "bg-red-600", desc: s.lastInviteError ? `失敗原因：${s.lastInviteError}` : "郵件寄送失敗，可點「補寄」重送" };
  if (s.state === "submitted") return { label: "已提交評價", cls: "bg-violet-600", desc: "訪客已填寫評價（見下方列表）" };
  if (s.inviteDeliveredAt) return { label: "已送達", cls: "bg-emerald-600", desc: `已於 ${fmtTaipei(s.inviteDeliveredAt)} 送達，等待訪客填寫` };
  return { label: "寄出佇列", cls: "bg-amber-500", desc: "邀請信已排入郵件佇列，尚未送達" };
}

export default function AdminGuestReviews() {
  const [reviews, setReviews] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [tab, setTab] = useState("pending");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [meta, setMeta] = useState({});       // memberId → { name, email, bookingDate, bookingTime }
  const [showHidden, setShowHidden] = useState(false);
  const requestedRef = useRef(new Set());     // 已抓過 meta 的 memberId，避免重複查詢

  useEffect(() => onSnapshot(
    query(collection(db, "guestReviews"), orderBy("submittedAt", "desc"), limit(100)),
    snap => setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    e => setError(e.message)
  ), []);
  useEffect(() => onSnapshot(
    query(collection(db, "guestReviewSubjects"), orderBy("dueAt", "desc"), limit(100)),
    snap => setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    e => setError(e.message)
  ), []);
  useEffect(() => onSnapshot(collection(db, "guestReviewConfig"), snap => {
    const d = snap.docs.find(x => x.id === "main");
    if (d) setConfig(c => ({ ...c, ...d.data() }));
  }), []);

  // 抓訪客姓名／預約資訊（member + booking join）
  useEffect(() => {
    if (!subjects.length) return;
    const rows = subjects.filter(s => !requestedRef.current.has(s.id));
    if (!rows.length) return;
    rows.forEach(s => requestedRef.current.add(s.id));
    Promise.all(rows.map(async s => {
      const out = { id: s.id, name: "", email: "", bookingDate: "", bookingTime: "" };
      try {
        const m = await getDoc(doc(db, "members", s.id));
        if (m.exists()) { const d = m.data(); out.name = d.name || ""; out.email = d.email || ""; }
      } catch { /* member 可能已被刪除 */ }
      if (s.bookingId) {
        try {
          const b = await getDoc(doc(db, "bookings", s.bookingId));
          if (b.exists()) { const d = b.data(); out.bookingDate = d.date || ""; out.bookingTime = d.startTime || ""; }
        } catch { /* booking 可能已不存在 */ }
      }
      return out;
    })).then(results => setMeta(prev => {
      const next = { ...prev };
      results.forEach(r => { next[r.id] = r; });
      return next;
    }));
  }, [subjects]);

  const visible = useMemo(() => reviews.filter(r => groups[tab].includes(r.state)), [reviews, tab]);
  const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [
    k, reviews.filter(r => v.includes(r.state) && !["private_read", "complaint_closed", "approval_revoked", "publication_withdrawn"].includes(r.state)).length,
  ]));

  const act = async (data) => {
    setBusy(data.memberId + data.action); setError("");
    try { await adminGuestReviewAction(data); }
    catch (e) { setError(e.message); }
    finally { setBusy(""); }
  };

  const toggleHidden = async (s) => {
    const hiding = !s.hiddenAt;
    const who = meta[s.id]?.name || s.id;
    if (!window.confirm(hiding
      ? `確定隱藏「${who}」的邀請？隱藏後不會再寄邀請信，且不再顯示在此清單（可在「顯示已隱藏」中找回）。`
      : `確定取消隱藏「${who}」？會重新顯示在此清單。`)) return;
    await act({ memberId: s.id, action: hiding ? "hide_subject" : "unhide_subject" });
  };

  const shown = showHidden ? subjects : subjects.filter(s => !s.hiddenAt);
  const hiddenList = subjects.filter(s => s.hiddenAt);

  return (
    <div className="p-4 text-slate-100">
      <h2 className="text-xl font-black">訪客評價與客訴</h2>

      <section className="mt-4 rounded-2xl bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black">邀請寄送狀態</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHidden(v => !v)}
              className={`rounded-lg border px-2 py-1 text-xs font-bold ${hiddenList.length ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-slate-800 text-slate-600"}`}>
              {showHidden ? "隱藏已隱藏列" : `顯示已隱藏${hiddenList.length ? ` (${hiddenList.length})` : ""}`}
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">邀請信統一在每天早上 10:00 批次寄出；「已排程」表示等待 10:00 寄出，屬正常狀態。</p>
        <div className="mt-3 space-y-2">
          {shown.map(s => {
            const badge = subjectBadge(s);
            const info = meta[s.id];
            return (
              <div key={s.id} className={`flex items-center justify-between gap-3 rounded-xl bg-slate-800 p-3 ${s.hiddenAt ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${badge.cls}`}>{badge.label}</span>
                    <strong className="truncate">{info?.name || `訪客 #${s.id.slice(0, 6)}`}</strong>
                    {info?.bookingDate && (
                      <small className="text-slate-400">預約 {info.bookingDate}{info.bookingTime ? ` ${info.bookingTime}` : ""}</small>
                    )}
                  </div>
                  <small className="mt-0.5 block text-slate-400">
                    {badge.desc}
                    {info?.email && <span className="ml-2 text-slate-500">· {info.email}</span>}
                    {s.lastInviteError ? ` · 補寄 ${s.manualInviteCount || 0} 次` : ""}
                  </small>
                </div>
                <div className="flex shrink-0 gap-2">
                  {s.state !== "submitted" && !s.hiddenAt && (
                    <button onClick={() => act({ memberId: s.id, action: "resend", requestId: crypto.randomUUID() })}
                      disabled={!!busy}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold disabled:opacity-50">
                      補寄
                    </button>
                  )}
                  <button onClick={() => toggleHidden(s)} disabled={!!busy}
                    className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-bold disabled:opacity-50">
                    {s.hiddenAt ? "取消隱藏" : "隱藏"}
                  </button>
                </div>
              </div>
            );
          })}
          {!shown.length && <p className="text-slate-400">{showHidden ? "沒有已隱藏的邀請。" : "目前沒有邀請。"}</p>}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries({ pending: "待公開審核", private: "私人回饋", complaint: "客訴", approved: "已處理" }).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-xl px-3 py-2 font-bold ${tab === id ? "bg-amber-400 text-slate-950" : "bg-slate-800"}`}>
            {label}{counts[id] > 0 ? ` (${counts[id]})` : ""}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}

      <div className="mt-4 space-y-3">
        {visible.map(r => {
          const info = meta[r.id];
          return (
            <article key={r.id} className="rounded-2xl bg-slate-800 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong>{"★".repeat(r.rating)} {r.publicAlias || "私人回饋"}</strong>
                  <small className="ml-2 text-slate-400">{r.state}</small>
                  {info?.name && (
                    <div className="mt-0.5 text-xs text-slate-400">
                      訪客：{info.name}{info.email ? `（${info.email}）` : ""}
                      {info.bookingDate ? ` ・ 預約 ${info.bookingDate}` : ""}
                    </div>
                  )}
                </div>
                <small className="text-slate-500">{fmtTaipei(r.submittedAt)}</small>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{r.message}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {r.state === "pending" && <>
                  <button onClick={() => act({ memberId: r.id, action: "approve" })}
                    className="rounded-lg bg-emerald-600 px-3 py-2 font-bold">核准公開</button>
                  <button onClick={() => { const reason = window.prompt("拒絕原因（將轉為客訴）"); if (reason) act({ memberId: r.id, action: "reject", reason }); }}
                    className="rounded-lg bg-red-700 px-3 py-2 font-bold">拒絕並轉客訴</button>
                </>}
                {r.state === "private_unread" && (
                  <button onClick={() => act({ memberId: r.id, action: "read" })} className="rounded-lg bg-slate-600 px-3 py-2">標記已讀</button>
                )}
                {["private_unread", "private_read"].includes(r.state) && (
                  <button onClick={() => act({ memberId: r.id, action: "complaint" })} className="rounded-lg bg-red-800 px-3 py-2">轉為客訴</button>
                )}
                {["complaint_open", "complaint_send_failed"].includes(r.state) && (
                  <button onClick={async () => {
                    const replyText = window.prompt("回信內容（收件地址由系統解析）");
                    if (!replyText) return;
                    setBusy(r.id + "reply");
                    try { await sendGuestReviewComplaintReply({ memberId: r.id, replyText, requestId: crypto.randomUUID() }); }
                    catch (e) { setError(e.message); }
                    finally { setBusy(""); }
                  }} className="rounded-lg bg-blue-600 px-3 py-2 font-bold">
                    {r.state === "complaint_send_failed" ? "重新寄送" : "回覆訪客"}
                  </button>
                )}
                {r.state === "approved" && (
                  <button onClick={() => act({ memberId: r.id, action: "revoke" })} className="rounded-lg bg-red-800 px-3 py-2">撤銷公開</button>
                )}
              </div>
              {busy.startsWith(r.id) && <small className="mt-2 block">處理中…</small>}
            </article>
          );
        })}
        {!visible.length && <p className="rounded-xl bg-slate-800 p-5 text-slate-400">目前沒有資料。</p>}
      </div>

      <section className="mt-8 rounded-2xl border border-slate-700 p-4">
        <h3 className="font-black">評價功能設定</h3>
        <label className="mt-3 flex gap-2">
          <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />
          啟用評價邀請
        </label>
        <label className="mt-2 flex gap-2">
          <input type="checkbox" checked={config.googlePromptEnabled} onChange={e => setConfig({ ...config, googlePromptEnabled: e.target.checked })} />
          啟用 5 星 Google 導流
        </label>
        <label className="mt-3 block">Google 直接評論 URL
          <input className="mt-1 w-full rounded-lg bg-slate-900 p-2" value={config.googleReviewUrl} onChange={e => setConfig({ ...config, googleReviewUrl: e.target.value })} />
        </label>
        <button onClick={() => saveGuestReviewConfig(config).catch(e => setError(e.message))}
          className="mt-3 rounded-lg bg-amber-400 px-4 py-2 font-black text-slate-950">儲存設定</button>
        <p className="mt-2 text-xs text-amber-300">尚未取得 Google 商家「要求評論」連結時，請保持導流關閉。</p>
      </section>
    </div>
  );
}
