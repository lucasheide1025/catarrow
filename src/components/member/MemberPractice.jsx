// src/components/member/MemberPractice.jsx
import { useState, useEffect, useMemo } from "react";
import { addPracticeLog, subscribePracticeLogs, subscribeMonsterLogs, updateMember } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { today } from "../../lib/constants";
import { normalizeEquipment, getDefaultBowType } from "../shared/Equipment";
import { Card, Spinner, useToast } from "../shared/UI";
import { LineChart, TrendBadge } from "../shared/GrowthChart";

// ── 深色半透明卡片樣式（與 MemberHome/Profile 相同風格）────────
const CS  = { background:"rgba(15,23,42,0.55)", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.1)" };
const CS2 = { background:"rgba(15,23,42,0.38)", backdropFilter:"blur(8px)",  border:"1px solid rgba(255,255,255,0.08)" };

// ── 常數 ─────────────────────────────────────────────────────
const TARGET_FORMATS = [
  { id:"full_110", label:"全靶 1-10",  min:1, max:10, isTriple:false },
  { id:"field_16", label:"原野 1-6",   min:1, max:6,  isTriple:false },
  { id:"half_610", label:"半靶 6-10",  min:6, max:10, isTriple:false },
  { id:"triple",   label:"三連靶",     min:1, max:10, isTriple:true  },
];
const BOW_OPTIONS = [
  { value:"recurve_bare", label:"裸弓" },
  { value:"recurve_full", label:"全配" },
  { value:"compound",     label:"獵弓" },
  { value:"traditional",  label:"傳統弓" },
];
const DISTANCES = [5, 10, 13.5, 15, 18, 20, 30, 50, 70];

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
  return rounds.flat().filter(s => typeof s === "number");
}

function calcStats(rounds) {
  const all    = rounds.flat();
  const nums   = all.filter(s => typeof s === "number");
  const total  = nums.reduce((a,b) => a+b, 0);
  const misses = all.filter(s => s === "M").length;
  return {
    total, misses,
    arrows:      all.length,
    hitRate:     all.length ? Math.round((all.length-misses)/all.length*100) : 0,
    avgPerArrow: nums.length ? +(total/nums.length).toFixed(2) : 0,
  };
}

function scoreColor(s, fmt) {
  if (s === "M") return { bg:"#fef2f2", text:"#ef4444", border:"#fecaca" };
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

  const btnSel  = "bg-blue-500 text-white border-blue-400";
  const btnIdle = "bg-white/10 text-white/70 border-white/20";
  const btn = (active) => `px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active?btnSel:btnIdle}`;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 弓種 */}
      <Card className="p-4" style={CS}>
        <div className="text-xs font-bold text-white/70 mb-2">弓種</div>
        <div className="flex flex-wrap gap-2">
          {(equipSets.length > 0 ? equipSets : null)?.map(s => {
            const cat = s.bowCategory || "recurve_bare";
            const lbl = s.label || bowLabel(cat);
            return (
              <button key={s.id} onClick={() => up("bowType", cat)} className={btn(form.bowType===cat)}>
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
              {[3,6,10,12].map(n => (
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
        {(equipSets.find(s=>s.bowCategory===form.bowType)?.label) || bowLabel(form.bowType)}
        &nbsp;·&nbsp;{form.distance}m&nbsp;·&nbsp;{fmt.label}
        &nbsp;·&nbsp;{fmt.isTriple ? `每靶${arrowsPerSpot}箭` : `${form.arrowCount}箭`}×{form.roundCount}組
        &nbsp;（共 {form.arrowCount * form.roundCount} 箭）
      </div>
      <button onClick={() => onStart(form)} className="w-full py-4 bg-blue-600 text-white font-black text-lg rounded-xl">
        🎯 開始練習
      </button>
    </div>
  );
}

// ── ScoringPhase ──────────────────────────────────────────────
function ScoringPhase({ form, onDone, onCancel }) {
  const fmt  = TARGET_FORMATS.find(f=>f.id===form.targetFormat) || TARGET_FORMATS[0];
  const btns = genButtons(fmt);
  const cols = btns.length <= 6 ? 3 : 4;
  const [round, setRound] = useState(0);
  const [allR,  setAllR]  = useState([]);
  const [cur,   setCur]   = useState([]);

  function addArrow(s) { if (cur.length >= form.arrowCount) return; setCur(p => [...p, s]); }
  function nextRound() {
    const newAll = [...allR, cur];
    if (newAll.length >= form.roundCount) { onDone(newAll); return; }
    setAllR(newAll); setCur([]); setRound(r=>r+1);
  }
  const prevTotal  = numericArr(allR).reduce((a,b)=>a+b,0);
  const curNumeric = cur.filter(s=>s!=="M").reduce((a,b)=>a+b,0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="p-4" style={CS}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-white/70">第 {round+1} / {form.roundCount} 組</span>
          <span className="text-xs text-white/50">{bowLabel(form.bowType)} · {form.distance}m · {fmt.label}</span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-1.5 mb-3">
          <div className="bg-blue-400 h-1.5 rounded-full transition-all" style={{ width:`${(round/form.roundCount)*100}%` }} />
        </div>
        {fmt.isTriple && form.arrowCount >= 3 && (
          <div className="flex gap-2 mb-2 text-xs justify-center">
            {["上","中","下"].map((s,i) => (
              <span key={i} className={`px-2 py-0.5 rounded-full ${Math.floor(cur.length/(form.arrowCount/3))===i ? "bg-blue-500/40 text-blue-200 font-bold" : "bg-white/10 text-white/40"}`}>
                {s}靶
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 justify-center flex-wrap mb-3">
          {Array.from({length:form.arrowCount},(_,i)=>{
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

      <Card className="p-4" style={CS}>
        <div className="grid gap-3" style={{ gridTemplateColumns:`repeat(${cols},1fr)` }}>
          {btns.map(s => {
            const c = scoreColor(s, fmt);
            return (
              <button key={s} onClick={()=>addArrow(s)} disabled={cur.length>=form.arrowCount}
                className="py-4 rounded-xl font-black text-xl border-2 disabled:opacity-30 transition-all active:scale-95"
                style={{ background:c.bg, color:c.text, borderColor:c.border }}>{s}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex gap-3">
        <button onClick={()=>setCur(p=>p.slice(0,-1))} disabled={cur.length===0}
          className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 font-bold text-sm disabled:opacity-30 bg-white/10">
          ← 刪除
        </button>
        <button onClick={nextRound} disabled={cur.length<form.arrowCount}
          style={{ flex:2 }}
          className="py-3 rounded-xl bg-blue-600 text-white font-black text-sm disabled:opacity-40">
          {round+1>=form.roundCount ? "完成練習 ✓" : "下一組 →"}
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
      <button onClick={onCancel} className="text-center text-white/40 text-xs py-2">取消練習</button>
    </div>
  );
}

// ── ResultPhase ───────────────────────────────────────────────
function ResultPhase({ form, rounds, onSave, onRetry, saving }) {
  const fmt       = TARGET_FORMATS.find(f=>f.id===form.targetFormat) || TARGET_FORMATS[0];
  const stats     = calcStats(rounds);
  const roundSubs = rounds.map(r=>numericArr([r]).reduce((a,b)=>a+b,0));
  const maxSub    = Math.max(...roundSubs, 1);
  return (
    <div className="flex flex-col gap-4 p-4">
      <Card className="p-5" style={CS}>
        <div className="text-center mb-4">
          <div className="text-white/50 text-xs mb-1">{bowLabel(form.bowType)} · {form.distance}m · {fmt.label}</div>
          <div className="font-black text-5xl text-white">{stats.total}</div>
          <div className="text-white/50 text-sm mt-1">總環數 / {stats.arrows} 箭</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[["均分/箭",stats.avgPerArrow.toFixed(1)],["命中率",`${stats.hitRate}%`],["失誤",stats.misses]].map(([k,v])=>(
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

// ── HistoryTab ─────────────────────────────────────────────────
const SOURCE_OPTS = [
  { id:"all",       label:"全部"      },
  { id:"practice",  label:"練習"      },
  { id:"monster",   label:"⚔️ 打怪"  },
  { id:"party",     label:"👥 組隊"  },
  { id:"worldboss", label:"🌍 世界王" },
];
const TYPE_BADGE = {
  practice:  { label:"練習",     bg:"rgba(59,130,246,0.3)",  text:"#93c5fd" },
  monster:   { label:"⚔️ 打怪",  bg:"rgba(239,68,68,0.3)",   text:"#fca5a5" },
  party:     { label:"👥 組隊",  bg:"rgba(139,92,246,0.3)",  text:"#c4b5fd" },
  worldboss: { label:"🌍 世界王", bg:"rgba(234,88,12,0.3)",   text:"#fdba74" },
};

function HistoryTab({ logs, monsterLogs }) {
  const [expand,       setExpand]       = useState({});
  const [sourceFilter, setSourceFilter] = useState("all");
  const [bowFilter,    setBowFilter]    = useState("");
  const [distFilter,   setDistFilter]   = useState("");

  const allLogs = useMemo(()=>{
    const practice = logs.filter(l=>!l.source)
      .map(l=>({...l,_type:"practice",_date:l.date||"",_ts:l.submittedAt?.seconds||0}));
    const party = logs.filter(l=>l.source==="party")
      .map(l=>({...l,_type:"party",_date:l.date||"",_ts:l.submittedAt?.seconds||0}));
    const wb = logs.filter(l=>l.source==="worldboss")
      .map(l=>({...l,_type:"worldboss",_date:l.date||"",_ts:l.submittedAt?.seconds||0}));
    const monster = monsterLogs.map(l=>{
      const dt = l.createdAt ? new Date(l.createdAt.seconds*1000) : new Date();
      return {...l,_type:"monster",_date:dt.toISOString().slice(0,10),_ts:l.createdAt?.seconds||0};
    });
    return [...practice,...party,...wb,...monster]
      .sort((a,b)=>a._date!==b._date?b._date.localeCompare(a._date):b._ts-a._ts);
  },[logs,monsterLogs]);

  const bowsUsed  = useMemo(()=>[...new Set(logs.filter(l=>!l.source).map(l=>l.bowType))],[logs]);
  const distsUsed = useMemo(()=>
    [...new Set(logs.filter(l=>!l.source).map(l=>Number(l.distance)))]
    .filter(Boolean).sort((a,b)=>a-b),[logs]);

  const filtered = useMemo(()=>
    allLogs
      .filter(l=>sourceFilter==="all"||l._type===sourceFilter)
      .filter(l=>!bowFilter||l.bowType===bowFilter)
      .filter(l=>!distFilter||Number(l.distance)===Number(distFilter)),
    [allLogs,sourceFilter,bowFilter,distFilter]
  );

  const tabBtn = (active) => `px-3 py-1 rounded-full text-xs font-bold border flex-shrink-0 transition-all
    ${active?"bg-blue-500 text-white border-blue-400":"bg-white/10 text-white/60 border-white/20"}`;

  if (!logs.length&&!monsterLogs.length) return (
    <div className="p-8 text-center text-white/50 text-sm">還沒有歷史紀錄</div>
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SOURCE_OPTS.map(opt=>(
          <button key={opt.id} onClick={()=>setSourceFilter(opt.id)} className={tabBtn(sourceFilter===opt.id)}>
            {opt.label}
          </button>
        ))}
      </div>

      {(bowsUsed.length>0||distsUsed.length>0)&&(
        <div className="flex gap-2 overflow-x-auto pb-1">
          {bowsUsed.map(b=>(
            <button key={b} onClick={()=>setBowFilter(f=>f===b?"":b)} className={tabBtn(bowFilter===b)}>
              {bowLabel(b)}
            </button>
          ))}
          {distsUsed.map(d=>(
            <button key={d} onClick={()=>setDistFilter(f=>f===d?"":d)}
              className={`px-3 py-1 rounded-full text-xs font-bold border flex-shrink-0 transition-all
                ${distFilter===d?"bg-green-600 text-white border-green-500":"bg-white/10 text-white/60 border-white/20"}`}>
              {d}m
            </button>
          ))}
        </div>
      )}

      {filtered.length===0&&<div className="text-center text-white/50 text-sm py-6">沒有符合的紀錄</div>}

      {filtered.map(log=>{
        const isOpen=!!expand[log.id];
        const toggle=()=>setExpand(e=>({...e,[log.id]:!e[log.id]}));
        const badge=TYPE_BADGE[log._type];

        /* ── 練習卡片 */
        if (log._type==="practice") {
          const fmt=getFormat(log), stats=calcStats(log.rounds||[]);
          return (
            <Card key={log.id} className="p-4" style={CS}>
              <button className="w-full text-left" onClick={toggle}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:badge.bg,color:badge.text }}>{badge.label}</span>
                      <span className="font-bold text-white text-sm">{shortDate(log.date)}</span>
                    </div>
                    <div className="text-xs text-white/50">{bowLabel(log.bowType)} · {log.distance}m · {fmt.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-xl text-white">{log.total??stats.total}</div>
                    <div className="text-xs text-white/50">{(log.avgPerArrow??stats.avgPerArrow).toFixed(1)}/箭</div>
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-white/50 flex-wrap">
                  <span>命中 {stats.hitRate}%</span><span>失誤 {stats.misses}</span>
                  <span>{log.arrowCount}箭×{log.roundCount}組</span>
                  {log.note&&<span className="text-blue-300 truncate max-w-24">{log.note}</span>}
                  <span className="ml-auto text-white/30">{isOpen?"▲":"▼"}</span>
                </div>
              </button>
              {log.coachNote&&(
                <div className="mt-2 text-xs text-amber-300 bg-amber-900/30 border border-amber-500/30 rounded-lg p-2">
                  💬 教練：{log.coachNote}
                </div>
              )}
              {isOpen&&(log.rounds||[]).length>0&&(
                <div className="mt-3 pt-3 border-t border-white/10">
                  {(log.rounds||[]).map((r,i)=>(
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/10 last:border-0">
                      <span className="text-xs text-white/50 w-8">第{i+1}組</span>
                      <div className="flex gap-1 flex-1">
                        {r.map((v,j)=>{const c=scoreColor(v,fmt);return(
                          <span key={j} className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
                            style={{ background:c.bg, color:c.text }}>{v}</span>
                        );})}
                      </div>
                      <span className="font-bold text-white/70 text-sm">{numericArr([r]).reduce((a,b)=>a+b,0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        }

        /* ── 打怪（solo）卡片 */
        if (log._type==="monster") {
          const won=log.result==="win";
          const total=(log.roundScores||[]).reduce((s,r)=>s+(r.total||0),0);
          const rounds=(log.roundScores||[]).map(r=>r.scores||[]);
          return (
            <Card key={log.id} className="p-4" style={CS}>
              <button className="w-full text-left" onClick={toggle}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:badge.bg,color:badge.text }}>{badge.label}</span>
                      <span className="font-bold text-white text-sm">{shortDate(log._date)}</span>
                    </div>
                    <div className="text-xs text-white/50">{log.monsterName||"怪物"}{log.distance?` · ${log.distance}m`:""}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won?"bg-green-500/30 text-green-300":"bg-white/10 text-white/40"}`}>{won?"勝利":"落敗"}</span>
                    <div className="font-black text-xl text-white">{total}</div>
                  </div>
                </div>
                <div className="text-xs text-white/50">{rounds.length} 組 <span className="ml-1 text-white/20">{isOpen?"▲":"▼"}</span></div>
              </button>
              {log.coachNote&&(
                <div className="mt-2 text-xs text-amber-300 bg-amber-900/30 border border-amber-500/30 rounded-lg p-2">
                  💬 教練：{log.coachNote}
                </div>
              )}
              {isOpen&&rounds.length>0&&(
                <div className="mt-3 pt-3 border-t border-white/10">
                  {rounds.map((r,i)=>{const sub=r.filter(v=>typeof v==="number").reduce((a,b)=>a+b,0);return(
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/10 last:border-0">
                      <span className="text-xs text-white/50 w-8">第{i+1}組</span>
                      <div className="flex gap-1 flex-1">
                        {r.map((v,j)=>{const c=battleScoreColor(v);return(
                          <span key={j} className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
                            style={{ background:c.bg, color:c.text }}>{v===0?"M":v}</span>
                        );})}
                      </div>
                      <span className="font-bold text-white/70 text-sm">{sub}</span>
                    </div>
                  );})}
                </div>
              )}
            </Card>
          );
        }

        /* ── 組隊 / 世界王卡片 */
        const won=log.result==="win";
        const stats=calcStats(log.rounds||[]);
        const label=log._type==="party"?(log.monsterName||"組隊打怪"):(log.bossName||"世界王");
        return (
          <Card key={log.id} className="p-4" style={CS}>
            <button className="w-full text-left" onClick={toggle}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:badge.bg,color:badge.text }}>{badge.label}</span>
                    <span className="font-bold text-white text-sm">{shortDate(log._date)}</span>
                  </div>
                  <div className="text-xs text-white/50">{label}{log.distance?` · ${log.distance}m`:""}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won?"bg-green-500/30 text-green-300":"bg-white/10 text-white/40"}`}>{won?"勝利":"落敗"}</span>
                  <div className="font-black text-xl text-white">{log.total??stats.total}</div>
                </div>
              </div>
              <div className="text-xs text-white/50">{(log.rounds||[]).length} 組 <span className="ml-1 text-white/20">{isOpen?"▲":"▼"}</span></div>
            </button>
            {log.coachNote&&(
              <div className="mt-2 text-xs text-amber-300 bg-amber-900/30 border border-amber-500/30 rounded-lg p-2">
                💬 教練：{log.coachNote}
              </div>
            )}
            {isOpen&&(log.rounds||[]).length>0&&(
              <div className="mt-3 pt-3 border-t border-white/10">
                {(log.rounds||[]).map((r,i)=>{const sub=r.filter(v=>typeof v==="number"&&v>0).reduce((a,b)=>a+b,0);return(
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/10 last:border-0">
                    <span className="text-xs text-white/50 w-8">第{i+1}組</span>
                    <div className="flex gap-1 flex-1">
                      {r.map((v,j)=>{const c=battleScoreColor(v);return(
                        <span key={j} className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs"
                          style={{ background:c.bg, color:c.text }}>{v===0?"M":v}</span>
                      );})}
                    </div>
                    <span className="font-bold text-white/70 text-sm">{sub}</span>
                  </div>
                );})}
              </div>
            )}
          </Card>
        );
      })}
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
    .map(l=>({y:+(l.avgPerArrow||calcStats(l.rounds||[]).avgPerArrow).toFixed(2),label:shortDate(l.date)})):[];
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
        const avgs=sorted.map(l=>l.avgPerArrow||calcStats(l.rounds||[]).avgPerArrow);
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
      .map(l=>l.avgPerArrow||calcStats(l.rounds||[]).avgPerArrow);
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
export default function MemberPractice() {
  const { profile }=useAuth();
  const { toast, ToastContainer }=useToast();
  const [logs,        setLogs]        = useState([]);
  const [monsterLogs, setMonsterLogs] = useState([]);
  const [loading, setLoading]=useState(true);
  const [tab,   setTab]  =useState("practice");
  const [phase, setPhase]=useState("setup");
  const [saving, setSaving]=useState(false);
  const [finishedRounds, setFinishedRounds]=useState([]);

  const equipSets=useMemo(()=>normalizeEquipment(profile?.equipment),[profile?.equipment]);

  const [form, setForm]=useState(()=>({
    date:today(), bowType:getDefaultBowType(profile?.equipment),
    distance:18, targetFormat:"full_110", arrowCount:6, roundCount:6, note:"",
  }));

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
    await addPracticeLog(profile.id,{
      date:form.date, bowType:form.bowType, distance:form.distance,
      targetFormat:form.targetFormat, arrowCount:form.arrowCount, roundCount:form.roundCount,
      maxScore:fmt.max, hasMiss:true, rounds:finishedRounds,
      total:stats.total, miss:stats.misses, totalArrows:stats.arrows,
      avgPerArrow:stats.avgPerArrow,
      avgPerRound:finishedRounds.length?+(stats.total/finishedRounds.length).toFixed(2):0,
      note:form.note,
    },profile.id);
    toast("練習紀錄已儲存 ✓");
    setSaving(false); setPhase("setup"); setFinishedRounds([]);
  }

  if (loading) return <div className="flex justify-center p-12"><Spinner /></div>;

  const tabBarStyle = { background:"rgba(15,23,42,0.7)", backdropFilter:"blur(8px)", borderBottom:"1px solid rgba(255,255,255,0.1)" };

  return (
    <div style={{ minHeight:"100%", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      <ToastContainer />
      {phase==="setup" && (
        <div className="flex sticky top-0 z-10" style={tabBarStyle}>
          {[["practice","🎯 練習"],["history","📋 歷史"],["analysis","📈 分析"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all
                ${tab===id?"border-blue-400 text-blue-300":"border-transparent text-white/50"}`}>{label}</button>
          ))}
        </div>
      )}
      {tab==="practice"&&phase==="setup"&&(
        <SetupPhase initial={form} equipSets={equipSets} onStart={f=>{ setForm(f); setPhase("scoring"); setFinishedRounds([]); }} />
      )}
      {tab==="practice"&&phase==="scoring"&&(
        <ScoringPhase form={form} onDone={rounds=>{ setFinishedRounds(rounds); setPhase("result"); }} onCancel={()=>setPhase("setup")} />
      )}
      {tab==="practice"&&phase==="result"&&(
        <ResultPhase form={form} rounds={finishedRounds} onSave={handleSave} onRetry={()=>{ setFinishedRounds([]); setPhase("scoring"); }} saving={saving} />
      )}
      {tab==="history" &&phase==="setup"&&<HistoryTab  logs={logs} monsterLogs={monsterLogs} />}
      {tab==="analysis"&&phase==="setup"&&<AnalysisTab logs={logs} profile={profile} />}
    </div>
  );
}
