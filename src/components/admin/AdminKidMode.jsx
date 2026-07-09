// src/components/admin/AdminKidMode.jsx — 兒童模式後台：夏令營場次 + 訪客/兒童帳號管理 + 轉正式
// 2026-07-09 新增（見 .trellis/tasks/07-09-guest-kid-mode-overhaul）
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  subscribeCampSessions, createCampSession, updateCampSession, deleteCampSession,
  subscribeKidAccounts, convertGuestToOfficial,
} from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { fmtDT, today } from "../../lib/constants";
import { Card, Btn, Inp, TA, Modal, Sel, Spinner, Empty, ConfirmModal, useToast } from "../shared/UI";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { firebaseConfig } from "../../lib/firebase";
import { initializeApp, deleteApp } from "firebase/app";

const ACCOUNT_TYPE_LABEL = { guest: "🎫 訪客", kid: "🎈 兒童" };
const ACCOUNT_TYPE_STYLE = {
  guest: "bg-blue-600/30 text-blue-300",
  kid:   "bg-pink-600/30 text-pink-300",
};

export default function AdminKidMode() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [sessions, setSessions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);

  const [sessionModal, setSessionModal] = useState(null); // null | {} | session object
  const [qrModal, setQrModal]           = useState(null); // session object
  const [delConfirm, setDelConfirm]     = useState(null); // session id
  const [convertModal, setConvertModal] = useState(null); // account object
  const [filterSession, setFilterSession] = useState("all");

  useEffect(() => {
    let sReady = false, aReady = false;
    const check = () => { if (sReady && aReady) setLoading(false); };
    const unsubS = subscribeCampSessions(list => { setSessions(list); sReady = true; check(); });
    const unsubA = subscribeKidAccounts(list => { setAccounts(list); aReady = true; check(); });
    return () => { unsubS?.(); unsubA?.(); };
  }, []);

  const displayedAccounts = filterSession === "all"
    ? accounts
    : accounts.filter(a => (a.sessionSourceId || "") === filterSession);

  async function handleDeleteSession(id) {
    try {
      await deleteCampSession(id);
      toast("場次已刪除 ✓");
    } catch (e) { toast("刪除失敗：" + (e?.message || "")); }
    setDelConfirm(null);
  }

  async function handleToggleActive(session) {
    try {
      await updateCampSession(session.id, { active: !session.active });
    } catch (e) { toast("更新失敗：" + (e?.message || "")); }
  }

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <h2 className="text-white font-black text-xl">🎈 兒童模式</h2>

      <div className="bg-amber-900/20 border border-amber-400/30 rounded-xl px-4 py-3 text-amber-300 text-xs leading-relaxed">
        ⚠️ 訪客/兒童帳號安全等級較低，不存放真實付款/隱私資訊，請勿在轉正式前於此頁面輸入信用卡等機密資料。
      </div>

      {/* ── 場次管理 ── */}
      <div className="flex justify-between items-center">
        <h3 className="text-white font-black text-sm">📅 夏令營場次</h3>
        <Btn v="primary" size="sm" onClick={() => setSessionModal({})}>+ 新增場次</Btn>
      </div>

      {sessions.length === 0 && <Empty message="尚未建立任何場次" />}

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {sessions.map(s => (
          <Card key={s.id} className="p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-black text-white text-sm">{s.name || "（未命名場次）"}</div>
                <div className="text-gray-400 text-xs mt-0.5">{s.startDate || "?"} ～ {s.endDate || "?"}</div>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <span className={`text-xs font-bold ${s.active ? "text-green-400" : "text-gray-500"}`}>
                  {s.active ? "啟用中" : "已停用"}
                </span>
                <input type="checkbox" checked={!!s.active} onChange={() => handleToggleActive(s)}
                  className="accent-green-500 w-4 h-4" />
              </label>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Btn v="secondary" size="sm" onClick={() => setQrModal(s)}>📱 QR</Btn>
              <Btn v="secondary" size="sm" onClick={() => setSessionModal(s)}>✏️ 編輯</Btn>
              <button onClick={() => setDelConfirm(s.id)} className="text-red-300 hover:text-red-500 text-xs ml-auto self-center">刪除</button>
            </div>
          </Card>
        ))}
      </div>

      {/* ── 帳號列表 ── */}
      <div className="flex justify-between items-center mt-2">
        <h3 className="text-white font-black text-sm">👥 訪客/兒童帳號</h3>
        <div className="w-48">
          <Sel value={filterSession} onChange={e => setFilterSession(e.target.value)}
            options={[
              { value: "all", label: "全部場次" },
              ...sessions.map(s => ({ value: s.id, label: s.name || s.id })),
            ]} />
        </div>
      </div>

      {displayedAccounts.length === 0 && <Empty message="沒有符合條件的訪客/兒童帳號" />}

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {displayedAccounts.map(a => (
          <Card key={a.id} className="p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-white text-sm">{a.name || "（無名稱）"}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${ACCOUNT_TYPE_STYLE[a.accountType] || ""}`}>
                {ACCOUNT_TYPE_LABEL[a.accountType] || a.accountType}
              </span>
            </div>
            <div className="text-gray-400 text-xs">
              聯絡方式：{a.contactRaw || "—"}
            </div>
            <div className="flex gap-2 text-xs text-gray-500">
              <span>🪙 {a.coins || 0}</span>
              <span>最近登入：{a.lastLoginAt?.toDate?.() ? fmtDT(a.lastLoginAt) : "—"}</span>
            </div>
            <Btn v="primary" size="sm" onClick={() => setConvertModal(a)}>✅ 轉正式</Btn>
          </Card>
        ))}
      </div>

      {sessionModal && (
        <SessionModal session={sessionModal.id ? sessionModal : null}
          onClose={() => setSessionModal(null)}
          operatorId={profile.id} toast={toast} />
      )}
      {qrModal && <SessionQRModal session={qrModal} onClose={() => setQrModal(null)} toast={toast} />}
      {convertModal && (
        <ConvertModal account={convertModal} onClose={() => setConvertModal(null)}
          operatorId={profile.id} toast={toast} />
      )}

      <ConfirmModal open={!!delConfirm} title="確認刪除場次" message="確定要刪除此場次？此操作無法復原（不影響已建立的兒童帳號資料）。"
        onConfirm={() => handleDeleteSession(delConfirm)} onCancel={() => setDelConfirm(null)} />
    </div>
  );
}

// ── 場次新增/編輯 Modal ────────────────────────────────────
function SessionModal({ session, onClose, operatorId, toast }) {
  const [form, setForm] = useState({
    name: session?.name || "",
    startDate: session?.startDate || today(),
    endDate: session?.endDate || today(),
    active: session ? !!session.active : true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) { toast("請輸入場次名稱"); return; }
    setSaving(true);
    try {
      if (session) await updateCampSession(session.id, form);
      else await createCampSession(form, operatorId);
      toast(session ? "場次已更新 ✓" : "場次已建立 ✓");
      onClose();
    } catch (e) { toast("儲存失敗：" + (e?.message || "")); }
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={session ? "編輯場次" : "新增場次"}>
      <div className="flex flex-col gap-3">
        <Inp label="場次名稱" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="開始日期" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
          <Inp label="結束日期" type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
            className="accent-green-500 w-4 h-4" />
          <span className="text-slate-300 text-sm font-bold">啟用中</span>
        </label>
        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={save} disabled={saving}>{saving ? "儲存中…" : "儲存"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── 場次 QR Code Modal ─────────────────────────────────────
function SessionQRModal({ session, onClose, toast }) {
  const url = `${window.location.origin}?kid=${session.id}`;
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("請手動複製連結");
    }
  }

  return (
    <Modal open onClose={onClose} title={`📱 ${session.name || "兒童模式"} QR Code`}>
      <div className="flex flex-col gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-700 text-sm">
          掃描後輸入信箱或電話即可開始兒童模式體驗，無需登入。這組連結固定對應此場次，可印出張貼在活動現場，下次再來會自動接續進度。
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-200">
            <QRCodeSVG value={url} size={220} level="M" includeMargin={false} fgColor="#1e293b" />
          </div>

          <button onClick={copyUrl}
            className={`w-full py-2.5 rounded-xl text-sm font-bold border transition-all ${copied ? "bg-green-900/40 border-green-400/40 text-green-300" : "border-white/10 text-slate-300 hover:border-white/20"}`}
            style={!copied ? { background: "rgba(255,255,255,0.06)" } : {}}>
            {copied ? "✅ 已複製連結" : "📋 複製連結（備用）"}
          </button>

          <a href={url} target="_blank" rel="noreferrer" className="text-blue-500 text-xs underline">
            在新分頁測試
          </a>
        </div>

        <Btn v="secondary" onClick={onClose}>關閉</Btn>
      </div>
    </Modal>
  );
}

// ── 轉正式 Modal ───────────────────────────────────────────
function ConvertModal({ account, onClose, operatorId, toast }) {
  const [form, setForm] = useState({
    email: "", password: "",
    name: account.name || "", nickname: "",
    archerNo: "", archerNoDate: "",
    joinDate: today(), phone: account.contactRaw || "", note: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!form.email || !form.password || !form.name) { setErr("請填寫信箱、密碼、姓名"); return; }
    setSaving(true);
    setErr("");
    // 用第二個 Firebase App 建立帳號，避免切換主要登入身份（比照 AddMemberModal）
    const tmpApp  = initializeApp(firebaseConfig, "tmp_" + Date.now());
    const tmpAuth = getAuth(tmpApp);
    try {
      const cred = await createUserWithEmailAndPassword(tmpAuth, form.email, form.password);
      const { email, password, ...rest } = form;
      await convertGuestToOfficial(account.id, { ...rest, email }, cred.user.uid, operatorId);
      toast("已轉為正式會員 🐱");
      onClose();
    } catch (e) { setErr(e.message); }
    finally { deleteApp(tmpApp).catch(() => {}); }
    setSaving(false);
  }

  const f = (k, label, type = "text") => (
    <Inp key={k} label={label} type={type} value={form[k] || ""}
      onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
  );

  return (
    <Modal open wide onClose={onClose} title={`轉正式 — ${account.name || account.id}`}>
      <div className="flex flex-col gap-5">
        <div className="bg-amber-900/20 border border-amber-400/30 rounded-xl px-3 py-2 text-amber-300 text-xs">
          原本的遊戲資料（金幣/材料/地下城進度等）會原封不動保留在同一份記錄，僅補上正式學籍欄位。
        </div>
        <div>
          <div className="text-slate-400 text-xs font-bold mb-3">🔑 登入資訊</div>
          <div className="grid grid-cols-2 gap-3">
            {f("email", "電子信箱", "email")}
            {f("password", "初始密碼", "password")}
          </div>
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
