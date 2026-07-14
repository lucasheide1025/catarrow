// src/components/member/MemberPractice.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { addPracticeLog, subscribePracticeLogs, subscribeMonsterLogs, updateMember, grantArrowMilestoneRewards, addArrowdew, subscribeMyCheckin, addArcherXP, finalizePracticeShootingSession } from "../../lib/db";
import { addCatXP } from "../../lib/catDb";
import { PRACTICE_ARCHER_XP_PER_ARROW } from "../../lib/archerLevel";
import { CAT_PRACTICE_XP } from "../../lib/catLevel";
import { getMilestonesReached, getRewardsForMilestone } from "../../lib/arrowMilestone";
import ArrowMilestonePopup from "./ArrowMilestonePopup";
import { useAuth } from "../../hooks/useAuth";
import { today } from "../../lib/constants";
import { normalizeEquipment, getDefaultBowType, getDefaultEquipSetId } from "../shared/Equipment";
import { Card, Spinner, useToast } from "../shared/UI";
import { LineChart, TrendBadge } from "../shared/GrowthChart";
import { TargetFaceInput } from "../shared/TargetFaceOverlay";
import { TARGET_FACE_FORMATS } from "../../lib/targetFace";
import ArcheryPerformanceReport from "../shared/ArcheryPerformanceReport";
import { battleBowLabel } from "../../lib/battlePractice";

// ── 深色半透明卡片樣式（與 MemberHome/Profile 相同風格）────────
const CS  = { background:"rgba(15,23,42,0.55)", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.1)" };
const CS2 = { background:"rgba(15,23,42,0.38)", backdropFilter:"blur(8px)",  border:"1px solid rgba(255,255,255,0.08)" };

// ── 常數 ─────────────────────────────────────────────────────
const TARGET_FORMATS = TARGET_FACE_FORMATS.map(format => ({
  ...format,
  min:format.minScore,
  max:format.maxScore,
  isTriple:format.layout === "vertical_triple",
}));
const BOW_OPTIONS = [
  { value:"recurve_bare", label:"裸弓" },
  { value:"recurve_full", label:"全配" },
  { value:"compound",     label:"獵弓" },
  { value:"traditional",  label:"傳統弓" },
];
const DISTANCES = [5, 10, 13.5, 15, 18, 20, 30, 50, 70];
const PRACTICE_PRESETS = [
  { id:"outdoor_recurve", label:"70m 反曲資格賽", desc:"122cm・6 箭 × 12 回", values:{ bowType:"recurve_full", distance:70, targetFormat:"full_110", arrowCount:6, roundCount:12, competitionMode:"wa30", matchType:"qualification" } },
  { id:"outdoor_compound",label:"50m 複合資格賽", desc:"80cm 六環・6 箭 × 12 回", values:{ bowType:"compound", distance:50, targetFormat:"compound_510", arrowCount:6, roundCount:12, competitionMode:"wa30", matchType:"qualification" } },
  { id:"recurve_match",   label:"反曲／裸弓局制", desc:"70m・3 箭・先得 6 局點", values:{ bowType:"recurve_full", distance:70, targetFormat:"full_110", arrowCount:3, roundCount:5, competitionMode:"wa30", matchType:"recurve_set" } },
  { id:"compound_match",  label:"複合弓累計賽",   desc:"50m・3 箭 × 5 回", values:{ bowType:"compound", distance:50, targetFormat:"compound_510", arrowCount:3, roundCount:5, competitionMode:"wa30", matchType:"compound_total" } },
  { id:"indoor_single",   label:"18m 室內單靶",   desc:"40cm・3 箭 × 20 回", values:{ distance:18, targetFormat:"indoor_40", arrowCount:3, roundCount:20, competitionMode:"wa30", matchType:"qualification" } },
  { id:"indoor_triple",   label:"18m 室內三連靶", desc:"40cm 三連・3 箭 × 20 回", values:{ distance:18, targetFormat:"triple", arrowCount:3, roundCount:20, competitionMode:"wa30", matchType:"qualification" } },
  { id:"custom",          label:"完全自訂",       desc:"自行設定距離、靶面與時限", values:{ matchType:"qualification" } },
];
const PRACTICE_RECOVERY_VERSION = 1;

function practiceRecoveryKey(memberId) {
  return `catarchery:practice-session:v${PRACTICE_RECOVERY_VERSION}:${memberId}`;
}

function loadPracticeRecovery(memberId) {
  if (!memberId || typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(practiceRecoveryKey(memberId)));
    return value?.version === PRACTICE_RECOVERY_VERSION && value?.memberId === memberId
      ? value
      : null;
  } catch {
    window.localStorage.removeItem(practiceRecoveryKey(memberId));
    return null;
  }
}

function savePracticeRecovery(memberId, data) {
  if (!memberId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(practiceRecoveryKey(memberId), JSON.stringify({
      version:PRACTICE_RECOVERY_VERSION,
      memberId,
      updatedAtMs:Date.now(),
      ...data,
    }));
  } catch {}
}

function clearPracticeRecovery(memberId) {
  if (!memberId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(practiceRecoveryKey(memberId));
  } catch {}
}

let practiceAudioContext = null;
function playRangeSignal(count = 1, frequency = 880) {
  try {
    practiceAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (practiceAudioContext.state === "suspended") practiceAudioContext.resume();
    const start = practiceAudioContext.currentTime;
    const signalSpacing = 0.9;
    const signalDuration = 0.68;
    for (let i = 0; i < count; i += 1) {
      const oscillator = practiceAudioContext.createOscillator();
      const gain = practiceAudioContext.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + i * signalSpacing);
      gain.gain.exponentialRampToValueAtTime(0.72, start + i * signalSpacing + 0.02);
      gain.gain.setValueAtTime(0.72, start + i * signalSpacing + signalDuration - 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * signalSpacing + signalDuration);
      oscillator.connect(gain).connect(practiceAudioContext.destination);
      oscillator.start(start + i * signalSpacing);
      oscillator.stop(start + i * signalSpacing + signalDuration + 0.01);
    }
  } catch {}
}

function announcePractice(text, enabled) {
  if (!enabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function getMinuteThresholds(allowedSeconds) {
  return Array.from(
    { length:Math.max(0, Math.floor((allowedSeconds - 1) / 60)) },
    (_, index) => (index + 1) * 60
  );
}

function scoreValue(score) {
  return score === "X" ? 10 : typeof score === "number" ? score : 0;
}

function generateOpponentArrows(count, average, fmt) {
  return Array.from({ length:count }, () => {
    const variation = (Math.random() + Math.random() + Math.random() - 1.5) * 2.4;
    const value = Math.max(fmt.min, Math.min(10, Math.round(Number(average) + variation)));
    return value === 10 && Math.random() < 0.28 ? "X" : value;
  });
}

// ── 工具函式 ─────────────────────────────────────────────────
function shortDate(s) {
  if (!s) return "";
  const [,m,d] = s.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function getFormat(log) {
  const f = TARGET_FORMATS.find(f => f.id === log?.targetFormat);
  if (f) return f;
  if (log?.targetFormat === "indoor_610") return TARGET_FORMATS.find(f => f.id === "half_610");
  return (log?.maxScore <= 6) ? TARGET_FORMATS[1] : TARGET_FORMATS[0];
}

function numericArr(rounds) {
  return rounds.flat().flatMap(score => score === "X" ? [10] : typeof score === "number" ? [score] : []);
}

function calcStats(rounds) {
  const all    = rounds.flat();
  const nums   = numericArr(rounds);
  const total  = nums.reduce((a,b) => a+b, 0);
  const misses = all.filter(s => s === "M").length;
  const xCount = all.filter(s => s === "X").length;
  const tenCount = all.filter(s => s === 10).length;
  return {
    total, misses, xCount, tenCount,
    arrows:      all.length,
    hitRate:     all.length ? Math.round((all.length-misses)/all.length*100) : 0,
    avgPerArrow: all.length ? +(total/all.length).toFixed(2) : 0,
  };
}

function scoreColor(s, fmt) {
  if (s === "M") return { bg:"#fef2f2", text:"#ef4444", border:"#fecaca" };
  if (s === "X") return { bg:"#fef08a", text:"#713f12", border:"#facc15" };
  const ratio = (s - fmt.min + 1) / (fmt.max - fmt.min + 1);
  if (ratio >= 0.9) return { bg:"#fef9c3", text:"#92400e", border:"#fde68a" };
  if (ratio >= 0.7) return { bg:"#dcfce7", text:"#166534", border:"#86efac" };
  if (ratio >= 0.4) return { bg:"#eff6ff", text:"#1d4ed8", border:"#bfdbfe" };
  return { bg:"#f8fafc", text:"#64748b", border:"#e2e8f0" };
}

function battleScoreColor(v) {
  if (v === "M" || v === 0) return { bg:"#fef2f2", text:"#ef4444" };
  if (v >= 9)  return { bg:"#fef9c3", text:"#92400e" };
  if (v >= 6)  return { bg:"#dcfce7", text:"#166534" };
  if (v >= 3)  return { bg:"#eff6ff", text:"#1d4ed8" };
  return { bg:"#f8fafc", text:"#64748b" };
}

function genButtons(fmt) {
  const arr = [];
  for (let i = fmt.max; i >= fmt.min; i--) arr.push(i);
  if (fmt.max === 10) arr.unshift("X");
  arr.push("M");
  return arr;
}

function startOfWeek() {
  const d = new Date(), day = d.getDay();
  d.setDate(d.getDate() - (day===0 ? 6 : day-1));
  d.setHours(0,0,0,0);
  return d;
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function bowLabel(b) { return BOW_OPTIONS.find(o=>o.value===b)?.label || b; }

function TargetFaceView({ fmt, arrowCount, arrows, onTap }) {
  return (
    <div className="flex justify-center py-1">
      <TargetFaceInput
        fmtId={fmt.id}
        radius={fmt.isTriple ? 52 : 126}
        arrowLabels={arrows.map(arrow => arrow.score)}
        arrowPositions={arrows.map(arrow => ({
          ...arrow,
          label:arrow.score,
          faceIndex:arrow.faceIndex ?? arrow.spotIdx ?? 0,
        }))}
        arrowsPerRound={arrowCount}
        onArrow={landing => onTap({
          score:landing.label === "X" || landing.label === "M"
            ? landing.label
            : Number(landing.label),
          nx:landing.nx,
          ny:landing.ny,
          spotIdx:landing.faceIndex,
          faceIndex:landing.faceIndex,
        })}
      />
    </div>
  );
}

function ScoreCardTable({ rounds }) {
  const arrowN = rounds[0]?.length || 6;
  let cumul = 0;
  function cellC(s) {
    if (s === "M") return { bg:"#c92a2a", text:"#fff" };
    if (s >= 9)  return { bg:"#e67700", text:"#fff" };
    if (s >= 7)  return { bg:"#c92a2a", text:"#fff" };
    if (s >= 5)  return { bg:"#1864ab", text:"#fff" };
    if (s >= 3)  return { bg:"#444",    text:"rgba(255,255,255,0.85)" };
    return              { bg:"#2a2a2a", text:"rgba(255,255,255,0.55)" };
  }
  const thS = { color:"rgba(255,255,255,0.5)", padding:"4px 2px", textAlign:"center", fontWeight:700, borderBottom:"1px solid rgba(255,255,255,0.1)", fontSize:11, whiteSpace:"nowrap" };
  const tdS = { padding:"3px 2px", textAlign:"center", borderBottom:"1px solid rgba(255,255,255,0.06)" };
  return (
    <Card className="p-3 mt-1" style={CS}>
      <div className="text-xs font-bold text-white/60 mb-2">📋 計分卡</div>
      <div className="overflow-x-auto">
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              <th style={thS}>波</th>
              {Array.from({ length: arrowN }, (_, i) => <th key={i} style={thS}>{i+1}</th>)}
              <th style={{ ...thS, color:"rgba(255,255,255,0.8)" }}>小計</th>
              <th style={{ ...thS, color:"#f59f00" }}>累積</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r, ri) => {
              const sub = numericArr([r]).reduce((a, b) => a + b, 0);
              cumul += sub;
              return (
                <tr key={ri}>
                  <td style={{ ...tdS, color:"rgba(255,255,255,0.4)", fontSize:11 }}>{ri+1}</td>
                  {r.map((s, j) => {
                    const c = cellC(s);
                    return (
                      <td key={j} style={tdS}>
                        <div style={{ width:21, height:21, borderRadius:"50%", display:"inline-flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:10, background:c.bg, color:c.text }}>
                          {s}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ ...tdS, color:"white", fontWeight:900, fontSize:12 }}>{sub}</td>
                  <td style={{ ...tdS, color:"#f59f00", fontWeight:900, fontSize:12 }}>{cumul}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── LandingAnalysis ───────────────────────────────────────────
function LandingAnalysis({ arrowPositions }) {
  if (!arrowPositions || arrowPositions.length === 0) return null;

  const valid = arrowPositions.filter(a => a.score !== "M" && a.nx != null && a.ny != null);
  if (valid.length === 0) return null;

  const cx = valid.reduce((s, a) => s + a.nx, 0) / valid.length;
  const cy = valid.reduce((s, a) => s + a.ny, 0) / valid.length;
  const radii = valid.map(a => Math.sqrt((a.nx - cx) ** 2 + (a.ny - cy) ** 2));
  const avgR = radii.reduce((s, r) => s + r, 0) / radii.length;
  const stdDev = Math.sqrt(radii.reduce((s, r) => s + (r - avgR) ** 2, 0) / radii.length);
  const maxR = Math.max(...radii);

  const topmost  = valid.reduce((a, b) => b.ny < a.ny ? b : a);
  const bottommost = valid.reduce((a, b) => b.ny > a.ny ? b : a);
  const leftmost = valid.reduce((a, b) => b.nx < a.nx ? b : a);
  const rightmost = valid.reduce((a, b) => b.nx > a.nx ? b : a);

  const diagnose = () => {
    const pos = [];
    if (cy < -0.15) pos.push("群心偏上");
    else if (cy > 0.15) pos.push("群心偏下");
    if (cx < -0.15) pos.push("群心偏左");
    else if (cx > 0.15) pos.push("群心偏右");
    if (pos.length === 0) pos.push("群心居中");
    const spread = stdDev < 0.15 ? "群集緊密" : stdDev > 0.4 ? "散布較廣" : "群集正常";
    return pos.join("") + "・" + spread;
  };

  const SIZE = 260, CX = SIZE / 2, CY = SIZE / 2, R = 118;
  const toSVG = (nx, ny) => [CX + nx * R, CY + ny * R];
  const [gcx, gcy] = toSVG(cx, cy);

  const diagText = diagnose();
  const offsetDir = cx < -0.15 ? "偏左" : cx > 0.15 ? "偏右" : "居中";
  const offsetV   = cy < -0.15 ? "偏上" : cy > 0.15 ? "偏下" : "居中";

  return (
    <div className="flex flex-col gap-2 mt-1">
      {/* ── 偏移統計 ── */}
      <Card className="p-3" style={CS}>
        <div className="text-xs font-bold text-white/60 mb-2">📊 偏移統計</div>
        <div className="flex flex-wrap gap-2 mb-2">
          <div className="flex flex-col items-center bg-blue-500/10 rounded-lg px-3 py-1.5 min-w-16">
            <span className="text-[10px] text-blue-300/70">平均半徑</span>
            <span className="text-base font-black text-blue-300">{(avgR*100).toFixed(0)}%</span>
          </div>
          <div className="flex flex-col items-center bg-purple-500/10 rounded-lg px-3 py-1.5 min-w-16">
            <span className="text-[10px] text-purple-300/70">1σ 離散</span>
            <span className="text-base font-black text-purple-300">±{(stdDev*100).toFixed(0)}%</span>
          </div>
          <div className="flex flex-col items-center bg-white/5 rounded-lg px-3 py-1.5 min-w-16">
            <span className="text-[10px] text-white/40">最大偏移</span>
            <span className="text-base font-black text-white/60">{(maxR*100).toFixed(0)}%</span>
          </div>
          <div className="flex flex-col items-center bg-yellow-500/10 rounded-lg px-3 py-1.5 flex-1">
            <span className="text-[10px] text-yellow-300/70">群心位置</span>
            <span className="text-sm font-black text-yellow-300">{offsetDir}・{offsetV}</span>
          </div>
        </div>
        <div className="text-center text-xs font-bold text-white/50 bg-white/5 rounded-lg py-1.5">
          {diagText}
        </div>
      </Card>

      {/* ── 落點分析 ── */}
      <Card className="p-3" style={CS}>
        <div className="text-xs font-bold text-white/60 mb-2">🎯 落點分析</div>
        <div className="flex justify-center">
          <svg width={SIZE} height={SIZE} style={{ display:"block" }}>
            <circle cx={CX} cy={CY} r={R} fill="#1a1a1a" />
            {[1,0.8,0.6,0.4,0.2].map((pct,i)=>(
              <circle key={i} cx={CX} cy={CY} r={R*pct} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={0.8} />
            ))}

            {avgR * R <= R && (
              <circle cx={CX} cy={CY} r={avgR * R} fill="none" stroke="#60a5fa" strokeWidth={1.5} />
            )}
            {(avgR + stdDev) * R <= R * 1.5 && (
              <circle cx={CX} cy={CY} r={Math.min((avgR + stdDev) * R, R)} fill="none" stroke="#a78bfa"
                strokeWidth={1.2} strokeDasharray="4 3" />
            )}
            {maxR * R <= R * 1.5 && (
              <circle cx={CX} cy={CY} r={Math.min(maxR * R, R)} fill="none" stroke="rgba(255,255,255,0.3)"
                strokeWidth={1} strokeDasharray="2 4" />
            )}

            {valid.map((a, i) => {
              const [ax, ay] = toSVG(a.nx, a.ny);
              return (
                <g key={i}>
                  <circle cx={ax} cy={ay} r={5} fill="#15803d" stroke="white" strokeWidth={1} />
                  <text x={ax} y={ay + 0.5} textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize={6} fontWeight="900">
                    {a.score === "M" ? "M" : a.score}
                  </text>
                </g>
              );
            })}

            <line x1={gcx-7} y1={gcy} x2={gcx+7} y2={gcy} stroke="#facc15" strokeWidth={2.5} />
            <line x1={gcx} y1={gcy-7} x2={gcx} y2={gcy+7} stroke="#facc15" strokeWidth={2.5} />

            {(() => {
              const [tx, ty] = toSVG(topmost.nx, topmost.ny);
              return <text x={tx} y={ty - 8} textAnchor="middle" fill="#fb923c" fontSize={9}>↑{topmost.score}</text>;
            })()}
            {(() => {
              const [bx, by] = toSVG(bottommost.nx, bottommost.ny);
              return <text x={bx} y={by + 12} textAnchor="middle" fill="#fb923c" fontSize={9}>↓{bottommost.score}</text>;
            })()}
            {(() => {
              const [lx, ly] = toSVG(leftmost.nx, leftmost.ny);
              return <text x={lx - 8} y={ly + 3} textAnchor="end" fill="#fb923c" fontSize={9}>←{leftmost.score}</text>;
            })()}
            {(() => {
              const [rx, ry] = toSVG(rightmost.nx, rightmost.ny);
              return <text x={rx + 8} y={ry + 3} textAnchor="start" fill="#fb923c" fontSize={9}>{rightmost.score}→</text>;
            })()}
          </svg>
        </div>
        <div className="mt-2 flex justify-center gap-2 text-[10px] text-white/40">
          <span className="flex items-center gap-1"><span style={{display:"inline-block",width:10,height:2,background:"#60a5fa",verticalAlign:"middle"}}/>平均半徑</span>
          <span className="flex items-center gap-1"><span style={{display:"inline-block",width:10,height:2,background:"#a78bfa",borderTop:"2px dashed #a78bfa",verticalAlign:"middle"}}/>1σ</span>
          <span className="flex items-center gap-1"><span style={{display:"inline-block",width:10,height:2,borderTop:"2px dotted rgba(255,255,255,0.4)",verticalAlign:"middle"}}/>最大</span>
          <span className="flex items-center gap-1"><span style={{color:"#facc15",fontWeight:900}}>×</span>群心</span>
        </div>
      </Card>
    </div>
  );
}

// ── SetupPhase ────────────────────────────────────────────────
function SetupPhase({ initial, equipSets, onStart }) {
  const [form, setForm] = useState(initial);
  const [customDist, setCustomDist] = useState("");
  const up = (k,v) => setForm(p => ({...p, [k]:v}));

  const fmt = TARGET_FORMATS.find(f=>f.id===form.targetFormat) || TARGET_FORMATS[0];
  const arrowsPerSpot = fmt.isTriple ? (form.arrowCount <= 3 ? 1 : 2) : null;

  function selectDist(d) { setCustomDist(""); up("distance", d); }
  function applyCustom() {
    const v = parseFloat(customDist);
    if (!isNaN(v) && v > 0) { up("distance", v); setCustomDist(""); }
  }
  function selectFormat(id) {
    up("targetFormat", id);
    const f = TARGET_FORMATS.find(x=>x.id===id);
    if (f?.isTriple) up("arrowCount", 3);
  }
  function applyPreset(preset) {
    setForm(current => ({ ...current, ...preset.values, presetId:preset.id, equipSetId:null }));
  }

  const btnSel  = "bg-blue-500 text-white border-blue-400";
  const btnIdle = "bg-white/10 text-white/70 border-white/20";
  const btn = (active) => `px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active?btnSel:btnIdle}`;

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="p-4" style={CS}>
        <div className="mb-2 text-xs font-bold text-white/70">資格賽預設</div>
        <div className="grid grid-cols-2 gap-2">
          {PRACTICE_PRESETS.map(preset => (
            <button type="button" key={preset.id} onClick={() => applyPreset(preset)}
              className={`min-h-16 touch-manipulation rounded-xl border p-2 text-left transition-[border-color,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                form.presetId === preset.id ? "border-blue-400 bg-blue-500/25" : "border-white/15 bg-white/5 hover:bg-white/10"
              }`}>
              <div className="text-xs font-black text-white">{preset.label}</div>
              <div className="mt-1 text-[10px] leading-relaxed text-white/45">{preset.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {form.matchType && form.matchType !== "qualification" ? (
        <Card className="p-4" style={CS}>
          <div className="mb-2 text-xs font-bold text-white/70">虛擬對手強度</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              [7.5, "俱樂部"], [8.5, "競技"], [9.3, "菁英"],
            ].map(([average, label]) => (
              <button type="button" key={average}
                onClick={() => up("opponentAverage", average)}
                className={`min-h-14 rounded-xl border text-xs font-black transition-colors ${
                  Number(form.opponentAverage || 8.5) === average
                    ? "border-rose-400 bg-rose-500/20 text-rose-200"
                    : "border-white/15 bg-white/5 text-white/60"
                }`}>
                {label}<span className="mt-0.5 block text-[9px] font-normal">均箭約 {average}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-white/40">
            對手每箭會依強度產生合理波動，完整箭值會寫入歷史紀錄。
          </p>
        </Card>
      ) : null}

      {/* 弓種 */}
      <Card className="p-4" style={CS}>
        <div className="text-xs font-bold text-white/70 mb-2">弓種</div>
        <div className="flex flex-wrap gap-2">
          {(equipSets.length > 0 ? equipSets : null)?.map(s => {
            const cat = s.bowCategory || "recurve_bare";
            const lbl = s.label || bowLabel(cat);
            const isActive = form.equipSetId ? form.equipSetId === s.id : form.bowType === cat;
            return (
              <button key={s.id} onClick={() => setForm(p => ({...p, bowType: cat, equipSetId: s.id}))} className={btn(isActive)}>
                {lbl}
                {s.label && s.label !== bowLabel(cat) &&
                  <span className="ml-1 opacity-50">({bowLabel(cat)})</span>}
              </button>
            );
          }) ?? BOW_OPTIONS.map(b => (
            <button key={b.value} onClick={() => up("bowType", b.value)} className={btn(form.bowType===b.value)}>
              {b.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4" style={CS}>
        <div className="mb-2 text-xs font-bold text-white/70">賽事計時</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["off", "一般練習", "不限制時間"],
            ["wa30", "30 秒／箭", "排名賽規格"],
            ["wa40", "40 秒／箭", "一般賽事"],
          ].map(([id, label, desc]) => (
            <button type="button" key={id} onClick={() => up("competitionMode", id)}
              className={`min-h-16 rounded-xl border p-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                (form.competitionMode || "off") === id ? "border-amber-400 bg-amber-500/20" : "border-white/15 bg-white/5"
              }`}>
              <div className="text-xs font-black text-white">{label}</div>
              <div className="mt-1 text-[9px] text-white/45">{desc}</div>
            </button>
          ))}
        </div>
        {(form.competitionMode || "off") !== "off" ? (
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-white/5 px-3">
            <input type="checkbox" checked={form.assistedCues !== false}
              onChange={event => up("assistedCues", event.target.checked)}
              className="size-4 accent-blue-500" />
            <span className="text-xs text-white/70">教練語音與每分鐘提示音</span>
          </label>
        ) : null}
      </Card>

      {/* 距離 */}
      <Card className="p-4" style={CS}>
        <div className="text-xs font-bold text-white/70 mb-2">距離</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {DISTANCES.map(d => (
            <button key={d} onClick={() => selectDist(d)} className={btn(form.distance===d)}>{d}m</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="number" min="1" max="200" step="0.5" value={customDist}
            onChange={e => setCustomDist(e.target.value)}
            onKeyDown={e => e.key==="Enter" && applyCustom()}
            placeholder="自行填入距離（m）"
            className="flex-1 border border-white/20 rounded-lg px-3 py-1.5 text-sm bg-white/10 text-white placeholder:text-white/30" />
          <button onClick={applyCustom} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold">確定</button>
        </div>
        {!DISTANCES.includes(form.distance) && form.distance > 0 && (
          <div className="text-xs text-blue-300 mt-1">已選：{form.distance}m（自訂）</div>
        )}
      </Card>

      {/* 靶紙格式 */}
      <Card className="p-4" style={CS}>
        <div className="text-xs font-bold text-white/70 mb-2">靶紙格式</div>
        <div className="grid grid-cols-2 gap-2">
          {TARGET_FORMATS.map(f => (
            <button key={f.id} onClick={() => selectFormat(f.id)}
              className={`py-2 rounded-xl text-xs font-bold border transition-all
                ${form.targetFormat===f.id ? "bg-green-600 text-white border-green-500" : "bg-white/10 text-white/70 border-white/20"}`}>
              {f.label}
              {f.isTriple && <div className="text-xs opacity-60 mt-0.5">上·中·下各 N 箭</div>}
            </button>
          ))}
        </div>
        {fmt.isTriple && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-xs font-bold text-white/70 mb-2">每靶箭數</div>
            <div className="flex gap-2">
              {[1,2].map(n => (
                <button key={n} onClick={() => up("arrowCount", n*3)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all
                    ${arrowsPerSpot===n ? "bg-green-600 text-white border-green-500" : "bg-white/10 text-white/70 border-white/20"}`}>
                  每靶 {n} 箭（共 {n*3} 箭/組）
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 計分方式 */}
      <Card className="p-4" style={CS}>
        <div className="text-xs font-bold text-white/70 mb-2">計分方式</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id:"button", label:"⌨️ 按鈕計分", desc:"點按鈕輸入分數" },
            { id:"target", label:"🎯 靶面點擊", desc:"點擊靶面互動計分" },
          ].map(m => (
            <button key={m.id} onClick={() => up("inputMode", m.id)}
              className={`py-2.5 px-3 rounded-xl text-left border transition-all
                ${(form.inputMode||"button") === m.id ? "bg-blue-600 border-blue-500" : "bg-white/10 border-white/20"}`}>
              <div className={`text-xs font-bold ${(form.inputMode||"button") === m.id ? "text-white" : "text-white/70"}`}>{m.label}</div>
              <div className={`text-[10px] mt-0.5 ${(form.inputMode||"button") === m.id ? "text-blue-200" : "text-white/40"}`}>{m.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* 箭數/組數 */}
      <Card className="p-4" style={CS}>
        <div className="grid grid-cols-2 gap-3">
          {!fmt.isTriple ? (
            <div>
              <div className="text-xs font-bold text-white/70 mb-2">每組箭數</div>
              <div className="flex gap-1.5">
                {[3,6,12].map(n => (
                  <button key={n} onClick={() => up("arrowCount", n)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all
                      ${form.arrowCount===n ? "bg-blue-500 text-white border-blue-400" : "bg-white/10 text-white/70 border-white/20"}`}>{n}</button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs font-bold text-white/70 mb-2">每組箭數</div>
              <div className="py-1.5 px-3 rounded-lg text-xs font-bold bg-green-600/30 text-green-300 border border-green-500/30 text-center">{form.arrowCount} 箭（鎖定）</div>
            </div>
          )}
          <div>
            <div className="text-xs font-bold text-white/70 mb-2">組數</div>
            <div className="flex gap-1.5">
              {[3,6,10,12,20].map(n => (
                <button key={n} onClick={() => up("roundCount", n)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all
                    ${form.roundCount===n ? "bg-blue-500 text-white border-blue-400" : "bg-white/10 text-white/70 border-white/20"}`}>{n}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 日期 + 備注 */}
      <Card className="p-4" style={CS}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-bold text-white/70 mb-1">日期</div>
            <input type="date" value={form.date} onChange={e => up("date", e.target.value)}
              className="w-full border border-white/20 rounded-lg px-3 py-1.5 text-sm bg-white/10 text-white" />
          </div>
          <div>
            <div className="text-xs font-bold text-white/70 mb-1">備注</div>
            <input type="text" value={form.note} onChange={e => up("note", e.target.value)}
              placeholder="選填"
              className="w-full border border-white/20 rounded-lg px-3 py-1.5 text-sm bg-white/10 text-white placeholder:text-white/30" />
          </div>
        </div>
      </Card>

      <div className="text-center text-xs text-blue-300 bg-blue-900/40 border border-blue-500/30 rounded-xl p-3">
        {(equipSets.find(s=>s.id===form.equipSetId)?.label || equipSets.find(s=>s.bowCategory===form.bowType)?.label) || bowLabel(form.bowType)}
        &nbsp;·&nbsp;{form.distance}m&nbsp;·&nbsp;{fmt.label}
        &nbsp;·&nbsp;{fmt.isTriple ? `每靶${arrowsPerSpot}箭` : `${form.arrowCount}箭`}×{form.roundCount}組
        &nbsp;（共 {form.arrowCount * form.roundCount} 箭）
        {(form.competitionMode || "off") !== "off" ? ` · 每組 ${form.arrowCount * (form.competitionMode === "wa40" ? 40 : 30)} 秒` : ""}
      </div>
      <button onClick={() => onStart(form)} className="w-full py-4 bg-blue-600 text-white font-black text-lg rounded-xl">
        🎯 開始練習
      </button>
    </div>
  );
}

// ── ScoringPhase ──────────────────────────────────────────────
function ScoringPhase({ form, initialSession, onSessionChange, onDone, onCancel }) {
  const fmt  = TARGET_FORMATS.find(f=>f.id===form.targetFormat) || TARGET_FORMATS[0];
  const btns = genButtons(fmt);
  const cols = btns.length <= 6 ? 3 : 4;
  const timed = (form.competitionMode || "off") !== "off";
  const secondsPerArrow = form.competitionMode === "wa40" ? 40 : 30;
  const matchType = form.matchType || "qualification";
  const isMatch = matchType !== "qualification";
  const [shootOff, setShootOff] = useState(()=>!!initialSession?.shootOff);
  const effectiveArrowCount = shootOff ? 1 : form.arrowCount;
  const allowedSeconds = shootOff ? 20 : effectiveArrowCount * secondsPerArrow;
  const [round, setRound] = useState(()=>initialSession?.round || 0);
  const [allR,  setAllR]  = useState(()=>initialSession?.allR || []);
  const [cur,   setCur]   = useState(()=>initialSession?.cur || []);
  const [positions, setPositions] = useState(()=>initialSession?.positions || []);
  const [allPositions, setAllPositions] = useState(()=>initialSession?.allPositions || []);
  const [stage, setStage] = useState(()=>initialSession?.stage || (timed ? "idle" : "shooting"));
  const restoredRemaining = initialSession?.deadlineMs
    ? Math.max(0, Math.ceil((initialSession.deadlineMs - Date.now()) / 1000))
    : allowedSeconds;
  const [remaining, setRemaining] = useState(()=>{
    if (!timed) return null;
    if (initialSession?.deadlineMs && (initialSession.stage === "preparation" || initialSession.stage === "shooting")) {
      return restoredRemaining;
    }
    return allowedSeconds;
  });
  const [roundTiming, setRoundTiming] = useState(()=>initialSession?.roundTiming || []);
  const [match, setMatch] = useState(()=>initialSession?.match || {
    type:matchType,
    playerSetPoints:0,
    opponentSetPoints:0,
    playerTotal:0,
    opponentTotal:0,
    opponentEnds:[],
    shootOff:null,
    result:null,
  });
  const deadlineRef = useRef(Number(initialSession?.deadlineMs) || 0);
  const startedAtRef = useRef(Number(initialSession?.startedAtMs) || (timed ? 0 : Date.now()));
  const announcedRef = useRef(new Set(
    initialSession?.stage === "shooting"
      ? getMinuteThresholds(allowedSeconds).filter(threshold => restoredRemaining <= threshold)
      : []
  ));
  const finishingRef = useRef(false);
  const timeUpHandledRef = useRef(false);
  const isTargetMode = (form.inputMode || "button") === "target";

  function addArrow(s, pos) {
    if (timed && stage !== "shooting") return;
    if (cur.length >= effectiveArrowCount) return;
    setCur(p => [...p, s]);
    if (pos) setPositions(p => [...p, { score: s, ...pos, round, arrow:cur.length + 1 }]);
  }

  const finishRound = useCallback((timedOut = false) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const now = Date.now();
    const missing = timedOut ? Math.max(0, effectiveArrowCount - cur.length) : 0;
    const completed = missing ? [...cur, ...Array.from({ length:missing }, () => "M")] : cur;
    const newAll = [...allR, completed];
    const newAllPos = [...allPositions, ...positions];
    const playerEndTotal = numericArr([completed]).reduce((sum, value) => sum + value, 0);
    const opponentArrows = isMatch
      ? generateOpponentArrows(effectiveArrowCount, form.opponentAverage || 8.5, fmt)
      : [];
    const opponentEndTotal = numericArr([opponentArrows]).reduce((sum, value) => sum + value, 0);
    let nextMatch = isMatch ? {
      ...match,
      playerTotal:match.playerTotal + (shootOff ? 0 : playerEndTotal),
      opponentTotal:match.opponentTotal + (shootOff ? 0 : opponentEndTotal),
      opponentEnds:shootOff ? match.opponentEnds : [...match.opponentEnds, opponentArrows],
    } : match;
    let matchComplete = false;
    let enterShootOff = false;

    if (shootOff) {
      const playerScore = scoreValue(completed[0]);
      const opponentScore = scoreValue(opponentArrows[0]);
      const playerPosition = positions[positions.length - 1];
      const playerDistance = playerPosition
        ? Math.sqrt((playerPosition.nx || 0) ** 2 + (playerPosition.ny || 0) ** 2)
        : Math.max(0.01, (10 - playerScore) / 10 + Math.random() * 0.08);
      const opponentDistance = Math.max(0.01, (10 - opponentScore) / 10 + Math.random() * 0.08);
      const winner = playerScore !== opponentScore
        ? (playerScore > opponentScore ? "player" : "opponent")
        : (playerDistance <= opponentDistance ? "player" : "opponent");
      nextMatch = {
        ...nextMatch,
        shootOff:{ playerScore:completed[0], opponentScore:opponentArrows[0], playerDistance, opponentDistance, winner },
        result:winner === "player" ? "win" : "loss",
      };
      matchComplete = true;
    } else if (matchType === "recurve_set") {
      const playerSetGain = playerEndTotal > opponentEndTotal ? 2 : playerEndTotal === opponentEndTotal ? 1 : 0;
      const opponentSetGain = opponentEndTotal > playerEndTotal ? 2 : playerEndTotal === opponentEndTotal ? 1 : 0;
      const playerSetPoints = match.playerSetPoints + playerSetGain;
      const opponentSetPoints = match.opponentSetPoints + opponentSetGain;
      nextMatch = { ...nextMatch, playerSetPoints, opponentSetPoints };
      if (playerSetPoints >= 6 || opponentSetPoints >= 6) {
        nextMatch.result = playerSetPoints > opponentSetPoints ? "win" : "loss";
        matchComplete = true;
      } else if (newAll.length >= 5 && playerSetPoints === 5 && opponentSetPoints === 5) {
        enterShootOff = true;
      }
    } else if (matchType === "compound_total" && newAll.length >= 5) {
      if (nextMatch.playerTotal === nextMatch.opponentTotal) {
        enterShootOff = true;
      } else {
        nextMatch.result = nextMatch.playerTotal > nextMatch.opponentTotal ? "win" : "loss";
        matchComplete = true;
      }
    }
    const nextTiming = timed ? [...roundTiming, {
      round:round + 1,
      startedAtMs:startedAtRef.current,
      endedAtMs:now,
      allowedSeconds,
      usedSeconds:Math.min(allowedSeconds, Math.max(0, Math.round((now - startedAtRef.current) / 1000))),
      remainingSeconds:timedOut ? 0 : Math.max(0, Math.ceil((deadlineRef.current - now) / 1000)),
      timedOut,
      timeoutArrows:missing,
    }] : roundTiming;
    if (timed && !timedOut) playRangeSignal(3, 990);
    const qualificationComplete = !isMatch && newAll.length >= form.roundCount;
    if (qualificationComplete || matchComplete) {
      announcePractice(nextMatch.result === "win" ? "比賽結束，你獲勝" : nextMatch.result === "loss" ? "比賽結束" : "練習完成", form.assistedCues !== false);
      onDone(newAll, newAllPos, {
        roundTiming:nextTiming,
        ...(isMatch ? { match:nextMatch } : {}),
      });
      return;
    }
    setAllR(newAll); setCur([]); setRound(r=>r+1);
    setAllPositions(newAllPos); setPositions([]);
    setRoundTiming(nextTiming);
    setMatch(nextMatch);
    setShootOff(enterShootOff || shootOff);
    const nextAllowedSeconds = enterShootOff ? 20 : (shootOff ? 20 : form.arrowCount * secondsPerArrow);
    setRemaining(timed ? nextAllowedSeconds : null);
    setStage(timed ? "idle" : "shooting");
    startedAtRef.current = timed ? 0 : Date.now();
    deadlineRef.current = 0;
    announcedRef.current = new Set();
    finishingRef.current = false;
    timeUpHandledRef.current = false;
  }, [allPositions, allR, allowedSeconds, cur, effectiveArrowCount, fmt, form.arrowCount, form.assistedCues, form.opponentAverage, form.roundCount, isMatch, match, matchType, onDone, positions, round, roundTiming, secondsPerArrow, shootOff, timed]);

  function startTimedEnd() {
    if (!timed || stage !== "idle") return;
    finishingRef.current = false;
    timeUpHandledRef.current = false;
    playRangeSignal(2, 880);
    announcePractice("射手進入發射線，預備", form.assistedCues !== false);
    deadlineRef.current = Date.now() + 10000;
    setRemaining(10);
    setStage("preparation");
  }

  useEffect(() => {
    if (!timed || (stage !== "preparation" && stage !== "shooting")) return undefined;
    const tick = () => {
      const now = Date.now();
      const nextRemaining = Math.max(0, Math.ceil((deadlineRef.current - now) / 1000));
      setRemaining(nextRemaining);
      if (stage === "preparation" && nextRemaining <= 0) {
        const shootingStartedAt = deadlineRef.current || now;
        const shootingDeadline = shootingStartedAt + allowedSeconds * 1000;
        const shootingRemaining = Math.max(0, Math.ceil((shootingDeadline - now) / 1000));
        startedAtRef.current = shootingStartedAt;
        deadlineRef.current = shootingDeadline;
        announcedRef.current = new Set(
          getMinuteThresholds(allowedSeconds).filter(threshold => shootingRemaining <= threshold)
        );
        setRemaining(shootingRemaining);
        if (shootingDeadline > now) {
          playRangeSignal(1, 980);
          announcePractice("開始射擊", form.assistedCues !== false);
        }
        setStage("shooting");
        return;
      }
      if (stage === "shooting") {
        for (const threshold of getMinuteThresholds(allowedSeconds)) {
          if (nextRemaining <= threshold && !announcedRef.current.has(threshold)) {
            announcedRef.current.add(threshold);
            if (form.assistedCues !== false) {
              playRangeSignal(1, 740);
              announcePractice(`剩餘 ${threshold} 秒`, true);
            }
          }
        }
        if (nextRemaining <= 0) {
          if (!timeUpHandledRef.current) {
            timeUpHandledRef.current = true;
            playRangeSignal(2, 660);
            announcePractice("時間結束，停止射擊", form.assistedCues !== false);
          }
          // 不鎖定輸入／不自動結束 — 射手自行按 M 補箭後按「下一組」
        }
      }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [allowedSeconds, finishRound, form.assistedCues, stage, timed]);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    if (stage !== "preparation" && stage !== "shooting") return undefined;
    const warn = event => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  useEffect(() => {
    onSessionChange?.({
      round,
      allR,
      cur,
      positions,
      allPositions,
      stage,
      shootOff,
      roundTiming,
      match,
      deadlineMs:deadlineRef.current,
      startedAtMs:startedAtRef.current,
    });
  }, [allPositions, allR, cur, match, onSessionChange, positions, round, roundTiming, shootOff, stage]);

  function nextRound() {
    finishRound(false);
  }
  const prevTotal  = numericArr(allR).reduce((a,b)=>a+b,0);
  const curNumeric = numericArr([cur]).reduce((a,b)=>a+b,0);
  const inputLocked = timed && stage !== "shooting";
  const timerColor = stage === "preparation" || (remaining !== null && remaining <= 0)
    ? "#ef4444"
    : remaining <= 30 ? "#facc15" : "#22c55e";

  return (
    <div className="flex flex-col gap-4 p-4">
      {timed ? (
        <Card className="p-4" style={{ ...CS, border:`2px solid ${timerColor}` }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-widest" style={{ color:timerColor }}>
                {stage === "idle" ? "等待進線" : stage === "preparation" ? "紅燈・預備" : remaining !== null && remaining <= 0 ? "紅燈・時間到" : remaining <= 30 ? "黃燈・最後 30 秒" : "綠燈・射擊"}
              </div>
              <div className="mt-1 text-xs text-white/50">
                {secondsPerArrow} 秒／箭・本回 {allowedSeconds} 秒
              </div>
            </div>
            <div className="font-mono text-5xl font-black tabular-nums" style={{ color:timerColor }}>
              {String(Math.floor((remaining || 0) / 60)).padStart(2, "0")}:{String((remaining || 0) % 60).padStart(2, "0")}
            </div>
          </div>
          {stage === "idle" ? (
            <button type="button" onClick={startTimedEnd}
              className="mt-4 min-h-12 w-full touch-manipulation rounded-xl bg-red-600 text-sm font-black text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
              啟動本回正式信號
            </button>
          ) : null}
          <div aria-live="polite" className="mt-2 text-center text-xs text-white/55">
            {stage === "preparation" ? "10 秒後一聲開始" : remaining !== null && remaining <= 0 ? "時間到⏱ 請停止射擊，剩餘箭數請手動按 M，完成後點「下一組」" : stage === "idle" ? "按下後播放兩聲進線信號" : "時間到不鎖定計分，未射箭請自行按 M"}
          </div>
        </Card>
      ) : null}

      {isMatch ? (
        <Card className="p-4" style={{ ...CS, border:"1px solid rgba(244,63,94,.35)" }}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-rose-300">
                {matchType === "recurve_set" ? "反曲／裸弓局制" : "複合弓累計制"}
              </div>
              <div className="text-[10px] text-white/40">虛擬對手・均箭約 {form.opponentAverage || 8.5}</div>
            </div>
            {shootOff ? <span className="rounded-full bg-amber-400/20 px-2 py-1 text-xs font-black text-amber-300">加射</span> : null}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div className="rounded-xl bg-blue-500/10 p-2">
              <div className="text-[10px] text-white/45">我的{matchType === "recurve_set" ? "局點" : "累計"}</div>
              <div className="text-3xl font-black text-blue-300">
                {matchType === "recurve_set" ? match.playerSetPoints : match.playerTotal}
              </div>
            </div>
            <span className="font-black text-white/30">VS</span>
            <div className="rounded-xl bg-rose-500/10 p-2">
              <div className="text-[10px] text-white/45">對手{matchType === "recurve_set" ? "局點" : "累計"}</div>
              <div className="text-3xl font-black text-rose-300">
                {matchType === "recurve_set" ? match.opponentSetPoints : match.opponentTotal}
              </div>
            </div>
          </div>
          {match.opponentEnds.length ? (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
              <span className="text-white/45">對手上一局</span>
              <span className="font-black text-rose-200">
                {match.opponentEnds[match.opponentEnds.length - 1].join("・")}
                {" = "}
                {numericArr([match.opponentEnds[match.opponentEnds.length - 1]]).reduce((sum, value) => sum + value, 0)}
              </span>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="p-4" style={CS}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/70">{shootOff ? "加射決勝" : `第 ${round+1} / ${form.roundCount} ${isMatch ? "局" : "組"}`}</span>
          <span className="text-xs text-white/50">{bowLabel(form.bowType)} · {form.distance}m · {fmt.label}</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5 mb-3">
          <div className="bg-blue-400 h-1.5 rounded-full transition-all" style={{ width:`${(round/form.roundCount)*100}%` }} />
        </div>
        {fmt.isTriple && effectiveArrowCount >= 3 && (
          <div className="flex gap-2 mb-2 text-xs justify-center">
            {["上","中","下"].map((s,i) => (
              <span key={i} className={`px-2 py-0.5 rounded-full ${Math.floor(cur.length/(effectiveArrowCount/3))===i ? "bg-blue-500/40 text-blue-200 font-bold" : "bg-white/10 text-white/40"}`}>
                {s}靶
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 justify-center flex-wrap mb-3">
          {Array.from({length:effectiveArrowCount},(_,i)=>{
            const s = cur[i];
            if (s===undefined) return (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/20 text-xs">●</div>
            );
            const c = scoreColor(s, fmt);
            return (
              <div key={i} className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-sm"
                style={{ background:c.bg, color:c.text, borderColor:c.border }}>{s}</div>
            );
          })}
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/70">本組：<strong className="text-blue-300">{curNumeric}</strong></span>
          <span className="text-white/70">累計：<strong className="text-green-300">{prevTotal+curNumeric}</strong></span>
        </div>
      </Card>

      {isTargetMode ? (
        <Card className="p-3" style={CS}>
          <TargetFaceView fmt={fmt} arrowCount={effectiveArrowCount} arrows={positions}
            onTap={({ score, nx, ny, spotIdx }) => addArrow(score, { nx, ny, ...(spotIdx !== undefined ? { spotIdx } : {}) })} />
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="text-white/40 text-xs flex-1">
              {cur.length < effectiveArrowCount ? `點擊靶面計分（${cur.length}/${effectiveArrowCount} 箭）` : "本組完成 →"}
            </div>
            <button onClick={() => addArrow("M", null)} disabled={inputLocked || cur.length >= effectiveArrowCount}
              className="px-4 py-1.5 rounded-xl border border-red-500/50 text-red-400 text-sm font-black disabled:opacity-30 bg-red-900/20 active:scale-95 transition-transform">
              脫靶 M
            </button>
          </div>
        </Card>
      ) : (
        <Card className="p-4" style={CS}>
          <div className="grid gap-3" style={{ gridTemplateColumns:`repeat(${cols},1fr)` }}>
            {btns.map(s => {
              const c = scoreColor(s, fmt);
              return (
                <button key={s} onClick={()=>addArrow(s)} disabled={inputLocked || cur.length>=effectiveArrowCount}
                  className="py-4 rounded-xl font-black text-xl border-2 disabled:opacity-30 transition-all active:scale-95"
                  style={{ background:c.bg, color:c.text, borderColor:c.border }}>{s}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        <button onClick={()=>{ setCur(p=>p.slice(0,-1)); if(isTargetMode) setPositions(p=>p.slice(0,-1)); }} disabled={inputLocked || cur.length===0}
          className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 font-bold text-sm disabled:opacity-30 bg-white/10">
          ← 刪除
        </button>
        <button onClick={nextRound} disabled={inputLocked || cur.length<effectiveArrowCount}
          style={{ flex:2 }}
          className="py-3 rounded-xl bg-blue-600 text-white font-black text-sm disabled:opacity-40">
          {shootOff ? "完成加射" : isMatch ? "確認本局 →" : round+1>=form.roundCount ? "完成練習 ✓" : "下一組 →"}
        </button>
      </div>

      {allR.length>0 && (
        <Card className="p-4" style={CS2}>
          <div className="text-xs text-white/50 font-bold mb-2">已完成各組</div>
          {allR.map((r,i)=>(
            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/10 last:border-0 text-xs">
              <span className="text-white/50 w-8">第{i+1}組</span>
              <div className="flex gap-1 flex-1">
                {r.map((v,j)=>{const c=scoreColor(v,fmt);return(
                  <span key={j} className="w-6 h-6 rounded-full flex items-center justify-center font-bold"
                    style={{ background:c.bg, color:c.text, fontSize:10 }}>{v}</span>
                );})}
              </div>
              <span className="font-bold text-white/70 text-sm">{numericArr([r]).reduce((a,b)=>a+b,0)}</span>
            </div>
          ))}
        </Card>
      )}
      <button onClick={() => {
        if (window.confirm("確定取消本次練習？尚未儲存的成績與計時紀錄會消失。")) onCancel();
      }} className="min-h-11 text-center text-xs text-white/40">取消練習</button>
    </div>
  );
}

// ── ResultPhase ───────────────────────────────────────────────
function ResultPhase({ form, rounds, arrowPositions, onSave, onRetry, saving }) {
  const fmt       = TARGET_FORMATS.find(f=>f.id===form.targetFormat) || TARGET_FORMATS[0];
  const stats     = calcStats(rounds);
  const roundSubs = rounds.map(r=>numericArr([r]).reduce((a,b)=>a+b,0));
  const maxSub    = Math.max(...roundSubs, 1);
  const timing = form.sessionDetails?.roundTiming || [];
  const matchResult = form.sessionDetails?.match || null;
  const timedOutArrows = timing.reduce((sum, entry) => sum + (entry.timeoutArrows || 0), 0);
  const avgUsedSeconds = timing.length
    ? Math.round(timing.reduce((sum, entry) => sum + (entry.usedSeconds || 0), 0) / timing.length)
    : 0;
  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="p-5" style={CS}>
        <div className="text-center mb-4">
          <div className="text-white/50 text-xs mb-1">{bowLabel(form.bowType)} · {form.distance}m · {fmt.label}</div>
          <div className="font-black text-5xl text-white">{stats.total}</div>
          <div className="text-white/50 text-sm mt-1">總環數 / {stats.arrows} 箭</div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[["均分",stats.avgPerArrow.toFixed(1)],["10+X",stats.tenCount+stats.xCount],["X",stats.xCount],["失誤",stats.misses]].map(([k,v])=>(
            <div key={k} className="bg-white/10 rounded-xl p-2.5 text-center">
              <div className="text-white/50 text-xs">{k}</div>
              <div className="font-black text-lg text-white">{v}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4" style={CS}>
        <div className="text-xs text-white/70 font-bold mb-3">各組成績</div>
        <div className="flex items-end gap-1" style={{ height:80 }}>
          {roundSubs.map((s,i)=>(
            <div key={i} className="flex flex-col items-center flex-1 gap-1">
              <div className="text-xs text-white/70">{s}</div>
              <div className="w-full bg-blue-400 rounded-t-sm" style={{ height:`${(s/maxSub)*48}px` }} />
              <div className="text-white/40" style={{ fontSize:9 }}>{i+1}</div>
            </div>
          ))}
        </div>
      </Card>
      <ScoreCardTable rounds={rounds} />
      {matchResult ? (
        <Card className="p-5 text-center" style={{ ...CS, border:`2px solid ${matchResult.result === "win" ? "#22c55e" : "#f43f5e"}` }}>
          <div className={`text-3xl font-black ${matchResult.result === "win" ? "text-green-300" : "text-rose-300"}`}>
            {matchResult.result === "win" ? "比賽獲勝" : "比賽落敗"}
          </div>
          <div className="mt-2 text-sm font-bold text-white/70">
            {matchResult.type === "recurve_set"
              ? `局點 ${matchResult.playerSetPoints}：${matchResult.opponentSetPoints}`
              : `累計 ${matchResult.playerTotal}：${matchResult.opponentTotal}`}
          </div>
          {matchResult.shootOff ? (
            <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              加射 {String(matchResult.shootOff.playerScore)}：{String(matchResult.shootOff.opponentScore)}
              ・距心 {(matchResult.shootOff.playerDistance * 100).toFixed(1)}%：
              {(matchResult.shootOff.opponentDistance * 100).toFixed(1)}%
            </div>
          ) : null}
        </Card>
      ) : null}
      {timing.length ? (
        <Card className="p-4" style={CS}>
          <div className="mb-3 text-xs font-black text-white/60">⏱️ 賽事節奏報告</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-green-500/10 p-2">
              <div className="text-[10px] text-white/45">平均用時</div>
              <div className="font-black text-green-300">{avgUsedSeconds} 秒</div>
            </div>
            <div className="rounded-xl bg-yellow-500/10 p-2">
              <div className="text-[10px] text-white/45">逾時回合</div>
              <div className="font-black text-yellow-300">{timing.filter(entry => entry.timedOut).length}</div>
            </div>
            <div className="rounded-xl bg-red-500/10 p-2">
              <div className="text-[10px] text-white/45">逾時箭</div>
              <div className="font-black text-red-300">{timedOutArrows}</div>
            </div>
          </div>
        </Card>
      ) : null}
      {!fmt.isTriple && <LandingAnalysis arrowPositions={arrowPositions} />}
      <div className="flex gap-3">
        <button onClick={onRetry} className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 font-bold text-sm bg-white/10">重新練習</button>
        <button onClick={onSave} disabled={saving} style={{ flex:2 }}
          className="py-3 rounded-xl bg-blue-600 text-white font-black text-sm disabled:opacity-60">
          {saving ? "儲存中…" : "儲存練習 ✓"}
        </button>
      </div>
    </div>
  );
}

// ── 總覽：評級與圓盤 ──────────────────────────────────────────
const RANKS = [
  { rank:"SSS", color:"#fbbf24", min:{ hit:97, high:70, stable:90, ten:25 } },
  { rank:"SS",  color:"#f59e0b", min:{ hit:94, high:60, stable:87, ten:18 } },
  { rank:"S",   color:"#ec4899", min:{ hit:90, high:50, stable:83, ten:12 } },
  { rank:"A",   color:"#10b981", min:{ hit:82, high:40, stable:78, ten:7  } },
  { rank:"B",   color:"#3b82f6", min:{ hit:72, high:30, stable:72, ten:4  } },
  { rank:"C",   color:"#6b7280", min:{ hit:60, high:20, stable:65, ten:0  } },
  { rank:"D",   color:"#9ca3af", min:{ hit:45, high:12, stable:0,  ten:0  } },
  { rank:"E",   color:"#9ca3af", min:{ hit:30, high:0,  stable:0,  ten:0  } },
  { rank:"F",   color:"#ef4444", min:{ hit:0,  high:0,  stable:0,  ten:0  } },
];
// 正規化任意 log 的箭矢為數字陣列
function getLogArrows(log) {
  if (log.roundScores) {
    return (log.roundScores||[]).flatMap(r=>(r.scores||[]).map(toNum));
  }
  const rounds = log.rounds;
  if (!Array.isArray(rounds) || rounds.length === 0) return [];
  // 二維陣列（練習 log）
  if (Array.isArray(rounds[0])) return rounds.flat().map(toNum);
  // 物件陣列（打怪 log：[{arrows, dmg, crits}]）
  return rounds.flatMap(r => Array.isArray(r?.arrows) ? r.arrows.map(toNum) : []);
}
function calcOverviewStats(anyLogs) {
  const allArrows = anyLogs.flatMap(getLogArrows);
  if (!allArrows.length) return null;
  const nums   = allArrows.filter(v=>typeof v==="number"&&v>0);
  const misses = allArrows.filter(v=>v===0||v==="M").length;
  const total  = nums.reduce((a,b)=>a+b,0);
  const count  = allArrows.length;
  const hitRate   = (count-misses)/count*100;
  const highRate  = nums.filter(v=>v>=8).length/count*100;
  const tenRate   = nums.filter(v=>v===10).length/count*100;
  const numericScores = allArrows.map(toNum);
  const avg       = count ? total/count : 0;
  const variance  = count ? numericScores.reduce((s,v)=>s+(v-avg)**2,0)/count : 0;
  const stdDev    = Math.sqrt(variance);
  const stability = Math.max(0,Math.min(100,100-stdDev*12));
  const dist = {};
  allArrows.forEach(v=>{ const k=v===0?"M":v; dist[k]=(dist[k]||0)+1; });
  return { hitRate, highRate, tenRate, stability, count, total, avg, stdDev, dist };
}
function getRank(stats) {
  if (!stats || stats.count<30) return null;
  for (const r of RANKS) {
    if (stats.hitRate>=r.min.hit && stats.highRate>=r.min.high &&
        stats.stability>=r.min.stable && stats.tenRate>=r.min.ten) return r;
  }
  return RANKS[RANKS.length-1];
}
function RadarDisc({ h, hi, st }) {
  const cx=80,cy=80,r=56;
  const axes=[{label:"命中",a:-90,v:h/100},{label:"高分",a:30,v:hi/100},{label:"穩定",a:150,v:st/100}];
  const pt=(a,ratio)=>[cx+r*ratio*Math.cos(a*Math.PI/180),cy+r*ratio*Math.sin(a*Math.PI/180)];
  const poly=axes.map(ax=>pt(ax.a,ax.v).join(",")).join(" ");
  return (
    <svg viewBox="0 0 160 160" className="w-36 h-36">
      {[0.25,0.5,0.75,1].map((g,i)=>(
        <polygon key={i} points={axes.map(ax=>pt(ax.a,g).join(",")).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={0.8}/>
      ))}
      {axes.map((ax,i)=>{const[x2,y2]=pt(ax.a,1);return(
        <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth={0.8}/>
      );})}
      <polygon points={poly} fill="rgba(59,130,246,0.28)" stroke="#60a5fa" strokeWidth={2}/>
      {axes.map((ax,i)=>{const[x,y]=pt(ax.a,ax.v);return <circle key={i} cx={x} cy={y} r={3.5} fill="#93c5fd"/>;})}
      {axes.map((ax,i)=>{const[x,y]=pt(ax.a,1.28);return(
        <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.8)" fontSize={9} fontWeight="bold">{ax.label}</text>
      );})}
    </svg>
  );
}
function DonutDisc({ dist, total }) {
  const cx=80,cy=80,R=60,ri=34;
  const DCOL={"M":"#ef4444",1:"#475569",2:"#64748b",3:"#818cf8",4:"#60a5fa",5:"#3b82f6",6:"#10b981",7:"#059669",8:"#84cc16",9:"#f59e0b",10:"#f97316"};
  const keys=["M",1,2,3,4,5,6,7,8,9,10].filter(k=>(dist[k]||0)>0);
  const toR=a=>a*Math.PI/180;
  function arc(a1,a2,r1,r2){
    const large=(a2-a1)>180?1:0;
    return `M${cx+r1*Math.cos(toR(a1))} ${cy+r1*Math.sin(toR(a1))} A${r1} ${r1} 0 ${large} 1 ${cx+r1*Math.cos(toR(a2))} ${cy+r1*Math.sin(toR(a2))} L${cx+r2*Math.cos(toR(a2))} ${cy+r2*Math.sin(toR(a2))} A${r2} ${r2} 0 ${large} 0 ${cx+r2*Math.cos(toR(a1))} ${cy+r2*Math.sin(toR(a1))}Z`;
  }
  let a=-90;
  const segs=keys.map(k=>{const da=(dist[k]/total)*360;const s={k,d:arc(a,a+da,R,ri),c:DCOL[k]||"#6b7280"};a+=da;return s;});
  return (
    <svg viewBox="0 0 160 160" className="w-36 h-36">
      {segs.map(({k,d,c})=><path key={k} d={d} fill={c} opacity={0.85}/>)}
      <text x={cx} y={cy-5} textAnchor="middle" fill="white" fontSize={16} fontWeight="bold">{total}</text>
      <text x={cx} y={cy+11} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={8}>箭</text>
    </svg>
  );
}

// 正規化各來源的箭值（WorldBoss 存 {label,score} 物件；舊打怪存字串 label）
function toNum(v) {
  if (typeof v === "number") return v;
  if (v && typeof v === "object") return typeof v.score === "number" ? v.score : (parseInt(v.score)||0);
  if (v === "M") return 0;
  if (v === "X") return 10;
  const n = parseInt(v);
  return isNaN(n) ? 0 : n;
}
function toLabel(v) {
  if (v && typeof v === "object") return v.label || String(v.score ?? 0);
  if (v === 0 || v === "M") return "M";
  return String(v);
}

// ── HistoryTab ─────────────────────────────────────────────────
const SOURCE_OPTS = [
  { id:"all",       label:"全部"      },
  { id:"practice",  label:"練習"      },
  { id:"monster",   label:"⚔️ 打怪"  },
  { id:"party",     label:"👥 組隊"  },
  { id:"dungeon",   label:"🏰 地下城" },
  { id:"worldboss", label:"🌍 世界王" },
  { id:"duel",      label:"⚔️ 決鬥"  },
];
const TYPE_BADGE = {
  practice:  { label:"練習",     bg:"rgba(59,130,246,0.3)",  text:"#93c5fd" },
  monster:   { label:"⚔️ 打怪",  bg:"rgba(239,68,68,0.3)",   text:"#fca5a5" },
  party:     { label:"👥 組隊",  bg:"rgba(139,92,246,0.3)",  text:"#c4b5fd" },
  dungeon:   { label:"🏰 地下城",bg:"rgba(16,185,129,0.3)",  text:"#6ee7b7" },
  worldboss: { label:"🌍 世界王", bg:"rgba(234,88,12,0.3)",   text:"#fdba74" },
  duel:      { label:"⚔️ 決鬥",  bg:"rgba(236,72,153,0.3)",  text:"#f9a8d4" },
};

function BattleContextSummary({ log }) {
  const members = Array.isArray(log.teamMembers) ? log.teamMembers : [];
  const mvp = members.find(member => member.id === log.mvpId);
  const rewards = log.rewards || null;
  const hasContext = members.length || log.role || log.damage != null || rewards;
  if (!hasContext) return null;
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
      {log.role ? (
        <div>
          <span className="text-white/40">我的站位</span>
          <div className="font-black text-blue-200">{log.role === "rear" ? "後衛" : "前衛"}</div>
        </div>
      ) : null}
      {log.damage != null ? (
        <div>
          <span className="text-white/40">造成傷害</span>
          <div className="font-black text-rose-300">{log.damage}</div>
        </div>
      ) : null}
      {members.length ? (
        <div className="col-span-2">
          <span className="text-white/40">隊伍</span>
          <div className="mt-0.5 text-white/70">
            {members.map(member => `${member.name}${member.id === log.mvpId ? "（MVP）" : ""}`).join("、")}
          </div>
          {mvp ? <div className="mt-1 font-black text-amber-300">🏆 MVP：{mvp.name}</div> : null}
        </div>
      ) : null}
      {rewards ? (
        <div className="col-span-2 border-t border-white/10 pt-2 text-white/60">
          <span className="text-white/40">獎勵：</span>
          {rewards.coins ? `🪙 ${rewards.coins}` : ""}
          {rewards.chests?.length ? `・📦 ${rewards.chests.length}` : ""}
          {rewards.materials?.length ? `・🧱 ${rewards.materials.length}` : ""}
          {rewards.card ? `・🃏 ${rewards.card.name || "怪物卡"}` : ""}
        </div>
      ) : null}
    </div>
  );
}

function HistoryTab({ logs, monsterLogs }) {
  const [expandLog,    setExpandLog]    = useState({});
  const [expandDist,   setExpandDist]   = useState({});
  const [sourceFilter, setSourceFilter] = useState("all");
  const [bowFilter,    setBowFilter]    = useState("");

  const practiceLogs = useMemo(()=>
    logs.filter(l=>!l.source)
      .map(l=>({...l,_type:"practice",_date:l.date||"",_ts:l.submittedAt?.seconds||0}))
      .sort((a,b)=>b._date.localeCompare(a._date)||b._ts-a._ts),
  [logs]);

  const otherLogs = useMemo(()=>{
    const party  = logs.filter(l=>l.source==="party")
      .map(l=>({...l,_type:"party",_date:l.date||"",_ts:l.submittedAt?.seconds||0}));
    const wb     = logs.filter(l=>l.source==="worldboss")
      .map(l=>({...l,_type:"worldboss",_date:l.date||"",_ts:l.submittedAt?.seconds||0}));
    const dungeon= logs.filter(l=>l.source==="dungeon")
      .map(l=>({...l,_type:"dungeon",_date:l.date||"",_ts:l.submittedAt?.seconds||0}));
    const duel   = logs.filter(l=>l.source==="duel")
      .map(l=>({...l,_type:"duel",_date:l.date||"",_ts:l.submittedAt?.seconds||0}));
    const monster= monsterLogs.map(l=>{
      const dt=l.createdAt?new Date(l.createdAt.seconds*1000):new Date();
      const rounds=(l.roundScores||[]).map(round=>(round.scores||[]).map(toNum));
      return {
        ...l,
        rounds,
        targetFormat:l.targetFormat||l.targetFmt||"full_110",
        _type:"monster",
        _date:dt.toISOString().slice(0,10),
        _ts:l.createdAt?.seconds||0,
      };
    });
    return [...party,...dungeon,...wb,...duel,...monster]
      .sort((a,b)=>b._date.localeCompare(a._date)||b._ts-a._ts);
  },[logs,monsterLogs]);

  const distGroups = useMemo(()=>{
    const src = bowFilter ? practiceLogs.filter(l=>l.bowType===bowFilter) : practiceLogs;
    const g = {};
    src.forEach(l=>{
      const d=String(l.distance||"?");
      if (!g[d]) g[d]={dist:Number(l.distance)||0,key:d,logs:[]};
      g[d].logs.push(l);
    });
    return Object.values(g).sort((a,b)=>a.dist-b.dist);
  },[practiceLogs,bowFilter]);

  const filteredOther = useMemo(()=>
    otherLogs.filter(l=>sourceFilter==="all"||l._type===sourceFilter),
  [otherLogs,sourceFilter]);

  const bowsUsed = useMemo(()=>[...new Set(practiceLogs.map(l=>l.bowType))],[practiceLogs]);
  const tabBtn=(active)=>`px-3 py-1 rounded-full text-xs font-bold border flex-shrink-0 transition-all
    ${active?"bg-blue-500 text-white border-blue-400":"bg-white/10 text-white/60 border-white/20"}`;
  const toggleLog =id=>setExpandLog(e=>({...e,[id]:!e[id]}));
  const toggleDist=d =>setExpandDist(e=>({...e,[d]:!e[d]}));

  const showPractice = sourceFilter==="all"||sourceFilter==="practice";
  const showOther    = sourceFilter==="all"||["monster","party","dungeon","worldboss","duel"].includes(sourceFilter);

  if (!logs.length&&!monsterLogs.length) return (
    <div className="p-8 text-center text-white/50 text-sm">還沒有歷史紀錄</div>
  );

  function PracticeCard({ log }) {
    const open=!!expandLog[log.id];
    const fmt=getFormat(log), st=calcStats(log.rounds||[]);
    return (
      <Card className="p-4" style={CS}>
        <button className="w-full text-left" onClick={()=>toggleLog(log.id)}>
          <div className="flex items-start justify-between mb-1.5">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-bold text-white text-sm">{shortDate(log.date)}</span>
                <span className="text-xs text-white/40">{bowLabel(log.bowType)} · {fmt.label}</span>
                {log.arrowPositions?.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold">🎯 靶面</span>
                )}
                {log.competition && (
                  <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                    ⏱️ {log.competition.secondsPerArrow} 秒／箭
                  </span>
                )}
                {log.match && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    log.match.result === "win" ? "bg-green-500/20 text-green-300" : "bg-rose-500/20 text-rose-300"
                  }`}>
                    {log.match.result === "win" ? "對戰勝利" : "對戰落敗"}
                  </span>
                )}
              </div>
              <div className="flex gap-2 text-xs text-white/50 flex-wrap">
                <span>命中 {st.hitRate}%</span>
                <span>失誤 {st.misses}</span>
                <span>{log.arrowCount}箭×{log.roundCount}組</span>
                {log.note&&<span className="text-blue-300 truncate max-w-20">{log.note}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-black text-xl text-white">{log.total??st.total}</div>
              <div className="text-xs text-white/50">{(log.avgPerArrow??st.avgPerArrow).toFixed(1)}/箭 {open?"▲":"▼"}</div>
            </div>
          </div>
        </button>
        {log.coachNote&&(
          <div className="mt-2 text-xs text-amber-300 bg-amber-900/30 border border-amber-500/30 rounded-lg p-2">
            💬 教練：{log.coachNote}
          </div>
        )}
        {open&&(log.rounds||[]).length>0&&(
          <div className="mt-3 pt-3 border-t border-white/10">
            {(log.rounds||[]).map((r,i)=>(
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/10 last:border-0">
                <span className="text-xs text-white/50 w-8">第{i+1}組</span>
                <div className="flex gap-1 flex-1">
                  {r.map((v,j)=>{const c=scoreColor(v,fmt);return(
                    <span key={j} className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
                      style={{background:c.bg,color:c.text}}>{v}</span>
                  );})}
                </div>
                <span className="font-bold text-white/70 text-sm">{numericArr([r]).reduce((a,b)=>a+b,0)}</span>
              </div>
            ))}
            {log.roundTiming?.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {log.roundTiming.map(entry => (
                  <div key={entry.round} className="rounded-lg bg-white/5 px-2 py-1.5 text-[10px] text-white/55">
                    第 {entry.round} 回・用時 {entry.usedSeconds} 秒
                    <span className={entry.timedOut ? "ml-1 font-black text-red-300" : "ml-1 text-green-300"}>
                      {entry.timedOut ? `逾時 ${entry.timeoutArrows} 箭` : `剩 ${entry.remainingSeconds} 秒`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {log.match ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                <div className="flex items-center justify-between font-black">
                  <span className="text-white/60">{log.match.type === "recurve_set" ? "局制結果" : "累計制結果"}</span>
                  <span className={log.match.result === "win" ? "text-green-300" : "text-rose-300"}>
                    {log.match.type === "recurve_set"
                      ? `${log.match.playerSetPoints}：${log.match.opponentSetPoints}`
                      : `${log.match.playerTotal}：${log.match.opponentTotal}`}
                  </span>
                </div>
                {log.match.shootOff ? (
                  <div className="mt-1 text-amber-300">
                    加射 {String(log.match.shootOff.playerScore)}：{String(log.match.shootOff.opponentScore)}
                    ・距心 {(log.match.shootOff.playerDistance * 100).toFixed(1)}%：
                    {(log.match.shootOff.opponentDistance * 100).toFixed(1)}%
                  </div>
                ) : null}
              </div>
            ) : null}
            {log.arrowPositions?.length>0 && !fmt.isTriple && (
              <div className="mt-3">
                <LandingAnalysis arrowPositions={log.arrowPositions} />
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }

  function OtherCard({ log }) {
    const open=!!expandLog[log.id];
    const badge=TYPE_BADGE[log._type];
    if (log._type==="monster") {
      const rounds=(log.roundScores||[]).map(r=>(r.scores||[]).map(toNum));
      const total=rounds.reduce((s,r)=>s+r.reduce((a,b)=>a+b,0),0);
      const won=log.result==="win";
      return (
        <Card className="p-4" style={CS}>
          <button className="w-full text-left" onClick={()=>toggleLog(log.id)}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:badge.bg,color:badge.text}}>{badge.label}</span>
                  <span className="font-bold text-white text-sm">{shortDate(log._date)}</span>
                </div>
                <div className="text-xs text-white/50">
                  {log.monsterName||"怪物"}
                  {log.bowType?` · ${battleBowLabel(log.bowType)}`:""}
                  {log.distance?` · ${log.distance}m`:""}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won?"bg-green-500/30 text-green-300":"bg-white/10 text-white/40"}`}>{won?"勝利":"落敗"}</span>
                <div className="font-black text-xl text-white">{total}</div>
              </div>
            </div>
            <div className="text-xs text-white/50">{rounds.length}組 <span className="text-white/20 ml-1">{open?"▲":"▼"}</span></div>
          </button>
          {log.coachNote&&<div className="mt-2 text-xs text-amber-300 bg-amber-900/30 border border-amber-500/30 rounded-lg p-2">💬 教練：{log.coachNote}</div>}
          {open&&rounds.length>0&&(
            <div className="mt-3 pt-3 border-t border-white/10">
              <BattleContextSummary log={log} />
              <ArcheryPerformanceReport
                rounds={rounds}
                targetFormat={log.targetFormat||log.targetFmt||"full_110"}
                arrowPositions={log.arrowPositions||[]}
              />
              <div className="mt-3 border-t border-white/10 pt-2">
              {rounds.map((r,i)=>{const sub=r.reduce((a,b)=>a+b,0);return(
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/10 last:border-0">
                  <span className="text-xs text-white/50 w-8">第{i+1}組</span>
                  <div className="flex gap-1 flex-1">
                    {r.map((v,j)=>{const c=battleScoreColor(v);return(
                      <span key={j} className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
                        style={{background:c.bg,color:c.text}}>{v===0?"M":v}</span>
                    );})}
                  </div>
                  <span className="font-bold text-white/70 text-sm">{sub}</span>
                </div>
              );})}
              </div>
            </div>
          )}
        </Card>
      );
    }
    // party / worldboss（rounds 可能含 {label,score} 物件，用 toNum 正規化）
    const won=log.result==="win";
    const numRounds=(log.rounds||[]).map(r=>r.map(toNum));
    const total=numRounds.flat().reduce((a,b)=>a+b,0);
    const label=log._type==="party"
      ? (log.monsterName||"組隊打怪")
      : log._type==="dungeon"
        ? (log.monsterName||"地下城")
        : log._type==="duel"
          ? (log.opponentName||"玩家決鬥")
          : (log.bossName||"世界王");
    const shootingContext = [
      log.bowType ? battleBowLabel(log.bowType) : null,
      log.distance ? `${log.distance}m` : null,
    ].filter(Boolean).join(" · ");
    return (
      <Card className="p-4" style={CS}>
        <button className="w-full text-left" onClick={()=>toggleLog(log.id)}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:badge.bg,color:badge.text}}>{badge.label}</span>
                <span className="font-bold text-white text-sm">{shortDate(log._date)}</span>
              </div>
              <div className="text-xs text-white/50">{label}{shootingContext?` · ${shootingContext}`:" · 射擊設定未記錄"}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won?"bg-green-500/30 text-green-300":"bg-white/10 text-white/40"}`}>{won?"勝利":"落敗"}</span>
              <div className="font-black text-xl text-white">{total}</div>
            </div>
          </div>
          <div className="text-xs text-white/50">{numRounds.length}組 <span className="text-white/20 ml-1">{open?"▲":"▼"}</span></div>
        </button>
        {log.coachNote&&<div className="mt-2 text-xs text-amber-300 bg-amber-900/30 border border-amber-500/30 rounded-lg p-2">💬 教練：{log.coachNote}</div>}
        {open&&numRounds.length>0&&(
          <div className="mt-3 pt-3 border-t border-white/10">
            <BattleContextSummary log={log} />
            <ArcheryPerformanceReport
              rounds={log.rounds||[]}
              targetFormat={log.targetFormat||log.targetFmt||"full_110"}
              arrowPositions={log.arrowPositions||[]}
            />
            <div className="mt-3 border-t border-white/10 pt-2">
            {numRounds.map((r,i)=>{const sub=r.filter(v=>v>0).reduce((a,b)=>a+b,0);return(
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/10 last:border-0">
                <span className="text-xs text-white/50 w-8">第{i+1}組</span>
                <div className="flex gap-1 flex-1">
                  {r.map((v,j)=>{const c=battleScoreColor(v);return(
                    <span key={j} className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
                      style={{background:c.bg,color:c.text}}>{v===0?"M":v}</span>
                  );})}
                </div>
                <span className="font-bold text-white/70 text-sm">{sub}</span>
              </div>
            );})}
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* 類型篩選 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SOURCE_OPTS.map(opt=>(
          <button key={opt.id} onClick={()=>setSourceFilter(opt.id)} className={tabBtn(sourceFilter===opt.id)}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* 弓種篩選（只在有練習紀錄時顯示） */}
      {showPractice && bowsUsed.length>1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={()=>setBowFilter("")} className={tabBtn(bowFilter==="")}>全弓種</button>
          {bowsUsed.map(b=>(
            <button key={b} onClick={()=>setBowFilter(f=>f===b?"":b)} className={tabBtn(bowFilter===b)}>
              {bowLabel(b)}
            </button>
          ))}
        </div>
      )}

      {/* 練習紀錄 — 按距離分組 */}
      {showPractice&&(
        <div className="flex flex-col gap-2">
          {distGroups.length===0&&<div className="text-center text-white/40 text-sm py-3">沒有練習紀錄</div>}
          {distGroups.map(group=>{
            const open=!!expandDist[group.key];
            const tot=group.logs.reduce((s,l)=>{const st=calcStats(l.rounds||[]);return s+(l.total??st.total);},0);
            const avg=(tot/group.logs.length)||0;
            return (
              <div key={group.key}>
                <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm text-white transition-all"
                  style={{background:"rgba(59,130,246,0.18)",border:"1px solid rgba(99,179,246,0.25)"}}
                  onClick={()=>toggleDist(group.key)}>
                  <span>📏 {group.key}m</span>
                  <span className="flex items-center gap-3 text-xs font-normal text-white/70">
                    <span>{group.logs.length}筆</span>
                    <span>均{avg.toFixed(0)}分</span>
                    <span>{open?"▲":"▼"}</span>
                  </span>
                </button>
                {open&&(
                  <div className="flex flex-col gap-2 mt-2 pl-2 border-l-2 border-blue-500/20 ml-2">
                    {group.logs.map(log=><PracticeCard key={log.id} log={log}/>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 戰鬥來源 — 類別統計 + 平面列表 */}
      {showOther&&(
        <>
          {showPractice&&filteredOther.length>0&&(
            <div className="text-xs text-white/40 font-bold mt-1 px-1">⚔️ 遊戲紀錄</div>
          )}
          {/* 選定遊戲類別時顯示該類別統計 */}
          {!showPractice&&filteredOther.length>0&&(()=>{
            const catStats=calcOverviewStats(filteredOther);
            const catRank=getRank(catStats);
            const winCount=filteredOther.filter(l=>l.result==="win"||l.result==="defeated").length;
            const wr=Math.round(winCount/filteredOther.length*100);
            const catInfo=TYPE_BADGE[sourceFilter]||{};
            return (
              <Card className="p-4 mb-1" style={CS}>
                <div className="text-xs font-bold mb-3" style={{color:catInfo.text||"#e2e8f0"}}>
                  {catInfo.label} 統計
                </div>
                {/* 勝負 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-white/50 mb-1">
                      <span>勝場率</span>
                      <span className="font-bold text-white/80">{winCount}/{filteredOther.length} 場（{wr}%）</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-1.5 rounded-full transition-all" style={{width:`${wr}%`,background:catInfo.text||"#60a5fa"}}/>
                    </div>
                  </div>
                </div>
                {catStats ? (
                  <>
                    {/* 指標列 */}
                    {[
                      {label:"命中率",val:catStats.hitRate,   color:"#60a5fa"},
                      {label:"高分率",val:catStats.highRate,  color:"#10b981"},
                      {label:"穩定性",val:catStats.stability, color:"#f59e0b"},
                      {label:"10分率",val:catStats.tenRate,   color:"#ec4899"},
                    ].map(m=>(
                      <div key={m.label} className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-white/50 w-12">{m.label}</span>
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-1.5 rounded-full" style={{width:`${Math.min(100,m.val)}%`,background:m.color}}/>
                        </div>
                        <span className="text-xs font-bold w-12 text-right" style={{color:m.color}}>{m.val.toFixed(1)}%</span>
                      </div>
                    ))}
                    {/* 圓盤 + 評級 */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/10">
                      <RadarDisc h={catStats.hitRate} hi={catStats.highRate} st={catStats.stability}/>
                      <div className="flex-1">
                        {catRank ? (
                          <>
                            <div className="font-black text-3xl" style={{color:catRank.color}}>{catRank.rank}</div>
                            <div className="text-xs text-white/40 mt-0.5">{catStats.count} 箭統計</div>
                          </>
                        ) : (
                          <div className="text-xs text-white/30">累積 {catStats.count} 箭<br/>（30箭解鎖評級）</div>
                        )}
                        <div className="text-xs text-white/40 mt-1">平均分 {catStats.avg.toFixed(1)}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-white/30 text-center py-2">箭矢資料不足</div>
                )}
              </Card>
            );
          })()}
          {filteredOther.map(log=><OtherCard key={log.id} log={log}/>)}
          {!showPractice&&filteredOther.length===0&&(
            <div className="text-center text-white/40 text-sm py-4">沒有紀錄</div>
          )}
        </>
      )}
    </div>
  );
}

// ── TrendView ─────────────────────────────────────────────────
function TrendView({ logs }) {
  const [selected, setSelected] = useState(null);
  const combos = useMemo(()=>{
    const c={};
    logs.forEach(l=>{ const key=`${l.bowType}_${l.distance}`; if(!c[key]) c[key]={bowType:l.bowType,distance:Number(l.distance),count:0}; c[key].count++; });
    return Object.values(c).sort((a,b)=>b.count-a.count);
  },[logs]);
  const sel=selected||(combos.length?`${combos[0].bowType}_${combos[0].distance}`:null);
  const trendPoints=sel?logs
    .filter(l=>`${l.bowType}_${Number(l.distance)}`===sel)
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(-30)
    .map(l=>({y:+((l.rounds?.length ? calcStats(l.rounds).avgPerArrow : l.avgPerArrow) || 0).toFixed(2),label:shortDate(l.date)})):[];
  const trendValues=trendPoints.map(p=>p.y);
  if (!logs.length) return <div className="text-center text-white/50 text-sm py-6">還沒有練習紀錄</div>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 flex-wrap">
        {combos.map(c=>{ const key=`${c.bowType}_${c.distance}`; return(
          <button key={key} onClick={()=>setSelected(key)}
            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all
              ${sel===key?"bg-green-600 text-white border-green-500":"bg-white/10 text-white/60 border-white/20"}`}>
            {bowLabel(c.bowType)} {c.distance}m <span className="opacity-60">×{c.count}</span>
          </button>
        );})}
      </div>
      <Card className="p-4" style={CS}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-white/70 font-bold">均分／箭 趨勢</span>
          <TrendBadge values={trendValues} n={5} />
        </div>
        <LineChart points={trendPoints} color="#22c55e" height={120} />
        {trendPoints.length>=2&&(
          <div className="flex justify-between mt-2 text-xs text-white/50">
            <span>最高 <strong className="text-amber-400">{Math.max(...trendValues).toFixed(1)}</strong></span>
            <span>近 {trendPoints.length} 場</span>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── DistanceView ──────────────────────────────────────────────
function DistanceView({ logs }) {
  const combos = useMemo(()=>{
    const c={};
    logs.forEach(l=>{ const key=`${l.bowType}_${l.distance}`; if(!c[key]) c[key]={bowType:l.bowType,distance:Number(l.distance),logs:[]}; c[key].logs.push(l); });
    return Object.values(c).sort((a,b)=>b.logs.length-a.logs.length);
  },[logs]);
  if (!combos.length) return <div className="text-center text-white/50 text-sm py-6">還沒有練習紀錄</div>;
  return (
    <Card className="p-4" style={CS}>
      <div className="grid grid-cols-4 text-xs text-white/50 font-bold px-1 pb-2 border-b border-white/10">
        <span>弓種/距離</span><span className="text-center">場次</span>
        <span className="text-center">最高/箭</span><span className="text-center">最近/箭</span>
      </div>
      {combos.map(c=>{
        const sorted=[...c.logs].sort((a,b)=>a.date.localeCompare(b.date));
        const avgs=sorted.map(l=>l.rounds?.length ? calcStats(l.rounds).avgPerArrow : (l.avgPerArrow||0));
        const best=avgs.length?Math.max(...avgs):0, last=avgs.length?avgs[avgs.length-1]:0;
        return (
          <div key={`${c.bowType}_${c.distance}`} className="grid grid-cols-4 items-center py-2.5 border-b border-white/10 last:border-0">
            <div>
              <div className="text-white font-bold text-xs">{bowLabel(c.bowType)}</div>
              <div className="text-white/50 text-xs">{c.distance}m</div>
            </div>
            <div className="text-center text-white/70 font-bold text-sm">{c.logs.length}</div>
            <div className="text-center text-amber-400 font-black text-sm">{best.toFixed(1)}</div>
            <div className="text-center">
              <span className={`font-black text-sm ${last>=best?"text-green-400":"text-blue-300"}`}>{last.toFixed(1)}</span>
              {last>=best&&<div className="text-green-400 leading-none" style={{ fontSize:9 }}>PB!</div>}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ── GoalForm ──────────────────────────────────────────────────
function GoalForm({ initial, onSave, onCancel }) {
  const [form, setForm]=useState(initial), [saving,setSaving]=useState(false);
  const up=(k,v)=>setForm(p=>({...p,[k]:v}));
  async function handleSave(){
    setSaving(true);
    await onSave({...form,targetAvg:Number(form.targetAvg)||0,weeklyTarget:Number(form.weeklyTarget)||0});
    setSaving(false);
  }
  const btnBase=(active)=>`transition-all border text-xs font-bold
    ${active?"bg-blue-600 text-white border-blue-500":"bg-white/10 text-white/70 border-white/20"}`;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="w-full rounded-t-2xl p-5 flex flex-col gap-4" style={{ background:"rgba(15,23,42,0.92)",backdropFilter:"blur(12px)",maxHeight:"85vh",overflowY:"auto" }}>
        <div className="flex justify-between items-center">
          <div className="font-bold text-white">{initial.id?"編輯目標":"新增目標"}</div>
          <button onClick={onCancel} className="text-white/50 text-2xl leading-none">×</button>
        </div>
        <div>
          <div className="text-xs font-bold text-white/50 mb-2">目標類型</div>
          <div className="flex gap-2">
            {[["simple","簡單"],["complete","完整"]].map(([m,l])=>(
              <button key={m} onClick={()=>up("mode",m)} className={`flex-1 py-2 rounded-xl ${btnBase(form.mode===m)}`}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-white/50 mb-2">弓種</div>
          <div className="flex flex-wrap gap-2">
            {BOW_OPTIONS.map(b=>(
              <button key={b.value} onClick={()=>up("bowType",b.value)} className={`px-3 py-1.5 rounded-full ${btnBase(form.bowType===b.value)}`}>{b.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-white/50 mb-2">距離</div>
          <div className="flex flex-wrap gap-2">
            {DISTANCES.map(d=>(
              <button key={d} onClick={()=>up("distance",d)} className={`px-2.5 py-1 rounded-full ${btnBase(form.distance===d)}`}>{d}m</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-white/50 mb-2">靶紙格式</div>
          <div className="grid grid-cols-2 gap-2">
            {TARGET_FORMATS.map(f=>(
              <button key={f.id} onClick={()=>up("targetFormat",f.id)} className={`py-2 rounded-xl ${btnBase(form.targetFormat===f.id)}`}>{f.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-white/50 mb-1">目標均分/箭</div>
          <input type="number" step="0.1" min="0" max="10" value={form.targetAvg}
            onChange={e=>up("targetAvg",e.target.value)} placeholder="例：7.5"
            className="w-full border border-white/20 rounded-lg px-3 py-2 text-sm bg-white/10 text-white placeholder:text-white/30" />
        </div>
        {form.mode==="complete"&&(
          <>
            <div>
              <div className="text-xs font-bold text-white/50 mb-1">每週目標場次</div>
              <input type="number" min="1" max="30" value={form.weeklyTarget}
                onChange={e=>up("weeklyTarget",e.target.value)} placeholder="例：5"
                className="w-full border border-white/20 rounded-lg px-3 py-2 text-sm bg-white/10 text-white placeholder:text-white/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-bold text-white/50 mb-1">週期起</div>
                <input type="date" value={form.cycleStart} onChange={e=>up("cycleStart",e.target.value)}
                  className="w-full border border-white/20 rounded-lg px-3 py-2 text-sm bg-white/10 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-white/50 mb-1">週期訖</div>
                <input type="date" value={form.cycleEnd} onChange={e=>up("cycleEnd",e.target.value)}
                  className="w-full border border-white/20 rounded-lg px-3 py-2 text-sm bg-white/10 text-white" />
              </div>
            </div>
          </>
        )}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-blue-600 text-white font-black rounded-xl disabled:opacity-60">
          {saving?"儲存中…":"儲存目標"}
        </button>
      </div>
    </div>
  );
}

// ── GoalView ──────────────────────────────────────────────────
function GoalView({ logs, profile }) {
  const goals=profile?.practiceGoals||[];
  const [showAdd,setShowAdd]=useState(false), [editGoal,setEditGoal]=useState(null);
  const emptyGoal={ mode:"simple",bowType:"recurve_bare",distance:18,targetFormat:"full_110",targetAvg:"",weeklyTarget:"",cycleStart:"",cycleEnd:"" };

  async function saveGoal(g){
    const existing=profile?.practiceGoals||[];
    const updated=editGoal?existing.map(x=>x.id===g.id?g:x):[...existing,{...g,id:uid()}];
    await updateMember(profile.id,{practiceGoals:updated},profile.id);
    setShowAdd(false); setEditGoal(null);
  }
  async function deleteGoal(id){
    await updateMember(profile.id,{practiceGoals:(profile?.practiceGoals||[]).filter(g=>g.id!==id)},profile.id);
  }

  function getProgress(goal){
    const matched=logs.filter(l=>l.bowType===goal.bowType&&Number(l.distance)===Number(goal.distance));
    const recentAvgs=[...matched].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10)
      .map(l=>l.rounds?.length ? calcStats(l.rounds).avgPerArrow : (l.avgPerArrow||0));
    const recentAvg=recentAvgs.length?recentAvgs.reduce((a,b)=>a+b,0)/recentAvgs.length:0;
    const thisWeek=matched.filter(l=>new Date(l.date)>=startOfWeek()).length;
    let cycle=null;
    if (goal.mode==="complete"&&goal.cycleStart&&goal.cycleEnd){
      const start=new Date(goal.cycleStart),end=new Date(goal.cycleEnd),now=new Date();
      const elapsed=Math.max(0,Math.min(100,Math.round((now-start)/(end-start)*100)));
      const sessions=matched.filter(l=>{const d=new Date(l.date);return d>=start&&d<=end;}).length;
      cycle={elapsed,sessions};
    }
    return {recentAvg,thisWeek,cycle};
  }

  return (
    <div className="flex flex-col gap-4">
      {goals.length===0&&<div className="text-center text-white/50 text-sm py-6">還沒有設定目標</div>}
      {goals.map(g=>{
        const prog=getProgress(g);
        const fmt=TARGET_FORMATS.find(f=>f.id===g.targetFormat)||TARGET_FORMATS[0];
        const pct=g.targetAvg?Math.min(100,Math.round(prog.recentAvg/g.targetAvg*100)):0;
        return (
          <Card key={g.id} className="p-4" style={CS}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold text-white text-sm">{bowLabel(g.bowType)} · {g.distance}m</div>
                <div className="text-xs text-white/50">{fmt.label}{g.mode==="complete"?" · 完整模式":""}</div>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setEditGoal(g)} className="text-xs text-blue-300">編輯</button>
                <button onClick={()=>deleteGoal(g.id)} className="text-xs text-red-400">刪除</button>
              </div>
            </div>
            {!!g.targetAvg&&(
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1 text-white/70">
                  <span>目標均分 {g.targetAvg}/箭</span>
                  <span className="font-bold text-blue-300">{prog.recentAvg.toFixed(1)} / {g.targetAvg}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${pct>=100?"bg-green-500":"bg-blue-500"}`} style={{ width:`${pct}%` }} />
                </div>
                <div className="text-right text-xs text-white/50 mt-0.5">{pct}%</div>
              </div>
            )}
            {g.mode==="complete"&&(
              <div className="grid grid-cols-2 gap-2">
                {!!g.weeklyTarget&&(
                  <div className="bg-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-xs text-white/50">本週場次</div>
                    <div className="font-black text-lg text-white">{prog.thisWeek}<span className="text-xs text-white/50">/{g.weeklyTarget}</span></div>
                  </div>
                )}
                {prog.cycle&&(
                  <div className="bg-white/10 rounded-xl p-2.5 text-center">
                    <div className="text-xs text-white/50">週期進度</div>
                    <div className="font-black text-lg text-white">{prog.cycle.elapsed}<span className="text-xs text-white/50">%</span></div>
                    <div className="text-xs text-white/50">{prog.cycle.sessions} 場</div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
      <button onClick={()=>setShowAdd(true)}
        className="w-full py-3 border-2 border-dashed border-white/20 rounded-xl text-white/50 text-sm font-bold bg-white/10">
        + 新增目標
      </button>
      {showAdd&&<GoalForm initial={emptyGoal} onSave={saveGoal} onCancel={()=>setShowAdd(false)}/>}
      {editGoal&&<GoalForm initial={editGoal} onSave={saveGoal} onCancel={()=>setEditGoal(null)}/>}
    </div>
  );
}

// ── OverviewTab ───────────────────────────────────────────────
function OverviewTab({ logs, monsterLogs }) {
  const practiceLogs=useMemo(()=>logs.filter(l=>!l.source),[logs]);
  const allLogsForStats=useMemo(()=>[...logs,...(monsterLogs||[])],[logs,monsterLogs]);
  const stats=useMemo(()=>calcOverviewStats(allLogsForStats),[allLogsForStats]);
  const rank=useMemo(()=>getRank(stats),[stats]);

  if (!stats) return (
    <div className="p-10 text-center text-white/40 text-sm">
      <div className="text-4xl mb-3">🎯</div>
      <div>還沒有足夠的紀錄</div>
      <div className="text-xs mt-2 text-white/25">需要至少 30 箭才能計算評級（目前 {allLogsForStats.flatMap(getLogArrows).length} 箭）</div>
    </div>
  );

  const rankIdx=rank?RANKS.indexOf(rank):-1;
  const prevRank=rankIdx>0?RANKS[rankIdx-1]:null;

  const METRICS=[
    {label:"命中率",val:stats.hitRate,   color:"#60a5fa"},
    {label:"高分率",val:stats.highRate,  color:"#10b981"},
    {label:"穩定性",val:stats.stability, color:"#f59e0b"},
    {label:"10分率",val:stats.tenRate,   color:"#ec4899",max:40},
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-xs text-white/30 text-center">統計範圍：練習 + 打怪 + 組隊 + 世界王（共 {stats.count} 箭）</div>
      {/* 評級卡 */}
      <Card className="p-4" style={CS}>
        <div className="flex items-center gap-5">
          <div className="text-center min-w-[64px]">
            {rank ? (
              <div className="font-black text-5xl" style={{color:rank.color,textShadow:`0 0 24px ${rank.color}99`}}>
                {rank.rank}
              </div>
            ) : (
              <div className="font-black text-3xl text-white/30">?</div>
            )}
            <div className="text-xs text-white/40 mt-0.5">評級</div>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            {METRICS.map(({label,val,color,max=100})=>(
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-white/60 w-12">{label}</span>
                <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full transition-all" style={{width:`${Math.min(100,val/max*100)}%`,background:color}}/>
                </div>
                <span className="text-xs font-bold w-10 text-right" style={{color}}>{val.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-white/10 text-center">
          <div className="flex-1"><div className="text-xs text-white/40">總箭數</div><div className="font-bold text-white">{stats.count}</div></div>
          <div className="flex-1"><div className="text-xs text-white/40">均分/箭</div><div className="font-bold text-white">{stats.avg.toFixed(2)}</div></div>
          <div className="flex-1"><div className="text-xs text-white/40">分散度σ</div><div className="font-bold text-white">{stats.stdDev.toFixed(2)}</div></div>
        </div>
        {stats.count<30&&<div className="mt-2 text-xs text-amber-400/70">需至少 30 箭才顯示評級（目前 {stats.count} 箭）</div>}
      </Card>

      {/* 雙圓盤 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 flex flex-col items-center gap-1" style={CS}>
          <div className="text-xs font-bold text-white/60">射手指標盤</div>
          <RadarDisc h={stats.hitRate} hi={stats.highRate} st={stats.stability}/>
          <div className="text-xs text-white/50">10分率 <span className="font-bold text-pink-400">{stats.tenRate.toFixed(1)}%</span></div>
        </Card>
        <Card className="p-3 flex flex-col items-center gap-1" style={CS}>
          <div className="text-xs font-bold text-white/60">每箭分布盤</div>
          <DonutDisc dist={stats.dist} total={stats.count}/>
          <div className="flex gap-2 text-xs justify-center flex-wrap mt-0.5">
            {["M",10,9,8].map(k=>{
              const cnt=stats.dist[k]||0;
              const pct=cnt?Math.round(cnt/stats.count*100):0;
              const col=k==="M"?"#ef4444":k===10?"#f97316":k===9?"#f59e0b":"#84cc16";
              return pct>0?<span key={k} className="font-bold" style={{color:col}}>{k==="M"?"X":k}={pct}%</span>:null;
            })}
          </div>
        </Card>
      </div>

      {/* 審核標準表 */}
      <Card className="p-4" style={CS}>
        <div className="text-xs font-bold text-white/60 mb-3">📋 SSS 評級標準</div>
        <div className="flex flex-col gap-1">
          {RANKS.map(r=>{
            const isCur=r===rank;
            const isNext=r===prevRank;
            return (
              <div key={r.rank}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isCur?"ring-1":""}${isNext?" opacity-60":""}`}
                style={isCur?{background:"rgba(255,255,255,0.1)",ringColor:r.color}:{background:"transparent"}}>
                <span className="font-black text-sm w-9" style={{color:r.color}}>{r.rank}</span>
                <div className="flex-1 grid grid-cols-4 gap-x-1 text-xs text-white/50">
                  <span>命中 {r.min.hit}%</span>
                  <span>高分 {r.min.high}%</span>
                  <span>穩定 {r.min.stable}%</span>
                  <span>10分 {r.min.ten}%</span>
                </div>
                {isCur&&<span className="text-xs" style={{color:r.color}}>◀ 你</span>}
              </div>
            );
          })}
        </div>
        {prevRank&&rank&&(
          <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/50">
            距 <span className="font-bold" style={{color:prevRank.color}}>{prevRank.rank}</span> 還需：
            {[
              stats.hitRate<prevRank.min.hit&&`命中 ${(prevRank.min.hit-stats.hitRate).toFixed(1)}%↑`,
              stats.highRate<prevRank.min.high&&`高分 ${(prevRank.min.high-stats.highRate).toFixed(1)}%↑`,
              stats.stability<prevRank.min.stable&&`穩定 ${(prevRank.min.stable-stats.stability).toFixed(1)}%↑`,
              stats.tenRate<prevRank.min.ten&&`10分 ${(prevRank.min.ten-stats.tenRate).toFixed(1)}%↑`,
            ].filter(Boolean).map((t,i)=><span key={i} className="ml-2 text-yellow-400">{t}</span>)}
          </div>
        )}
      </Card>

      {/* 遊戲統計 */}
      {(monsterLogs?.length>0||logs.some(l=>l.source==="party")||logs.some(l=>l.source==="worldboss"))&&(()=>{
        const mLogs  = monsterLogs||[];
        const pLogs  = logs.filter(l=>l.source==="party");
        const wbLogs = logs.filter(l=>l.source==="worldboss");
        const winRate = arr => arr.length ? Math.round(arr.filter(l=>l.result==="win").length/arr.length*100) : null;
        const rows=[
          {icon:"⚔️",label:"打怪",logs:mLogs,  color:"#fca5a5"},
          {icon:"👥",label:"組隊",logs:pLogs,  color:"#c4b5fd"},
          {icon:"🌍",label:"世界王",logs:wbLogs,color:"#fdba74"},
        ].filter(r=>r.logs.length>0);
        if (!rows.length) return null;
        return (
          <Card className="p-4" style={CS}>
            <div className="text-xs font-bold text-white/60 mb-3">⚔️ 遊戲統計</div>
            <div className="flex flex-col gap-2.5">
              {rows.map(row=>{
                const wr=winRate(row.logs);
                return (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="text-base w-6">{row.icon}</span>
                    <span className="text-xs font-bold text-white/80 w-12">{row.label}</span>
                    <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div className="h-1.5 rounded-full" style={{width:`${wr??0}%`,background:row.color}}/>
                    </div>
                    <span className="text-xs text-white/60 w-20 text-right">
                      {row.logs.length}場
                      {wr!==null&&<span className="ml-1 font-bold" style={{color:row.color}}>勝{wr}%</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

// ── AnalysisTab ───────────────────────────────────────────────
function AnalysisTab({ logs, profile }) {
  const [subTab, setSubTab]=useState("trend");
  const practiceLogs=useMemo(()=>logs.filter(l=>!l.source),[logs]);
  return (
    <div className="flex flex-col">
      <div className="flex border-b border-white/10 sticky top-0 z-10" style={{ background:"rgba(15,23,42,0.7)",backdropFilter:"blur(8px)" }}>
        {[["trend","📈 趨勢"],["distance","🗺️ 距離"],["goals","🎯 目標"]].map(([id,label])=>(
          <button key={id} onClick={()=>setSubTab(id)}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all
              ${subTab===id?"border-blue-400 text-blue-300":"border-transparent text-white/50"}`}>{label}</button>
        ))}
      </div>
      <div className="p-4">
        {subTab==="trend"    && <TrendView    logs={practiceLogs} />}
        {subTab==="distance" && <DistanceView logs={practiceLogs} />}
        {subTab==="goals"    && <GoalView     logs={practiceLogs} profile={profile} />}
      </div>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────────
export default function MemberPractice({ profileOverride = null, isGuestMode = false }) {
  const { profile: authProfile }=useAuth();
  const profile = profileOverride || authProfile;
  const { toast, ToastContainer }=useToast();
  const [logs,        setLogs]        = useState([]);
  const [monsterLogs, setMonsterLogs] = useState([]);
  const [loading, setLoading]=useState(true);
  const [tab,   setTab]  =useState("practice");
  const [phase, setPhase]=useState("setup");
  const [saving, setSaving]=useState(false);
  const [finishedRounds, setFinishedRounds]=useState([]);
  const [arrowPositions, setArrowPositions]=useState([]);
  const [sessionDetails, setSessionDetails]=useState(null);
  const [initialScoringSession, setInitialScoringSession]=useState(null);
  const [milestoneQueue, setMilestoneQueue]=useState([]);  // [{ms, rewards}]
  const classEndedRef = useRef(false); // 下課後不再觸發里程碑
  const practiceRootRef = useRef(null);

  useEffect(() => {
    if (!profile?.id || isGuestMode) return;
    const unsub = subscribeMyCheckin(profile.id, c => {
      classEndedRef.current = !!c?.classEnded;
    });
    return () => unsub?.();
  }, [profile?.id, isGuestMode]); // eslint-disable-line

  const equipSets=useMemo(()=>normalizeEquipment(profile?.equipment),[profile?.equipment]);

  const [form, setForm]=useState(()=>({
    date:today(), bowType:getDefaultBowType(profile?.equipment),
    equipSetId:getDefaultEquipSetId(profile?.equipment),
    distance:18, targetFormat:"indoor_40", arrowCount:3, roundCount:20, note:"", inputMode:"button",
    presetId:"indoor_single", competitionMode:"wa30", assistedCues:true,
    matchType:"qualification", opponentAverage:8.5,
  }));

  useEffect(() => {
    if (!profile?.id) return;
    const recovery = loadPracticeRecovery(profile.id);
    if (!recovery?.form) return;
    setForm(recovery.form);
    if (recovery.phase === "scoring" && recovery.scoring) {
      setInitialScoringSession(recovery.scoring);
      setPhase("scoring");
      setTab("practice");
      return;
    }
    if (recovery.phase === "result" && Array.isArray(recovery.finishedRounds)) {
      setFinishedRounds(recovery.finishedRounds);
      setArrowPositions(recovery.arrowPositions || []);
      setSessionDetails(recovery.sessionDetails || null);
      setPhase("result");
      setTab("practice");
    }
  }, [profile?.id]);

  useEffect(() => {
    if (phase !== "scoring" && phase !== "result") return undefined;
    const guardInternalNavigation = event => {
      if (practiceRootRef.current?.contains(event.target)) return;
      const leave = window.confirm("本次練習尚未儲存。離開後可返回自主練習恢復進度，確定離開？");
      if (leave) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };
    document.addEventListener("click", guardInternalNavigation, true);
    return () => document.removeEventListener("click", guardInternalNavigation, true);
  }, [phase]);

  const handleScoringSnapshot = useCallback(snapshot => {
    if (!profile?.id) return;
    savePracticeRecovery(profile.id, {
      phase:"scoring",
      form,
      scoring:snapshot,
    });
  }, [form, profile?.id]);

  const handleScoringDone = useCallback((rounds, pos, details) => {
    const nextDetails = details || null;
    const nextForm = { ...form, sessionDetails:nextDetails };
    setFinishedRounds(rounds);
    setArrowPositions(pos || []);
    setSessionDetails(nextDetails);
    setForm(nextForm);
    setInitialScoringSession(null);
    setPhase("result");
    if (profile?.id) {
      savePracticeRecovery(profile.id, {
        phase:"result",
        form:nextForm,
        finishedRounds:rounds,
        arrowPositions:pos || [],
        sessionDetails:nextDetails,
      });
    }
  }, [form, profile?.id]);

  useEffect(()=>{
    if (!profile?.id) return;
    const unsubP=subscribePracticeLogs(profile.id, data=>{
      setLogs(data.filter(l=>l.rounds?.length||l.totalArrows>0));
      setLoading(false);
    });
    const unsubM=subscribeMonsterLogs(profile.id, setMonsterLogs, 50);
    return ()=>{ unsubP?.(); unsubM?.(); };
  },[profile?.id]); // eslint-disable-line

  async function handleSave(){
    setSaving(true);
    const fmt=TARGET_FORMATS.find(f=>f.id===form.targetFormat)||TARGET_FORMATS[0];
    const stats=calcStats(finishedRounds);

    // 計算今日舊箭數（儲存前）
    const todayStr=form.date || today();
    const oldTodayArrows=logs
      .filter(l=>l.date===todayStr)
      .reduce((s,l)=>s+(l.totalArrows||0),0);

    const practiceSessionId = `practice_${profile.id}_${Date.now()}`;
    const practicePayload = {
      date:form.date, bowType:form.bowType, distance:form.distance,
      grantProgress:!isGuestMode,
      targetFormat:form.targetFormat, arrowCount:form.arrowCount, roundCount:form.roundCount,
      maxScore:fmt.max, hasMiss:true, rounds:finishedRounds,
      total:stats.total, miss:stats.misses, totalArrows:stats.arrows,
      avgPerArrow:stats.avgPerArrow,
      avgPerRound:finishedRounds.length?+(stats.total/finishedRounds.length).toFixed(2):0,
      note:form.note,
      targetSpec:{
        faceSizeCm:fmt.faceSizeCm || null,
        scoring:`${fmt.min}-${fmt.max}`,
        layout:fmt.layout || "single",
      },
      competition:(form.competitionMode || "off") === "off" ? null : {
        ruleset:form.competitionMode,
        secondsPerArrow:form.competitionMode === "wa40" ? 40 : 30,
        preparationSeconds:10,
        assistedCues:form.assistedCues !== false,
      },
      ...(sessionDetails?.roundTiming?.length ? { roundTiming:sessionDetails.roundTiming } : {}),
      ...(sessionDetails?.match ? { match:sessionDetails.match } : {}),
      ...(arrowPositions.length>0 ? { arrowPositions } : {}),
    };
    await addPracticeLog(profile.id, practicePayload, profile.id);
    await finalizePracticeShootingSession({
      sessionId:practiceSessionId,
      memberId:profile.id,
      rounds:finishedRounds,
      arrowPositions,
      shootingProfile:{ bowType:form.bowType, bowId:form.equipSetId, distance:form.distance },
      targetFormat:form.targetFormat,
      arrowsPerEnd:form.arrowCount,
      timingMode:form.competitionMode || "off",
    });

    toast("練習紀錄已儲存 ✓");
    clearPracticeRecovery(profile.id);
    setSaving(false); setPhase("setup"); setFinishedRounds([]); setArrowPositions([]); setSessionDetails(null);
    setForm(current => ({ ...current, sessionDetails:null }));

    // 箭露在下課時由 DailyQuest.confirmClassEnd 統一結算
    const arrowCount = stats.arrows || 0;

    // 射手 XP（最低速率：每發箭 1 XP）
    if (!isGuestMode && arrowCount > 0) addArcherXP(profile.id, arrowCount * PRACTICE_ARCHER_XP_PER_ARROW).catch(() => {});
    // 貓貓 XP（每次儲存 2 XP）
    const _prCatId = profile?.equippedCat?.catId;
    if (!isGuestMode && _prCatId) addCatXP(profile.id, _prCatId, CAT_PRACTICE_XP).catch(() => {});

    // 里程碑計算（下課後不觸發，避免重複結算）
    const newTodayArrows=oldTodayArrows+arrowCount;
    if (!isGuestMode && !classEndedRef.current) {
      const milestones=getMilestonesReached(oldTodayArrows, newTodayArrows);
      if(milestones.length>0){
        grantArrowMilestoneRewards(profile.id, milestones).catch(()=>{});
        const queue=milestones.map(ms=>({ ms, rewards: getRewardsForMilestone(ms) }));
        setMilestoneQueue(queue);
      }
    }
  }

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  const tabBarStyle = { background:"rgba(15,23,42,0.7)", backdropFilter:"blur(8px)", borderBottom:"1px solid rgba(255,255,255,0.1)" };

  return (
    <div ref={practiceRootRef} style={{ minHeight:"100%", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <ToastContainer />
      {milestoneQueue.length>0 && (
        <ArrowMilestonePopup
          milestones={milestoneQueue.map(q=>q.ms)}
          rewardsList={milestoneQueue.map(q=>q.rewards)}
          onAllClose={()=>setMilestoneQueue([])} />
      )}
      {phase==="setup" && (
        <div className="flex sticky top-0 z-10" style={tabBarStyle}>
          {[["practice","🎯 練習"],["history","📋 歷史"],["overview","🔍 總覽"],["analysis","📈 分析"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all
                ${tab===id?"border-blue-400 text-blue-300":"border-transparent text-white/50"}`}>{label}</button>
          ))}
        </div>
      )}
      {tab==="practice"&&phase==="setup"&&(
        <SetupPhase initial={form} equipSets={equipSets} onStart={f=>{
          clearPracticeRecovery(profile?.id);
          setInitialScoringSession(null);
          setForm({...f,sessionDetails:null});
          setPhase("scoring");
          setFinishedRounds([]);
          setArrowPositions([]);
          setSessionDetails(null);
        }} />
      )}
      {tab==="practice"&&phase==="scoring"&&(
        <ScoringPhase
          form={form}
          initialSession={initialScoringSession}
          onSessionChange={handleScoringSnapshot}
          onDone={handleScoringDone}
          onCancel={()=>{
            clearPracticeRecovery(profile?.id);
            setInitialScoringSession(null);
            setPhase("setup");
          }}
        />
      )}
      {tab==="practice"&&phase==="result"&&(
        <ResultPhase form={form} rounds={finishedRounds} arrowPositions={arrowPositions} onSave={handleSave} onRetry={()=>{
          clearPracticeRecovery(profile?.id);
          setFinishedRounds([]);
          setArrowPositions([]);
          setSessionDetails(null);
          setInitialScoringSession(null);
          setForm(current=>({...current,sessionDetails:null}));
          setPhase("scoring");
        }} saving={saving} />
      )}
      {tab==="history"  &&phase==="setup"&&<HistoryTab  logs={logs} monsterLogs={monsterLogs} />}
      {tab==="overview" &&phase==="setup"&&<OverviewTab logs={logs} monsterLogs={monsterLogs} />}
      {tab==="analysis" &&phase==="setup"&&<AnalysisTab logs={logs} profile={profile} />}
    </div>
  );
}
