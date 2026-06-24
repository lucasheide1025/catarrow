// src/components/member/ShareCard.jsx
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getCertRecords, getCertification, updateMember, getDexGrants, getDexConfig } from "../../lib/db";
import { computeDexStats } from "../../lib/achievementDex";
import { getCohort, cohortLabel } from "../../lib/cohort";
import { formatArcherNo, BOW_TYPES, getCertLevel, calcBadgePoints } from "../../lib/constants";
import { normalizeEquipment } from "../shared/Equipment";

const CERT_SHOW = ["recurve_bare", "compound", "traditional"];
const LEVEL_NAME = { none: "灰證", blue: "藍證", gold: "金證" };

// 弓組品牌池（無自訂裝備時隨機顯示）
const BOW_POOL = [
  "三利達 練習弓","三利達 X8","三利達 X9","三利達 X10",
  "FIVICS V2","FIVICS V3","FIVICS SKADI-TX","FIVICS ARGON-X",
  "FIVICS TITAN-NXT","FIVICS ONIX","FIVICS XENIA",
  "NIKA ET13-B","NIKA ET13-A","NIKA ET11","NIKA ET19","NIKA ET21","NIKA ET25",
];
function randBow() { return BOW_POOL[Math.floor(Math.random() * BOW_POOL.length)]; }

// 分享卡多種樣式
const SHARE_THEMES = [
  { id:"classic",  label:"深海藍",  bg:"linear-gradient(160deg,#0f172a 0%,#1e3a5f 45%,#0e7490 100%)", accent:"#7dd3fc" },
  { id:"gold",     label:"金證版",  bg:"linear-gradient(160deg,#1c0a00,#78350f 40%,#b45309 75%,#f59e0b 100%)", accent:"#fde68a" },
  { id:"night",    label:"暗夜版",  bg:"linear-gradient(160deg,#020617,#0f172a 50%,#0c4a6e 100%)", accent:"#38bdf8" },
  { id:"rose",     label:"玫瑰版",  bg:"linear-gradient(160deg,#1a0010,#881337 50%,#be185d 100%)", accent:"#fda4af" },
  { id:"forest",   label:"原野版",  bg:"linear-gradient(160deg,#052e16,#14532d 50%,#65a30d 100%)", accent:"#bbf7d0" },
  { id:"galaxy",   label:"星河版",  bg:"linear-gradient(160deg,#09090b,#1e1b4b 40%,#4c1d95 75%,#7e22ce 100%)", accent:"#e9d5ff" },
];

const LEVEL_BOX = {
  入門: { bg: "rgba(148,163,184,.18)", border: "rgba(148,163,184,.4)", text: "#cbd5e1" },
  初級: { bg: "rgba(52,211,153,.18)",  border: "rgba(52,211,153,.5)",  text: "#6ee7b7" },
  中級: { bg: "rgba(96,165,250,.18)",  border: "rgba(96,165,250,.5)",  text: "#93c5fd" },
  進階: { bg: "rgba(192,132,252,.2)",  border: "rgba(192,132,252,.5)", text: "#d8b4fe" },
  精英: { bg: "linear-gradient(160deg,rgba(251,191,36,.3),rgba(245,158,11,.18))", border: "rgba(251,191,36,.7)", text: "#fcd34d" },
  菁英: { bg: "linear-gradient(160deg,rgba(251,191,36,.3),rgba(245,158,11,.18))", border: "rgba(251,191,36,.7)", text: "#fcd34d" },
};

const ARMOR_LABEL = { chestGuard:"護胸", armGuard:"護臂", fingerGuard:"護指", quiver:"箭袋" };
const ACCESSORY_LABEL = { tSquare:"T尺", arrowDoctor:"箭尾醫生", toolKit:"工具包", bowBag:"弓包", bowStand:"弓架" };

export default function ShareCard({ onClose }) {
  const { profile } = useAuth();
  const cardRef = useRef(null);
  const [certRecords, setCertRecords]   = useState([]);
  const [certification, setCertification] = useState(null);
  const [dexStats, setDexStats]         = useState(null);
  const [busy, setBusy]                 = useState(false);
  const [msg, setMsg]                   = useState("");

  const [slogan, setSlogan]       = useState(profile?.shareSlogan || "#讓射箭成為日常");
  const [themeIdx, setThemeIdx]   = useState(0);
  const theme = SHARE_THEMES[themeIdx];

  // 裝備資料
  const bowSets       = normalizeEquipment(profile?.equipment).filter(s => s.type !== "armor" && s.type !== "accessory");
  const armorSets     = (profile?.armorSets || []);
  const accessorySets = (profile?.accessorySets || []);

  // 沒有自訂弓組時隨機顯示品牌
  const [randBowName] = useState(() => randBow());

  // 選擇顯示哪套
  const [bowIdx,       setBowIdx]       = useState(0);
  const [armorIdx,     setArmorIdx]     = useState(0);
  const [accessoryIdx, setAccessoryIdx] = useState(0);
  // 顯示開關
  const [showArmor,     setShowArmor]     = useState(armorSets.length > 0);
  const [showAccessory, setShowAccessory] = useState(accessorySets.length > 0);

  const mainBow       = bowSets[bowIdx] || null;
  const mainArmor     = armorSets[armorIdx] || null;
  const mainAccessory = accessorySets[accessoryIdx] || null;

  useEffect(() => {
    if (!profile?.id) return;
    getCertRecords(profile.id).then(setCertRecords).catch(() => {});
    getCertification(profile.id).then(setCertification).catch(() => {});
    Promise.all([getDexGrants(profile.id), getDexConfig()]).then(([granted, cfg]) => {
      getCertRecords(profile.id).then(cr => {
        getCertification(profile.id).then(ct => {
          setDexStats(computeDexStats({
            member: profile, certification: ct, certRecords: cr,
            checkinCount: profile?.dailyQuestCount || 0,
            granted, physicalMax: cfg.physicalMax, pointMax: cfg.pointMax,
          }));
        });
      });
    }).catch(() => {});
  }, [profile?.id]);

  useEffect(() => { setSlogan(profile?.shareSlogan || "#讓射箭成為日常"); }, [profile?.id]);

  const thisYear = new Date().getFullYear();
  function certOf(bowType) {
    const recs = certRecords.filter(r => r.bowType === bowType && r.year === thisYear);
    if (!recs.length) return { score: 0, level: null };
    const best = Math.max(...recs.map(r => r.score || 0));
    return { score: best, level: getCertLevel(bowType, best) };
  }

  const certLevel = certification?.level || "none";

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
    try { await updateMember(profile.id, { shareSlogan: slogan }, profile.id); } catch {}
  }

  async function generate(action) {
    setBusy(true); setMsg("");
    try {
      await saveSlogan();
      const h2c = await ensureH2C();
      const canvas = await h2c(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true, logging: false });
      const blob = await new Promise(r => canvas.toBlob(r, "image/png", 0.95));
      const file = new File([blob], `貓小隊射箭場_${profile.nickname || profile.name}.png`, { type: "image/png" });
      if (action === "share" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "我的射箭成績卡" });
        setMsg("已開啟分享");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
        setMsg("✅ 已儲存圖片，可到相簿分享到 IG / FB");
      }
    } catch (e) { setMsg("生成失敗：" + (e?.message || "")); }
    setBusy(false);
  }

  // 防具摘要（顯示有填寫的項目）
  function armorSummary(set) {
    if (!set) return null;
    return Object.entries(ARMOR_LABEL)
      .filter(([k]) => set[k]?.name)
      .map(([k, lbl]) => `${lbl}：${set[k].name}`)
      .join("　");
  }

  // 飾品摘要
  function accessorySummary(set) {
    if (!set) return null;
    return Object.entries(ACCESSORY_LABEL)
      .filter(([k]) => set[k]?.name)
      .map(([k, lbl]) => `${lbl}：${set[k].name}`)
      .join("　");
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex flex-col items-center justify-start p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[320px] flex flex-col gap-3 my-auto" onClick={e => e.stopPropagation()}>

        {/* ── 卡片本體（9:16）── */}
        <div ref={cardRef}
          style={{
            width: "100%", aspectRatio: "9/16", borderRadius: 20, overflow: "hidden",
            position: "relative", color: "white",
            background: theme.bg,
            fontFamily: "sans-serif",
          }}>
          <div style={{
            position: "absolute", right: -50, bottom: -50, width: 200, height: 200,
            borderRadius: "9999px", opacity: 0.15,
            background: "radial-gradient(circle, #fbbf24 0 18%, #fff 18% 34%, #ef4444 34% 50%, #fff 50% 66%, #1e293b 66% 82%, #fff 82% 100%)",
          }} />

          <div style={{ position: "relative", padding: "24px 20px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: "#7dd3fc", fontWeight: 900, marginBottom: 4 }}>🎯 貓小隊射箭場</div>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, marginBottom: 14 }}>BAREBOW ARCHERY · 射手成績卡</div>

            {/* 暱稱 + 本名 + 期數 + 標語 */}
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>{profile?.nickname || profile?.name}</div>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>
              {profile?.name}{getCohort(profile?.joinDate) != null ? `　·　${cohortLabel(getCohort(profile?.joinDate))}` : ""}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 900, letterSpacing: 1 }}>{formatArcherNo(profile?.archerNo)}</span>
              {slogan && <span style={{ fontSize: 11, color: "#7dd3fc", fontWeight: 900 }}>{slogan}</span>}
            </div>

            {/* 射手證 */}
            <div style={{
              marginTop: 12, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
              background: certLevel === "gold"
                ? "linear-gradient(110deg,#78350f,#b45309 50%,#f59e0b)"
                : certLevel === "blue"
                ? "linear-gradient(110deg,#1e3a8a,#2563eb)"
                : "rgba(255,255,255,.08)",
              border: certLevel === "gold" ? "2px solid #fcd34d" : certLevel === "blue" ? "2px solid #60a5fa" : "1px solid rgba(255,255,255,.15)",
              boxShadow: certLevel === "gold" ? "0 0 20px rgba(251,191,36,.5)" : certLevel === "blue" ? "0 0 16px rgba(96,165,250,.4)" : "none",
            }}>
              <div style={{ fontSize: 34, lineHeight: 1 }}>🎖️</div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: certLevel === "gold" ? "#fde68a" : certLevel === "blue" ? "#bfdbfe" : "#94a3b8", fontWeight: 900 }}>射手證等級</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,.4)" }}>{LEVEL_NAME[certLevel]}</div>
              </div>
              {certLevel === "gold" && <div style={{ marginLeft: "auto", fontSize: 10, fontWeight: 900, color: "#fde68a" }}>★ MAX</div>}
            </div>

            {/* 年度檢定格 */}
            <div style={{ marginTop: 14, fontSize: 10, color: "#7dd3fc", fontWeight: 900, letterSpacing: 2 }}>{thisYear} 年度檢定</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {CERT_SHOW.map(bk => {
                const bt = BOW_TYPES[bk];
                const { score, level } = certOf(bk);
                const box = level ? LEVEL_BOX[level] : null;
                return (
                  <div key={bk} style={{
                    flex: 1, borderRadius: 10, padding: "8px 4px", textAlign: "center",
                    background: box ? box.bg : "rgba(255,255,255,.06)",
                    border: `1px solid ${box ? box.border : "rgba(255,255,255,.1)"}`,
                  }}>
                    <div style={{ fontSize: 18 }}>{bt.icon}</div>
                    <div style={{ fontSize: 9, color: "#cbd5e1", margin: "2px 0" }}>{bt.short}</div>
                    {score > 0 ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>{score}</div>
                        <div style={{ fontSize: 9, fontWeight: 900, color: box ? box.text : "#cbd5e1" }}>{level || "—"}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>未參加</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 主力弓組 */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: theme.accent, fontWeight: 900, letterSpacing: 2 }}>主力裝備</div>
              <div style={{ fontSize: 12, color: "#e2e8f0", marginTop: 3 }}>
                🏹 {mainBow ? (mainBow.label || mainBow.bowCategory) : randBowName}
              </div>
            </div>

            {/* 防具（選擇顯示時才出現） */}
            {showArmor && mainArmor && armorSummary(mainArmor) && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: "#fb923c", fontWeight: 900, letterSpacing: 2 }}>射手防具</div>
                <div style={{ fontSize: 10, color: "#fed7aa", marginTop: 2, lineHeight: 1.6 }}>{armorSummary(mainArmor)}</div>
              </div>
            )}

            {/* 加成飾品（選擇顯示時才出現） */}
            {showAccessory && mainAccessory && accessorySummary(mainAccessory) && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: "#c084fc", fontWeight: 900, letterSpacing: 2 }}>加成飾品</div>
                <div style={{ fontSize: 10, color: "#e9d5ff", marginTop: 2, lineHeight: 1.6 }}>{accessorySummary(mainAccessory)}</div>
              </div>
            )}

            {/* 徽章 */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: "#7dd3fc", fontWeight: 900, letterSpacing: 2 }}>累積榮譽</div>
              <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                {[["🐱 肥貓", calcBadgePoints(profile, "fatCat")],
                  ["⭐ 積分", calcBadgePoints(profile, "score")],
                  ["🏆 成就", calcBadgePoints(profile, "achievement")]].map(([lbl, pts]) => (
                  <div key={lbl} style={{ flex: 1, background: "rgba(255,255,255,.08)", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#cbd5e1" }}>{lbl}</div>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{pts}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 圖鑑 */}
            {dexStats && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, color: "#7dd3fc", fontWeight: 900, letterSpacing: 2 }}>圖鑑收藏</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 900 }}>🎖️ {dexStats.totalUnlocked}/{dexStats.totalAll}</span>
                  {(dexStats.gold + dexStats.silver + dexStats.bronze) > 0 && (
                    <span style={{ fontSize: 12, color: "#fcd34d", fontWeight: 900 }}>
                      🥇{dexStats.gold} 🥈{dexStats.silver} 🥉{dexStats.bronze}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 底部 */}
            <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>貓小隊射箭場 · 台南</div>
              <div style={{ fontSize: 9, color: "#7dd3fc", fontWeight: 900 }}>BAREBOW ARCHERY</div>
            </div>
          </div>
        </div>

        {/* ── 自訂選項 ── */}
        <div className="bg-white/10 rounded-xl p-3 flex flex-col gap-3">
          {/* 主題選擇 */}
          <div>
            <div className="text-white/70 text-xs mb-2">🎨 卡片風格</div>
            <div className="flex gap-1.5 flex-wrap">
              {SHARE_THEMES.map((t, i) => (
                <button key={t.id} onClick={() => setThemeIdx(i)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${themeIdx === i ? "border-white text-white" : "border-white/30 text-white/60"}`}
                  style={{ background: themeIdx === i ? "rgba(255,255,255,.2)" : "transparent" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 弓組選擇 */}
          {bowSets.length > 1 && (
            <div>
              <div className="text-white/70 text-xs mb-1">🏹 主力弓組</div>
              <select value={bowIdx} onChange={e => setBowIdx(Number(e.target.value))}
                className="w-full bg-white/15 text-white text-sm rounded-lg px-3 py-2 border border-white/20">
                {bowSets.map((eq, i) => (
                  <option key={i} value={i} style={{ color: "#000" }}>{eq.label || eq.bowCategory || `弓組 ${i+1}`}</option>
                ))}
              </select>
            </div>
          )}

          {/* 防具選擇 */}
          {armorSets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-white/70 text-xs">🛡️ 射手防具</div>
                <button onClick={() => setShowArmor(v => !v)}
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${showArmor ? "bg-orange-500 text-white" : "bg-white/20 text-white/60"}`}>
                  {showArmor ? "顯示中" : "已隱藏"}
                </button>
              </div>
              {showArmor && armorSets.length > 1 && (
                <select value={armorIdx} onChange={e => setArmorIdx(Number(e.target.value))}
                  className="w-full bg-white/15 text-white text-sm rounded-lg px-3 py-2 border border-white/20">
                  {armorSets.map((s, i) => (
                    <option key={i} value={i} style={{ color: "#000" }}>{s.label || `防具套組 ${i+1}`}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* 飾品選擇 */}
          {accessorySets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-white/70 text-xs">✨ 加成飾品</div>
                <button onClick={() => setShowAccessory(v => !v)}
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${showAccessory ? "bg-purple-500 text-white" : "bg-white/20 text-white/60"}`}>
                  {showAccessory ? "顯示中" : "已隱藏"}
                </button>
              </div>
              {showAccessory && accessorySets.length > 1 && (
                <select value={accessoryIdx} onChange={e => setAccessoryIdx(Number(e.target.value))}
                  className="w-full bg-white/15 text-white text-sm rounded-lg px-3 py-2 border border-white/20">
                  {accessorySets.map((s, i) => (
                    <option key={i} value={i} style={{ color: "#000" }}>{s.label || `飾品套組 ${i+1}`}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* 標語 */}
          <div>
            <div className="text-white/70 text-xs mb-1">個人標語（會記住）</div>
            <input value={slogan} onChange={e => setSlogan(e.target.value)} maxLength={20}
              placeholder="#讓射箭成為日常"
              className="w-full bg-white/15 text-white text-sm rounded-lg px-3 py-2 border border-white/20" />
          </div>
        </div>

        {/* ── 操作按鈕 ── */}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/15 text-white font-bold text-sm">關閉</button>
          <button onClick={() => generate("download")} disabled={busy}
            className="flex-1 py-3 rounded-xl bg-white/25 text-white font-bold text-sm">{busy ? "生成中…" : "💾 存圖"}</button>
          <button onClick={() => generate("share")} disabled={busy}
            className="flex-1 py-3 rounded-xl font-black text-sm"
            style={{ background: "linear-gradient(90deg,#fbbf24,#f59e0b)", color: "#7c2d12" }}>📤 分享</button>
        </div>
        {msg && <div className="text-center text-white text-xs">{msg}</div>}
      </div>
    </div>
  );
}
