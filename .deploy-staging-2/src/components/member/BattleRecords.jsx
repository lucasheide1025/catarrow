// src/components/member/BattleRecords.jsx — 通用戰鬥紀錄元件（日/週/月/年 + 分布 + 穩定性 + 曲線）
import { useState, useMemo } from "react";
import { SCORE_HEX_COLORS } from "../../lib/score";

// ─── 工具函式 ────────────────────────────────────────────────

function logDate(log) {
  if (log.createdAt?.seconds) return new Date(log.createdAt.seconds * 1000);
  if (log.date) return new Date(log.date + "T12:00:00");
  return new Date(0);
}

function isoWeek(d) {
  const dt = new Date(d.valueOf());
  dt.setHours(0, 0, 0, 0);
  const day = (dt.getDay() + 6) % 7; // Mon=0
  dt.setDate(dt.getDate() - day + 3);
  const jan4 = new Date(dt.getFullYear(), 0, 4);
  const wk = 1 + Math.round((dt - jan4) / 604800000);
  return `${dt.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}

function periodKey(d, unit) {
  if (unit === "day")   return d.toISOString().slice(0, 10);
  if (unit === "week")  return isoWeek(d);
  if (unit === "month") return d.toISOString().slice(0, 7);
  return String(d.getFullYear());
}

function periodLabel(key, unit) {
  if (unit === "day") {
    const [, m, d] = key.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
  }
  if (unit === "week") {
    const [y, w] = key.split("-W");
    return `${y}第${w}週`;
  }
  if (unit === "month") {
    const [y, m] = key.split("-");
    return `${y}/${m}`;
  }
  return `${key}年`;
}

function currentPeriodKey(unit) {
  return periodKey(new Date(), unit);
}

// 從不同格式的 log 取出所有箭分陣列（過濾非數字，例如 "M"）
function extractArrows(log) {
  if (log.roundScores?.length)
    return log.roundScores.flatMap(r => (r.scores || []).filter(v => typeof v === "number" && !isNaN(v)));
  if (Array.isArray(log.rounds))
    return log.rounds.flat().filter(v => typeof v === "number" && !isNaN(v));
  return [];
}

function calcAvg(arr) {
  if (!arr.length) return 0;
  const nums = arr.filter(v => typeof v === "number" && !isNaN(v));
  if (!nums.length) return 0;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

// 穩定性：σ=0→100%，σ≥5→0%（五分標準差法）
function calcStability(arr) {
  if (arr.length < 2) return null;
  const μ = calcAvg(arr);
  const σ = Math.sqrt(arr.reduce((s, v) => s + (v - μ) ** 2, 0) / arr.length);
  return Math.max(0, Math.min(100, Math.round((1 - σ / 5) * 100)));
}

function calcDist(arr) {
  const d = { 10:0, 9:0, 8:0, 7:0, 6:0, 5:0, 4:0, 3:0, 2:0, 1:0, 0:0 };
  arr.forEach(v => { if (v in d) d[v]++; });
  return d;
}

// ─── SVG 成長折線圖 ──────────────────────────────────────────

function GrowthChart({ points }) {
  if (!points || points.length < 2) return null;
  const W = 280, H = 72;
  const pL = 24, pR = 8, pT = 6, pB = 18;
  const iW = W - pL - pR;
  const iH = H - pT - pB;

  const xOf = i => pL + (i / (points.length - 1)) * iW;
  const yOf = v => pT + iH - (v / 10) * iH;  // 0-10 scale

  const avgPts  = points.map((p, i) => `${xOf(i)},${yOf(p.avg)}`).join(" ");
  const stabPts = points.some(p => p.stability != null)
    ? points.map((p, i) => `${xOf(i)},${yOf((p.stability ?? 100) / 10)}`).join(" ")
    : null;

  const step = Math.max(1, Math.ceil(points.length / 5));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
      {/* 橫格線 + Y 標籤 */}
      {[0, 5, 10].map(v => (
        <g key={v}>
          <line x1={pL} x2={W-pR} y1={yOf(v)} y2={yOf(v)} stroke="rgba(255,255,255,.06)" strokeWidth={1}/>
          <text x={pL-3} y={yOf(v)+3} fontSize={7} fill="rgba(255,255,255,.3)" textAnchor="end">{v}</text>
        </g>
      ))}
      {/* 穩定性線（×0.1 縮放） */}
      {stabPts && (
        <polyline points={stabPts} fill="none" stroke="#818cf8"
          strokeWidth={1.5} strokeDasharray="3,2" opacity={0.75}/>
      )}
      {/* 平均分線 */}
      <polyline points={avgPts} fill="none" stroke="#fbbf24" strokeWidth={2}/>
      {/* 數據點 */}
      {points.map((p, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(p.avg)} r={2.5}
          fill="#fbbf24" stroke="#0f172a" strokeWidth={1}/>
      ))}
      {/* X 軸標籤 */}
      {points.map((p, i) => (i % step === 0 || i === points.length - 1) ? (
        <text key={i} x={xOf(i)} y={H-2} fontSize={6.5}
          fill="rgba(255,255,255,.35)" textAnchor="middle">{p.label}</text>
      ) : null)}
    </svg>
  );
}

// ─── 分數分布條形 ─────────────────────────────────────────────

const SCORE_COLORS = SCORE_HEX_COLORS;

function ScoreDist({ dist, total }) {
  const maxC = Math.max(1, ...Object.values(dist));
  return (
    <div className="space-y-0.5">
      {[10,9,8,7,6,5,4,3,2,1,0].map(score => {
        const count = dist[score] || 0;
        if (!count) return null;
        const pct = Math.round(count / total * 100);
        return (
          <div key={score} className="flex items-center gap-1.5">
            <span className="text-[10px] font-black w-4 text-right"
              style={{ color: SCORE_COLORS[score] }}>
              {score === 0 ? "M" : score}
            </span>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(count / maxC) * 100}%`, background: SCORE_COLORS[score] }}/>
            </div>
            <span className="text-[10px] text-slate-400 w-14 text-right">{count}箭 {pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 主元件 ──────────────────────────────────────────────────

const UNITS = [
  { id:"day",   label:"日" },
  { id:"week",  label:"週" },
  { id:"month", label:"月" },
  { id:"year",  label:"年" },
];

export default function BattleRecords({ logs = [], title = "📊 戰鬥紀錄", maxGroups = 10 }) {
  const [unit, setUnit] = useState("week");
  const curKey = currentPeriodKey(unit);
  const [expanded, setExpanded] = useState(() => new Set([currentPeriodKey("week")]));

  function changeUnit(u) {
    setUnit(u);
    setExpanded(new Set([currentPeriodKey(u)]));
  }

  function toggle(key) {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  }

  // 依時間單位分組，降序排列
  const grouped = useMemo(() => {
    const map = {};
    logs.forEach(log => {
      const key = periodKey(logDate(log), unit);
      if (!map[key]) map[key] = [];
      map[key].push(log);
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, maxGroups)
      .map(([key, grpLogs]) => {
        const sortedLogs = [...grpLogs].sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        const arrows = sortedLogs.flatMap(extractArrows);
        return {
          key,
          logs: sortedLogs,
          arrows,
          avg: calcAvg(arrows),
          stability: calcStability(arrows),
          dist: calcDist(arrows),
          wins: sortedLogs.filter(l => l.result === "win").length,
        };
      });
  }, [logs, unit, maxGroups]);

  // 圖表資料（升序）
  const chartPoints = useMemo(() =>
    [...grouped]
      .sort((a, b) => a.key.localeCompare(b.key))
      .filter(g => g.arrows.length > 0 && !isNaN(g.avg))
      .map(g => ({
        label:     periodLabel(g.key, unit),
        avg:       parseFloat(g.avg.toFixed(2)),
        stability: g.stability,
      })),
    [grouped, unit]
  );

  if (!logs.length) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="text-sm font-black text-slate-300 mb-2">{title}</div>
        <div className="text-center text-slate-500 text-sm py-4">
          尚無紀錄，快去戰鬥吧！
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-black text-white">{title}</span>
        <span className="text-xs text-slate-500">{logs.length} 場紀錄</span>
      </div>

      {/* 時間維度 tab */}
      <div className="flex gap-1">
        {UNITS.map(({ id, label }) => (
          <button key={id} onClick={() => changeUnit(id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all
              ${unit === id ? "bg-amber-500 text-white" : "bg-white/5 text-slate-400"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 成長曲線圖 */}
      {chartPoints.length >= 2 && (
        <div className="bg-slate-900/50 rounded-xl px-3 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400 font-bold">成長曲線</span>
            <div className="flex gap-3 text-[9px]">
              <span className="text-amber-400">── 平均分(0-10)</span>
              <span className="text-indigo-400">‐‐ 穩定性÷10</span>
            </div>
          </div>
          <GrowthChart points={chartPoints}/>
        </div>
      )}

      {/* 分組記錄 */}
      <div className="space-y-1.5">
        {grouped.map(({ key, logs: grpLogs, arrows, avg, stability, dist, wins }) => {
          const isCur = key === curKey;
          const isExp = expanded.has(key);
          const total = arrows.length;

          return (
            <div key={key}
              className={`rounded-xl border overflow-hidden
                ${isCur ? "border-amber-400/40 bg-amber-400/3" : "border-white/8"}`}>

              {/* 標頭（可展開） */}
              <button onClick={() => toggle(key)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isCur && (
                    <span className="shrink-0 text-[10px] font-bold text-amber-400
                      bg-amber-400/15 px-1.5 py-0.5 rounded">本期</span>
                  )}
                  <span className="font-bold text-sm text-slate-200">
                    {periodLabel(key, unit)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {grpLogs.length}場 {wins}勝
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {total > 0 && (
                    <>
                      <span className="text-xs text-amber-300 font-black">
                        均{isNaN(avg) ? "–" : avg.toFixed(1)}
                      </span>
                      {stability != null && !isNaN(stability) && (
                        <span className="text-[10px] font-bold"
                          style={{
                            color: stability >= 70 ? "#22c55e"
                              : stability >= 40 ? "#f59e0b" : "#ef4444"
                          }}>
                          穩{stability}%
                        </span>
                      )}
                    </>
                  )}
                  <span className="text-slate-600 text-xs">{isExp ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* 展開詳情 */}
              {isExp && (
                <div className="border-t border-white/8 px-3 pb-3 pt-2 space-y-3">

                  {/* 四格總覽 */}
                  {total > 0 && (
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        ["箭數", `${total}箭`],
                        ["平均", `${avg.toFixed(1)}分`],
                        ["穩定", stability != null ? `${stability}%` : "–"],
                        ["脫靶", `${dist[0] || 0}箭`],
                      ].map(([l, v]) => (
                        <div key={l} className="bg-white/5 rounded-lg p-1.5 text-center">
                          <div className="text-[9px] text-slate-500">{l}</div>
                          <div className="text-xs font-black text-slate-200">{v}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 分數分布 */}
                  {total > 0 && <ScoreDist dist={dist} total={total}/>}

                  {/* 個別對戰 */}
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold mb-1">個別場次</div>
                    <div className="space-y-0.5">
                      {grpLogs.map((log, i) => {
                        const la = extractArrows(log);
                        const lAvg = la.length ? calcAvg(la).toFixed(1) : null;
                        const d = logDate(log);
                        return (
                          <div key={log.id || i}
                            className="flex items-center justify-between text-xs
                              border-t border-white/5 pt-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span>{log.result === "win" ? "🏆" : "💀"}</span>
                              <span className="text-slate-300 truncate max-w-[100px]">
                                {log.monsterName || log.bossName || log.source || "–"}
                              </span>
                              {log.distance != null && (
                                <span className="text-slate-500 shrink-0">{log.distance}m</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {lAvg && (
                                <span className="text-amber-300 font-bold">{lAvg}分</span>
                              )}
                              <span className="text-slate-600 text-[10px]">
                                {d.getMonth()+1}/{d.getDate()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
