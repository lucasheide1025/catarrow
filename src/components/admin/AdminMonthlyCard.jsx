// src/components/admin/AdminMonthlyCard.jsx
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  subscribePendingMonthlyRequests,
  approveMonthlyCardRequest, rejectMonthlyCardRequest,
  grantMonthlyCard, giftMonthlyCardSessions,
  getMonthlyCardConfig, saveMonthlyCardConfig,
  subscribeMonthlyCardLogs,
} from "../../lib/db";
import { Card, Btn } from "../shared/UI";

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
}

function fmtDateTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${fmtDate(ts)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function daysLeft(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.ceil((d - Date.now()) / 86400000);
}

const ACTION_LABELS = {
  purchase:      "🎫 購買月卡",
  renew:         "🔄 續約月卡",
  gift_sessions: "🎁 贈送次數",
  use_approved:  "✅ 核准使用",
  use_rejected:  "🚫 拒絕申請",
};

function MemberLogPanel({ memberId }) {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    return subscribeMonthlyCardLogs(memberId, setLogs);
  }, [memberId]);

  if (logs === null) return <div className="text-xs text-gray-400 py-2 text-center">載入中…</div>;
  if (logs.length === 0) return <div className="text-xs text-gray-400 py-2 text-center">尚無紀錄</div>;
  return (
    <div className="flex flex-col gap-1 mt-2">
      {logs.map(l => (
        <div key={l.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1.5">
          <div className="flex flex-col">
            <span className="font-bold text-gray-700">{ACTION_LABELS[l.action] || l.action}</span>
            <span className="text-gray-400">{l.note}</span>
          </div>
          <div className="flex flex-col items-end shrink-0 ml-2">
            {l.delta !== 0 && (
              <span className={`font-black text-sm ${l.delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                {l.delta > 0 ? `+${l.delta}` : l.delta}
              </span>
            )}
            <span className="text-gray-400">{fmtDateTime(l.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminMonthlyCard({ adminProfile }) {
  const [tab,        setTab]        = useState("pending");
  const [pending,    setPending]    = useState([]);
  const [members,    setMembers]    = useState([]);
  const [busy,       setBusy]       = useState({});
  const [msg,        setMsg]        = useState("");
  const [search,     setSearch]     = useState("");
  const [giftTarget, setGiftTarget] = useState(null);
  const [giftN,      setGiftN]      = useState(3);
  const [giftBusy,   setGiftBusy]   = useState(false);
  const [expandLog,  setExpandLog]  = useState({});

  // 設定分頁
  const [cfg,        setCfg]        = useState({ sessions: 16, validDays: 60 });
  const [cfgBusy,    setCfgBusy]    = useState(false);
  const [cfgMsg,     setCfgMsg]     = useState("");

  const operatorId = adminProfile?.id || adminProfile?.uid || null;

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

  useEffect(() => {
    if (tab !== "config") return;
    getMonthlyCardConfig().then(c => setCfg(c || { sessions: 16, validDays: 60 }));
  }, [tab]);

  async function doApprove(req) {
    setBusy(b => ({ ...b, [req.id]: "approve" }));
    setMsg("");
    const res = await approveMonthlyCardRequest(req.id, req.memberId, operatorId);
    setMsg(res.ok ? `✅ 已核准「${req.memberName}」${req.hours}小時` : `❌ ${res.reason}`);
    setBusy(b => ({ ...b, [req.id]: null }));
  }

  async function doReject(req) {
    setBusy(b => ({ ...b, [req.id]: "reject" }));
    setMsg("");
    const res = await rejectMonthlyCardRequest(req.id, operatorId);
    setMsg(res.ok ? `🚫 已拒絕「${req.memberName}」的申請` : `❌ ${res.reason}`);
    setBusy(b => ({ ...b, [req.id]: null }));
  }

  async function doGrant(member) {
    if (!window.confirm(`確定要為「${member.nickname || member.name}」${member.monthlyCard?.active ? "續約" : "購買"}月卡？\n次數設為 ${cfg.sessions} 次，到期日設為今日起 ${cfg.validDays} 天。`)) return;
    setBusy(b => ({ ...b, [member.id]: "grant" }));
    setMsg("");
    const res = await grantMonthlyCard(member.id, member.nickname || member.name, operatorId);
    if (res.ok) {
      setMsg(`✅ 已為「${member.nickname || member.name}」${member.monthlyCard?.active ? "續約" : "購買"}月卡（${res.sessions} 次）`);
      setMembers(prev => prev.map(m => m.id !== member.id ? m : {
        ...m, monthlyCard: { active: true, sessions: res.sessions,
          expiresAt: { toDate: () => { const d = new Date(); d.setDate(d.getDate() + cfg.validDays); return d; } }
        }
      }));
    } else { setMsg(`❌ ${res.reason}`); }
    setBusy(b => ({ ...b, [member.id]: null }));
  }

  async function doGift() {
    if (!giftTarget) return;
    setGiftBusy(true); setMsg("");
    const res = await giftMonthlyCardSessions(
      giftTarget.id, giftTarget.nickname || giftTarget.name, giftN, operatorId
    );
    if (res.ok) {
      setMsg(`✅ 已贈送「${giftTarget.nickname || giftTarget.name}」${giftN} 次`);
      setMembers(prev => prev.map(m => m.id !== giftTarget.id ? m : {
        ...m, monthlyCard: {
          ...(m.monthlyCard || {}), active: true,
          sessions: (m.monthlyCard?.sessions ?? 0) + giftN,
        }
      }));
      setGiftTarget(null);
    } else { setMsg(`❌ ${res.reason}`); }
    setGiftBusy(false);
  }

  async function saveCfg() {
    setCfgBusy(true); setCfgMsg("");
    const res = await saveMonthlyCardConfig(cfg, operatorId);
    setCfgMsg(res === undefined || res?.ok !== false ? "✅ 設定已儲存" : `❌ 儲存失敗`);
    setCfgBusy(false);
  }

  const filteredMembers = members.filter(m =>
    !search || (m.nickname || m.name || "").includes(search)
  );

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto pb-8">
      <div className="font-black text-xl text-gray-800">🎫 月卡管理</div>

      {/* 分頁 */}
      <div className="flex gap-2">
        {[
          { id: "pending", label: "⏳ 待審核", badge: pending.length },
          { id: "members", label: "👥 射手月卡" },
          { id: "config",  label: "⚙️ 設定" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-sm font-black border transition-all ${tab === t.id ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
            {t.label}
            {t.badge > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{t.badge}</span>}
          </button>
        ))}
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
                  <div className="text-xs text-gray-400">{fmtDateTime(req.createdAt)}</div>
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
            const showLog = !!expandLog[m.id];
            return (
              <Card key={m.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-gray-800">{m.nickname || m.name}</div>
                    {active ? (
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="text-sm text-blue-600 font-black">🎫 剩餘 {card.sessions} 次</div>
                        <div className="text-xs text-gray-500">
                          到期：{fmtDate(card.expiresAt)}
                          {days !== null && (
                            <span className={`ml-1 font-bold ${days <= 7 ? "text-red-500" : "text-gray-400"}`}>
                              （剩 {days} 天）
                            </span>
                          )}
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
                  <Btn v="secondary"
                    onClick={() => { setGiftTarget(m); setGiftN(3); setMsg(""); }}
                    className="flex-1 min-w-[80px]">
                    🎁 贈次數
                  </Btn>
                  <button
                    onClick={() => setExpandLog(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                    className="text-xs text-gray-400 underline px-2">
                    {showLog ? "收起" : "查看紀錄"}
                  </button>
                </div>
                {showLog && <MemberLogPanel memberId={m.id} />}
              </Card>
            );
          })}
          {filteredMembers.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-6">找不到射手</div>
          )}
        </div>
      )}

      {/* ── 設定 tab ─────────────────────────────────────── */}
      {tab === "config" && (
        <div className="flex flex-col gap-4">
          <Card className="p-4 flex flex-col gap-4">
            <div className="font-black text-gray-700">月卡預設值</div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-bold">購買 / 續約次數</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setCfg(c => ({ ...c, sessions: Math.max(1, c.sessions - 1) }))}
                  className="w-9 h-9 rounded-full bg-gray-100 font-black text-lg">−</button>
                <span className="flex-1 text-center font-black text-2xl text-blue-600">{cfg.sessions} 次</span>
                <button onClick={() => setCfg(c => ({ ...c, sessions: Math.min(100, c.sessions + 1) }))}
                  className="w-9 h-9 rounded-full bg-gray-100 font-black text-lg">+</button>
              </div>
              <div className="flex gap-2 mt-1">
                {[8, 12, 16, 20].map(n => (
                  <button key={n} onClick={() => setCfg(c => ({ ...c, sessions: n }))}
                    className={`flex-1 py-1 text-xs rounded-lg font-bold border transition-all ${cfg.sessions === n ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 text-gray-600 border-transparent"}`}>
                    {n}次
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-bold">有效天數</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setCfg(c => ({ ...c, validDays: Math.max(1, c.validDays - 1) }))}
                  className="w-9 h-9 rounded-full bg-gray-100 font-black text-lg">−</button>
                <span className="flex-1 text-center font-black text-2xl text-blue-600">{cfg.validDays} 天</span>
                <button onClick={() => setCfg(c => ({ ...c, validDays: Math.min(365, c.validDays + 1) }))}
                  className="w-9 h-9 rounded-full bg-gray-100 font-black text-lg">+</button>
              </div>
              <div className="flex gap-2 mt-1">
                {[30, 60, 90].map(n => (
                  <button key={n} onClick={() => setCfg(c => ({ ...c, validDays: n }))}
                    className={`flex-1 py-1 text-xs rounded-lg font-bold border transition-all ${cfg.validDays === n ? "bg-blue-600 text-white border-blue-600" : "bg-gray-100 text-gray-600 border-transparent"}`}>
                    {n}天
                  </button>
                ))}
              </div>
            </div>
            {cfgMsg && (
              <div className={`text-sm font-bold ${cfgMsg.startsWith("✅") ? "text-emerald-600" : "text-red-500"}`}>
                {cfgMsg}
              </div>
            )}
            <Btn v="primary" disabled={cfgBusy} onClick={saveCfg}>
              {cfgBusy ? "儲存中…" : "💾 儲存設定"}
            </Btn>
          </Card>
          <div className="text-xs text-gray-400 text-center">
            設定只影響之後的購買／續約，不影響已發的月卡
          </div>
        </div>
      )}

      {/* 贈次數 Modal */}
      {giftTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setGiftTarget(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="font-black text-gray-800 text-lg mb-1">🎁 贈送免費次數</div>
            <div className="text-gray-500 text-sm mb-4">{giftTarget.nickname || giftTarget.name}</div>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setGiftN(n => Math.max(1, n - 1))}
                className="w-10 h-10 rounded-full bg-gray-100 font-black text-xl">−</button>
              <span className="flex-1 text-center font-black text-2xl text-blue-600">{giftN} 次</span>
              <button onClick={() => setGiftN(n => Math.min(100, n + 1))}
                className="w-10 h-10 rounded-full bg-gray-100 font-black text-xl">+</button>
            </div>
            <div className="flex gap-2 mb-4">
              {[1, 2, 4, 8].map(n => (
                <button key={n} onClick={() => setGiftN(n)}
                  className="flex-1 py-1.5 text-xs bg-gray-100 rounded-lg font-bold text-gray-600">
                  +{n}次
                </button>
              ))}
            </div>
            <div className="flex gap-2">
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
