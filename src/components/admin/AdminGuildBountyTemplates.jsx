// src/components/admin/AdminGuildBountyTemplates.jsx — 公會後台：每日一般懸賞範本 + 難度獎勵表
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeGuildBountyTemplates, createGuildBountyTemplate, updateGuildBountyTemplate,
  toggleGuildBountyTemplateActive, deleteGuildBountyTemplate,
  subscribeGuildBountyRewards, setGuildBountyRewards, DEFAULT_BOUNTY_REWARDS,
  autoPublishDailyGeneralBounties,
  getDailyGeneralSettings, saveDailyGeneralSettings,
} from "../../lib/db";
import { MONSTERS } from "../../lib/monsterData";

const DIFF_LEVELS = [1, 2, 3, 4];
const DIFF_LABEL   = { 1: "難度 1・★☆☆☆", 2: "難度 2・★★☆☆", 3: "難度 3・★★★☆", 4: "難度 4・★★★★" };
const CHEST_OPTIONS = [
  { value: "wood",  label: "📦 木寶箱" },
  { value: "iron",  label: "🧰 鐵寶箱" },
  { value: "gold",  label: "🎁 黃金寶箱" },
  { value: "epic",  label: "💜 史詩寶箱" },
];

const EMPTY_TPL = { title: "", desc: "", difficulty: 1, requirement: { monsterId: "", killCount: 5 }, active: true };

export default function AdminGuildBountyTemplates() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [rewards, setRewards]     = useState(DEFAULT_BOUNTY_REWARDS);
  const [rewardsForm, setRewardsForm] = useState(null); // null = 顯示模式
  const [rewardsBusy, setRewardsBusy] = useState(false);
  const [rewardsMsg, setRewardsMsg]   = useState("");

  const [form, setForm]         = useState(EMPTY_TPL);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState("");

  const [regenBusy, setRegenBusy] = useState(false);
  const [regenMsg, setRegenMsg]   = useState("");
  const [settings, setSettings]   = useState({ disabledDifficulties: [] });
  const [settingsBusy, setSettingsBusy] = useState(false);

  useEffect(() => {
    const u1 = subscribeGuildBountyTemplates(setTemplates);
    const u2 = subscribeGuildBountyRewards(setRewards);
    getDailyGeneralSettings().then(s => setSettings(s)).catch(() => {});
    return () => { u1?.(); u2?.(); };
  }, []);

  function resetForm() {
    setForm(EMPTY_TPL); setEditId(null); setMsg("");
  }

  async function handleSaveTemplate() {
    if (!form.title.trim()) { setMsg("請輸入任務標題"); return; }
    if (!form.requirement.monsterId) { setMsg("請選擇指定怪物"); return; }
    setBusy(true); setMsg("");
    try {
      if (editId) {
        await updateGuildBountyTemplate(editId, form, profile?.id);
      } else {
        await createGuildBountyTemplate(form, profile?.id);
      }
      setShowForm(false); resetForm();
    } catch (e) {
      setMsg((editId ? "更新" : "新增") + "失敗：" + e.message);
    }
    setBusy(false);
  }

  function handleEdit(t) {
    setForm({
      title: t.title || "",
      desc:  t.desc  || "",
      difficulty: t.difficulty || 1,
      requirement: { monsterId: t.requirement?.monsterId || "", killCount: t.requirement?.killCount || 1 },
      active: t.active !== false,
    });
    setEditId(t.id);
    setShowForm(true);
    setMsg("");
  }

  async function handleSaveRewards() {
    if (!rewardsForm) return;
    setRewardsBusy(true); setRewardsMsg("");
    try {
      await setGuildBountyRewards(rewardsForm, profile?.id);
      setRewardsForm(null);
      setRewardsMsg("✓ 已儲存");
      setTimeout(() => setRewardsMsg(""), 2000);
    } catch (e) { setRewardsMsg("儲存失敗：" + e.message); }
    setRewardsBusy(false);
  }

  async function handleToggleDifficulty(diff) {
    const disabled = settings.disabledDifficulties || [];
    const newDisabled = disabled.includes(diff)
      ? disabled.filter(d => d !== diff)
      : [...disabled, diff];
    const newSettings = { ...settings, disabledDifficulties: newDisabled };
    setSettingsBusy(true);
    try {
      await saveDailyGeneralSettings(newSettings, profile?.id);
      setSettings(newSettings);
    } catch (e) { console.warn("toggle diff:", e?.message); }
    setSettingsBusy(false);
  }

  async function handleRegen() {
    setRegenBusy(true); setRegenMsg("");
    try {
      const res = await autoPublishDailyGeneralBounties();
      if (res.ok) {
        setRegenMsg(res.reason === "already_exists" ? "今日已產生過，未重複發佈" : `✓ 已發佈 ${res.count} 個任務`);
      } else {
        setRegenMsg("失敗：" + res.reason);
      }
    } catch (e) { setRegenMsg("失敗：" + e.message); }
    setRegenBusy(false);
    setTimeout(() => setRegenMsg(""), 4000);
  }

  return (
    <div style={{ padding: "12px" }}>
      {/* ── 立即重新產生今日任務 ── */}
      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "12px 14px", marginBottom: "16px" }}>
        <div style={{ fontWeight: "900", fontSize: "13px", color: "#92400e", marginBottom: "6px" }}>🗡️ 每日一般懸賞（每難度固定抽 1 個任務上架）</div>
        <div style={{ fontSize: "11px", color: "#b45309", marginBottom: "8px" }}>
          會員進入公會頁時自動刷新，同一天不會重複發佈。
          某難度若有啟用中範本 → 從範本抽選；若無範本 → 系統自動從怪物資料生成。
        </div>
        <button onClick={handleRegen} disabled={regenBusy}
          style={{ padding: "8px 14px", background: "#d97706", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer", opacity: regenBusy ? 0.6 : 1 }}>
          {regenBusy ? "處理中…" : "🔄 立即重新產生今日任務"}
        </button>
        {regenMsg && <div style={{ marginTop: "8px", fontSize: "12px", fontWeight: "700", color: "#92400e" }}>{regenMsg}</div>}
      </div>

      {/* ── 難度獎勵表 ── */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <div style={{ fontWeight: "900", fontSize: "14px", color: "#1e293b" }}>💰 難度獎勵表</div>
          {!rewardsForm ? (
            <button onClick={() => setRewardsForm(JSON.parse(JSON.stringify(rewards)))}
              style={{ padding: "6px 14px", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
              編輯設定
            </button>
          ) : (
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => { setRewardsForm(null); setRewardsMsg(""); }}
                style={{ padding: "6px 12px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                取消
              </button>
              <button onClick={handleSaveRewards} disabled={rewardsBusy}
                style={{ padding: "6px 14px", background: "#10b981", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", opacity: rewardsBusy ? 0.5 : 1 }}>
                {rewardsBusy ? "儲存中…" : "儲存"}
              </button>
            </div>
          )}
        </div>
        {rewardsMsg && <div style={{ color: "#10b981", fontSize: "12px", marginBottom: "8px", fontWeight: "700" }}>{rewardsMsg}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {DIFF_LEVELS.map(diff => {
            const cfg = rewardsForm ? rewardsForm[diff] : rewards[diff];
            return (
              <div key={diff} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 14px" }}>
                <div style={{ fontWeight: "900", fontSize: "13px", color: "#7c3aed", marginBottom: "10px" }}>{DIFF_LABEL[diff]}</div>
                {rewardsForm ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {["xp", "coins", "arrowDew", "gachaCoins"].map(field => (
                      <div key={field}>
                        <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", display: "block", marginBottom: "3px" }}>
                          {field === "xp" ? "XP" : field === "coins" ? "金幣" : field === "arrowDew" ? "箭露" : "扭蛋幣"}
                        </label>
                        <input type="number" min={0} value={rewardsForm[diff]?.[field] ?? 0}
                          onChange={e => setRewardsForm(f => ({ ...f, [diff]: { ...f[diff], [field]: Number(e.target.value) } }))}
                          style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px", boxSizing: "border-box" }} />
                      </div>
                    ))}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", display: "block", marginBottom: "3px" }}>寶箱類型</label>
                      <select value={rewardsForm[diff]?.chestType || "wood"}
                        onChange={e => setRewardsForm(f => ({ ...f, [diff]: { ...f[diff], chestType: e.target.value } }))}
                        style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                        {CHEST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", color: "#475569" }}>⚔️ {cfg?.xp} XP</span>
                    <span style={{ fontSize: "12px", color: "#475569" }}>🪙 {cfg?.coins} 金幣</span>
                    <span style={{ fontSize: "12px", color: "#475569" }}>💧 {cfg?.arrowDew} 箭露</span>
                    <span style={{ fontSize: "12px", color: "#475569" }}>🎰 {cfg?.gachaCoins} 扭蛋幣</span>
                    <span style={{ fontSize: "12px", color: "#7c3aed", fontWeight: "700" }}>
                      {CHEST_OPTIONS.find(o => o.value === cfg?.chestType)?.label || cfg?.chestType}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 任務範本池 ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ fontWeight: "900", fontSize: "14px", color: "#1e293b" }}>📜 任務範本池</div>
        <button onClick={() => { setShowForm(v => !v); if (showForm) resetForm(); }}
          style={{ padding: "6px 14px", background: editId ? "#7c3aed" : "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
          {showForm ? (editId ? "▲ 取消編輯" : "▲ 收起") : "+ 新增範本"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>任務標題 *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="例如：森林異變討伐令" style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px" }} />

            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>任務說明</label>
            <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
              placeholder="擊殺 {monster} {count} 隻，協助公會清剿威脅。" rows={2}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", resize: "vertical" }} />

            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>所屬難度</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {DIFF_LEVELS.map(d => (
                <button key={d} onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                  style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `2px solid ${form.difficulty === d ? "#7c3aed" : "#e2e8f0"}`,
                    background: form.difficulty === d ? "#f5f3ff" : "white", fontWeight: "700", fontSize: "12px", cursor: "pointer",
                    color: form.difficulty === d ? "#7c3aed" : "#64748b" }}>
                  {d}
                </button>
              ))}
            </div>

            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>指定怪物 *</label>
            <select value={form.requirement.monsterId} onChange={e => setForm(f => ({ ...f, requirement: { ...f.requirement, monsterId: e.target.value } }))}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
              <option value="">— 請選擇 —</option>
              {MONSTERS.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}（{m.family}/{m.tier}）</option>)}
            </select>

            <label style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>需擊殺次數</label>
            <input type="number" min={1} value={form.requirement.killCount || ""} placeholder="例如：5"
              onChange={e => setForm(f => ({ ...f, requirement: { ...f.requirement, killCount: Number(e.target.value) } }))}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }} />

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#64748b", fontWeight: "700" }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              啟用（會出現在每日抽選池中）
            </label>

            {msg && <div style={{ color: "#ef4444", fontSize: "12px", fontWeight: "700" }}>{msg}</div>}
            <button onClick={handleSaveTemplate} disabled={busy}
              style={{ padding: "12px", background: editId ? "#7c3aed" : "#2563eb", color: "white", border: "none", borderRadius: "10px", fontWeight: "900", fontSize: "14px", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
              {busy ? (editId ? "更新中…" : "新增中…") : (editId ? "✏️ 確認更新" : "確認新增")}
            </button>
          </div>
        </div>
      )}

      {DIFF_LEVELS.map(diff => {
        const list = templates.filter(t => (t.difficulty || 1) === diff);
        const activeCount = list.filter(t => t.active !== false).length;
        const isAutoMode = activeCount === 0;
        const isDisabled = (settings.disabledDifficulties || []).includes(diff);
        return (
          <div key={diff} style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", fontWeight: "900", color: isDisabled ? "#94a3b8" : "#7c3aed" }}>{DIFF_LABEL[diff]}</span>
              {isDisabled ? (
                <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px",
                  background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}>
                  🔴 已關閉
                </span>
              ) : isAutoMode ? (
                <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px",
                  background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" }}>
                  🤖 自動生成
                </span>
              ) : (
                <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "10px",
                  background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac" }}>
                  📋 範本模式（{activeCount} 個啟用中）
                </span>
              )}
              <button onClick={() => handleToggleDifficulty(diff)} disabled={settingsBusy}
                style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: "700", cursor: "pointer",
                  background: isDisabled ? "#dcfce7" : "#fef2f2",
                  color: isDisabled ? "#16a34a" : "#dc2626",
                  border: isDisabled ? "1px solid #86efac" : "1px solid #fca5a5",
                  opacity: settingsBusy ? 0.5 : 1 }}>
                {isDisabled ? "開啟" : "關閉"}
              </button>
            </div>
            {list.length === 0 && (
              <div style={{ color: "#94a3b8", fontSize: "12px", padding: "8px 0", fontStyle: "italic" }}>
                🤖 無範本，每日自動從怪物資料生成
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {list.map(t => {
                const m = MONSTERS.find(x => x.id === t.requirement?.monsterId);
                return (
                  <div key={t.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 14px", opacity: t.active === false ? 0.55 : 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "6px", fontWeight: "700",
                            background: t.active === false ? "#f1f5f9" : "#dcfce7", color: t.active === false ? "#94a3b8" : "#16a34a" }}>
                            {t.active === false ? "已停用" : "啟用中"}
                          </span>
                        </div>
                        <div style={{ fontWeight: "800", fontSize: "14px", color: "#1e293b" }}>{t.title}</div>
                        {t.desc && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{t.desc}</div>}
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                          {m ? `${m.icon} ${m.name}` : t.requirement?.monsterId} × {t.requirement?.killCount || 1}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
                        <button onClick={() => handleEdit(t)}
                          style={{ padding: "4px 8px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                          ✏️ 編輯
                        </button>
                        <button onClick={() => toggleGuildBountyTemplateActive(t.id, t.active === false, profile?.id)}
                          style={{ padding: "4px 8px", background: t.active === false ? "#eff6ff" : "#fef2f2", color: t.active === false ? "#2563eb" : "#dc2626",
                            border: `1px solid ${t.active === false ? "#93c5fd" : "#fca5a5"}`, borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                          {t.active === false ? "啟用" : "停用"}
                        </button>
                        <button onClick={() => deleteGuildBountyTemplate(t.id)}
                          style={{ padding: "4px 8px", background: "#f1f5f9", color: "#94a3b8", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}>
                          刪除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
