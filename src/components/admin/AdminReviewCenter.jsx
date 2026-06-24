// src/components/admin/AdminReviewCenter.jsx
// 審核中心：檢定待審 + 外賽待審 + 待回留言，三區攤開直接處理
import { useState, useEffect } from "react";
import {
  approveCertResult, rejectCertResult,
  getCompetitions, replyMessage, reviewExternalComp,
  reviewCertTask, getMembers,
} from "../../lib/db";
import AdminCertConfig from "./AdminCertConfig";
import AdminNotify from "./AdminNotify";
import AdminDailyQuest from "./AdminDailyQuest";
import { useAuth } from "../../hooks/useAuth";
import { fmtDT, getCertLevelByScores, certLevelStyle } from "../../lib/constants";
import { Card, Btn, Sel, Inp, TA, Modal, ST, Spinner, Empty, useToast } from "../shared/UI";

export default function AdminReviewCenter({ pendingCert, messages, pendingExtItems, certTasks }) {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();

  const [comps, setComps]             = useState([]);
  const [members, setMembers]         = useState([]);
  const [showConfig, setShowConfig]   = useState(false);
  const [showNotify, setShowNotify]   = useState(false);
  const [showQuest, setShowQuest]     = useState(false);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      getCompetitions().then(setComps),
      getMembers().then(setMembers),
    ]).then(() => setLoading(false));
  }, []);

  const compMap = Object.fromEntries(comps.map(c => [c.id, c]));
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));
  const pendingExt = pendingExtItems ?? [];
  const unrepliedMsgs = (messages ?? []).filter(m => !m.reply);

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-5">
      <ToastContainer />
      <div className="flex items-center justify-between">
        <h2 className="text-gray-800 font-black text-xl">🔔 審核中心</h2>
        <div className="flex gap-2">
          <button onClick={() => { setShowNotify(v => !v); setShowConfig(false); }}
            className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 bg-white">
            {showNotify ? "✕ 關閉" : "📣 發送通知"}
          </button>
          <button onClick={() => { setShowConfig(v => !v); setShowNotify(false); setShowQuest(false); }}
            className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 bg-white">
            {showConfig ? "✕ 關閉" : "⚙️ 考證門檻"}
          </button>
          <button onClick={() => { setShowQuest(v => !v); setShowConfig(false); setShowNotify(false); }}
            className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 bg-white">
            {showQuest ? "✕ 關閉" : "📍 任務設定"}
          </button>
        </div>
      </div>
      {showConfig && (
        <div className="border border-indigo-200 rounded-2xl overflow-hidden">
          <AdminCertConfig />
        </div>
      )}
      {showNotify && (
        <div className="border border-pink-200 rounded-2xl overflow-hidden">
          <AdminNotify />
        </div>
      )}
      {showQuest && (
        <div className="border border-indigo-200 rounded-2xl overflow-hidden p-4">
          <AdminDailyQuest mode="config" />
        </div>
      )}

      {/* 總覽 */}
      <div className="grid grid-cols-4 gap-2">
        {[["檢定待審", pendingCert.length, "text-teal-600"],
          ["畢業考", certTasks.length, "text-indigo-600"],
          ["外賽待審", pendingExt.length, "text-purple-600"],
          ["待回留言", unrepliedMsgs.length, "text-orange-600"]].map(([k,v,c])=>(
          <div key={k} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <div className="text-gray-400 text-xs">{k}</div>
            <div className={`font-black text-2xl ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* 檢定待審 */}
      <section>
        <ST>🎯 檢定待審核（{pendingCert.length}）</ST>
        {pendingCert.length === 0 ? <Empty message="沒有待審核的檢定" /> : (
          <div className="flex flex-col gap-2">
            {pendingCert.map(r => (
              <CertReviewCard key={r.id} r={r} comp={compMap[r.compId]}
                operatorId={profile.id} toast={toast} />
            ))}
          </div>
        )}
      </section>

      {/* 每日任務審核（報到核准 + 達標確認，直接顯示）*/}
      <AdminDailyQuest mode="list" />

      {/* 射手證畢業考待審 */}
      <section>
        <ST>🎖️ 射手證畢業考待審核（{certTasks.length}）</ST>
        {certTasks.length === 0 ? <Empty message="沒有待審核的畢業考" /> : (
          <div className="flex flex-col gap-2">
            {certTasks.map(t => (
              <CertTaskCard key={t.memberId + t.tier + t.task} t={t} member={memberMap[t.memberId]} operatorId={profile.id} toast={toast} />
            ))}
          </div>
        )}
      </section>

      {/* 外賽待審 */}
      <section>
        <ST>🏅 對外比賽待審核（{pendingExt.length}）</ST>
        {pendingExt.length === 0 ? <Empty message="沒有待審核的外賽" /> : (
          <div className="flex flex-col gap-2">
            {pendingExt.map(r => (
              <ExtReviewCard key={r.id} r={r} operatorId={profile.id} toast={toast} />
            ))}
          </div>
        )}
      </section>

      {/* 待回留言 */}
      <section>
        <ST>✉️ 待回覆留言（{unrepliedMsgs.length}）</ST>
        {unrepliedMsgs.length === 0 ? <Empty message="沒有待回覆的留言" /> : (
          <div className="flex flex-col gap-2">
            {unrepliedMsgs
              .slice().sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
              .map(m => <MsgReplyCard key={m.id} m={m} operatorId={profile.id} toast={toast} />)}
          </div>
        )}
      </section>
    </div>
  );
}

// ── 檢定待審卡（可改分、通過、退回）──
function CertReviewCard({ r, comp, operatorId, toast }) {
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(r.total);
  const [busy, setBusy] = useState(false);

  const certScores = comp?.certScores;
  const level = getCertLevelByScores(r.certBowType, Number(score), certScores) || "未達標";

  async function approve() {
    setBusy(true);
    const finalLevel = getCertLevelByScores(r.certBowType, Number(score), certScores) || "未達標";
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
    <div className="rounded-xl p-3 border bg-amber-50 border-amber-200">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-gray-800 text-sm font-bold">
            {r.nickname || r.name}
            {r.isRental && <span className="text-orange-500 text-xs ml-1">租借</span>}
          </div>
          <div className="text-gray-400 text-xs">
            {r.compTitle || comp?.title || "—"}　{r.bowLabel || ""}　{fmtDT(r.submittedAt)}
          </div>
        </div>
        {editing ? (
          <input type="number" value={score} onChange={e=>setScore(e.target.value)}
            className="w-20 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-center font-black text-sm" />
        ) : (
          <span className="font-black text-xl text-blue-600">{r.total}</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${level!=="未達標"?certLevelStyle(level,"solid"):"bg-gray-200 text-gray-500"}`}>
          {level==="未達標"?"未達標":`${level} 級`}
        </span>
      </div>
      <div className="flex gap-2 mt-2">
        {editing ? (
          <>
            <Btn v="secondary" size="sm" onClick={()=>{setEditing(false);setScore(r.total);}}>取消改分</Btn>
            <Btn v="success" size="sm" className="flex-1" onClick={approve} disabled={busy}>{busy?"處理中…":"確認此分數並通過"}</Btn>
          </>
        ) : (
          <>
            <Btn v="secondary" size="sm" onClick={()=>setEditing(true)}>✏️ 改分數</Btn>
            <Btn v="success" size="sm" onClick={approve} disabled={busy}>{busy?"…":"✅ 通過"}</Btn>
            <Btn v="danger" size="sm" onClick={reject} disabled={busy}>↩️ 退回重打</Btn>
          </>
        )}
      </div>
    </div>
  );
}

// ── 外賽待審卡 ──
function ExtReviewCard({ r, operatorId, toast }) {
  const [decision, setDecision]   = useState("approved");
  const [badgeType, setBadgeType] = useState("fatCat");
  const [badgeColor, setBadgeColor] = useState("bronze");
  const [badgeCount, setBadgeCount] = useState(1);
  const [saving, setSaving]       = useState(false);

  async function submit() {
    setSaving(true);
    await reviewExternalComp(
      r.id, decision === "approved",
      decision === "approved" ? badgeType : null,
      decision === "approved" ? badgeColor : null,
      decision === "approved" ? Number(badgeCount) : 0,
      operatorId
    );
    toast(decision === "approved" ? "已通過並發放徽章 ✓" : "已標記為未通過");
    setSaving(false);
  }

  return (
    <div className="rounded-xl p-3 border bg-purple-50 border-purple-200 flex flex-col gap-3">
      {/* 比賽資訊 */}
      <div>
        <div className="text-gray-800 font-bold text-sm">
          {r.memberName}{r.memberNickname && <span className="text-gray-400 text-xs ml-1">（{r.memberNickname}）</span>}
        </div>
        <div className="text-gray-700 text-sm">{r.compName}</div>
        <div className="text-gray-400 text-xs mt-0.5">
          📅 {r.date}{r.location && `　📍 ${r.location}`}
        </div>
        <div className="flex gap-1.5 flex-wrap mt-1">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.category}</span>
          <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{r.rank}</span>
          {r.hasAward && <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full">🏆 {r.awardKept?"獎項留箭場":"有獎項"}</span>}
        </div>
        {r.note && <div className="text-gray-500 text-xs italic mt-1">「{r.note}」</div>}
      </div>

      {/* 審核決定 */}
      <div className="bg-white rounded-lg p-3 border border-gray-200 flex flex-col gap-3">
        <div className="text-xs font-black text-gray-500">審核結果</div>
        <div className="flex gap-2">
          {[["approved","✅ 通過"],["rejected","❌ 不通過"]].map(([v,l])=>(
            <button key={v} onClick={()=>setDecision(v)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all
                ${decision===v?(v==="approved"?"bg-green-600 text-white border-green-600":"bg-red-500 text-white border-red-500"):"bg-white text-gray-600 border-gray-200"}`}>
              {l}
            </button>
          ))}
        </div>

        {/* 獎勵設定（通過時才顯示） */}
        {decision === "approved" && (
          <>
            <div className="text-xs font-black text-gray-500">獎勵設定</div>
            <div className="grid grid-cols-3 gap-2">
              <Sel label="章別" value={badgeType} onChange={e=>{ setBadgeType(e.target.value); setBadgeColor(e.target.value==="achievement"?"silver":"bronze"); }}
                options={[{value:"fatCat",label:"🐱 肥貓章"},{value:"score",label:"⭐ 積分章"},{value:"achievement",label:"🏆 成就章"}]} />
              <Sel label="等級" value={badgeColor} onChange={e=>setBadgeColor(e.target.value)}
                options={badgeType==="achievement"
                  ?[{value:"silver",label:"銀章"},{value:"gold",label:"金章"},{value:"black",label:"黑章"}]
                  :[{value:"bronze",label:"銅章"},{value:"silver",label:"銀章"},{value:"gold",label:"金章"}]} />
              <Inp label="數量" type="number" min="1" value={badgeCount} onChange={e=>setBadgeCount(e.target.value)} />
            </div>
          </>
        )}

        <Btn v={decision==="approved"?"success":"danger"} size="sm" onClick={submit} disabled={saving}>
          {saving ? "處理中…" : decision==="approved" ? "✅ 確認通過並發放徽章" : "❌ 確認不通過"}
        </Btn>
      </div>
    </div>
  );
}

// ── 留言回覆卡 ──
function MsgReplyCard({ m, operatorId, toast }) {
  const [txt, setTxt] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function send() {
    if (!txt.trim()) return;
    setSaving(true);
    await replyMessage(m.id, txt, operatorId);
    toast("已回覆 ✓");
    setSaving(false); setOpen(false);
  }

  return (
    <div className="rounded-xl p-3 border bg-orange-50 border-orange-200">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-800 font-bold text-sm">{m.memberName || "射手"}</span>
        {m.memberNickname && <span className="text-gray-400 text-xs">（{m.memberNickname}）</span>}
      </div>
      <div className="text-gray-700 text-sm mb-1">{m.content}</div>
      <div className="text-gray-400 text-xs mb-2">{fmtDT(m.createdAt)}</div>
      {!open ? (
        <Btn v="primary" size="sm" onClick={()=>setOpen(true)}>回覆</Btn>
      ) : (
        <div className="flex flex-col gap-2">
          <TA value={txt} onChange={e=>setTxt(e.target.value)} rows={3} placeholder="輸入回覆…" />
          <div className="flex gap-2">
            <Btn v="secondary" size="sm" className="flex-1" onClick={()=>setOpen(false)}>取消</Btn>
            <Btn v="primary" size="sm" className="flex-1" onClick={send} disabled={saving||!txt.trim()}>
              {saving?"送出中…":"送出回覆"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 射手證畢業考任務審核卡 ──
function CertTaskCard({ t, member, operatorId, toast }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const isTask1 = t.task === "task1";
  const [val, setVal] = useState(isTask1 ? t.hits : t.score);

  const BOW_LABEL = {
    rental: "租借器材", traditional: "傳統弓",
    recurve_bare: "裸弓", recurve_full: "全配", compound: "美式獵弓",
  };
  const tierLabel = t.tier === "gold" ? "金證（高階）" : "藍證（初階）";
  const taskLabel = isTask1 ? "任務1 · 中靶數" : "任務2 · 分數";
  const unit = isTask1 ? "箭中靶" : "分";

  async function decide(approve) {
    setBusy(true);
    try {
      // 有改分就帶 override
      let override = null;
      if (editing && val !== "" && !Number.isNaN(Number(val))) {
        override = isTask1 ? { hits: Number(val) } : { score: Number(val) };
      }
      const res = await reviewCertTask(t.memberId, t.tier, t.task, approve, operatorId, override);
      if (res.granted) toast(`已通過，該射手取得${t.tier === "gold" ? "金證 🏆" : "藍證 🎖️"}`);
      else toast(approve ? "此任務已通過 ✓" : "已退回，射手可重考");
      setEditing(false);
    } catch (e) {
      toast("處理失敗：" + (e?.message || ""), "error");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl p-3 border bg-indigo-50 border-indigo-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-gray-800 text-sm font-bold">
            {member?.name || "未知射手"}{member?.nickname ? `（${member.nickname}）` : ""}
          </div>
          <div className="text-gray-500 text-xs mt-0.5">
            {tierLabel}　{BOW_LABEL[t.bowType] || t.bowType}
          </div>
          <div className="text-indigo-700 text-xs font-bold mt-0.5 flex items-center gap-2">
            {taskLabel}：
            {editing ? (
              <input type="number" value={val} onChange={e => setVal(e.target.value)}
                className="w-20 bg-white border border-gray-300 rounded-lg px-2 py-1 text-center font-black text-sm" />
            ) : (
              <span>{isTask1 ? t.hits : t.score} {unit}</span>
            )}
          </div>
        </div>
        <div className="text-gray-300 text-xs">{fmtDT(t.submittedAt)}</div>
      </div>
      <div className="flex gap-2 mt-2">
        {editing ? (
          <>
            <Btn v="secondary" size="sm" onClick={() => { setEditing(false); setVal(isTask1 ? t.hits : t.score); }}>取消改分</Btn>
            <Btn v="success" size="sm" className="flex-1" onClick={() => decide(true)} disabled={busy}>{busy ? "…" : "確認此分數並通過"}</Btn>
          </>
        ) : (
          <>
            <Btn v="secondary" size="sm" onClick={() => setEditing(true)}>✏️ 改分數</Btn>
            <Btn v="success" size="sm" onClick={() => decide(true)} disabled={busy}>{busy ? "…" : "✅ 通過"}</Btn>
            <Btn v="danger" size="sm" onClick={() => decide(false)} disabled={busy}>↩️ 退回</Btn>
          </>
        )}
      </div>
    </div>
  );
}