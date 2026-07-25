// src/guild/ui/GuildLicenseCard.jsx
// 冒險者證「分享圖」：把證件畫成一張 9:16 的精美卡片 → html2canvas 轉 PNG → 分享/下載。
// 沿用專案既有做法（`GuestShareCard`）：CDN 載 html2canvas、優先 navigator.share、
// 不支援就退回下載檔案。
//
// ⚠️ html2canvas 的限制（踩過就知道）：
//   ① 不吃 `aspect-ratio`／`background-clip:text`／複雜濾鏡 → 卡片一律用**固定像素**與單純漸層。
//   ② 圖片要同源（我們的 /assets/guild/* 是同源）且要開 useCORS。
//   ③ 量測是在畫面上真的存在的 DOM，所以卡片要可見（放在 modal 裡）而不是 display:none。
import { useRef, useState } from "react";
import { nextRankInfo } from "../domain/guildRank";
import { currentTitle, buildTitleStats, evaluateTitles } from "../domain/guildTitles";
import { sfxTap, sfxClose, sfxOpenChest } from "../../lib/sound";
import { hallBg, rankBadge } from "./GuildArt";

const W = 340;   // 卡片寬（實際輸出 ×2 = 680）
const H = 604;   // 9:16

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

function Stat({ icon, value, label }) {
  return (
    <div style={{ background: "rgba(0,0,0,.45)", border: "1px solid rgba(251,191,36,.22)", borderRadius: 10, padding: "7px 4px", textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#fde68a", lineHeight: 1.2 }}>{icon} {value}</div>
      <div style={{ fontSize: 9, color: "#b3a68c", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function GuildLicenseCard({ profile, memberName, onClose }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const rankInfo = nextRankInfo(profile.rep);
  const rank = rankInfo.current;
  const worn = currentTitle(profile);
  const stats = buildTitleStats(profile);
  const titles = evaluateTitles(profile);
  const unlockedCount = titles.filter(t => t.unlocked).length;
  const dexPct = Math.round((stats.junkSeen / Math.max(1, stats.junkTotal)) * 100);
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;

  async function generate(action) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      const h2c = await ensureH2C();
      const canvas = await h2c(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true, logging: false });
      const blob = await new Promise(r => canvas.toBlob(r, "image/png", 0.95));
      const file = new File([blob], `冒險者證_${memberName || "冒險者"}.png`, { type: "image/png" });
      if (action === "share" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "我的冒險者證" });
        setMsg("已開啟分享");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
        setMsg("✅ 已儲存圖片，可到相簿分享");
      }
      sfxOpenChest();
    } catch (e) {
      setMsg("生成失敗：" + (e?.message || ""));
    }
    setBusy(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 320, background: "rgba(0,0,0,.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: 14, overflowY: "auto" }}
      onClick={() => { sfxClose(); onClose(); }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "auto 0" }} onClick={e => e.stopPropagation()}>

        {/* ── 卡片本體（就是輸出的那張圖）── */}
        <div ref={cardRef}
          style={{ width: W, height: H, borderRadius: 18, overflow: "hidden", position: "relative", boxSizing: "border-box",
            color: "#f1e7d5", fontFamily: "system-ui, -apple-system, 'Noto Sans TC', sans-serif",
            backgroundColor: "#120c06",
            backgroundImage: `linear-gradient(rgba(10,7,3,.82),rgba(10,7,3,.92)), url(${hallBg()})`,
            backgroundSize: "cover", backgroundPosition: "center",
            border: `2px solid ${rank.color}`, boxShadow: "0 14px 40px rgba(0,0,0,.7)" }}>

          <div style={{ padding: "16px 16px 14px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>

            {/* 抬頭 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#c8b89a", fontWeight: 900 }}>ADVENTURER LICENSE</div>
              <div style={{ fontSize: 9, color: "#8d7f66" }}>{dateStr}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fbbf24", marginTop: 2, letterSpacing: 2 }}>🏛️ 冒險者公會・冒險者證</div>

            {/* 徽章 + 名字 + 階級 + 稱號 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
              <img src={rankBadge(rank.id)} alt="" width={78} height={78}
                style={{ objectFit: "contain", filter: "drop-shadow(0 3px 8px rgba(0,0,0,.6))" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2 }}>{memberName || "冒險者"}</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: rank.color, marginTop: 2 }}>{rank.name}</div>
                {worn && (
                  <div style={{ display: "inline-block", marginTop: 5, fontSize: 11, fontWeight: 900, color: "#0b1220",
                    background: "linear-gradient(135deg,#fcd34d,#f59e0b)", borderRadius: 6, padding: "2px 8px" }}>
                    {worn.icon} {worn.name}
                  </div>
                )}
              </div>
            </div>

            {/* 聲望條 */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#c8b89a", marginBottom: 3 }}>
                <span>🏅 聲望 {profile.rep}</span>
                <span>{rankInfo.next ? `距 ${rankInfo.next.name} ${rankInfo.need}` : "已達頂階"}</span>
              </div>
              <div style={{ height: 7, background: "rgba(255,255,255,.12)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${rankInfo.progressPct}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
              </div>
            </div>

            {/* 戰績 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 14 }}>
              <Stat icon="🚩" value={`${stats.won}/${stats.total}`} label="遠征勝/總" />
              <Stat icon="☠️" value={stats.hardWon} label="☠️×3+ 完成" />
              <Stat icon="🗡️" value={stats.mythicWon} label="☠️×6 完成" />
              <Stat icon="⚒️" value={`+${stats.maxPlus}`} label="最高強化" />
              <Stat icon="🎖️" value={`${unlockedCount}/${titles.length}`} label="稱號" />
              <Stat icon="🐾" value={stats.catEarned} label="累計 CAT幣" />
            </div>

            {/* 圖鑑進度 */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#c8b89a", marginBottom: 3 }}>
                <span>🧺 雜貨圖鑑</span>
                <span>{stats.junkSeen}/{stats.junkTotal}（{dexPct}%）</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,.12)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${dexPct}%`, background: "linear-gradient(90deg,#22d3ee,#3b82f6)" }} />
              </div>
            </div>

            {/* 底部：公會長貓 + 落款 */}
            <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 9, color: "#8d7f66", lineHeight: 1.6 }}>
                本證由冒險者公會核發<br />
                <span style={{ color: "#c8b89a", fontWeight: 800 }}>貓小隊射箭場</span>
              </div>
              <img src="/assets/guild/guild_master.webp" alt="" width={72} height={72}
                style={{ objectFit: "contain", opacity: 0.95, filter: "drop-shadow(0 3px 8px rgba(0,0,0,.6))" }} />
            </div>
          </div>
        </div>

        {/* ── 動作列（不會被拍進圖裡）── */}
        {msg && <div style={{ fontSize: 12, textAlign: "center", color: msg.startsWith("生成失敗") ? "#f87171" : "#6ee7b7" }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={busy} onClick={() => { sfxTap(); generate("share"); }}
            style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "none", fontWeight: 900, fontSize: 13, color: "#0b1220",
              background: busy ? "#64748b" : "linear-gradient(135deg,#fcd34d,#f59e0b)", cursor: busy ? "wait" : "pointer" }}>
            {busy ? "產生中…" : "📤 分享圖片"}
          </button>
          <button type="button" disabled={busy} onClick={() => { sfxTap(); generate("download"); }}
            style={{ flex: 1, padding: "11px 0", borderRadius: 11, border: "1px solid rgba(251,191,36,.3)", fontWeight: 900, fontSize: 13, color: "#fde68a",
              background: "rgba(12,8,4,.85)", cursor: busy ? "wait" : "pointer" }}>
            💾 下載
          </button>
        </div>
        <button type="button" onClick={() => { sfxClose(); onClose(); }}
          style={{ padding: "9px 0", borderRadius: 11, border: "none", background: "rgba(51,65,85,.9)", color: "#e2e8f0", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          關閉
        </button>
      </div>
    </div>
  );
}
