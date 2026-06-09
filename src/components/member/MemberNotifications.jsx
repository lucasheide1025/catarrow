// src/components/member/MemberNotifications.jsx
// 訊息中心：分類 + 年月篩選 + 祝賀 + 會員可自刪
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeNotifications, markNotificationRead, deleteNotificationForMe, addCongrats } from "../../lib/db";
import { Card, Btn, TA, ST, Spinner, Empty, useToast } from "../shared/UI";

const TYPE_META = {
  important:   { label: "重要", color: "bg-red-100 text-red-700",       icon: "📢" },
  promo:       { label: "優惠", color: "bg-pink-100 text-pink-700",      icon: "🎁" },
  new_comp:    { label: "賽事", color: "bg-blue-100 text-blue-700",      icon: "🏆" },
  cert_pass:   { label: "榮耀", color: "bg-amber-100 text-amber-700",    icon: "🎖️" },
  high_score:  { label: "榮耀", color: "bg-amber-100 text-amber-700",    icon: "🎯" },
  comp_result: { label: "成績", color: "bg-green-100 text-green-700",    icon: "🏅" },
};

const FILTERS = [
  { id: "all",     label: "全部" },
  { id: "important",label: "重要/優惠" },
  { id: "new_comp", label: "賽事" },
  { id: "honor",    label: "榮耀時刻" },
];

export default function MemberNotifications() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [month, setMonth] = useState("all");
  const [congratModal, setCongratModal] = useState(null);

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeNotifications(profile.id, list => {
      // 過濾掉自己已刪除的
      const mine = list.filter(n => !(n.deletedBy || []).includes(profile.id));
      setNotifs(mine);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [profile?.id]);

  if (loading) return <Spinner />;

  // 篩選
  function matchFilter(n) {
    if (filter === "all") return true;
    if (filter === "important") return n.type === "important" || n.type === "promo";
    if (filter === "new_comp") return n.type === "new_comp";
    if (filter === "honor") return n.type === "cert_pass" || n.type === "high_score";
    return true;
  }
  function monthOf(n) {
    const d = n.createdAt?.toDate ? n.createdAt.toDate() : null;
    if (!d) return "未知";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const filtered = notifs.filter(matchFilter);
  const months = [...new Set(filtered.map(monthOf))].sort().reverse();
  const shown = month === "all" ? filtered : filtered.filter(n => monthOf(n) === month);

  // 按月分組
  const byMonth = {};
  shown.forEach(n => { const m = monthOf(n); (byMonth[m] = byMonth[m] || []).push(n); });
  const monthKeys = Object.keys(byMonth).sort().reverse();

  async function handleRead(n) {
    if (!(n.readBy || []).includes(profile.id)) await markNotificationRead(n.id, profile.id);
  }
  async function handleDelete(n) {
    await deleteNotificationForMe(n.id, profile.id);
    toast("已從你的訊息中移除");
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <h2 className="text-gray-800 font-black text-xl">🔔 訊息中心</h2>

      {/* 分類 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
              ${filter === f.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* 年月 */}
      {months.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setMonth("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border ${month === "all" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200"}`}>
            全部月份
          </button>
          {months.map(m => (
            <button key={m} onClick={() => setMonth(m)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border ${month === m ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200"}`}>
              {m}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && <Empty icon="🔔" message="目前沒有訊息" />}

      {monthKeys.map(m => (
        <div key={m} className="flex flex-col gap-2">
          <div className="text-gray-500 text-sm font-black">{m}</div>
          {byMonth[m].map(n => (
            <NotifCard key={n.id} n={n} myId={profile.id}
              onRead={() => handleRead(n)}
              onDelete={() => handleDelete(n)}
              onCongrat={() => setCongratModal(n)} />
          ))}
        </div>
      ))}

      {congratModal && (
        <CongratModal n={congratModal} profile={profile}
          onClose={() => setCongratModal(null)}
          onDone={() => { toast("祝賀已送出 🎉"); setCongratModal(null); }} />
      )}
    </div>
  );
}

function NotifCard({ n, myId, onRead, onDelete, onCongrat }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[n.type] || TYPE_META.important;
  const isRead = (n.readBy || []).includes(myId);
  const isHonor = n.type === "cert_pass" || n.type === "high_score";
  const isSubject = n.subjectMemberId === myId;   // 我是當事人
  const congrats = n.congrats || [];

  useEffect(() => { if (!isRead) onRead(); }, []);  // 一顯示就標已讀

  return (
    <Card className={`p-4 ${!isRead ? "ring-1 ring-blue-200" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.icon} {meta.label}</span>
            {!isRead && <span className="w-2 h-2 rounded-full bg-blue-500" />}
          </div>
          <div className="text-gray-800 font-bold text-sm">{n.title}</div>
          <div className="text-gray-600 text-sm mt-0.5">{n.content}</div>
        </div>
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0">刪除</button>
      </div>

      {/* 榮耀：祝賀區 */}
      {isHonor && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          {/* 當事人：看得到收到的祝賀 */}
          {isSubject ? (
            <>
              <div className="text-amber-600 text-xs font-bold mb-2">🎉 你收到 {congrats.length} 則祝賀</div>
              {congrats.length === 0 ? (
                <div className="text-gray-400 text-xs">還沒有人留言祝賀</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {congrats.slice().reverse().map((c, i) => (
                    <div key={i} className="bg-amber-50 rounded-lg px-3 py-2">
                      <div className="text-gray-700 text-sm">{c.text}</div>
                      <div className="text-gray-400 text-xs mt-0.5">— {c.anon ? "匿名" : (c.name || "某位射手")}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* 其他人：可以祝賀，但看不到別人留了什麼 */
            <button onClick={onCongrat}
              className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-bold rounded-lg border border-amber-200">
              🎉 送上祝賀
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function CongratModal({ n, profile, onClose, onDone }) {
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    await addCongrats(n.id, profile.nickname || profile.name, anon, text.trim());
    setBusy(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="text-gray-800 font-black text-lg mb-1">🎉 送上祝賀</div>
        <div className="text-gray-500 text-xs mb-3">{n.title}</div>
        <TA value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="寫下你的祝賀…" />
        <label className="flex items-center gap-2 text-gray-600 text-sm mt-3 cursor-pointer">
          <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} className="accent-blue-600" />
          匿名祝賀（不顯示我的名字）
        </label>
        <div className="flex gap-2 mt-4">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v="primary" className="flex-1" onClick={send} disabled={busy || !text.trim()}>
            {busy ? "送出中…" : "送出祝賀"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
