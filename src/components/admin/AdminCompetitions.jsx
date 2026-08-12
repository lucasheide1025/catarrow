import { CERT_HALF, thisYear, getCertLevelByScores } from "../../lib/constants";
import { certCompTitle } from "../../lib/certStatus";
import CertRuleFields, { defaultCertScores } from "./CertRuleFields";
import { useState, useEffect, useRef } from "react";
import {
  getCompetitions, createCompetition, updateCompetition,
  getRegistrations, getMembers, submitResult, settleCompetition,
  saveExternalCompetitionCatalog,
  subscribeCompResults, approveCertResult, rejectCertResult
} from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { COMP_TYPES, COMP_TYPE_COLOR, today, fmtDT, getMonthRange, certLevelStyle } from "../../lib/constants";
import { EXTERNAL_COMP_FORMATS } from "../../lib/achievementDex";
import { dropLocal } from "../../lib/localCache";
import { Card, Btn, Inp, TA, Sel, Modal, ST, Spinner, Empty, Pill, useToast, ConfirmModal } from "../shared/UI";

const STATUS_OPTIONS = [
  { value: "upcoming",  label: "即將開始" },
  { value: "open",      label: "報名中" },
  { value: "ongoing",   label: "進行中" },
  { value: "finished",  label: "已結束" },
  { value: "settled",   label: "結算完成" },
];

const PERIOD_OPTIONS = [
  { value: "single",  label: "單日" },
  { value: "monthly", label: "月週期" },
];

const isExternalDexCompetition = comp => comp?.dexCatalog === true && comp?.dexKind === "external";
const externalFormatLabel = id => EXTERNAL_COMP_FORMATS.find(item => item.id === id)?.label || "外賽";

export default function AdminCompetitions() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [comps, setComps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [filter, setFilter] = useState("全部");
  const [certModal, setCertModal] = useState(false);
  const [mode, setMode] = useState("internal");
  const [externalModal, setExternalModal] = useState(null);

  useEffect(() => { loadComps(); }, []);

  async function loadComps() {
    setLoading(true);
    const data = await getCompetitions();
    setComps(data);
    setLoading(false);
  }

  const internalComps = comps.filter(c => !isExternalDexCompetition(c));
  const externalComps = comps.filter(isExternalDexCompetition);
  const filtered = filter === "全部" ? internalComps : internalComps.filter(c => c.type === filter);

  async function handleSettle(compId) {
    await settleCompetition(compId, profile.id);
    toast("結算完成，積分已發放 ✓");
    loadComps();
  }

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode("internal")}
          className={`rounded-xl border px-3 py-2 text-sm font-black ${mode === "internal" ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-500"}`}>
          🏆 館內賽事
        </button>
        <button type="button" onClick={() => setMode("external")}
          className={`rounded-xl border px-3 py-2 text-sm font-black ${mode === "external" ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-gray-200 text-gray-500"}`}>
          🏅 外賽圖鑑
        </button>
      </div>

      {mode === "internal" ? <>
        <div className="flex gap-2">
          <Btn v="primary" size="sm" onClick={() => setAddModal(true)}>+ 新增比賽</Btn>
          <Btn v="secondary" size="sm" onClick={() => setCertModal(true)}>📋 新增檢定賽</Btn>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {["全部", ...COMP_TYPES].map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${filter === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
              {t}
            </button>
          ))}
        </div>

        {filtered.length === 0 && <Empty message="尚無館內比賽" />}

        {filtered.map(c => (
          <CompCard key={c.id} comp={c}
            onDetail={() => setDetailModal(c)}
            onSettle={() => handleSettle(c.id)}
            onStatusChange={async (status) => {
              await updateCompetition(c.id, { status }, profile.id);
              loadComps();
            }}
          />
        ))}
      </> : <>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
          外賽由外部主辦方進行，本系統不報名、不射箭、不結算。建立項目後由教練勾選參賽射手，儲存即自動核發參加圖鑑；有名次時再回來補第 1～8 名。
        </div>
        <Btn v="primary" size="sm" onClick={() => setExternalModal({})}>+ 建立外賽項目</Btn>
        {externalComps.length === 0 && <Empty message="尚無外賽圖鑑項目" />}
        {externalComps.map(comp => (
          <ExternalCompCard key={comp.id} comp={comp} onEdit={() => setExternalModal(comp)} />
        ))}
      </>}

      {addModal && (
        <AddCompModal onClose={() => setAddModal(false)} onDone={loadComps}
          operatorId={profile.id} toast={toast} />
      )}
      {detailModal && (
        <CompDetailModal comp={detailModal} onClose={() => setDetailModal(null)}
          operatorId={profile.id} toast={toast} onDone={loadComps} />
      )}
      {certModal && (
        <AddCertModal onClose={() => setCertModal(false)} onDone={loadComps}
          operatorId={profile.id} toast={toast} />
      )}
      {externalModal && (
        <ExternalCompModal comp={externalModal?.id ? externalModal : null}
          onClose={() => setExternalModal(null)} onDone={loadComps}
          operatorId={profile.id} toast={toast} />
      )}
    </div>
  );
}

function ExternalCompCard({ comp, onEdit }) {
  const roster = Array.isArray(comp.externalRoster) ? comp.externalRoster : [];
  const rankedCount = roster.filter(entry => Number(entry.rank) >= 1 && Number(entry.rank) <= 8).length;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-black text-amber-900">{externalFormatLabel(comp.externalFormat)}</span>
            <span className="text-xs font-bold text-emerald-600">✓ 教練直接核發</span>
          </div>
          <div className="font-black text-gray-800">{comp.title}</div>
          <div className="mt-1 text-xs text-gray-500">📅 {comp.date}{comp.endDate ? ` ～ ${comp.endDate}` : ""}</div>
          <div className="mt-2 text-xs text-gray-600">
            👥 已核發參加 {roster.length} 人{rankedCount ? `　🏅 已填名次 ${rankedCount} 人` : ""}
          </div>
        </div>
        <Btn v="secondary" size="sm" onClick={onEdit}>✏️ 名單／名次</Btn>
      </div>
    </div>
  );
}

function ExternalCompModal({ comp, onClose, onDone, operatorId, toast }) {
  const [form, setForm] = useState({
    title: comp?.title || "",
    date: comp?.date || today(),
    endDate: comp?.endDate || "",
    externalFormat: comp?.externalFormat || "qualification",
    announcement: comp?.announcement || "",
  });
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState({});
  const [initialMemberIds, setInitialMemberIds] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getMembers({ fresh:true }).then(list => {
      if (!alive) return;
      const officialIds = new Set(list.map(member => member.id));
      const initial = {};
      (comp?.externalRoster || []).forEach(entry => {
        if (!entry?.memberId || !officialIds.has(entry.memberId)) return;
        const rank = Number(entry.rank);
        initial[entry.memberId] = Number.isInteger(rank) && rank >= 1 && rank <= 8 ? rank : null;
      });
      list.forEach(member => {
        const saved = comp?.id ? member.competitionDex?.[comp.id] : null;
        if (!saved?.participated) return;
        const rank = Number(saved.rank);
        initial[member.id] = Number.isInteger(rank) && rank >= 1 && rank <= 8 ? rank : null;
      });
      setMembers(list);
      setSelected(initial);
      setInitialMemberIds(Object.keys(initial));
      setLoadingMembers(false);
    }).catch(error => {
      if (!alive) return;
      setLoadError(error?.message || "讀取射手名單失敗");
      setLoadingMembers(false);
    });
    return () => { alive = false; };
  }, [comp]);

  const queryText = search.trim().toLowerCase();
  const visibleMembers = members.filter(member => !queryText || [member.name, member.nickname, member.archerNo]
    .some(value => String(value || "").toLowerCase().includes(queryText)));
  const selectedCount = Object.keys(selected).length;
  const isSelected = memberId => Object.prototype.hasOwnProperty.call(selected, memberId);

  function toggleMember(memberId) {
    setSelected(prev => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, memberId)) delete next[memberId];
      else next[memberId] = null;
      return next;
    });
  }

  async function save() {
    if (!form.title.trim() || !form.date) { toast("請填寫外賽名稱與日期", "error"); return; }
    if (selectedCount === 0) { toast("請至少選擇 1 位參賽射手", "error"); return; }
    setSaving(true);
    try {
      const roster = members.filter(member => isSelected(member.id)).map(member => ({
        memberId: member.id,
        name: member.name || "",
        nickname: member.nickname || "",
        rank: selected[member.id],
      }));
      await saveExternalCompetitionCatalog({
        ...(comp?.id ? { id:comp.id } : {}),
        ...form,
        roster,
        previousMemberIds: initialMemberIds,
      }, operatorId);
      dropLocal("dex_competition_catalog_v1");
      toast(comp?.id ? "外賽名單與名次已更新 ✓" : `外賽已建立，${roster.length} 位射手已自動取得參加圖鑑 ✓`);
      await onDone();
      onClose();
    } catch (error) {
      toast("儲存失敗：" + (error?.message || "請重試"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open wide onClose={onClose} title={comp?.id ? "編輯外賽名單／名次" : "建立外賽項目"}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
          勾選射手＝立即核發「參加」；名次可先留空，賽後再補第 1～8 名。同一場只會有一張圖鑑卡。
        </div>
        <Inp label="外賽名稱" value={form.title} onChange={e => setForm(prev => ({ ...prev, title:e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="比賽日期" type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date:e.target.value }))} />
          <Inp label="結束日期（選填）" type="date" value={form.endDate} onChange={e => setForm(prev => ({ ...prev, endDate:e.target.value }))} />
        </div>
        <Sel label="外賽賽制" value={form.externalFormat}
          onChange={e => setForm(prev => ({ ...prev, externalFormat:e.target.value }))}
          options={EXTERNAL_COMP_FORMATS.map(item => ({ value:item.id, label:item.label }))} />
        <TA label="備註（選填）" rows={2} value={form.announcement}
          onChange={e => setForm(prev => ({ ...prev, announcement:e.target.value }))} />

        <div className="border-t border-gray-200 pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-black text-gray-700">👥 參賽射手 <span className="text-amber-600">{selectedCount} 人</span></div>
            {selectedCount > 0 && (
              <button type="button" onClick={() => setSelected({})} className="text-xs font-bold text-gray-400 hover:text-red-500">清空名單</button>
            )}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋姓名、暱稱、射手證號"
            className="mb-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400" />
          {loadingMembers ? <Spinner /> : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{loadError}</div>
          ) : (
            <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-gray-200">
              {visibleMembers.map(member => {
                const checked = isSelected(member.id);
                return (
                  <div key={member.id} className={`flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0 ${checked ? "bg-amber-50" : "bg-white"}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMember(member.id)} className="h-4 w-4 accent-amber-500" />
                    <button type="button" onClick={() => toggleMember(member.id)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-bold text-gray-800">{member.nickname || member.name || member.id}</div>
                      <div className="text-xs text-gray-400">{member.name && member.nickname ? member.name : ""}{member.archerNo ? `　#${member.archerNo}` : ""}</div>
                    </button>
                    {checked && (
                      <select value={selected[member.id] ?? ""}
                        onChange={e => setSelected(prev => ({ ...prev, [member.id]:e.target.value ? Number(e.target.value) : null }))}
                        className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs font-bold text-gray-700">
                        <option value="">僅參加</option>
                        {[1,2,3,4,5,6,7,8].map(rank => <option key={rank} value={rank}>第 {rank} 名</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
              {visibleMembers.length === 0 && <div className="p-5 text-center text-sm text-gray-400">找不到符合的正式射手</div>}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={save} disabled={saving || loadingMembers || !!loadError}>
            {saving ? "儲存中…" : `儲存並核發（${selectedCount} 人）`}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function CompCard({ comp: c, onDetail, onSettle, onStatusChange }) {
  const tc = COMP_TYPE_COLOR[c.type] || {};
  const TYPE_BG = {
    "積分賽":    { bar: "#2563eb", bg: "#eff6ff" },
    "挑戰賽":    { bar: "#ea580c", bg: "#fff7ed" },
    "實體賽":    { bar: "#9333ea", bg: "#faf5ff" },
    "臨時任務賽": { bar: "#16a34a", bg: "#f0fdf4" },
    "年度檢定":  { bar: "#0891b2", bg: "#ecfeff" },
  };
  const ts = TYPE_BG[c.type] || { bar: "#94a3b8", bg: "#ffffff" };
  return (
    <div className="rounded-2xl p-4 shadow-sm" style={{ borderLeft: `4px solid ${ts.bar}`, background: ts.bg }}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold ${tc.text}`}>{c.type}</span>
            <Pill status={c.status} />
            {c.period === "monthly" && (
              <span className="text-xs bg-purple-100 text-purple-600 font-bold px-2 py-0.5 rounded-full">月週期</span>
            )}
          </div>
          <div className="text-gray-800 font-bold text-sm">{c.title}</div>
          <div className="text-gray-400 text-xs mt-0.5">
            📅 {c.date}{c.endDate ? ` ～ ${c.endDate}` : ""}
            {c.targetName && `　🎯 ${c.targetName}`}
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mt-3">
        <select value={c.status}
          onChange={e => onStatusChange(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 text-xs">
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <Btn v="secondary" size="sm" onClick={onDetail}>📋 詳情/成績</Btn>
        {c.status === "finished" && (
          <Btn v="success" size="sm" onClick={onSettle}>🏅 結算積分</Btn>
        )}
      </div>
    </div>
  );
}

function AddCompModal({ onClose, onDone, operatorId, toast }) {
  const [form, setForm] = useState({
    type: "積分賽", title: "", date: today(), endDate: "",
    targetName: "", arrowCount: 6, roundCount: 5, maxScore: 10,
    hasMiss: true, period: "single", status: "upcoming",
    announcement: "", rewards: { fatCat: false, score: false, achievement: false },
  });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const [targetImg, setTargetImg] = useState(null);

  function handleUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => setTargetImg(ev.target.result); r.readAsDataURL(f);
  }

  function handlePeriodChange(period) {
    setForm(p => ({ ...p, period }));
    if (period === "monthly" && form.date) {
      const d = new Date(form.date);
      const range = getMonthRange(d.getFullYear(), d.getMonth() + 1);
      setForm(p => ({ ...p, period, date: range.startDate, endDate: range.endDate, title: p.title || range.label + " " + p.type }));
    }
  }

  async function save() {
    if (!form.title || !form.date) { toast("請填寫標題和日期", "error"); return; }
    setSaving(true);
    await createCompetition({ ...form, target: targetImg }, operatorId);
    toast("比賽已建立 ✓");
    onDone(); onClose();
    setSaving(false);
  }

  const f = (k, label, type = "text") => (
    <Inp key={k} label={label} type={type} value={form[k] || ""}
      onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} />
  );

  return (
    <Modal open wide onClose={onClose} title="新增比賽">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Sel label="比賽類型" value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            options={COMP_TYPES.map(t => ({ value: t, label: t }))} />
          <Sel label="時間週期" value={form.period}
            onChange={e => handlePeriodChange(e.target.value)}
            options={PERIOD_OPTIONS} />
        </div>
        {f("title", "比賽標題")}
        <div className="grid grid-cols-2 gap-3">
          {f("date", "開始日期", "date")}
          {f("endDate", "結束日期（選填）", "date")}
        </div>
        {f("targetName", "靶紙名稱")}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-semibold">靶紙圖片（選填）</label>
          <button onClick={() => fileRef.current.click()}
            className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-500 text-sm text-left hover:border-blue-400">
            {targetImg ? "✅ 已上傳" : "點擊選擇圖片"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          {targetImg && <img src={targetImg} alt="靶紙" className="rounded-xl h-28 object-contain bg-gray-100" />}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Inp label="箭數/回" type="number" min="1" value={form.arrowCount}
            onChange={e => setForm(p => ({ ...p, arrowCount: Number(e.target.value) }))} />
          <Inp label="回合數" type="number" min="1" value={form.roundCount}
            onChange={e => setForm(p => ({ ...p, roundCount: Number(e.target.value) }))} />
          <Inp label="最高環數" type="number" min="1" value={form.maxScore}
            onChange={e => setForm(p => ({ ...p, maxScore: Number(e.target.value) }))} />
        </div>
        <label className="flex items-center gap-2 text-gray-700 text-sm cursor-pointer">
          <input type="checkbox" checked={form.hasMiss}
            onChange={e => setForm(p => ({ ...p, hasMiss: e.target.checked }))}
            className="accent-blue-600" />
          啟用 M（脫靶）計分
        </label>
        {form.type === "臨時任務賽" && (
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-green-700 text-xs font-bold mb-2">獎勵類型（可複選）</div>
            <div className="flex gap-4">
              {[["肥貓章", "fatCat"], ["積分章", "score"], ["成就章", "achievement"]].map(([lbl, k]) => (
                <label key={k} className="flex items-center gap-1.5 text-gray-700 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.rewards[k]}
                    onChange={e => setForm(p => ({ ...p, rewards: { ...p.rewards, [k]: e.target.checked } }))}
                    className="accent-blue-600" />{lbl}
                </label>
              ))}
            </div>
          </div>
        )}
        <TA label="比賽公告（選填）" value={form.announcement} rows={3}
          placeholder="輸入注意事項、規則說明等…"
          onChange={e => setForm(p => ({ ...p, announcement: e.target.value }))} />
        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={save} disabled={saving}>
            {saving ? "建立中…" : "建立比賽"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ── 比賽詳情 + 成績管理（含檢定審核）──────────────────────────
function CompDetailModal({ comp, onClose, operatorId, toast, onDone }) {
  const [tab, setTab] = useState("results");
  const [results, setResults] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editScore, setEditScore] = useState(null);
  const [announcement, setAnnouncement] = useState(comp.announcement || "");
  const [savingAnn, setSavingAnn] = useState(false);
  const isCert = comp.type === "年度檢定";
  // 建立後才調整的檢定規則。舊資料可能缺欄位，一律給預設值，不讓表單出現 undefined。
  const [ruleForm, setRuleForm] = useState(() => ({
    distance:   comp.distance   ?? 18,
    arrowCount: comp.arrowCount ?? 6,
    roundCount: comp.roundCount ?? 5,
    maxScore:   comp.maxScore   ?? 10,
    hasMiss:    comp.hasMiss !== false,
    scores:     comp.certScores || defaultCertScores(),
  }));
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    const unsub = subscribeCompResults(comp.id, (r) => { setResults(r); setLoading(false); });
    getRegistrations(comp.id).then(setRegs);
    return unsub;
  }, [comp.id]);

  const sorted = [...results].sort((a, b) => (b.total||0) - (a.total||0));
  const pendingCount = results.filter(r => r.reviewStatus === "pending").length;

  async function saveScore(resultId, newTotal) {
    await submitResult(comp.id, editScore.memberId, { ...editScore, total: Number(newTotal) });
    setEditScore(null);
    toast("成績已更新 ✓");
  }

  // 建立後修改檢定規則。年份與週期**不開放改**：那兩個決定成績會寫進哪一期的
  // certRecords，改掉等於換一場比賽，已審核的成績會錯位。
  // 已審核的成績一律不重新計算級別（作者定案），只影響之後審核的成績。
  async function saveRules() {
    setSavingRules(true);
    const patch = {
      distance:   ruleForm.distance,
      arrowCount: ruleForm.arrowCount,
      roundCount: ruleForm.roundCount,
      maxScore:   ruleForm.maxScore,
      hasMiss:    ruleForm.hasMiss,
      certScores: ruleForm.scores,
      targetName: `${ruleForm.distance}米靶`,
    };
    // 標題含距離，改距離要一起重組，否則「18米」的標題會配上 30 米的規則。
    // 舊資料若缺 year/half 就別亂組，保留原標題。
    if (comp.year) patch.title = certCompTitle({ year: comp.year, half: comp.half, distance: ruleForm.distance });
    await updateCompetition(comp.id, patch, operatorId);
    toast("檢定規則已更新 ✓");
    setSavingRules(false);
    onDone();
  }

  async function saveAnnouncement() {
    setSavingAnn(true);
    await updateCompetition(comp.id, { announcement }, operatorId);
    toast("公告已更新 ✓");
    setSavingAnn(false);
    onDone();
  }

  return (
    <Modal open wide onClose={onClose} title={comp.title}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {[["results", isCert ? `🏅 成績/審核${pendingCount?`（${pendingCount}）`:""}` : "🏅 成績"], ["regs", "📋 報名"], ["announce", "📢 公告"], ...(isCert ? [["rules", "⚙️ 規則"]] : [])].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${tab === id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
              {lbl}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : <>
          {tab === "results" && (
            <div className="flex flex-col gap-2">
              {sorted.length === 0 && <Empty message="尚無成績" />}
              {isCert
                ? sorted.map((r, i) => (
                    <CertReviewRow key={r.id} r={r} rank={i} comp={comp}
                      operatorId={operatorId} toast={toast} />
                  ))
                : sorted.map((r, i) => (
                    <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                      <span className="text-lg w-7 text-center">{["🥇", "🥈", "🥉"][i] || i + 1}</span>
                      <div className="flex-1">
                        <div className="text-gray-800 text-sm font-bold">
                          {r.nickname || r.name || (r.memberId ? r.memberId.slice(0, 8) : "匿名")}
                        </div>
                        <div className="text-gray-400 text-xs">{fmtDT(r.submittedAt)}</div>
                      </div>
                      {editScore?.id === r.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" defaultValue={r.total} id="scoreInput"
                            className="w-20 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-center font-black text-sm" />
                          <Btn v="success" size="sm" onClick={() => saveScore(r.id, document.getElementById("scoreInput").value)}>✓</Btn>
                          <Btn v="secondary" size="sm" onClick={() => setEditScore(null)}>✗</Btn>
                        </div>
                      ) : (
                        <>
                          <span className="font-black text-xl text-blue-600">{r.total}</span>
                          <button onClick={() => setEditScore(r)} className="text-gray-400 hover:text-blue-500 text-xs">編輯</button>
                        </>
                      )}
                    </div>
                  ))
              }
            </div>
          )}

          {tab === "regs" && (
            <div className="flex flex-col gap-2">
              <p className="text-gray-500 text-xs">已報名 {regs.length} 人</p>
              {regs.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <div>
                    <div className="text-gray-800 text-sm font-bold">
                      {r.name ? `${r.name} ${r.nickname ? `(${r.nickname})` : ""}` : (r.guestInfo?.name || "未知")}
                    </div>
                    <div className="text-gray-400 text-xs">{fmtDT(r.registeredAt)}</div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    {r.isGuest ? "訪客" : "會員"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === "announce" && (
            <div className="flex flex-col gap-3">
              <TA label="比賽公告" value={announcement} rows={6}
                placeholder="輸入比賽結果、注意事項、恭喜詞等…"
                onChange={e => setAnnouncement(e.target.value)} />
              <Btn v="primary" className="w-full" onClick={saveAnnouncement} disabled={savingAnn}>
                {savingAnn ? "儲存中…" : "發布公告"}
              </Btn>
            </div>
          )}
        </>}
      </div>
    </Modal>
  );
}

// ── 檢定成績審核列 ───────────────────────────────────────────
function CertReviewRow({ r, rank, comp, operatorId, toast }) {
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(r.total);
  const [busy, setBusy] = useState(false);

  const status = r.reviewStatus || "pending";
  const level = getCertLevelByScores(r.certBowType, Number(score), comp.certScores) || "未達標";

  async function approve() {
    setBusy(true);
    const finalLevel = getCertLevelByScores(r.certBowType, Number(score), comp.certScores) || "未達標";
    await approveCertResult(r.id, operatorId, Number(score), finalLevel);
    toast("已通過，檢定級別已認可 ✓");
    setBusy(false); setEditing(false);
  }
  async function reject() {
    setBusy(true);
    await rejectCertResult(r.id, operatorId);
    toast("已退回，射手可重新挑戰");
    setBusy(false);
  }

  return (
    <div className={`rounded-xl p-3 border ${status==="pending"?"bg-amber-50 border-amber-200":status==="approved"?"bg-green-50 border-green-200":"bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center gap-3">
        <span className="text-lg w-7 text-center">{["🥇","🥈","🥉"][rank]||rank+1}</span>
        <div className="flex-1 min-w-0">
          <div className="text-gray-800 text-sm font-bold">
            {r.nickname || r.name}
            {r.isRental && <span className="text-orange-500 text-xs ml-1">租借</span>}
          </div>
          <div className="text-gray-400 text-xs">{r.bowLabel || "—"}　{fmtDT(r.submittedAt)}</div>
        </div>
        {editing ? (
          <input type="number" value={score} onChange={e=>setScore(e.target.value)}
            className="w-20 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-center font-black text-sm" />
        ) : (
          <span className="font-black text-xl text-blue-600">{r.total}</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 pl-10">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${level!=="未達標"?certLevelStyle(level,"solid"):"bg-gray-200 text-gray-500"}`}>
          {level==="未達標"?"未達標":`${level} 級`}
        </span>
        <span className={`text-xs font-bold ${status==="pending"?"text-amber-600":status==="approved"?"text-green-600":"text-gray-400"}`}>
          {status==="pending"?"⏳ 待審核":status==="approved"?"✅ 已通過":"已退回"}
        </span>
      </div>

      <div className="flex gap-2 mt-2 pl-10">
        {editing ? (
          <>
            <Btn v="secondary" size="sm" onClick={()=>{setEditing(false);setScore(r.total);}}>取消改分</Btn>
            <Btn v="success" size="sm" className="flex-1" onClick={approve} disabled={busy}>{busy?"處理中…":"確認此分數並通過"}</Btn>
          </>
        ) : (
          <>
            <Btn v="secondary" size="sm" onClick={()=>setEditing(true)}>✏️ 改分數</Btn>
            {status!=="approved" && <Btn v="success" size="sm" onClick={approve} disabled={busy}>{busy?"…":"✅ 通過"}</Btn>}
            <Btn v="danger" size="sm" onClick={reject} disabled={busy}>↩️ 退回重打</Btn>
          </>
        )}
      </div>
    </div>
  );
}

// ── 年度檢定賽建立 Modal ─────────────────────────────────────
export function AddCertModal({ onClose, onDone, operatorId, toast }) {
  const currentYear = thisYear();
  const [form, setForm] = useState({
    year: currentYear, half: "first", distance: 18,
    arrowCount: 6, roundCount: 5, maxScore: 10, hasMiss: true,
    scores: defaultCertScores(),
  });
  const [saving, setSaving] = useState(false);
  // 標題一律用 certCompTitle() 組，跟「建立後改規則」共用同一條規則，
  // 否則改了距離會出現「18米」的標題配 30 米的規則。
  const title = certCompTitle({ year: form.year, half: form.half, distance: form.distance });

  async function save() {
    setSaving(true);
    await createCompetition({
      type: "年度檢定", title,
      date: form.half === "first" ? `${form.year}-01-01` : `${form.year}-07-01`,
      endDate: form.half === "first" ? `${form.year}-06-30` : `${form.year}-12-31`,
      year: form.year, half: form.half, distance: form.distance,
      arrowCount: form.arrowCount, roundCount: form.roundCount,
      maxScore: form.maxScore, hasMiss: form.hasMiss,
      certScores: form.scores, status: "open",
      targetName: `${form.distance}米靶`,
    }, operatorId);
    toast(`${title} 已建立 ✓`);
    onDone(); onClose();
    setSaving(false);
  }

  return (
    <Modal open wide onClose={onClose} title="新增年度檢定賽">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Inp label="年份" type="number" min="2020" max="2099" value={form.year}
            onChange={e => setForm(p => ({ ...p, year: Number(e.target.value) }))} />
          <Sel label="週期" value={form.half}
            onChange={e => setForm(p => ({ ...p, half: e.target.value }))} options={CERT_HALF} />
        </div>

        {/* 規則欄位與「建立後改規則」共用 CertRuleFields，兩邊不會長歪 */}
        <CertRuleFields value={form} onChange={patch => setForm(p => ({ ...p, ...patch }))} />

        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <div className="text-teal-600 text-xs font-bold mb-0.5">比賽標題預覽</div>
          <div className="text-teal-800 font-bold text-sm">{title}</div>
        </div>

        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={save} disabled={saving}>
            {saving ? "建立中…" : "建立檢定賽"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
