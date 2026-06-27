// src/components/admin/AdminMembers.jsx
import { useState, useEffect, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  getMembers, createMember, updateMember, deleteMember,
  getAuditLogs, addBadge, getCertRecords, upsertCertRecord,
  resolveBadgeDispute, subscribeAllDisputes, deleteCertRecord,
  resetMonsterSession,
} from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { calcAge, formatArcherNo, fmtDT, today, thisYear, BOW_TYPES, getCertLevel, calcBadgePoints } from "../../lib/constants";
import { Card, Btn, Inp, TA, Sel, Modal, ST, Spinner, Empty, BadgePip, SearchBar, ConfirmModal, useToast } from "../shared/UI";
import { EquipmentEditor, EquipmentViewer, normalizeEquipment, ArmorManager, AccessoryManager } from "../shared/Equipment";
import AdminCertExamModal from "./AdminCertExamModal";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { auth, firebaseConfig } from "../../lib/firebase";
import { initializeApp, deleteApp } from "firebase/app";

const SORT_OPTIONS = [
  { value:"lastLoginAt_desc", label:"最近登入" },
  { value:"joinDate_desc",    label:"加入日期（新→舊）" },
  { value:"joinDate_asc",     label:"加入日期（舊→新）" },
  { value:"archerNo_asc",     label:"射手證號（升序）" },
  { value:"name_asc",         label:"姓名（A→Z）" },
];

const BADGE_DEF = {
  fatCat:      { label:"🐱 肥貓章", keys:["gold","silver","bronze"], names:["金","銀","銅"] },
  score:       { label:"⭐ 積分章", keys:["gold","silver","bronze"], names:["金","銀","銅"] },
  achievement: { label:"🏆 成就章", keys:["black","gold","silver"],  names:["黑","金","銀"] },
};

export default function AdminMembers() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [members, setMembers]   = useState([]);
  const [disputes, setDisputes] = useState({});
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [sortBy, setSortBy]     = useState("lastLoginAt_desc");
  const [filterJoinFrom, setFilterJoinFrom] = useState("");
  const [filterJoinTo,   setFilterJoinTo]   = useState("");
  const [addModal,    setAddModal]    = useState(false);
  const [editModal,   setEditModal]   = useState(null);
  const [bdgModal,    setBdgModal]    = useState(null);
  const [histModal,   setHistModal]   = useState(null);
  const [certModal,   setCertModal]   = useState(null);
  const [examModal,   setExamModal]   = useState(null);
  const [dispModal,   setDispModal]   = useState(null);
  const [delConfirm,  setDelConfirm]  = useState(null);
  const [guestModal,  setGuestModal]  = useState(false);

  useEffect(() => {
    loadMembers();
    const unsub = subscribeAllDisputes(setDisputes);
    return unsub;
  }, []);

  async function loadMembers() {
    setLoading(true);
    const data = await getMembers();
    setMembers(data);
    setLoading(false);
  }

  const displayed = useMemo(() => {
    let list = [...members];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.nickname?.toLowerCase().includes(q) ||
        m.username?.toLowerCase().includes(q) ||
        String(m.archerNo || "").includes(q)
      );
    }
    if (filterJoinFrom) list = list.filter(m => (m.joinDate || "") >= filterJoinFrom);
    if (filterJoinTo)   list = list.filter(m => (m.joinDate || "") <= filterJoinTo);
    const [field, dir] = sortBy.split("_");
    list.sort((a, b) => {
      let av = a[field], bv = b[field];
      if (av?.toDate) av = av.toDate();
      if (bv?.toDate) bv = bv.toDate();
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ?  1 : -1;
      return 0;
    });
    return list;
  }, [members, search, sortBy, filterJoinFrom, filterJoinTo]);

  async function handleDelete(id) {
    await deleteMember(id, profile.id);
    setMembers(ms => ms.filter(m => m.id !== id));
    setDelConfirm(null);
    toast("會員已刪除");
  }

  async function handleResetMonster(memberId, name) {
    await resetMonsterSession(memberId);
    toast(`已重置 ${name} 今日打怪次數 ✓`);
  }

  if (loading) return <Spinner />;

  const totalDisputes = Object.values(disputes).reduce((a, arr) => a + arr.length, 0);

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <div className="flex justify-between items-center">
        <h2 className="text-white font-black text-xl">👥 會員管理</h2>
        <div className="flex gap-2">
          <Btn v="secondary" size="sm" onClick={() => setGuestModal(true)}>📱 訪客 QR</Btn>
          <Btn v="primary"   size="sm" onClick={() => setAddModal(true)}>+ 新增</Btn>
        </div>
      </div>

      {totalDisputes > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-xl">🔔</span>
          <span className="text-red-600 text-sm font-bold">有 {totalDisputes} 筆徽章被回報</span>
        </div>
      )}

      <Card className="p-4 flex flex-col gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="搜尋姓名、暱稱、帳號、射手證號…" />
        <div className="grid grid-cols-2 gap-2">
          <Inp label="加入日期（從）" type="date" value={filterJoinFrom} onChange={e => setFilterJoinFrom(e.target.value)} />
          <Inp label="加入日期（至）" type="date" value={filterJoinTo}   onChange={e => setFilterJoinTo(e.target.value)} />
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><Sel label="排序" value={sortBy} onChange={e => setSortBy(e.target.value)} options={SORT_OPTIONS} /></div>
          <div className="text-gray-400 text-xs pb-2">{displayed.length} 位</div>
        </div>
      </Card>

      {displayed.length === 0 && <Empty message="沒有符合條件的會員" />}

      <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))" }}>
        {displayed.map(m => (
          <MemberCard key={m.id} member={m}
            disputeList={disputes[m.id] || []}
            onEdit={() => setEditModal(m)}
            onBadge={() => setBdgModal(m)}
            onHistory={() => setHistModal(m)}
            onCert={() => setCertModal(m)}
            onCertExam={() => setExamModal(m)}
            onDispute={() => setDispModal(m)}
            onDelete={() => setDelConfirm(m.id)}
            onResetMonster={() => handleResetMonster(m.id, m.nickname || m.name)}
          />
        ))}
      </div>

      {addModal    && <AddMemberModal  onClose={() => setAddModal(false)}   onDone={loadMembers} operatorId={profile.id} toast={toast} />}
      {editModal   && <EditMemberModal member={editModal} onClose={() => setEditModal(null)}  onDone={loadMembers} operatorId={profile.id} toast={toast} />}
      {bdgModal    && <BadgeModal      member={bdgModal}  onClose={() => setBdgModal(null)}   onDone={loadMembers} operatorId={profile.id} toast={toast} />}
      {histModal   && <HistoryModal    member={histModal} onClose={() => setHistModal(null)} />}
      {certModal   && <CertModal       member={certModal} onClose={() => setCertModal(null)}  onDone={loadMembers} operatorId={profile.id} toast={toast} />}
      {examModal   && <AdminCertExamModal member={examModal} onClose={() => setExamModal(null)} onDone={loadMembers} operatorId={profile.id} toast={toast} />}
      {dispModal   && <DisputeModal    member={dispModal} disputeList={disputes[dispModal.id] || []}
                         onClose={() => setDispModal(null)} onDone={loadMembers} operatorId={profile.id} toast={toast} />}
      {guestModal  && <GuestQRModal onClose={() => setGuestModal(false)} toast={toast} />}

      <ConfirmModal open={!!delConfirm} title="確認刪除" message="確定要刪除此會員？此操作無法復原。"
        onConfirm={() => handleDelete(delConfirm)} onCancel={() => setDelConfirm(null)} />
    </div>
  );
}

// ── 訪客 QR Code Modal ────────────────────────────────────
function GuestQRModal({ onClose, toast }) {
  const [url,        setUrl]        = useState("");
  const [expiresAt,  setExpiresAt]  = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied,     setCopied]     = useState(false);

  async function generate() {
    setGenerating(true);
    setCopied(false);
    try {
      const { generateGuestToken } = await import("../../lib/db");
      const { token, expiresAt: exp } = await generateGuestToken();
      setUrl(`${window.location.origin}?guest=${token}`);
      setExpiresAt(exp);
    } catch (e) {
      toast("產生失敗：" + (e?.message || "未知錯誤"));
    }
    setGenerating(false);
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("請手動複製連結");
    }
  }

  const expireStr = expiresAt
    ? new Date(expiresAt).toLocaleString("zh-TW", { hour12:false, month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" })
    : "";

  return (
    <Modal open onClose={onClose} title="📱 訪客體驗 QR Code">
      <div className="flex flex-col gap-4">

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-700 text-sm">
          產生 QR Code 後讓客人掃描，即可進入 <strong>3 小時</strong>體驗模式，無需登入。
        </div>

        <Btn v="primary" onClick={generate} disabled={generating}>
          {generating ? "產生中…" : "🎲 產生新 QR Code"}
        </Btn>

        {url && (
          <div className="flex flex-col items-center gap-3">
            {/* QR Code 主體 */}
            <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-200">
              <QRCodeSVG
                value={url}
                size={220}
                level="M"
                includeMargin={false}
                fgColor="#1e293b"
              />
            </div>

            {/* 到期時間 */}
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <span>⏰</span>
              <span>有效至 <strong className="text-slate-200">{expireStr}</strong></span>
            </div>

            {/* 複製連結（備用）*/}
            <button onClick={copyUrl}
              className={`w-full py-2.5 rounded-xl text-sm font-bold border transition-all ${copied ? "bg-green-900/40 border-green-400/40 text-green-300" : "border-white/10 text-slate-300 hover:border-white/20"}`}
              style={!copied?{background:"rgba(255,255,255,0.06)"}:{}}>
              {copied ? "✅ 已複製連結" : "📋 複製連結（備用）"}
            </button>

            {/* 測試連結 */}
            <a href={url} target="_blank" rel="noreferrer"
              className="text-blue-500 text-xs underline">
              在新分頁測試
            </a>
          </div>
        )}

        <Btn v="secondary" onClick={onClose}>關閉</Btn>
      </div>
    </Modal>
  );
}

// ── 會員卡 ────────────────────────────────────────────────
function MemberCard({ member: m, disputeList, onEdit, onBadge, onHistory, onCert, onCertExam, onDispute, onDelete, onResetMonster }) {
  const [expanded, setExpanded] = useState(false);
  const lastLogin  = m.lastLoginAt?.toDate?.() ? fmtDT(m.lastLoginAt) : "未登入";
  const equipSets  = normalizeEquipment(m.equipment).filter(s => s.type !== "armor" && s.type !== "accessory");
  const armorSets  = m.armorSets || [];
  const accSets    = m.accessorySets || [];
  const hasDispute = disputeList.length > 0;

  return (
    <div className={`rounded-2xl border overflow-hidden ${hasDispute ? "border-red-400/50 ring-2 ring-red-400/20" : "border-white/10"}`} style={{ background:"rgba(255,255,255,0.04)" }}>
      <button className="w-full text-left p-3 transition-colors hover:bg-white/5" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {hasDispute && <span className="text-red-500 text-xs animate-pulse">🔴</span>}
              <span className="font-black text-white text-sm">{m.nickname || m.name}</span>
              {m.nickname && m.name !== m.nickname && (
                <span className="text-gray-400 text-xs">「{m.name}」</span>
              )}
              <span className="text-xs bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded-full">
                {formatArcherNo(m.archerNo)}
              </span>
            </div>
            <div className="text-gray-400 text-xs mt-0.5">
              射齡 {calcAge(m.joinDate)}　最近登入：{lastLogin}
            </div>
            <div className="flex gap-2 text-xs text-gray-500 mt-1 flex-wrap">
              <span>🐱 {m.fatCat?.gold||0}金{m.fatCat?.silver||0}銀{m.fatCat?.bronze||0}銅</span>
              <span>⭐ {m.score?.gold||0}金{m.score?.silver||0}銀{m.score?.bronze||0}銅</span>
              <span>🏆 {m.achievement?.black||0}黑{m.achievement?.gold||0}金{m.achievement?.silver||0}銀</span>
            </div>
            {(equipSets.length > 0 || armorSets.length > 0 || accSets.length > 0) && (
              <div className="flex gap-1 flex-wrap mt-1">
                {equipSets.slice(0,2).map((s,i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">🏹 {s.label || s.bowCategory}</span>
                ))}
                {armorSets.slice(0,1).map((s,i) => (
                  <span key={i} className="text-xs bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full">🛡️ {s.label || `防具${i+1}`}</span>
                ))}
                {accSets.slice(0,1).map((s,i) => (
                  <span key={i} className="text-xs bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded-full">✨ {s.label || `飾品${i+1}`}</span>
                ))}
              </div>
            )}
          </div>
          <span className="text-gray-300 text-xs mt-1 flex-shrink-0">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-3 flex flex-col gap-2">
          <div className="flex gap-1.5 flex-wrap">
            <Btn v="secondary" size="sm" onClick={onEdit}>✏️ 編輯</Btn>
            <Btn v="secondary" size="sm" onClick={onBadge}>🏅 徽章</Btn>
            <Btn v="secondary" size="sm" onClick={onCert}>📋 檢定</Btn>
            <Btn v="secondary" size="sm" onClick={onCertExam}>🎖️ 射手證</Btn>
            <Btn v="secondary" size="sm" onClick={onHistory}>📊 歷程</Btn>
            <Btn v="secondary" size="sm" onClick={onResetMonster}>⚔️ 重置打怪</Btn>
            {hasDispute && (
              <Btn v="danger" size="sm" onClick={onDispute}>🔴 處理（{disputeList.length}）</Btn>
            )}
          </div>
          <button onClick={onDelete} className="text-red-300 hover:text-red-500 text-xs self-end">刪除會員</button>
        </div>
      )}
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────

function AddMemberModal({ onClose, onDone, operatorId, toast }) {
  const [form, setForm] = useState({
    email:"", password:"", name:"", nickname:"", archerNo:"",
    archerNoDate:"", joinDate:today(), phone:"", note:"",
    equipment:[], armorSets:[], accessorySets:[],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const [equipTab, setEquipTab] = useState("bow");

  async function save() {
    if (!form.email || !form.password || !form.name) { setErr("請填寫信箱、密碼、姓名"); return; }
    setSaving(true);
    // 用第二個 Firebase App 建立帳號，避免切換主要登入身份
    const tmpApp  = initializeApp(firebaseConfig, "tmp_" + Date.now());
    const tmpAuth = getAuth(tmpApp);
    try {
      const cred = await createUserWithEmailAndPassword(tmpAuth, form.email, form.password);
      const { password, ...rest } = form;
      await createMember({ ...rest, uid: cred.user.uid }, operatorId);
      toast("會員新增成功 🐱");
      onDone(); onClose();
    } catch (e) { setErr(e.message); }
    finally { deleteApp(tmpApp).catch(() => {}); }
    setSaving(false);
  }

  const f = (k, label, type="text", hint="") => (
    <Inp key={k} label={label} type={type} hint={hint} value={form[k]||""}
      onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
  );

  return (
    <Modal open wide onClose={onClose} title="新增會員">
      <div className="flex flex-col gap-5">
        <Section title="🔑 登入資訊">
          <div className="grid grid-cols-2 gap-3">
            {f("email","電子信箱","email")}
            {f("password","初始密碼","password")}
          </div>
        </Section>
        <Section title="👤 基本資料">
          <div className="grid grid-cols-2 gap-3">
            {f("name","姓名")}{f("nickname","暱稱")}
            {f("archerNo","射手證編號")}{f("archerNoDate","領取日期","date")}
            {f("joinDate","加入日期","date")}{f("phone","聯絡電話","tel")}
          </div>
          <TA label="備註" value={form.note} rows={2}
            onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
        </Section>
        <Section title="🎒 裝備清單">
          <EquipTabs active={equipTab} onChange={setEquipTab} />
          {equipTab === "bow"       && <EquipmentEditor value={form.equipment} onChange={eq => setForm(p => ({ ...p, equipment: eq }))} />}
          {equipTab === "armor"     && <ArmorManager value={form.armorSets} onChange={sets => setForm(p => ({ ...p, armorSets: sets }))} />}
          {equipTab === "accessory" && <AccessoryManager value={form.accessorySets} onChange={sets => setForm(p => ({ ...p, accessorySets: sets }))} />}
        </Section>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={save} disabled={saving}>{saving?"儲存中…":"新增會員"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function EditMemberModal({ member, onClose, onDone, operatorId, toast }) {
  const [form, setForm] = useState({
    name: member.name||"", nickname: member.nickname||"",
    archerNo: member.archerNo||"", archerNoDate: member.archerNoDate||"",
    joinDate: member.joinDate||"", phone: member.phone||"", note: member.note||"",
    equipment: normalizeEquipment(member.equipment),
    armorSets: member.armorSets||[],
    accessorySets: member.accessorySets||[],
  });
  const [saving, setSaving]     = useState(false);
  const [equipTab, setEquipTab] = useState("bow");

  async function save() {
    setSaving(true);
    await updateMember(member.id, form, operatorId);
    toast("已儲存 ✓");
    onDone(); onClose();
    setSaving(false);
  }

  const f = (k, label, type="text") => (
    <Inp key={k} label={label} type={type} value={form[k]||""}
      onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
  );

  return (
    <Modal open wide onClose={onClose} title={`編輯 — ${member.name}`}>
      <div className="flex flex-col gap-5">
        <Section title="👤 基本資料">
          <div className="grid grid-cols-2 gap-3">
            {f("name","姓名")}{f("nickname","暱稱")}
            {f("archerNo","射手證編號")}{f("archerNoDate","領取日期","date")}
            {f("joinDate","加入日期","date")}{f("phone","聯絡電話","tel")}
          </div>
          <TA label="備註" value={form.note} rows={2}
            onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
        </Section>
        <Section title="🎒 裝備清單">
          <EquipTabs active={equipTab} onChange={setEquipTab} />
          {equipTab === "bow"       && <EquipmentEditor value={form.equipment} onChange={eq => setForm(p => ({ ...p, equipment: eq }))} />}
          {equipTab === "armor"     && <ArmorManager value={form.armorSets} onChange={sets => setForm(p => ({ ...p, armorSets: sets }))} />}
          {equipTab === "accessory" && <AccessoryManager value={form.accessorySets} onChange={sets => setForm(p => ({ ...p, accessorySets: sets }))} />}
        </Section>
        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={save} disabled={saving}>{saving?"儲存中…":"儲存"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function EquipTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 mb-3">
      {[["bow","🏹 弓組"],["armor","🛡️ 防具"],["accessory","✨ 飾品"]].map(([k,l]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${active===k?"bg-blue-600 text-white border-blue-600":"border-white/10 text-slate-300"}`}
          style={active!==k?{background:"rgba(255,255,255,0.06)"}:{}}>
          {l}
        </button>
      ))}
    </div>
  );
}

function BadgeModal({ member, onClose, onDone, operatorId, toast }) {
  const [adding, setAdding] = useState({ type:"fatCat", color:"bronze", count:1, note:"" });
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState({
    fatCat:      { gold:0, silver:0, bronze:0, ...(member.fatCat || {}) },
    score:       { gold:0, silver:0, bronze:0, ...(member.score || {}) },
    achievement: { black:0, gold:0, silver:0,  ...(member.achievement || {}) },
  });
  const [savingFix, setSavingFix] = useState(false);

  function setCount(type, key, val) {
    setCounts(p => ({ ...p, [type]: { ...p[type], [key]: Math.max(0, Number(val)||0) } }));
  }

  async function save() {
    setSaving(true);
    await addBadge(member.id, adding.type, adding.color, Number(adding.count), operatorId, adding.note);
    toast("徽章已新增，等待射手確認領取 🏅");
    onDone(); onClose();
    setSaving(false);
  }

  async function saveFix() {
    setSavingFix(true);
    await updateMember(member.id, { fatCat:counts.fatCat, score:counts.score, achievement:counts.achievement }, operatorId);
    toast("徽章數量已修正 ✓");
    onDone(); onClose();
    setSavingFix(false);
  }

  return (
    <Modal open wide onClose={onClose} title={`徽章 — ${member.name}`}>
      <div className="flex flex-col gap-5">
        <div>
          <ST>目前持有</ST>
          {[["🐱 肥貓章","fatCat",member.fatCat,["gold","silver","bronze"],["金","銀","銅"]],
            ["⭐ 積分章","score",member.score,["gold","silver","bronze"],["金","銀","銅"]],
            ["🏆 成就章","achievement",member.achievement,["black","gold","silver"],["黑","金","銀"]]].map(([lbl,,data,keys,names]) => (
            <div key={lbl} className="mb-2">
              <div className="text-gray-500 text-xs mb-1">{lbl}</div>
              <div className="flex gap-2">{keys.map((k,i) => <BadgePip key={k} label={names[i]} color={k} count={(data||{})[k]||0} />)}</div>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 rounded-xl p-4 flex flex-col gap-3">
          <ST>新增徽章</ST>
          <div className="grid grid-cols-3 gap-2">
            <Sel label="章別" value={adding.type} onChange={e => setAdding(p=>({...p,type:e.target.value}))}
              options={[{value:"fatCat",label:"🐱 肥貓"},{value:"score",label:"⭐ 積分"},{value:"achievement",label:"🏆 成就"}]} />
            <Sel label="等級" value={adding.color} onChange={e => setAdding(p=>({...p,color:e.target.value}))}
              options={adding.type==="achievement"
                ?[{value:"silver",label:"銀"},{value:"gold",label:"金"},{value:"black",label:"黑"}]
                :[{value:"bronze",label:"銅"},{value:"silver",label:"銀"},{value:"gold",label:"金"}]} />
            <Inp label="數量" type="number" min="1" value={adding.count}
              onChange={e => setAdding(p=>({...p,count:e.target.value}))} />
          </div>
          <Inp label="備註" value={adding.note} placeholder="例如：積分賽第一名"
            onChange={e => setAdding(p=>({...p,note:e.target.value}))} />
          <Btn v="primary" onClick={save} disabled={saving}>{saving?"發放中…":"發放徽章"}</Btn>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-3">
          <ST>⚙️ 直接修正數量</ST>
          {[["🐱 肥貓","fatCat",["gold","silver","bronze"],["金","銀","銅"]],
            ["⭐ 積分","score",["gold","silver","bronze"],["金","銀","銅"]],
            ["🏆 成就","achievement",["black","gold","silver"],["黑","金","銀"]]].map(([lbl,type,keys,names]) => (
            <div key={type}>
              <div className="text-gray-500 text-xs mb-1">{lbl}</div>
              <div className="grid grid-cols-3 gap-2">
                {keys.map((k,i) => (
                  <Inp key={k} label={names[i]} type="number" min="0"
                    value={counts[type][k]} onChange={e => setCount(type,k,e.target.value)} />
                ))}
              </div>
            </div>
          ))}
          <Btn v="secondary" onClick={saveFix} disabled={savingFix}>{savingFix?"修正中…":"💾 修正數量"}</Btn>
        </div>
        <Btn v="secondary" onClick={onClose}>關閉</Btn>
      </div>
    </Modal>
  );
}

function DisputeModal({ member, disputeList, onClose, onDone, operatorId, toast }) {
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState({
    fatCat:      { gold:0, silver:0, bronze:0, ...(member.fatCat || {}) },
    score:       { gold:0, silver:0, bronze:0, ...(member.score || {}) },
    achievement: { black:0, gold:0, silver:0,  ...(member.achievement || {}) },
  });
  const [note, setNote] = useState("");
  const disputedTypes = [...new Set(disputeList.map(d => d.badgeType))];

  function setCount(type, key, val) {
    setCounts(p => ({ ...p, [type]: { ...p[type], [key]: Math.max(0, Number(val)||0) } }));
  }

  async function resolveAll(applyCounts) {
    setSaving(true);
    try {
      if (applyCounts) await updateMember(member.id, { fatCat:counts.fatCat, score:counts.score, achievement:counts.achievement }, operatorId);
      for (const log of disputeList) await resolveBadgeDispute(log.id, operatorId, 0, note||(applyCounts?"已修正數量":"已確認無誤"));
      toast(applyCounts ? "已修正並結案 ✓" : "已結案 ✓");
      onDone(); onClose();
    } catch (e) { toast("處理失敗：" + e.message); }
    setSaving(false);
  }

  return (
    <Modal open wide onClose={onClose} title={`處理回報 — ${member.name}`}>
      <div className="flex flex-col gap-4">
        <ST>射手回報內容</ST>
        {disputeList.map(log => (
          <div key={log.id} className="border border-red-400/30 rounded-xl p-3" style={{ background:"rgba(127,29,29,0.2)" }}>
            <div className="text-slate-200 text-sm font-bold mb-1">
              {BADGE_DEF[log.badgeType]?.label}　<span className="text-gray-400 font-normal">{log.note||"（無備註）"}</span>
            </div>
            <div className="text-red-600 text-sm">回報：{log.disputeReason||"（未填原因）"}</div>
            <div className="text-gray-400 text-xs mt-1">{fmtDT(log.disputedAt)}</div>
          </div>
        ))}
        <div className="rounded-xl p-4 flex flex-col gap-3 border border-white/10" style={{ background:"rgba(255,255,255,0.06)" }}>
          <ST>修正數量</ST>
          {Object.entries(BADGE_DEF).map(([type, def]) => (
            <div key={type} className={disputedTypes.includes(type) ? "" : "opacity-60"}>
              <div className="text-gray-500 text-xs mb-1">
                {def.label}
                {disputedTypes.includes(type) && <span className="text-red-500 ml-1">← 被回報</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {def.keys.map((k,i) => (
                  <Inp key={k} label={def.names[i]} type="number" min="0"
                    value={counts[type][k]} onChange={e => setCount(type,k,e.target.value)} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <Inp label="處理備註" value={note} placeholder="例如：已確認補回1銀章" onChange={e => setNote(e.target.value)} />
        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="secondary" className="flex-1" onClick={() => resolveAll(false)} disabled={saving}>確認無誤</Btn>
          <Btn v="primary"   className="flex-1" onClick={() => resolveAll(true)}  disabled={saving}>修正結案</Btn>
        </div>
      </div>
    </Modal>
  );
}

function HistoryModal({ member, onClose }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    import("../../lib/db").then(({ getMemberResults }) => {
      getMemberResults(member.id).then(data => { setLogs(data); setLoading(false); });
    });
  }, [member.id]);
  return (
    <Modal open wide onClose={onClose} title={`歷程 — ${member.name}`}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[["參賽場數",logs.length,"text-blue-600"],
            ["賽事積分",member.eventPoints||0,"text-orange-600"],
            ["最高單場",logs.length?Math.max(...logs.map(l=>l.total||0)):0,"text-green-600"]].map(([k,v,c])=>(
            <div key={k} className="rounded-xl p-3 text-center border border-white/10" style={{ background:"rgba(255,255,255,0.06)" }}>
              <div className="text-slate-400 text-xs">{k}</div>
              <div className={`font-black text-2xl ${c}`}>{v}</div>
            </div>
          ))}
        </div>
        {loading ? <Spinner /> : logs.length === 0 ? <Empty message="尚無參賽紀錄" /> : (
          <div className="flex flex-col gap-2">
            {logs.map(l => (
              <div key={l.id} className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
                <div className="flex-1">
                  <div className="text-slate-300 text-sm">{l.compTitle||"—"}</div>
                  <div className="text-gray-400 text-xs">{l.submittedAt?fmtDT(l.submittedAt):(l.date||"")}</div>
                </div>
                <div className="text-blue-600 font-black text-xl">{l.total??"—"}</div>
              </div>
            ))}
          </div>
        )}
        <AuditSection targetId={member.id} />
      </div>
    </Modal>
  );
}

function AuditSection({ targetId }) {
  const [logs, setLogs] = useState([]);
  const [show, setShow] = useState(false);
  useEffect(() => { if (show) getAuditLogs(targetId).then(setLogs); }, [show, targetId]);
  return (
    <div>
      <button onClick={() => setShow(!show)} className="text-gray-400 text-xs hover:text-gray-600">
        {show ? "▲ 隱藏" : "▼ 顯示"} 修改歷程
      </button>
      {show && (
        <div className="mt-2 flex flex-col gap-1 max-h-48 overflow-y-auto">
          {logs.length === 0 ? <p className="text-gray-400 text-xs">無紀錄</p> : logs.map(l => (
            <div key={l.id} className="text-xs text-gray-500 border-l-2 border-gray-200 pl-2 py-0.5">
              <span className="font-bold">{l.action}</span> {fmtDT(l.createdAt)} by {l.operatorId?.slice(0,8)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CertModal({ member, onClose, onDone, operatorId, toast }) {
  const [records, setRecords] = useState([]);
  const [year, setYear]       = useState(String(thisYear()));
  const [half, setHalf]       = useState("first");
  const [editing, setEditing] = useState({});
  const [saving, setSaving]   = useState(false);

  useEffect(() => { getCertRecords(member.id).then(setRecords); }, [member.id]);

  function getScore(bowType, y, h) {
    const r = records.find(rr => rr.bowType===bowType && String(rr.year)===String(y) && (rr.half||"first")===h);
    return r?.score || 0;
  }

  async function save() {
    setSaving(true);
    try {
      for (const [bowType, scoreStr] of Object.entries(editing)) {
        if (scoreStr === "") continue;
        const score = Number(scoreStr);
        if (Number.isNaN(score)) continue;
        if (score <= 0) await deleteCertRecord(member.id, Number(year), half, bowType, operatorId);
        else await upsertCertRecord(member.id, Number(year), half, bowType, score, operatorId);
      }
      toast("已儲存 ✓");
      const fresh = await getCertRecords(member.id);
      setRecords(fresh); setEditing({});
    } catch (e) { toast("失敗：" + (e?.message||""), "error"); }
    setSaving(false);
  }

  return (
    <Modal open wide onClose={onClose} title={`檢定 — ${member.name}`}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Inp label="年度" type="number" value={year} onChange={e => { setYear(e.target.value); setEditing({}); }} />
          <Sel label="週期" value={half} onChange={e => { setHalf(e.target.value); setEditing({}); }}
            options={[{value:"first",label:"上半年"},{value:"second",label:"下半年"}]} />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 text-xs">
          填0刪除；留空不變動
        </div>
        <div className="flex flex-col gap-4">
          {Object.entries(BOW_TYPES).map(([bk, bt]) => {
            const score = getScore(bk, year, half);
            const level = getCertLevel(bk, score);
            return (
              <div key={bk} className="rounded-xl p-4 border border-white/10" style={{ background:"rgba(255,255,255,0.06)" }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-300 text-sm">{bt.icon} {bt.label}</div>
                    <div className="text-xs text-gray-400">{score>0?`${score}分 ${level||"未通過"}`:"尚未參加"}</div>
                  </div>
                  {score>0 && level && <span className="text-xs font-bold bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded-full">{level}</span>}
                </div>
                <Inp label="成績（留空不變）" type="number" min="0"
                  value={editing[bk]!==undefined?editing[bk]:""}
                  placeholder={score>0?String(score):"輸入分數"}
                  onChange={e => setEditing(p => ({ ...p, [bk]: e.target.value }))} />
                <div className="flex gap-1 flex-wrap mt-2">
                  {Object.entries(bt.thresholds).map(([name, pts]) => (
                    <span key={name} className={`text-xs px-2 py-0.5 rounded-full ${score>=pts?"bg-blue-600 text-white":"bg-slate-700 text-slate-400"}`}>
                      {name} {pts}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary"   className="flex-1" onClick={save} disabled={saving}>{saving?"儲存中…":"儲存"}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-slate-400 text-xs font-bold mb-3">{title}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}