// src/worldboss/MatchGate.jsx
// ─────────────────────────────────────────────────────────────
// 🏆 比賽模式。**這是實體比賽當天的計分系統**，不是遊戲關卡。
//
// 跟世界王討伐的差別（作者 2026-08-01 指定）：
//   ・沒有回合上限——射到玩家自己按離場為止
//   ・三箭一回合
//   ・王**不會反擊**（沒有血量壓力、沒有倒地）
//   ・沒有獎勵，但有**自己獨立的排行榜**
//   ・場內選手與場外觀眾都即時看得到分數變化
//
// ⚠️ 因為是真的比賽，防呆比功能重要：
//   ① 離場要二次確認（按錯就中斷比賽了）
//   ② 斷線／重整／關 App 再開都要接得回來（分數存在 Firestore，不是本機）
//   ③ 重送同一回合不會重複計分（回合序號當冪等鍵）
//   ④ 沒送出的箭存在本機，重整回來還在
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  closeMatch, joinMatch, leaveMatch, reopenMatch, submitMatchEnd, subscribeMatch, todayMatchId,
} from "../lib/raidMatchDb";
import {
  MATCH_ARROWS_PER_END, MATCH_FACE, MATCH_MAX_END_SCORE, canSubmitEnd, endResult,
  matchBossRatio, matchLeaderboard, matchTotals, myStanding,
} from "./domain/matchScore";
import { RAID_LOBBY_BG } from "./raidAssets";
import MatchBossSVG from "./ui/MatchBossSVG";
import MatchLeaderboard from "./ui/MatchLeaderboard";
import RaidTarget from "./ui/RaidTarget";
import "./ui/raidFx.css";

const PENDING_KEY = "wb_match_pending_v1";

const card = {
  background: "rgba(15,23,42,.9)", borderRadius: 14, padding: 13, marginBottom: 10,
  border: "1px solid rgba(148,163,184,.16)",
};
const label = { fontSize: 11, fontWeight: 900, color: "#c7d2fe", marginBottom: 7 };

/** 沒送出的箭留在本機——重整回來不用重射（真的射出去的箭撿不回來） */
function loadPending(matchId) {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    if (raw?.matchId === matchId && Array.isArray(raw.arrows)) return raw.arrows;
  } catch { /* 壞掉就當沒有 */ }
  return [];
}
function savePending(matchId, arrows) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ matchId, arrows })); } catch { /* 無所謂 */ }
}

export default function MatchGate({ onBack, isAdmin = false }) {
  const { profile } = useAuth();
  const myId = profile?.id;
  const myName = profile?.name || "射手";
  const matchId = useMemo(() => todayMatchId(), []);

  const [match, setMatch] = useState(null);
  const [screen, setScreen] = useState("lobby");      // lobby | shooting
  const [pending, setPending] = useState(() => loadPending(matchId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [hit, setHit] = useState(false);
  const sendingRef = useRef(false);

  useEffect(() => subscribeMatch(matchId, setMatch), [matchId]);
  useEffect(() => { savePending(matchId, pending); }, [matchId, pending]);

  const players = match?.players || {};
  const board = useMemo(() => matchLeaderboard(players), [players]);
  const totals = useMemo(() => matchTotals(players), [players]);
  const mine = myStanding(board, myId);
  const closed = match?.status === "closed";
  const myEnds = Number(players?.[myId]?.ends) || 0;

  // ⚠️ 已經在比賽裡（重整／斷線回來）就直接回射擊畫面，不要退回大廳
  useEffect(() => {
    if (screen === "lobby" && players?.[myId]?.active && !closed) setScreen("shooting");
  }, [players, myId, screen, closed]);

  const flash = useCallback(msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  const enter = useCallback(async () => {
    setBusy(true); setError("");
    const res = await joinMatch(matchId, myId, myName, { bowType: profile?.bowType || null });
    setBusy(false);
    if (!res.ok) { setError(res.reason || "加入失敗"); return; }
    setScreen("shooting");
  }, [matchId, myId, myName, profile?.bowType]);

  /** 送出這一回合。⚠️ 用 myEnds 當序號——重送不會重複計分。 */
  const submitEnd = useCallback(async () => {
    if (sendingRef.current || !canSubmitEnd(pending)) return;
    sendingRef.current = true;
    setBusy(true); setError("");
    const res = await submitMatchEnd(matchId, myId, myEnds, pending);
    setBusy(false);
    sendingRef.current = false;
    if (!res.ok) {
      // 沒送出去就**不要清掉箭**，玩家才按得動重送
      setError(res.reason || "沒送出去，請再按一次送出");
      return;
    }
    setPending([]);
    setHit(true);
    setTimeout(() => setHit(false), 400);
    flash(res.duplicate ? "這回合已經記過了" : `+${endResult(pending).score} 分`);
  }, [pending, matchId, myId, myEnds, flash]);

  const doLeave = useCallback(async () => {
    await leaveMatch(matchId, myId);
    setConfirmLeave(false);
    setScreen("lobby");
  }, [matchId, myId]);

  // ── 大廳（也是場外觀戰畫面）────────────────────────────────
  if (screen === "lobby") {
    return (
      <div style={{
        position: "fixed", inset: 0, overflowY: "auto",
        backgroundImage: `linear-gradient(rgba(2,6,23,.9), rgba(2,6,23,.97)), url(${RAID_LOBBY_BG})`,
        backgroundSize: "cover", backgroundPosition: "center",
        padding: "14px 12px 28px", color: "#e2e8f0",
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {onBack && (
              <button type="button" onClick={onBack} style={{
                border: "none", background: "transparent", color: "#94a3b8",
                fontSize: 13, fontWeight: 900, cursor: "pointer", padding: 0,
              }}>← 返回</button>
            )}
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fde68a", flex: 1 }}>🏆 比賽模式</div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800 }}>{matchId}</div>
          </div>

          <div style={{ ...card, textAlign: "center" }}>
            <MatchBossSVG size={168} ratio={matchBossRatio(totals.damage, match?.bossMaxHp)} name="靶紙王" />
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fde68a", letterSpacing: 2, marginTop: 4 }}>
              靶紙王
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
              牠不會反擊——全場一起射，分數就是傷害
            </div>
            <div style={{
              height: 12, borderRadius: 6, background: "#1e293b", overflow: "hidden",
              marginTop: 9, border: "1px solid rgba(148,163,184,.25)",
            }}>
              <div style={{
                width: `${(1 - matchBossRatio(totals.damage, match?.bossMaxHp)) * 100}%`,
                height: "100%", background: "linear-gradient(90deg,#f59e0b,#ef4444)",
                transition: "width .5s",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10 }}>
              {[["上場", totals.players], ["射擊中", totals.shooting],
                ["總箭數", totals.arrows], ["全場總分", totals.score]].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 800 }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fbbf24" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ ...card, border: "1px solid rgba(248,113,113,.5)", background: "rgba(69,10,10,.5)" }}>
              <div style={{ fontSize: 11.5, color: "#fecaca", fontWeight: 800 }}>⚠️ {error}</div>
            </div>
          )}

          {closed ? (
            <div style={{
              ...card, textAlign: "center", border: "1px solid #f59e0b",
              fontSize: 13, fontWeight: 900, color: "#fde68a",
            }}>🏁 這場比賽已經收榜</div>
          ) : (
            <button type="button" onClick={enter} disabled={busy || !myId} style={{
              width: "100%", padding: "15px 0", borderRadius: 12, border: "none",
              background: myId ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#1e293b",
              color: myId ? "#fff" : "#64748b",
              fontWeight: 900, fontSize: 16, letterSpacing: 3, marginBottom: 10,
              cursor: myId && !busy ? "pointer" : "not-allowed",
              boxShadow: myId ? "0 6px 20px rgba(245,158,11,.35)" : "none",
            }}>
              {mine ? `🏹 繼續比賽（目前 ${mine.score} 分・第 ${mine.rank} 名）` : "🏹 上場比賽"}
            </button>
          )}

          <div style={card}>
            <div style={{ ...label, display: "flex", justifyContent: "space-between" }}>
              <span>即時排行</span>
              <span style={{ color: "#64748b", fontWeight: 800 }}>總分 → X 數 → 10 數</span>
            </div>
            <MatchLeaderboard board={board} myId={myId} />
          </div>

          {isAdmin && (
            <div style={{ ...card, border: "1px solid rgba(148,163,184,.3)" }}>
              <div style={label}>教練</div>
              <button type="button"
                onClick={() => (closed ? reopenMatch(matchId) : closeMatch(matchId))}
                style={{
                  width: "100%", padding: "10px 0", borderRadius: 9,
                  border: "1px solid #64748b", background: "transparent",
                  color: "#cbd5e1", fontWeight: 900, fontSize: 12, cursor: "pointer",
                }}>{closed ? "重新開放送分" : "🏁 收榜（停止送分）"}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 射擊畫面 ──────────────────────────────────────────────
  const end = endResult(pending);
  const ready = canSubmitEnd(pending);

  return (
    <div style={{
      position: "fixed", inset: 0, overflowY: "auto",
      background: "#05040a", color: "#e2e8f0", padding: "10px 10px 24px",
    }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* 王 ＋ 我的分數 */}
        <div style={{ ...card, padding: 10, textAlign: "center" }}>
          <MatchBossSVG size={132} ratio={matchBossRatio(totals.damage, match?.bossMaxHp)} hit={hit} />
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 6 }}>
            {[["我的總分", mine?.score ?? 0, "#fbbf24"],
              ["名次", mine ? `${mine.rank}/${board.length}` : "-", "#e2e8f0"],
              ["已射", `${mine?.arrows ?? 0} 箭`, "#94a3b8"]].map(([k, v, c]) => (
              <div key={k}>
                <div style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 800 }}>{k}</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          {players?.[myId]?.lastEnd?.length > 0 && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
              上一回合 {players[myId].lastEnd.join("・")}
            </div>
          )}
        </div>

        {/* 靶面。⚠️ 固定全靶（1~10 環），不給選——整場要用同一種靶紙分數才可比 */}
        <div style={{ ...card, padding: 8 }}>
          <div style={{
            fontSize: 10.5, color: "#94a3b8", fontWeight: 800,
            textAlign: "center", marginBottom: 4,
          }}>🎯 122cm 十環全靶（1~10 環）</div>
          <RaidTarget fmtId={MATCH_FACE} arrows={pending} radius={128}
            onArrow={arrow => setPending(p => (p.length >= MATCH_ARROWS_PER_END ? p : [...p, arrow]))} />
          <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 8 }}>
            {Array.from({ length: MATCH_ARROWS_PER_END }, (_, i) => (
              <div key={i} style={{
                width: 44, height: 34, borderRadius: 8, display: "grid", placeItems: "center",
                background: pending[i] ? "rgba(251,191,36,.18)" : "#1e293b",
                border: `1px solid ${pending[i] ? "#fbbf24" : "rgba(255,255,255,.1)"}`,
                fontSize: 15, fontWeight: 900, color: pending[i] ? "#fde68a" : "#475569",
              }}>{pending[i] ? end.labels[i] : "–"}</div>
            ))}
            <div style={{
              minWidth: 52, height: 34, borderRadius: 8, display: "grid", placeItems: "center",
              background: "rgba(15,23,42,.9)", border: "1px solid rgba(148,163,184,.2)",
              fontSize: 15, fontWeight: 900, color: "#fbbf24",
            }}>{end.score}<span style={{ fontSize: 9, color: "#94a3b8" }}>/{MATCH_MAX_END_SCORE}</span></div>
          </div>
        </div>

        {error && (
          <div style={{ ...card, border: "1px solid rgba(248,113,113,.5)", background: "rgba(69,10,10,.6)" }}>
            <div style={{ fontSize: 12, color: "#fecaca", fontWeight: 900 }}>⚠️ {error}</div>
            <div style={{ fontSize: 10.5, color: "#fca5a5", marginTop: 3 }}>
              箭還留著，網路好一點再按一次「送出」就好——不會重複計分。
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
          <button type="button" onClick={() => setPending(p => p.slice(0, -1))}
            disabled={!pending.length || busy}
            style={{
              padding: "14px 16px", borderRadius: 11, border: "1px solid #475569",
              background: "transparent", color: pending.length ? "#cbd5e1" : "#475569",
              fontWeight: 900, fontSize: 13, cursor: pending.length ? "pointer" : "not-allowed",
            }}>↩︎ 收回</button>
          <button type="button" onClick={submitEnd} disabled={!ready || busy || closed}
            style={{
              flex: 1, padding: "14px 0", borderRadius: 11, border: "none",
              background: ready && !closed ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#1e293b",
              color: ready && !closed ? "#fff" : "#64748b",
              fontWeight: 900, fontSize: 15, letterSpacing: 2,
              cursor: ready && !busy && !closed ? "pointer" : "not-allowed",
            }}>
            {closed ? "已收榜" : busy ? "送出中…" : ready ? `🏹 送出（${end.score} 分）` : `射滿 ${MATCH_ARROWS_PER_END} 箭`}
          </button>
        </div>

        {/* 即時排行：場內也要看得到別人 */}
        <div style={{ ...card, padding: 10 }}>
          <div style={{ ...label, marginBottom: 6 }}>即時排行</div>
          <MatchLeaderboard board={board} myId={myId} compact max={8} />
        </div>

        {/* ⚠️ 離場要二次確認——按錯就中斷比賽了 */}
        <button type="button" onClick={() => setConfirmLeave(true)} style={{
          width: "100%", padding: "10px 0", borderRadius: 10,
          border: "1px solid #334155", background: "transparent",
          color: "#94a3b8", fontWeight: 900, fontSize: 12, cursor: "pointer",
        }}>離場</button>
      </div>

      {toast && (
        <div style={{
          position: "fixed", top: 12, left: 0, right: 0, textAlign: "center", zIndex: 200,
          pointerEvents: "none",
        }}>
          <span style={{
            display: "inline-block", padding: "8px 18px", borderRadius: 999,
            background: "rgba(21,128,61,.95)", color: "#fff", fontSize: 14, fontWeight: 900,
          }}>{toast}</span>
        </div>
      )}

      {confirmLeave && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300, display: "grid", placeItems: "center",
          background: "rgba(2,6,23,.88)", padding: 20,
        }}>
          <div style={{
            maxWidth: 320, width: "100%", background: "#0f172a", borderRadius: 16,
            padding: 18, border: "1px solid rgba(148,163,184,.25)", textAlign: "center",
          }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fde68a", marginBottom: 6 }}>
              要離場嗎？
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.7, marginBottom: 14 }}>
              目前 <b style={{ color: "#fbbf24" }}>{mine?.score ?? 0} 分</b>，
              分數會留在排行榜上。
              <br />離場後還是可以再上場繼續射。
              {pending.length > 0 && (
                <><br /><span style={{ color: "#fca5a5", fontWeight: 900 }}>
                  這回合有 {pending.length} 箭還沒送出！
                </span></>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setConfirmLeave(false)} style={{
                flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg,#2563eb,#1e40af)", color: "#fff",
                fontWeight: 900, fontSize: 13, cursor: "pointer",
              }}>繼續比賽</button>
              <button type="button" onClick={doLeave} style={{
                padding: "12px 16px", borderRadius: 10, border: "1px solid #f87171",
                background: "transparent", color: "#f87171",
                fontWeight: 900, fontSize: 13, cursor: "pointer",
              }}>確定離場</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
