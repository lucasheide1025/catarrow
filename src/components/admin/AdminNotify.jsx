// src/components/admin/AdminNotify.jsx
// 後台：手動發送通知（重要 / 優惠 / 比賽新增）
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { createNotification, subscribeNotifications } from "../../lib/db";
import { Card, Btn, Inp, TA, Sel, ST, useToast } from "../shared/UI";
import { fmtDT } from "../../lib/constants";

const TYPE_OPTIONS = [
  { value: "important", label: "📢 重要訊息（一般公告）" },
  { value: "promo",     label: "🎁 優惠訊息（強制閱讀）" },
  { value: "new_comp",  label: "🏆 比賽新增通知" },
];

export default function AdminNotify() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [type, setType] = useState("important");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    // 用教練自己 id 訂閱（全體通知都看得到）
    const unsub = subscribeNotifications(profile.id, list => {
      setRecent(list.filter(n => ["important","promo","new_comp"].includes(n.type)).slice(0, 20));
    });
    return () => unsub && unsub();
  }, [profile.id]);

  async function send() {
    if (!title.trim()) { toast("請填寫標題", "error"); return; }
    setSaving(true);
    await createNotification({
      type,
      title: title.trim(),
      content: content.trim(),
      targetMemberId: null,
      mustRead: type === "promo",
      subjectInfo: { fromName: profile.nickname || profile.name || "教練" },
    }, profile.id);
    toast("通知已發送 ✓");
    setTitle(""); setContent("");
    setSaving(false);
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <h2 className="text-gray-800 font-black text-xl">📣 發送通知</h2>

      <Card className="p-4 flex flex-col gap-3">
        <Sel label="通知類型" value={type} onChange={e => setType(e.target.value)} options={TYPE_OPTIONS} />
        {type === "promo" && (
          <div className="bg-pink-50 border border-pink-200 rounded-lg px-3 py-2 text-pink-700 text-xs">
            ⚠️ 優惠訊息會以「強制閱讀彈窗」顯示，學生需點擊閱讀後才能繼續操作。
          </div>
        )}
        <Inp label="標題" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：本週六公休一日" />
        <TA label="內容" value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="輸入通知詳細內容…" />
        <Btn v="primary" className="w-full py-3" onClick={send} disabled={saving}>
          {saving ? "發送中…" : "發送給全體學員"}
        </Btn>
      </Card>

      <Card className="p-4">
        <ST>最近發送</ST>
        {recent.length === 0 ? (
          <div className="text-gray-400 text-sm py-2">尚無發送紀錄</div>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map(n => (
              <div key={n.id} className="border-b border-gray-100 last:border-0 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-800 text-sm font-bold">{n.title}</span>
                  {n.mustRead && <span className="text-xs bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full">強制</span>}
                </div>
                <div className="text-gray-400 text-xs">{fmtDT(n.createdAt)}　已讀 {(n.readBy || []).length} 人</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
