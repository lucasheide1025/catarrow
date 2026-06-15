// src/components/worldboss/WorldBossBattleCard.jsx — 世界王戰鬥成績小卡
import { useRef, useState } from "react";
import WorldBossSVG from "./WorldBossSVG";

const THEMES = [
  { id: "dark",   label: "暗黑",   bg: "linear-gradient(160deg,#0f172a 0%,#1e1b4b 50%,#4c1d95 100%)", accent: "#c4b5fd" },
  { id: "fire",   label: "烈焰",   bg: "linear-gradient(160deg,#1c0a00 0%,#7f1d1d 45%,#b91c1c 100%)", accent: "#fca5a5" },
  { id: "ocean",  label: "深海",   bg: "linear-gradient(160deg,#0f172a 0%,#0c4a6e 50%,#0369a1 100%)", accent: "#7dd3fc" },
  { id: "forest", label: "原野",   bg: "linear-gradient(160deg,#052e16 0%,#14532d 50%,#15803d 100%)", accent: "#86efac" },
];

function scoreColor(label) {
  if (label === "X" || label === "10") return "#f59e0b";
  if (label === "9" || label === "8")  return "#ef4444";
  if (label === "7" || label === "6")  return "#3b82f6";
  if (label === "M")                   return "#64748b";
  return "#94a3b8";
}

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

export default function WorldBossBattleCard({ archerName, event, allRounds, totalDmg, totalCrits, onClose }) {
  const cardRef    = useRef(null);
  const [busy, setBusy]         = useState(false);
  const [msg,  setMsg]          = useState("");
  const [themeIdx, setThemeIdx] = useState(0);
  const theme = THEMES[themeIdx];

  const boss     = event?.bossData || {};
  const total    = event?.totalParticipants || 0;
  const dateStr  = new Date().toLocaleDateString("zh-TW", { year:"numeric", month:"2-digit", day:"2-digit" });

  async function generate(action) {
    setBusy(true); setMsg("");
    try {
      const h2c    = await ensureH2C();
      const canvas = await h2c(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true, logging: false });
      const blob   = await new Promise(r => canvas.toBlob(r, "image/png", 0.95));
      const file   = new File([blob], `世界王挑戰_${archerName}.png`, { type: "image/png" });
      if (action === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "我的世界王挑戰成績" });
        setMsg("已開啟分享");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
        setMsg("✅ 圖片已儲存，可到相簿分享");
      }
    } catch (e) { setMsg("生成失敗：" + (e?.message || "")); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex flex-col items-center justify-start p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="w-full max-w-[300px] flex flex-col gap-3 my-auto" onClick={e => e.stopPropagation()}>

        {/* ── 卡片本體（9:16）── */}
        <div ref={cardRef}
          style={{
            width: "100%", aspectRatio: "9/16", borderRadius: 20, overflow: "hidden",
            position: "relative", color: "white", background: theme.bg, fontFamily: "sans-serif",
          }}>

          {/* 光暈裝飾 */}
          <div style={{
            position: "absolute", left: -40, top: -40, width: 160, height: 160,
            borderRadius: "50%", background: `radial-gradient(circle, ${theme.accent}44 0%, transparent 70%)`,
          }}/>
          <div style={{
            position: "absolute", right: -30, bottom: 80, width: 120, height: 120,
            borderRadius: "50%", background: `radial-gradient(circle, ${boss.accent || "#f59e0b"}33 0%, transparent 70%)`,
          }}/>

          <div style={{ position: "relative", padding: "20px 18px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 0 }}>

            {/* 頂部標籤 */}
            <div style={{ fontSize: 10, letterSpacing: 3, color: theme.accent, fontWeight: 900, marginBottom: 2 }}>
              🌍 WORLD BOSS CHALLENGE
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)", letterSpacing: 2, marginBottom: 14 }}>
              貓小隊射箭場 · {dateStr}
            </div>

            {/* Boss 展示 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
              background: `linear-gradient(135deg, ${boss.bg || "#1e293b"}dd, rgba(0,0,0,.4))`,
              borderRadius: 14, padding: "10px 12px",
              border: `1px solid ${boss.accent || "#f59e0b"}55`,
            }}>
              <WorldBossSVG bossKey={event?.bossKey} currentHP={event?.bossCurrentHP} maxHP={event?.bossMaxHP} size={56}/>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: boss.accent || "#f59e0b", lineHeight: 1.1 }}>
                  {boss.name || "世界大 Boss"}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 2 }}>
                  「{boss.title || ""}」
                </div>
                <div style={{ fontSize: 9, color: theme.accent, marginTop: 4, fontWeight: 700 }}>
                  {total} 位勇者共同挑戰
                </div>
              </div>
            </div>

            {/* 射手名稱 */}
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{archerName}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.45)", marginBottom: 14, marginTop: 2 }}>
              ⚔️ 世界王挑戰者
            </div>

            {/* 主要數據 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <div style={{
                flex: 2, borderRadius: 12, padding: "10px 12px",
                background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.35)",
              }}>
                <div style={{ fontSize: 9, color: "#fca5a5", fontWeight: 700, letterSpacing: 2 }}>TOTAL DMG</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#ef4444", lineHeight: 1.1 }}>
                  {totalDmg.toLocaleString()}
                </div>
              </div>
              <div style={{
                flex: 1, borderRadius: 12, padding: "10px 8px", textAlign: "center",
                background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.3)",
              }}>
                <div style={{ fontSize: 9, color: "#fcd34d", fontWeight: 700 }}>CRITS</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#f59e0b" }}>{totalCrits}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,.4)" }}>暴擊</div>
              </div>
            </div>

            {/* 回合記錄 */}
            <div style={{ fontSize: 9, color: theme.accent, fontWeight: 900, letterSpacing: 2, marginBottom: 6 }}>
              回合記錄
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              {allRounds.map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(255,255,255,.06)", borderRadius: 8, padding: "5px 8px",
                  border: "1px solid rgba(255,255,255,.08)",
                }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,.35)", width: 36, flexShrink: 0 }}>
                    第 {i + 1} 回
                  </span>
                  <div style={{ display: "flex", gap: 3, flex: 1, flexWrap: "wrap" }}>
                    {r.arrows.filter(a => a.label !== undefined).map((a, j) => (
                      <span key={j} style={{ fontSize: 10, fontWeight: 900, color: scoreColor(a.label) }}>
                        {a.label}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#ef4444", flexShrink: 0 }}>
                    -{r.dmg.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* 底部 */}
            <div style={{
              marginTop: 10, paddingTop: 8,
              borderTop: "1px solid rgba(255,255,255,.1)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,.35)" }}>貓小隊射箭場 · 台南</div>
              <div style={{ fontSize: 8, color: theme.accent, fontWeight: 900 }}>CATARROW</div>
            </div>
          </div>
        </div>

        {/* 主題選擇 */}
        <div className="bg-white/10 rounded-xl p-3">
          <div className="text-white/60 text-xs mb-2">🎨 卡片風格</div>
          <div className="flex gap-2">
            {THEMES.map((t, i) => (
              <button key={t.id} onClick={() => setThemeIdx(i)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${themeIdx === i ? "border-white/80 text-white" : "border-white/20 text-white/50"}`}
                style={{ background: themeIdx === i ? "rgba(255,255,255,.2)" : "transparent" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/15 text-white font-bold text-sm">
            關閉
          </button>
          <button onClick={() => generate("download")} disabled={busy}
            className="flex-1 py-3 rounded-xl bg-white/25 text-white font-bold text-sm">
            {busy ? "生成中…" : "💾 存圖"}
          </button>
          <button onClick={() => generate("share")} disabled={busy}
            className="flex-1 py-3 rounded-xl font-black text-sm"
            style={{ background: "linear-gradient(90deg,#f59e0b,#ef4444)", color: "#fff" }}>
            📤 分享
          </button>
        </div>
        {msg && <div className="text-center text-white/70 text-xs">{msg}</div>}
      </div>
    </div>
  );
}
