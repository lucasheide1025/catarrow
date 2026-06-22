// src/components/member/CouncilBattle.jsx — 議會廳採集任務（貓村生活RPG）
import { useState, useRef, useEffect } from "react";
import { calcDamage } from "../../lib/monsterData";
import { MATERIALS } from "../../lib/monsterMaterials";
import {
  COUNCIL_MONSTERS, TIER_META, LIFE_TIER_STATS, TIER_ORDER,
  getRaceMaterialId, BUILDING_PAIN_MSGS,
} from "../../lib/councilMonsters";
import {
  sfxTap, sfxArrowHit, sfxCritBoom, sfxSoftFail,
  sfxSuccess, sfxEpic, sfxRoundEnd, sfxMonsterDead,
} from "../../lib/sound";

const MAT_MAP = Object.fromEntries(MATERIALS.map(m => [m.id, m]));

const ARROWS_PER_ROUND = 6;
const DISTANCES = [5, 7, 10, 13.5, 15, 18];

const TARGET_OPTIONS = [
  { id:"standard", label:"全靶",   icon:"🎯", scores:["X","10","9","8","7","6","5","4","3","2","1","0"] },
  { id:"half",     label:"半靶",   icon:"◑",  scores:["X","10","9","8","7","6","5","4","3","2","1","0"] },
  { id:"field_16", label:"原野靶", icon:"🌿", scores:["6","5","4","3","2","1","0"] },
];

// ── 六大場景主題 ──────────────────────────────────────────────
const BUILDING_THEMES = {
  mine: {
    bg:          "linear-gradient(160deg,#1c1008,#1a1208,#0f0a05)",
    accent:      "#f97316",
    accentDim:   "#78350f",
    playerLabel: "礦工貓",
    playerColor: "#fb923c",
    hatType:     "helmet",
    obstacleBg:  "linear-gradient(135deg,#1f1a18,#2d2520)",
    deco:        ["⛏️","💎","🪨"],
  },
  farm: {
    bg:          "linear-gradient(160deg,#0d2c10,#14532d,#0a1f0c)",
    accent:      "#a3e635",
    accentDim:   "#365314",
    playerLabel: "農夫貓",
    playerColor: "#86efac",
    hatType:     "straw",
    obstacleBg:  "linear-gradient(135deg,#142b15,#1a3a1c)",
    deco:        ["🌾","🌱","🌿"],
  },
  harbor: {
    bg:          "linear-gradient(160deg,#0c1f3a,#0f2450,#071528)",
    accent:      "#38bdf8",
    accentDim:   "#0c4a6e",
    playerLabel: "漁夫貓",
    playerColor: "#7dd3fc",
    hatType:     "sailor",
    obstacleBg:  "linear-gradient(135deg,#0f2744,#162f50)",
    deco:        ["⚓","🌊","🐟"],
  },
  hunting: {
    bg:          "linear-gradient(160deg,#0f2d15,#14532d,#0a2010)",
    accent:      "#4ade80",
    accentDim:   "#14532d",
    playerLabel: "獵人貓",
    playerColor: "#86efac",
    hatType:     "hood",
    obstacleBg:  "linear-gradient(135deg,#122a18,#1a3822)",
    deco:        ["🏕️","🌲","🍃"],
  },
  market: {
    bg:          "linear-gradient(160deg,#2d1a08,#451a03,#1a0f05)",
    accent:      "#fbbf24",
    accentDim:   "#92400e",
    playerLabel: "商人貓",
    playerColor: "#fde68a",
    hatType:     "cap",
    obstacleBg:  "linear-gradient(135deg,#2d1a08,#3d2510)",
    deco:        ["🛒","🏮","🎪"],
  },
  warehouse: {
    bg:          "linear-gradient(160deg,#1a1535,#1e1b4b,#0f0d2b)",
    accent:      "#a78bfa",
    accentDim:   "#4c1d95",
    playerLabel: "倉管貓",
    playerColor: "#c4b5fd",
    hatType:     "hard",
    obstacleBg:  "linear-gradient(135deg,#1a1640,#22205a)",
    deco:        ["📦","🏗️","🔧"],
  },
};

const CSS = `
@keyframes cb-shake   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
@keyframes cb-pop     { 0%{transform:scale(0.8);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
@keyframes cb-fade-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes cb-bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes cb-float   { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-7px) rotate(1deg)} }
@keyframes cb-glow    { 0%,100%{opacity:0.4} 50%{opacity:1} }
@keyframes cb-pulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
`;

// ── 玩家職業貓 SVG ───────────────────────────────────────────
function PlayerCatSVG({ buildingId, theme }) {
  const c  = theme?.playerColor || "#fb923c";
  const cl = c + "bb";
  const ht = theme?.hatType || "cap";

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg viewBox="0 0 90 112" width={74} height={92}
        style={{ filter:`drop-shadow(0 6px 14px ${c}55)` }}>
        {/* shadow */}
        <ellipse cx="45" cy="108" rx="26" ry="5" fill="rgba(0,0,0,0.3)" />
        {/* body */}
        <ellipse cx="45" cy="82" rx="25" ry="27" fill={c} />
        <ellipse cx="45" cy="85" rx="16" ry="20" fill={cl} />
        {/* legs */}
        <ellipse cx="33" cy="101" rx="10" ry="8" fill={c} />
        <ellipse cx="57" cy="101" rx="10" ry="8" fill={c} />
        {/* head */}
        <circle cx="45" cy="46" r="25" fill={c} />
        {/* ears */}
        <polygon points="23,30 18,8 37,26"  fill={c} />
        <polygon points="67,30 72,8 53,26"  fill={c} />
        <polygon points="25,28 21,13 36,25" fill="#fda4af" />
        <polygon points="65,28 69,13 54,25" fill="#fda4af" />

        {/* ── hats ── */}
        {ht==="helmet" && <>
          <ellipse cx="45" cy="25" rx="25" ry="10" fill="#374151" />
          <ellipse cx="45" cy="17" rx="18" ry="13" fill="#4b5563" />
          <rect x="34" y="25" width="22" height="6" rx="3" fill="#f97316" />
          <rect x="20" y="23" width="50" height="5" rx="2" fill="#374151" opacity="0.7" />
        </>}
        {ht==="straw" && <>
          <ellipse cx="45" cy="26" rx="32" ry="8" fill="#92400e" />
          <ellipse cx="45" cy="18" rx="18" ry="12" fill="#d97706" />
          <ellipse cx="45" cy="17" rx="13" ry="9"  fill="#fbbf24" />
        </>}
        {ht==="sailor" && <>
          <ellipse cx="45" cy="27" rx="25" ry="7" fill="#1d4ed8" />
          <ellipse cx="45" cy="19" rx="18" ry="12" fill="#1d4ed8" />
          <rect x="29" y="17" width="32" height="5" rx="2" fill="white" />
          <circle cx="45" cy="19" r="4" fill="#1d4ed8" />
        </>}
        {ht==="hood" && <>
          <ellipse cx="45" cy="22" rx="24" ry="16" fill="#14532d" />
          <ellipse cx="45" cy="30" rx="18" ry="10" fill="#14532d" />
          <ellipse cx="45" cy="30" rx="14" ry="8"  fill="#166534" />
        </>}
        {ht==="cap" && <>
          <ellipse cx="45" cy="27" rx="24" ry="7" fill="#92400e" />
          <ellipse cx="45" cy="19" rx="18" ry="12" fill="#92400e" />
          <ellipse cx="57" cy="27" rx="13" ry="5" fill="#78350f" />
        </>}
        {ht==="hard" && <>
          <ellipse cx="45" cy="25" rx="27" ry="9"  fill="#f59e0b" />
          <ellipse cx="45" cy="16" rx="20" ry="13" fill="#f59e0b" />
          <ellipse cx="45" cy="15" rx="15" ry="9"  fill="#fcd34d" />
          <rect x="38" y="22" width="14" height="4" rx="2" fill="#d97706" />
        </>}

        {/* eyes */}
        <circle cx="37" cy="44" r="6"   fill="white" />
        <circle cx="53" cy="44" r="6"   fill="white" />
        <circle cx="38" cy="45" r="3.8" fill="#1c1008" />
        <circle cx="54" cy="45" r="3.8" fill="#1c1008" />
        <circle cx="39" cy="44" r="1.3" fill="white" />
        <circle cx="55" cy="44" r="1.3" fill="white" />
        {/* nose */}
        <ellipse cx="45" cy="52" rx="3" ry="2" fill="#f9a8d4" />
        {/* mouth */}
        <path d="M42,54 Q45,58 48,54" stroke="#f9a8d4" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        {/* whiskers */}
        <line x1="18" y1="50" x2="38" y2="52" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" />
        <line x1="18" y1="54" x2="38" y2="55" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" />
        <line x1="52" y1="52" x2="72" y2="50" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" />
        <line x1="52" y1="55" x2="72" y2="54" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" />
        {/* arms */}
        <ellipse cx="22" cy="78" rx="11" ry="15" fill={c} transform="rotate(-12 22 78)" />
        <ellipse cx="68" cy="78" rx="11" ry="15" fill={c} transform="rotate(12 68 78)" />
        {/* paws */}
        <ellipse cx="19" cy="91" rx="10" ry="7" fill={c} />
        <ellipse cx="71" cy="91" rx="10" ry="7" fill={c} />
        <line x1="15" y1="93" x2="17" y2="95" stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" />
        <line x1="19" y1="94" x2="19" y2="96" stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" />
        <line x1="23" y1="93" x2="21" y2="95" stroke="rgba(0,0,0,0.15)" strokeWidth="1.2" />
      </svg>
      <div style={{ fontSize:11, fontWeight:900, color: theme?.accent || "#f97316",
        textShadow:`0 0 8px ${theme?.accent || "#f97316"}88` }}>
        {theme?.playerLabel || "貓咪"}
      </div>
    </div>
  );
}

// ── 障礙視覺 ─────────────────────────────────────────────────
function ObstacleDisplay({ monster, tierMeta, theme, shaking }) {
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", gap:6,
      animation: shaking ? "cb-shake 0.4s ease" : "cb-float 3s ease-in-out infinite",
    }}>
      <div style={{
        width:90, height:90, borderRadius:22,
        background: theme?.obstacleBg || "rgba(255,255,255,0.05)",
        border:`2px solid ${tierMeta.color}55`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:52,
        boxShadow:`0 0 24px ${tierMeta.color}33, inset 0 0 20px rgba(0,0,0,0.25)`,
        position:"relative",
      }}>
        {monster?.emoji}
        <div style={{
          position:"absolute", inset:-5, borderRadius:26,
          border:`1.5px solid ${tierMeta.color}44`,
          animation:"cb-glow 2.5s ease-in-out infinite",
          pointerEvents:"none",
        }} />
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
        <div style={{
          fontSize:10, fontWeight:900, padding:"2px 10px", borderRadius:99,
          background:tierMeta.color, color:"white",
          boxShadow:`0 2px 8px ${tierMeta.color}66`,
        }}>{tierMeta.label}</div>
        <div style={{ fontSize:12, fontWeight:900, color:"white", textAlign:"center",
          maxWidth:100, lineHeight:1.3, textShadow:"0 1px 4px rgba(0,0,0,0.6)" }}>
          {monster?.name}
        </div>
      </div>
    </div>
  );
}

// ── HP 條 ────────────────────────────────────────────────────
function HpBar({ current, max, label, accent }) {
  const pct      = Math.max(0, current / (max || 1) * 100);
  const barColor = pct > 50 ? "#22c55e" : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10,
        color:"rgba(255,255,255,0.55)", marginBottom:3 }}>
        <span>{label}</span>
        <span style={{ fontWeight:800, color:"white" }}>
          {current}<span style={{ opacity:0.4 }}>/{max}</span>
        </span>
      </div>
      <div style={{ height:7, borderRadius:99, background:"rgba(255,255,255,0.1)", overflow:"hidden" }}>
        <div style={{
          height:7, borderRadius:99, width:`${pct}%`,
          background: barColor, transition:"width 0.4s ease",
          boxShadow:`0 0 8px ${barColor}99`,
        }} />
      </div>
    </div>
  );
}

// ── score helpers ────────────────────────────────────────────
function scoreVal(label) {
  if (label === "X") return 10;
  return parseInt(label, 10) || 0;
}
function getPartMult(label, targetFmt) {
  if (label === "0") return 0;
  if (targetFmt === "field_16") {
    const v = parseInt(label);
    if (v === 6) return 2.0; if (v === 5) return 1.5; if (v >= 3) return 1.2; return 1.0;
  }
  if (label === "X") return 2.0;
  const v = parseInt(label);
  if (v === 10) return 1.5; if (v >= 8) return 1.2; return 1.0;
}
function getMappedScore(label, targetFmt) {
  if (label === "X") return 10;
  const v = parseInt(label) || 0;
  if (targetFmt === "field_16" && v > 0) return Math.min(v + 5, 10);
  return v;
}

// ═══════════════════════════════════════════════════════════════
export default function CouncilBattle({ building, availableTiers, archerStats, village, onFinish, onBack }) {
  const { id:bId, name:bName, emoji:bEmoji, race, raceLabel } = building;
  const theme = BUILDING_THEMES[bId] || BUILDING_THEMES.mine;

  const monsters = availableTiers.map(tier => ({
    tier,
    ...COUNCIL_MONSTERS[bId][tier],
    ...LIFE_TIER_STATS[tier],
    maxHp: LIFE_TIER_STATS[tier].hp,
  }));

  const [phase,      setPhase]      = useState("setup");
  const [distance,   setDistance]   = useState(18);
  const [targetFmt,  setTargetFmt]  = useState("standard");
  const [mIdx,       setMIdx]       = useState(0);
  const [monsterHp,  setMonsterHp]  = useState(monsters[0]?.hp);
  const [archerHp,   setArcherHp]   = useState(archerStats.hp);
  const [round,      setRound]      = useState(1);
  const [arrows,     setArrows]     = useState([]);
  const [log,        setLog]        = useState([]);
  const [defeated,   setDefeated]   = useState([]);
  const [processing, setProcessing] = useState(false);
  const [shaking,    setShaking]    = useState(false);
  const [painEvent,  setPainEvent]  = useState(null);
  const [failedTier, setFailedTier] = useState(null);
  const logRef = useRef(null);

  const currentMonster = monsters[mIdx];
  const tierMeta       = TIER_META[currentMonster?.tier] || {};
  const isLastMonster  = mIdx === monsters.length - 1;
  const scoreLabels    = TARGET_OPTIONS.find(t => t.id === targetFmt)?.scores || TARGET_OPTIONS[0].scores;
  const isResolving    = phase === "resolving";
  const isFullClear    = defeated.length === monsters.length;
  const clearedTier    = defeated.length > 0 ? defeated[defeated.length - 1].tier : null;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function addLog(text, type = "normal") {
    setLog(prev => [...prev.slice(-50), { text, type }]);
  }
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
  function inputArrow(label) {
    if (arrows.length >= ARROWS_PER_ROUND || processing) return;
    setArrows(prev => [...prev, label]);
  }
  function undoArrow() {
    if (!arrows.length || processing) return;
    setArrows(prev => prev.slice(0, -1));
  }

  async function submitRound() {
    if (arrows.length < ARROWS_PER_ROUND || processing) return;
    setProcessing(true);
    setPhase("resolving");

    let curMonHp  = monsterHp;
    let curArchHp = archerHp;

    addLog(`⚔️ 第 ${round} 輪（${distance}m · ${TARGET_OPTIONS.find(t=>t.id===targetFmt)?.label}）`, "system");

    for (let i = 0; i < ARROWS_PER_ROUND; i++) {
      const label    = arrows[i];
      const partMult = getPartMult(label, targetFmt);
      const score    = getMappedScore(label, targetFmt);
      const dmg      = calcDamage({ score, archerATK:archerStats.atk, monsterDEF:currentMonster.def, partMult });

      if (partMult === 0) {
        sfxSoftFail();
        addLog(`第${i+1}箭 ${label} — 失誤！沒有效果`, "miss");
      } else if (partMult >= 2.0) {
        sfxCritBoom();
        addLog(`第${i+1}箭 ${label} — 爆擊！傷害 ${dmg} 💥`, "crit");
        setShaking(true); setTimeout(() => setShaking(false), 380);
      } else if (partMult >= 1.5) {
        sfxArrowHit();
        addLog(`第${i+1}箭 ${label} — 重擊！傷害 ${dmg}`, "hit");
        setShaking(true); setTimeout(() => setShaking(false), 300);
      } else {
        sfxTap();
        addLog(`第${i+1}箭 ${label} — 命中 ${dmg}`, "normal");
      }

      curMonHp = Math.max(0, curMonHp - dmg);
      setMonsterHp(curMonHp);
      await delay(1100);
      if (curMonHp <= 0) break;
    }

    if (curMonHp <= 0) {
      sfxMonsterDead();
      setTimeout(() => sfxSuccess(), 500);
      addLog(`✅ ${currentMonster.name} 解決了！任務完成！`, "win");
      const matId       = getRaceMaterialId(race, currentMonster.tier);
      const newDefeated = [...defeated, { tier:currentMonster.tier, materialId:matId }];
      setDefeated(newDefeated);
      await delay(700);
      setProcessing(false);
      if (isLastMonster) { sfxEpic(); setPhase("result"); }
      else setPhase("obstacle_clear");
      return;
    }

    sfxRoundEnd();
    const roundTotal = arrows.reduce((s, l) => s + scoreVal(l), 0);
    const hpPct      = Math.round(curMonHp / currentMonster.maxHp * 100);
    const statusTag  = hpPct <= 15 ? "⚠️ 快解決了！" : hpPct <= 35 ? "💪 繼續！" : "";
    addLog(`回合 ${round} 結算：${roundTotal}分　抵抗值剩 ${curMonHp} ${statusTag}`, "total");
    await delay(700);

    if (round % 2 === 0) {
      const msgs    = BUILDING_PAIN_MSGS[bId] || ["工作太辛苦，受傷了！"];
      const msg     = msgs[Math.floor(Math.random() * msgs.length)];
      const selfDmg = Math.max(5, Math.floor(archerStats.hp * 0.08));
      curArchHp     = Math.max(0, curArchHp - selfDmg);
      setArcherHp(curArchHp);
      setPainEvent({ msg, dmg:selfDmg });
      addLog(`😰 ${msg}（疲勞傷害 -${selfDmg}）`, "counter");
      await delay(1800);
      setPainEvent(null);

      if (curArchHp <= 0) {
        addLog("💀 精疲力竭…帶著已完成的任務先撤退！", "system");
        await delay(600);
        setProcessing(false);
        setFailedTier(currentMonster.tier);
        setPhase("result");
        return;
      }
    }

    setRound(r => r + 1);
    setArrows([]);
    setProcessing(false);
    setPhase("input");
  }

  function nextObstacle() {
    const next = mIdx + 1;
    setMIdx(next);
    setMonsterHp(monsters[next].hp);
    setRound(1);
    setArrows([]);
    setPhase("input");
    addLog(`--- 下一個任務：${monsters[next].name} ---`, "system");
  }

  // ══════════════════════════════════════════════════════════════
  // ── 設定畫面 ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  if (phase === "setup") {
    return (
      <div style={{ minHeight:"100vh", background:theme.bg, color:"white", padding:"16px 12px 80px", position:"relative", overflow:"hidden" }}>
        <style>{CSS}</style>
        {/* 背景裝飾 */}
        <div style={{ position:"absolute", top:20, right:16, fontSize:48, opacity:0.06, userSelect:"none" }}>{bEmoji}</div>
        <div style={{ position:"absolute", bottom:100, left:8, fontSize:28, opacity:0.05, userSelect:"none" }}>
          {(theme.deco||[]).join(" ")}
        </div>

        <button onClick={onBack} style={{ background:"none", border:"none", color:theme.accentDim, fontSize:14, cursor:"pointer", marginBottom:14 }}>← 返回</button>

        {/* 建築標頭 */}
        <div style={{
          borderRadius:20, padding:"18px 16px", marginBottom:18, textAlign:"center",
          background:`linear-gradient(135deg,${theme.accent}18,${theme.accent}08)`,
          border:`1.5px solid ${theme.accent}30`,
          boxShadow:`0 0 24px ${theme.accent}18`,
        }}>
          <div style={{ fontSize:60, marginBottom:8, animation:"cb-bounce 2s ease infinite" }}>{bEmoji}</div>
          <div style={{ fontWeight:900, fontSize:20, color:theme.accent, marginBottom:3 }}>{bName} 採集任務</div>
          <div style={{ fontSize:12, color:theme.accentDim }}>
            {raceLabel} · {monsters.length} 個障礙　·　{distance}m
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:18, marginTop:10, fontSize:13, color:"rgba(255,255,255,0.65)" }}>
            <span>❤️ <b>{archerStats.hp}</b></span>
            <span>⚔️ <b>{archerStats.atk}</b></span>
            <span>🛡️ <b>{archerStats.def}</b></span>
          </div>
        </div>

        {/* 靶面 */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontWeight:900, fontSize:12, color:theme.accentDim, marginBottom:8 }}>靶面</div>
          <div style={{ display:"flex", gap:8 }}>
            {TARGET_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setTargetFmt(t.id)} style={{
                flex:1, padding:"11px 4px", borderRadius:14, fontWeight:800, fontSize:13, cursor:"pointer",
                background: targetFmt===t.id ? `linear-gradient(135deg,${theme.accent},${theme.accentDim})` : `${theme.accent}0d`,
                border:`2px solid ${targetFmt===t.id ? theme.accent : `${theme.accent}25`}`,
                color: targetFmt===t.id ? "#1c1008" : theme.accent,
                transition:"all 0.15s",
              }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>

        {/* 距離 */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontWeight:900, fontSize:12, color:theme.accentDim, marginBottom:8 }}>射擊距離</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {DISTANCES.map(d => (
              <button key={d} onClick={() => setDistance(d)} style={{
                padding:"11px 0", borderRadius:14, fontWeight:800, fontSize:14, cursor:"pointer",
                background: distance===d ? `linear-gradient(135deg,${theme.accent},${theme.accentDim})` : `${theme.accent}0d`,
                border:`2px solid ${distance===d ? theme.accent : `${theme.accent}25`}`,
                color: distance===d ? "#1c1008" : theme.accent,
                transition:"all 0.15s",
              }}>{d}m</button>
            ))}
          </div>
        </div>

        {/* 障礙清單 */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontWeight:900, fontSize:12, color:theme.accentDim, marginBottom:10 }}>本次任務清單</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {monsters.map((m, i) => {
              const tm = TIER_META[m.tier];
              return (
                <div key={m.tier} style={{
                  display:"flex", alignItems:"center", gap:12,
                  borderRadius:14, padding:"12px 14px",
                  background:`${theme.accent}08`,
                  border:`1px solid ${theme.accent}18`,
                }}>
                  <div style={{
                    width:46, height:46, borderRadius:12,
                    background:`${tm.color}22`, border:`1.5px solid ${tm.color}44`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0,
                  }}>{m.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:9, fontWeight:900, padding:"1px 7px", borderRadius:99, background:tm.color, color:"white" }}>{tm.label}</span>
                      <span style={{ fontWeight:900, fontSize:13, color:"white" }}>{m.name}</span>
                    </div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)" }}>{m.action}</div>
                  </div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", textAlign:"right", flexShrink:0 }}>
                    <div>❤️{m.hp}</div><div>🛡️{m.def}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button onClick={() => { setPhase("input"); addLog(`🌟 任務開始！目標：${currentMonster.name}`, "system"); }} style={{
          width:"100%", padding:"16px 0", borderRadius:18, fontWeight:900, fontSize:17, cursor:"pointer",
          background:`linear-gradient(90deg,${theme.accent},${theme.accentDim})`,
          color:"#1c1008", border:"none",
          boxShadow:`0 4px 16px ${theme.accent}55`,
        }}>🌟 開始採集任務！</button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // ── 障礙擊破過場 ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  if (phase === "obstacle_clear") {
    const justDefeated = defeated[defeated.length - 1];
    const next         = monsters[mIdx + 1];
    return (
      <div style={{ minHeight:"100vh", background:theme.bg, color:"white", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:20 }}>
        <style>{CSS}</style>
        <div style={{ fontSize:80, animation:"cb-pop 0.4s ease" }}>✅</div>
        <div style={{ fontWeight:900, fontSize:22, color:theme.accent }}>{currentMonster.name} 解決了！</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)" }}>
          獲得 {raceLabel}·{TIER_META[justDefeated?.tier]?.label} 素材 ×1
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>體力：{archerHp} / {archerStats.hp}</div>
        {next && (
          <div style={{
            width:"100%", maxWidth:320, borderRadius:18, padding:16, textAlign:"center",
            background:`${theme.accent}0d`, border:`1.5px solid ${theme.accent}25`,
          }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginBottom:8 }}>下一個任務</div>
            <div style={{ fontSize:44 }}>{next.emoji}</div>
            <div style={{ fontWeight:900, fontSize:14, color:"white", marginTop:4 }}>{next.name}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:2 }}>{next.action}</div>
          </div>
        )}
        <button onClick={nextObstacle} style={{
          width:"100%", maxWidth:320, padding:"15px 0", borderRadius:18, fontWeight:900, fontSize:16, cursor:"pointer",
          background:`linear-gradient(90deg,${theme.accent},${theme.accentDim})`,
          color:"#1c1008", border:"none", boxShadow:`0 4px 16px ${theme.accent}55`,
        }}>繼續任務！</button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // ── 結算畫面 ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  if (phase === "result") {
    return (
      <div style={{ minHeight:"100vh", background:theme.bg, color:"white", padding:"16px 12px 80px", position:"relative" }}>
        <style>{CSS}</style>
        <div style={{
          borderRadius:22, padding:"22px 16px", textAlign:"center", marginBottom:16,
          animation:"cb-pop 0.4s ease",
          background: isFullClear
            ? "linear-gradient(135deg,#14532d,#166534)"
            : `linear-gradient(135deg,${theme.accentDim},${theme.accentDim}bb)`,
          border:`1.5px solid ${isFullClear ? "#4ade80" : theme.accent}44`,
        }}>
          <div style={{ fontSize:60, marginBottom:8 }}>{isFullClear ? "🏆" : "💪"}</div>
          <div style={{ fontWeight:900, fontSize:20, marginBottom:4 }}>{isFullClear ? "任務全部完成！" : "本次到此為止"}</div>
          <div style={{ fontSize:13, opacity:0.75 }}>
            {isFullClear ? "所有採集障礙都解決了！" : `完成了 ${defeated.length} / ${monsters.length} 個任務`}
          </div>
        </div>

        <div style={{
          borderRadius:18, padding:16, background:`${theme.accent}07`,
          border:`1px solid ${theme.accent}18`, marginBottom:14,
        }}>
          <div style={{ fontSize:12, fontWeight:900, color:theme.accent, marginBottom:10 }}>獲得素材</div>
          {defeated.length === 0
            ? <div style={{ color:"rgba(255,255,255,0.35)", fontSize:13 }}>未獲得素材</div>
            : defeated.map((d, i) => {
                const tm  = TIER_META[d.tier];
                const mat = MAT_MAP[d.materialId];
                return (
                  <div key={i} style={{
                    display:"flex", alignItems:"center", gap:10, marginBottom:8,
                    background:`${theme.accent}0a`, borderRadius:12, padding:"9px 12px",
                  }}>
                    <span style={{ fontSize:24 }}>{mat?.icon ?? "📦"}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:900, fontSize:13, color:"white" }}>{mat?.name ?? d.materialId}</div>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)" }}>{mat?.desc}</div>
                    </div>
                    <span style={{
                      fontSize:9, fontWeight:900, padding:"2px 8px", borderRadius:99,
                      background:tm.color+"33", color:tm.color, border:`1px solid ${tm.color}66`,
                    }}>{tm.label} ×1</span>
                  </div>
                );
              })
          }

          {(clearedTier || failedTier) && (
            <>
              <div style={{ height:1, background:`${theme.accent}20`, margin:"12px 0" }} />
              <div style={{ fontSize:12, fontWeight:900, color:theme.accent, marginBottom:8 }}>獎勵預覽</div>
              {clearedTier && (() => {
                const n     = TIER_ORDER.indexOf(clearedTier) + 1;
                const tiers = TIER_ORDER.slice(0, n);
                return (
                  <div style={{ fontSize:12, color:"white", lineHeight:2.1 }}>
                    <div>🌿 {raceLabel} T1素材 ×{5 + n * 5}</div>
                    {tiers.map(t => <div key={t}>📦 {TIER_META[t].label}種族寶箱 ×1</div>)}
                    {tiers.map(t => <div key={`c${t}`}>💰 {TIER_META[t].label}金幣寶箱 ×1</div>)}
                  </div>
                );
              })()}
              {failedTier && (() => {
                const n = TIER_ORDER.indexOf(failedTier) + 1;
                return (
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:2.1, marginTop:clearedTier?8:0 }}>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:2 }}>撤退補償</div>
                    <div>🌿 {raceLabel} T1素材 ×5</div>
                    <div>🎲 {Math.round((0.10 + n * 0.05)*100)}% 機率 +1~{n} 扭蛋幣</div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        <button onClick={() => onFinish({ race, clearedTier, failedTier })} style={{
          width:"100%", padding:"16px 0", borderRadius:18, fontWeight:900, fontSize:17, cursor:"pointer",
          background:"linear-gradient(90deg,#16a34a,#15803d)", color:"white", border:"none",
          boxShadow:"0 4px 16px rgba(22,163,74,0.5)",
        }}>領取並離開</button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // ── 戰鬥中（input / resolving）────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  const gridCols = scoreLabels.length > 7 ? 6 : scoreLabels.length;

  return (
    <div style={{
      minHeight:"100vh", background:theme.bg, color:"white",
      display:"flex", flexDirection:"column", position:"relative", overflow:"hidden",
    }}>
      <style>{CSS}</style>

      {/* 背景裝飾光暈 */}
      <div style={{
        position:"absolute", top:-60, right:-40, width:200, height:200, borderRadius:"50%",
        background:`radial-gradient(circle,${theme.accent}15,transparent 70%)`,
        pointerEvents:"none",
      }} />
      <div style={{
        position:"absolute", bottom:120, left:-40, width:160, height:160, borderRadius:"50%",
        background:`radial-gradient(circle,${theme.accent}10,transparent 70%)`,
        pointerEvents:"none",
      }} />

      {/* ── 頂部狀態列 ── */}
      <div style={{ padding:"10px 14px 0", display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:theme.accentDim, fontSize:13, cursor:"pointer" }}>← 退出</button>
        <div style={{ flex:1, textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.4)" }}>
          {bEmoji} {bName} · 第{mIdx+1}/{monsters.length}關 · 回合{round} · {distance}m
        </div>
        <div style={{ fontSize:10, color:theme.accentDim, fontWeight:800 }}>
          {TARGET_OPTIONS.find(t=>t.id===targetFmt)?.icon}
        </div>
      </div>

      {/* ── 戰鬥場景：玩家左 ↔ 障礙右 ── */}
      <div style={{
        flexShrink:0, padding:"12px 14px 8px",
        display:"flex", alignItems:"flex-end", gap:10,
      }}>
        {/* 左：玩家貓 + HP */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8, alignItems:"flex-start" }}>
          <HpBar current={archerHp} max={archerStats.hp} label="🏃 體力" accent={theme.accent} />
          <PlayerCatSVG buildingId={bId} theme={theme} />
        </div>

        {/* 中間：VS + 回合狀態 */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flexShrink:0, paddingBottom:24 }}>
          <div style={{ fontSize:9, fontWeight:900, color:"rgba(255,255,255,0.2)", letterSpacing:2 }}>ROUND</div>
          <div style={{ fontSize:22, fontWeight:900, color:theme.accent,
            textShadow:`0 0 12px ${theme.accent}88` }}>{round}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.18)", fontWeight:900 }}>VS</div>
        </div>

        {/* 右：障礙 + HP */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
          <HpBar current={monsterHp} max={currentMonster?.maxHp || 1} label="🛡️ 抵抗值" accent={theme.accent} />
          <ObstacleDisplay
            monster={currentMonster} tierMeta={tierMeta} theme={theme} shaking={shaking}
          />
        </div>
      </div>

      {/* 疲勞事件 overlay */}
      {painEvent && (
        <div style={{
          position:"absolute", top:"38%", left:"50%", transform:"translate(-50%,-50%)",
          zIndex:20, borderRadius:16, padding:"12px 20px", textAlign:"center",
          background:"rgba(239,68,68,0.92)", backdropFilter:"blur(8px)",
          border:"1.5px solid rgba(255,100,100,0.4)",
          animation:"cb-fade-up 0.3s ease",
          boxShadow:"0 8px 32px rgba(239,68,68,0.5)",
          pointerEvents:"none",
        }}>
          <div style={{ fontSize:14, fontWeight:900, color:"white" }}>😰 {painEvent.msg}</div>
          <div style={{ fontSize:12, color:"#fca5a5", marginTop:3 }}>體力 -{painEvent.dmg}</div>
        </div>
      )}

      {/* ── 戰鬥日誌 ── */}
      <div ref={logRef} style={{
        flex:1, overflowY:"auto", margin:"0 14px", borderRadius:14,
        padding:"10px 12px",
        background:`rgba(0,0,0,0.25)`,
        border:`1px solid ${theme.accent}18`,
        fontSize:11, lineHeight:1.9,
        backdropFilter:"blur(4px)",
        minHeight:80,
      }}>
        {log.map((l, i) => (
          <div key={i} style={{
            color: l.type==="win"     ? "#4ade80"
                 : l.type==="crit"   ? theme.accent
                 : l.type==="hit"    ? "#fb923c"
                 : l.type==="counter"? "#f87171"
                 : l.type==="total"  ? "#a3e635"
                 : l.type==="miss"   ? "rgba(255,255,255,0.25)"
                 : l.type==="system" ? "rgba(255,255,255,0.35)"
                 : "rgba(255,255,255,0.6)",
            animation: i===log.length-1 ? "cb-fade-up 0.2s ease" : "none",
          }}>{l.text}</div>
        ))}
        {log.length === 0 && (
          <div style={{ color:"rgba(255,255,255,0.2)" }}>射箭解決障礙！輸入本回合得分…</div>
        )}
      </div>

      {/* ── 底部輸分區 ── */}
      <div style={{
        flexShrink:0, padding:"8px 14px 22px",
        background:`linear-gradient(0deg,${theme.bg.split(",")[0].split("(")[1] || "#1c1008"} 70%,transparent)`,
      }}>
        {/* 已輸箭格 */}
        <div style={{ display:"flex", gap:5, justifyContent:"center", marginBottom:8 }}>
          {Array.from({ length:ARROWS_PER_ROUND }).map((_, i) => {
            const label    = arrows[i];
            const isFilled = label != null;
            const isGold   = label === "X" || label === "10" || label === "6";
            return (
              <div key={i} style={{
                width:40, height:40, borderRadius:12,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:900, fontSize:13,
                background: isFilled
                  ? isGold ? `${theme.accent}dd` : `${theme.accent}66`
                  : "rgba(255,255,255,0.05)",
                border:`1.5px solid ${isFilled ? "transparent" : `${theme.accent}20`}`,
                color: isFilled ? "#1c1008" : "rgba(255,255,255,0.2)",
                transition:"all 0.1s",
              }}>{label ?? "·"}</div>
            );
          })}
        </div>

        {/* 分數按鈕 */}
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${gridCols},1fr)`, gap:5, marginBottom:6 }}>
          {scoreLabels.map(label => {
            const isGold = label==="X" || label==="10" || label==="6";
            const disabled = isResolving || arrows.length >= ARROWS_PER_ROUND;
            return (
              <button key={label} onClick={() => inputArrow(label)}
                disabled={disabled}
                style={{
                  padding:"10px 0", borderRadius:12, fontWeight:900, fontSize:13, cursor:"pointer",
                  background: isGold ? `${theme.accent}28` : `${theme.accent}0f`,
                  border:`1px solid ${isGold ? `${theme.accent}60` : `${theme.accent}20`}`,
                  color: isGold ? theme.accent : "rgba(255,255,255,0.6)",
                  opacity: disabled ? 0.3 : 1,
                  transition:"opacity 0.15s",
                }}>{label}</button>
            );
          })}
        </div>

        {/* 確認 / 撤銷 */}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={undoArrow} disabled={isResolving || !arrows.length}
            style={{
              flex:1, padding:"12px 0", borderRadius:14, fontWeight:700, fontSize:13, cursor:"pointer",
              background:"rgba(255,255,255,0.05)", border:`1px solid ${theme.accent}25`,
              color:theme.accentDim, opacity:isResolving||!arrows.length ? 0.3 : 1,
            }}>← 撤銷</button>
          <button onClick={submitRound} disabled={isResolving || arrows.length < ARROWS_PER_ROUND}
            style={{
              flex:2, padding:"12px 0", borderRadius:14, fontWeight:900, fontSize:15, cursor:"pointer",
              border:"none",
              background: arrows.length >= ARROWS_PER_ROUND
                ? `linear-gradient(90deg,${theme.accent},${theme.accentDim})`
                : "rgba(255,255,255,0.05)",
              color: arrows.length >= ARROWS_PER_ROUND ? "#1c1008" : "rgba(255,255,255,0.2)",
              opacity: isResolving ? 0.5 : 1,
              boxShadow: arrows.length >= ARROWS_PER_ROUND ? `0 3px 12px ${theme.accent}55` : "none",
              transition:"all 0.15s",
            }}>
            {isResolving ? "結算中…" : `確認（${arrows.length}/${ARROWS_PER_ROUND}）`}
          </button>
        </div>
      </div>
    </div>
  );
}
