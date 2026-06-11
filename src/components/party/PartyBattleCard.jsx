// src/components/party/PartyBattleCard.jsx — 組隊打怪戰績分享小卡
import { useState, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { updateMember } from "../../lib/db";

const PARTY_THEMES = [
  {
    id: "squad_dark", label: "戰隊暗黑",
    bg: "linear-gradient(160deg,#0f0c29,#302b63 50%,#24243e)",
    accent: "#a78bfa", sub: "#c4b5fd", border: "rgba(167,139,250,.55)",
  },
  {
    id: "squad_fire", label: "烈火突擊",
    bg: "linear-gradient(160deg,#1a0000,#7f1d1d 45%,#b45309)",
    accent: "#fbbf24", sub: "#fed7aa", border: "rgba(251,191,36,.55)",
  },
  {
    id: "squad_ocean", label: "深海艦隊",
    bg: "linear-gradient(160deg,#0c1445,#1e3a8a 45%,#0e7490)",
    accent: "#7dd3fc", sub: "#bae6fd", border: "rgba(125,211,252,.55)",
  },
  {
    id: "squad_forest", label: "原野獵人",
    bg: "linear-gradient(160deg,#052e16,#166534 45%,#65a30d)",
    accent: "#86efac", sub: "#bbf7d0", border: "rgba(134,239,172,.55)",
  },
];

async function ensureH2C() {
  if (window.html2canvas) return window.html2canvas;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  return window.html2canvas;
}

export default function PartyBattleCard({ onClose, partyData }) {
  const { profile } = useAuth();
  const cardRef  = useRef(null);
  const [busy, setBusy]         = useState(false);
  const [msg, setMsg]           = useState("");
  const [themeIdx, setThemeIdx] = useState(0);
  const [slogan, setSlogan]     = useState(profile?.shareSlogan || "#貓小隊射箭場");

  const theme  = PARTY_THEMES[themeIdx];
  const { monster, statsList = [], mvpId, result, rounds = 0 } = partyData || {};
  const won    = result === "win";
  const today  = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
  const totalTeamDmg = statsList.reduce((s, m) => s + (m.dmgDealt || 0), 0);

  async function generate(action) {
    setBusy(true); setMsg("");
    try {
      if (profile?.id) {
        try { await updateMember(profile.id, { shareSlogan: slogan }, profile.id); } catch {}
      }
      const h2c    = await ensureH2C();
      const canvas = await h2c(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true, logging: false });
      const blob   = await new Promise(r => canvas.toBlob(r, "image/png", 0.95));
      const fname  = `組隊打怪_${today.replace(/\//g, "-")}.png`;
      const file   = new File([blob], fname, { type: "image/png" });
      if (action === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "貓小隊射箭場 組隊打怪模式戰績" });
        setMsg("已開啟分享");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = fname; a.click();
        URL.revokeObjectURL(url);
        setMsg("✅ 已儲存，可分享到 IG / FB");
      }
    } catch (e) { setMsg("生成失敗：" + (e?.message || "")); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex flex-col items-center justify-start p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="w-full max-w-[320px] flex flex-col gap-3 my-4" onClick={e => e.stopPropagation()}>

        {/* ── 卡片本體 ─────────────────────────────────── */}
        <div ref={cardRef} style={{
          width: "100%", borderRadius: 20, overflow: "hidden",
          position: "relative", color: "white", background: theme.bg,
          fontFamily: "'Segoe UI', 'PingFang TC', sans-serif",
          padding: "22px 18px", boxSizing: "border-box",
        }}>
          {/* 光芒裝飾 */}
          <div style={{
            position: "absolute", left: "50%", top: "30%",
            width: 420, height: 420, marginLeft: -210, marginTop: -210,
            opacity: .09, borderRadius: "9999px",
            background: "conic-gradient(from 0deg,transparent 0 8deg,rgba(255,255,255,.9) 8deg 10deg,transparent 10deg 25deg,rgba(255,255,255,.7) 25deg 27deg,transparent 27deg)",
          }} />

          <div style={{ position: "relative" }}>

            {/* 頂部標題 */}
            <div style={{ fontSize: 9, letterSpacing: 3, color: theme.sub, fontWeight: 900, marginBottom: 2 }}>
              🐱 貓小隊射箭場 · 組隊打怪模式
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,.35)", letterSpacing: 2, marginBottom: 14 }}>
              CATARROW · PARTY BATTLE RESULT
            </div>

            {/* 結果徽章 + 怪物 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 44, lineHeight: 1 }}>{monster?.icon || "👹"}</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: "inline-block", fontSize: 10, fontWeight: 900, letterSpacing: 2,
                  padding: "2px 10px", borderRadius: 8, marginBottom: 5,
                  background: won ? "rgba(34,197,94,.28)" : "rgba(239,68,68,.28)",
                  border: `1.5px solid ${won ? "#22c55e" : "#ef4444"}`,
                  color: won ? "#86efac" : "#fca5a5",
                }}>
                  {won ? "✅ 討伐成功" : "💀 全隊陣亡"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{monster?.name || "怪物"}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)", marginTop: 2 }}>
                  {rounds} 回合 · {statsList.length} 位隊員 · 全隊總傷 {totalTeamDmg}
                </div>
              </div>
            </div>

            {/* 分隔線 */}
            <div style={{ height: 1, background: theme.border, marginBottom: 12, opacity: .6 }} />

            {/* 隊員列表 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
              {statsList.map(s => {
                const isMvp = s.id === mvpId && won;
                return (
                  <div key={s.id} style={{
                    borderRadius: 12, padding: "8px 10px",
                    background: isMvp ? "rgba(251,191,36,.18)" : "rgba(0,0,0,.3)",
                    border: `1.5px solid ${isMvp ? "rgba(251,191,36,.7)" : theme.border}`,
                  }}>
                    {/* 名字行 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                      {isMvp && <span style={{ fontSize: 12 }}>👑</span>}
                      <span style={{
                        fontSize: 13, fontWeight: 900,
                        color: isMvp ? "#fbbf24" : "white",
                      }}>{s.name}</span>
                      {isMvp && (
                        <span style={{
                          marginLeft: "auto", fontSize: 8, fontWeight: 900, color: "#fbbf24",
                          background: "rgba(251,191,36,.2)", padding: "1px 6px", borderRadius: 6,
                          border: "1px solid rgba(251,191,36,.5)",
                        }}>MVP</span>
                      )}
                    </div>
                    {/* 數值格 */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                      {[
                        ["❤️", s.maxHP || "—", "#fca5a5"],
                        ["⚔️", s.atk   || "—", theme.accent],
                        ["🛡️", s.def   || "—", "#94a3b8"],
                        ["💥", s.dmgDealt || 0, "#fbbf24"],
                      ].map(([icon, val, col]) => (
                        <div key={icon} style={{
                          textAlign: "center", background: "rgba(0,0,0,.28)", borderRadius: 7, padding: "4px 2px",
                        }}>
                          <div style={{ fontSize: 9 }}>{icon}</div>
                          <div style={{ fontSize: 11, fontWeight: 900, color: col }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    {s.crits > 0 && (
                      <div style={{ fontSize: 9, color: "#fbbf24", marginTop: 4 }}>✨ 爆擊 {s.crits} 次</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 標語 */}
            {slogan && (
              <div style={{
                textAlign: "center", fontSize: 12, fontWeight: 900, color: theme.accent,
                marginBottom: 10, padding: "6px 12px",
                background: "rgba(0,0,0,.25)", borderRadius: 10,
                border: `1px solid ${theme.border}`,
              }}>{slogan}</div>
            )}

            {/* 日期 */}
            <div style={{ textAlign: "center", fontSize: 8, color: "rgba(255,255,255,.28)", marginTop: 2 }}>
              {today}
            </div>
          </div>
        </div>

        {/* ── 主題選擇 ───────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PARTY_THEMES.map((t, i) => (
            <button key={t.id} onClick={() => setThemeIdx(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                themeIdx === i ? "border-white text-white" : "border-slate-600 text-slate-400"
              }`}
              style={{ background: themeIdx === i ? t.bg : undefined, minWidth: 72 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 標語輸入 ───────────────────────────────── */}
        <input
          value={slogan} onChange={e => setSlogan(e.target.value)}
          placeholder="輸入你的標語"
          className="w-full px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm border border-slate-600 focus:border-indigo-400 outline-none" />

        {/* ── 按鈕 ───────────────────────────────────── */}
        <div className="flex gap-2">
          <button onClick={() => generate("share")} disabled={busy}
            className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-transform">
            {busy ? "生成中…" : "🔗 分享"}
          </button>
          <button onClick={() => generate("save")} disabled={busy}
            className="flex-1 py-3 bg-slate-700 text-white font-black rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-transform">
            💾 儲存
          </button>
        </div>
        {msg && <div className="text-center text-sm text-slate-300">{msg}</div>}

        <button onClick={onClose} className="text-slate-500 text-sm text-center py-1">關閉</button>
      </div>
    </div>
  );
}
