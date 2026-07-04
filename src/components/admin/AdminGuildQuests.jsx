// src/components/admin/AdminGuildQuests.jsx — 公會後台：任務發佈 + 徽章審核 + 排行
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeAllGuildQuests, publishGuildQuest, updateGuildQuest, updateGuildQuestStatus, deleteGuildQuest,
  subscribeGuildSubmissions, approveGuildSubmission, rejectGuildSubmission,
  subscribeCoachChallenges, resolveCoachChallenge,
  getMembers, subscribeActiveGuildQuests,
  subscribePromotionQuestConfig, savePromotionQuestConfig, PROMO_QUEST_DEFAULTS,
} from "../../lib/db";
import { MONSTERS } from "../../lib/monsterData";
import { levelFromXP, rankFromLevel, rankIdxFromLevel, xpProgress, RANKS } from "../../lib/adventurerSystem";
import AdminGuildBountyTemplates from "./AdminGuildBountyTemplates";

const BADGE_LABEL = { silver: "🥈 銀章", gold: "🥇 金章", black: "⬛ 黑章" };
const BADGE_COLOR = { silver: "#94a3b8", gold: "#fbbf24", black: "#1e293b" };
const PROMO_LABEL  = { 10:"Lv10 青銅→白銀", 20:"Lv20 白銀→黃金", 30:"Lv30 黃金→白金", 40:"Lv40 白金→傳說", 50:"Lv50 傳說→神話" };
const PROMO_LEVELS = [10, 20, 30, 40, 50];

const SUBTYPE_LABEL = {
  general:      "📋 一般",
  kill_monster: "⚔️ 打指定怪",
  shoot_score:  "🎯 射分數",
  hit_target:   "🏹 命中率",
  coach_duel:   "🥊 教練挑戰賽",
};

const EMPTY_FORM = {
  title: "", desc: "", type: "normal",
  badgeReward: "", prerequisiteQuestId: "",
  reward: { xp: 100, coins: 50 },
  questSubtype: "general",
  requirement: {},
  deadline: "",
};

function deadlineDisplay(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const diff = d - Date.now();
  if (diff < 0) return { expired: true, label: "已到期" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 48) return { expired: false, label: `${Math.floor(h / 24)} 天後截止` };
  if (h > 0)   return { expired: false, label: `${h}h${m}m 後截止` };
  return { expired: false, label: `${m} 分鐘後截止` };
}

export default function AdminGuildQuests({ defaultTab = "quests" }) {
  const { profile } = useAuth();
  const [tab, setTab]           = useState(defaultTab);
  const [quests, setQuests]     = useState([]);
  const [subs, setSubs]         = useState([]);
  const [members, setMembers]   = useState([]);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState("");
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [challenges, setChallenges] = useState([]);
  const [activeQuests, setActiveQuests] = useState([]);
  const [promoConfig, setPromoConfig] = useState(PROMO_QUEST_DEFAULTS);
  const [promoForm, setPromoForm] = useState(null); // null = 顯示模式，object = 編輯中
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState("");

  useEffect(() => {
    const u1 = subscribeAllGuildQuests(setQuests);
    const u2 = subscribeGuildSubmissions(setSubs);
    const u3 = subscribeCoachChallenges(setChallenges);
    const u4 = subscribeActiveGuildQuests(setActiveQuests);
    const u5 = subscribePromotionQuestConfig(setPromoConfig);
    getMembers().then(list => setMembers([...list].sort((a, b) => (b.adventurerXP || 0) - (a.adventurerXP || 0))));
    return () => { u1?.(); u2?.(); u3?.(); u4?.(); u5?.(); };
  }, []);

  async function handlePublish() {
    if (!form.title.trim()) { setMsg("請輸入任務名稱"); return; }
    setBusy(true); setMsg("");
    const data = {
      ...form,
      badgeReward:         form.badgeReward         || null,
      prerequisiteQuestId: form.prerequisiteQuestId || null,
      deadline:            form.deadline            || null,
      reward: { xp: Number(form.reward.xp) || 0, coins: Number(form.reward.coins) || 0 },
    };
    try {
      if (editId) {
        await updateGuildQuest(editId, data, profile?.id);
      } else {
        await publishGuildQuest(data, profile?.id);
      }
      setForm(EMPTY_FORM); setShowForm(false); setEditId(null);
    } catch(e) {
      setMsg((editId ? "更新" : "發佈") + "失敗：" + e.message);
    }
    setBusy(false);
  }

  function handleEdit(q) {
    setForm({
      title: q.title || "",
      desc:  q.desc  || "",
      type:  q.type  || "normal",
      badgeReward:         q.badgeReward         || "",
      prerequisiteQuestId: q.prerequisiteQuestId || "",
      reward: { xp: q.reward?.xp ?? 100, coins: q.reward?.coins ?? 50 },
      questSubtype: q.questSubtype || "general",
      requirement:  q.requirement  || {},
      deadline: q.deadline || "",
    });
    setEditId(q.id);
    setShowForm(true);
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleApprove(sub) {
    await approveGuildSubmission(sub.id, sub, profile?.id);
  }
  async function handleReject(sub) {
    await rejectGuildSubmission(sub.id, sub, rejectReason, profile?.id);
    setRejectId(null); setRejectReason("");
  }

  async function handleSavePromoConfig() {
    if (!promoForm) return;
    setPromoBusy(true); setPromoMsg("");
    try {
      await savePromotionQuestConfig(promoForm, profile?.id);
      setPromoForm(null);
      setPromoMsg("✓ 已儲存");
      setTimeout(() => setPromoMsg(""), 2000);
    } catch(e) { setPromoMsg("儲存失敗：" + e.message); }
    setPromoBusy(false);
  }

  const TABS = [
    { id: "quests",     label: "📋 任務發佈",   badge: 0 },
    { id: "review",     label: "🎖️ 待審徽章",   badge: subs.length },
    { id: "challenges", label: "🥊 挑戰申請",   badge: challenges.length },
    { id: "promo",      label: "⚔️ 晉階設定",   badge: 0 },
    { id: "bounty",     label: "🗡️ 每日懸賞",   badge: 0 },
    { id: "ranks",      label: "🏆 排行",        badge: 0 },
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
          <button onClick={() => { setShowForm(v => !v); if (showForm) { setEditId(null); setForm(EMPTY_FORM); } }}
            style={{ width: "100%", padding: "10px", background: editId ? "#7c3aed" : "#2563eb", color: "white", border: "none", borderRadius: "10px", fontWeight: "900", fontSize: "14px", cursor: "pointer", marginBottom: "12px" }}>
            {showForm ? (editId ? "▲ 取消編輯" : "▲ 收起") : "+ 發佈新任務"}
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

                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>懸賞類型</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {Object.entries(SUBTYPE_LABEL).map(([k, v]) => (
                    <button key={k} onClick={() => setForm(f => ({ ...f, questSubtype: k, requirement: {} }))}
                      style={{ padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", cursor: "pointer",
                        border: `2px solid ${form.questSubtype === k ? "#7c3aed" : "#e2e8f0"}`,
                        background: form.questSubtype === k ? "#f5f3ff" : "white",
                        color: form.questSubtype === k ? "#7c3aed" : "#64748b" }}>
                      {v}
                    </button>
                  ))}
                </div>

                {/* 子類型條件欄位 */}
                {form.questSubtype === "kill_monster" && (
                  <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "11px", color: "#7c3aed", fontWeight: "700" }}>指定怪物</label>
                    <select value={form.requirement.monsterId || ""} onChange={e => setForm(f => ({ ...f, requirement: { ...f.requirement, monsterId: e.target.value } }))}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #e9d5ff", fontSize: "13px" }}>
                      <option value="">— 請選擇 —</option>
                      {MONSTERS.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}（{m.family}/{m.tier}）</option>)}
                    </select>
                    <label style={{ fontSize: "11px", color: "#7c3aed", fontWeight: "700" }}>需擊殺次數</label>
                    <input type="number" min={1} value={form.requirement.killCount || ""} placeholder="例如：3"
                      onChange={e => setForm(f => ({ ...f, requirement: { ...f.requirement, killCount: Number(e.target.value) } }))}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #e9d5ff", fontSize: "13px" }} />
                  </div>
                )}

                {form.questSubtype === "shoot_score" && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "11px", color: "#16a34a", fontWeight: "700" }}>靶紙距離</label>
                    <select value={form.requirement.distance || ""} onChange={e => setForm(f => ({ ...f, requirement: { ...f.requirement, distance: e.target.value } }))}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #bbf7d0", fontSize: "13px" }}>
                      <option value="">— 請選擇 —</option>
                      {["5", "7", "10", "13.5", "15", "18"].map(d => <option key={d} value={d}>{d} 公尺</option>)}
                    </select>
                    <div style={{ fontSize: "11px", color: "#16a34a" }}>箭數：<b>固定 6 支</b></div>
                    <label style={{ fontSize: "11px", color: "#16a34a", fontWeight: "700" }}>需達到總分（滿分 60）</label>
                    <input type="number" min={1} max={60} value={form.requirement.minScore || ""} placeholder="例如：50"
                      onChange={e => setForm(f => ({ ...f, requirement: { ...f.requirement, minScore: Number(e.target.value), arrowCount: 6 } }))}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #bbf7d0", fontSize: "13px" }} />
                  </div>
                )}

                {form.questSubtype === "hit_target" && (
                  <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "11px", color: "#ea580c", fontWeight: "700" }}>靶紙距離</label>
                    <select value={form.requirement.distance || ""} onChange={e => setForm(f => ({ ...f, requirement: { ...f.requirement, distance: e.target.value } }))}
                      style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #fed7aa", fontSize: "13px" }}>
                      <option value="">— 請選擇 —</option>
                      {["5", "7", "10", "13.5", "15", "18"].map(d => <option key={d} value={d}>{d} 公尺</option>)}
                    </select>
                    <div style={{ fontSize: "11px", color: "#ea580c" }}>箭數：<b>固定 6 支</b></div>
                    <label style={{ fontSize: "11px", color: "#ea580c", fontWeight: "700" }}>命中條件（二擇一）</label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[{ key: "hitCount", label: "命中幾支" }, { key: "minScorePerArrow", label: "每支達幾分" }].map(opt => (
                        <button key={opt.key} type="button"
                          onClick={() => setForm(f => ({ ...f, requirement: { distance: f.requirement.distance, arrowCount: 6, hitMode: opt.key } }))}
                          style={{ flex: 1, padding: "6px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer",
                            border: `2px solid ${form.requirement.hitMode === opt.key ? "#ea580c" : "#fed7aa"}`,
                            background: form.requirement.hitMode === opt.key ? "#fff7ed" : "white",
                            color: form.requirement.hitMode === opt.key ? "#ea580c" : "#9a3412" }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {form.requirement.hitMode === "hitCount" && (
                      <>
                        <label style={{ fontSize: "11px", color: "#ea580c", fontWeight: "700" }}>6 支中需命中幾支</label>
                        <input type="number" min={1} max={6} value={form.requirement.hitCount || ""} placeholder="例如：5"
                          onChange={e => setForm(f => ({ ...f, requirement: { ...f.requirement, hitCount: Number(e.target.value) } }))}
                          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #fed7aa", fontSize: "13px" }} />
                      </>
                    )}
                    {form.requirement.hitMode === "minScorePerArrow" && (
                      <>
                        <label style={{ fontSize: "11px", color: "#ea580c", fontWeight: "700" }}>每支需命中幾分以上</label>
                        <input type="number" min={1} max={10} value={form.requirement.minScorePerArrow || ""} placeholder="例如：8"
                          onChange={e => setForm(f => ({ ...f, requirement: { ...f.requirement, minScorePerArrow: Number(e.target.value) } }))}
                          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #fed7aa", fontSize: "13px" }} />
                      </>
                    )}
                  </div>
                )}

                {form.questSubtype === "coach_duel" && (
                  <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "8px", padding: "10px" }}>
                    <div style={{ fontSize: "11px", color: "#be123c", fontWeight: "700" }}>🥊 射手需線下找教練進行決鬥，勝出後教練在「挑戰申請」tab 確認完成</div>
                  </div>
                )}

                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>
                  徽章獎勵（選填）
                  {form.badgeReward && <span style={{ marginLeft: 8, color: "#2563eb", fontWeight: "900" }}>✓ 已選：{BADGE_LABEL[form.badgeReward]}</span>}
                </label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {["", "silver", "gold", "black"].map(b => (
                    <button key={b} type="button" onClick={() => setForm(f => ({ ...f, badgeReward: b }))}
                      style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer",
                        border: `2px solid ${form.badgeReward === b ? "#2563eb" : "#e2e8f0"}`,
                        background: form.badgeReward === b ? "#eff6ff" : "white", color: form.badgeReward === b ? "#2563eb" : "#64748b" }}>
                      {b === "" ? "無徽章" : BADGE_LABEL[b]}
                    </button>
                  ))}
                </div>
                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700", marginTop: "4px" }}>
                  🔗 前置任務（串聯解鎖，選填）
                </label>
                <select value={form.prerequisiteQuestId}
                  onChange={e => setForm(f => ({ ...f, prerequisiteQuestId: e.target.value }))}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                  <option value="">— 無前置任務（獨立任務）—</option>
                  {activeQuests.map(q => (
                    <option key={q.id} value={q.id}>{q.badgeReward ? `${BADGE_LABEL[q.badgeReward]} · ` : ""}{q.title}</option>
                  ))}
                </select>
                {form.prerequisiteQuestId && (
                  <div style={{ fontSize: "11px", color: "#2563eb", background: "#eff6ff", padding: "6px 10px", borderRadius: "6px" }}>
                    🔒 射手需先完成「{activeQuests.find(q => q.id === form.prerequisiteQuestId)?.title || form.prerequisiteQuestId}」才能解鎖此任務
                  </div>
                )}

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

                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700", marginTop: "4px" }}>
                  ⏰ 截止時間（選填，到時自動顯示已到期）
                </label>
                <input type="datetime-local" value={form.deadline}
                  onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", colorScheme: "light" }} />
                {form.deadline && (
                  <div style={{ fontSize: "11px", color: "#2563eb", background: "#eff6ff", padding: "6px 10px", borderRadius: "6px" }}>
                    截止：{new Date(form.deadline).toLocaleString("zh-TW")}
                    <button type="button" onClick={() => setForm(f => ({ ...f, deadline: "" }))}
                      style={{ marginLeft: "10px", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", fontSize: "11px" }}>
                      ✕ 清除
                    </button>
                  </div>
                )}

                {msg && <div style={{ color: "#ef4444", fontSize: "12px", fontWeight: "700" }}>{msg}</div>}
                <button onClick={handlePublish} disabled={busy}
                  style={{ padding: "12px", background: editId ? "#7c3aed" : "#2563eb", color: "white", border: "none", borderRadius: "10px", fontWeight: "900", fontSize: "14px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
                  {busy ? (editId ? "更新中…" : "發佈中…") : (editId ? "✏️ 確認更新" : "確認發佈")}
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
                      {q.questSubtype && q.questSubtype !== "general" && <span style={{ background: "#f5f3ff", color: "#7c3aed", fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "6px" }}>{SUBTYPE_LABEL[q.questSubtype]}</span>}
                      {q.badgeReward && <span style={{ background: BADGE_COLOR[q.badgeReward] + "22", color: BADGE_COLOR[q.badgeReward] || "#1e293b", fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "6px", border: `1px solid ${BADGE_COLOR[q.badgeReward]}44` }}>{BADGE_LABEL[q.badgeReward]}</span>}
                      {q.prerequisiteQuestId && <span style={{ background: "#eff6ff", color: "#2563eb", fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "6px" }}>🔗 串聯</span>}
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
                    {q.deadline && (() => {
                      const dl = deadlineDisplay(q.deadline);
                      return dl ? (
                        <div style={{ fontSize: "11px", marginTop: "3px", fontWeight: "700",
                          color: dl.expired ? "#94a3b8" : "#d97706",
                          background: dl.expired ? "#f1f5f9" : "#fffbeb",
                          padding: "2px 6px", borderRadius: "4px", display: "inline-block" }}>
                          ⏰ {dl.label}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
                    <button onClick={() => { handleEdit(q); setTab("quests"); }}
                      style={{ padding: "4px 8px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                      ✏️ 編輯
                    </button>
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

      {/* ── 教練挑戰申請 tab ── */}
      {tab === "challenges" && (
        <div style={{ padding: "12px" }}>
          {challenges.length === 0 && (
            <div style={{ color: "#94a3b8", textAlign: "center", padding: "40px", fontSize: "13px" }}>
              目前沒有待處理的挑戰申請
            </div>
          )}
          {challenges.map(c => (
            <div key={c.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px", marginBottom: "10px" }}>
              <div style={{ fontWeight: "800", fontSize: "14px", color: "#1e293b", marginBottom: "4px" }}>
                🥊 {c.memberName || c.memberId}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "2px" }}>任務：{c.questTitle}</div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "10px" }}>
                獎勵：+{c.reward?.xp || 0} XP　+{c.reward?.coins || 0} 金幣
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => resolveCoachChallenge(c.id, true, profile?.id, c)}
                  style={{ flex: 1, padding: "8px", background: "#16a34a", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
                  ✓ 射手勝出
                </button>
                <button onClick={() => resolveCoachChallenge(c.id, false, profile?.id, c)}
                  style={{ padding: "8px 14px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>
                  ✗ 未勝出
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 晉階設定 tab ── */}
      {tab === "promo" && (
        <div style={{ padding: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ fontWeight: "900", fontSize: "14px", color: "#1e293b" }}>⚔️ 晉階任務設定</div>
            {!promoForm ? (
              <button onClick={() => setPromoForm(JSON.parse(JSON.stringify(promoConfig)))}
                style={{ padding: "6px 14px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                編輯設定
              </button>
            ) : (
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => { setPromoForm(null); setPromoMsg(""); }}
                  style={{ padding: "6px 12px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                  取消
                </button>
                <button onClick={handleSavePromoConfig} disabled={promoBusy}
                  style={{ padding: "6px 14px", background: "#10b981", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", opacity: promoBusy ? 0.5 : 1 }}>
                  {promoBusy ? "儲存中…" : "儲存"}
                </button>
              </div>
            )}
          </div>
          {promoMsg && <div style={{ color: "#10b981", fontSize: "12px", marginBottom: "8px", fontWeight: "700" }}>{promoMsg}</div>}
          <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "12px" }}>
            射手到達晉階等級後，需完成原野射箭任務才能繼續累積 XP。以下設定各晉階的條件與獎勵。
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[10, 20, 30, 40, 50].map(lv => {
              const cfg = promoForm ? promoForm[lv] : promoConfig[lv];
              return (
                <div key={lv} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 14px" }}>
                  <div style={{ fontWeight: "900", fontSize: "13px", color: "#7c3aed", marginBottom: "10px" }}>{PROMO_LABEL[lv]}</div>
                  {promoForm ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div>
                        <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", display: "block", marginBottom: "3px" }}>距離（公尺）</label>
                        <select value={promoForm[lv]?.dist || ""} onChange={e => setPromoForm(f => ({ ...f, [lv]: { ...f[lv], dist: e.target.value } }))}
                          style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                          {["5","7","8","10","13","13.5","15","18"].map(d => <option key={d} value={d}>{d} 公尺</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", display: "block", marginBottom: "3px" }}>箭數</label>
                        <input type="number" min={1} max={12} value={promoForm[lv]?.arrowCount || 6}
                          onChange={e => setPromoForm(f => ({ ...f, [lv]: { ...f[lv], arrowCount: Number(e.target.value) } }))}
                          style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", display: "block", marginBottom: "3px" }}>通過門檻（總分）</label>
                        <input type="number" min={1} value={promoForm[lv]?.goal || ""}
                          onChange={e => setPromoForm(f => ({ ...f, [lv]: { ...f[lv], goal: Number(e.target.value) } }))}
                          style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", display: "block", marginBottom: "3px" }}>晉階 XP 獎勵</label>
                        <input type="number" min={0} value={promoForm[lv]?.bonusXP || ""}
                          onChange={e => setPromoForm(f => ({ ...f, [lv]: { ...f[lv], bonusXP: Number(e.target.value) } }))}
                          style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px", boxSizing: "border-box" }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "#475569" }}>📍 {cfg?.dist} 公尺</span>
                      <span style={{ fontSize: "12px", color: "#475569" }}>🏹 {cfg?.arrowCount} 箭</span>
                      <span style={{ fontSize: "12px", color: "#475569" }}>🎯 ≥ {cfg?.goal} 分</span>
                      <span style={{ fontSize: "12px", color: "#7c3aed", fontWeight: "700" }}>+{cfg?.bonusXP} XP 晉階獎勵</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 每日一般懸賞 tab ── */}
      {tab === "bounty" && <AdminGuildBountyTemplates />}

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
