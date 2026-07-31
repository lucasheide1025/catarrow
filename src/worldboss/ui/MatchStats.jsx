// src/worldboss/ui/MatchStats.jsx
// 📊 落點統計表。**比賽後檢討要看的東西**（作者 2026-08-01）。
//
// ⚠️ 教練要看的不是「這一箭幾分」，是**系統性偏差**：
//    整組落點偏左下，代表瞄準或放箭有固定問題，那才修得動。
//    所以這裡同時給散佈圖（看得到形狀）與平均落點／離散度（講得出數字）。
//
// ⚠️ 資料是**點開才抓**的（getMatchShots），不做即時監聽——
//    幾千筆落點推給全場每一個人是災難。
import { useState } from "react";
import { shotStats } from "../domain/matchScore";

const RINGS = [
  { r: 100, fill: "#f8fafc" }, { r: 80, fill: "#1e293b" },
  { r: 60, fill: "#38bdf8" }, { r: 40, fill: "#ef4444" }, { r: 20, fill: "#fbbf24" },
];

/** 散佈圖：一個人的所有落點畫在同一張靶上 */
function ShotPlot({ shots = [], size = 190, center = null }) {
  return (
    <svg viewBox="-115 -115 230 230" width={size} height={size} role="img" aria-label="落點分佈">
      {RINGS.map(ring => (
        <circle key={ring.r} cx="0" cy="0" r={ring.r} fill={ring.fill}
          stroke="rgba(15,23,42,.35)" strokeWidth="1" />
      ))}
      <line x1="-108" y1="0" x2="108" y2="0" stroke="rgba(15,23,42,.25)" strokeWidth="1" />
      <line x1="0" y1="-108" x2="0" y2="108" stroke="rgba(15,23,42,.25)" strokeWidth="1" />
      {shots.filter(s => s.l !== "M").map((s, i) => (
        <circle key={i} cx={(Number(s.x) || 0) * 100} cy={(Number(s.y) || 0) * 100} r="4.5"
          fill={s.l === "X" ? "#22c55e" : "#0f172a"}
          stroke="#f8fafc" strokeWidth="1.4" opacity="0.92" />
      ))}
      {/* 平均落點：一眼看出整組偏哪裡 */}
      {center && (
        <g>
          <circle cx={center.x * 100} cy={center.y * 100} r="9"
            fill="none" stroke="#a855f7" strokeWidth="2.5" />
          <circle cx={center.x * 100} cy={center.y * 100} r="2.5" fill="#a855f7" />
        </g>
      )}
    </svg>
  );
}

export default function MatchStats({ board = [], shotsByMember = {}, myId = null, onClose }) {
  const [openId, setOpenId] = useState(myId);
  const open = shotsByMember[openId];
  const openShots = Array.isArray(open?.shots) ? open.shots : [];
  const st = shotStats(openShots);
  const openName = board.find(p => p.memberId === openId)?.name || open?.name || "";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 260, overflowY: "auto",
      background: "rgba(2,6,23,.96)", padding: "16px 12px 28px", color: "#e2e8f0",
    }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#fde68a", flex: 1 }}>📊 落點統計</div>
          <button type="button" onClick={onClose} style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #475569",
            background: "transparent", color: "#cbd5e1", fontSize: 12, fontWeight: 900, cursor: "pointer",
          }}>關閉</button>
        </div>

        {/* 選射手 */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 10 }}>
          {board.map(p => (
            <button key={p.memberId} type="button" onClick={() => setOpenId(p.memberId)}
              style={{
                flexShrink: 0, padding: "7px 12px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${openId === p.memberId ? "#fbbf24" : "rgba(148,163,184,.3)"}`,
                background: openId === p.memberId ? "rgba(251,191,36,.16)" : "#1e293b",
                color: openId === p.memberId ? "#fde68a" : "#cbd5e1",
                fontSize: 11.5, fontWeight: 900, whiteSpace: "nowrap",
              }}>
              {p.rank}. {p.name}
              <span style={{ color: "#94a3b8", marginLeft: 5 }}>{p.score}</span>
            </button>
          ))}
        </div>

        {!openShots.length ? (
          <div style={{
            padding: "26px 12px", textAlign: "center", borderRadius: 12,
            border: "1px dashed rgba(148,163,184,.3)", color: "#64748b",
            fontSize: 12, fontWeight: 800,
          }}>
            {openId ? `${openName} 還沒有落點紀錄` : "選一位射手"}
            {/* ⚠️ 有分數卻沒有落點＝子集合的規則還沒開。
                比賽當天要讓教練當場知道該做什麼，不是回去查 log。 */}
            {openId && (board.find(p => p.memberId === openId)?.arrows > 0) && (
              <div style={{
                marginTop: 10, padding: "9px 11px", borderRadius: 9, textAlign: "left",
                background: "rgba(69,26,3,.6)", border: "1px solid rgba(251,191,36,.45)",
                color: "#fde68a", fontSize: 10.5, lineHeight: 1.7, fontWeight: 700,
              }}>
                這位射手已經有 {board.find(p => p.memberId === openId)?.arrows} 箭的成績，
                但落點沒有存到——通常是 Firestore 規則少了子集合那一段。
                <br />請到 Console 的 <b>raidMatches</b> 規則裡加上：
                <br /><code style={{ color: "#fff" }}>{"match /shots/{memberId} { allow read, write: if isLoggedIn(); }"}</code>
                <br />⚠️ 分數不受影響，補上規則之後的每一箭都會開始記錄。
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{
              background: "rgba(15,23,42,.9)", borderRadius: 14, padding: 13, marginBottom: 10,
              border: "1px solid rgba(148,163,184,.16)", textAlign: "center",
            }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#fde68a", marginBottom: 8 }}>
                {openName}
              </div>
              <ShotPlot shots={openShots} center={{ x: st.centerX, y: st.centerY }} />
              <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>
                <span style={{ color: "#a855f7", fontWeight: 900 }}>◎</span> 平均落點・
                <span style={{ color: "#22c55e", fontWeight: 900 }}>●</span> X
              </div>
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 10,
            }}>
              {[["總分", st.total, "#fbbf24"], ["箭數", st.shots, "#e2e8f0"],
                ["平均", st.average.toFixed(2), "#e2e8f0"],
                ["X / 10", `${st.xCount} / ${st.tens}`, "#4ade80"],
                ["脫靶", st.misses, st.misses ? "#f87171" : "#64748b"],
                ["離散度", st.spread.toFixed(3), "#60a5fa"]].map(([k, v, c]) => (
                <div key={k} style={{
                  background: "rgba(15,23,42,.9)", borderRadius: 10, padding: "8px 4px",
                  textAlign: "center", border: "1px solid rgba(148,163,184,.14)",
                }}>
                  <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 800 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: c }}>{v}</div>
                </div>
              ))}
            </div>

            {/* ⚠️ 這一行才是教練真正要的：整組偏哪裡 */}
            <div style={{
              background: "rgba(88,28,135,.25)", border: "1px solid rgba(168,85,247,.45)",
              borderRadius: 12, padding: "10px 12px", marginBottom: 10,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: "#e9d5ff" }}>
                🎯 整組落點：{st.bias}
              </div>
              <div style={{ fontSize: 10.5, color: "#c4b5fd", marginTop: 3, lineHeight: 1.6 }}>
                離散度 {st.spread.toFixed(3)}（越小越穩）。
                偏移是可以修的，離散大才是動作還不穩定。
              </div>
            </div>

            {/* 逐箭明細：按回合分組，跟紙本記分表一樣 */}
            <div style={{
              background: "rgba(15,23,42,.9)", borderRadius: 12, padding: 12,
              border: "1px solid rgba(148,163,184,.16)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#c7d2fe", marginBottom: 8 }}>
                逐箭明細
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {Object.entries(openShots.reduce((acc, sh, i) => {
                  const e = Number(sh.e) || Math.floor(i / 3);
                  (acc[e] = acc[e] || []).push(sh);
                  return acc;
                }, {})).map(([end, list]) => (
                  <div key={end} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 8px", borderRadius: 8, background: "#1e293b",
                  }}>
                    <span style={{ fontSize: 10, color: "#64748b", fontWeight: 800, width: 34 }}>
                      第{Number(end) + 1}輪
                    </span>
                    {list.map((sh, i) => (
                      <span key={i} style={{
                        minWidth: 28, textAlign: "center", padding: "2px 5px", borderRadius: 6,
                        background: sh.l === "M" ? "rgba(248,113,113,.18)" : "rgba(251,191,36,.14)",
                        color: sh.l === "M" ? "#fca5a5" : "#fde68a",
                        fontSize: 12, fontWeight: 900,
                      }}>{sh.l}</span>
                    ))}
                    <span style={{
                      marginLeft: "auto", fontSize: 12, fontWeight: 900, color: "#fbbf24",
                    }}>{list.reduce((a, x) => a + (Number(x.p) || 0), 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
