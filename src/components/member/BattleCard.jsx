// src/components/member/BattleCard.jsx
// 打怪結算分享卡
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { updateMember } from "../../lib/db";
import { normalizeEquipment } from "../shared/Equipment";

const BOW_POOL = [
  "三利達 練習弓","三利達 X8","三利達 X9","三利達 X10",
  "FIVICS V2","FIVICS V3","FIVICS SKADI-TX","FIVICS ARGON-X",
  "FIVICS TITAN-NXT","FIVICS ONIX","FIVICS XENIA",
  "NIKA ET13-B","NIKA ET13-A","NIKA ET11","NIKA ET19","NIKA ET21","NIKA ET25",
];

// 多種RPG風格
const CARD_THEMES = [
  {
    id: "dark_hunter",
    label: "暗夜獵手",
    bg: "linear-gradient(160deg,#1a0533,#4a1942 45%,#c4900a)",
    accent: "#fbbf24", sub: "#e9d5ff", border: "rgba(251,191,36,.6)",
  },
  {
    id: "blood_field",
    label: "血色戰場",
    bg: "linear-gradient(160deg,#1a0000,#7f1d1d 45%,#c2410c)",
    accent: "#fca5a5", sub: "#fed7aa", border: "rgba(252,165,165,.6)",
  },
  {
    id: "dark_lord",
    label: "暗黑魔王",
    bg: "linear-gradient(160deg,#0a0a0a,#1e1b4b 45%,#6d28d9)",
    accent: "#c084fc", sub: "#ddd6fe", border: "rgba(192,132,252,.6)",
  },
  {
    id: "sky_warrior",
    label: "蒼穹武士",
    bg: "linear-gradient(160deg,#0c1445,#1e3a8a 45%,#0e7490)",
    accent: "#7dd3fc", sub: "#bae6fd", border: "rgba(125,211,252,.6)",
  },
  {
    id: "jade_forest",
    label: "翡翠森林",
    bg: "linear-gradient(160deg,#052e16,#166534 45%,#ca8a04)",
    accent: "#86efac", sub: "#bbf7d0", border: "rgba(134,239,172,.6)",
  },
];

function randBow() {
  return BOW_POOL[Math.floor(Math.random() * BOW_POOL.length)];
}

export default function BattleCard({ onClose, battleData }) {
  // battleData: { monster, totalDmg, totalReceived, critCount, loot, round, mode, battleMode }
  const { profile } = useAuth();
  const cardRef = useRef(null);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState("");
  const [themeIdx, setThemeIdx] = useState(0);
  const [slogan, setSlogan]   = useState(profile?.shareSlogan || "#貓小隊射箭場");
  const [nickname, setNickname] = useState(profile?.nickname || profile?.name || "射手");

  // 裝備
  const bowSets   = normalizeEquipment(profile?.equipment).filter(s => s.type !== "armor" && s.type !== "accessory");
  const defBow    = (bowSets.find(s => s.isDefault) || bowSets[0])?.label || randBow();
  const armorSets = profile?.armorSets || [];
  const defArmor  = (armorSets.find(s => s.isDefault) || armorSets[0])?.label || "貓抓板";
  const accSets   = profile?.accessorySets || [];
  const defAcc    = (accSets.find(s => s.isDefault) || accSets[0])?.label || "逗貓棒";

  const theme = CARD_THEMES[themeIdx];
  const isGuest = !profile?.archerNo;

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

  async function saveSlogan() {
    if (profile?.id) {
      try { await updateMember(profile.id, { shareSlogan: slogan }, profile.id); } catch {}
    }
  }

  async function generate(action) {
    setBusy(true); setMsg("");
    try {
      await saveSlogan();
      const h2c = await ensureH2C();
      const canvas = await h2c(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true, logging: false });
      const blob   = await new Promise(r => canvas.toBlob(r, "image/png", 0.95));
      const name   = `打怪結算_${nickname}.png`;
      const file   = new File([blob], name, { type: "image/png" });
      if (action === "share" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "我的打怪成績" });
        setMsg("已開啟分享");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
        setMsg("✅ 已儲存，可分享到 IG / FB");
      }
    } catch (e) { setMsg("生成失敗：" + (e?.message || "")); }
    setBusy(false);
  }

  const d = battleData || {};

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex flex-col items-center justify-start p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[320px] flex flex-col gap-3 my-auto" onClick={e => e.stopPropagation()}>

        {/* 卡片本體 9:16 */}
        <div ref={cardRef} style={{
          width: "100%", aspectRatio: "9/16", borderRadius: 20, overflow: "hidden",
          position: "relative", color: "white", background: theme.bg, fontFamily: "sans-serif",
        }}>
          {/* 旋轉光芒裝飾 */}
          <div style={{
            position:"absolute", left:"50%", top:"40%",
            width:400, height:400, marginLeft:-200, marginTop:-200,
            opacity:.12, borderRadius:"9999px",
            background:"conic-gradient(from 0deg,transparent 0 8deg,rgba(255,255,255,.9) 8deg 10deg,transparent 10deg 25deg,rgba(255,255,255,.7) 25deg 27deg,transparent 27deg)",
            animation:"none",
          }}/>

          <div style={{ position:"relative", padding:"24px 20px", height:"100%", boxSizing:"border-box", display:"flex", flexDirection:"column" }}>

            {/* 頂部標題 */}
            <div style={{ fontSize:10, letterSpacing:4, color: theme.sub, fontWeight:900, marginBottom:4 }}>
              ⚔️ 貓小隊射箭場 · 打怪結算
            </div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,.5)", letterSpacing:2, marginBottom:16 }}>
              MONSTER BATTLE RESULT
            </div>

            {/* 玩家名稱 */}
            <div style={{ fontSize:24, fontWeight:900, lineHeight:1.1 }}>{nickname}</div>
            {!isGuest && profile?.archerNo && (
              <div style={{ fontSize:12, color: theme.sub, marginTop:2, fontFamily:"monospace", fontWeight:700 }}>
                #{String(profile.archerNo).padStart(4,"0")}
              </div>
            )}
            {slogan && (
              <div style={{ fontSize:11, color: theme.accent, fontWeight:900, marginTop:4 }}>{slogan}</div>
            )}

            {/* 怪物擊殺 */}
            <div style={{
              marginTop:14, borderRadius:14, padding:"12px 14px",
              background:"rgba(0,0,0,.35)", border:`2px solid ${theme.border}`,
              display:"flex", alignItems:"center", gap:12,
            }}>
              <div style={{ fontSize:40, lineHeight:1 }}>{d.monster?.icon || "👹"}</div>
              <div>
                <div style={{ fontSize:9, letterSpacing:2, color: theme.sub, fontWeight:900 }}>DEFEATED</div>
                <div style={{ fontSize:18, fontWeight:900 }}>{d.monster?.name || "怪物"}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,.6)" }}>
                  {d.mode === "veteran" ? "老手模式" : "新手模式"}・
                  {d.battleMode === "zombie" ? "殭屍靶紙" : "分數靶紙"}・
                  {d.round || 0} 回合
                </div>
              </div>
            </div>

            {/* 戰鬥數據 */}
            <div style={{ marginTop:12, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
              {[
                ["⚔️ 總傷害", d.totalDmg || 0, theme.accent],
                ["🛡️ 承傷", d.totalReceived || 0, "#fca5a5"],
                ["💥 爆擊", `${d.critCount || 0}次`, "#fbbf24"],
              ].map(([lbl,val,col]) => (
                <div key={lbl} style={{ background:"rgba(0,0,0,.3)", borderRadius:10, padding:"8px 4px", textAlign:"center" }}>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,.6)", marginBottom:2 }}>{lbl}</div>
                  <div style={{ fontSize:16, fontWeight:900, color:col }}>{val}</div>
                </div>
              ))}
            </div>

            {/* 掉落 */}
            {d.loot && (
              <div style={{
                marginTop:12, borderRadius:12, padding:"10px 12px",
                background:"rgba(0,0,0,.3)", border:`1px solid ${theme.border}`,
                display:"flex", alignItems:"center", gap:10,
              }}>
                <div style={{ fontSize:28 }}>{d.loot.icon}</div>
                <div>
                  <div style={{ fontSize:9, color: theme.sub, fontWeight:900, letterSpacing:2 }}>🎁 LOOT DROP</div>
                  <div style={{ fontSize:14, fontWeight:900 }}>{d.loot.name}</div>
                </div>
              </div>
            )}

            {/* 裝備（有帳號才顯示完整） */}
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:9, color: theme.sub, fontWeight:900, letterSpacing:2, marginBottom:6 }}>🎒 EQUIPMENT</div>
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                {[
                  ["🏹", defBow],
                  ["🛡️", defArmor],
                  ["✨", defAcc],
                ].map(([icon, name]) => (
                  <div key={icon} style={{ fontSize:11, color:"rgba(255,255,255,.75)", display:"flex", gap:6 }}>
                    <span>{icon}</span><span>{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div style={{ marginTop:"auto", paddingTop:10, borderTop:"1px solid rgba(255,255,255,.12)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:9, color:"rgba(255,255,255,.4)" }}>貓小隊射箭場 · 台南</div>
              <div style={{ fontSize:9, color: theme.accent, fontWeight:900 }}>BAREBOW ARCHERY</div>
            </div>
          </div>
        </div>

        {/* 樣式選擇 */}
        <div className="bg-white/10 rounded-xl p-3 flex flex-col gap-3">
          <div>
            <div className="text-white/70 text-xs mb-2">🎨 卡片風格</div>
            <div className="flex gap-2 flex-wrap">
              {CARD_THEMES.map((t, i) => (
                <button key={t.id} onClick={() => setThemeIdx(i)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${themeIdx === i ? "border-white text-white" : "border-white/30 text-white/60"}`}
                  style={{ background: themeIdx === i ? "rgba(255,255,255,.2)" : "transparent" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-white/70 text-xs mb-1">暱稱</div>
            <input value={nickname} onChange={e => setNickname(e.target.value)} maxLength={12}
              className="w-full bg-white/15 text-white text-sm rounded-lg px-3 py-2 border border-white/20" />
          </div>
          <div>
            <div className="text-white/70 text-xs mb-1">個人標語</div>
            <input value={slogan} onChange={e => setSlogan(e.target.value)} maxLength={20}
              placeholder="#貓小隊射箭場"
              className="w-full bg-white/15 text-white text-sm rounded-lg px-3 py-2 border border-white/20" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/15 text-white font-bold text-sm">關閉</button>
          <button onClick={() => generate("download")} disabled={busy}
            className="flex-1 py-3 rounded-xl bg-white/25 text-white font-bold text-sm">{busy ? "生成中…" : "💾 存圖"}</button>
          <button onClick={() => generate("share")} disabled={busy}
            className="flex-1 py-3 rounded-xl font-black text-sm"
            style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>📤 分享</button>
        </div>
        {msg && <div className="text-center text-white text-xs">{msg}</div>}
      </div>
    </div>
  );
}
