// src/components/dungeon/TeamExpeditionBattle.jsx
// 組隊遠征戰鬥管理器 — 三層戰鬥流程 + DungeonBattleRoom 整合 + 獎勵結算

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { drawFloorMonsters, drawMixedMonsterPool } from "../../lib/monsterData";
import {
  DUNGEON_SHOP_ITEMS,
  drawDungeonEvent,
  getExcavationDifficulty,
} from "../../lib/dungeonData";
import {
  generateGridFloor,
  generateBranchFloor,
  isAdjacent,
  stripGridForSync,
} from "../../lib/expeditionGrid";
import {
  createTeamExpeditionBattleRoom,
  subscribeTeamExpeditionRoom,
  updateTeamExpeditionRoom,
  syncTeamExpeditionMembers,
  leaveTeamExpeditionRoom,
  cleanupTeamExpeditionRoom,
  claimTeamExpeditionResult,
} from "../../lib/expeditionTeamDb";
import { trySetDungeonFirstClear, addDungeonBroadcast } from "../../lib/dungeonDb";
import {
  cleanupExpeditionRoom,
  broadcastExpeditionFailure,
  calculateExpeditionRewards,
} from "../../lib/expeditionDb";
import {
  buildExpeditionParty,
  collectBattleStats,
  createExpeditionKillLoot,
} from "../../lib/expeditionRewards";
import DungeonBattleRoom from "./DungeonBattleRoom";
import DungeonExpeditionResult from "./DungeonExpeditionResult";
import DungeonTreasureRoom from "./DungeonTreasureRoom";
import DungeonShop from "./DungeonShop";
import DungeonEvent from "./DungeonEvent";
import DungeonTrap from "./DungeonTrap";
import DungeonChest from "./DungeonChest";
import DungeonRest from "./DungeonRest";
import { GridMapStage, BranchStage } from "./DungeonExpedition";

function attachGridMonsters(gridFloor, floorIndex, difficulty, plan) {
  const queue = [...(plan.monsters || [])];
  const fallbackVariant = floorIndex === 0 ? "weak" : "normal";
  return {
    ...gridFloor,
    rooms: gridFloor.rooms.map(room => {
      if (room.type === "elite_battle") {
        return { ...room, monster: plan.elite || drawMixedMonsterPool(1, "strong", difficulty)[0] };
      }
      if (room.type !== "battle") return room;
      return {
        ...room,
        monster: queue.shift() || drawMixedMonsterPool(1, fallbackVariant, difficulty)[0],
      };
    }),
  };
}

// expeditionMapState 寫入 Firestore 前，剔除 gridFloor.grid（巢狀陣列，Firestore 不支援）
function stripMapStateGrid(state) {
  if (!state?.gridFloor) return state;
  return { ...state, gridFloor: stripGridForSync(state.gridFloor) };
}

function buildTeamFloorState(floorIndex, difficulty, family, fixedBoss) {
  const plan = drawFloorMonsters(floorIndex, difficulty, { family, fixedBoss });
  if (floorIndex < 2) {
    const gridFloor = attachGridMonsters(
      generateGridFloor(floorIndex, difficulty),
      floorIndex,
      difficulty,
      plan,
    );
    const start = gridFloor.rooms.find(room => room.type === "entrance");
    return {
      phase: "floor_intro",
      floorIndex,
      gridFloor,
      playerPos: start?.pos || gridFloor.startPos,
      visitedIds: start ? [start.id] : [],
      branchFloor: null,
      branchChoice: null,
      branchStep: 0,
      pendingRoom: null,
    };
  }

  const branchFloor = generateBranchFloor();
  const withMonsters = {
    ...branchFloor,
    branches: Object.fromEntries(Object.entries(branchFloor.branches).map(([key, branch]) => [
      key,
      {
        ...branch,
        rooms: branch.rooms.map(room => room.type === "battle"
          ? { ...room, monster: drawMixedMonsterPool(1, "strong", difficulty)[0] }
          : room),
      },
    ])),
    boss: { ...branchFloor.boss, monster: plan.boss || fixedBoss },
  };
  return {
    phase: "floor_intro",
    floorIndex,
    gridFloor: null,
    playerPos: null,
    visitedIds: [],
    branchFloor: withMonsters,
    branchChoice: null,
    branchStep: 0,
    pendingRoom: null,
  };
}

// ── 戰鬥房間包裝元件（監聽戰況 + 清理房間）───────────────
function TeamBattleRoom({ roomId, isHost, onDone, onAbandon }) {
  const [loading, setLoading] = useState(true);
  const [battleDone, setBattleDone] = useState(false);
  const terminalHandledRef = useRef(false);
  const timerRef = useRef(null);
  const onDoneRef = useRef(onDone);
  const isHostRef = useRef(isHost);
  onDoneRef.current = onDone;
  isHostRef.current = isHost;

  useEffect(() => {
    if (!roomId) return;
    terminalHandledRef.current = false;
    setBattleDone(false);
    setLoading(false);
    const unsub = onSnapshot(doc(db, "dungeonRooms", roomId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const finishBattle = (payload, delay) => {
        if (terminalHandledRef.current) return;
        terminalHandledRef.current = true;
        setBattleDone(true);
        if (!isHostRef.current) return;
        timerRef.current = setTimeout(async () => {
          const handled = await onDoneRef.current?.({
            ...payload,
            members: data.members || {},
            battle: data,
          });
          if (handled !== false) {
            await cleanupExpeditionRoom(roomId).catch(() => {});
          }
        }, delay);
      };
      // 全滅 = 失敗
      if (data.status === "completed" && data.result === "lose") {
        finishBattle({ won: false }, 1500);
      }
      // map_explore = 通關後房主點擊領取回地圖
      if (data.status === "map_explore") {
        finishBattle({ won: true }, 300);
      }
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [roomId]);

  if (!roomId || loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-white/40 bg-[#0a0a0f]">
        ⚔️ 等待戰鬥房間…
      </div>
    );
  }

  if (battleDone) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-white/40 bg-[#0a0a0f]">
        結算中…
      </div>
    );
  }

  return (
    <DungeonBattleRoom
      roomId={roomId}
      isMapMode={true}
      expeditionMode={true}
      onReturnToMap={() => {}}
      onExit={onAbandon}
    />
  );
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  主元件  ▼▼▼
// ══════════════════════════════════════════════════════════════

export default function TeamExpeditionBattle({
  teamRoomId,
  profile,
  isHost,
  onComplete,
  onAbandon,
}) {
  const myId = profile?.id;
  const myName = profile?.name || "射手";

  // ── 訂閱組隊房間 ──────────────────────────────────────────
  const [teamRoom, setTeamRoom] = useState(null);

  useEffect(() => {
    if (!teamRoomId) return;
    const unsub = subscribeTeamExpeditionRoom(teamRoomId, (r) => {
      // 結算期間即使房主已清理協調房，仍保留最後快照讓隊員領獎。
      setTeamRoom(prev => r || prev);
    });
    return () => unsub();
  }, [teamRoomId]);

  const dungeonFamily = teamRoom?.dungeonFamily || "ghost";
  const dungeonDifficulty = teamRoom?.dungeonDifficulty || 1;
  const dungeonIsHidden = teamRoom?.dungeonIsHidden || false;
  const dungeonBoss = teamRoom?.dungeonBoss || null;
  const mapState = teamRoom?.expeditionMapState || null;
  const branchSeq = useMemo(() => {
    if (!mapState?.branchFloor || !mapState?.branchChoice) return [];
    const branch = mapState.branchFloor.branches[mapState.branchChoice];
    return [...branch.rooms, mapState.branchFloor.boss, mapState.branchFloor.treasure];
  }, [mapState?.branchFloor, mapState?.branchChoice]);

  // ── 樓層狀態 ──────────────────────────────────────────────
  const [phase, setPhase] = useState("loading"); // "loading" | "floor_intro" | "battle" | "result"
  const [floorIndex, setFloorIndex] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [floorsCleared, setFloorsCleared] = useState(0);
  const [wonLast, setWonLast] = useState(false);
  const [result, setResult] = useState(null);
  const [flowError, setFlowError] = useState("");
  const prevRoomIdRef = useRef(null);
  const floorStartingRef = useRef(false);

  // ── 全員：偵測戰鬥房與最終結果 ──────────────────────────
  useEffect(() => {
    if (teamRoom?.expeditionPhase === "result" && teamRoom.expeditionResult) {
      setPhase("result");
      setResult(teamRoom.expeditionResult);
      setWonLast(teamRoom.expeditionResult.won);
      setFloorsCleared(teamRoom.expeditionResult.floorsCleared);
      return;
    }
    if (teamRoom?.status === "completed" && teamRoom?.result === "abandoned") {
      onAbandon?.();
      return;
    }
    if (!teamRoom?.currentBattleRoomId) {
      setCurrentRoomId(null);
      if (teamRoom?.expeditionMapState?.phase) {
        setPhase(teamRoom.expeditionMapState.phase);
        setFloorIndex(teamRoom.expeditionMapState.floorIndex || 0);
      }
      return;
    }
    if (teamRoom.currentBattleRoomId === prevRoomIdRef.current) return;
    prevRoomIdRef.current = teamRoom.currentBattleRoomId;
    setCurrentRoomId(teamRoom.currentBattleRoomId);
    setFloorIndex(teamRoom.expeditionFloorIndex || 0);
    setPhase("battle");

  }, [teamRoom?.currentBattleRoomId, teamRoom?.expeditionPhase, teamRoom?.status, teamRoom?.result, onAbandon]);

  const publishResult = useCallback(async (
    won,
    cleared,
    loot = teamRoom?.expeditionLoot,
    stats = teamRoom?.expeditionStats,
    members = teamRoom?.members,
  ) => {
    const rewards = calculateExpeditionRewards({
      difficultyTier: dungeonDifficulty,
      floorsCleared: cleared,
      won,
    });
    const treasureLoot = teamRoom?.expeditionTreasureLoot;
    const finalLoot = {
      ...(loot || { chests: [], defeated: [] }),
      bonusCoins: (loot?.bonusCoins || 0) + (treasureLoot?.coins || 0),
      bonusArrowDew: (loot?.bonusArrowDew || 0) + (treasureLoot?.arrowDew || 0),
      treasure: treasureLoot ? [
        ...(treasureLoot.material ? [{ ...treasureLoot.material, kind: "material" }] : []),
        ...(treasureLoot.extraItem ? [{ ...treasureLoot.extraItem, kind: "collectible" }] : []),
        ...(treasureLoot.card ? [{ ...treasureLoot.card, kind: "card" }] : []),
      ] : [],
    };
    const expeditionResult = {
      won,
      floorsCleared: cleared,
      rewards,
      loot: finalLoot,
      stats: stats || {},
      party: buildExpeditionParty(members, teamRoom?.hostId, stats),
      boss: dungeonBoss,
    };
    setWonLast(won);
    setFloorsCleared(cleared);
    setResult(expeditionResult);
    setPhase("result");
    const saved = await updateTeamExpeditionRoom(teamRoomId, {
      expeditionPhase: "result",
      expeditionResult,
    });
    if (!saved.ok) {
      setFlowError(`無法同步最終結算：${saved.reason}`);
      setPhase("loading");
      return false;
    }
    return true;
  }, [dungeonDifficulty, teamRoomId, teamRoom, dungeonBoss]);

  const startFloor = useCallback(async fi => {
    if (!isHost || !teamRoom) return;
    const expeditionMapState = buildTeamFloorState(
      fi,
      dungeonDifficulty,
      dungeonFamily,
      dungeonBoss,
    );
    setFloorIndex(fi);
    setPhase("floor_intro");
    setCurrentRoomId(null);
    prevRoomIdRef.current = null;
    const saved = await updateTeamExpeditionRoom(teamRoomId, {
      expeditionMapState: stripMapStateGrid(expeditionMapState),
      expeditionFloorIndex: fi,
      currentBattleRoomId: null,
    });
    if (!saved.ok) setFlowError(`無法建立探索地圖：${saved.reason}`);
  }, [isHost, teamRoom, dungeonDifficulty, dungeonFamily, dungeonBoss, teamRoomId]);

  const startRoomBattle = useCallback(async (room, baseMapState = teamRoom?.expeditionMapState) => {
    if (!isHost || !teamRoom || !room?.monster || floorStartingRef.current) return;
    const members = Object.entries(teamRoom.members || {})
      .filter(([, m]) => m !== null)
      .map(([id, m]) => ({
        memberId: id,
        name: m.name,
        hp: m.hp ?? 500,
        maxHP: m.maxHP ?? 500,
        atk: m.atk ?? 10,
        def: m.def ?? 10,
        catId: m.catId || "",
        catName: m.catName || profile?.catName || "",
        archerStyle: m.archerStyle || profile?.archerStyle || "baobao",
        catAtk: m.catAtk || 0,
        alive: m.alive !== false,
        role: m.role || "front",
        displayGroup: m.displayGroup || m.role || "front",
        buffs: m.buffs || { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: false },
      }));

    floorStartingRef.current = true;
    setFlowError("");
    const res = await createTeamExpeditionBattleRoom({
      members,
      hostId: teamRoom.hostId,
      monster: room.monster,
      difficultyTier: dungeonDifficulty,
      floorIndex,
      roomType: room.type === "boss_battle" ? "boss" : room.type === "elite_battle" ? "elite" : "monster",
      arrowsPerRound: teamRoom.arrowsPerRound || 6,
      targetFmt: teamRoom.targetFmt || "full_110",
    });

    if (res.ok) {
      const nextMapState = {
        ...baseMapState,
        phase: "battle",
        pendingRoom: room,
      };
      const updateResult = await updateTeamExpeditionRoom(teamRoomId, {
        currentBattleRoomId: res.roomId,
        expeditionFloorIndex: floorIndex,
        expeditionMapState: stripMapStateGrid(nextMapState),
      });
      if (!updateResult.ok) {
        await cleanupExpeditionRoom(res.roomId).catch(() => {});
        setFlowError(`無法同步戰鬥房：${updateResult.reason}`);
        setPhase("loading");
        floorStartingRef.current = false;
        return;
      }
      setCurrentRoomId(res.roomId);
      setPhase("battle");
    } else {
      setFlowError(`無法建立戰鬥房：${res.reason}`);
    }
    floorStartingRef.current = false;
  }, [isHost, teamRoom, teamRoomId, dungeonDifficulty, floorIndex, profile]);

  useEffect(() => {
    if (!isHost || !teamRoom || teamRoom.expeditionMapState
      || teamRoom.currentBattleRoomId || teamRoom.expeditionPhase === "result") return;
    startFloor(0);
  }, [isHost, teamRoom, startFloor]);

  // ── 房主：樓層戰鬥結束回調 ──────────────────────────────
  const handleFloorDone = useCallback(async ({ won, members: battleMembers, battle }) => {
    if (!isHost) return;

    const battleSummary = {
      stats: collectBattleStats(battle?.log),
      loot: won ? createExpeditionKillLoot(battle?.monster) : null,
    };
    const syncResult = await syncTeamExpeditionMembers(
      teamRoomId,
      battleMembers,
      battleSummary,
    );
    if (!syncResult.ok) {
      setFlowError(`無法保存樓層結果：${syncResult.reason}`);
      return false;
    }
    const nextMembers = syncResult.members;

    if (!won) {
      // 失敗
      const diff = getExcavationDifficulty(dungeonDifficulty);
      broadcastExpeditionFailure(myName, diff?.label || "").catch(() => {});
      const cleared = floorIndex; // 已通關的層數（當前層未通過）
      return await publishResult(
        false,
        cleared,
        syncResult.loot,
        syncResult.stats,
        nextMembers,
      );
    }

    const mapState = teamRoom?.expeditionMapState;
    const pendingRoom = mapState?.pendingRoom;
    if (!mapState) {
      if (floorIndex >= 2) {
        const treasureState = buildTeamFloorState(2, dungeonDifficulty, dungeonFamily, dungeonBoss);
        treasureState.phase = "treasure";
        await updateTeamExpeditionRoom(teamRoomId, {
          currentBattleRoomId: null,
          expeditionMapState: stripMapStateGrid(treasureState),
        });
      } else {
        await startFloor(floorIndex + 1);
      }
      return true;
    }
    let nextMapState;
    if (pendingRoom?.type === "boss_battle") {
      nextMapState = {
        ...mapState,
        phase: "treasure",
        pendingRoom: null,
      };
      setFloorsCleared(3);
    } else if (floorIndex < 2) {
      nextMapState = {
        ...mapState,
        phase: "grid",
        pendingRoom: null,
        gridFloor: {
          ...mapState.gridFloor,
          rooms: mapState.gridFloor.rooms.map(room =>
            room.id === pendingRoom?.id ? { ...room, cleared: true } : room
          ),
        },
      };
    } else {
      nextMapState = {
        ...mapState,
        phase: "branch",
        pendingRoom: null,
        branchStep: (mapState.branchStep || 0) + 1,
      };
    }
    prevRoomIdRef.current = null;
    setCurrentRoomId(null);
    setPhase(nextMapState.phase);
    const saved = await updateTeamExpeditionRoom(teamRoomId, {
      currentBattleRoomId: null,
      expeditionMapState: stripMapStateGrid(nextMapState),
    });
    if (!saved.ok) {
      setFlowError(`無法返回探索地圖：${saved.reason}`);
      return false;
    }
    return true;
  }, [isHost, myName, dungeonDifficulty, dungeonFamily, dungeonBoss, floorIndex, teamRoomId, teamRoom, startFloor, publishResult]);

  const enterExplorationRoom = useCallback(async (room, positionedState) => {
    if (!isHost || !room) return;
    if (["battle", "elite_battle", "boss_battle"].includes(room.type)) {
      await startRoomBattle(room, positionedState);
      return;
    }
    if (room.type === "stairs" || room.type === "entrance" || room.cleared) {
      await updateTeamExpeditionRoom(teamRoomId, { expeditionMapState: stripMapStateGrid(positionedState) });
      return;
    }
    const preparedRoom = { ...room };
    const sharedRoomFields = {
      activeRoomId: room.id,
      mapDungeonId: `${dungeonFamily}_expedition`,
      roomConfirms: {},
      roomChoices: {},
    };
    if (room.type === "shop") {
      const shuffled = [...DUNGEON_SHOP_ITEMS].sort(() => Math.random() - 0.5);
      preparedRoom.shopItems = shuffled.slice(0, 5).map(item => item.id);
      sharedRoomFields.shopItems = preparedRoom.shopItems;
    }
    if (room.type === "event") {
      preparedRoom.event = drawDungeonEvent();
      sharedRoomFields.currentEvent = preparedRoom.event;
    }
    await updateTeamExpeditionRoom(teamRoomId, {
      ...sharedRoomFields,
      expeditionMapState: stripMapStateGrid({
        ...positionedState,
        phase: room.type === "treasure" ? "treasure" : "func_room",
        pendingRoom: preparedRoom,
      }),
    });
  }, [isHost, startRoomBattle, teamRoomId, dungeonFamily]);

  const handleCellClick = useCallback(async room => {
    if (!isHost || !mapState?.playerPos || !isAdjacent(room.pos, mapState.playerPos)) return;
    const visitedIds = mapState.visitedIds?.includes(room.id)
      ? mapState.visitedIds
      : [...(mapState.visitedIds || []), room.id];
    const positionedState = {
      ...mapState,
      playerPos: room.pos,
      visitedIds,
    };
    await enterExplorationRoom(room, positionedState);
  }, [isHost, mapState, enterExplorationRoom]);

  const handleDescend = useCallback(async () => {
    if (!isHost || floorIndex >= 2) return;
    const cleared = floorIndex + 1;
    setFloorsCleared(cleared);
    await updateTeamExpeditionRoom(teamRoomId, { expeditionFloorsCleared: cleared });
    await startFloor(floorIndex + 1);
  }, [isHost, floorIndex, teamRoomId, startFloor]);

  const handleChooseBranch = useCallback(async choice => {
    if (!isHost || !mapState?.branchFloor?.branches?.[choice]) return;
    await updateTeamExpeditionRoom(teamRoomId, {
      expeditionMapState: stripMapStateGrid({ ...mapState, branchChoice: choice, branchStep: 0 }),
    });
  }, [isHost, mapState, teamRoomId]);

  const handleBranchNext = useCallback(async () => {
    if (!isHost) return;
    const room = branchSeq[mapState?.branchStep || 0];
    if (!room) return;
    await enterExplorationRoom(room, mapState);
  }, [isHost, branchSeq, mapState, enterExplorationRoom]);

  const finishFunctionRoom = useCallback(async () => {
    if (!isHost || !mapState?.pendingRoom) return;
    let nextMapState;
    if (floorIndex < 2) {
      nextMapState = {
        ...mapState,
        phase: "grid",
        pendingRoom: null,
        gridFloor: {
          ...mapState.gridFloor,
          rooms: mapState.gridFloor.rooms.map(room =>
            room.id === mapState.pendingRoom.id ? { ...room, cleared: true } : room
          ),
        },
      };
    } else {
      nextMapState = {
        ...mapState,
        phase: "branch",
        pendingRoom: null,
        branchStep: (mapState.branchStep || 0) + 1,
      };
    }
    await updateTeamExpeditionRoom(teamRoomId, {
      activeRoomId: null,
      roomConfirms: {},
      roomChoices: {},
      currentEvent: null,
      expeditionMapState: stripMapStateGrid(nextMapState),
    });
  }, [isHost, mapState, floorIndex, teamRoomId]);

  // ── 領取獎勵 + 儲存紀錄 ──────────────────────────────────
  const handleFinish = useCallback(async () => {
    const rewards = result?.rewards;
    if (!rewards) return;
    const claim = await claimTeamExpeditionResult(teamRoomId, myId, {
      family: dungeonFamily,
      difficulty: dungeonDifficulty,
      isHidden: dungeonIsHidden,
      floorsCleared,
      won: wonLast,
    });
    if (!claim.ok) {
      setFlowError(`領取失敗：${claim.reason}`);
      return false;
    }      if (claim.ok && claim.allClaimed) {
        cleanupTeamExpeditionRoom(teamRoomId).catch(() => {});
      }

      // ── 遠征首殺判定 ────────────────────────────────────────
      if (wonLast) {
        const expeditionKey = `expedition_${dungeonFamily}_${dungeonDifficulty}`;
        const teamNames = Object.values(teamRoom?.members || {})
          .filter(Boolean).map(m => m.name).filter(Boolean);
        try {
          const fcResult = await trySetDungeonFirstClear(expeditionKey, myId, myName, teamNames);
          if (fcResult.isFirst) {
            const diff = getExcavationDifficulty(dungeonDifficulty);
            const FAMILY_MAP = { ghost:{e:"👻",l:"幽冥系"}, mountain:{e:"⛰️",l:"山嶺系"}, insect:{e:"🦋",l:"昆蟲系"}, workplace:{e:"💼",l:"職場系"}, exam:{e:"📝",l:"考試系"}, temple:{e:"🏛️",l:"神廟系"}, treasure:{e:"📦",l:"寶箱族"} };
            const f = FAMILY_MAP[dungeonFamily] || {e:"🏰",l:"遠征"};
            addDungeonBroadcast(expeditionKey, `遠征-${f.l}`, diff?.label || `Lv.${dungeonDifficulty}`, f.e, teamNames).catch(() => {});
          }
        } catch (_) {}
      }

      onComplete?.();
      return true;
    }, [result, myId, dungeonDifficulty, floorsCleared, wonLast, dungeonFamily, dungeonIsHidden, isHost, teamRoomId, myName, onComplete]);

  // ── 放棄 ──────────────────────────────────────────────────
  const handleAbandon = useCallback(async () => {
    if (isHost) {
      const diff = getExcavationDifficulty(dungeonDifficulty);
      broadcastExpeditionFailure(myName, diff?.label || "").catch(() => {});
      if (teamRoom?.currentBattleRoomId) {
        await cleanupExpeditionRoom(teamRoom.currentBattleRoomId).catch(() => {});
      }
      await updateTeamExpeditionRoom(teamRoomId, {
        status: "completed",
        result: "abandoned",
      }).catch(() => {});
      setTimeout(() => cleanupTeamExpeditionRoom(teamRoomId).catch(() => {}), 800);
    } else {
      await leaveTeamExpeditionRoom(teamRoomId, myId).catch(() => {});
    }
    onAbandon?.();
  }, [myId, myName, dungeonDifficulty, isHost, teamRoomId, teamRoom, onAbandon]);

  // ── 輔助：組隊房間載入中 ────────────────────────────────
  if (!teamRoom) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-white/40 bg-[#0a0a0f]">
        載入遠征資料…
      </div>
    );
  }

  // ── 結算畫面 ──────────────────────────────────────────────
  if (phase === "result") {
    const rewards = result?.rewards;
    if (!rewards) return null;
    return (
      <DungeonExpeditionResult
        won={wonLast}
        family={dungeonFamily}
        difficultyTier={dungeonDifficulty}
        isHidden={dungeonIsHidden}
        rewards={rewards}
        loot={result?.loot}
        party={result?.party}
        boss={result?.boss || dungeonBoss}
        error={flowError}
        floorsCleared={floorsCleared}
        onFinish={handleFinish}
        teamMode={true}
        teamSize={Object.values(teamRoom?.members || {}).filter(Boolean).length}
      />
    );
  }

  const myMember = teamRoom.members?.[myId] || {};
  const playerState = {
    hp: myMember.hp ?? 0,
    maxHP: myMember.maxHP ?? 1,
    atk: myMember.atk ?? 0,
    def: myMember.def ?? 0,
    buffs: myMember.buffs || {},
  };

  if (mapState?.phase === "floor_intro") {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-5 px-6 text-center bg-[#0a0a0f] text-white">
        <div className="text-6xl">{floorIndex === 2 ? "👑" : floorIndex === 1 ? "⚔️" : "🌿"}</div>
        <div className="text-2xl font-black">第 {floorIndex + 1} 層</div>
        <div className="text-sm text-slate-400">
          {floorIndex === 2 ? "選擇分支並突破王關" : "探索迷霧地圖，清除房間並尋找階梯"}
        </div>
        {isHost ? (
          <button
            type="button"
            onClick={() => updateTeamExpeditionRoom(teamRoomId, {
              expeditionMapState: stripMapStateGrid({ ...mapState, phase: floorIndex < 2 ? "grid" : "branch" }),
            })}
            className="min-h-12 w-full max-w-sm rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 font-black"
          >
            進入第 {floorIndex + 1} 層
          </button>
        ) : (
          <div className="text-sm text-slate-400">等待隊長開始探索…</div>
        )}
      </div>
    );
  }

  if (mapState?.phase === "grid" && mapState.gridFloor) {
    return (
      <GridMapStage
        gridFloor={mapState.gridFloor}
        playerPos={mapState.playerPos}
        visitedIds={new Set(mapState.visitedIds || [])}
        floorIndex={floorIndex}
        playerState={playerState}
        coins={profile?.coins || 0}
        onCellClick={handleCellClick}
        onDescend={handleDescend}
        onRetreat={handleAbandon}
        canControl={isHost}
      />
    );
  }

  if (mapState?.phase === "branch" && mapState.branchFloor) {
    return (
      <BranchStage
        branchFloor={mapState.branchFloor}
        branchChoice={mapState.branchChoice}
        branchSeq={branchSeq}
        branchStep={mapState.branchStep || 0}
        playerState={playerState}
        coins={profile?.coins || 0}
        onChoose={handleChooseBranch}
        onEnterNext={handleBranchNext}
        onRetreat={handleAbandon}
        canControl={isHost}
      />
    );
  }

  if (mapState?.phase === "func_room" && mapState.pendingRoom) {
    const common = {
      roomId: teamRoomId,
      room: teamRoom,
      memberId: myId,
      isHost,
      onSharedDone: finishFunctionRoom,
    };
    switch (mapState.pendingRoom.type) {
      case "shop":
        return <DungeonShop {...common} memberData={{ ...myMember, id: myId, coins: profile?.coins || 0 }} />;
      case "event":
        return <DungeonEvent {...common} />;
      case "trap":
        return <DungeonTrap {...common} />;
      case "chest":
        return <DungeonChest {...common} />;
      case "rest":
        return <DungeonRest {...common} />;
      default:
        return null;
    }
  }

  if (mapState?.phase === "treasure") {
    if (!isHost && !teamRoom.expeditionTreasureLoot) {
      return (
        <div className="h-[100dvh] flex items-center justify-center bg-[#0a0a0f] text-white/50">
          等待隊長開啟寶藏房…
        </div>
      );
    }
    return (
      <DungeonTreasureRoom
        difficultyTier={dungeonDifficulty}
        family={dungeonFamily}
        lootOverride={teamRoom.expeditionTreasureLoot || null}
        onLoot={isHost ? loot => updateTeamExpeditionRoom(teamRoomId, {
          expeditionTreasureLoot: loot,
        }) : undefined}
        claimDisabled={!isHost}
        claimLabel={isHost ? "📊 帶領隊伍查看遠征報告" : "等待隊長前往結算…"}
        onClaim={isHost ? () => publishResult(
          true,
          3,
          teamRoom.expeditionLoot,
          teamRoom.expeditionStats,
          teamRoom.members,
        ) : undefined}
      />
    );
  }

  // ── 戰鬥房間 ──────────────────────────────────────────────
  if (phase === "battle" && currentRoomId) {
    return (
      <TeamBattleRoom
        roomId={currentRoomId}
        isHost={isHost}
        onDone={isHost ? handleFloorDone : undefined}
        onAbandon={handleAbandon}
      />
    );
  }

  if (flowError) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 bg-[#0a0a0f] text-white">
        <div className="text-4xl">⚠️</div>
        <div className="text-center text-sm text-rose-300">{flowError}</div>
        {isHost && (
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-3 rounded-xl bg-amber-500 text-white font-black"
          >
            重新同步遠征
          </button>
        )}
      </div>
    );
  }

  // ── 載入中（房主準備怪物 / 等待隊友同步）───────────────
  return (
    <div className="h-[100dvh] flex items-center justify-center bg-[#0a0a0f] text-white/40">
      {isHost ? "準備戰鬥房間…" : "等待隊長開始遠征…"}
    </div>
  );
}
