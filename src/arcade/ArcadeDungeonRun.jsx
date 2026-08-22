import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GridMapStage, BranchStage } from "../components/dungeon/DungeonStages";
import DungeonShop from "../components/dungeon/DungeonShop";
import DungeonTrap from "../components/dungeon/DungeonTrap";
import DungeonEvent from "../components/dungeon/DungeonEvent";
import DungeonChest from "../components/dungeon/DungeonChest";
import DungeonRest from "../components/dungeon/DungeonRest";
import { createOrdinaryChestChoices } from "../lib/dungeonChestLoot";
import { drawDungeonEvent } from "../lib/dungeonData";
import { DUNGEON_MERCHANT_TYPES } from "../lib/dungeonMerchant";
import { TRAP_EVENTS } from "../lib/dungeonTrapPool";
import ArcadeBattleScreenAdapter from "./ArcadeBattleScreenAdapter";
import { updateAdventureSession } from "./arcadeDb";
import { applyArcadeSettlement } from "./arcadeProgression";
import { buildArcadeVisitorMonster, getArcadeDungeonConfig } from "./arcadeDungeonConfig";
import {
  advanceArcadeDungeonBranch,
  advanceArcadeDungeonFloor,
  applyArcadeDungeonBattleRound,
  applyArcadeDungeonBattleVictory,
  applyArcadeDungeonLocalEffect,
  applyArcadeDungeonShopItem,
  buildArcadeDungeonSettlement,
  canMoveToArcadeRoom,
  chooseArcadeDungeonBranch,
  createArcadeDungeonRuntime,
  enterArcadeDungeonRoom,
  getArcadeBranchSequence,
  getArcadeDungeonPlayerState,
  markArcadeRoomCleared,
  moveArcadeDungeonPlayer,
  resolveArcadeInlineRoom,
  resultArcadeDungeonRuntime,
  scaleArcadeDungeonMonsterForRun,
} from "./arcadeDungeonRunLogic";

const INLINE_TYPES = new Set(["quick_event", "empty", "coin_pouch", "mini_chest", "scout"]);
const COMBAT_TYPES = new Set(["battle", "elite_battle", "boss_battle"]);

function stableIndex(text, length) {
  if (!length) return 0;
  let hash = 0;
  for (const ch of String(text || "")) hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
  return hash % length;
}

function dungeonTitle(config, floorIndex) {
  return `${config.icon || "🏹"} ${config.name} · 第 ${floorIndex + 1} 層`;
}

function buildLocalRoom(runtime, profile, config) {
  const pending = runtime.pendingRoom || {};
  const memberId = profile?.visitorId || "visitor";
  const playerState = getArcadeDungeonPlayerState(runtime, profile);
  return {
    ...pending,
    activeRoomId:pending.id,
    mapDungeonId:`${config.family}_${config.difficulty}`,
    expeditionDifficulty:config.difficulty,
    dungeonDifficulty:config.difficulty,
    hostId:memberId,
    members:{ [memberId]:playerState },
    roomConfirms:{},
    roomChoices:{},
    merchantRoomPurchases:{},
    merchantRunPurchases:{},
    merchantGroups:{},
    chestClaims:{},
    restResults:{},
  };
}

function RunHeader({ config, runtime, playerState, onExit }) {
  return (
    <div style={{position:"sticky",top:0,zIndex:50,display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(5,10,20,.94)",borderBottom:"1px solid rgba(255,255,255,.08)",color:"white",backdropFilter:"blur(10px)"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:950,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{dungeonTitle(config, runtime.floorIndex)}</div>
        <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>本次戰利品 🪙 {runtime.runCoins} · HP {Math.max(0, runtime.playerHp)}/{runtime.maxHp}</div>
      </div>
      <div style={{fontSize:10,color:"#cbd5e1",textAlign:"right"}}>ATK {playerState.atk}<br/>DEF {playerState.def}</div>
      <button type="button" onClick={onExit} style={{border:"1px solid rgba(148,163,184,.3)",background:"rgba(15,23,42,.9)",color:"#cbd5e1",borderRadius:9,padding:"7px 9px",fontWeight:800,cursor:"pointer"}}>返回</button>
    </div>
  );
}

function TreasureRoom({ runtime, config, onClaim }) {
  const reward = Math.max(20, Math.round(42 * config.rewardMult));
  return (
    <div style={{minHeight:"calc(100vh - 52px)",display:"grid",placeItems:"center",padding:22,background:"radial-gradient(circle at 50% 20%,#3b2f16,#090d17 55%,#05070c)",color:"white"}}>
      <div style={{width:"100%",maxWidth:420,textAlign:"center",padding:26,borderRadius:24,background:"rgba(15,23,42,.9)",border:"1px solid rgba(251,191,36,.38)",boxShadow:"0 20px 60px rgba(0,0,0,.55)"}}>
        <div style={{fontSize:58}}>🎁</div>
        <div style={{fontSize:23,fontWeight:950,color:"#fde68a",marginTop:8}}>終點寶藏</div>
        <div style={{fontSize:13,color:"#cbd5e1",lineHeight:1.7,marginTop:8}}>你走完了這條路線。寶箱中的戰利品會先留在本次冒險，完成或撤退後才正式存入瀏覽器進度。</div>
        <div style={{margin:"18px 0",fontSize:18,fontWeight:900,color:"#fbbf24"}}>🪙 +{reward} · 地下城寶物 ×1</div>
        <button type="button" onClick={() => onClaim(reward)} style={{width:"100%",padding:13,border:0,borderRadius:13,background:"linear-gradient(135deg,#fbbf24,#d97706)",color:"#241400",fontSize:15,fontWeight:950,cursor:"pointer"}}>收下寶藏</button>
      </div>
    </div>
  );
}

function ResultScreen({ config, runtime, settling, error, onRetrySettlement, onReplay, onExit }) {
  const settlement = runtime.result?.settlement || buildArcadeDungeonSettlement(runtime, runtime.outcome || "defeat");
  const outcome = runtime.outcome || "defeat";
  const meta = outcome === "clear"
    ? {icon:"🏆",title:"地下城完成",color:"#86efac"}
    : outcome === "retreat"
      ? {icon:"🎒",title:"安全撤退",color:"#fde68a"}
      : {icon:"💀",title:"本次冒險結束",color:"#fca5a5"};
  return (
    <div style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:22,background:"linear-gradient(145deg,#05070d,#101827,#05070d)",color:"white"}}>
      <div style={{width:"100%",maxWidth:430,textAlign:"center",padding:26,borderRadius:24,background:"rgba(15,23,42,.92)",border:"1px solid rgba(148,163,184,.18)",boxShadow:"0 24px 70px rgba(0,0,0,.55)"}}>
        <div style={{fontSize:62}}>{meta.icon}</div>
        <div style={{fontSize:24,fontWeight:950,color:meta.color,marginTop:5}}>{config.name} · {meta.title}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginTop:18}}>
          <div style={{padding:12,borderRadius:13,background:"rgba(255,255,255,.05)"}}><div style={{fontSize:10,color:"#94a3b8"}}>正式帶出</div><b style={{fontSize:18,color:"#fbbf24"}}>🪙 {settlement.coins}</b></div>
          <div style={{padding:12,borderRadius:13,background:"rgba(255,255,255,.05)"}}><div style={{fontSize:10,color:"#94a3b8"}}>射手 EXP</div><b style={{fontSize:18,color:"#93c5fd"}}>+{settlement.xp}</b></div>
          <div style={{padding:12,borderRadius:13,background:"rgba(255,255,255,.05)"}}><div style={{fontSize:10,color:"#94a3b8"}}>擊倒</div><b style={{fontSize:18}}>{runtime.stats?.kills || 0}</b></div>
          <div style={{padding:12,borderRadius:13,background:"rgba(255,255,255,.05)"}}><div style={{fontSize:10,color:"#94a3b8"}}>最深樓層</div><b style={{fontSize:18}}>{runtime.stats?.bestFloor || runtime.floorIndex + 1}</b></div>
        </div>
        {outcome === "defeat" && config.id === "abyss" && <div style={{marginTop:14,padding:10,borderRadius:10,background:"rgba(127,29,29,.28)",color:"#fecaca",fontSize:12}}>深淵團滅：本趟未帶出的金幣消失，但仍獲得 EXP。</div>}
        {error && <div style={{marginTop:14,padding:10,borderRadius:10,background:"rgba(127,29,29,.32)",color:"#fecaca",fontSize:12}}>{error}</div>}
        {error && <button type="button" onClick={onRetrySettlement} disabled={settling} style={{marginTop:10,width:"100%",padding:11,border:0,borderRadius:11,background:"#dc2626",color:"white",fontWeight:900,cursor:"pointer"}}>重新寫入結算</button>}
        <div style={{display:"flex",gap:8,marginTop:18}}>
          <button type="button" onClick={onExit} disabled={settling || !!error} style={{flex:1,padding:12,border:"1px solid rgba(148,163,184,.25)",borderRadius:12,background:"rgba(255,255,255,.05)",color:"#cbd5e1",fontWeight:900,cursor:"pointer"}}>回大廳</button>
          <button type="button" onClick={onReplay} disabled={settling || !!error} style={{flex:1,padding:12,border:0,borderRadius:12,background:"linear-gradient(135deg,#fbbf24,#d97706)",color:"#241400",fontWeight:950,cursor:"pointer"}}>再玩一次</button>
        </div>
      </div>
    </div>
  );
}

export default function ArcadeDungeonRun({
  profile,
  mode = "forest",
  runId,
  session = null,
  onMutate,
  onSettled,
  onReplay,
  onExit,
  onToast,
}) {
  const config = useMemo(() => getArcadeDungeonConfig(mode), [mode]);
  const [runtime, setRuntime] = useState(() => createArcadeDungeonRuntime({
    dungeonId:config.id,
    runId,
    profile,
    sessionRuntime:session?.runtime,
  }));
  const [settling, setSettling] = useState(false);
  const [settlementError, setSettlementError] = useState("");
  const runtimeRef = useRef(runtime);
  const settlingRef = useRef(false);
  runtimeRef.current = runtime;

  const playerState = useMemo(() => getArcadeDungeonPlayerState(runtime, profile), [runtime, profile]);
  const memberId = profile?.visitorId || "visitor";
  const branchSeq = useMemo(() => getArcadeBranchSequence(runtime), [runtime.floor, runtime.branchChoice]);
  // Persisted Arcade runtime keeps ids as arrays; shared DungeonMapView expects Set#has().
  const visitedIdSet = useMemo(
    () => new Set(Array.isArray(runtime.visitedIds) ? runtime.visitedIds : []),
    [runtime.visitedIds],
  );

  useEffect(() => {
    if (!runId || runtime.phase === "result") return undefined;
    const timer = setTimeout(() => {
      updateAdventureSession(runId, current => ({
        mode:config.id,
        dungeonId:config.id,
        runtime,
        settled:current.settled === true ? true : false,
      })).catch(() => {});
    }, 80);
    return () => clearTimeout(timer);
  }, [runId, config.id, runtime]);

  const settleRun = useCallback(async (outcome, snapshot = runtimeRef.current, forceRetry = false) => {
    if (!snapshot || (!forceRetry && settlingRef.current)) return;
    settlingRef.current = true;
    setSettling(true);
    setSettlementError("");
    const settlement = buildArcadeDungeonSettlement(snapshot, outcome);
    const finished = resultArcadeDungeonRuntime(snapshot, outcome, settlement);
    try {
      if (onMutate) {
        await onMutate(current => applyArcadeSettlement(current, settlement).updated);
      }
      runtimeRef.current = finished;
      setRuntime(finished);
      await onSettled?.();
      onToast?.(outcome === "clear" ? "地下城完成，獎勵已存入本機" : outcome === "retreat" ? "戰利品已帶回" : "本次冒險已結算");
    } catch (error) {
      runtimeRef.current = finished;
      setRuntime(finished);
      setSettlementError(error?.message || "結算寫入失敗，請重新嘗試");
      settlingRef.current = false;
    } finally {
      setSettling(false);
    }
  }, [onMutate, onSettled, onToast]);

  useEffect(() => {
    if (runtime.phase === "result" || runtime.playerHp > 0 || settlingRef.current) return;
    settleRun("defeat", runtime);
  }, [runtime, settleRun]);

  const completeCurrentRoom = useCallback(() => {
    const current = runtimeRef.current;
    if (!current?.pendingRoom) return;
    const next = current.floor?.kind === "branch"
      ? advanceArcadeDungeonBranch({ ...current, pendingRoom:null, phase:"branch" })
      : markArcadeRoomCleared(current, current.pendingRoom.id);
    runtimeRef.current = next;
    setRuntime(next);
  }, []);

  const prepareRoom = useCallback((room) => {
    const current = runtimeRef.current;
    if (!room || !current || current.clearedIds?.includes(room.id)) return;
    const extras = {};
    if (COMBAT_TYPES.has(room.type)) {
      const monster = buildArcadeVisitorMonster(config.id, current.floorIndex, room.type, `${current.runId}:${room.id}`);
      extras.monster = scaleArcadeDungeonMonsterForRun(monster, current);
      extras.battleState = room.battleState || null;
    } else if (room.type === "event") {
      extras.event = room.event || drawDungeonEvent("special");
    } else if (room.type === "shop") {
      extras.shopType = room.shopType || DUNGEON_MERCHANT_TYPES[stableIndex(`${current.runId}:${room.id}:shop`, DUNGEON_MERCHANT_TYPES.length)];
    } else if (room.type === "trap") {
      extras.trapTypeId = room.trapTypeId || TRAP_EVENTS[stableIndex(`${current.runId}:${room.id}:trap`, TRAP_EVENTS.length)]?.id;
    } else if (room.type === "chest") {
      extras.chestEggType = "normal";
      extras.chestChoices = room.chestChoices || createOrdinaryChestChoices({ family:config.family, difficultyTier:config.difficulty, hidden:false });
    }
    const next = enterArcadeDungeonRoom(current, room, extras);
    runtimeRef.current = next;
    setRuntime(next);
  }, [config]);

  const handleCellClick = useCallback((room) => {
    const current = runtimeRef.current;
    if (!canMoveToArcadeRoom(current, room)) return;
    let next = moveArcadeDungeonPlayer(current, room);
    if (INLINE_TYPES.has(room.type) && !next.clearedIds.includes(room.id)) {
      next = resolveArcadeInlineRoom(next, room, config.rewardMult);
    }
    runtimeRef.current = next;
    setRuntime(next);
  }, [config.rewardMult]);

  const handleLocalEffect = useCallback((payload) => {
    const current = runtimeRef.current;
    const next = applyArcadeDungeonLocalEffect(current, payload, `${current.runId}:${current.pendingRoom?.id || "room"}`);
    runtimeRef.current = next;
    setRuntime(next);
  }, []);

  const handleShopBuy = useCallback((item) => {
    const current = runtimeRef.current;
    const next = applyArcadeDungeonShopItem(current, item);
    runtimeRef.current = next;
    setRuntime(next);
  }, []);

  const handleDescend = useCallback(() => {
    const current = runtimeRef.current;
    const next = advanceArcadeDungeonFloor(current);
    if (next === current) {
      settleRun("clear", current);
      return;
    }
    runtimeRef.current = next;
    setRuntime(next);
  }, [settleRun]);

  const handleBranchChoose = useCallback((choice) => {
    const next = chooseArcadeDungeonBranch(runtimeRef.current, choice);
    runtimeRef.current = next;
    setRuntime(next);
  }, []);

  const handleBranchEnter = useCallback(() => {
    const current = runtimeRef.current;
    const seq = getArcadeBranchSequence(current);
    const room = seq[current.branchStep];
    if (!room) {
      settleRun("clear", current);
      return;
    }
    prepareRoom(room);
  }, [prepareRoom, settleRun]);

  const handleBattleRound = useCallback((result) => {
    const next = applyArcadeDungeonBattleRound(runtimeRef.current, result);
    runtimeRef.current = next;
    setRuntime(next);
  }, []);

  const handleBattleVictory = useCallback((result) => {
    const current = runtimeRef.current;
    const rewardCoins = Math.max(0, Math.round((current.pendingRoom?.monster?.rewardCoins || 0) * config.rewardMult));
    const next = applyArcadeDungeonBattleVictory(current, result, rewardCoins);
    runtimeRef.current = next;
    setRuntime(next);
    const wasFinalGridBoss = current.floor?.kind === "grid"
      && current.pendingRoom?.type === "boss_battle"
      && current.floorIndex >= config.floors - 1;
    if (wasFinalGridBoss) settleRun("clear", next);
  }, [config.floors, config.rewardMult, settleRun]);

  const handleBattleDefeat = useCallback((result) => {
    const round = applyArcadeDungeonBattleRound(runtimeRef.current, result);
    const next = {
      ...round,
      stats:{ ...round.stats, battles:(round.stats?.battles || 0) + 1 },
    };
    runtimeRef.current = next;
    setRuntime(next);
    settleRun("defeat", next);
  }, [settleRun]);

  const handleTreasureClaim = useCallback((coins) => {
    const current = runtimeRef.current;
    let next = applyArcadeDungeonLocalEffect(current, { type:"coins", value:coins });
    next = applyArcadeDungeonLocalEffect(next, { type:"chest_reward", reward:{ id:`${config.id}_dungeon_treasure`, amount:1 } });
    next = advanceArcadeDungeonBranch({ ...next, pendingRoom:null, phase:"branch" });
    runtimeRef.current = next;
    setRuntime(next);
    if (next.branchStep >= getArcadeBranchSequence(next).length) settleRun("clear", next);
  }, [config.id, settleRun]);

  const handleRetreat = useCallback(() => {
    if (!config.allowRetreat) {
      onToast?.("這座新手地下城請完成冒險後再離開");
      return;
    }
    settleRun("retreat", runtimeRef.current);
  }, [config.allowRetreat, onToast, settleRun]);

  if (runtime.phase === "result") {
    return <ResultScreen config={config} runtime={runtime} settling={settling} error={settlementError}
      onRetrySettlement={() => settleRun(runtime.outcome || "defeat", runtime, true)} onReplay={onReplay} onExit={onExit} />;
  }

  const pending = runtime.pendingRoom;
  const localRoom = pending ? buildLocalRoom(runtime, profile, config) : null;

  let body = null;
  if (runtime.phase === "room" && pending) {
    if (COMBAT_TYPES.has(pending.type) && pending.monster) {
      body = <ArcadeBattleScreenAdapter
        profile={profile}
        monster={pending.monster}
        playerHp={runtime.playerHp}
        playerState={playerState}
        runBuffs={runtime.buffs}
        battleState={pending.battleState}
        onRound={handleBattleRound}
        onVictory={handleBattleVictory}
        onDefeat={handleBattleDefeat}
      />;
    } else if (pending.type === "shop") {
      body = <DungeonShop roomId={pending.id} room={localRoom} memberId={memberId} memberData={{ ...playerState, coins:runtime.runCoins }} isHost
        localMode onLocalBuy={handleShopBuy} onLocalDone={completeCurrentRoom} boughtEffects={runtime.boughtEffects} />;
    } else if (pending.type === "trap") {
      body = <DungeonTrap roomId={pending.id} room={localRoom} memberId={memberId} isHost localMode onLocalEffect={handleLocalEffect} onLocalDone={completeCurrentRoom} />;
    } else if (pending.type === "event") {
      body = <DungeonEvent roomId={pending.id} room={localRoom} memberId={memberId} isHost event={pending.event} localMode onLocalEffect={handleLocalEffect} onLocalDone={completeCurrentRoom} />;
    } else if (pending.type === "chest") {
      body = <DungeonChest roomId={pending.id} room={localRoom} memberId={memberId} isHost localMode onLocalEffect={handleLocalEffect} onLocalDone={completeCurrentRoom} />;
    } else if (pending.type === "rest") {
      body = <DungeonRest roomId={pending.id} room={localRoom} memberId={memberId} isHost localMode coins={runtime.runCoins} onLocalEffect={handleLocalEffect} onLocalDone={completeCurrentRoom} />;
    } else if (pending.type === "treasure") {
      body = <TreasureRoom runtime={runtime} config={config} onClaim={handleTreasureClaim} />;
    } else {
      body = <div style={{minHeight:"60vh",display:"grid",placeItems:"center",background:"#070b13",color:"white"}}><button type="button" onClick={completeCurrentRoom}>繼續探索</button></div>;
    }
  } else if (runtime.floor?.kind === "branch") {
    body = <BranchStage
      branchFloor={runtime.floor}
      branchChoice={runtime.branchChoice}
      branchSeq={branchSeq}
      branchStep={runtime.branchStep}
      playerState={playerState}
      coins={runtime.runCoins}
      lootMult={config.rewardMult}
      onChoose={handleBranchChoose}
      onEnterNext={handleBranchEnter}
      onRetreat={handleRetreat}
      canControl
      difficulty={config.difficulty}
      family={config.family}
      partyMembers={[]}
      currentMemberId={memberId}
    />;
  } else {
    body = <GridMapStage
      gridFloor={runtime.floor}
      playerPos={runtime.playerPos}
      visitedIds={visitedIdSet}
      floorIndex={runtime.floorIndex}
      playerState={playerState}
      coins={runtime.runCoins}
      lootMult={config.rewardMult}
      onCellClick={handleCellClick}
      onEnterRoom={prepareRoom}
      onDescend={handleDescend}
      onSaveAndLeave={() => onToast?.("進度會自動保存在這個瀏覽器，可直接返回大廳後再繼續")}
      onRetreat={handleRetreat}
      canControl
      difficulty={config.difficulty}
      family={config.family}
      partyMembers={[]}
      currentMemberId={memberId}
      inlineToast={runtime.inlineToast}
      showSaveAndLeave={false}
      showRetreat={config.allowRetreat}
    />;
  }

  return (
    <div style={{minHeight:"100vh",background:"#05070c"}}>
      <RunHeader config={config} runtime={runtime} playerState={playerState} onExit={() => {
        onToast?.("冒險進度已保存在這個瀏覽器");
        onExit?.({ preserveSession:true });
      }} />
      {body}
    </div>
  );
}
