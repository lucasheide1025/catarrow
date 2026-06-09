// src/components/member/MemberDex.jsx
// 數位圖鑑牆（學生端）— 像素風徽章版 + 成就提示 + 公告系統
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getCertRecords, getCertification, subscribeDexGrants, getDexConfig, createNotification } from "../../lib/db";
import {
  AUTO_ACHIEVEMENTS, SPECIAL_GRANTS, DEX_CATEGORIES, RARITY_STYLE, RANK_STYLE,
  buildRoundAchievements, computeDexStats, buildCohortAchievement,
} from "../../lib/achievementDex";

/* ─── 像素風 CSS ─────────────────────────────────────────── */
const PIXEL_BADGE_STYLE = `
  .px-badge { display:flex; align-items:center; justify-content:center; position:relative; }
  .px-badge::before {
    content:""; position:absolute; inset:-3px; border-radius:6px;
    border:3px solid transparent; z-index:1; pointer-events:none;
  }
  .px-badge.rarity-common::before   { border-color:#94a3b8; }
  .px-badge.rarity-uncommon::before { border-color:#22c55e; }
  .px-badge.rarity-rare::before     { border-color:#3b82f6; }
  .px-badge.rarity-epic::before     { border-color:#a855f7; }
  .px-badge.rarity-legendary::before{ border-color:#f59e0b; box-shadow:0 0 0 1px #fcd34d44; }
  .px-badge.rarity-mythic::before   { border-color:#ef4444; box-shadow:0 0 0 2px #fca5a544; animation:mythic-pulse 1.5s ease-in-out infinite; }
  .px-badge.locked::before          { border-color:#cbd5e1; }
  @keyframes mythic-pulse { 0%,100%{box-shadow:0 0 4px #ef444488;} 50%{box-shadow:0 0 14px #ef4444cc;} }
  .px-tile {
    width:36px; height:36px; border-radius:3px;
    display:flex; align-items:center; justify-content:center;
    font-size:20px; line-height:1; position:relative; overflow:hidden;
  }
  .px-tile.unlocked { background:#1e293b; box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),2px 2px 0 0 rgba(0,0,0,.5); }
  .px-tile.locked   { background:#334155; opacity:.45; box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); }
  .px-tile.legendary-shine::after {
    content:""; position:absolute; top:0; left:-40%; width:30%; height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent);
    animation:px-shine 3s ease-in-out infinite;
  }
  @keyframes px-shine { 0%,100%{left:-40%} 50%{left:110%} }

  /* 成就彈出提示動畫 */
  @keyframes dex-pop-in  { 0%{transform:translateY(80px) scale(.8);opacity:0} 60%{transform:translateY(-6px) scale(1.04)} 100%{transform:translateY(0) scale(1);opacity:1} }
  @keyframes dex-pop-out { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(30px)} }
  .dex-toast-in  { animation:dex-pop-in  .5s cubic-bezier(.34,1.56,.64,1) forwards; }
  .dex-toast-out { animation:dex-pop-out .4s ease-in forwards; }

  /* 屆數格子專用 */
  .round-cell { position:relative; overflow:hidden; }
  .round-cell::after {
    content:""; position:absolute; inset:0; border-radius:10px;
    background:linear-gradient(135deg,rgba(255,255,255,.08) 0%,transparent 60%);
    pointer-events:none;
  }
`;

const rarityClass = r => ({ common:"rarity-common", uncommon:"rarity-uncommon", rare:"rarity-rare", epic:"rarity-epic", legendary:"rarity-legendary", mythic:"rarity-mythic" }[r] || "rarity-common");
const rarityLabelColor = r => ({ common:"#64748b", uncommon:"#16a34a", rare:"#2563eb", epic:"#9333ea", legendary:"#d97706", mythic:"#dc2626" }[r] || "#64748b");

// 紫色（epic）以上需要公告
const ANNOUNCE_RARITIES = new Set(["epic", "legendary", "mythic"]);

// 已提示過的成就 id，存 localStorage，跨 mount/重整都不重複
function getShownIds(uid) {
  try { return new Set(JSON.parse(localStorage.getItem(`dex_shown_${uid}`) || "[]")); }
  catch { return new Set(); }
}
function saveShownIds(uid, ids) {
  try { localStorage.setItem(`dex_shown_${uid}`, JSON.stringify([...ids])); } catch {}
}

/* ─── 主元件 ─────────────────────────────────────────────── */
export default function MemberDex({ onBack }) {
  const { profile } = useAuth();
  const [certRecords, setCertRecords]   = useState([]);
  const [certification, setCertification] = useState(null);
  const [granted, setGranted]           = useState([]);
  const [config, setConfig]             = useState({ physicalMax: 20, pointMax: 20 });
  const [cat, setCat]                   = useState("start");
  const [detail, setDetail]             = useState(null);

  // 成就提示佇列
  const [toastQueue, setToastQueue]     = useState([]);
  const [currentToast, setCurrentToast] = useState(null);
  const [toastOut, setToastOut]         = useState(false);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    if (!profile?.id) return;
    getCertRecords(profile.id).then(setCertRecords).catch(() => {});
    getCertification(profile.id).then(setCertification).catch(() => {});
    getDexConfig().then(setConfig).catch(() => {});
    const unsub = subscribeDexGrants(profile.id, setGranted);
    return () => unsub && unsub();
  }, [profile?.id]);

  const ctx   = { member: profile, certification, certRecords, checkinCount: profile?.dailyQuestCount || 0 };
  const stats = computeDexStats({ ...ctx, granted, physicalMax: config.physicalMax, pointMax: config.pointMax });

  // ── 偵測新解鎖，加入提示佇列 ──
  // localStorage 記錄已提示過的成就，跨 mount/重整/換頁都不重複觸發
  useEffect(() => {
    if (!profile?.id) return;

    const allAuto = AUTO_ACHIEVEMENTS.map(a => ({ ...a, unlocked: a.check(ctx) }));
    const shownIds = getShownIds(profile.id);

    // 已解鎖但還沒提示過的
    const newOnes = allAuto.filter(a => a.unlocked && !shownIds.has(a.id));
    if (newOnes.length === 0) return;

    // 先存起來，防止重複
    newOnes.forEach(a => shownIds.add(a.id));
    saveShownIds(profile.id, shownIds);

    setToastQueue(q => [...q, ...newOnes]);

    // 公告：epic 以上
    newOnes.forEach(a => {
      if (ANNOUNCE_RARITIES.has(a.rarity)) {
        createNotification({
          type: "high_score",
          title: `🏅 ${profile.nickname || profile.name} 解鎖了成就！`,
          content: `【${a.name}】${a.desc}`,
          targetMemberId: null,
          subjectMemberId: profile.id,
          subjectInfo: { nickname: profile.nickname || profile.name, archerNo: profile.archerNo || "", item: a.name, level: a.rarity },
        }, profile.id).catch(() => {});
      }
    });
  }, [profile?.id, certification, certRecords, granted]); // eslint-disable-line

  // ── 依序顯示提示 ──
  useEffect(() => {
    // 有 toast 在顯示中就不動
    if (currentToast !== null) return;
    // 佇列空了就停
    if (toastQueue.length === 0) return;

    const [next, ...rest] = toastQueue;
    setToastQueue(rest);
    setCurrentToast(next);
    setToastOut(false);

    // 清舊 timer
    if (toastTimerRef.current) {
      toastTimerRef.current.forEach(t => clearTimeout(t));
    }
    const t1 = setTimeout(() => setToastOut(true), 3000);
    const t2 = setTimeout(() => {
      setCurrentToast(null);
      setToastOut(false);
    }, 3500);
    toastTimerRef.current = [t1, t2];

    return () => {
      if (toastTimerRef.current) toastTimerRef.current.forEach(t => clearTimeout(t));
    };
  }, [toastQueue, currentToast]); // eslint-disable-line

  function cellsFor(catId) {
    if (catId === "cohort")   { const c = buildCohortAchievement(profile?.joinDate); return c ? [c] : []; }
    if (catId === "physical" || catId === "point") {
      const max = catId === "physical" ? config.physicalMax : config.pointMax;
      return buildRoundAchievements(catId, max, granted);
    }
    if (catId === "special") {
      const ids = new Set(granted.filter(g => g.type === "special").map(g => g.id));
      return SPECIAL_GRANTS.map(a => ({ ...a, unlocked: ids.has(a.id) }));
    }
    return AUTO_ACHIEVEMENTS.filter(a => a.cat === catId).map(a => ({ ...a, unlocked: a.check(ctx) }));
  }

  const cells   = cellsFor(cat);
  const isRound = cat === "physical" || cat === "point";

  return (
    <div className="p-4 flex flex-col gap-4">
      <style>{PIXEL_BADGE_STYLE}</style>

      {onBack && <button onClick={onBack} className="text-gray-500 text-sm self-start">← 返回</button>}

      {/* 標題 */}
      <div className="rounded-2xl p-5 text-white" style={{ background:"linear-gradient(135deg,#1e293b,#0e7490)" }}>
        <div className="text-xs tracking-widest text-cyan-200 font-black mb-1">數位圖鑑</div>
        <div className="text-2xl font-black mb-3">🎖️ 我的成就收藏</div>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-cyan-200 text-xs">收集進度</div>
            <div className="font-black text-xl">{stats.totalUnlocked} / {stats.totalAll}</div>
          </div>
          <div className="flex gap-2 ml-auto text-sm font-black">
            <span>🥇 {stats.gold}</span>
            <span>🥈 {stats.silver}</span>
            <span>🥉 {stats.bronze}</span>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full" style={{ width:`${stats.totalAll ? (stats.totalUnlocked/stats.totalAll*100) : 0}%` }} />
        </div>
      </div>

      {/* 分類標籤 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DEX_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${cat===c.id ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* 格子牆 */}
      {isRound ? (
        <RoundGrid cells={cells} catLabel={cat==="physical" ? "實體賽" : "積分賽"} onTap={setDetail} />
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {cells.length === 0 && cat === "cohort" && (
            <div className="col-span-4 text-gray-400 text-sm text-center py-6">尚未設定加入日期，無法判定期數</div>
          )}
          {cells.map(a => <DexCell key={a.id} a={a} onTap={() => setDetail(a)} />)}
        </div>
      )}

      {detail && <DexDetailModal a={detail} onClose={() => setDetail(null)} />}

      {/* 成就解鎖提示 */}
      {currentToast && <DexToast a={currentToast} out={toastOut} />}
    </div>
  );
}

/* ─── 像素風成就格 ────────────────────────────────────────── */
function DexCell({ a, onTap }) {
  const unlocked  = a.unlocked;
  const isHidden  = a.hidden && !unlocked;
  const isLegendary = (a.rarity === "legendary" || a.rarity === "mythic") && unlocked;

  return (
    <button onClick={onTap}
      className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-transform active:scale-95"
      style={{
        background: unlocked ? "#0f172a" : "#f8fafc",
        border: `1.5px solid ${unlocked ? (RARITY_STYLE[a.rarity]?.ring || "#94a3b8") : "#e2e8f0"}`,
      }}>
      <div className={`px-badge ${unlocked ? rarityClass(a.rarity) : "locked"}`}>
        <div className={`px-tile ${unlocked ? "unlocked" : "locked"} ${isLegendary ? "legendary-shine" : ""}`}>
          {isHidden ? "❓" : a.icon}
        </div>
      </div>
      <div style={{ fontSize:"10px", fontWeight:700, color: unlocked ? "#e2e8f0" : "#94a3b8",
        maxWidth:"100%", overflow:"hidden", display:"-webkit-box",
        WebkitLineClamp:2, WebkitBoxOrient:"vertical", textAlign:"center", lineHeight:1.3 }}>
        {isHidden ? "???" : a.name}
      </div>
      {unlocked
        ? <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: RARITY_STYLE[a.rarity]?.ring || "#94a3b8" }} />
        : !isHidden && <div style={{ fontSize:"10px", color:"#94a3b8" }}>🔒</div>
      }
    </button>
  );
}

/* ─── 屆數格（華麗重設計）────────────────────────────────── */
const ROUND_BG = {
  1: "linear-gradient(135deg,#7c3aed,#4f46e5)",   // 冠軍：紫藍
  2: "linear-gradient(135deg,#475569,#334155)",   // 亞軍：鋼鐵銀
  3: "linear-gradient(135deg,#92400e,#78350f)",   // 季軍：古銅棕
  0: "linear-gradient(135deg,#0369a1,#0c4a6e)",   // 參賽：深藍
};
const ROUND_BG_LOCKED = "linear-gradient(135deg,#1e293b,#0f172a)";

function RoundGrid({ cells, catLabel, onTap }) {
  const [open, setOpen] = useState(true);
  const unlockedCount = cells.filter(c => c.unlocked).length;

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50">
        <span className="text-gray-700 font-black text-sm">{catLabel}　已收集 {unlockedCount}/{cells.length} 屆</span>
        <span className="text-gray-400 text-xs">{open ? "▲ 收起" : "▼ 展開"}</span>
      </button>
      {open && (
        <div className="p-3 grid grid-cols-4 gap-2">
          {cells.map(c => {
            const rk = c.unlocked ? (RANK_STYLE[c.rank] || RANK_STYLE[0]) : null;
            const bg = c.unlocked ? (ROUND_BG[c.rank ?? 0] || ROUND_BG[0]) : ROUND_BG_LOCKED;
            return (
              <button key={c.id} onClick={() => onTap(c)}
                className="round-cell aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95"
                style={{
                  background: bg,
                  border: `2px solid ${c.unlocked ? (rk.ring + "aa") : "#1e293b"}`,
                  boxShadow: c.unlocked ? rk.glow : "none",
                }}>
                {c.unlocked ? (
                  <>
                    <div className="text-2xl leading-none">{rk.icon}</div>
                    <div style={{ fontSize:"11px", fontWeight:800, color:"#fff", textShadow:"0 1px 3px rgba(0,0,0,.8)" }}>
                      第{c.round}屆
                    </div>
                    <div style={{ fontSize:"9px", fontWeight:700, color:"rgba(255,255,255,.7)" }}>{rk.label}</div>
                  </>
                ) : (
                  <>
                    <div className="text-lg opacity-30">🔒</div>
                    <div style={{ fontSize:"10px", fontWeight:700, color:"rgba(255,255,255,.3)" }}>第{c.round}屆</div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── 成就解鎖提示 Toast ──────────────────────────────────── */
function DexToast({ a, out }) {
  const rs    = RARITY_STYLE[a.rarity] || RARITY_STYLE.common;
  const isEpicUp = ANNOUNCE_RARITIES.has(a.rarity);

  return (
    <div className={`fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 ${out ? "dex-toast-out" : "dex-toast-in"}`}
      style={{ width:"min(88vw,320px)" }}>
      <div className="rounded-2xl p-4 flex items-center gap-3 shadow-2xl"
        style={{
          background: "linear-gradient(135deg,#0f172a,#1e293b)",
          border: `2px solid ${rs.ring}`,
          boxShadow: rs.glow || "none",
        }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-3xl"
          style={{ background:"#1e293b", border:`2px solid ${rs.ring}` }}>
          {a.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize:"10px", fontWeight:700, color: rarityLabelColor(a.rarity), letterSpacing:"0.08em" }}>
            {isEpicUp ? "🎉 成就解鎖！已公告" : "✅ 成就解鎖"}
          </div>
          <div className="font-black text-white text-sm truncate">{a.name}</div>
          <div className="text-gray-400 truncate" style={{ fontSize:"11px" }}>{a.desc}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── 詳情彈窗 ───────────────────────────────────────────── */
function DexDetailModal({ a, onClose }) {
  const unlocked = a.unlocked;
  const isHidden = a.hidden && !unlocked;
  const rs = RARITY_STYLE[a.rarity] || RARITY_STYLE.common;
  const isRound = a.round != null;
  const rk = isRound && unlocked ? (RANK_STYLE[a.rank] || RANK_STYLE[0]) : null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 w-20 h-20 rounded-2xl flex items-center justify-center text-5xl"
          style={{
            background: unlocked ? "#0f172a" : "#f1f5f9",
            border: `3px solid ${unlocked ? (isRound ? rk?.ring : (rs?.ring || "#94a3b8")) : "#e2e8f0"}`,
            filter: unlocked ? "none" : "grayscale(1) opacity(.4)",
          }}>
          {isHidden ? "❓" : isRound ? (unlocked ? rk.icon : "🔒") : a.icon}
        </div>

        <div className="font-black text-xl text-gray-800 mb-1">
          {isHidden ? "??? 隱藏成就"
            : isRound ? `${a.cat==="physical" ? "實體賽" : "積分賽"} 第 ${a.round} 屆`
            : a.name}
        </div>

        {!isRound && !isHidden && (
          <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2"
            style={{ background:(rs?.ring||"#94a3b8")+"22", color:rarityLabelColor(a.rarity) }}>
            {rs?.label}
          </span>
        )}
        {isRound && unlocked && (
          <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 bg-amber-100 text-amber-700">{rk.label}</span>
        )}

        <div className="text-gray-500 text-sm mt-2">
          {isHidden ? (a.riddle || "達成隱藏條件即可解鎖")
            : isRound ? (unlocked ? "恭喜參與這一屆賽事！" : "參加這一屆即可點亮")
            : a.desc}
        </div>

        {unlocked && !isRound && !isHidden && <div className="text-emerald-600 text-sm font-bold mt-3">✅ 已解鎖</div>}
        {!unlocked && !isHidden && <div className="text-gray-400 text-sm mt-3">🔒 尚未解鎖</div>}

        <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold">關閉</button>
      </div>
    </div>
  );
}