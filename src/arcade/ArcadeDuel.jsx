// src/arcade/ArcadeDuel.jsx — 射手競技場（最多 8 人）
// Local First：逐箭、戰績、斷線恢復留在自己的瀏覽器；Firestore 只交換房間、每回合摘要與結果。
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import ArcadeArrowInput from "./ArcadeArrowInput";
import { arcadeCatById } from "./arcadeData";
import { clearCurrentDuelRoom, saveCurrentDuelRoom } from "./arcadeDb";
import { sfxSuccess } from "../lib/sound";
import {
  DUEL_MODES, requiredDuelSubmitterIds, summarizeDuelArrows, updateLocalDuelStats,
  validDuelPlayerCount,
} from "./arcadeDuelLogic";
import {
  DUEL_ROUND_TIMEOUT_MS, cleanupDuelSubmissions, createDuelRoom,
  joinDuelRoom, leaveDuelRoom, resolveDuelRoomRound, setDuelRoomConfig, startDuelRoom,
  submitDuelRound, subscribeDuelRoom, subscribeDuelSubmissions, takeOverDuelHost,
} from "./arcadeDuelDb";

function duelUrl(code) {
  const host = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? window.location.origin
    : "https://student.catgroup.com.tw";
  return `${host}/?arcade&duel=${code}`;
}

function blankArrows(n) { return Array(Number(n) === 6 ? 6 : 3).fill(-1); }
function playerName(room, id) { return room?.players?.[id]?.nickname || "射手"; }
function modeMeta(id) { return DUEL_MODES[id] || DUEL_MODES.duel; }

const box = { border: "1px solid #e2cd9d", background: "#fffaf0", borderRadius: 16, padding: 12 };
const smallBtn = { border: "1px solid #d8bd8a", background: "#fffaf0", color: "#6b5230", borderRadius: 12, padding: "9px 11px", fontWeight: 900, cursor: "pointer" };

export default function ArcadeDuel({
  profile,
  initialCode = null,
  initialRound = 0,
  initialArrows = null,
  initialTargetId = null,
  initialLocalMatch = null,
  initialSubmittedRound = 0,
  initialSeenResolutionRound = 0,
  initialResultSaved = false,
  onSaveLocal,
  onExit,
}) {
  const cat = arcadeCatById(profile.selectedCat) || arcadeCatById("haji");
  const [entry, setEntry] = useState(initialCode ? "joining" : "choose");
  const [joinCode, setJoinCode] = useState(initialCode || "");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [arrows, setArrows] = useState(() => initialArrows || blankArrows(3));
  const [targetId, setTargetId] = useState(initialTargetId || "");
  const [submittedRound, setSubmittedRound] = useState(Number(initialSubmittedRound) || 0);
  const [submissions, setSubmissions] = useState([]); // 房主才會有值
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [roundFx, setRoundFx] = useState(null);
  const [localMatch, setLocalMatch] = useState(initialLocalMatch || { damage: 0, xCount: 0, bestScore: 0 });
  const localMatchRef = useRef(initialLocalMatch || { damage: 0, xCount: 0, bestScore: 0 });
  const [resultSaved, setResultSaved] = useState(!!initialResultSaved);
  const resolveLockRef = useRef(0);
  const seenResolutionRef = useRef(Number(initialSeenResolutionRound) || 0);
  const restoredRef = useRef(false);
  const resultSaveRef = useRef(!!initialResultSaved);
  const cleanupRef = useRef(false);

  const meId = profile.visitorId;
  const isHost = room?.hostId === meId;
  const players = useMemo(() => Object.values(room?.players || {}).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)), [room?.players]);
  const submissionRosterKey = useMemo(() => JSON.stringify(Object.keys(room?.players || {}).sort()), [room?.players]);
  const combat = room?.combat || {};
  const meCombat = combat[meId] || null;
  const isSpirit = meCombat?.state === "spirit";
  const requiredIds = useMemo(() => requiredDuelSubmitterIds(combat), [combat]);
  const submittedIds = useMemo(() => new Set(submissions.filter((s) => Number(s.round) === Number(room?.round)).map((s) => s.visitorId)), [submissions, room?.round]);
  const requiredDone = requiredIds.filter((id) => submittedIds.has(id)).length;
  const timedOut = room?.status === "fighting" && clock - Number(room?.roundStartedAt || clock) >= DUEL_ROUND_TIMEOUT_MS;
  const hostLeaseExpired = room && room.hostId !== meId && Number(room.hostLeaseUntil || 0) <= clock;

  const selectableTargets = useMemo(() => {
    if (!room || !meCombat) return [];
    return players.filter((p) => {
      if (p.visitorId === meId) return false;
      const c = combat[p.visitorId];
      if (!c || c.state !== "alive" || c.forfeited || c.hp <= 0) return false;
      if (isSpirit) return room.mode === "team" && c.team === meCombat.team;
      return room.mode !== "team" || c.team !== meCombat.team;
    });
  }, [room, players, combat, meCombat, isSpirit, meId]);

  // 直接 QR 進場：有 code 就自動加入；一般從 Hub 進來先選「建立／加入」。
  useEffect(() => {
    if (!initialCode || !/^\d{5}$/.test(initialCode)) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const r = await joinDuelRoom(initialCode, { ...profile, cat });
      if (cancelled) return;
      setBusy(false);
      if (r.ok) { setRoomCode(initialCode); setEntry("room"); }
      else { await clearCurrentDuelRoom(); setError(r.reason || "加入失敗"); setEntry("join"); }
    })();
    return () => { cancelled = true; };
    // Direct-link join runs once. Profile/cat are immutable for this Arcade mount.
  }, []);

  useEffect(() => {
    if (!roomCode) return undefined;
    return subscribeDuelRoom(roomCode, (r) => {
      if (!r) {
        clearCurrentDuelRoom();
        setRoom(null);
        setError("競技場已結束或不存在");
        setEntry("choose");
        setRoomCode("");
        return;
      }
      setRoom(r);
    });
  }, [roomCode]);

  // 只有目前房主會讀 submissions；非房主完全沒有這個 listener。
  // roster 不變時整場只掛一次 exact-doc listeners，跨回合不重掛、不重付 initial reads。
  useEffect(() => {
    setSubmissions([]);
    if (!roomCode || room?.status !== "fighting" || !isHost) return undefined;
    const visitorIds = JSON.parse(submissionRosterKey || "[]");
    if (!visitorIds.length) return undefined;
    return subscribeDuelSubmissions(roomCode, room?.sessionKey, visitorIds, setSubmissions);
  }, [roomCode, room?.status, room?.sessionKey, isHost, submissionRosterKey]);

  // 純本機計時，只負責顯示超時／接管，不產生任何 Firestore heartbeat。
  useEffect(() => {
    if (!room || !["waiting", "fighting"].includes(room.status)) return undefined;
    const t = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(t);
  }, [room?.status]);

  // 新回合：清輸入；重連時只恢復一次「同一回合」的本機箭數與目標。
  useEffect(() => {
    if (!room || room.status !== "fighting") return;
    const count = room.arrowsPerRound === 6 ? 6 : 3;
    if (!restoredRef.current && Number(initialRound) === Number(room.round) && Array.isArray(initialArrows) && initialArrows.length === count) {
      restoredRef.current = true;
      setArrows(initialArrows);
      setTargetId(initialTargetId || "");
      return;
    }
    restoredRef.current = true;
    setArrows(blankArrows(count));
    setTargetId("");
    setSubmittedRound(0);
    resolveLockRef.current = 0;
  }, [room?.round, room?.status, room?.arrowsPerRound, initialRound, initialArrows, initialTargetId]);

  // 1v1 或只剩一個合法目標時自動選，省一步。
  useEffect(() => {
    if (room?.status !== "fighting" || isSpirit || targetId || selectableTargets.length !== 1) return;
    setTargetId(selectableTargets[0].visitorId);
  }, [room?.status, room?.round, isSpirit, targetId, selectableTargets]);

  // 所有輸入中的資料都留 IndexedDB；reload 回來可接著填，不增加雲端寫入。
  useEffect(() => {
    if (!roomCode) return undefined;
    const t = setTimeout(() => {
      saveCurrentDuelRoom({
        roomCode,
        round: room?.round || 0,
        arrows,
        targetId,
        localMatch,
        submittedRound,
        seenResolutionRound: seenResolutionRef.current,
        resultSaved,
        savedAt: Date.now(),
      });
    }, 350);
    return () => clearTimeout(t);
  }, [roomCode, room?.round, arrows, targetId, localMatch, submittedRound, resultSaved]);

  // 房主收齊即結算；動畫只在各手機本機播，不 gate 共享 room 狀態。
  useEffect(() => {
    if (!isHost || room?.status !== "fighting" || !requiredIds.length) return;
    if (requiredDone < requiredIds.length || resolveLockRef.current === room.round) return;
    resolveLockRef.current = room.round;
    (async () => {
      const r = await resolveDuelRoomRound(roomCode, meId, submissions);
      if (!r.ok) {
        resolveLockRef.current = 0;
        if (r.reason && !/還有人沒送出/.test(r.reason)) setError(r.reason);
      }
    })();
  }, [isHost, room?.status, room?.round, requiredDone, requiredIds.length, roomCode, meId, submissions]);

  // 新 resolution 到達：只增加「我的」本機統計並播簡短結果；刷新不重複計。
  useEffect(() => {
    const res = room?.lastResolution;
    if (!res?.round || res.round <= seenResolutionRef.current) return;
    seenResolutionRef.current = res.round;
    const myDmg = Number(res.damageByPlayer?.[meId] || 0);
    if (myDmg > 0) {
      const next = { ...localMatchRef.current, damage: (localMatchRef.current.damage || 0) + myDmg };
      localMatchRef.current = next;
      setLocalMatch(next);
    }
    setRoundFx(res);
    const t = setTimeout(() => setRoundFx(null), 1800);
    return () => clearTimeout(t);
  }, [room?.lastResolution, meId]);

  // 結束：只寫本機 profile；duelStats 永久留在此瀏覽器，不寫入 Firestore。
  useEffect(() => {
    if (room?.status !== "result" || !room.result || resultSaveRef.current) return;
    resultSaveRef.current = true;
    setResultSaved(true);
    const won = room.mode === "team"
      ? !!room.result.winnerTeam && room.result.winnerTeam === combat[meId]?.team
      : !!room.result.winnerId && room.result.winnerId === meId;
    const duelStats = updateLocalDuelStats(profile.duelStats || {}, { won, ...localMatchRef.current });
    onSaveLocal?.({ ...profile, duelStats, lastPlayedAt: Date.now() });
  }, [room?.status, room?.result, room?.mode, combat, meId, localMatch, onSaveLocal, profile]);

  // 結果一出，房主才清掉最多 8 顆 submission；保留 parent result 讓其他手機慢慢看。
  useEffect(() => {
    if (!isHost || room?.status !== "result" || cleanupRef.current) return;
    cleanupRef.current = true;
    cleanupDuelSubmissions(roomCode, room?.sessionKey, Object.keys(room?.players || {}));
  }, [isHost, room?.status, room?.sessionKey, room?.players, roomCode]);

  async function createRoom() {
    setBusy(true); setError("");
    const r = await createDuelRoom({ ...profile, cat });
    setBusy(false);
    if (!r.ok) { setError(r.reason); return; }
    setRoomCode(r.roomCode); setEntry("room");
  }

  async function joinRoom() {
    if (!/^\d{5}$/.test(joinCode)) { setError("請輸入 5 位數房號"); return; }
    setBusy(true); setError("");
    const r = await joinDuelRoom(joinCode, { ...profile, cat });
    setBusy(false);
    if (!r.ok) { setError(r.reason); return; }
    setRoomCode(joinCode); setEntry("room");
  }

  async function changeConfig(patch) {
    if (!room || !isHost || busy) return;
    setBusy(true);
    const r = await setDuelRoomConfig(roomCode, meId, {
      mode: patch.mode || room.mode,
      arrowsPerRound: patch.arrowsPerRound || room.arrowsPerRound,
    });
    setBusy(false);
    if (!r.ok) setError(r.reason);
  }

  async function startBattle() {
    setBusy(true); setError("");
    const r = await startDuelRoom(roomCode, meId);
    setBusy(false);
    if (!r.ok) setError(r.reason);
  }

  async function submitRound() {
    if (!room || busy || submittedRound === room.round) return;
    const needsTarget = !isSpirit || room.mode === "team";
    if (arrows.some((v) => v < 0)) { setError(`請先完成 ${room.arrowsPerRound} 箭`); return; }
    if (needsTarget && !targetId) { setError(isSpirit ? "請選擇要支援的隊友" : "請選擇攻擊目標"); return; }
    setBusy(true); setError("");
    const r = await submitDuelRound(roomCode, meId, {
      sessionKey: room.sessionKey,
      round: room.round,
      targetId: isSpirit && room.mode !== "team" ? null : targetId,
      arrows,
      arrowsPerRound: room.arrowsPerRound,
    });
    setBusy(false);
    if (!r.ok) { setError(r.reason); return; }
    sfxSuccess();
    setSubmittedRound(room.round);
    const nextLocal = {
      ...localMatchRef.current,
      xCount: (localMatchRef.current.xCount || 0) + (r.summary?.xCount || 0),
      bestScore: Math.max(localMatchRef.current.bestScore || 0, r.summary?.totalScore || 0),
    };
    localMatchRef.current = nextLocal;
    setLocalMatch(nextLocal);
  }

  async function forceResolve() {
    if (!isHost || !timedOut || busy) return;
    setBusy(true); setError(""); resolveLockRef.current = room.round;
    const r = await resolveDuelRoomRound(roomCode, meId, submissions, { force: true });
    setBusy(false);
    if (!r.ok) { resolveLockRef.current = 0; setError(r.reason); }
  }

  async function takeOver() {
    if (!hostLeaseExpired || busy) return;
    setBusy(true); setError("");
    const r = await takeOverDuelHost(roomCode, meId);
    setBusy(false);
    if (!r.ok) setError(r.reason);
  }

  async function exitArena() {
    if (roomCode && room?.status !== "result") await leaveDuelRoom(roomCode, meId);
    await clearCurrentDuelRoom();
    onExit?.();
  }

  if (entry !== "room" || !roomCode) {
    return (
      <Shell onBack={onExit} title="射手競技場">
        <div className="arcade-card arcade-hub-hero">
          <div className="arcade-hub-kicker">LOCAL FIRST PVP</div>
          <h1 className="arcade-hub-title">⚔️ 最多 8 人，用真正的箭決鬥</h1>
          <p className="arcade-hub-copy">手機只負責記分與戰鬥演出。角色、戰績和逐箭資料留在各自手機。</p>
        </div>
        {error && <ErrorBox text={error} />}
        {entry === "choose" && (
          <div className="arcade-card" style={{ marginTop: 14 }}>
            <button className="arcade-primary" type="button" onClick={createRoom} disabled={busy}>{busy ? "建立中…" : "⚔️ 建立競技場"}</button>
            <button className="arcade-primary blue" style={{ marginTop: 10 }} type="button" onClick={() => setEntry("join")}>🔢 輸入 5 位房號</button>
          </div>
        )}
        {(entry === "join" || entry === "joining") && (
          <div className="arcade-card" style={{ marginTop: 14 }}>
            <div className="arcade-label">競技場房號</div>
            <input className="arcade-input" name="arcade-duel-room-code" aria-label="競技場房間代碼" inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="例如：58270…" maxLength={5} value={joinCode} onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 5))} />
            <button className="arcade-primary" style={{ marginTop: 12 }} type="button" onClick={joinRoom} disabled={busy}>{busy ? "加入中…" : "加入競技場"}</button>
            <button style={{ ...smallBtn, width: "100%", marginTop: 9 }} type="button" onClick={() => setEntry("choose")}>返回</button>
          </div>
        )}
      </Shell>
    );
  }

  if (!room) {
    return <Shell onBack={exitArena} title="射手競技場"><div className="arcade-card">正在連接競技場…</div>{error && <ErrorBox text={error} />}</Shell>;
  }

  if (room.status === "waiting") {
    const canStart = validDuelPlayerCount(room.mode, players.length);
    return (
      <Shell onBack={exitArena} title="射手競技場">
        <div className="arcade-card" style={{ textAlign: "center" }}>
          <div className="arcade-kicker">ARENA ROOM</div>
          <div className="arcade-team-code">{roomCode}</div>
          <div style={{ display: "inline-block", background: "#fff", padding: 8, borderRadius: 14, marginTop: 8 }}>
            <QRCodeSVG value={duelUrl(roomCode)} size={150} level="M" />
          </div>
          <div className="arcade-note">朋友掃 QR：<strong>?arcade&amp;duel={roomCode}</strong></div>
        </div>
        {error && <ErrorBox text={error} />}
        <div className="arcade-card" style={{ marginTop: 12 }}>
          <div className="arcade-section-title" style={{ marginTop: 0 }}>模式</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
            {Object.values(DUEL_MODES).map((m) => (
              <button key={m.id} type="button" disabled={!isHost || busy} onClick={() => changeConfig({ mode: m.id })}
                style={{ ...smallBtn, background: room.mode === m.id ? "#2c4533" : "#fffaf0", color: room.mode === m.id ? "#fff" : "#6b5230", padding: "11px 4px" }}>
                <div style={{ fontSize: 20 }}>{m.icon}</div><div style={{ fontSize: 11 }}>{m.name}</div>
              </button>
            ))}
          </div>
          <div className="arcade-section-title">每回合箭數</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[3, 6].map((n) => <button key={n} type="button" disabled={!isHost || busy} onClick={() => changeConfig({ arrowsPerRound: n })}
              style={{ ...smallBtn, background: room.arrowsPerRound === n ? "#b23b2e" : "#fffaf0", color: room.arrowsPerRound === n ? "#fff" : "#6b5230" }}>{n} 箭</button>)}
          </div>
        </div>
        <Roster room={room} players={players} meId={meId} />
        <div className="arcade-note blue">☁️ 雲端只同步房間與回合摘要。逐箭、長期 PvP 戰績都留在玩家自己的瀏覽器。</div>
        {isHost ? (
          <button className="arcade-primary" style={{ marginTop: 12 }} type="button" disabled={!canStart || busy} onClick={startBattle}>
            {canStart ? (busy ? "準備中…" : `🏹 開始 ${modeMeta(room.mode).name}`) : `目前 ${players.length} 人，尚不符合模式人數`}
          </button>
        ) : <div className="arcade-note">等待房主開始。房主選擇：{modeMeta(room.mode).name}・{room.arrowsPerRound} 箭</div>}
        {hostLeaseExpired && <button className="arcade-primary blue" style={{ marginTop: 10 }} type="button" onClick={takeOver} disabled={busy}>👑 房主已離開，接管競技場</button>}
      </Shell>
    );
  }

  if (room.status === "result") {
    const myTeam = combat[meId]?.team;
    const won = room.mode === "team" ? room.result?.winnerTeam === myTeam : room.result?.winnerId === meId;
    const winnerText = room.mode === "team"
      ? (room.result?.winnerTeam ? `${room.result.winnerTeam} 隊` : "平手")
      : (room.result?.winnerId ? playerName(room, room.result.winnerId) : "平手");
    const career = resultSaved
      ? (profile.duelStats || {})
      : updateLocalDuelStats(profile.duelStats || {}, { won, ...localMatch });
    return (
      <Shell onBack={exitArena} title="競技場結算">
        <div className="arcade-card" style={{ textAlign: "center", background: won ? "#eef7ee" : "#fffaf0" }}>
          <div style={{ fontSize: 58 }}>{won ? "🏆" : "⚔️"}</div>
          <h1 style={{ margin: "8px 0 2px", color: "#2c4533" }}>{winnerText} 勝出</h1>
          <div style={{ color: "#8a6a3b", fontWeight: 800 }}>共 {room.result?.rounds || room.round} 回合</div>
        </div>
        <div className="arcade-stats">
          <div className="arcade-stat"><div className="arcade-stat-v">{localMatch.damage || 0}</div><div className="arcade-stat-l">本場傷害</div></div>
          <div className="arcade-stat"><div className="arcade-stat-v">{localMatch.xCount || 0}</div><div className="arcade-stat-l">本場 X</div></div>
          <div className="arcade-stat"><div className="arcade-stat-v">{localMatch.bestScore || 0}</div><div className="arcade-stat-l">最佳回合</div></div>
        </div>
        <div className="arcade-note blue">💾 生涯：{career.matches || 0} 場・{career.wins || 0} 勝。這份資料只存在你的瀏覽器。</div>
        <button className="arcade-primary green" style={{ marginTop: 12 }} type="button" onClick={exitArena}>回冒險大廳</button>
      </Shell>
    );
  }

  // fighting
  const allFilled = arrows.length === Number(room.arrowsPerRound) && arrows.every((v) => v >= 0);
  const needsTarget = !isSpirit || room.mode === "team";
  const canSubmit = allFilled && (!needsTarget || !!targetId) && submittedRound !== room.round;
  const sum = summarizeDuelArrows(arrows.map((v) => v < 0 ? 0 : v), room.arrowsPerRound);

  return (
    <Shell onBack={exitArena} title={`${modeMeta(room.mode).icon} ${modeMeta(room.mode).name}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 1000, color: "#2c4533" }}>第 {room.round} 回合・{room.arrowsPerRound} 箭</div>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#8a6a3b" }}>房號 {roomCode}</div>
      </div>
      {error && <ErrorBox text={error} />}
      <CombatGrid room={room} players={players} meId={meId} />

      <div className="arcade-card" style={{ marginTop: 12 }}>
        {isSpirit ? (
          <div className="arcade-note blue" style={{ marginTop: 0 }}>
            👻 <strong>你已轉為支援靈魂，仍然要射箭。</strong>{room.mode === "team" ? "選一位同隊存活射手補血。" : "系統會自動支援目前 HP 最低的存活射手。"}
          </div>
        ) : (
          <div className="arcade-note" style={{ marginTop: 0 }}>🎯 10 分造成 <strong>15</strong> 傷害；X 造成 <strong>20</strong> 傷害。同一人被多人鎖定時會自動得到圍攻保護。</div>
        )}

        {(!isSpirit || room.mode === "team") && (
          <>
            <div className="arcade-section-title">{isSpirit ? "選擇支援隊友" : "選擇攻擊目標"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))", gap: 7 }}>
              {selectableTargets.map((p) => {
                const c = combat[p.visitorId];
                return <button key={p.visitorId} type="button" disabled={submittedRound === room.round} onClick={() => setTargetId(p.visitorId)}
                  style={{ ...smallBtn, background: targetId === p.visitorId ? (isSpirit ? "#2c4533" : "#b23b2e") : "#fffaf0", color: targetId === p.visitorId ? "#fff" : "#6b5230" }}>
                  {p.nickname}<div style={{ fontSize: 10, opacity: .8 }}>HP {c?.hp || 0}/{c?.maxHp || 0}{c?.team ? `・${c.team}隊` : ""}</div>
                </button>;
              })}
            </div>
          </>
        )}

        <div className={room.arrowsPerRound === 3 ? "arcade-duel-3" : ""}>
          <ArcadeArrowInput count={room.arrowsPerRound} values={arrows} onChange={(i, v) => {
            if (submittedRound === room.round) return;
            setArrows((old) => old.map((x, idx) => idx === i ? v : x));
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 900, color: "#8a6a3b", marginTop: 8 }}>
          <span>本回合 {sum.totalScore} 分</span><span>10×{sum.tens}・X×{sum.xCount}</span>
        </div>
        <button className="arcade-primary" style={{ marginTop: 10 }} type="button" disabled={!canSubmit || busy} onClick={submitRound}>
          {submittedRound === room.round ? "✅ 已送出，等待回合結算" : busy ? "送出中…" : isSpirit ? "👻 送出支援射擊" : "🏹 送出攻擊"}
        </button>
      </div>

      {isHost && (
        <div className="arcade-note blue">
          👑 房主協調器：已收 {requiredDone}/{requiredIds.length} 份摘要。只有這支手機會讀 submissions。
          {timedOut && requiredDone < requiredIds.length && <button type="button" style={{ ...smallBtn, display: "block", width: "100%", marginTop: 8 }} onClick={forceResolve} disabled={busy}>⏭️ 跳過未提交者並結算</button>}
        </div>
      )}
      {hostLeaseExpired && <button className="arcade-primary blue" style={{ marginTop: 10 }} type="button" onClick={takeOver} disabled={busy}>👑 房主失聯，接管本場</button>}

      {roundFx && <RoundOverlay room={room} resolution={roundFx} meId={meId} />}
    </Shell>
  );
}

function Shell({ children, onBack, title }) {
  return <div className="arcade-stage"><div className="arcade-wrap">
    <div className="arcade-topbar">
      <button type="button" style={smallBtn} onClick={onBack} aria-label="返回冒險大廳">←</button>
      <div className="arcade-logo"><div className="arcade-logo-badge">⚔️</div><div><div className="arcade-logo-title">{title}</div><div className="arcade-logo-sub">射箭是控制器・手機只做戰鬥層</div></div></div>
    </div>{children}
  </div></div>;
}

function ErrorBox({ text }) { return <div className="arcade-note" style={{ borderColor: "#efc3b8", background: "#fbe9e5", color: "#a33a2d" }}>⚠️ {text}</div>; }

function Roster({ room, players, meId }) {
  return <div className="arcade-card" style={{ marginTop: 12 }}>
    <div style={{ fontWeight: 1000, color: "#2c4533" }}>射手 {players.length}/8</div>
    <div className={`arcade-team-players ${players.length >= 6 ? "crowd" : ""}`}>
      {players.map((p) => <div className="arcade-team-player" key={p.visitorId}>
        <img src={p.catImage || "/cats/haji.webp"} alt="" width="44" height="44" />
        <div style={{ minWidth: 0 }}><div className="arcade-team-player-name">{p.nickname}{p.visitorId === meId ? "（你）" : ""}</div><div className="arcade-team-player-sub">{room.hostId === p.visitorId ? "👑 房主" : "射手"}</div></div>
      </div>)}
    </div>
  </div>;
}

function CombatGrid({ room, players, meId }) {
  return <div style={{ display: "grid", gridTemplateColumns: players.length >= 5 ? "repeat(2,1fr)" : "1fr", gap: 7 }}>
    {players.map((p) => {
      const c = room.combat?.[p.visitorId];
      if (!c) return null;
      const pct = c.maxHp ? Math.max(0, Math.min(100, c.hp / c.maxHp * 100)) : 0;
      return <div key={p.visitorId} style={{ ...box, padding: 9, opacity: c.forfeited ? .45 : 1, borderColor: p.visitorId === meId ? "#3a5a40" : "#e2cd9d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <img src={p.catImage || "/cats/haji.webp"} alt="" width="30" height="30" style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 9 }} />
          <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 12, fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nickname}{p.visitorId === meId ? "（你）" : ""}</div><div style={{ fontSize: 9, color: "#8a6a3b", fontWeight: 900 }}>{c.team ? `${c.team} 隊・` : ""}{c.state === "spirit" ? "👻 支援" : "🏹 戰鬥中"}</div></div>
        </div>
        <div className="arcade-hpbar" style={{ height: 7, marginTop: 6 }}><div className="arcade-hpbar-fill hp-player" style={{ width: `${pct}%` }} /></div>
        <div style={{ fontSize: 9, color: "#8a6a3b", fontWeight: 900, marginTop: 3 }}>{c.state === "spirit" ? "HP 0・仍可支援射擊" : `HP ${c.hp}/${c.maxHp}`}</div>
      </div>;
    })}
  </div>;
}

function RoundOverlay({ room, resolution, meId }) {
  const attacks = resolution.attacks || [];
  const supports = resolution.supports || [];
  return <div style={{ position: "fixed", inset: 0, zIndex: 160, background: "rgba(15,12,18,.86)", display: "grid", placeItems: "center", padding: 18, pointerEvents: "none" }}>
    <div style={{ width: "min(430px,100%)", background: "#fffaf0", borderRadius: 22, padding: 18, boxShadow: "0 20px 60px rgba(0,0,0,.45)" }}>
      <div style={{ textAlign: "center", fontSize: 13, fontWeight: 1000, color: "#8a6a3b" }}>第 {resolution.round} 回合結算</div>
      {attacks.slice(0, 8).map((a, i) => <div key={`a${i}`} style={{ marginTop: 7, fontWeight: 900, fontSize: 12, color: a.fromId === meId ? "#b23b2e" : "#3b2f1e" }}>
        🏹 {playerName(room, a.fromId)} → {playerName(room, a.targetId)}　<strong>-{a.damage}</strong>{a.locks > 1 ? ` 🛡️圍攻×${a.multiplier}` : ""}
      </div>)}
      {supports.slice(0, 8).map((a, i) => <div key={`s${i}`} style={{ marginTop: 7, fontWeight: 900, fontSize: 12, color: "#2c4533" }}>👻 {playerName(room, a.fromId)} 支援 {playerName(room, a.targetId)}　+{a.heal}</div>)}
      {(resolution.knockouts || []).map((id) => <div key={id} style={{ marginTop: 8, textAlign: "center", fontWeight: 1000, color: "#7c3f2c" }}>💥 {playerName(room, id)} 倒下，轉為支援靈魂</div>)}
    </div>
  </div>;
}

