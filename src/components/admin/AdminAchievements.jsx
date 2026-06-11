// src/components/admin/AdminAchievements.jsx
import { useState, useEffect } from "react";
import { getAchievements, createAchievement } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { today, fmtDT } from "../../lib/constants";
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Card, Btn, Inp, TA, Sel, Modal, ST, Spinner, Empty, useToast } from "../shared/UI";

const BADGE_COLORS = [
  { value:"silver", label:"銀章" },
  { value:"gold",   label:"金章" },
  { value:"black",  label:"黑章" },
];

const STATUS_OPTIONS = [
  { value:"active",   label:"進行中" },
  { value:"closed",   label:"已結束" },
];

export default function AdminAchievements() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [filter, setFilter]   = useState("active");

  useEffect(() => {
    const q = query(collection(db, "achievements"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = filter === "全部" ? tasks : tasks.filter(t => t.status === filter);

  async function updateStatus(id, status) {
    await updateDoc(doc(db, "achievements", id), { status, updatedAt: serverTimestamp() });
    toast("狀態已更新 ✓");
  }

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <div className="flex justify-between items-center">
        <h2 className="text-gray-800 font-black text-xl">🏆 成就章任務</h2>
        <Btn v="primary" size="sm" onClick={() => setAddModal(true)}>+ 發布任務</Btn>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <div className="text-amber-700 text-xs font-bold mb-1">📋 成就章說明</div>
        <div className="text-amber-600 text-xs leading-relaxed">
          每個任務包含三個目標，分別對應銀章、金章、黑章。射手完成任務後可申請，由教練審核後發章。
        </div>
      </div>

      {/* 篩選 */}
      <div className="flex gap-2">
        {[["active","進行中"],["closed","已結束"],["全部","全部"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
              ${filter===v?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200"}`}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <Empty message="尚無任務" />}

      {filtered.map(t => (
        <Card key={t.id} className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="text-gray-800 font-bold text-sm">{t.title}</div>
              <div className="text-gray-400 text-xs mt-0.5">
                發布：{fmtDT(t.createdAt)}
                {t.expiresAt && ` 截止：${t.expiresAt}`}
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${t.status==="active"?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>
              {t.status==="active"?"進行中":"已結束"}
            </span>
          </div>

          {/* 三個任務目標 */}
          <div className="flex flex-col gap-2 mb-3">
            {[["silver","🥈 銀章","silverTask"],["gold","🥇 金章","goldTask"],["black","⬛ 黑章","blackTask"]].map(([color,label,key])=>(
              t[key] && (
                <div key={color} className={`rounded-lg p-2.5 text-xs ${color==="silver"?"bg-gray-50 border border-gray-200":color==="gold"?"bg-yellow-50 border border-yellow-200":"bg-gray-800 text-white"}`}>
                  <span className="font-bold">{label}：</span>
                  <span className={color==="black"?"text-gray-200":"text-gray-700"}>{t[key]}</span>
                  {t[`${key}Arrows`] && <span className={`ml-1 ${color==="black"?"text-gray-400":"text-gray-400"}`}>（{t[`${key}Arrows`]}支箭 / {t[`${key}Distance`]}米 / {t[`${key}Target`]}）</span>}
                </div>
              )
            ))}
          </div>

          <div className="flex gap-2">
            <select value={t.status}
              onChange={e => updateStatus(t.id, e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 text-xs flex-1">
              {STATUS_OPTIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <Btn v="secondary" size="sm" onClick={() => setDetailModal(t)}>📋 申請審核</Btn>
          </div>
        </Card>
      ))}

      {addModal && (
        <AddTaskModal
          onClose={() => setAddModal(false)}
          operatorId={profile?.id}
          onDone={() => toast("任務已發布 ✓")}
        />
      )}
      {detailModal && (
        <ReviewApplicationsModal
          task={detailModal}
          operatorId={profile?.id}
          onClose={() => setDetailModal(null)}
          toast={toast}
        />
      )}
    </div>
  );
}

// ── 發布任務 Modal ────────────────────────────────────────────
function AddTaskModal({ onClose, operatorId, onDone }) {
  const [form, setForm] = useState({
    title: "", expiresAt: "",
    silverTask:"", silverTaskArrows:"", silverTaskDistance:"", silverTaskTarget:"",
    goldTask:"",   goldTaskArrows:"",   goldTaskDistance:"",   goldTaskTarget:"",
    blackTask:"",  blackTaskArrows:"",  blackTaskDistance:"",  blackTaskTarget:"",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.title || !form.silverTask || !form.goldTask || !form.blackTask) {
      alert("請填寫任務標題與三個目標描述"); return;
    }
    setSaving(true);
    await createAchievement({ ...form, status: "active" }, operatorId);
    onDone(); onClose();
    setSaving(false);
  }

  // 🔥 修正點：原本這裡的 TaskSection 被移到了組件最外部，避免重複打字被更新焦點消失

  return (
    <Modal open wide onClose={onClose} title="發布成就章任務">
      <div className="flex flex-col gap-4">
        <Inp label="任務標題 *" value={form.title}
          onChange={e=>setForm(p=>({...p,title:e.target.value}))}
          placeholder="例如：2026年春季成就挑戰" />
        <Inp label="截止日期（選填）" type="date" value={form.expiresAt}
          onChange={e=>setForm(p=>({...p,expiresAt:e.target.value}))} />

        <div className="text-gray-500 text-xs font-bold">三個達成目標（由易到難）</div>
        
        {/* 把 form 與 setForm 當作變數傳入外部的 TaskSection */}
        <TaskSection color="silver" label="🥈 銀章" prefix="silver" form={form} setForm={setForm} />
        <TaskSection color="gold"   label="🥇 金章" prefix="gold"   form={form} setForm={setForm} />
        <TaskSection color="black"  label="⬛ 黑章" prefix="black"  form={form} setForm={setForm} />

        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={save} disabled={saving}>
            {saving ? "發布中…" : "發布任務"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// 🔥 【核心修正】移到最外部的獨立子組件，這樣在打字時焦點（Focus）才不會被強制更新洗掉
function TaskSection({ color, label, prefix, form, setForm }) {
  const colors = {
    silver: "bg-gray-50 border-gray-200",
    gold:   "bg-yellow-50 border-yellow-200",
    black:  "bg-gray-800",
  };
  const textColor = color === "black" ? "text-white" : "text-gray-700";
  return (
    <div className={`rounded-xl p-4 border flex flex-col gap-3 ${colors[color]}`}>
      <div className={`text-sm font-bold ${textColor}`}>{label} 任務目標</div>
      <TA label={`任務描述 *`} value={form[`${prefix}Task`]} rows={2}
        placeholder="描述射手需要完成的任務內容…"
        onChange={e=>setForm(p=>({...p,[`${prefix}Task`]:e.target.value}))} />
      <div className="grid grid-cols-3 gap-2">
        <Inp label="箭數" type="number" min="1" value={form[`${prefix}TaskArrows`]}
          placeholder="例如：30"
          onChange={e=>setForm(p=>({...p,[`${prefix}TaskArrows`]:e.target.value}))} />
        <Inp label="距離（米）" type="number" min="1" value={form[`${prefix}TaskDistance`]}
          placeholder="例如：18"
          onChange={e=>setForm(p=>({...p,[`${prefix}TaskDistance`]:e.target.value}))} />
        <Inp label="靶紙" value={form[`${prefix}TaskTarget`]}
          placeholder="例如：40cm"
          onChange={e=>setForm(p=>({...p,[`${prefix}TaskTarget`]:e.target.value}))} />
      </div>
    </div>
  );
}

// ── 審核申請 Modal ────────────────────────────────────────────
function ReviewApplicationsModal({ task, operatorId, onClose, toast }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "achievementApplications"),
      where("taskId", "==", task.id)
    );
    const unsub = onSnapshot(q, snap => {
      const apps = snap.docs.map(d=>({id:d.id,...d.data()}));
      apps.sort((a,b) => (b.submittedAt?.seconds||0) - (a.submittedAt?.seconds||0));
      setApplications(apps);
      setLoading(false);
    });
    return unsub;
  }, [task.id]);

  async function approve(app) {
    const { addBadge } = await import("../../lib/db");
    await addBadge(app.memberId, "achievement", app.targetColor, 1, operatorId, `成就章任務：${task.title}`);
    await updateDoc(doc(db, "achievementApplications", app.id), {
      status: "approved", reviewedAt: serverTimestamp(), reviewedBy: operatorId
    });
    toast("已核准並發放成就章 ✓");
  }

  async function reject(appId) {
    await updateDoc(doc(db, "achievementApplications", appId), {
      status: "rejected", reviewedAt: serverTimestamp(), reviewedBy: operatorId
    });
    toast("已標記為未通過");
  }

  return (
    <Modal open wide onClose={onClose} title={`申請審核 — ${task.title}`}>
      <div className="flex flex-col gap-3">
        {loading && <Spinner />}
        {!loading && applications.length === 0 && <Empty message="尚無申請紀錄" />}
        {!loading && applications.map(a => (
          <div key={a.id} className={`rounded-xl p-3 border ${a.status==="pending"?"bg-yellow-50 border-yellow-200":a.status==="approved"?"bg-green-50 border-green-200":"bg-gray-50 border-gray-200"}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="font-bold text-gray-700 text-sm">{a.memberName} <span className="text-gray-400 font-normal">（{a.memberNickname}）</span></div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.status==="pending"?"bg-yellow-100 text-yellow-700":a.status==="approved"?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>
                {a.status==="pending"?"待審核":a.status==="approved"?"已通過":"未通過"}
              </span>
            </div>
            <div className="text-gray-500 text-xs mb-1">
              申請：{a.targetColor==="silver"?"🥈 銀章":a.targetColor==="gold"?"🥇 金章":"⬛ 黑章"}
               {fmtDT(a.submittedAt)}
            </div>
            {a.note && <div className="text-gray-500 text-xs italic mb-2">「{a.note}」</div>}
            {a.status === "pending" && (
              <div className="flex gap-2 mt-2">
                <Btn v="danger" size="sm" className="flex-1" onClick={() => reject(a.id)}>不通過</Btn>
                <Btn v="success" size="sm" className="flex-1" onClick={() => approve(a)}>核准發章</Btn>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}