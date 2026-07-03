// src/components/member/MemberNotifications.jsx
// 訊息中心：分類 + 年月篩選 + 祝賀 + 會員可自刪
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { markNotificationRead, deleteNotificationForMe, addCongrats } from "../../lib/db";
import { Card, Btn, TA, ST, Spinner, Empty, useToast } from "../shared/UI";

const TYPE_META = {
  important:             { label:"重要",  color:"bg-red-500/15 text-red-300",     icon:"📢" },
  promo:                 { label:"優惠",  color:"bg-pink-500/15 text-pink-300",   icon:"🎁" },
  promo_unlock:          { label:"重要",  color:"bg-red-500/15 text-red-300",     icon:"⚔️" },
  new_comp:              { label:"賽事",  color:"bg-blue-500/15 text-blue-300",   icon:"🏆" },
  comp_result:           { label:"成績",  color:"bg-green-500/15 text-green-300", icon:"🏅" },
  cert_pass:             { label:"榮耀",  color:"bg-amber-500/15 text-amber-300", icon:"🎖️" },
  high_score:            { label:"榮耀",  color:"bg-amber-500/15 text-amber-300", icon:"🎯" },
  achievement:           { label:"成就",  color:"bg-purple-500/15 text-purple-300",icon:"🏅" },
  village_goal:          { label:"村莊",  color:"bg-emerald-500/15 text-emerald-300",icon:"🏡" },
  village_goal_complete: { label:"村莊",  color:"bg-amber-500/15 text-amber-300", icon:"🎉" },
  market_sale:           { label:"市集",  color:"bg-teal-500/15 text-teal-300",   icon:"🛒" },
  card_pack:             { label:"市集",  color:"bg-indigo-500/15 text-indigo-300",icon:"🃏" },
  dungeon:               { label:"地下城",color:"bg-white/10 text-gray-300",      icon:"🗺️" },
  worldboss:             { label:"世界王",color:"bg-rose-500/15 text-rose-300",   icon:"👑" },
  loot:                  { label:"掉寶",  color:"bg-yellow-500/15 text-yellow-300",icon:"💎" },
};

const FILTERS = [
  { id:"all",       label:"全部" },
  { id:"important", label:"重要/優惠" },
  { id:"new_comp",  label:"賽事" },
  { id:"honor",     label:"榮耀時刻" },
  { id:"achievement",label:"成就" },
  { id:"market",    label:"市集" },
  { id:"village",   label:"村莊" },
];

export default function MemberNotifications({ notifications = [] }) {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [filter, setFilter]           = useState("all");
  const [month, setMonth]             = useState("all");
  const [congratModal, setCongratModal] = useState(null);

  const notifs = notifications.filter(n => !(n.deletedBy || []).includes(profile?.id));

  function matchFilter(n) {
    if (filter === "all")        return true;
    if (filter === "important")  return n.type === "important" || n.type === "promo" || n.type === "promo_unlock";
    if (filter === "new_comp")   return n.type === "new_comp" || n.type === "comp_result";
    if (filter === "honor")      return n.type === "cert_pass" || n.type === "high_score";
    if (filter === "achievement") return n.type === "achievement";
    if (filter === "market")     return n.type === "market_sale" || n.type === "card_pack";
    if (filter === "village")    return n.type === "village_goal" || n.type === "village_goal_complete";
    return true;
  }
  function monthOf(n) {
    const d = n.createdAt?.toDate ? n.createdAt.toDate() : null;
    if (!d) return "未知";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }

  const filtered = notifs.filter(matchFilter);
  const months   = [...new Set(filtered.map(monthOf))].sort().reverse();
  const shown    = month === "all" ? filtered : filtered.filter(n => monthOf(n) === month);

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
      <h2 className="text-gray-100 font-black text-xl">🔔 訊息中心</h2>

      {/* 分類 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all
              ${filter === f.id ? "bg-blue-600 text-white border-blue-600" : "bg-white/10 text-gray-300 border-white/15"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* 年月 */}
      {months.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setMonth("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border
              ${month === "all" ? "bg-white/25 text-white border-white/40" : "bg-white/10 text-gray-400 border-white/15"}`}>
            全部月份
          </button>
          {months.map(m => (
            <button key={m} onClick={() => setMonth(m)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap border
                ${month === m ? "bg-white/25 text-white border-white/40" : "bg-white/10 text-gray-400 border-white/15"}`}>
              {m}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && <Empty icon="🔔" message="目前沒有訊息" />}

      {monthKeys.map(m => (
        <div key={m} className="flex flex-col gap-2">
          <div className="text-gray-400 text-sm font-black">{m}</div>
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
  const meta       = TYPE_META[n.type] || TYPE_META.important;
  const isRead     = (n.readBy || []).includes(myId);
  const isHonor    = n.type === "cert_pass" || n.type === "high_score";
  const isSubject  = n.subjectMemberId === myId;
  const congrats   = n.congrats || [];

  useEffect(() => { if (!isRead) onRead(); }, []); // eslint-disable-line

  return (
    <Card className={`p-4 ${!isRead ? "ring-1 ring-blue-400/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.icon} {meta.label}</span>
            {!isRead && <span className="w-2 h-2 rounded-full bg-blue-500" />}
          </div>
          <div className="text-gray-100 font-bold text-sm">{n.title}</div>
          <div className="text-gray-300 text-sm mt-0.5">{n.content}</div>
          {n.subjectInfo?.fromName && (
            <div className="text-gray-400 text-xs mt-1">— {n.subjectInfo.fromName}</div>
          )}
        </div>
        <button onClick={onDelete} className="text-gray-500 hover:text-red-400 text-xs flex-shrink-0 py-1">刪除</button>
      </div>

      {/* 榮耀：祝賀區 */}
      {isHonor && (
        <div className="mt-3 border-t border-white/10 pt-3">
          {isSubject ? (
            <>
              <div className="text-amber-300 text-xs font-bold mb-2">🎉 你收到 {congrats.length} 則祝賀</div>
              {congrats.length === 0 ? (
                <div className="text-gray-400 text-xs">還沒有人留言祝賀</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {congrats.slice().reverse().map((c,i) => (
                    <div key={i} className="bg-amber-500/10 rounded-lg px-3 py-2">
                      <div className="text-gray-200 text-sm">{c.text}</div>
                      <div className="text-gray-400 text-xs mt-0.5">— {c.anon ? "匿名" : (c.name || "某位射手")}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <button onClick={onCongrat}
              className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-sm font-bold rounded-lg border border-amber-400/30">
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
      <div className="rounded-2xl p-5 w-full max-w-md"
        style={{ background:"var(--bg-surface)", border:"1px solid var(--border-card)", boxShadow:"var(--shadow-elevated)" }}
        onClick={e => e.stopPropagation()}>
        <div className="text-gray-100 font-black text-lg mb-1">🎉 送上祝賀</div>
        <div className="text-gray-400 text-xs mb-3">{n.title}</div>
        <TA value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="寫下你的祝賀…" />
        <label className="flex items-center gap-2 text-gray-300 text-sm mt-3 cursor-pointer">
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
