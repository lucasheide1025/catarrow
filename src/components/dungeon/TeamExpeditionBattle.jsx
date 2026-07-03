// src/components/dungeon/TeamExpeditionBattle.jsx
// 組隊遠征戰鬥管理器 — 三層戰鬥流程 + DungeonBattleRoom 整合 + 獎勵結算

import { useState, useEffect, useRef, useCallback } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { drawFloorMonsters } from "../../lib/monsterData";
import { getExcavationDifficulty } from "../../lib/dungeonData";
import {
  createTeamExpeditionBattleRoom,
  subscribeTeamExpeditionRoom,
  updateTeamExpeditionRoom,
  syncTeamExpeditionMembers,
  leaveTeamExpeditionRoom,
  cleanupTeamExpeditionRoom,
  claimTeamExpeditionResult,
} from "../../lib/expeditionTeamDb";
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

  // ── 樓層狀態 ──────────────────────────────────────────────
  const [phase, setPhase] = useState("loading"); // "loading" | "floor_intro" | "battle" | "result"
  const [floorIndex, setFloorIndex] = useState(0);
  const [floorMonsters, setFloorMonsters] = useState(null);  // 房主預先產生
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [floorsCleared, setFloorsCleared] = useState(0);
  const [wonLast, setWonLast] = useState(false);
  const [result, setResult] = useState(null);
  const [flowError, setFlowError] = useState("");
  const prevRoomIdRef = useRef(null);
  const floorStartingRef = useRef(false);

  // ── 房主：初始化三層怪物 ────────────────────────────────
  useEffect(() => {
    if (!isHost || !teamRoom || floorMonsters) return;
    const monsters = [];
    for (let i = 0; i < 3; i++) {
      monsters.push(drawFloorMonsters(i, dungeonDifficulty, {
        family: dungeonFamily,
        fixedBoss: dungeonBoss,
      }));
    }
    setFloorMonsters(monsters);
  }, [isHost, teamRoom, dungeonDifficulty, dungeonFamily, dungeonBoss]); // eslint-disable-line

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
    if (!teamRoom?.currentBattleRoomId) return;
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
    const expeditionResult = {
      won,
      floorsCleared: cleared,
      rewards,
      loot: loot || { chests: [], defeated: [] },
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

  // ── 房主：開始某一層 ─────────────────────────────────────
  const startFloor = useCallback(async (fi, memberOverride = null) => {
    if (!isHost || !floorMonsters || !teamRoom) return;

    const floorData = floorMonsters[fi];
    if (!floorData) {
      await publishResult(true, 3);
      return;
    }

    // 計算該層使用的怪物
    const monster = fi === 2
      ? (floorData.boss || floorData.elite || floorData.monsters[0])
      : (floorData.elite || floorData.monsters[0]);

    if (!monster) {
      // 沒有怪物資料 → 跳過或完成
      if (fi >= 2) {
        await publishResult(true, 3);
      } else {
        await startFloor(fi + 1, memberOverride);
      }
      return;
    }

    // 取得所有隊員資料
    const members = Object.entries(memberOverride || teamRoom.members || {})
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
      }));

    // 建立戰鬥房間
    if (floorStartingRef.current) return;
    floorStartingRef.current = true;
    setFlowError("");
    const res = await createTeamExpeditionBattleRoom({
      members,
      hostId: teamRoom.hostId,
      monster,
      difficultyTier: dungeonDifficulty,
      floorIndex: fi,
      roomType: fi === 2 ? "boss" : "monster",
      arrowsPerRound: teamRoom.arrowsPerRound || 6,
      targetFmt: teamRoom.targetFmt || "full_110",
    });

    if (res.ok) {
      setFloorIndex(fi);
      setPhase("floor_intro");
      // 寫入組隊房間，通知所有成員
      const updateResult = await updateTeamExpeditionRoom(teamRoomId, {
        currentBattleRoomId: res.roomId,
        expeditionFloorIndex: fi,
      });
      if (!updateResult.ok) {
        await cleanupExpeditionRoom(res.roomId).catch(() => {});
        setFlowError(`無法同步戰鬥房：${updateResult.reason}`);
        setPhase("loading");
        floorStartingRef.current = false;
        return;
      }
      // 下一輪 effect 會自動將 phase 設為 battle
      setCurrentRoomId(res.roomId);
      setPhase("battle");
    } else {
      setFlowError(`無法建立戰鬥房：${res.reason}`);
    }
    floorStartingRef.current = false;
  }, [isHost, floorMonsters, teamRoom, teamRoomId, dungeonDifficulty, profile, publishResult]);

  // ── 房主：開始第一層 ─────────────────────────────────────
  useEffect(() => {
    if (!isHost || !floorMonsters || currentRoomId || phase !== "loading") return;
    startFloor(0);
  }, [isHost, floorMonsters, currentRoomId, phase, startFloor]);

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

    // 勝利：前進下一層
    const nextFi = floorIndex + 1;
    const newCleared = Math.max(floorsCleared, floorIndex + 1);
    setFloorsCleared(newCleared);

    if (nextFi >= 3) {
      return await publishResult(
        true,
        3,
        syncResult.loot,
        syncResult.stats,
        nextMembers,
      );
    } else {
      await startFloor(nextFi, nextMembers);
      return true;
    }
  }, [isHost, myId, myName, dungeonDifficulty, floorIndex, floorsCleared, teamRoomId, teamRoom?.members, startFloor, publishResult]);

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
    }
    if (claim.ok && claim.allClaimed) {
      cleanupTeamExpeditionRoom(teamRoomId).catch(() => {});
    }

    onComplete?.();
    return true;
  }, [result, myId, dungeonDifficulty, floorsCleared, wonLast, dungeonFamily, dungeonIsHidden, isHost, teamRoomId, onComplete]);

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
