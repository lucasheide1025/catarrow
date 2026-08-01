// src/worldboss/MatchGate.jsx
// ─────────────────────────────────────────────────────────────
// 🏆 比賽模式。**這是實體比賽當天的計分系統**，不是遊戲關卡。
//
// ⚠️ 但體感要**跟打世界王一模一樣**（作者 2026-08-01）：
//    所以射擊畫面直接用 `RaidScreen` 本體——箭飛過去、王中箭、傷害數字、
//    弱點圈、破防槽、震動、音效全部照舊。自己另外做一個「記分表畫面」
//    是第一版的錯，那看起來就只是在填表。
//
// 跟討伐的差別只有三個開關：
//   ・`endless`        沒有回合上限——射到玩家自己按離場為止
//   ・`noRetaliation`  王不反擊（連蓄力預告都不跑）
//   ・`arrowsPerRound` 三箭一回合
//
// ⚠️ 分數與傷害是**兩套東西**（作者 2026-08-01）：
//    ・排行榜排序永遠用**靶紙印的環數**（對得上紙本記分表）
//    ・場內的射手只看得到**傷害**，看不到正確分數
//    ・場外的人（大螢幕／教練／觀眾）看到的是**分數 ＋ 傷害**
//
// 防呆（比賽當天比功能重要）：
//   ① 離場要二次確認
//   ② 斷線／重整／關 App 再開都接得回來（分數在 Firestore，不是本機）
//   ③ 重送同一回合不會重複計分（回合序號當冪等鍵）
//   ④ 送出失敗一定跳紅底 ＋ 重送鈕，絕不沉默
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  MATCH_BOSS_MAX_HP, closeMatch, getMatchShots, grantMatchRewards, joinMatch, leaveMatch,
  reopenMatch, resetMatch, saveMatchRewardConfig, submitMatchArrow, subscribeMatch, todayMatchId,
} from "../lib/raidMatchDb";
import {
  MATCH_ARROWS_PER_END, MATCH_FACE, arrowPoints, endResult,
  matchBossRatio, matchLeaderboard, matchTotals, myStanding,
} from "./domain/matchScore";
import { arrowFeedback, milestoneFor, pickCheer } from "./domain/matchCheer";
import { matchRewardFor } from "./domain/matchRewards";
import { entriesFromMatchBoard } from "./domain/tournament";
import { createRaidState } from "./domain/raidFlow";
import { RAID_LOBBY_BG, randomRaidBackground } from "./raidAssets";
import MatchBossArt from "./ui/MatchBossArt";
import MatchLeaderboard from "./ui/MatchLeaderboard";
import MatchStats from "./ui/MatchStats";
import MatchAdminPanel from "./ui/MatchAdminPanel";
import TournamentGate from "./TournamentGate";
import RaidScreen from "./ui/RaidScreen";
import "./ui/raidFx.css";

const card = {
  background: "rgba(15,23,42,.9)", borderRadius: 14, padding: 13, marginBottom: 10,
  border: "1px solid rgba(148,163,184,.16)",
};
const label = { fontSize: 11, fontWeight: 900, color: "#c7d2fe", marginBottom: 7 };

// 靶紙王：不反擊，所以 atk 是 0——防禦留著只是給傷害公式用
const MATCH_BOSS = Object.freeze({
  key: "match_target", name: "靶紙王", atk: 0, def: 40, skillConfig: null,
});
// 5 米＝基準射程。比賽當天每個人的距離不見得一樣，但**環數才是成績**，
// 射程倍率只影響「傷害」那層裝飾——所以全場用同一個值，才不會有人傷害虛高。
const MATCH_DISTANCE = 5;

export default function MatchGate({ onBack, isAdmin = false }) {
  const { profile } = useAuth();
  const myId = profile?.id;
  const myName = profile?.name || "射手";
  const matchId = useMemo(() => todayMatchId(), []);

  const [match, setMatch] = useState(null);
  const [screen, setScreen] = useState("lobby");      // lobby | battle
  const [battle, setBattle] = useState(null);
  const [runId, setRunId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cheer, setCheer] = useState(null);
  const [showBoard, setShowBoard] = useState(false);
  // 🏆 每次上場隨機換戰場——射一整天才不會膩
  const [bgUrl, setBgUrl] = useState(() => randomRaidBackground());
  const [confirmLeave, setConfirmLeave] = useState(false);
  const sendingRef = useRef(false);
  const prevCheerRef = useRef(null);
  const lastArrowRef = useRef(null);    // 沒送出去時要重送的那一支箭
  const prevArrowLineRef = useRef(null);
  const [arrowFx, setArrowFx] = useState(null);   // 每一支箭的即時特效
  const [stats, setStats] = useState(null);       // 📊 落點統計（點開才抓）
  const [loadingStats, setLoadingStats] = useState(false);
  // 🏛️ 對外賽事紀錄：null=不開；物件=帶著要匯入的草稿開
  const [tourney, setTourney] = useState(null);

  useEffect(() => subscribeMatch(matchId, setMatch), [matchId]);

  const players = match?.players || {};
  const board = useMemo(() => matchLeaderboard(players), [players]);
  const totals = useMemo(() => matchTotals(players), [players]);
  const mine = myStanding(board, myId);
  const closed = match?.status === "closed";
  const bossMaxHp = Number(match?.bossMaxHp) || MATCH_BOSS_MAX_HP;
  // ⚠️ 獎勵是比賽後教練統一發的，但**現在就要看得到累積了多少**（作者 2026-08-01）：
  //    看不到累積量，玩家不知道多射有什麼用。這是純前端計算，不多讀一次 Firestore。
  const myReward = useMemo(
    () => matchRewardFor(players?.[myId] || {}, match?.reward),
    [players, myId, match?.reward],
  );

  const startBattle = useCallback(() => {
    setBattle(createRaidState({
      boss: {
        ...MATCH_BOSS,
        // 王的血是**全場共享**的：帶當下剩餘，別人打掉的也算
        hp: bossMaxHp - (totals.damage % bossMaxHp),
        maxHp: bossMaxHp,
      },
      members: [{
        memberId: myId, name: myName,
        stats: { atk: 120, def: 60, hp: 9999 },     // 不反擊，HP 只是擺著
        archerLevel: 50, cats: [],
        targetFmt: MATCH_FACE, distanceM: MATCH_DISTANCE,
      }],
      targetFmt: MATCH_FACE, distanceM: MATCH_DISTANCE,
      noRetaliation: true, endless: true,
      // ⚠️ 弱點固定在正中心（＝靶心）：比賽當天讓圈亂跑，選手會去追圈
      //    而不是照自己的動作射——那會直接傷害成績。
      fixedSpots: true,
    }));
    setBgUrl(randomRaidBackground());
    setRunId(n => n + 1);
    setScreen("battle");
  }, [bossMaxHp, totals.damage, myId, myName]);

  const enter = useCallback(async () => {
    setBusy(true); setError("");
    const res = await joinMatch(matchId, myId, myName, {
      bowType: profile?.bowType || null, catId: profile?.equippedCat?.catId || null,
    });
    setBusy(false);
    if (!res.ok) { setError(res.reason || "加入失敗"); return; }
    startBattle();
  }, [matchId, myId, myName, profile?.bowType, profile?.equippedCat?.catId, startBattle]);

  // ⚠️ 已經在比賽裡（重整／斷線回來）就直接回戰鬥畫面，不要退回大廳
  useEffect(() => {
    if (screen === "lobby" && players?.[myId]?.active && !closed && !battle) startBattle();
  }, [players, myId, screen, closed, battle, startBattle]);

  /**
   * 把這一輪的箭**一支一支**寫進去。
   *
   * ⚠️ 輸入是三箭一次（作者 2026-08-01：一箭一箭輸入太慢），
   *    但**寫入仍然是逐箭**——落點要一筆一筆留，而且箭序當冪等鍵，
   *    重送不會重複計分。兩件事不要混為一談。
   *
   * ⚠️ 序號要用**本機遞增**：三次寫入之間監聽還沒回來，
   *    每次都讀 players[myId].arrows 會拿到同一個舊值，第二箭就被當成重送。
   */
  const sendArrows = useCallback(async (arrows) => {
    const base = Number(players?.[myId]?.arrows) || 0;
    for (let i = 0; i < arrows.length; i += 1) {
      const res = await submitMatchArrow(matchId, myId, base + i, arrows[i]);
      if (!res.ok) {
        setError(res.reason || `第 ${i + 1} 箭沒送出去，請按重送`);
        return { ok: false, sent: i };
      }
    }
    setError("");
    return { ok: true, sent: arrows.length };
  }, [matchId, myId, players]);

  /**
   * 一輪演出**跑完之後**才進來。
   * ⚠️ 順序是刻意的：先看完戰鬥，再看到激勵詞。
   *    射完就跳等於在說「戲演完了」，那句話反而變成打斷。
   */
  const onRoundDone = useCallback(async (next, log) => {
    const shots = (log || []).filter(e => e.type === "arrow" && e.memberId === myId);
    if (!shots.length) return;
    lastArrowRef.current = shots;

    // ① 特效用**這一輪最好的那一箭**——射到 X 就該看到 X 的演出，
    //    三箭各播一次會疊在一起，反而什麼都看不清楚。
    const best = shots.reduce((a, b) => (arrowPoints(b) > arrowPoints(a) ? b : a));
    const fb = arrowFeedback(arrowPoints(best), best.label, { prevLine: prevArrowLineRef.current });
    prevArrowLineRef.current = fb.line;
    setArrowFx({ ...fb, label: best.label, key: Date.now() });
    setTimeout(() => setArrowFx(null), fb.big ? 1000 : 1100);

    // ② 整輪的激勵詞（等單箭特效播完再跳）
    const r = endResult(shots);
    const arrowsBefore = Number(players?.[myId]?.arrows) || 0;
    const c = pickCheer(r, { prevLine: prevCheerRef.current });
    prevCheerRef.current = c.line;
    setTimeout(() => setCheer({
      ...c, damage: r.damage,
      milestone: milestoneFor(arrowsBefore, arrowsBefore + r.arrows),
    }), fb.big ? 900 : 1000);

    if (sendingRef.current) return;
    sendingRef.current = true;
    await sendArrows(shots);
    sendingRef.current = false;
  }, [myId, players, sendArrows]);

  const retrySend = useCallback(async () => {
    if (!lastArrowRef.current?.length) return;
    setBusy(true);
    await sendArrows(lastArrowRef.current);
    setBusy(false);
  }, [sendArrows]);

  const openStats = useCallback(async () => {
    setLoadingStats(true);
    const shots = await getMatchShots(matchId);
    setLoadingStats(false);
    setStats(shots);
  }, [matchId]);

  const doLeave = useCallback(async () => {
    await leaveMatch(matchId, myId);
    setConfirmLeave(false);
    setBattle(null);
    setScreen("lobby");
  }, [matchId, myId]);

  // 別人也在打——王的血條要跟著全場走（差太多才更新，免得每次推播都重繪）
  useEffect(() => {
    // ⚠️ 全場傷害超過王的血時要**繞回去**（取餘數），不能夾在 1——
    //    夾住的話王每一輪都被秒殺，所有人的箭都記不進去（比賽當天踩過）。
    const shared = bossMaxHp - (totals.damage % bossMaxHp);
    setBattle(b => (b && Math.abs(b.bossHp - shared) > bossMaxHp * 0.002
      ? { ...b, bossHp: shared } : b));
  }, [totals.damage, bossMaxHp]);

  // ── 大廳＝場外觀戰畫面（分數 ＋ 傷害）─────────────────────
  if (screen === "lobby" || !battle) {
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
            <MatchBossArt size={150} ratio={matchBossRatio(totals.damage, bossMaxHp)} name="靶紙王" />
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
                width: `${matchBossRatio(totals.damage, bossMaxHp) * 100}%`,
                height: "100%", background: "linear-gradient(90deg,#ef4444,#f59e0b,#22c55e)",
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
              {mine ? `🏹 繼續討伐（${mine.score} 分・第 ${mine.rank} 名）` : "🏹 上場討伐"}
            </button>
          )}

          {/* 🎁 累積獎勵：比賽後由教練統一發放，但現在就看得到 */}
          {mine && (
            <div style={{ ...card, border: "1px solid rgba(251,191,36,.4)" }}>
              <div style={{ ...label, display: "flex", justifyContent: "space-between" }}>
                <span>🎁 我累積的獎勵</span>
                <span style={{ color: "#64748b", fontWeight: 800 }}>
                  {players?.[myId]?.rewarded ? "已發放" : "比賽後由教練發放"}
                </span>
              </div>
              {myReward.eligible ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                    {[["射手XP", myReward.archerXP], ["貓貓XP", myReward.catXP],
                      ["金幣", myReward.coins], ["材料箱", myReward.chests],
                      ["金幣箱", myReward.coinChests], ["箭數", myReward.arrows]].map(([k, v]) => (
                      <div key={k} style={{
                        background: "#1e293b", borderRadius: 9, padding: "7px 0", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 800 }}>{k}</div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: "#fbbf24" }}>+{v}</div>
                      </div>
                    ))}
                  </div>
                  {myReward.accurate && (
                    <div style={{ fontSize: 10.5, color: "#bbf7d0", fontWeight: 800, marginTop: 6 }}>
                      🎯 平均 {myReward.average.toFixed(1)} 環——準度加碼，兩種寶箱各 +1
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800 }}>
                  再射 {Math.max(0, 3 - (myReward.arrows || 0))} 箭就開始累積獎勵
                </div>
              )}
            </div>
          )}

          <div style={card}>
            <div style={{ ...label, display: "flex", justifyContent: "space-between" }}>
              <span>即時排行</span>
              <span style={{ color: "#64748b", fontWeight: 800 }}>總分 → X 數 → 10 數</span>
            </div>
            {/* 場外看得到正確分數 ＋ 傷害 */}
            <MatchLeaderboard board={board} myId={myId} show="both" />
            <button type="button" onClick={openStats} disabled={loadingStats || !board.length}
              style={{
                width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 10,
                border: "1px solid rgba(168,85,247,.5)", background: "rgba(88,28,135,.28)",
                color: "#e9d5ff", fontWeight: 900, fontSize: 12.5,
                cursor: board.length ? "pointer" : "not-allowed", opacity: board.length ? 1 : .5,
              }}>{loadingStats ? "載入中…" : "📊 落點統計（每一箭的位置）"}</button>
          </div>

          {stats && (
            <MatchStats board={board} shotsByMember={stats} myId={myId} onClose={() => setStats(null)} />
          )}

          {tourney && (
            <TournamentGate isAdmin={isAdmin} importDraft={tourney.draft || null}
              onBack={() => setTourney(null)} />
          )}

          <button type="button" onClick={() => setTourney({ open: true })} style={{
            width: "100%", padding: "11px 0", borderRadius: 10, marginBottom: 10,
            border: "1px solid rgba(251,191,36,.45)", background: "rgba(251,191,36,.12)",
            color: "#fde68a", fontWeight: 900, fontSize: 12.5, cursor: "pointer",
          }}>🏛️ 對外賽事紀錄（資格賽・對抗賽）</button>

          {isAdmin && board.length > 0 && (
            <button type="button"
              onClick={() => setTourney({
                draft: {
                  name: `館內比賽 ${matchId}`,
                  date: matchId,
                  type: "internal",
                  entries: entriesFromMatchBoard(board),
                  sourceMatchId: matchId,
                },
              })}
              style={{
                width: "100%", padding: "11px 0", borderRadius: 10, marginBottom: 10,
                border: "1px solid #a855f7", background: "rgba(88,28,135,.3)",
                color: "#e9d5ff", fontWeight: 900, fontSize: 12.5, cursor: "pointer",
              }}>📥 把這場成績結算進對外賽事紀錄（{board.length} 人）</button>
          )}

          {isAdmin && (
            <MatchAdminPanel
              matchId={matchId} players={players} closed={closed} config={match?.reward}
              onSaveConfig={cfg => saveMatchRewardConfig(matchId, cfg)}
              onGrant={() => grantMatchRewards(matchId)}
              onReset={() => resetMatch(matchId)}
              onToggleClose={() => (closed ? reopenMatch(matchId) : closeMatch(matchId))}
            />
          )}
        </div>
      </div>
    );
  }

  // ── 戰鬥畫面＝真正的討伐畫面 ──────────────────────────────
  return (
    <>
      <RaidScreen
        key={runId}
        state={battle}
        bossKey="match_target"
        bossTitle="全場共同討伐"
        renderBoss={size => (
          <MatchBossArt size={size} ratio={matchBossRatio(totals.damage, bossMaxHp)} name="靶紙王" />
        )}
        participants={totals.players}
        playerName={myName}
        bgUrl={bgUrl}
        targetFmt={MATCH_FACE}
        meId={myId}
        arrowsPerRound={MATCH_ARROWS_PER_END}
        endless
        onState={next => setBattle(next)}
        onRoundDone={onRoundDone}
        onExit={() => setConfirmLeave(true)}
        statusExtra={
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 8px",
            overflowX: "auto", background: "rgba(2,6,23,.55)",
          }}>
            {/* 我的名次——不用離開戰鬥就看得到（作者 2026-08-01） */}
            <button type="button" onClick={() => setShowBoard(true)} style={{
              flexShrink: 0, padding: "4px 10px", borderRadius: 999, cursor: "pointer",
              border: "1px solid rgba(251,191,36,.55)", background: "rgba(251,191,36,.16)",
              color: "#fde68a", fontSize: 11.5, fontWeight: 900,
            }}>🏆 第 {mine?.rank ?? "-"} 名／{board.length} 人</button>
            <button type="button" onClick={openStats} style={{
              flexShrink: 0, padding: "4px 9px", borderRadius: 999, cursor: "pointer",
              border: "1px solid rgba(168,85,247,.5)", background: "rgba(88,28,135,.3)",
              color: "#e9d5ff", fontSize: 11, fontWeight: 900,
            }}>📊 落點</button>
            {/* 累積獎勵——看不到的話玩家不知道多射有什麼用 */}
            <div style={{
              flexShrink: 0, padding: "4px 10px", borderRadius: 999,
              border: "1px solid rgba(74,222,128,.45)", background: "rgba(21,128,61,.22)",
              color: "#bbf7d0", fontSize: 10.5, fontWeight: 900, whiteSpace: "nowrap",
            }}>
              🎁 XP+{myReward.archerXP}・🪙{myReward.coins}・📦{myReward.chests}・🪙箱{myReward.coinChests}
            </div>

            {/* 同場玩家：誰在射、打了多少（只給傷害） */}
            {board.slice(0, 8).map(p => (
              <div key={p.memberId} style={{
                flexShrink: 0, padding: "3px 9px", borderRadius: 999,
                border: `1px solid ${p.memberId === myId ? "#fbbf24" : "rgba(148,163,184,.28)"}`,
                background: p.memberId === myId ? "rgba(251,191,36,.14)" : "rgba(15,23,42,.8)",
                fontSize: 10.5, fontWeight: 900,
                color: p.memberId === myId ? "#fde68a" : "#cbd5e1",
                whiteSpace: "nowrap",
              }}>
                {p.active && <span style={{ color: "#4ade80", fontSize: 8 }}>● </span>}
                {p.name}
                <span style={{ color: "#f87171", marginLeft: 5 }}>{p.damage.toLocaleString()}</span>
              </div>
            ))}
          </div>
        }
      />

      {/* 🎯 每一支箭的即時特效。高分爽、低分只給一句加油——
          那支箭已經射出去了，講它不好只會讓下一支更緊。 */}
      {arrowFx && (
        <div key={arrowFx.key} className={`match-hit ${arrowFx.fx === "nova" ? "match-nova" : ""}`}
          style={{ color: arrowFx.color }}>
          {arrowFx.fx && <span className="match-ring" />}
          {arrowFx.fx === "spark" && Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <span key={i} className="match-spark" style={{
                "--sx": `${Math.cos(a) * 70}px`, "--sy": `${Math.sin(a) * 70}px`,
                animationDelay: `${i * 20}ms`,
              }} />
            );
          })}
          {arrowFx.big && (
            <span className="match-hit-label">{arrowFx.icon} {arrowFx.label}</span>
          )}
          <span className="match-hit-line">{arrowFx.big ? "" : `${arrowFx.icon} `}{arrowFx.line}</span>
        </div>
      )}

      {/* 🏆 演出跑完才跳的激勵詞。⚠️ 場內只給傷害，不給正確分數。 */}
      {cheer && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 76, zIndex: 120,
          display: "flex", justifyContent: "center", padding: "0 14px",
        }}>
          <div style={{
            background: "rgba(2,6,23,.95)", border: `1px solid ${cheer.color}`,
            borderRadius: 14, padding: "11px 18px", maxWidth: 400, textAlign: "center",
            boxShadow: `0 0 26px ${cheer.color}55`,
            animation: "raid-cut-title .5s cubic-bezier(.2,1.1,.3,1) both",
          }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: cheer.color, lineHeight: 1.4 }}>
              {cheer.icon} {cheer.line}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: "#f87171", marginTop: 4 }}>
              這一輪造成 {cheer.damage.toLocaleString()} 傷害
            </div>
            {cheer.milestone && (
              <div style={{ fontSize: 11, color: "#fde68a", fontWeight: 800, marginTop: 3 }}>
                {cheer.milestone}
              </div>
            )}
            <div style={{ fontSize: 11, color: "#bbf7d0", fontWeight: 800, marginTop: 3 }}>
              🎁 累積 射手XP {myReward.archerXP}・金幣 {myReward.coins}
              ・材料箱 {myReward.chests}・金幣箱 {myReward.coinChests}
            </div>
            <button type="button" onClick={() => setCheer(null)} style={{
              marginTop: 8, padding: "6px 20px", borderRadius: 8, border: "none",
              background: "rgba(148,163,184,.22)", color: "#cbd5e1",
              fontSize: 11.5, fontWeight: 900, cursor: "pointer",
            }}>繼續</button>
          </div>
        </div>
      )}

      {/* 送出失敗——整場比賽最不能沉默的地方 */}
      {error && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 130,
          padding: "9px 12px", display: "flex", alignItems: "center", gap: 8,
          background: "rgba(127,29,29,.97)", color: "#fff", fontSize: 12, fontWeight: 900,
        }}>
          <span style={{ flex: 1 }}>⚠️ {error}</span>
          <button type="button" onClick={retrySend} disabled={busy} style={{
            padding: "6px 13px", borderRadius: 8, border: "none",
            background: "#fff", color: "#7f1d1d", fontWeight: 900, fontSize: 11.5, cursor: "pointer",
          }}>{busy ? "送出中…" : "重送"}</button>
        </div>
      )}

      {/* 排行榜入口在狀態列那顆「第 N 名」上——這裡不要再放一顆重複的 */}

      {showBoard && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200, background: "rgba(2,6,23,.93)",
          overflowY: "auto", padding: "16px 12px",
        }} onClick={() => setShowBoard(false)}>
          <div style={{ maxWidth: 440, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: 15, fontWeight: 900, color: "#fde68a",
              textAlign: "center", marginBottom: 4,
            }}>🏆 全場即時戰況</div>
            <div style={{ fontSize: 10.5, color: "#64748b", textAlign: "center", marginBottom: 10 }}>
              場上顯示傷害——正式成績由記分台公布
            </div>
            <MatchLeaderboard board={board} myId={myId} show="damage" />
            <button type="button" onClick={() => setShowBoard(false)} style={{
              width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 11, border: "none",
              background: "linear-gradient(135deg,#f59e0b,#b45309)", color: "#fff",
              fontWeight: 900, fontSize: 14, cursor: "pointer",
            }}>回到戰鬥</button>
          </div>
        </div>
      )}

      {/* 📊 落點統計：場內也看得到（但這是點開才抓的，不影響即時效能） */}
      {stats && (
        <MatchStats board={board} shotsByMember={stats} myId={myId} onClose={() => setStats(null)} />
      )}

      {/* ⚠️ 離場要二次確認——按錯就中斷比賽了 */}
      {confirmLeave && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300, display: "grid", placeItems: "center",
          background: "rgba(2,6,23,.9)", padding: 20,
        }}>
          <div style={{
            maxWidth: 320, width: "100%", background: "#0f172a", borderRadius: 16,
            padding: 18, border: "1px solid rgba(148,163,184,.25)", textAlign: "center",
          }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fde68a", marginBottom: 6 }}>
              要離場嗎？
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", lineHeight: 1.7, marginBottom: 14 }}>
              目前累積 <b style={{ color: "#f87171" }}>
                {(mine?.damage ?? 0).toLocaleString()} 傷害
              </b>，成績會留在榜上。
              <br />離場後還是可以再上場繼續射。
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setConfirmLeave(false)} style={{
                flex: 1, padding: "12px 0", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg,#2563eb,#1e40af)", color: "#fff",
                fontWeight: 900, fontSize: 13, cursor: "pointer",
              }}>繼續討伐</button>
              <button type="button" onClick={doLeave} style={{
                padding: "12px 16px", borderRadius: 10, border: "1px solid #f87171",
                background: "transparent", color: "#f87171",
                fontWeight: 900, fontSize: 13, cursor: "pointer",
              }}>確定離場</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
