// src/components/member/GuestShareCard.jsx
// 訪客/兒童模式的體驗紀念卡——不沿用 ShareCard.jsx（那個綁死射手證/屆數等正式學籍限定資料），
// 視覺沿用同一套漸層卡片美術語言，內容改成訪客/兒童真正擁有的資料：暱稱、累積金幣、活動成果、日期。
import { useState, useRef } from "react";
import { EQUIP_SLOT_DEFS } from "../../lib/constants";

const SHARE_THEMES = [
  { id: "classic", label: "深海藍", bg: "linear-gradient(160deg,#0f172a 0%,#1e3a5f 45%,#0e7490 100%)", accent: "#7dd3fc" },
  { id: "gold",    label: "金證版", bg: "linear-gradient(160deg,#1c0a00,#78350f 40%,#b45309 75%,#f59e0b 100%)", accent: "#fde68a" },
  { id: "rose",    label: "玫瑰版", bg: "linear-gradient(160deg,#1a0010,#881337 50%,#be185d 100%)", accent: "#fda4af" },
  { id: "forest",  label: "原野版", bg: "linear-gradient(160deg,#052e16,#14532d 50%,#65a30d 100%)", accent: "#bbf7d0" },
  { id: "galaxy",  label: "星河版", bg: "linear-gradient(160deg,#09090b,#1e1b4b 40%,#4c1d95 75%,#7e22ce 100%)", accent: "#e9d5ff" },
];

const KID_SLOGANS = ["#今天也好棒", "#小小射手初體驗", "#我是箭場小勇者"];
const GUEST_SLOGANS = ["#讓射箭成為日常", "#第一次拉弓就上手", "#下次還要再來"];

function countValues(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  return Object.values(value).reduce((sum, item) => sum + (typeof item === "number" ? item : Number(item?.count || item?.qty || 0)), 0);
}

export default function GuestShareCard({ name, coins, accountType = "guest", profile = null, wbResult = null, onClose }) {
  const cardRef = useRef(null);
  const isKid = accountType === "kid";
  const [themeIdx, setThemeIdx] = useState(0);
  const theme = SHARE_THEMES[themeIdx];
  const [slogan, setSlogan] = useState((isKid ? KID_SLOGANS : GUEST_SLOGANS)[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const today = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
  const equipment = profile?.rpgEquip || {};
  const equippedCount = EQUIP_SLOT_DEFS.filter(s => equipment[s.id]?.itemId).length;
  const materialCount = countValues(profile?.materials || profile?.materialInventory);
  const catCount = countValues(profile?.cats || profile?.catCards || profile?.ownedCats);
  const battleStats = profile?.guestBattleStats || {};
  const totalArrows = battleStats.totalArrows || 0;
  const totalBattles = battleStats.totalBattles || 0;
  const totalWins = battleStats.totalWins || 0;
  const totalScore = battleStats.totalScore || 0;
  const avgScore = totalArrows > 0 ? Math.round((totalScore / totalArrows) * 10) / 10 : 0;
  const lastBattle = battleStats.last || null;
  const wbDmg = wbResult?.dmg || wbResult?.totalDmg || 0;
  const stats = [
    { icon:"💰", label:"金幣", value: coins ?? 0 },
    { icon:"🛡️", label:"裝備", value: `${equippedCount}/${EQUIP_SLOT_DEFS.length}` },
    { icon:"🏹", label:"箭數", value: totalArrows },
    { icon:"🏆", label:"勝場", value: `${totalWins}/${totalBattles}` },
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

  async function generate(action) {
    setBusy(true); setMsg("");
    try {
      const h2c = await ensureH2C();
      const canvas = await h2c(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true, logging: false });
      const blob = await new Promise(r => canvas.toBlob(r, "image/png", 0.95));
      const file = new File([blob], `貓小隊射箭場_${name}.png`, { type: "image/png" });
      if (action === "share" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "我的體驗紀念卡" });
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

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex flex-col items-center justify-start p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[320px] flex flex-col gap-3 my-auto" onClick={e => e.stopPropagation()}>

        <div ref={cardRef}
          style={{ width: "100%", aspectRatio: "9/16", borderRadius: 20, overflow: "hidden", position: "relative", color: "white", background: theme.bg, fontFamily: "sans-serif" }}>
          <div style={{ position: "absolute", right: -50, bottom: -50, width: 200, height: 200, borderRadius: "9999px", opacity: 0.15,
            background: "radial-gradient(circle, #fbbf24 0 18%, #fff 18% 34%, #ef4444 34% 50%, #fff 50% 66%, #1e293b 66% 82%, #fff 82% 100%)" }} />

          <div style={{ position: "relative", padding: "28px 22px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: theme.accent, fontWeight: 900, marginBottom: 4 }}>
              {isKid ? "🎈 貓小隊射箭場・兒童模式" : "🏹 貓小隊射箭場・體驗模式"}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 2, marginBottom: 20 }}>{today}</div>

            <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.1 }}>{name}</div>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>今天的體驗紀念</div>

            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {stats.map(stat => (
                <div key={stat.label} style={{ background: "rgba(255,255,255,.08)", borderRadius: 14, padding: "11px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{stat.icon}</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,.58)", fontWeight: 900, letterSpacing: 1 }}>{stat.label}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: theme.accent, marginTop: 4 }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {wbDmg > 0 && (
              <div style={{ marginTop: 10, background: "rgba(14,165,233,.16)", border: "1px solid rgba(125,211,252,.28)", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,.62)", fontWeight: 900, letterSpacing: 1 }}>最近世界王傷害</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: theme.accent, marginTop: 2 }}>{wbDmg.toLocaleString()}</div>
              </div>
            )}

            {(totalArrows > 0 || lastBattle) && (
              <div style={{ marginTop: 10, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,.62)", fontWeight: 900, letterSpacing: 1 }}>平均分</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: theme.accent, marginTop: 2 }}>{avgScore}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,.62)", fontWeight: 900, letterSpacing: 1 }}>最近表現</div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#e2e8f0", marginTop: 4 }}>
                      {lastBattle?.target || "冒險戰鬥"}・{lastBattle?.arrows || 0}箭
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
                      傷害 {(lastBattle?.damage || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ flex: 1 }} />

            <div style={{ fontSize: 16, fontWeight: 900, color: theme.accent, textAlign: "center" }}>{slogan}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.46)", textAlign: "center", marginTop: 6 }}>
              材料 {materialCount} ・ 貓咪 {catCount}
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", textAlign: "center", marginTop: 8, letterSpacing: 1 }}>
              CATARROW · 想正式加入道館歡迎詢問教練
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SHARE_THEMES.map((t, i) => (
            <button key={t.id} onClick={() => setThemeIdx(i)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border"
              style={themeIdx === i ? { background: t.accent, color: "#1e293b", borderColor: t.accent } : { background: "rgba(255,255,255,.08)", color: "white", borderColor: "rgba(255,255,255,.2)" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(isKid ? KID_SLOGANS : GUEST_SLOGANS).map(s => (
            <button key={s} onClick={() => setSlogan(s)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border"
              style={slogan === s ? { background: theme.accent, color: "#1e293b", borderColor: theme.accent } : { background: "rgba(255,255,255,.08)", color: "white", borderColor: "rgba(255,255,255,.2)" }}>
              {s}
            </button>
          ))}
        </div>

        {msg && <div className="text-center text-xs text-white/80 font-bold">{msg}</div>}

        <div className="flex gap-2">
          <button onClick={() => generate("download")} disabled={busy}
            className="flex-1 py-3 rounded-xl font-black text-sm text-white disabled:opacity-50"
            style={{ background: theme.bg }}>
            {busy ? "產生中…" : "💾 儲存圖片"}
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl font-black text-sm bg-white/10 text-white">關閉</button>
        </div>
      </div>
    </div>
  );
}
