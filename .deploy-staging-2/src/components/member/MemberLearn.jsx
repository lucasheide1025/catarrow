// src/components/member/MemberLearn.jsx
import { useState, useEffect } from "react";
import { subscribeLearnLogs, addLearnLog, markLearnLogsRead, updateLearnLog } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { today, fmtDT } from "../../lib/constants";
import { Card, Btn, Inp, TA, ST, Spinner, Empty } from "../shared/UI";

export default function MemberLearn() {
  const { profile } = useAuth();
  const [logs,setLogs]=useState([]); const [loading,setLoading]=useState(true);
  const [adding,setAdding]=useState(false); const [form,setForm]=useState({date:today(),studentNote:""});
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    if(!profile?.id)return;
    markLearnLogsRead(profile.id);
    const unsub=subscribeLearnLogs(profile.id,data=>{setLogs(data.filter(l=>!l.deleted));setLoading(false);});
    return unsub;
  },[profile?.id]);
  async function addLog(){
    if(!form.studentNote.trim())return;
    setSaving(true);
    await addLearnLog(profile.id,{date:form.date,studentNote:form.studentNote,coachNote:""});
    setForm({date:today(),studentNote:""}); setAdding(false); setSaving(false);
  }
  if(loading)return<Spinner/>;
  return(
    <div className="p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-gray-100 font-black text-xl">📓 學習紀錄</h2>
        <Btn v="primary" size="sm" onClick={()=>setAdding(!adding)}>{adding?"取消":"+ 新增"}</Btn>
      </div>
      {adding&&<Card className="p-4 flex flex-col gap-3">
        <ST>新增學習紀錄</ST>
        <Inp label="日期" type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
        <TA label="今日練習紀錄" value={form.studentNote} rows={5} placeholder="今天練習了什麼？感受如何？有哪些需要改進的地方…" onChange={e=>setForm(p=>({...p,studentNote:e.target.value}))}/>
        <Btn v="primary" className="w-full" onClick={addLog} disabled={saving||!form.studentNote.trim()}>{saving?"儲存中…":"送出紀錄"}</Btn>
      </Card>}
      {logs.length===0&&!adding&&<Empty icon="📓" message="尚無學習紀錄"/>}
      {logs.map(log=><LogCard key={log.id} log={log} memberId={profile.id} />)}
    </div>
  );
}

function LogCard({ log, memberId }) {
  const [replying, setReplying] = useState(false);
  const [replyTxt, setReplyTxt] = useState(log.studentReply || "");
  const [saving, setSaving] = useState(false);

  async function submitReply() {
    if (!replyTxt.trim()) return;
    setSaving(true);
    await updateLearnLog(log.id, { studentReply: replyTxt }, memberId);
    setSaving(false);
    setReplying(false);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-bold text-gray-200 text-sm">📅 {log.date}</span>
        {log.coachAdded && <span className="text-xs bg-orange-500/15 text-orange-300 font-bold px-2 py-0.5 rounded-full">教練新增</span>}
        {!log.coachNote && <span className="text-xs bg-yellow-500/15 text-yellow-300 font-bold px-2 py-0.5 rounded-full">等待回饋</span>}
      </div>
      {log.studentNote && <div className="mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 text-xs font-bold">我</div>
          <span className="text-xs font-bold text-gray-400">我的紀錄</span>
          <span className="text-gray-500 text-xs">{fmtDT(log.createdAt)}</span>
        </div>
        <div className="bg-blue-500/10 rounded-xl p-3 text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">{log.studentNote}</div>
      </div>}
      {log.coachNote ? <>
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">教</div>
            <span className="text-xs font-bold text-gray-400">教練回饋</span>
            {log.coachRepliedAt && <span className="text-gray-500 text-xs">{fmtDT(log.coachRepliedAt)}</span>}
          </div>
          <div className="bg-orange-500/10 rounded-xl p-3 text-gray-200 text-sm whitespace-pre-wrap leading-relaxed border border-orange-400/20">{log.coachNote}</div>
        </div>
        {log.studentReply && !replying ? (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 text-xs font-bold">我</div>
              <span className="text-xs font-bold text-gray-400">我的回覆</span>
            </div>
            <div className="bg-blue-500/10 rounded-xl p-3 text-gray-200 text-sm whitespace-pre-wrap leading-relaxed mb-2">{log.studentReply}</div>
            <button onClick={() => { setReplyTxt(log.studentReply); setReplying(true); }}
              className="text-xs text-gray-400 underline">修改回覆</button>
          </div>
        ) : replying ? (
          <div className="flex flex-col gap-2">
            <TA value={replyTxt} onChange={e => setReplyTxt(e.target.value)} rows={3} placeholder="輸入你的回覆…" />
            <div className="flex gap-2">
              <Btn v="secondary" size="sm" className="flex-1" onClick={() => setReplying(false)}>取消</Btn>
              <Btn v="primary" size="sm" className="flex-1" onClick={submitReply} disabled={saving || !replyTxt.trim()}>
                {saving ? "儲存中…" : "送出回覆"}
              </Btn>
            </div>
          </div>
        ) : (
          <button onClick={() => setReplying(true)}
            className="w-full text-sm text-blue-300 font-bold border border-blue-400/30 rounded-xl py-2 bg-blue-500/10 active:scale-98 transition-transform">
            ＋ 回覆教練
          </button>
        )}
      </> : <div className="text-gray-500 text-xs text-center py-2 border border-dashed border-white/15 rounded-lg">等待教練回饋…</div>}
    </Card>
  );
}
