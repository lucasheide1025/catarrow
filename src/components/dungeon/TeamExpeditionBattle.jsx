// src/components/dungeon/TeamExpeditionBattle.jsx
// 組隊遠征戰鬥管理器 — 三層戰鬥流程 + DungeonBattleRoom 整合 + 獎勵結算

import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { MATERIAL_BY_ID as EXPANSION_MATERIAL_BY_ID } from "../../lib/monsterEconomyCatalog";
import { drawDungeonFloorMonsters, drawDungeonFallbackMonster } from "../../lib/dungeonExpansionMonsters";
import { bossRewardBlocksAdvance, isEligibleForBossReward } from "../../lib/bossRewardAdvance";
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
import { trySetDungeonFirstClear, addDungeonBroadcast, addCollectibles } from "../../lib/dungeonDb";
import { getExpeditionFirstClearTrophy } from "../../lib/dungeonCollectibles";
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
import { GridMapStage, BranchStage } from "./DungeonStages";
import KillLootToast from "./KillLootToast";

const DungeonBossRewardRoom = lazy(() => import("./DungeonBossRewardRoom"));

// 錯誤浮動橫幅：flowError 原本只在主 render 尾端顯示，但地圖/分支畫面會提早 return，
// 導致「點了沒反應、也看不到任何錯誤」。改成蓋在畫面上方，任何階段都看得到。
function FlowErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{ position:"fixed", left:12, right:12, top:12, zIndex:99, display:"flex", justifyContent:"center" }}>
      <div style={{ maxWidth:420, width:"100%", padding:"10px 14px", borderRadius:14,
        background:"rgba(69,10,10,.96)", border:"1.5px solid #f87171", boxShadow:"0 0 22px rgba(248,113,113,.35)" }}>
        <div style={{ fontSize:12, fontWeight:900, color:"#fecaca" }}>⚠️ {message}</div>
        <button type="button" onClick={onDismiss}
          style={{ marginTop:6, padding:"4px 10px", borderRadius:8, fontSize:11, fontWeight:700,
            background:"rgba(248,113,113,.18)", color:"#fecaca", border:"1px solid rgba(248,113,113,.4)", cursor:"pointer" }}>
          關閉
        </button>
      </div>
    </div>
  );
}

function attachGridMonsters(gridFloor, floorIndex, difficulty, plan, family) {
  const queue = [...(plan.monsters || [])];
  const fallbackVariant = floorIndex === 0 ? "weak" : "normal";
  return {
    ...gridFloor,
    rooms: gridFloor.rooms.map(room => {
      if (room.type === "elite_battle") {
        return { ...room, monster: plan.elite || drawDungeonFallbackMonster("strong", difficulty, { family }) };
      }
      if (room.type !== "battle") return room;
      return {
        ...room,
        monster: queue.shift() || drawDungeonFallbackMonster(fallbackVariant, difficulty, { family }),
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
  const plan = drawDungeonFloorMonsters(floorIndex, difficulty, { family, fixedBoss });
  if (floorIndex < 2) {
    const gridFloor = attachGridMonsters(
      generateGridFloor(floorIndex, difficulty),
      floorIndex,
      difficulty,
      plan,
      family,
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
          ? { ...room, monster: drawDungeonFallbackMonster("strong", difficulty, { family }) }
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
function TeamBattleRoom({ roomId, isHost, onDone, onAbandon, guestProfile, lootMult = 1 }) {
  const [loading, setLoading] = useState(true);
  const [battleDone, setBattleDone] = useState(false);
  const terminalHandledRef = useRef(false);
  const timerRef = useRef(null);
  const onDoneRef = useRef(onDone);
  const isHostRef = useRef(isHost);
  onDoneRef.current = onDone;
  isHostRef.current = isHost;
  // ── 每場擊殺即時入帳（使用者規格：打死立刻給,不等結算）────────
  const { profile: battleProfile } = useAuth();
  const [killReward, setKillReward] = useState(null);
  // 沿路擊殺的累計（單人遠征同規格）。以前這兩個數字只餵給 4.5 秒的 toast 就丟掉，
  // 結算頁因此只顯示通關獎勵，跟玩家實際入帳的金額對不上。
  const [killTotals, setKillTotals] = useState({ coins:0, archerXP:0, kills:0 });
  const battleMonsterRef = useRef(null);
  const killClaimedRef = useRef(false);
  const claimMyKillReward = useCallback(monster => {
    // 2026-07-18 使用者規格：地下城中途擊殺「不掉單怪素材」——
    // 改為 材料寶箱+金幣寶箱 必掉,數量 = 出圖時決定的 1~3 倍（teamRoom.lootMult）。
    // 王/小王不走此路（王房 envelope 不變）;素材取得回歸「難度=Tier」的王房與寶箱。
    if (!monster || guestProfile || killClaimedRef.current) return;
    if (monster.encounter && monster.encounter !== "normal") return;
    const memberId = battleProfile?.id;
    if (!memberId) return;
    const onceKey = `exp_kill_${roomId}_${memberId}`;
    if (sessionStorage.getItem(onceKey)) return; // 重連/重播防重複入帳
    killClaimedRef.current = true;
    sessionStorage.setItem(onceKey, "1");
    (async () => {
      const [{ makeChests }, { makeCoinChest }, dbMod, { rollDungeonKillReward }] = await Promise.all([
        import("../../lib/itemData"), import("../../lib/lootTable"), import("../../lib/db"), import("../../lib/dungeonKillRewards"),
      ]);
      const mult = Math.max(1, Math.min(3, Math.round(lootMult) || 1));
      const chests = [];
      for (let i = 0; i < mult; i++) {
        const { mainChest } = makeChests(monster, "student");
        if (mainChest) chests.push(mainChest);
        chests.push(makeCoinChest(monster.tier, "地下城掉落"));
      }
      await dbMod.addChests(memberId, chests);
      // 每殺金幣（Tier 級距×5）＋射手/貓 XP 即時入帳
      const kill = rollDungeonKillReward(monster);
      if (kill) {
        dbMod.addCoins(memberId, kill.coins).catch(() => {});
        dbMod.addArcherXP(memberId, kill.archerXP).catch(() => {});
        // 累計給結算頁：這些是「已入帳」的部分，結算頁只列出來，不再發一次
        setKillTotals(previous => ({
          coins: previous.coins + kill.coins,
          archerXP: previous.archerXP + kill.archerXP,
          kills: previous.kills + 1,
        }));
      }
      setKillReward({
        monsterName: monster.name,
        chests,                                   // 實際掉落的寶箱，交給 KillLootToast 逐項列出
        coins: kill?.coins || 0,
        archerXP: kill?.archerXP || 0,
        lootMult: mult,
      });
      setTimeout(() => setKillReward(null), 4500);
    })().catch(() => { killClaimedRef.current = false; sessionStorage.removeItem(onceKey); });
  }, [roomId, guestProfile, battleProfile?.id, lootMult]);

  useEffect(() => {
    if (!roomId) return;
    terminalHandledRef.current = false;
    killClaimedRef.current = false;
    setBattleDone(false);
    setLoading(false);
    const unsub = onSnapshot(doc(db, "dungeonRooms", roomId), (snap) => {
      if (!snap.exists()) {
        // 戰鬥房已被 host 清除（勝利結算後）。若本端還沒走到終局（快照時序落後）,
        // 就地標記完成 → 回遠征結果畫面領獎,而不是被彈出房間（使用者回報的「被踢」bug）。
        if (!terminalHandledRef.current) {
          terminalHandledRef.current = true;
          setBattleDone(true);
          claimMyKillReward(battleMonsterRef.current); // 落後端也要拿到本場擊殺獎勵
        }
        return;
      }
      const data = snap.data();
      if (data.monster) battleMonsterRef.current = data.monster;
      const finishBattle = (payload, delay) => {
        if (terminalHandledRef.current) return;
        terminalHandledRef.current = true;
        setBattleDone(true);
        if (payload.won) claimMyKillReward(data.monster || battleMonsterRef.current); // 每位隊員各自即時入帳
        if (!isHostRef.current) return;
        timerRef.current = setTimeout(async () => {
          const handled = await onDoneRef.current?.({
            ...payload,
            members: data.members || {},
            battle: { id:roomId, ...data },
          });
          if (handled !== false) {
            // 寬限 8 秒才刪戰鬥房：讓所有隊員先收到 completed+win 快照走完勝利轉場
            setTimeout(() => cleanupExpeditionRoom(roomId).catch(() => {}), 8000);
          }
        }, delay);
      };
      // 全滅 = 失敗
      if (data.status === "completed" && data.result === "lose") {
        finishBattle({ won: false }, 1500);
      }
      // The final expedition floor resolves through the shared battle room as
      // completed + win.  Treat it as terminal here; otherwise the battle
      // room remains mounted after the victory animation with no route to the
      // expedition reward screen.
      if (data.status === "completed" && data.result === "win") {
        finishBattle({ won: true }, 0);
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
    <>
      <DungeonBattleRoom
        key={roomId}
        roomId={roomId}
        isMapMode={true}
        expeditionMode={true}
        guestProfile={guestProfile}
        onReturnToMap={() => {}}
        onExit={onAbandon}
      />
      {/* 掉落倍率改顯示在樓層畫面的頂端狀態列（PlayerStatusBar），戰鬥中不再放浮動角標 */}
      {/* 🎁 每場擊殺即時入帳：直接列出掉了哪種寶箱、各幾個（與單人端共用同一元件） */}
      {killReward && <KillLootToast {...killReward} />}
    </>
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
  const myName = profile?.nickname || profile?.name || "射手";
  const isGuestMode = ["guest", "kid"].includes(profile?.accountType);

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
  const [bossRewardClaim, setBossRewardClaim] = useState(null);
  const [bossRewardLoading, setBossRewardLoading] = useState(false);
  const [bossRewardError, setBossRewardError] = useState("");
  const [bossChoiceComplete, setBossChoiceComplete] = useState(false);
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

  // ── 卡死保護（見 dungeon 穩定性任務）───────────────────────
  // 房主：房間/事件協調狀態卡住 20 秒 → 自動清除，讓房主能重新操作
  useEffect(() => {
    if (!isHost || !teamRoom?.activeRoomId) return;
    const t = setTimeout(() => {
      updateTeamExpeditionRoom(teamRoomId, {
        activeRoomId: null, roomConfirms: {}, roomChoices: {}, currentEvent: null,
      }).catch(() => {});
    }, 20000);
    return () => clearTimeout(t);
  }, [teamRoom?.activeRoomId, isHost, teamRoomId]);

  // 非房主：等待房主超過 20 秒沒有變化 → 顯示提示 + 安全返回大廳（不影響隊伍成員資格）
  const [showStuckHint, setShowStuckHint] = useState(false);
  useEffect(() => {
    setShowStuckHint(false);
    if (isHost) return;
    const t = setTimeout(() => setShowStuckHint(true), 20000);
    return () => clearTimeout(t);
  }, [teamRoom?.activeRoomId, teamRoom?.currentBattleRoomId, teamRoom?.expeditionMapState?.phase, isHost]);

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
      family: dungeonFamily,
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
      kingVault: treasureLoot?.kingVault || null,
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
    // 進入新樓層：清掉所有成員的樓層級 buffs（事件/商人增益只在該層有效，換樓歸零）。
    const buffReset = {};
    Object.keys(teamRoom.members || {}).forEach(id => {
      if (teamRoom.members[id]) buffReset[`members.${id}.buffs`] = { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: false, hasFrontRevival: false };
    });
    const saved = await updateTeamExpeditionRoom(teamRoomId, {
      ...buffReset,
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
        catType: m.catType || "",
        catXP: m.catXP ?? 0,
        catBond: m.catBond ?? 0,
        archerStyle: m.archerStyle || profile?.archerStyle || "baobao",
        catAtk: m.catAtk || 0,
        avatarId: m.avatarId || null,
        battleCosmetics: m.battleCosmetics || null,
        alive: m.alive !== false,
        role: m.role || "front",
        displayGroup: m.displayGroup || m.role || "front",
        // buffs＝樓層級（事件/商人）：繼承 teamRoom 成員的當層 buffs，同層多場戰鬥都帶著。
        buffs: m.buffs || { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: false, hasFrontRevival: false },
        // potionBuffs＝戰鬥級（藥水）：每場都乾淨，打完該場就歸零（不會被 sync 帶回 teamRoom）。
        potionBuffs: { atkMult: 1, defMult: 1, dmgMult: 1 },
        wbBonus: m.wbBonus || null,
      }));

    floorStartingRef.current = true;
    setFlowError("");
    try {
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
        return;
      }
      setCurrentRoomId(res.roomId);
      setPhase("battle");
    } else {
      setFlowError(`無法建立戰鬥房：${res.reason}`);
    }
    } catch (error) {
      // 例外若沒被接住，下面的 finally 仍會解鎖；但一定要讓錯誤現形，
      // 否則使用者只會看到「點開始戰鬥沒反應」而無從得知原因。
      console.error("[startRoomBattle]", error);
      setFlowError(`開始戰鬥失敗：${error?.message || error}`);
    } finally {
      // 這個旗標若卡在 true，之後所有房間點擊都會靜默失效（無錯誤、無反應）。
      // 因此無論成功、失敗或丟例外都必須解鎖。
      floorStartingRef.current = false;
    }
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
      ...(pendingRoom?.type === "boss_battle" && battle?.monster?.expansionVersion === 1 ? {
        bossRewardBattleId:battle.id,
        bossRewardMonsterId:battle.monster.id,
        bossRewardEligibleMemberIds:Object.entries(battleMembers || {})
          .filter(([, member]) => (Number(member?.validRounds) || 0) > 0)
          .map(([memberId]) => memberId),
        bossRewardChoiceClaims:{},
      } : {}),
    });
    if (!saved.ok) {
      setFlowError(`無法返回探索地圖：${saved.reason}`);
      return false;
    }
    return true;
  }, [isHost, myName, dungeonDifficulty, dungeonFamily, dungeonBoss, floorIndex, teamRoomId, teamRoom, startFloor, publishResult]);

  const enterExplorationRoom = useCallback(async (room, positionedState) => {
    if (!isHost || !room) return;
    // ⚠️ cleared/樓梯/入口 的判斷必須在「戰鬥房」判斷之前：已清除的怪物/菁英/BOSS 房再踩，
    // 只移動位置、不可重新觸發戰鬥（原本順序相反，導致已清房回頭踩會再打一次）。
    if (room.cleared || room.type === "stairs" || room.type === "entrance") {
      await updateTeamExpeditionRoom(teamRoomId, { expeditionMapState: stripMapStateGrid(positionedState) });
      return;
    }
    if (["battle", "elite_battle", "boss_battle"].includes(room.type)) {
      await startRoomBattle(room, positionedState);
      return;
    }
    const preparedRoom = { ...room };
    const sharedRoomFields = {
      activeRoomId: room.id,
      mapDungeonId: `${dungeonFamily}_expedition`,
      roomConfirms: {},
      roomChoices: {},
      // Event results are display-only state.  Carrying an old result into
      // the next map room makes events such as cursed_fog render as already
      // resolved and prevents their confirmation flow from running.
      roomResolution: null,
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
      roomResolution: null,
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
      if (!isGuestMode && wonLast) {
          const expeditionKey = `${dungeonFamily}_${["normal", "advanced", "hard", "hell"][dungeonDifficulty - 1]}`;
        const teamNames = Object.values(teamRoom?.members || {})
          .filter(Boolean).map(m => m.name).filter(Boolean);
        try {
          const fcResult = await trySetDungeonFirstClear(expeditionKey, myId, myName, teamNames);
          if (fcResult.isFirst) {
            const trophy = getExpeditionFirstClearTrophy(dungeonFamily, dungeonDifficulty);
            if (trophy) await addCollectibles(myId, [trophy]);
            const diff = getExcavationDifficulty(dungeonDifficulty);
            const FAMILY_MAP = { ghost:{e:"👻",l:"幽冥系"}, mountain:{e:"⛰️",l:"山嶺系"}, insect:{e:"🦋",l:"昆蟲系"}, workplace:{e:"💼",l:"職場系"}, exam:{e:"📝",l:"考試系"}, temple:{e:"🏛️",l:"神廟系"}, treasure:{e:"📦",l:"寶箱族"} };
            const f = FAMILY_MAP[dungeonFamily] || {e:"🏰",l:"遠征"};
            addDungeonBroadcast(expeditionKey, `遠征-${f.l}`, diff?.label || `Lv.${dungeonDifficulty}`, f.e, teamNames, myName).catch(() => {});
          }
        } catch (_) {}
      }

      onComplete?.();
      return true;
    }, [result, myId, dungeonDifficulty, floorsCleared, wonLast, dungeonFamily, dungeonIsHidden, isHost, teamRoomId, myName, onComplete, isGuestMode]);

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

  const prepareMyBossReward = useCallback(async () => {
    if (bossRewardLoading || !teamRoom?.bossRewardBattleId || !teamRoom?.bossRewardMonsterId) return;
    // 防禦性 validRounds gate：未達本場有效回合者不可領取（render 端已擋,這裡再保險一層）
    if (!isEligibleForBossReward({ eligibleMemberIds: teamRoom.bossRewardEligibleMemberIds, memberId: myId })) {
      setBossRewardError("未達本場有效回合，無法領取王房獎勵");
      return;
    }
    setBossRewardLoading(true);
    setBossRewardError("");
    try {
      const { createDungeonBossRewardClaim } = await import("../../lib/dungeonBossRewardDb");
      const claim = await createDungeonBossRewardClaim({
        battleId:teamRoom.bossRewardBattleId,
        memberId:myId,
        monsterId:teamRoom.bossRewardMonsterId,
      });
      setBossRewardClaim(claim);
    } catch (error) {
      setBossRewardError(error?.message || "無法同步個人王房獎勵");
    } finally {
      setBossRewardLoading(false);
    }
  }, [bossRewardLoading, teamRoom?.bossRewardBattleId, teamRoom?.bossRewardMonsterId, myId]);

  const completeMyBossChoices = useCallback(async () => {
    setBossChoiceComplete(true);
    const result = await updateTeamExpeditionRoom(teamRoomId, {
      [`bossRewardChoiceClaims.${myId}`]:true,
    });
    if (!result.ok) {
      setBossChoiceComplete(false);
      setBossRewardError(result.reason || "無法同步領取狀態");
    }
  }, [teamRoomId, myId]);

  // ── 輔助：組隊房間載入中 ────────────────────────────────
  if (!teamRoom) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-white/40 bg-[#0a0a0f]">
        載入遠征資料…
      </div>
    );
  }

  // ── 卡死保護：非房主等待逾時，提供安全退出（不影響隊伍成員資格）──
  if (showStuckHint && phase !== "result" && !currentRoomId) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#0a0a0f] text-white">
        <div className="text-4xl" aria-hidden="true">⏳</div>
        <div className="text-sm text-white/70 leading-6">
          等待房主動作中，若長時間沒反應可能是連線問題。<br />可以先暫時返回大廳，稍後再回來繼續。
        </div>
        <button onClick={() => onComplete?.()}
          className="min-h-11 rounded-xl bg-white/10 border border-white/15 px-5 py-2.5 text-sm font-bold text-white/80"
          style={{ touchAction:"manipulation" }}>
          暫時返回大廳
        </button>
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
        killTotals={killTotals}
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
      <>
        <GridMapStage
          gridFloor={mapState.gridFloor}
          playerPos={mapState.playerPos}
          visitedIds={new Set(mapState.visitedIds || [])}
          floorIndex={floorIndex}
          playerState={playerState}
          coins={profile?.coins || 0}
          lootMult={teamRoom?.lootMult || 1}
          onCellClick={handleCellClick}
          onDescend={handleDescend}
          onRetreat={handleAbandon}
          canControl={isHost}
        />
        <FlowErrorBanner message={flowError} onDismiss={() => setFlowError("")} />
      </>
    );
  }

  if (mapState?.phase === "branch" && mapState.branchFloor) {
    return (
      <>
        <BranchStage
          branchFloor={mapState.branchFloor}
          branchChoice={mapState.branchChoice}
          branchSeq={branchSeq}
          branchStep={mapState.branchStep || 0}
          playerState={playerState}
          coins={profile?.coins || 0}
          lootMult={teamRoom?.lootMult || 1}
          onChoose={handleChooseBranch}
          onEnterNext={handleBranchNext}
          onRetreat={handleAbandon}
          canControl={isHost}
        />
        <FlowErrorBanner message={flowError} onDismiss={() => setFlowError("")} />
      </>
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
    const eligibleIds = teamRoom.bossRewardEligibleMemberIds || [];
    const expansionRewardActive = Boolean(teamRoom.bossRewardBattleId && teamRoom.bossRewardMonsterId);
    if (expansionRewardActive) {
      const eligible = eligibleIds.includes(myId);
      const claimedByMe = bossChoiceComplete || teamRoom.bossRewardChoiceClaims?.[myId] === true;
      // 「是否可前進」抽成純函式（bossRewardAdvance）；含本機樂觀已領狀態。
      // 用 blocksAdvance：等所有合格隊員完成,但空名單(0 合格,理論罕見)不卡死。
      const effectiveClaims = { ...(teamRoom.bossRewardChoiceClaims || {}), ...(bossChoiceComplete ? { [myId]: true } : {}) };
      const allClaimed = !bossRewardBlocksAdvance({ eligibleMemberIds: eligibleIds, choiceClaims: effectiveClaims });
      if (!eligible) {
        return (
          <div className="min-h-[100dvh] bg-slate-950 px-6 text-white flex items-center justify-center text-center">
            <div className="max-w-sm"><div className="text-4xl">🛡️</div><h1 className="mt-3 text-xl font-black">本次未達領獎資格</h1><p className="mt-2 text-sm leading-6 text-slate-400">需在 BOSS 戰開始前加入，並至少完成一個有效射箭回合。</p></div>
          </div>
        );
      }
      if (claimedByMe) {
        return (
          <div className="min-h-[100dvh] bg-slate-950 px-6 text-white flex items-center justify-center text-center">
            <div className="w-full max-w-sm rounded-3xl border border-cyan-400/20 bg-slate-900 p-6">
              <div className="text-4xl">✅</div><h1 className="mt-3 text-xl font-black">個人戰利品已領取</h1>
              <p className="mt-2 text-sm text-slate-400">{allClaimed ? "全隊已完成選擇，可以前往遠征報告。" : "等待其他合格隊員完成選擇；斷線隊員可重連後繼續。"}</p>
              {isHost && allClaimed ? <button type="button" className="mt-5 min-h-12 w-full rounded-2xl bg-amber-300 font-black text-slate-950" onClick={() => publishResult(true, 3, teamRoom.expeditionLoot, teamRoom.expeditionStats, teamRoom.members)}>帶領隊伍查看遠征報告</button> : null}
            </div>
          </div>
        );
      }
      if (bossRewardClaim?.envelope) {
        return (
          <Suspense fallback={<div className="min-h-[100dvh] bg-slate-950 text-slate-400 flex items-center justify-center">正在整理個人戰利品…</div>}>
            <DungeonBossRewardRoom claimId={bossRewardClaim.claimId} envelope={bossRewardClaim.envelope} memberId={myId} onComplete={completeMyBossChoices} />
          </Suspense>
        );
      }
      return (
        <div className="min-h-[100dvh] bg-slate-950 px-6 text-white flex items-center justify-center text-center">
          <div className="w-full max-w-sm rounded-3xl border border-amber-400/20 bg-slate-900 p-6">
            <div className="text-4xl">🏆</div><h1 className="mt-3 text-xl font-black">個人王房獎勵</h1><p className="mt-2 text-sm leading-6 text-slate-400">每位合格隊員都有自己的固定獎勵與選箱，不會被隊長代領。</p>
            {bossRewardError ? <div role="alert" className="mt-3 text-sm text-rose-300">{bossRewardError}</div> : null}
            <button type="button" disabled={bossRewardLoading} onClick={prepareMyBossReward} className="mt-5 min-h-12 w-full rounded-2xl bg-amber-300 font-black text-slate-950 disabled:opacity-50">{bossRewardLoading ? "正在同步…" : "開啟我的戰利品"}</button>
          </div>
        </div>
      );
    }
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
        guestProfile={isGuestMode ? profile : undefined}
        lootMult={teamRoom?.lootMult || 1}
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
