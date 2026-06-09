// src/components/member/MemberMessages.jsx
import { useState, useEffect } from "react";
import { subscribeMessages, sendMessage, markMessagesRead } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { fmtDT } from "../../lib/constants";
import { Card, Btn, TA, ST, Spinner, Empty } from "../shared/UI";

export default function MemberMessages() {
  const { profile } = useAuth();
  const [msgs,setMsgs]=useState([]); const [loading,setLoading]=useState(true);
  const [txt,setTxt]=useState(""); const [sending,setSending]=useState(false);
  useEffect(()=>{
    if(!profile?.id)return;
    const unsub=subscribeMessages(profile.id,data=>{setMsgs(data);setLoading(false);markMessagesRead(profile.id);});
    return unsub;
  },[profile?.id]);
  async function send(){if(!txt.trim())return;setSending(true);await sendMessage(profile.id,txt.trim());setTxt("");setSending(false);}
  if(loading)return<Spinner/>;
  return(
    <div className="p-4 flex flex-col gap-4">
      <h2 className="text-gray-800 font-black text-xl">✉️ 留言給教練</h2>
      <Card className="p-4 flex flex-col gap-3"><ST>新增留言</ST>
        <TA value={txt} onChange={e=>setTxt(e.target.value)} rows={3} placeholder="有任何問題或想法都可以留言給教練…"/>
        <Btn v="primary" className="w-full" onClick={send} disabled={sending||!txt.trim()}>{sending?"送出中…":"送出留言"}</Btn>
      </Card>
      <ST>留言紀錄</ST>
      {msgs.length===0&&<Empty icon="✉️" message="尚無留言紀錄"/>}
      {msgs.map(m=><Card key={m.id} className="p-4">
        <div className="flex gap-3 mb-3"><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">我</div><div className="flex-1"><div className="text-gray-800 text-sm leading-relaxed">{m.content}</div><div className="text-gray-400 text-xs mt-1">{fmtDT(m.createdAt)}</div></div></div>
        {m.reply?<div className="flex gap-3 bg-blue-50 rounded-xl p-3"><div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">教</div><div className="flex-1"><div className="text-blue-600 text-xs font-bold mb-0.5">教練回覆</div><div className="text-gray-800 text-sm leading-relaxed">{m.reply}</div><div className="text-gray-400 text-xs mt-1">{fmtDT(m.repliedAt)}</div></div></div>:<div className="text-gray-300 text-xs text-center py-2">等待教練回覆中…</div>}
      </Card>)}
    </div>
  );
}
