// src/components/admin/AdminStoryManager.jsx — 故事本章節管理後台
import { useState, useEffect } from "react";
import { STORY_CHAPTERS } from "../../lib/storyData";
import { subscribeStoryChapterConfigs, saveStoryChapterConfig } from "../../lib/storyDb";
import { AUTO_ACHIEVEMENTS } from "../../lib/achievementDex";

const UNLOCK_TYPES = [
  { id: "open",        label: "強制開放", color: "#22c55e" },
  { id: "achievement", label: "依成就判斷", color: "#f59e0b" },
  { id: "locked",      label: "強制鎖定", color: "#ef4444" },
];

// 成就選項（只取常用的前幾類）
const ACH_OPTIONS = AUTO_ACHIEVEMENTS.map(a => ({ id: a.id, label: `[${a.cat}] ${a.name} — ${a.desc}` }));

export default function AdminStoryManager() {
  const [configs, setConfigs] = useState({});
  const [editing, setEditing] = useState(null); // chapter key
  const [form,    setForm]    = useState({});
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState("");

  useEffect(() => {
    const unsub = subscribeStoryChapterConfigs(setConfigs);
    return () => unsub();
  }, []);

  function openEdit(ch) {
    const cfg = configs[ch.key] || {};
    setForm({
      unlockType:           cfg.unlockType           || (ch.key === "ch0" ? "open" : "locked"),
      requiredAchievements: cfg.requiredAchievements || [],
      hintText:             cfg.hintText             || "",
    });
    setEditing(ch.key);
  }

  async function handleSave() {
    if (!editing) return;
    setBusy(true); setMsg("");
    const res = await saveStoryChapterConfig(editing, form);
    setMsg(res.ok ? "✅ 儲存成功" : `❌ 儲存失敗：${res.reason}`);
    setBusy(false);
    if (res.ok) setTimeout(() => { setEditing(null); setMsg(""); }, 1000);
  }

  function toggleAchievement(achId) {
    setForm(f => ({
      ...f,
      requiredAchievements: f.requiredAchievements.includes(achId)
        ? f.requiredAchievements.filter(a => a !== achId)
        : [...f.requiredAchievements, achId],
    }));
  }

  function getStatus(ch) {
    if (ch.key === "ch0") return { type: "open", label: "永遠開放" };
    const cfg = configs[ch.key];
    if (!cfg) return { type: "locked", label: "尚未設定（鎖定）" };
    const t = UNLOCK_TYPES.find(u => u.id === cfg.unlockType);
    return { type: cfg.unlockType, label: t?.label || cfg.unlockType };
  }

  return (
    <div style={{ padding: "16px", maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontWeight: 900, fontSize: 20, color: "#1e293b", marginBottom: 4 }}>📖 故事本管理</h2>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>設定各章節解鎖條件，未設定的章節預設鎖定。</p>

      {/* 章節列表 */}
      {STORY_CHAPTERS.map(ch => {
        const status = getStatus(ch);
        const colorMap = { open: "#22c55e", locked: "#ef4444", achievement: "#f59e0b" };
        return (
          <div key={ch.key} style={{
            background: "white", border: "1px solid #e2e8f0", borderRadius: 16,
            padding: "14px 16px", marginBottom: 10,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 2 }}>{ch.label}</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>{ch.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colorMap[status.type] || "#94a3b8" }}/>
                <span style={{ fontSize: 11, color: colorMap[status.type] || "#94a3b8", fontWeight: 700 }}>{status.label}</span>
                {configs[ch.key]?.hintText && (
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>・{configs[ch.key].hintText}</span>
                )}
              </div>
            </div>
            {ch.key !== "ch0" && (
              <button onClick={() => openEdit(ch)}
                style={{ padding: "8px 16px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#475569", cursor: "pointer", flexShrink: 0 }}>
                設定
              </button>
            )}
          </div>
        );
      })}

      {/* 編輯 Modal */}
      {editing && (() => {
        const ch = STORY_CHAPTERS.find(c => c.key === editing);
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => { setEditing(null); setMsg(""); }}>
            <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", paddingBottom: 40 }}
              onClick={e => e.stopPropagation()}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{ch?.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b" }}>{ch?.title}</div>
                </div>
                <button onClick={() => { setEditing(null); setMsg(""); }}
                  style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>

              {/* 解鎖類型 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>解鎖條件類型</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {UNLOCK_TYPES.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, unlockType: t.id }))}
                      style={{
                        flex: 1, padding: "10px 4px", borderRadius: 10, border: `2px solid ${form.unlockType === t.id ? t.color : "#e2e8f0"}`,
                        background: form.unlockType === t.id ? t.color + "15" : "white",
                        color: form.unlockType === t.id ? t.color : "#94a3b8",
                        fontWeight: 900, fontSize: 11, cursor: "pointer",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 成就列表（依成就才顯示）*/}
              {form.unlockType === "achievement" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                    需完成以下成就（勾選一或多個）
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, padding: 8 }}>
                    {ACH_OPTIONS.slice(0, 60).map(a => (
                      <label key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 4px", cursor: "pointer" }}>
                        <input type="checkbox"
                          checked={form.requiredAchievements.includes(a.id)}
                          onChange={() => toggleAchievement(a.id)}
                          style={{ marginTop: 2, flexShrink: 0 }}
                        />
                        <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{a.label}</span>
                      </label>
                    ))}
                  </div>
                  {form.requiredAchievements.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>
                      已選：{form.requiredAchievements.join("、")}
                    </div>
                  )}
                </div>
              )}

              {/* 提示文字 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>提示文字（顯示給未解鎖的玩家）</div>
                <input
                  value={form.hintText}
                  onChange={e => setForm(f => ({ ...f, hintText: e.target.value }))}
                  placeholder="例：在射箭場完成 10 次練習即可解鎖"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}
                />
              </div>

              {msg && (
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: msg.startsWith("✅") ? "#dcfce7" : "#fee2e2",
                  color: msg.startsWith("✅") ? "#166534" : "#991b1b",
                }}>{msg}</div>
              )}

              <button onClick={handleSave} disabled={busy}
                style={{ width: "100%", padding: 14, background: "#7c3aed", color: "white", border: "none", borderRadius: 14, fontWeight: 900, fontSize: 15, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "儲存中…" : "💾 儲存設定"}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
