// src/components/member/MemberAchievements.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { fmtDT } from "../../lib/constants";
import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Card, Btn, TA, ST, Spinner, Empty, Modal, useToast } from "../shared/UI";

export default function MemberAchievements() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [tasks, setTasks]           = useState([]);
  const [myApps, setMyApps]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [applyModal, setApplyModal] = useState(null);

  useEffect(() => {
    const q1 = query(collection(db,"achievements"), where("status","==","active"), orderBy("createdAt","desc"));
    const unsub1 = onSnapshot(q1, snap => {
      setTasks(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    const q2 = query(collection(db,"achievementApplications"), where("memberId","==",profile.id), orderBy("submittedAt","desc"));
    const unsub2 = onSnapshot(q2, snap => {
      setMyApps(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    return () => { unsub1(); unsub2(); };
  }, [profile.id]);

  function getMyApp(taskId, color) {
    return myApps.find(a => a.taskId === taskId && a.targetColor === color);
  }

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <div className="text-amber-700 text-xs font-bold mb-1">📋 任務說明</div>
        <div className="text-amber-600 text-xs leading-relaxed">
          完成任務條件後，點「申請領章」送出申請，等教練審核通過後系統會自動發放成就章。若未通過，可修正後重新申請。
        </div>
      </div>

      {tasks.length === 0 && <Empty icon="🏆" message="目前沒有進行中的任務" />}

      {tasks.map(task => (
        <Card key={task.id} className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-gray-800 font-bold text-sm">{task.title}</div>
              {task.expiresAt && <div className="text-red-400 text-xs mt-0.5">截止日期：{task.expiresAt}</div>}
            </div>
            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">進行中</span>
          </div>

          <div className="flex flex-col gap-2">
            {[["silver","🥈 銀章","silverTask"],["gold","🥇 金章","goldTask"],["black","⬛ 黑章","blackTask"]].map(([color,label,key])=>{
              if (!task[key]) return null;
              const myApp = getMyApp(task.id, color);
              const bgMap = { silver:"bg-gray-50 border-gray-200", gold:"bg-yellow-50 border-yellow-200", black:"bg-gray-800" };
              const textMap = { silver:"text-gray-700", gold:"text-gray-700", black:"text-gray-200" };
              const subTextMap = { silver:"text-gray-400", gold:"text-gray-400", black:"text-gray-400" };
              const rejected = myApp?.status === "rejected";
              return (
                <div key={color} className={`rounded-xl p-3 border ${bgMap[color]}`}>
                  <div className={`font-bold text-xs mb-1 ${textMap[color]}`}>{label}</div>
                  <div className={`text-sm mb-1 ${textMap[color]}`}>{task[key]}</div>
                  {(task[`${key}Arrows`]||task[`${key}Distance`]||task[`${key}Target`]) && (
                    <div className={`text-xs mb-2 ${subTextMap[color]}`}>
                      {task[`${key}Arrows`]&&`${task[`${key}Arrows`]}支箭`}
                      {task[`${key}Distance`]&&`　${task[`${key}Distance`]}米`}
                      {task[`${key}Target`]&&`　${task[`${key}Target`]}`}
                    </div>
                  )}

                  {!myApp && (
                    <Btn v="secondary" size="sm" onClick={() => setApplyModal({ task, color, label })}>
                      申請領章
                    </Btn>
                  )}
                  {myApp?.status === "pending" && (
                    <div className="text-xs font-bold px-2 py-1 rounded-lg inline-block bg-yellow-100 text-yellow-700">
                      ⏳ 申請審核中
                    </div>
                  )}
                  {myApp?.status === "approved" && (
                    <div className="text-xs font-bold px-2 py-1 rounded-lg inline-block bg-green-100 text-green-700">
                      ✅ 已通過
                    </div>
                  )}
                  {rejected && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2 py-1 rounded-lg inline-block bg-red-100 text-red-600">
                        ❌ 未通過
                      </span>
                      <Btn v="secondary" size="sm" onClick={() => setApplyModal({ task, color, label })}>
                        🔄 重新申請
                      </Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {myApps.length > 0 && (
        <div>
          <ST>我的申請紀錄</ST>
          {myApps.map(a => {
            const task = tasks.find(t => t.id === a.taskId);
            return (
              <div key={a.id} className={`rounded-xl p-3 border mb-2
                ${a.status==="pending"?"bg-yellow-50 border-yellow-200":
                  a.status==="approved"?"bg-green-50 border-green-200":
                  "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-gray-700 text-sm font-medium">{task?.title || a.taskTitle || "任務"}</div>
                    <div className="text-gray-400 text-xs">
                      {a.targetColor==="silver"?"🥈 銀章":a.targetColor==="gold"?"🥇 金章":"⬛ 黑章"}
                      　{fmtDT(a.submittedAt)}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                    ${a.status==="pending"?"bg-yellow-100 text-yellow-700":
                      a.status==="approved"?"bg-green-100 text-green-700":
                      "bg-gray-100 text-gray-500"}`}>
                    {a.status==="pending"?"審核中":a.status==="approved"?"已通過":"未通過"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {applyModal && (
        <ApplyModal
          task={applyModal.task}
          color={applyModal.color}
          label={applyModal.label}
          profile={profile}
          onClose={() => setApplyModal(null)}
          onDone={() => { toast("申請已送出，等待教練審核 ✓"); setApplyModal(null); }}
        />
      )}
    </div>
  );
}

function ApplyModal({ task, color, label, profile, onClose, onDone }) {
  const [note, setNote]     = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await addDoc(collection(db, "achievementApplications"), {
      taskId: task.id,
      taskTitle: task.title,
      memberId: profile.id,
      memberName: profile.name,
      memberNickname: profile.nickname || "",
      targetColor: color,
      note,
      status: "pending",
      submittedAt: serverTimestamp(),
    });
    onDone();
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={`申請 ${label} — ${task.title}`}>
      <div className="flex flex-col gap-4">
        <div className="bg-gray-50 rounded-xl p-3 text-gray-600 text-sm">
          {task[`${color}Task`]}
          {task[`${color}TaskArrows`] && (
            <div className="text-gray-400 text-xs mt-1">
              {task[`${color}TaskArrows`]}支箭　{task[`${color}TaskDistance`]}米　{task[`${color}TaskTarget`]}
            </div>
          )}
        </div>
        <TA label="補充說明（選填）" value={note} rows={3}
          placeholder="說明你是如何完成這個任務的…"
          onChange={e => setNote(e.target.value)} />
        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={submit} disabled={saving}>
            {saving ? "送出中…" : "送出申請"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}