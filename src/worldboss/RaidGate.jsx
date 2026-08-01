// src/worldboss/RaidGate.jsx
// ─────────────────────────────────────────────────────────────
// 正式版的世界王討伐入口。把 `src/worldboss/` 那一整套（單人房／等待室／
// 討伐畫面）接到真的世界王活動文件上。
//
// ⚠️ 這裡是**唯一**碰 Firestore 的地方。domain/ 與 ui/ 都保持純粹——
//    沙盒（?raid）用同一批元件跑假資料，正式版換成這個容器餵真資料。
//    兩邊共用元件，才不會出現「沙盒好好的、上線壞掉」。
//
// ⚠️ 玩家強度的算法**必須跟 WorldBossAttack.jsx 一致**（archerBase + 卡片 + 等級加成），
//    不然同一個人在新舊介面會有兩種數值。
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { attackWorldBoss, distributeWorldBossRewards } from "../lib/worldBossDb";
import { WORLD_BOSSES } from "../lib/worldBossData";
import { WORLD_BOSS_SKILLS } from "../lib/worldBossSkillData";
import { calcArcherStats } from "../lib/monsterData";
import { calcEquippedBonus, resolveEquippedCards } from "../lib/monsterCards";
import { archerLevelBonus, archerLevelFromXP } from "../lib/archerLevel";
import { calcCatCombatStats } from "../lib/catCombat";
import { CATS, CAT_TYPE_MAP } from "../lib/catData";

import {
  createRaidRoom, disbandRaidRoom, findReconnectableRaidRoom, forceAdvanceRaidRoom,
  joinRaidRoom, kickRaidMember, leaveRaidRoom, resolveRaidRoomRound, setRaidLoadout,
  setRaidReady, startRaidRoom, submitRaidArrows, subscribeOpenRaidRooms, subscribeRaidRoom,
} from "../lib/raidTeamDb";
import { createRaidState } from "./domain/raidFlow";
import { roundResultFromLog, raidRoundResults } from "./domain/raidReport";
import { lobbyView, myOpenRoom, openRoomList, soloDepart } from "./domain/raidLobby";
import { hydrateRaidState, roomPhase } from "./domain/raidRoomState";
import { DEFAULT_RAID_FACE } from "./domain/raidFaces";
import { RAID_DEFAULT_DISTANCE } from "./domain/raidRange";
import { clearRaidProgress, loadRaidProgress, resumeLabel } from "./domain/raidResume";
import { raidBackground } from "./raidAssets";
import RaidScreen from "./ui/RaidScreen";
import RaidSoloRoom from "./ui/RaidSoloRoom";
import RaidWaitRoom from "./ui/RaidWaitRoom";

const LOADOUT_KEY = "wb_raid_loadout_v1";

/** 記住上次用的靶紙與射程——每次進來重選一次很煩，而且大部分人的場地是固定的 */
function loadLoadout() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOADOUT_KEY) || "null");
    if (raw?.targetFmt) return { targetFmt: raw.targetFmt, distanceM: Number(raw.distanceM) || RAID_DEFAULT_DISTANCE };
  } catch { /* 壞掉就用預設 */ }
  return { targetFmt: DEFAULT_RAID_FACE, distanceM: RAID_DEFAULT_DISTANCE };
}
function saveLoadout(targetFmt, distanceM) {
  try { localStorage.setItem(LOADOUT_KEY, JSON.stringify({ targetFmt, distanceM })); } catch { /* 無所謂 */ }
}

export default function RaidGate({ event, onBack, sharedData, onComplete }) {
  const { profile } = useAuth();
  const myId = profile?.id;
  const myName = profile?.name || "射手";

  const [screen, setScreen] = useState("solo");     // solo | wait | battle
  // ── 線上組隊 ───────────────────────────────────────────────
  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [openRooms, setOpenRooms] = useState([]);
  const [busy, setBusy] = useState(false);
  const [roomError, setRoomError] = useState("");
  // ⚠️ 送箭失敗是**最糟的失敗**：這台以為送出了，房間卻沒收到，
  //    整隊會一直等一個永遠不會來的人。所以失敗一定要看得見、而且能重送。
  const [sendFailed, setSendFailed] = useState(false);
  const lastArrowsRef = useRef(null);
  const [state, setState] = useState(null);
  const [runId, setRunId] = useState(0);
  const [resume, setResume] = useState(() => loadRaidProgress({ bossKey: event?.bossKey || null }));
  const [{ targetFmt, distanceM }, setLoadout] = useState(loadLoadout);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // ⚠️ 送出結果只**顯示**，不自動離開（作者 2026-07-31：來不及看結算畫面）。
  //    送完就 onComplete → 大廳 setInBattle(false) → 整個戰鬥畫面連同結算被卸載。
  //    要等玩家自己點掉。
  const [submitResult, setSubmitResult] = useState(null);

  // 每回合的傷害累積起來，結束時一次送出（逐箭寫入是那個 4000 次讀取的坑）
  const roundsRef = useRef([]);
  const submittedRef = useRef(false);
  // ⚠️ 擊倒 payload 要用 ref：state 每回合被整個換掉，掛在 state 上會被蓋掉
  const killPayloadRef = useRef(null);

  useEffect(() => { saveLoadout(targetFmt, distanceM); }, [targetFmt, distanceM]);

  // 一進來就看看有沒有斷線前的房間——重整不該讓整隊卡住
  useEffect(() => {
    if (!myId) return;
    findReconnectableRaidRoom(myId).then(r => { if (r?.room?.id) setRoomId(r.room.id); }).catch(() => {});
  }, [myId]);

  useEffect(() => {
    if (!roomId) { setRoom(null); return undefined; }
    return subscribeRaidRoom(roomId, setRoom);
  }, [roomId]);

  // ⚠️ 只在「還沒進房」時聽公開房列表。進房之後這個監聽就是純浪費——
  //    每有人開房／關房，房裡的每個人都要被推一次。
  useEffect(() => {
    if (roomId || screen !== "solo") { setOpenRooms([]); return undefined; }
    return subscribeOpenRaidRooms(setOpenRooms);
  }, [roomId, screen]);

  // 重整或斷線回來時，房間還在等人就回等待室（不用重新輸入代碼）
  useEffect(() => {
    if (room?.status === "waiting" && screen === "solo") setScreen("wait");
    if (room === null && screen === "wait") setScreen("solo");   // 房被解散
  }, [room, screen]);

  // ── 玩家強度：跟 WorldBossAttack 同一套公式 ──────────────
  const cardColl = sharedData?.cardData ?? null;
  const stats = useMemo(() => {
    const base = calcArcherStats({
      member: profile,
      certification: sharedData?.certification,
      certRecords: sharedData?.certRecords,
      dexStats: null,
    });
    const card = calcEquippedBonus(resolveEquippedCards(cardColl));
    const lv = archerLevelBonus(archerLevelFromXP(profile?.archerXP || 0));
    return {
      atk: (base.atk || 0) + (card.atk || 0) + (lv.atk || 0),
      def: (base.def || 0) + (card.def || 0) + (lv.def || 0),
      hp: (base.hp || 0) + (card.hp || 0) + (lv.hp || 0),
    };
  }, [profile, sharedData?.certification, sharedData?.certRecords, cardColl]);

  const archerLevel = archerLevelFromXP(profile?.archerXP || 0);

  const cats = useMemo(() => {
    const catId = profile?.equippedCat?.catId;
    if (!catId) return [];
    const st = calcCatCombatStats(
      { catId, catXP: profile?.equippedCat?.catXP || 0, bond: profile?.equippedCat?.bond || 0 },
      catId,
    );
    return [{ catId, name: CATS[catId]?.name || catId, atk: st.catATK, skillGroup: CAT_TYPE_MAP[catId] }];
  }, [profile?.equippedCat]);

  // ── 出擊資格 ──────────────────────────────────────────────
  const depart = useMemo(() => soloDepart({
    participant: event?.participants?.[myId] || {},
    bossAlive: event?.status === "active" && (Number(event?.bossCurrentHP) || 0) > 0,
  }), [event?.participants, event?.bossCurrentHP, event?.status, myId]);

  const bossDef = WORLD_BOSSES[event?.bossKey] || {};

  const startSolo = useCallback(() => {
    roundsRef.current = [];
    submittedRef.current = false;
    killPayloadRef.current = null;
    setError("");
    setSubmitResult(null);
    setState(createRaidState({
      boss: {
        key: event.bossKey,
        name: event.bossData?.name || bossDef.name || "世界王",
        // ⚠️ 血是**全伺服器共享**的：帶當下剩餘血，不是滿血
        hp: Number(event.bossCurrentHP) || 1,
        maxHp: Number(event.bossMaxHP) || Number(event.bossData?.hp) || 1,
        atk: Number(event.bossData?.atk) || bossDef.atk || 120,
        def: Number(event.bossData?.def) || bossDef.def || 50,
        skillConfig: WORLD_BOSS_SKILLS[event.bossKey] || null,
      },
      // ⚠️ equipped 要掛在**成員身上**（createRaidState 用 m.equipped 判世界王卡），
      //    放在最外層不會被讀到。
      members: [{
        memberId: myId, name: myName, stats, archerLevel, cats,
        targetFmt, distanceM, equipped: resolveEquippedCards(cardColl),
      }],
      stats, archerLevel, cats, targetFmt, distanceM,
    }));
    setRunId(n => n + 1);
    setScreen("battle");
  }, [event, bossDef, myId, myName, stats, archerLevel, cats, targetFmt, distanceM, cardColl]);

  // ── 每回合：只累積在本機，不寫 Firestore ─────────────────
  const handleState = useCallback((next, log) => {
    setState(next);
    roundsRef.current.push(roundResultFromLog(log, myId));
  }, [myId]);

  // ── 結束：一次送出 ────────────────────────────────────────
  const handleFinish = useCallback(async (final) => {
    if (submittedRef.current) return;      // 防重複：重整回來也不會再送一次
    submittedRef.current = true;
    clearRaidProgress();
    setSubmitting(true);

    const rounds = raidRoundResults(roundsRef.current, final, myId);
    const killed = (final?.bossHp ?? 1) <= 0;

    let res;
    try {
      res = await attackWorldBoss({
        eventId: event.id,
        memberId: myId,
        memberName: myName,
        weapon: profile?.bowType || "反曲弓",
        roundResults: rounds,
        accountType: profile?.accountType || "official",
        memberAtk: stats.atk, memberDef: stats.def, memberHP: stats.hp,
        killerStyle: profile?.equippedCat?.catId || "baobao",
        finishingArrow: final?.killPayload?.style?.name || null,
        // 擊倒才有：全服重播用的一包資料（寫進狀態小文件，零額外讀取）
        killPayload: killed ? final?.killPayload || null : null,
      });
    } catch (e) {
      res = { ok: false, reason: e?.message || "網路錯誤" };
    }

    setSubmitting(false);
    setSubmitResult(res);
    if (!res?.ok) { setError(res?.reason || "傷害沒有送出，請截圖回報"); return; }
    if (res.defeated) distributeWorldBossRewards(event.id).catch(() => {});
    // ⚠️ 這裡**不呼叫 onComplete**——那會讓大廳把戰鬥畫面收掉，玩家看不到結算。
  }, [event, myId, myName, profile, stats]);

  // ── 線上組隊：房間 → 畫面 ──────────────────────────────────
  // ⚠️ 最後一回合結算時，房間會**同一次寫入**把 status 改成 "done"。
  //    只認 "active" 的話，那一回合的 log 就永遠播不出來（王倒下的那一刻消失）。
  //    所以「還在房裡」要包含 done，只有「把大家推進戰鬥」才限定 active。
  const inRoom = !!room && (room.status === "active" || room.status === "done");
  const online = inRoom;
  const view = useMemo(
    () => (room ? lobbyView({ ...room, id: roomId }, myId, { participants: event?.participants || {} }) : null),
    [room, roomId, myId, event?.participants],
  );
  const phase = useMemo(() => (room ? roomPhase(room) : null), [room]);
  const isHost = room?.hostId === myId;

  // 房主推進：全員送出就結算。**只有房主算**——兩台各算各的，隨機數立刻漂掉。
  const resolvingSeq = useRef(-1);
  const [resolveRetry, setResolveRetry] = useState(0);
  useEffect(() => {
    if (room?.status !== "active" || !isHost || !phase?.canResolve) return undefined;
    const seq = Number(room.seq) || 0;
    if (resolvingSeq.current === seq) return undefined;     // 同一個 seq 只推一次
    resolvingSeq.current = seq;
    let timer = null;
    resolveRaidRoomRound(roomId, myId)
      .then(res => {
        if (res?.ok) return;
        // ⚠️ 推進失敗時房間文件不會變 → 這個 effect 不會自己再跑一次，
        //    整隊就永遠卡在「全員已送出」。所以要自己排一次重試。
        resolvingSeq.current = -1;
        timer = setTimeout(() => setResolveRetry(n => n + 1), 1500);
      })
      .catch(() => {
        resolvingSeq.current = -1;
        timer = setTimeout(() => setResolveRetry(n => n + 1), 1500);
      });
    return () => { if (timer) clearTimeout(timer); };
  }, [room?.status, isHost, phase?.canResolve, room?.seq, roomId, myId, resolveRetry]);

  // 房主寫回來的結果：seq 一變，所有人重播同一份 log
  const incomingRound = useMemo(() => {
    if (!online || !room?.state) return null;
    return { seq: Number(room.seq) || 0, state: hydrateRaidState(room.state), log: room.lastLog || null };
  }, [online, room?.seq, room?.state, room?.lastLog]);

  // 房間一轉 active 就進戰鬥（每個人都會被推進來，不用各自按）
  useEffect(() => {
    if (room?.status !== "active" || screen === "battle") return;
    const hydrated = hydrateRaidState(room.state);
    if (!hydrated) return;
    roundsRef.current = [];
    submittedRef.current = false;
    killPayloadRef.current = null;
    setState(hydrated);
    setRunId(n => n + 1);
    setScreen("battle");
  }, [room?.status, room?.state, screen]);

  /** 送出自己這回合的箭。失敗要讓玩家看得到、按得動重送。 */
  const sendArrows = useCallback(async (arrows) => {
    lastArrowsRef.current = arrows;
    setSendFailed(false);
    const res = await submitRaidArrows(roomId, myId, room?.round || 1, arrows)
      .catch(e => ({ ok: false, reason: e?.message }));
    if (!res?.ok) setSendFailed(true);
  }, [roomId, myId, room?.round]);

  const retrySend = useCallback(() => {
    if (lastArrowsRef.current) sendArrows(lastArrowsRef.current);
  }, [sendArrows]);

  // ── 房間動作 ──────────────────────────────────────────────
  const roomAction = useCallback(async (fn) => {
    setBusy(true); setRoomError("");
    const res = await fn().catch(e => ({ ok: false, reason: e?.message }));
    setBusy(false);
    if (!res?.ok) setRoomError(res?.reason || "操作失敗");
    return res;
  }, []);

  const handleCreateRoom = useCallback(async () => {
    const res = await roomAction(() => createRaidRoom({
      hostId: myId, hostName: myName, bossKey: event.bossKey, eventId: event.id,
      targetFmt, distanceM, stats, archerLevel, cats,
    }));
    if (res?.ok) { setRoomId(res.roomId); setScreen("wait"); }
  }, [roomAction, myId, myName, event, targetFmt, distanceM, stats, archerLevel, cats]);

  const handleJoinRoom = useCallback(async (target) => {
    if (!target?.code) return;
    const res = await roomAction(() => joinRaidRoom(target.code, myId, myName, {
      stats, archerLevel, cats, targetFmt, distanceM,
    }));
    if (res?.ok) { setRoomId(res.roomId || target.roomId); setScreen("wait"); }
  }, [roomAction, myId, myName, stats, archerLevel, cats, targetFmt, distanceM]);

  const handleStart = useCallback(() => roomAction(() => startRaidRoom(roomId, myId, {
    participants: event?.participants || {},
    // 王的血全服共享——帶當下剩餘，不然整隊會對著一隻滿血的幻覺打
    bossHp: Number(event?.bossCurrentHP) || null,
  })), [roomAction, roomId, myId, event?.participants, event?.bossCurrentHP]);

  const exitRoom = useCallback(async (fn) => {
    await roomAction(fn);
    setRoomId(null); setRoom(null); setScreen("solo");
  }, [roomAction]);

  /** 玩家自己點掉結算畫面才離開 */
  const leaveBattle = useCallback(() => {
    setScreen("solo");
    setState(null);
    // 線上：打完就退房，不然下次進來會被 findReconnectableRaidRoom 拉回已結束的房
    if (roomId) { leaveRaidRoom(roomId, myId).catch(() => {}); setRoomId(null); setRoom(null); }
    if (submitResult?.ok) onComplete?.(submitResult);
    else onBack?.();
  }, [submitResult, onComplete, onBack, roomId, myId]);

  if (!event) return null;

  if (screen === "battle" && state) {
    return (
      <>
        <RaidScreen
          key={runId}
          state={state}
          bossKey={event.bossData?.pixelKey || event.bossKey}
          bossTitle={event.bossData?.title || bossDef.title}
          bossMeta={{ family: event.bossData?.family, familyTier: bossDef.familyTier }}
          eventId={event.id}
          participants={event.totalParticipants || 0}
          playerName={myName}
          appearance={profile?.equippedCat?.catId || "baobao"}
          bgUrl={raidBackground(event.bossData?.family)}
          targetFmt={targetFmt}
          meId={myId}
          isHost={online ? isHost : true}
          onSubmitArrows={online ? sendArrows : null}
          externalSubmissions={online ? (room?.submissions || {}) : null}
          incomingRound={incomingRound}
          onForceAdvance={online && isHost ? (() => forceAdvanceRaidRoom(roomId, myId)) : null}
          onState={handleState}
          onKill={payload => { killPayloadRef.current = payload; }}
          onFinish={final => handleFinish({ ...final, killPayload: killPayloadRef.current })}
          onExit={leaveBattle}
        />
        {submitting && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 300, display: "grid", placeItems: "center",
            background: "rgba(2,6,23,.8)", color: "#e2e8f0", fontWeight: 900, fontSize: 14,
          }}>戰果送出中…</div>
        )}
        {/* 送箭沒送到——整隊會卡在等你，所以講清楚並給重送 */}
        {sendFailed && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 270,
            padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
            background: "rgba(127,29,29,.97)", color: "#fff", fontSize: 12, fontWeight: 900,
          }}>
            <span style={{ flex: 1 }}>⚠️ 這回合的箭沒送出去，隊友還在等你</span>
            <button type="button" onClick={retrySend} style={{
              padding: "7px 14px", borderRadius: 8, border: "none",
              background: "#fff", color: "#7f1d1d", fontWeight: 900, fontSize: 12, cursor: "pointer",
            }}>重送</button>
          </div>
        )}

        {/* 玩家最在意的一件事：傷害到底有沒有記到排行榜上 */}
        {submitResult && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 260,
            padding: "9px 14px", textAlign: "center",
            background: submitResult.ok ? "rgba(21,128,61,.95)" : "rgba(127,29,29,.95)",
            color: "#fff", fontSize: 12, fontWeight: 900,
          }}>
            {submitResult.ok
              ? `✅ 傷害已記錄${submitResult.dmg ? `：${Math.round(submitResult.dmg).toLocaleString()}` : ""}${submitResult.defeated ? "　🏆 你給了最後一擊！" : ""}`
              : `⚠️ ${submitResult.reason || "傷害沒有送出"}`}
          </div>
        )}
      </>
    );
  }

  if (screen === "wait" && view) {
    return (
      <div style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#05040a" }}>
        <RaidWaitRoom
          view={view} bossName={event.bossData?.name}
          starting={busy} error={roomError}
          onReady={v => setRaidReady(roomId, myId, v)}
          onStart={handleStart}
          onKick={id => kickRaidMember(roomId, myId, id)}
          onTargetFmt={fmt => {
            setLoadout(l => ({ ...l, targetFmt: fmt }));
            setRaidLoadout(roomId, myId, { targetFmt: fmt });
          }}
          onDistance={d => {
            setLoadout(l => ({ ...l, distanceM: d }));
            setRaidLoadout(roomId, myId, { distanceM: d });
          }}
          onLeave={() => exitRoom(() => leaveRaidRoom(roomId, myId))}
          onDisband={() => exitRoom(() => disbandRaidRoom(roomId, myId))}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#05040a" }}>
      {error && (
        <div style={{
          position: "sticky", top: 0, zIndex: 5, padding: "10px 14px",
          background: "rgba(69,10,10,.95)", color: "#fecaca", fontSize: 12, fontWeight: 800,
        }}>⚠️ {error}</div>
      )}
      <RaidSoloRoom
        bossKey={event.bossData?.pixelKey || event.bossKey}
        bossName={event.bossData?.name}
        bossDesc={event.bossData?.desc}
        bossHp={Number(event.bossCurrentHP) || 0}
        bossMaxHp={Number(event.bossMaxHP) || 1}
        stats={stats}
        archerLevel={archerLevel}
        catName={cats[0]?.name || null}
        targetFmt={targetFmt} distanceM={distanceM}
        onTargetFmt={fmt => setLoadout(l => ({ ...l, targetFmt: fmt }))}
        onDistance={d => setLoadout(l => ({ ...l, distanceM: d }))}
        depart={depart}
        resume={resume ? { label: resumeLabel(resume.record) } : null}
        onResume={() => { setState(resume.state); setRunId(n => n + 1); setResume(null); setScreen("battle"); }}
        onDiscardResume={() => { clearRaidProgress(); setResume(null); }}
        onDepart={startSolo}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        openRooms={openRoomList(openRooms, { bossKey: event.bossKey, myId })}
        myRoom={myOpenRoom(openRooms, myId)}
        onReturnRoom={() => {
          const mine = myOpenRoom(openRooms, myId);
          if (mine?.roomId) { setRoomId(mine.roomId); setScreen("wait"); }
        }}
        joining={busy} roomError={roomError}
        onExit={onBack}
      />
    </div>
  );
}
