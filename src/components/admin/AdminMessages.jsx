// src/components/admin/AdminMessages.jsx
import { useState, useEffect } from "react";
import { subscribeAllMessages, replyMessage } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { fmtDT } from "../../lib/constants";
import { Card, Btn, TA, Modal, Spinner, Empty, useToast } from "../shared/UI";
 
export default function AdminMessages() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyModal, setReplyModal] = useState(null);
  const [filter, setFilter] = useState("全部");
 
  useEffect(() => {
    const unsub = subscribeAllMessages(msgs => {
      setMessages(msgs);
      setLoading(false);
    });
    return unsub;
  }, []);
 
  const grouped = {};
  messages.forEach(m => {
    if (!grouped[m.memberId]) grouped[m.memberId] = { memberName: m.memberName, memberNickname: m.memberNickname, msgs: [] };
    grouped[m.memberId].msgs.push(m);
  });
 
  const filtered = filter === "待回覆"
    ? Object.entries(grouped).filter(([, g]) => g.msgs.some(m => !m.reply))
    : Object.entries(grouped);
 
  if (loading) return <Spinner />;
 
  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <h2 className="text-gray-800 font-black text-xl">✉️ 射手留言</h2>
 
      <div className="flex gap-2">
        {["全部", "待回覆"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === f ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {f}
            {f === "待回覆" && messages.filter(m => !m.reply).length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{messages.filter(m => !m.reply).length}</span>
            )}
          </button>
        ))}
      </div>
 
      {filtered.length === 0 && <Empty message="沒有留言" />}
 
      {filtered.map(([memberId, group]) => {
        const pending = group.msgs.filter(m => !m.reply).length;
        return (
          <Card key={memberId} className="p-4 mb-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-gray-800 font-bold text-sm">{group.memberName}</span>
                {group.memberNickname && <span className="text-gray-400 text-sm ml-1">（{group.memberNickname}）</span>}
                {pending > 0 && (
                  <span className="ml-2 text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">{pending} 則待回覆</span>
                )}
              </div>
            </div>
 
            {group.msgs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds).map(m => (
              <div key={m.id} className={`mb-3 p-3 rounded-xl border ${!m.reply ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-gray-50"}`}>
                <div className="text-gray-700 text-sm mb-1">{m.content}</div>
                <div className="text-gray-400 text-xs mb-2">{fmtDT(m.createdAt)}</div>
                {m.reply ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
                    <div className="text-blue-600 text-xs font-bold mb-0.5">已回覆</div>
                    <div className="text-gray-700 text-sm">{m.reply}</div>
                    <div className="text-gray-400 text-xs mt-1">{fmtDT(m.repliedAt)}</div>
                  </div>
                ) : (
                  <Btn v="primary" size="sm" onClick={() => setReplyModal(m)}>回覆</Btn>
                )}
              </div>
            ))}
          </Card>
        );
      })}
 
      {replyModal && (
        <ReplyModal msg={replyModal} operatorId={profile.id}
          onClose={() => setReplyModal(null)}
          onDone={() => { toast("已回覆 ✓"); setReplyModal(null); }} />
      )}
    </div>
  );
}
 
function ReplyModal({ msg, operatorId, onClose, onDone }) {
  const [txt, setTxt] = useState("");
  const [saving, setSaving] = useState(false);
  async function send() {
    if (!txt.trim()) return;
    setSaving(true);
    await replyMessage(msg.id, txt, operatorId);
    onDone();
    setSaving(false);
  }
  return (
    <Modal open onClose={onClose} title="回覆留言">
      <div className="flex flex-col gap-3">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
          <div className="text-gray-500 text-xs mb-1">射手留言：</div>
          <div className="text-gray-700 text-sm">{msg.content}</div>
        </div>
        <TA label="回覆內容" value={txt} onChange={e => setTxt(e.target.value)} rows={4} placeholder="輸入回覆…" />
        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1 py-3" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1 py-3" onClick={send} disabled={saving || !txt.trim()}>
            {saving ? "送出中…" : "送出回覆"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}