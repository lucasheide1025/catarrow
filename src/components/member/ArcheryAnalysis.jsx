// src/components/member/ArcheryAnalysis.jsx
// 🏹 深度分析（2026-08-02 重做）。
//
// ⚠️ 舊版放的是**遊戲數據**（平均、命中率、X 率的折線圖）——教練看完
//    不知道要修什麼。這一版只放「能導向動作修正」的東西，而且每一塊
//    都要能用一句話講完結論。
//
// ⚠️ **不主動抓資料**：所有數字都由呼叫端從本機快取餵進來，
//    要最新的請按「載入最新」（跟排行榜同一套紀律）。
import { useMemo, useState } from "react";
import {
  biasBreakdown, byCondition, consistency, groupAnalysis, groupVerdict,
  readiness, withPosition, withinEndTrend,
} from "../../lib/archeryAnalytics";

const card = {
  background: "linear-gradient(160deg, rgba(30,41,59,.92), rgba(15,23,42,.96))",
  borderRadius: 18, padding: 16,
  border: "1px solid rgba(148,163,184,.16)",
  boxShadow: "0 8px 28px rgba(0,0,0,.35)",
};
// ⚠️ 這個 sentinel 必須跟 MemberPerformance 的 ALL 一致（"all"）——
//    不一致會讓「未指定月份」被誤判成「已指定」，整頁資料變空。
const NONE = "all";
const label = {
  fontSize: 10, fontWeight: 900, letterSpacing: 2,
  color: "#7c8db5", textTransform: "uppercase",
};

/** 群組散佈圖：整組落點 + 平均落點 + 離散圈 */
function GroupPlot({ arrows, group, size = 260 }) {
  const pts = withPosition(arrows);
  const R = 100;
  const rings = [
    { r: R, fill: "#f8fafc" }, { r: R * 0.8, fill: "#1e293b" },
    { r: R * 0.6, fill: "#38bdf8" }, { r: R * 0.4, fill: "#ef4444" }, { r: R * 0.2, fill: "#fbbf24" },
  ];
  return (
    <svg viewBox="-118 -118 236 236" width={size} height={size} style={{ maxWidth: "100%" }}
      role="img" aria-label="落點群組">
      <defs>
        <radialGradient id="aa-glow" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="rgba(96,165,250,0)" />
          <stop offset="100%" stopColor="rgba(96,165,250,.18)" />
        </radialGradient>
      </defs>
      <circle cx="0" cy="0" r="115" fill="url(#aa-glow)" />
      {rings.map(ring => (
        <circle key={ring.r} cx="0" cy="0" r={ring.r} fill={ring.fill}
          stroke="rgba(15,23,42,.35)" strokeWidth="0.8" />
      ))}
      <line x1={-R - 8} y1="0" x2={R + 8} y2="0" stroke="rgba(15,23,42,.25)" strokeWidth="0.8" />
      <line x1="0" y1={-R - 8} x2="0" y2={R + 8} stroke="rgba(15,23,42,.25)" strokeWidth="0.8" />

      {/* 離散圈：一眼看出群組多大 */}
      {group.count > 1 && (
        <circle cx={group.centerX * R} cy={group.centerY * R} r={Math.max(4, group.spread * R * 2)}
          fill="rgba(168,85,247,.10)" stroke="#a855f7" strokeWidth="1.6" strokeDasharray="4 3" />
      )}

      {pts.map((a, i) => (
        <circle key={i} cx={a.position.x * R} cy={a.position.y * R} r="4"
          fill={a.isX ? "#22c55e" : "#0f172a"} stroke="#f8fafc" strokeWidth="1.2" opacity=".92" />
      ))}

      {group.count > 0 && (
        <g>
          <circle cx={group.centerX * R} cy={group.centerY * R} r="7"
            fill="none" stroke="#a855f7" strokeWidth="2.4" />
          <circle cx={group.centerX * R} cy={group.centerY * R} r="2" fill="#a855f7" />
        </g>
      )}
    </svg>
  );
}

/** 迷你長條圖：回合內每一支的平均 */
function EndTrendBars({ rows }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map(r => r.average), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 96, padding: "0 4px" }}>
      {rows.map(r => {
        const h = Math.max(6, (r.average / max) * 84);
        const weak = r.average < max - 0.8;
        return (
          <div key={r.position} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: weak ? "#fca5a5" : "#cbd5e1", marginBottom: 3 }}>
              {r.average}
            </div>
            <div style={{
              height: h, borderRadius: "6px 6px 2px 2px",
              background: weak
                ? "linear-gradient(180deg,#f87171,#7f1d1d)"
                : "linear-gradient(180deg,#60a5fa,#1e3a8a)",
              transition: "height .4s",
            }} />
            <div style={{ fontSize: 9, color: "#64748b", marginTop: 4 }}>第{r.position}支</div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ k, v, unit = "", tone = "#e2e8f0", hint }) {
  return (
    <div style={{
      background: "rgba(2,6,23,.5)", borderRadius: 12, padding: "10px 8px",
      textAlign: "center", border: "1px solid rgba(148,163,184,.1)",
    }}>
      <div style={{ fontSize: 9.5, color: "#7c8db5", fontWeight: 800 }}>{k}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: tone, lineHeight: 1.25 }}>
        {v}<span style={{ fontSize: 10, color: "#64748b", marginLeft: 2 }}>{unit}</span>
      </div>
      {hint && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/**
 * 期間選擇。
 * ⚠️ 只有相對期間（近 N 天）回答不了「上個月比較好還是這個月？」——
 *    檢討要挑得出**具體的月份與那一天**，所以三層都要有：
 *    相對期間 → 指定月份 → 指定單場。
 */
function PeriodPicker({ period, month, session, months, sessionList, onChange }) {
  const chip = (active, tone = "#60a5fa") => ({
    flexShrink: 0, padding: "6px 13px", borderRadius: 999, cursor: "pointer",
    border: `1px solid ${active ? tone : "rgba(148,163,184,.25)"}`,
    background: active ? `${tone}22` : "rgba(2,6,23,.5)",
    color: active ? tone : "#94a3b8", fontSize: 11.5, fontWeight: 900, whiteSpace: "nowrap",
  });
  const scroller = { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 };
  const usingMonth = month && month !== NONE;
  const usingSession = session && session !== NONE;

  return (
    <div style={{
      padding: "12px 14px", borderRadius: 16,
      background: "linear-gradient(160deg, rgba(30,41,59,.9), rgba(15,23,42,.95))",
      border: "1px solid rgba(148,163,184,.16)",
      display: "flex", flexDirection: "column", gap: 9,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#7c8db5" }}>分析範圍</span>
        {(usingMonth || usingSession) && (
          <button type="button"
            onClick={() => onChange({ month: NONE, session: NONE })}
            style={{ ...chip(false), marginLeft: "auto", padding: "4px 10px", fontSize: 10.5 }}>
            ✕ 清除指定
          </button>
        )}
      </div>

      {/* ① 相對期間 */}
      <div style={scroller}>
        {[["day", "今天"], ["week", "本週"], ["month", "本月"], ["year", "今年"], ["all", "全部"]].map(([v, l]) => (
          <button key={v} type="button"
            onClick={() => onChange({ period: v, month: NONE, session: NONE })}
            style={chip(!usingMonth && !usingSession && period === v)}>{l}</button>
        ))}
      </div>

      {/* ② 指定月份 */}
      {months.length > 0 && (
        <div style={scroller}>
          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 800, alignSelf: "center", flexShrink: 0 }}>月份</span>
          {months.map(m => (
            <button key={m.key} type="button"
              onClick={() => onChange({ month: m.key, session: NONE })}
              style={chip(month === m.key, "#a855f7")}>{m.label}<span style={{ opacity: .6, marginLeft: 4 }}>{m.count}</span></button>
          ))}
        </div>
      )}

      {/* ③ 指定單場（挑那一天） */}
      {sessionList.length > 0 && (
        <div style={scroller}>
          <span style={{ fontSize: 10, color: "#64748b", fontWeight: 800, alignSelf: "center", flexShrink: 0 }}>單場</span>
          {sessionList.map(s => (
            <button key={s.id} type="button"
              onClick={() => onChange({ session: s.id })}
              style={chip(session === s.id, "#4ade80")}>{s.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArcheryAnalysis({
  arrows = [], ends = [], sessions = [], allSessions = [],
  period = "all", month = NONE, session = NONE, onFilterChange,
  onRefresh, refreshing = false, lastSyncedAt = null,
}) {
  // 月份與單場清單都從**已載入的本機場次**推出來——不額外打網路
  const months = useMemo(() => {
    const map = new Map();
    for (const s of allSessions || []) {
      const ms = s.finalizedAt?.toMillis?.() || s.createdAt?.toMillis?.() || 0;
      if (!ms) continue;
      const d = new Date(ms);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key) || { key, label: `${d.getFullYear()}/${d.getMonth() + 1}`, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 12);
  }, [allSessions]);

  const sessionList = useMemo(() => (sessions || []).slice(0, 15).map(s => {
    const ms = s.finalizedAt?.toMillis?.() || s.createdAt?.toMillis?.() || 0;
    const d = ms ? new Date(ms) : null;
    return { id: s.id, label: d ? `${d.getMonth() + 1}/${d.getDate()}` : "—" };
  }), [sessions]);
  const [showAll, setShowAll] = useState(false);
  const group = useMemo(() => groupAnalysis(arrows), [arrows]);
  const verdict = useMemo(() => groupVerdict(group), [group]);
  const bias = useMemo(() => biasBreakdown(group), [group]);
  const trend = useMemo(() => withinEndTrend(ends), [ends]);
  const cons = useMemo(() => consistency(arrows), [arrows]);
  const conditions = useMemo(() => byCondition(sessions), [sessions]);
  const ready = useMemo(() => readiness(arrows), [arrows]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {onFilterChange && (
        <PeriodPicker period={period} month={month} session={session}
          months={months} sessionList={sessionList} onChange={onFilterChange} />
      )}

      {/* ⚠️ 手動載入——這頁常態只讀本機快取，不主動打網路 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 14,
        background: "rgba(2,6,23,.5)", border: "1px solid rgba(148,163,184,.14)",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 900, color: "#cbd5e1" }}>
            目前看的是本機資料
          </div>
          <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 1 }}>
            {lastSyncedAt ? `上次同步 ${lastSyncedAt}` : "要抓最新請按右邊"}
          </div>
        </div>
        {onRefresh && (
          <button type="button" onClick={onRefresh} disabled={refreshing} style={{
            padding: "8px 15px", borderRadius: 999, cursor: refreshing ? "wait" : "pointer",
            border: "1px solid rgba(96,165,250,.5)", background: "rgba(96,165,250,.14)",
            color: "#bfdbfe", fontSize: 11.5, fontWeight: 900, whiteSpace: "nowrap",
          }}>{refreshing ? "載入中…" : "↻ 載入最新"}</button>
        )}
      </div>

      {/* 資料不足：⚠️ 要講「還差多少」與「怎麼做才有」 */}
      {!ready.ready && (
        <div style={{ ...card, borderColor: "rgba(251,191,36,.35)" }}>
          <div style={label}>資料不足</div>
          <div style={{ fontSize: 13.5, fontWeight: 900, color: "#fde68a", marginTop: 6 }}>
            {ready.scoreOnly
              ? "這些練習只記了分數，沒有落點"
              : `再 ${ready.need} 支有落點的箭就能做群組分析`}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, lineHeight: 1.8 }}>
            {ready.scoreOnly
              ? "群組分析需要知道每一箭射在哪裡。下次練習時把記分方式切成「點靶面」，系統就會記下落點。"
              : "落點只有在「點靶面」記分時才會保存；用分數鍵盤記的箭只有環數。"}
          </div>
        </div>
      )}

      {/* ── 群組分析：這頁的主角 ── */}
      {ready.ready && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ ...label, flex: 1 }}>落點群組</div>
            <span style={{ fontSize: 10, color: "#64748b" }}>{group.count} 支</span>
          </div>

          {/* ⚠️ 結論先講，圖表在後——教練要的是一句話 */}
          <div style={{
            padding: "11px 13px", borderRadius: 12, marginBottom: 12,
            background: `${verdict.tone}18`, border: `1px solid ${verdict.tone}55`,
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: verdict.tone, lineHeight: 1.5 }}>
              {verdict.text}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <GroupPlot arrows={arrows} group={group} />
          </div>
          <div style={{ fontSize: 10, color: "#64748b", textAlign: "center", marginBottom: 12 }}>
            <span style={{ color: "#a855f7", fontWeight: 900 }}>◎</span> 平均落點與離散範圍・
            <span style={{ color: "#22c55e", fontWeight: 900 }}>●</span> X
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            <Stat k="離散度" v={group.spread} tone="#60a5fa" hint="越小越穩" />
            <Stat k="群組大小" v={group.groupSize} tone="#a855f7" hint="涵蓋 95%" />
            <Stat k="中心偏移" v={group.offset} tone={group.offset < 0.08 ? "#4ade80" : "#fbbf24"} hint="離靶心" />
          </div>

          {/* ⚠️ 左右／上下分開講——成因與修法不同 */}
          {bias.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
              {bias.map(b => (
                <div key={b.axis} style={{
                  padding: "9px 12px", borderRadius: 11,
                  background: "rgba(2,6,23,.55)", border: "1px solid rgba(148,163,184,.14)",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#e2e8f0" }}>
                    {b.axis === "horizontal" ? "↔️" : "↕️"} 整組偏{b.side}
                    <span style={{ color: "#64748b", fontWeight: 800, marginLeft: 6, fontSize: 10 }}>
                      {b.magnitude}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3, lineHeight: 1.7 }}>
                    {b.hint}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 回合內衰退 ── */}
      {trend.rows.length > 1 && (
        <div style={card}>
          <div style={label}>回合內表現</div>
          <div style={{
            fontSize: 13, fontWeight: 900, marginTop: 6, marginBottom: 10,
            color: trend.fatigue ? "#fca5a5" : "#4ade80", lineHeight: 1.5,
          }}>
            {trend.fatigue
              ? `後段掉 ${trend.drop} 環——體力或專注撐不到最後，可以縮短每組箭數`
              : "整組維持得很平均，體力配置沒問題"}
          </div>
          <EndTrendBars rows={trend.rows} />
        </div>
      )}

      {/* ── 一致性 ── */}
      {cons.count > 0 && (
        <div style={card}>
          <div style={label}>一致性</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 8 }}>
            <Stat k="最長連續好球" v={cons.bestStreak} unit=" 支" tone="#4ade80" hint="9環以上" />
            <Stat k="X 率" v={Math.round(cons.xRate * 100)} unit="%" tone="#fbbf24" />
            <Stat k="脫靶率" v={Math.round(cons.missRate * 100)} unit="%"
              tone={cons.missRate > 0.05 ? "#f87171" : "#64748b"} />
          </div>
        </div>
      )}

      {/* ── 分層：⚠️ 不同距離不能混在一起平均 ── */}
      {conditions.length > 0 && (
        <div style={card}>
          <div style={label}>依距離／靶紙分層</div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, marginBottom: 9 }}>
            不同距離是兩種技術狀態，混在一起平均沒有意義
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(showAll ? conditions : conditions.slice(0, 4)).map(c => (
              <div key={c.key} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 11,
                background: "rgba(2,6,23,.55)", border: "1px solid rgba(148,163,184,.12)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 900, color: "#e2e8f0" }}>{c.key}</div>
                  <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 1 }}>
                    {c.sessions} 場・{c.arrows} 支
                  </div>
                </div>
                <div style={{ fontSize: 19, fontWeight: 900, color: "#fbbf24" }}>
                  {c.average}
                  <span style={{ fontSize: 9.5, color: "#64748b", marginLeft: 2 }}>環</span>
                </div>
              </div>
            ))}
          </div>
          {conditions.length > 4 && (
            <button type="button" onClick={() => setShowAll(v => !v)} style={{
              width: "100%", marginTop: 9, padding: "8px 0", borderRadius: 10,
              border: "1px solid rgba(148,163,184,.25)", background: "transparent",
              color: "#94a3b8", fontSize: 11, fontWeight: 900, cursor: "pointer",
            }}>{showAll ? "收合" : `展開其餘 ${conditions.length - 4} 種條件`}</button>
          )}
        </div>
      )}
    </div>
  );
}
