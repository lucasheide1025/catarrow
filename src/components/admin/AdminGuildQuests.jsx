// src/components/admin/AdminGuildQuests.jsx — 公會後台：任務發佈 + 徽章審核 + 排行
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeAllGuildQuests, publishGuildQuest, updateGuildQuestStatus, deleteGuildQuest,
  subscribeGuildSubmissions, approveGuildSubmission, rejectGuildSubmission,
  getMembers,
} from "../../lib/db";
import { levelFromXP, rankFromLevel, rankIdxFromLevel, xpProgress, RANKS } from "../../lib/adventurerSystem";

const BADGE_LABEL = { silver: "🥈 銀章", gold: "🥇 金章", black: "⬛ 黑章" };
const BADGE_REQ   = { silver: null, gold: "silver", black: "gold" };
const BADGE_COLOR = { silver: "#94a3b8", gold: "#fbbf24", black: "#1e293b" };
const PROMO_LEVELS = [10, 20, 30, 40, 50];

const EMPTY_FORM = {
  title: "", desc: "", type: "normal",
  badgeReward: "", reward: { xp: 100, coins: 50 },
};

export default function AdminGuildQuests() {
  const { profile } = useAuth();
  const [tab, setTab]           = useState("quests");
  const [quests, setQuests]     = useState([]);
  const [subs, setSubs]         = useState([]);
  const [members, setMembers]   = useState([]);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState("");
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const u1 = subscribeAllGuildQuests(setQuests);
    const u2 = subscribeGuildSubmissions(setSubs);
    getMembers().then(list => setMembers([...list].sort((a, b) => (b.adventurerXP || 0) - (a.adventurerXP || 0))));
    return () => { u1?.(); u2?.(); };
  }, []);

  async function handlePublish() {
    if (!form.title.trim()) { setMsg("請輸入任務名稱"); return; }
    setBusy(true); setMsg("");
    const data = {
      ...form,
      badgeReward:   form.badgeReward || null,
      badgeRequires: form.badgeReward ? BADGE_REQ[form.badgeReward] : null,
      reward: { xp: Number(form.reward.xp) || 0, coins: Number(form.reward.coins) || 0 },
    };
    try {
      await publishGuildQuest(data, profile?.id);
      setForm(EMPTY_FORM); setShowForm(false);
    } catch(e) {
      setMsg("發佈失敗：" + e.message);
    }
    setBusy(false);
  }

  async function handleApprove(sub) {
    await approveGuildSubmission(sub.id, sub, profile?.id);
  }
  async function handleReject(sub) {
    await rejectGuildSubmission(sub.id, rejectReason, profile?.id);
    setRejectId(null); setRejectReason("");
  }

  const TABS = [
    { id: "quests", label: "📋 任務發佈", badge: 0 },
    { id: "review", label: "🎖️ 待審徽章", badge: subs.length },
    { id: "ranks",  label: "⚔️ 冒險者排行", badge: 0 },
  ];

  return (
    <div style={{ fontFamily: "sans-serif", paddingBottom: "16px" }}>
      {/* Tab 列 */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "white", position: "sticky", top: 0, zIndex: 10 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "12px 4px", border: "none", background: "none", cursor: "pointer",
              fontWeight: "700", fontSize: "12px",
              color: tab === t.id ? "#2563eb" : "#94a3b8",
              borderBottom: tab === t.id ? "2px solid #2563eb" : "2px solid transparent",
            }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{ marginLeft: 4, background: "#ef4444", color: "white", borderRadius: "10px", padding: "1px 6px", fontSize: "10px" }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 任務發佈 tab ── */}
      {tab === "quests" && (
        <div style={{ padding: "12px" }}>
          <button onClick={() => setShowForm(v => !v)}
            style={{ width: "100%", padding: "10px", background: "#2563eb", color: "white", border: "none", borderRadius: "10px", fontWeight: "900", fontSize: "14px", cursor: "pointer", marginBottom: "12px" }}>
            {showForm ? "▲ 收起" : "+ 發佈新任務"}
          </button>

          {showForm && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>任務名稱 *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="例如：神射試煉" style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px" }} />

                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>任務說明</label>
                <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
                  placeholder="在 XX 靶達成 YY 分..." rows={3}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", resize: "vertical" }} />

                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>任務類型</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["normal", "special"].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                      style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `2px solid ${form.type === t ? "#2563eb" : "#e2e8f0"}`,
                        background: form.type === t ? "#eff6ff" : "white", fontWeight: "700", fontSize: "12px", cursor: "pointer", color: form.type === t ? "#2563eb" : "#64748b" }}>
                      {t === "normal" ? "⚔️ 一般" : "⚡ 緊急（全員通知）"}
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>徽章獎勵（選填）</label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {["", "silver", "gold", "black"].map(b => (
                    <button key={b} onClick={() => setForm(f => ({ ...f, badgeReward: b }))}
                      style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer",
                        border: `2px solid ${form.badgeReward === b ? "#2563eb" : "#e2e8f0"}`,
                        background: form.badgeReward === b ? "#eff6ff" : "white", color: form.badgeReward === b ? "#2563eb" : "#64748b" }}>
                      {b === "" ? "無徽章" : BADGE_LABEL[b]}
                    </button>
                  ))}
                </div>
                {form.badgeReward === "gold" && <div style={{ fontSize: "11px", color: "#b45309" }}>⚠️ 需先持有銀章才能接此任務</div>}
                {form.badgeReward === "black" && <div style={{ fontSize: "11px", color: "#b45309" }}>⚠️ 需先持有金章才能接此任務</div>}

                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700", display: "block", marginBottom: "4px" }}>XP 獎勵</label>
                    <input type="number" value={form.reward.xp} min={0}
                      onChange={e => setForm(f => ({ ...f, reward: { ...f.reward, xp: e.target.value } }))}
                      style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700", display: "block", marginBottom: "4px" }}>金幣獎勵</label>
                    <input type="number" value={form.reward.coins} min={0}
                      onChange={e => setForm(f => ({ ...f, reward: { ...f.reward, coins: e.target.value } }))}
                      style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", boxSizing: "border-box" }} />
                  </div>
                </div>

                {msg && <div style={{ color: "#ef4444", fontSize: "12px", fontWeight: "700" }}>{msg}</div>}
                <button onClick={handlePublish} disabled={busy}
                  style={{ padding: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: "10px", fontWeight: "900", fontSize: "14px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
                  {busy ? "發佈中…" : "確認發佈"}
                </button>
              </div>
            </div>
          )}

          {/* 現有任務列表 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {quests.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: "32px", fontSize: "13px" }}>尚無任務</div>}
            {quests.map(q => (
              <div key={q.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" }}>
                      {q.type === "special" && <span style={{ background: "#fef3c7", color: "#d97706", fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "6px" }}>⚡ 緊急</span>}
                      {q.badgeReward && <span style={{ background: BADGE_COLOR[q.badgeReward] + "22", color: BADGE_COLOR[q.badgeReward] || "#1e293b", fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "6px", border: `1px solid ${BADGE_COLOR[q.badgeReward]}44` }}>{BADGE_LABEL[q.badgeReward]}</span>}
                      <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "6px", fontWeight: "700",
                        background: q.status === "active" ? "#dcfce7" : q.status === "expired" ? "#f1f5f9" : "#fef9c3",
                        color:      q.status === "active" ? "#16a34a" : q.status === "expired" ? "#94a3b8" : "#b45309" }}>
                        {q.status === "active" ? "上架中" : q.status === "expired" ? "已下架" : "草稿"}
                      </span>
                    </div>
                    <div style={{ fontWeight: "800", fontSize: "14px", color: "#1e293b" }}>{q.title}</div>
                    {q.desc && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{q.desc}</div>}
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                      +{q.reward?.xp || 0} XP　+{q.reward?.coins || 0} 金幣
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
                    {q.status === "active"
                      ? <button onClick={() => updateGuildQuestStatus(q.id, "expired")}
                          style={{ padding: "4px 8px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                          下架
                        </button>
                      : <button onClick={() => updateGuildQuestStatus(q.id, "active")}
                          style={{ padding: "4px 8px", background: "#eff6ff", color: "#2563eb", border: "1px solid #93c5fd", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                          上架
                        </button>
                    }
                    <button onClick={() => deleteGuildQuest(q.id)}
                      style={{ padding: "4px 8px", background: "#f1f5f9", color: "#94a3b8", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}>
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 待審核徽章 tab ── */}
      {tab === "review" && (
        <div style={{ padding: "12px" }}>
          {subs.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: "40px", fontSize: "13px" }}>目前沒有待審核的徽章申請</div>}
          {subs.map(s => (
            <div key={s.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px", marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "800", fontSize: "14px", color: "#1e293b", marginBottom: "2px" }}>{s.memberName || s.memberId}</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>任務：{s.questTitle}</div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    申請獎勵：<span style={{ fontWeight: "700", color: BADGE_COLOR[s.badgeReward] }}>{BADGE_LABEL[s.badgeReward]}</span>
                  </div>
                  {s.note && <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", fontStyle: "italic" }}>備註：{s.note}</div>}
                  <div style={{ fontSize: "10px", color: "#cbd5e1", marginTop: "4px" }}>
                    {s.submittedAt?.toDate ? s.submittedAt.toDate().toLocaleString("zh-TW") : ""}
                  </div>
                </div>
              </div>
              {rejectId === s.id ? (
                <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                  <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder="拒絕原因（選填）" style={{ flex: 1, padding: "6px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <button onClick={() => handleReject(s)}
                    style={{ padding: "6px 12px", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>確認拒絕</button>
                  <button onClick={() => setRejectId(null)}
                    style={{ padding: "6px 8px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}>取消</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button onClick={() => handleApprove(s)}
                    style={{ flex: 1, padding: "8px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
                    ✓ 核准發章
                  </button>
                  <button onClick={() => { setRejectId(s.id); setRejectReason(""); }}
                    style={{ padding: "8px 14px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>
                    拒絕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 冒險者排行 tab ── */}
      {tab === "ranks" && (
        <div style={{ padding: "12px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            {RANKS.map((r, i) => {
              const count = members.filter(m => rankIdxFromLevel(levelFromXP(m.adventurerXP || 0)) === i).length;
              return (
                <div key={r.name} style={{ background: r.color + "22", border: `1px solid ${r.color}44`, borderRadius: "8px", padding: "4px 10px", fontSize: "12px", fontWeight: "700" }}>
                  {r.icon} {r.name} <span style={{ color: "#64748b" }}>{count}人</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {members.filter(m => (m.adventurerXP || 0) > 0).map((m, idx) => {
              const xp = m.adventurerXP || 0;
              const level = levelFromXP(xp);
              const rank = rankFromLevel(level);
              const { pct } = xpProgress(xp, level);
              const promoDone = new Set(m.promotionDone || []);
              return (
                <div key={m.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "24px", textAlign: "center", fontSize: "12px", color: "#94a3b8", fontWeight: "700", flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ fontSize: "22px", flexShrink: 0 }}>{rank.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <span style={{ fontWeight: "800", fontSize: "13px", color: "#1e293b" }}>{m.name || m.id}</span>
                      <span style={{ background: rank.color + "22", color: rank.color, fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "10px" }}>Lv.{level} {rank.name}</span>
                    </div>
                    <div style={{ height: "4px", background: "#f1f5f9", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: rank.color, borderRadius: "2px" }} />
                    </div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>{xp.toLocaleString()} XP</div>
                  </div>
                  <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                    {PROMO_LEVELS.filter(lv => lv <= level + 1).map(lv => (
                      <span key={lv} style={{ fontSize: "10px", fontWeight: "700", padding: "1px 4px", borderRadius: "4px",
                        background: promoDone.has(lv) ? "#dcfce7" : "#fef9c3", color: promoDone.has(lv) ? "#16a34a" : "#854d0e" }}>
                        {promoDone.has(lv) ? "✓" : "!"}{lv}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
