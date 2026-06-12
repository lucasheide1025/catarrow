// src/components/admin/AdminMonthlyCard.jsx
// 後台月卡管理：購買/續約/贈天數 + 審核申請
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  subscribePendingMonthlyRequests, subscribeAllMonthlyRequests,
  approveMonthlyCardRequest, rejectMonthlyCardRequest,
  grantMonthlyCard, giftMonthlyCardDays,
} from "../../lib/db";
import { Card, Btn, Spinner } from "../shared/UI";

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
}

function daysLeft(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.ceil((d - Date.now()) / 86400000);
  return diff;
}

export default function AdminMonthlyCard() {
  const [tab,          setTab]          = useState("pending"); // "pending" | "members"
  const [pending,      setPending]      = useState([]);
  const [members,      setMembers]      = useState([]);
  const [busy,         setBusy]         = useState({});
  const [msg,          setMsg]          = useState("");
  const [search,       setSearch]       = useState("");
  const [giftTarget,   setGiftTarget]   = useState(null);
  const [giftDays,     setGiftDays]     = useState(7);
  const [giftBusy,     setGiftBusy]     = useState(false);

  useEffect(() => {
    const unsub = subscribePendingMonthlyRequests(setPending);
    return unsub;
  }, []);

  useEffect(() => {
    if (tab !== "members") return;
    getDocs(collection(db, "members"))
      .then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.name || a.nickname || "").localeCompare(b.name || b.nickname || ""));
        setMembers(list);
      })
      .catch(() => {});
  }, [tab]);

  async function doApprove(req) {
    setBusy(b => ({ ...b, [req.id]: "approve" }));
    setMsg("");
    const res = await approveMonthlyCardRequest(req.id, req.memberId);
    setMsg(res.ok ? `✅ 已核准「${req.memberName}」${req.hours}小時` : `❌ ${res.reason}`);
    setBusy(b => ({ ...b, [req.id]: null }));
  }

  async function doReject(req) {
    setBusy(b => ({ ...b, [req.id]: "reject" }));
    setMsg("");
    const res = await rejectMonthlyCardRequest(req.id);
    setMsg(res.ok ? `🚫 已拒絕「${req.memberName}」的申請` : `❌ ${res.reason}`);
    setBusy(b => ({ ...b, [req.id]: null }));
  }

  async function doGrant(member) {
    if (!window.confirm(`確定要為「${member.nickname || member.name}」${member.monthlyCard?.active ? "續約" : "購買"}月卡？\n次數重設為16次，到期日設為今日起60天。`)) return;
    setBusy(b => ({ ...b, [member.id]: "grant" }));
    setMsg("");
    const res = await grantMonthlyCard(member.id);
    if (res.ok) {
      setMsg(`✅ 已為「${member.nickname || member.name}」${member.monthlyCard?.active ? "續約" : "購買"}月卡`);
      setMembers(prev => prev.map(m => m.id !== member.id ? m : {
        ...m, monthlyCard: { active: true, sessions: 16, expiresAt: { toDate: () => { const d = new Date(); d.setDate(d.getDate()+60); return d; } }, bonusDays: 0 }
      }));
    } else { setMsg(`❌ ${res.reason}`); }
    setBusy(b => ({ ...b, [member.id]: null }));
  }

  async function doGift() {
    if (!giftTarget) return;
    setGiftBusy(true); setMsg("");
    const res = await giftMonthlyCardDays(giftTarget.id, giftDays);
    if (res.ok) {
      setMsg(`✅ 已贈送「${giftTarget.nickname || giftTarget.name}」${giftDays} 天`);
      setGiftTarget(null);
    } else { setMsg(`❌ ${res.reason}`); }
    setGiftBusy(false);
  }

  const filteredMembers = members.filter(m =>
    !search || (m.nickname || m.name || "").includes(search)
  );

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto pb-8">
      <div className="font-black text-xl text-gray-800">🎫 月卡管理</div>

      {/* 分頁 */}
      <div className="flex gap-2">
        <button onClick={() => setTab("pending")}
          className={`flex-1 py-2 rounded-xl text-sm font-black border transition-all ${tab === "pending" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
          ⏳ 待審核
          {pending.length > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>}
        </button>
        <button onClick={() => setTab("members")}
          className={`flex-1 py-2 rounded-xl text-sm font-black border transition-all ${tab === "members" ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
          👥 射手月卡
        </button>
      </div>

      {/* 結果訊息 */}
      {msg && (
        <div className={`p-3 rounded-xl text-sm font-bold ${msg.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {msg}
        </div>
      )}

      {/* ── 待審核 tab ───────────────────────────────────── */}
      {tab === "pending" && (
        <div className="flex flex-col gap-3">
          {pending.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">目前沒有待審核申請 🎉</div>
          )}
          {pending.map(req => (
            <Card key={req.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-black text-gray-800">{req.memberName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">申請使用 <span className="font-black text-blue-600">{req.hours} 小時</span></div>
                  <div className="text-xs text-gray-400">{fmtDate(req.createdAt)}</div>
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full">⏳ 待審核</span>
              </div>
              <div className="flex gap-2">
                <Btn v="primary" className="flex-1" disabled={!!busy[req.id]}
                  onClick={() => doApprove(req)}>
                  {busy[req.id] === "approve" ? "處理中…" : "✅ 核准"}
                </Btn>
                <Btn v="secondary" className="flex-1" disabled={!!busy[req.id]}
                  onClick={() => doReject(req)}>
                  {busy[req.id] === "reject" ? "處理中…" : "🚫 拒絕"}
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── 射手月卡 tab ─────────────────────────────────── */}
      {tab === "members" && (
        <div className="flex flex-col gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜尋射手…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />

          {filteredMembers.map(m => {
            const card = m.monthlyCard;
            const days = card?.expiresAt ? daysLeft(card.expiresAt) : null;
            const expired = days !== null && days <= 0;
            const active = card?.active && !expired;
            return (
              <Card key={m.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-gray-800">{m.nickname || m.name}</div>
                    {active ? (
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="text-sm text-blue-600 font-black">
                          🎫 剩餘 {card.sessions} 次
                        </div>
                        <div className="text-xs text-gray-500">
                          到期：{fmtDate(card.expiresAt)}
                          {days !== null && (
                            <span className={`ml-1 font-bold ${days <= 7 ? "text-red-500" : "text-gray-400"}`}>
                              （剩 {days} 天）
                            </span>
                          )}
                          {card.bonusDays > 0 && <span className="ml-1 text-purple-500">+贈{card.bonusDays}天</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 mt-1">
                        {expired ? "⚠️ 月卡已到期" : "尚未購買月卡"}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {active ? "有效" : "無效"}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Btn v="primary" disabled={!!busy[m.id]}
                    onClick={() => doGrant(m)}
                    className="flex-1 min-w-[80px]">
                    {busy[m.id] === "grant" ? "處理中…" : active ? "🔄 續約" : "🎫 購買"}
                  </Btn>
                  <Btn v="secondary" disabled={!active}
                    onClick={() => { setGiftTarget(m); setGiftDays(7); setMsg(""); }}
                    className="flex-1 min-w-[80px]">
                    🎁 贈天數
                  </Btn>
                </div>
              </Card>
            );
          })}
          {filteredMembers.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-6">找不到射手</div>
          )}
        </div>
      )}

      {/* 贈天數 Modal */}
      {giftTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setGiftTarget(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="font-black text-gray-800 text-lg mb-1">🎁 贈送免費天數</div>
            <div className="text-gray-500 text-sm mb-4">{giftTarget.nickname || giftTarget.name}</div>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setGiftDays(d => Math.max(1, d - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 font-black text-xl">−</button>
              <span className="flex-1 text-center font-black text-2xl text-blue-600">{giftDays} 天</span>
              <button onClick={() => setGiftDays(d => Math.min(365, d + 1))}
                className="w-10 h-10 rounded-full bg-gray-100 font-black text-xl">+</button>
            </div>
            <div className="flex gap-2">
              {[7, 14, 30].map(n => (
                <button key={n} onClick={() => setGiftDays(n)}
                  className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg font-bold text-gray-600">
                  +{n}天
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Btn v="secondary" className="flex-1" onClick={() => setGiftTarget(null)}>取消</Btn>
              <Btn v="primary" className="flex-1" disabled={giftBusy} onClick={doGift}>
                {giftBusy ? "贈送中…" : "確認贈送"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
