// src/components/dungeon/TeamExpeditionBattle.jsx
// 組隊遠征戰鬥管理器 — 三層戰鬥流程 + DungeonBattleRoom 整合 + 獎勵結算

import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { addCoins, addPotions, addMaterials, addArrowdew, addDungeonClear } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { MATERIAL_BY_ID as EXPANSION_MATERIAL_BY_ID } from "../../lib/monsterEconomyCatalog";
import { drawDungeonFloorMonsters, drawDungeonFallbackMonster } from "../../lib/dungeonExpansionMonsters";
import { bossRewardBlocksAdvance, isEligibleForBossReward } from "../../lib/bossRewardAdvance";
import {
  drawDungeonEvent,
  getExcavationDifficulty,
} from "../../lib/dungeonData";
import {
  generateGridFloor,
  generateBranchFloor,
  isAdjacent,
} from "../../lib/expeditionGrid";
import { stripExpeditionMapStateForSync } from "../../lib/expeditionMapState";
import {
  createTeamExpeditionBattleRoom,
  subscribeTeamExpeditionRoom,
  updateTeamExpeditionRoom,
  syncTeamExpeditionMembers,
  leaveTeamExpeditionRoom,
  cleanupTeamExpeditionRoom,
  claimTeamExpeditionResult,
  saveTeamExpeditionProgress,
} from "../../lib/expeditionTeamDb";
import { trySetDungeonWorldFirstClear, claimDungeonPersonalFirstClear, addDungeonBroadcast } from "../../lib/dungeonDb";
import { drawDungeonMerchantType } from "../../lib/dungeonMerchant";
import { createOrdinaryChestChoices } from "../../lib/dungeonChestLoot";
import { buildTeamEventResolution } from "../../lib/dungeonEventResolution";
import { shouldAutoAdvanceTeamFunctionRoom, isTeamRoomReadyToAdvance } from "../../lib/dungeonTeamRoomFlow";
import { isInlineRoom, resolveInlineRoom } from "../../lib/dungeonInlineRooms";
import { tallyEventVotes } from "../../lib/dungeonEventVotes";
import { sfxOpen, sfxOpenChest, sfxTap, sfxCoinDrop, sfxBuff, sfxDebuff } from "../../lib/sound";
import { preloadDungeonUiAssets } from "../../lib/dungeonAssetCache";
import {
  cleanupExpeditionRoom,
  broadcastExpeditionFailure,
  calculateExpeditionRewards,
} from "../../lib/expeditionDb";
import {
  buildExpeditionParty,
  collectBattleStats,
  collectBattleArrows,
  createExpeditionKillLoot,
  normalizeExpeditionLootMultiplier,
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
import DungeonKillResult from "./DungeonKillResult";

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

function TeamRoomVotingBar({ teamRoom, myId, isHost, onSaveProgress, onForceAdvance }) {
  if (!teamRoom || !teamRoom.members) return null;

  const members = Object.entries(teamRoom.members || {}).filter(([, m]) => m && m.alive !== false);
  const confirms = teamRoom.roomConfirms || {};
  const confirmedCount = members.filter(([id]) => confirms[id] === true).length;
  const totalCount = members.length;

  return (
    <div className="bg-slate-950/90 border-b border-amber-500/30 px-4 py-2.5 backdrop-blur-md sticky top-0 z-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shadow-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 font-black text-amber-300">
          <span>👥</span> 全員選擇進度：
          <span className="font-mono text-emerald-400 font-black text-sm">
            {confirmedCount} / {totalCount}
          </span> 人
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {members.map(([id, m]) => {
            const isDone = confirms[id] === true;
            const isMe = id === myId;
            return (
              <span
                key={id}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 ${
                  isDone
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse"
                }`}
              >
                {m.name || "隊友"}{isMe ? "(你)" : ""}
                <span>{isDone ? "✓ 已選" : "…選擇中"}</span>
              </span>
            );
          })}
        </div>
      </div>

      {isHost && onForceAdvance && (
        <div className="flex items-center gap-2 shrink-0">
          {onSaveProgress && (
            <button
              type="button"
              onClick={onSaveProgress}
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-xl text-xs hover:brightness-110 shadow-lg active:scale-95 transition-all"
            >
              💾 保存進度並解散
            </button>
          )}
          <button
            type="button"
            onClick={onForceAdvance}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black rounded-xl text-xs hover:brightness-110 shadow-lg active:scale-95 transition-all"
          >
            ⚡ 房主強制結算前進
          </button>
        </div>
      )}
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
        // ★ 每間精英房各自抽一隻。原本全層共用同一個 plan.elite 物件 ——
        //   第 3 層三條支線各最多 3 間精英房，結果整趟只會看到同一隻怪，
        //   擴充清冊每族每階明明有 3 隻可抽（作者回報「碰不到其他新增的怪物」）。
        return { ...room, monster: drawDungeonFallbackMonster("strong", difficulty, { family }) || plan.elite };
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
  return stripExpeditionMapStateForSync(state);
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
        // 同上：三條支線每間精英房都各自抽，不共用 plan.elite
        rooms: branch.rooms.map(room => room.type === "elite_battle"
          ? { ...room, monster: drawDungeonFallbackMonster("strong", difficulty, { family }) || plan.elite }
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
function TeamBattleRoom({ roomId, isHost, onDone, onAbandon, guestProfile, cardCollection, lootMult = 1, onArrowsCollected, onKillRewardCollected }) {
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
  // 勝利後停留的單場結算畫面；advanceRef 存房主的「推進到下一房」動作，按下一步才執行
  const [killResultView, setKillResultView] = useState(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState("");
  const advanceRef = useRef(null);
  const battleMonsterRef = useRef(null);
  const killClaimedRef = useRef(false);
  const claimMyKillReward = useCallback(monster => {
    // 2026-07-18 使用者規格：地下城中途擊殺「不掉單怪素材」——
    // 改為 材料寶箱+金幣寶箱 必掉,數量 = 出圖時決定的 2～5 倍（teamRoom.lootMult）。
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
      const mult = normalizeExpeditionLootMultiplier(lootMult);
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
        // 累計給結算頁：這些是「已入帳」的部分，結算頁只列出來，不再發一次。
        // ⚠️ 必須往上報給 TeamExpeditionBattle —— 結算頁在那一層 render，
        //    累計狀態放在這個子元件裡它讀不到（曾經因此跨 scope 引用而爆 ReferenceError）。
        onKillRewardCollected?.({ coins: kill.coins, archerXP: kill.archerXP });
      }
      let droppedCard=null;
      if(monster.expansionVersion===1){
        const {claimDungeonNormalCard}=await import("../../lib/dungeonBossRewardDb");
        const cardClaim=await claimDungeonNormalCard({battleId:roomId,memberId,monsterId:monster.id});
        droppedCard=cardClaim?.card||null;
      }
      // ⚠️ 不要自動清空：這筆現在是 DungeonKillResult 的資料來源（以前只餵 4.5 秒的
      // 浮動提示才需要自動收）。清早了，結算畫面上的寶箱與金幣會憑空消失。
      setKillReward({
        monsterName: monster.name,
        chests,
        coins: kill?.coins || 0,
        archerXP: kill?.archerXP || 0,
        card: droppedCard,
        lootMult: mult,
      });
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
        claimMyKillReward(battleMonsterRef.current);
        return;
      }
      const data = snap.data();
      if (data.monster) battleMonsterRef.current = data.monster;
      const finishBattle = (payload, delay) => {
        if (terminalHandledRef.current) return;
        terminalHandledRef.current = true;
        setBattleDone(true);
        const preserveForBossReward = payload.won && (
          data.roomType === "boss" || (data.monster || battleMonsterRef.current)?.encounter === "boss"
        );
        if (payload.won) claimMyKillReward(data.monster || battleMonsterRef.current); // 每位隊員各自即時入帳

        const advance = async () => {
          const handled = await onDoneRef.current?.({
            ...payload,
            members: data.members || {},
            battle: { id:roomId, ...data },
          });
          if (handled !== false && !preserveForBossReward) {
            // 寬限 8 秒才刪戰鬥房：讓所有隊員先收到 completed+win 快照走完勝利轉場
            setTimeout(() => cleanupExpeditionRoom(roomId).catch(() => {}), 8000);
          }
          return handled;
        };

        // 勝利：全員先停在單場結算畫面（使用者規格）。房主按「下一步」才推進，
        // 隊員端會因為房主推進後的房間快照變化而自動離開，不必各自按。
        // 失敗維持原本的自動流程 —— 失敗畫面有自己的轉場，硬塞結算頁只會擋路。
        if (payload.won) {
          const myArrows = collectBattleArrows(data.log)[battleProfile?.id] || [];
          if (myArrows.length) onArrowsCollected?.(myArrows);
          const killedMonster = data.monster || battleMonsterRef.current;
          setKillResultView({
            monster: killedMonster,
            members: data.members || {},
            log: data.log || [],
            targetFmt: data.targetFmt || "full_110",
            // 王／小王：走金色主題，按鈕導向個人戰利品領取。
            // 王的掉落明細由 DungeonBossRewardRoom 呈現（envelope 此刻還沒 claim，
            // 這裡拿不到內容），所以這頁只給戰鬥數據、命中分析與評價。
            isBoss: ["miniBoss", "boss"].includes(killedMonster?.encounter),
          });
          if (isHostRef.current) advanceRef.current = advance;
          return;
        }
        if (!isHostRef.current) return;
        timerRef.current = setTimeout(advance, delay);
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

  if (killResultView) {
    const myId = battleProfile?.id;
    const stats = collectBattleStats(killResultView.log);
    const arrowsByMember = collectBattleArrows(killResultView.log);
    const memberEntry = id => killResultView.members?.[id] || {};
    const toEntry = id => ({
      id,
      name: memberEntry(id).name || "隊友",
      arrows: arrowsByMember[id] || [],
      dmgDealt: stats[id]?.dmgDealt || 0,
      dmgTaken: stats[id]?.dmgTaken || 0,
      crits: stats[id]?.crits || 0,
    });
    const allyIds = Object.keys(killResultView.members || {}).filter(id => id !== myId);
    return (
      <DungeonKillResult
        monster={killResultView.monster}
        self={{ ...toEntry(myId), name: memberEntry(myId).name || "我" }}
        allies={allyIds.map(toEntry)}
        chests={killReward?.chests || []}
        coins={killReward?.coins || 0}
        archerXP={killReward?.archerXP || 0}
        card={killReward?.card || null}
        lootMult={lootMult}
        targetFmt={killResultView.targetFmt || "full_110"}
        isBoss={killResultView.isBoss}
        continueLabel={killResultView.isBoss ? "前往戰利品房 →" : "下一步"}
        // 王房每位隊員各自領取自己的戰利品，不必等房主，所以王關人人都能按下一步
        canContinue={isHost && !advancing}
        waitingLabel={advancing ? "同步隊伍進度…" : (advanceError || "等待房主繼續…")}
        onContinue={async () => {
          const advance = advanceRef.current;
          if (!advance || advancing) return;
          setAdvancing(true);
          setAdvanceError("");
          try {
            const handled = await advance();
            if (handled === false) {
              setAdvanceError("隊伍進度同步失敗，請再試一次。");
              return;
            }
            advanceRef.current = null;
            setKillResultView(null);
            setKillReward(null);
          } catch (error) {
            setAdvanceError(error?.message || "隊伍進度同步失敗，請再試一次。");
          } finally {
            setAdvancing(false);
          }
        }}
      />
    );
  }

  if (battleDone) {
    return (
      <div className="h-[100dvh] flex items-center justify-center text-white/40 bg-[#0a0a0f]">
        結算中…
      </div>
    );
  }

  // 擊殺掉落不再用 4.5 秒浮動提示，改由 DungeonKillResult 完整列出（與單人端一致）
  return (
    <DungeonBattleRoom
      key={roomId}
      roomId={roomId}
      isMapMode={true}
      expeditionMode={true}
      guestProfile={guestProfile}
      cardCollection={cardCollection}
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
  cardCollection,
}) {
  useEffect(() => {
    preloadDungeonUiAssets();
  }, []);
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
  // 整場遠征累積的箭（本端玩家自己的），供最終結算的射箭表現分析
  const [runArrows, setRunArrows] = useState([]);
  // 沿路擊殺的累計（戰鬥當下已入帳，結算頁只是列出來）
  const [killTotals, setKillTotals] = useState({ coins:0, archerXP:0, kills:0 });
  const [bossRewardClaim, setBossRewardClaim] = useState(null);
  const [bossRewardLoading, setBossRewardLoading] = useState(false);
  const [bossRewardError, setBossRewardError] = useState("");
  const [bossChoiceComplete, setBossChoiceComplete] = useState(false);
  const [inlineToast, setInlineToast] = useState(null);
  // 事件投票結算的在途鎖：全員投完的瞬間可能連續收到多個快照，
  // 防止 resolveTeamEvent 被重複觸發（隨機事件 roll 兩次、金幣/道具重複入帳）
  const eventResolvingRef = useRef(false);
  // 輕量房在途鎖（記錄正在結算的 room.id）：Firestore 寫入是 async，
  // 連點同一格會在 cleared 同步回來之前觸發第二次 resolve → 重複發錢/能力
  const inlineResolvingRef = useRef(null);
  const prevRoomIdRef = useRef(null);
  const floorStartingRef = useRef(false);

  useEffect(() => {
    if (teamRoom?.roomResolution?.kind === "team_event") eventResolvingRef.current = false;
  }, [teamRoom?.roomResolution]);

  // ── 組隊輕量房浮動反饋：訂閱 roomResolution.kind === "inline_room"（房主與隊員同路）──
  useEffect(() => {
    const res = teamRoom?.roomResolution;
    if (!res || res.kind !== "inline_room" || !res.toast) return;
    // 音效依房型分流（與單人端 resolveInlineStep 同規格）
    if (res.roomType === "mini_chest") sfxOpenChest();
    else if (res.roomType === "scout") sfxOpen();
    else if (res.roomType === "empty") sfxTap();
    else if (res.roomType === "coin_pouch") sfxCoinDrop();
    else if (res.roomType === "quick_event") {
      const eff = res.effect || {};
      const isBuff = [eff.hp, eff.atk, eff.def, eff.dmg, eff.gold].some(v => Number(v) > 0)
        || Number(eff.monsterHp) < 0 || Number(eff.monsterAtk) < 0;
      if (isBuff) sfxBuff(); else sfxDebuff();
    }
    setInlineToast({
      key: res.timestamp ?? Date.now(),
      roomType: res.roomType,
      icon: res.toast.icon,
      title: res.toast.title,
      badges: res.toast.badges || [],
    });
  }, [teamRoom?.roomResolution]);

  useEffect(() => {
    if (!inlineToast) return;
    const t = setTimeout(() => setInlineToast(null), 2000);
    return () => clearTimeout(t);
  }, [inlineToast]);

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

  // 閱讀事件與開箱動畫期間不得用計時器清除共享房間；只顯示連線提示。
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
      nextFloorModifiers: {},
      expeditionMapState: stripMapStateGrid(expeditionMapState),
      expeditionFloorIndex: fi,
      currentBattleRoomId: null,
    });
    if (!saved.ok) setFlowError(`無法建立探索地圖：${saved.reason}`);
  }, [isHost, teamRoom, dungeonDifficulty, dungeonFamily, dungeonBoss, teamRoomId]);

  const handleSaveProgress = useCallback(async () => {
    if (!isHost || !teamRoomId) return;
    if (!window.confirm(`確定要【保存當前進度 (第 ${floorIndex + 1} 層)】並解散隊伍嗎？\n解散後您可以重新創建房間並邀請夥伴繼續推進！`)) return;

    const res = await saveTeamExpeditionProgress(teamRoomId, myId, floorIndex);
    if (res.ok) {
      alert("✅ 進度已成功保存！隊伍已解散。您可以在地下城大廳繼續此進度。");
      onAbandon?.();
    } else {
      setFlowError(`保存失敗：${res.reason}`);
    }
  }, [isHost, teamRoomId, myId, floorIndex, onAbandon]);

  const handleForceAdvance = useCallback(async () => {
    if (!isHost || !teamRoomId) return;
    await updateTeamExpeditionRoom(teamRoomId, {
      activeRoomId: null,
      roomConfirms: {},
      roomChoices: {},
      restResults: {},
      chestChoices: null,
      chestEggType: null,
      merchantRoomPurchases: {},
      currentEvent: null,
    }).catch(() => {});
  }, [isHost, teamRoomId]);

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
        restBonuses: m.restBonuses || { atkPct:0, defPct:0 },
        merchantBonuses: m.merchantBonuses || { atkPct:0, defPct:0 },
        // potionBuffs＝戰鬥級（藥水）：每場都乾淨，打完該場就歸零（不會被 sync 帶回 teamRoom）。
        potionBuffs: { atkMult: 1, defMult: 1, dmgMult: 1 },
        wbBonus: m.wbBonus || null,
      }));

    floorStartingRef.current = true;
    setFlowError("");

    try {
    const monsterModifiers = teamRoom.nextFloorModifiers || {};
    const battleMonster = {
      ...room.monster,
      hp:Math.round((room.monster?.hp || 100) * (monsterModifiers.monsterHpMult || 1)),
      maxHP:Math.round((room.monster?.maxHP || room.monster?.hp || 100) * (monsterModifiers.monsterHpMult || 1)),
      atk:Math.round((room.monster?.atk || 10) * (monsterModifiers.monsterAtkMult || 1)),
    };
    const res = await createTeamExpeditionBattleRoom({
      members,
      hostId: teamRoom.hostId,
      monster: battleMonster,
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

    const mapState = teamRoom?.expeditionMapState;
    const battleSummary = {
      stats: collectBattleStats(battle?.log),
      loot: won ? createExpeditionKillLoot(battle?.monster, teamRoom?.lootMult, {
        roomType: mapState?.pendingRoom?.type === "boss_battle" ? "boss"
          : mapState?.pendingRoom?.type === "elite_battle" ? "elite" : "monster",
      }) : null,
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
      ...(pendingRoom?.type === "boss_battle" && battle?.id ? {
        finalBossBattleRoomId:battle.id,
      } : {}),
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

  // ── 組隊輕量房：房主本地結算 → 寫 roomResolution + members updates ──
  // 與事件房同一條線：hp/atk/def/dmg/monsterHp/monsterAtk 走 buildTeamEventResolution；
  // gold / item / arrowDew / material 比照 resolveTeamEvent 用 addCoins/addPotions 迴圈
  // （排除 guest/kid）。地圖保持 phase:"grid"，不清 pendingRoom，不進 func_room。
  const resolveTeamInlineRoom = useCallback(async (room, positionedState) => {
    // ⚠️ 已清除的輕量房不能再結算：踩回去只會移動，不重複發錢/能力
    if (!isHost || !room || room.cleared) return;
    const res = resolveInlineRoom(room, { family: dungeonFamily, difficultyTier: dungeonDifficulty });
    const resolution = buildTeamEventResolution({
      event: { id: `inline_${res.roomType}`, title: res.toast.title, effect: res.effect },
      members: teamRoom?.members || {},
    });

    // 瞭望點：半徑 2 內房間加進 visitedIds（顯示為「已探索」但未清除，不會跳格移動）
    let visitedIds = positionedState.visitedIds || [];
    if (res.revealRadius > 0 && positionedState.gridFloor) {
      const extra = positionedState.gridFloor.rooms
        .filter(r => Math.abs(r.pos.x - room.pos.x) + Math.abs(r.pos.y - room.pos.y) <= res.revealRadius)
        .map(r => r.id);
      visitedIds = [...new Set([...visitedIds, ...extra])];
    }

    const nextMapState = {
      ...positionedState,
      visitedIds,
      phase: "grid",
      pendingRoom: null,
      gridFloor: positionedState.gridFloor ? {
        ...positionedState.gridFloor,
        rooms: positionedState.gridFloor.rooms.map(r =>
          r.id === room.id ? { ...r, cleared: true } : r
        ),
      } : positionedState.gridFloor,
    };
    const saved = await updateTeamExpeditionRoom(teamRoomId, {
      ...resolution.updates,
      roomResolution: {
        kind: "inline_room",
        roomType: res.roomType,
        toast: res.toast,
        effect: res.effect,
        timestamp: Date.now(),
      },
      expeditionMapState: stripMapStateGrid(nextMapState),
    });
    if (!saved.ok) {
      setFlowError(`輕量房效果無法套用：${saved.reason}`);
      return;
    }

    // gold / item / arrowDew / material 是 buildTeamEventResolution 不處理的鍵
    const memberEntries = Object.entries(teamRoom?.members || {})
      .filter(([, member]) => member && member.alive !== false && !["guest", "kid"].includes(member.accountType))
      .map(([id]) => id);
    if (res.effect?.gold) {
      await Promise.all(memberEntries.map(id => addCoins(id, res.effect.gold).catch(() => {})));
    }
    if (res.effect?.item) {
      await Promise.all(memberEntries.map(id => addPotions(id, [{ id: res.effect.item, count: 1 }]).catch(() => {})));
    }
    if (res.effect?.arrowDew) {
      await Promise.all(memberEntries.map(id => addArrowdew(id, res.effect.arrowDew).catch(() => {})));
    }
    if (res.effect?.material) {
      const mat = res.effect.material;
      await Promise.all(memberEntries.map(id =>
        addMaterials(id, Array.from({ length: mat.quantity || 1 }, () => mat)).catch(() => {})
      ));
    }
  }, [isHost, dungeonFamily, dungeonDifficulty, teamRoom?.members, teamRoomId]);

  const enterExplorationRoom = useCallback(async (room, positionedState) => {
    if (!isHost || !room) return;
    // ⚠️ cleared/樓梯/入口 的判斷必須在「戰鬥房」判斷之前：已清除的怪物/菁英/BOSS 房再踩，
    // 只移動位置、不可重新觸發戰鬥（原本順序相反，導致已清房回頭踩會再打一次）。
    if (room.cleared || room.type === "stairs" || room.type === "entrance") {
      await updateTeamExpeditionRoom(teamRoomId, { expeditionMapState: stripMapStateGrid(positionedState) });
      return;
    }
    // 輕量房（含舊存檔的 general_event）：不進全螢幕，原地結算（已清除的不重複結算）
    if (isInlineRoom(room.type)) {
      if (!room.cleared) await resolveTeamInlineRoom(room, positionedState);
      else await updateTeamExpeditionRoom(teamRoomId, { expeditionMapState: stripMapStateGrid(positionedState) });
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
      chestChoices: null,
      chestEggType: null,
      // Event results are display-only state.  Carrying an old result into
      // the next map room makes events such as cursed_fog render as already
      // resolved and prevents their confirmation flow from running.
      roomResolution: null,
    };
    if (room.type === "shop") {
      preparedRoom.shopType = drawDungeonMerchantType();
      sharedRoomFields.shopType = preparedRoom.shopType;
    }
    if (room.type === "event") {
      preparedRoom.event = drawDungeonEvent("special");
      sharedRoomFields.currentEvent = preparedRoom.event;
    }
    if (room.type === "chest") {
      preparedRoom.chestEggType = "normal";
      preparedRoom.chestChoices = createOrdinaryChestChoices({
        family:dungeonFamily,
        difficultyTier:dungeonDifficulty,
        hidden:dungeonIsHidden,
      });
      sharedRoomFields.chestEggType = preparedRoom.chestEggType;
      sharedRoomFields.chestChoices = preparedRoom.chestChoices;
      sharedRoomFields.chestClaims = {};
    }
    await updateTeamExpeditionRoom(teamRoomId, {
      ...sharedRoomFields,
      expeditionMapState: stripMapStateGrid({
        ...positionedState,
        phase: room.type === "treasure" ? "treasure" : "func_room",
        pendingRoom: preparedRoom,
      }),
    });
  }, [isHost, startRoomBattle, teamRoomId, dungeonFamily, dungeonDifficulty, dungeonIsHidden]);

  // 兩段式：點格子只移動+揭露（同步位置），不立刻進場；進入事件改由「進入」按鈕
  // ⚠️ 輕量房例外：踩到即結算（房主本地算效果 → 寫 roomResolution + members updates），
  //    隊員端訂閱到 roomResolution.kind === "inline_room" 就播同一個浮動反饋。
  const handleCellClick = useCallback(async room => {
    if (!isHost || !mapState?.playerPos || !isAdjacent(room.pos, mapState.playerPos)) return;
    const visitedIds = mapState.visitedIds?.includes(room.id)
      ? mapState.visitedIds
      : [...(mapState.visitedIds || []), room.id];
    const positionedState = { ...mapState, playerPos: room.pos, visitedIds };
    // ⚠️ 只有「未清除」的輕量房才結算；連點同一格靠 inlineResolvingRef 擋重複
    if (isInlineRoom(room.type)) {
      if (!room.cleared && inlineResolvingRef.current !== room.id) {
        inlineResolvingRef.current = room.id;
        try {
          await resolveTeamInlineRoom(room, positionedState);
        } finally {
          inlineResolvingRef.current = null;
        }
      } else {
        await updateTeamExpeditionRoom(teamRoomId, {
          roomResolution: null,
          expeditionMapState: stripMapStateGrid(positionedState),
        });
      }
      return;
    }
    await updateTeamExpeditionRoom(teamRoomId, {
      roomResolution: null,
      expeditionMapState: stripMapStateGrid(positionedState),
    });
  }, [isHost, mapState, teamRoomId, resolveTeamInlineRoom]);

  // 站在未清除事件房，房主按「進入」才觸發（enterExplorationRoom 用當前 mapState 當定位）
  const handleEnterRoom = useCallback(async room => {
    if (!isHost || !room) return;
    await enterExplorationRoom(room, mapState);
  }, [isHost, enterExplorationRoom, mapState]);

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

  const resolveTeamEvent = useCallback(async (choice, choiceIndex) => {
    if (!isHost || !mapState?.pendingRoom?.event || teamRoom?.roomResolution?.kind === "team_event") {
      return teamRoom?.roomResolution || null;
    }
    const event = mapState.pendingRoom.event;
    const resolution = buildTeamEventResolution({
      event,
      choice,
      members:teamRoom?.members || {},
    });
    const saved = await updateTeamExpeditionRoom(teamRoomId, {
      ...resolution.updates,
      // 投票制：全員投完（roomConfirms 全 true）觸發房主結算，結算完就把確認清空，
      // 讓大家看完結果後再按「繼續探索」二次確認 → 結果面板不會一閃即逝。
      roomConfirms: {},
      roomResolution: {
        kind:"team_event",
        eventId:resolution.eventId,
        title:resolution.title,
        choiceIndex:choiceIndex ?? null,
        choiceLabel:resolution.choiceLabel,
        cost:resolution.cost,
        effect:resolution.effect,
        badges:resolution.badges,
      },
    });
    if (!saved.ok) {
      setFlowError(`事件效果無法套用：${saved.reason}`);
      return null;
    }
    const coinDelta = (Number(resolution.effect?.gold) || 0) - (Number(resolution.cost?.gold) || 0);
    if (coinDelta !== 0) {
      await Promise.all(
        Object.entries(teamRoom?.members || {})
          .filter(([, member]) => member && member.alive !== false && !["guest", "kid"].includes(member.accountType))
          .map(([memberId]) => addCoins(memberId, coinDelta))
      );
    }
    if (resolution.effect?.item) {
      await Promise.all(
        Object.entries(teamRoom?.members || {})
          .filter(([, member]) => member && member.alive !== false && !["guest", "kid"].includes(member.accountType))
          .map(([memberId]) => addPotions(memberId, [{ id:resolution.effect.item, count:1 }]))
      );
    }
    return resolution;
  }, [isHost, mapState?.pendingRoom?.event, teamRoom?.members, teamRoom?.roomResolution, teamRoomId]);

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
      chestChoices: null,
      chestEggType: null,
      chestClaims: null,
      // ⚠️ restResults / merchantRoomPurchases 一定要跟著清：
      // DungeonRest.jsx:25 用 `room.restResults[memberId]` 判斷「我這間休息室選過了沒」，
      // 殘留下來的話第二次進休息區會被判成已完成 → 選項不給按，房主端 roomConfirms 又是空的、
      // 自動推進條件永遠不成立 → 全隊一起卡在「等待房主選擇中」。
      // handleForceAdvance（本檔 :628）本來就有清這兩個欄位，是這條正常推進的路徑漏掉了。
      restResults: {},
      merchantRoomPurchases: {},
      expeditionMapState: stripMapStateGrid(nextMapState),
    });
  }, [isHost, mapState, floorIndex, teamRoomId]);

  // ── 房主：事件房強制定案（先以最高票結算，再推進） ────────────────
  const forceAdvanceFunctionRoom = useCallback(async () => {
    if (!isHost) return;
    const roomType = mapState?.pendingRoom?.type;
    const isEventRoom = roomType === "event" || roomType === "general_event";
    const isResolved = teamRoom?.roomResolution?.kind === "team_event";
    if (isEventRoom && !isResolved && mapState?.pendingRoom?.event) {
      const ev = mapState.pendingRoom.event;
      const isSpecial = Array.isArray(ev.choices) && ev.choices.length > 0;
      const { winner } = tallyEventVotes({
        members: teamRoom?.members,
        choices: teamRoom?.roomChoices,
        hostId: teamRoom?.hostId,
      });
      const winIdx = winner !== null && winner !== undefined ? Number(winner) : null;
      const winChoice = isSpecial && Number.isFinite(winIdx) ? ev.choices[winIdx] || null : null;
      await resolveTeamEvent(winChoice, Number.isFinite(winIdx) ? winIdx : null);
    }
    await finishFunctionRoom();
  }, [isHost, mapState, teamRoom, resolveTeamEvent, finishFunctionRoom]);

  // ── 全員投票完成自動推進（房主端監聽） ───────────────────────────
  useEffect(() => {
    if (!isHost || mapState?.phase !== "func_room" || !mapState?.pendingRoom) return;
    const roomType = mapState.pendingRoom.type;

    // 事件房：全員「投票」（confirmNonCombatRoom 同時寫 roomConfirms + roomChoices）。
    // 全員投完 → 房主先以最高票結算（平票時房主那票 ×2，見 dungeonEventVotes），
    // 結算完成（roomResolution team_event）後再走既有推進。
    if (roomType === "event" || roomType === "general_event") {
      if (!isTeamRoomReadyToAdvance({ members: teamRoom?.members, confirms: teamRoom?.roomConfirms })) return;
      const isResolved = teamRoom?.roomResolution?.kind === "team_event";
      if (!isResolved) {
        if (eventResolvingRef.current) return;
        eventResolvingRef.current = true;
        const ev = mapState.pendingRoom.event;
        const isSpecial = Array.isArray(ev?.choices) && ev.choices.length > 0;
        let winChoice = null;
        let winIdx = null;
        if (isSpecial) {
          const { winner } = tallyEventVotes({
            members: teamRoom?.members,
            choices: teamRoom?.roomChoices,
            hostId: teamRoom?.hostId,
          });
          winIdx = winner !== null && winner !== undefined ? Number(winner) : null;
          winChoice = Number.isFinite(winIdx) ? (ev.choices[winIdx] || null) : null;
        }
        resolveTeamEvent(winChoice, Number.isFinite(winIdx) ? winIdx : null)
          .catch(() => {})
          .finally(() => {
            // 寫入失敗（無 team_event resolution）時，1.5s 後解鎖重試
            setTimeout(() => { eventResolvingRef.current = false; }, 1500);
          });
        return;
      }
      finishFunctionRoom();
      return;
    }

    if (shouldAutoAdvanceTeamFunctionRoom({
      roomType,
      members:teamRoom?.members,
      confirms:teamRoom?.roomConfirms,
    })) {
      finishFunctionRoom();
    }
  }, [isHost, mapState?.phase, mapState?.pendingRoom, teamRoom?.members, teamRoom?.roomConfirms, teamRoom?.roomChoices, teamRoom?.roomResolution, teamRoom?.hostId, resolveTeamEvent, finishFunctionRoom]);

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
        const finalBossBattleRoomId = teamRoom?.finalBossBattleRoomId || teamRoom?.bossRewardBattleId;
        if (finalBossBattleRoomId) cleanupExpeditionRoom(finalBossBattleRoomId).catch(() => {});
        cleanupTeamExpeditionRoom(teamRoomId).catch(() => {});
      }
      if (wonLast && !isGuestMode) {
        addDungeonClear(myId, dungeonFamily, 1, `${teamRoomId}:${myId}`).catch(() => {});
      }

      // ── 遠征首殺判定 ────────────────────────────────────────
      if (!isGuestMode && wonLast) {
        const teamNames = Object.values(teamRoom?.members || {})
          .filter(Boolean).map(m => m.name).filter(Boolean);
        try {
          await claimDungeonPersonalFirstClear({
            memberId:myId, family:dungeonFamily, difficultyTier:dungeonDifficulty, runId:teamRoomId,
          });
          if (isHost) {
            const fcResult = await trySetDungeonWorldFirstClear({
              family:dungeonFamily, difficultyTier:dungeonDifficulty,
              hostId:teamRoom?.hostId || myId, hostName:myName,
              teamMemberIds:Object.keys(teamRoom?.members || {}), teamNames, runId:teamRoomId,
            });
            if (fcResult.isFirst) {
            const diff = getExcavationDifficulty(dungeonDifficulty);
            const FAMILY_MAP = { ghost:{e:"👻",l:"幽冥系"}, mountain:{e:"⛰️",l:"山嶺系"}, insect:{e:"🦋",l:"昆蟲系"}, workplace:{e:"💼",l:"職場系"}, exam:{e:"📝",l:"考試系"}, temple:{e:"🏛️",l:"神廟系"}, treasure:{e:"📦",l:"寶箱族"} };
            const f = FAMILY_MAP[dungeonFamily] || {e:"🏰",l:"遠征"};
            addDungeonBroadcast(fcResult.key, `遠征-${f.l}`, diff?.label || `Lv.${dungeonDifficulty}`, f.e, teamNames, myName).catch(() => {});
            }
          }
        } catch (_) {}
      }

      onComplete?.();
      return true;
    }, [result, myId, dungeonDifficulty, floorsCleared, wonLast, dungeonFamily, dungeonIsHidden, isHost, teamRoomId, teamRoom, myName, onComplete, isGuestMode]);

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
      const code = error?.code ? `[${error.code}] ` : "";
      setBossRewardError(`${code}${error?.message || "無法同步個人王房獎勵"}`);
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
        runArrows={runArrows}
        targetFmt={teamRoom?.targetFmt || "full_110"}
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
    potionBuffs: myMember.potionBuffs || {},
    restBonuses: myMember.restBonuses || { atkPct:0, defPct:0 },
    merchantBonuses: myMember.merchantBonuses || { atkPct:0, defPct:0 },
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
          partyMembers={Object.entries(teamRoom?.members || {}).map(([id, member]) => ({ id, ...member }))}
          currentMemberId={myId}
          coins={profile?.coins || 0}
          lootMult={teamRoom?.lootMult || 1}
          onCellClick={handleCellClick}
          onEnterRoom={handleEnterRoom}
          onDescend={handleDescend}
          onSaveAndLeave={handleSaveProgress}
          onRetreat={handleAbandon}
          canControl={isHost}
          difficulty={dungeonDifficulty}
          family={dungeonFamily}
          inlineToast={inlineToast}
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
          partyMembers={Object.entries(teamRoom?.members || {}).map(([id, member]) => ({ id, ...member }))}
          currentMemberId={myId}
          coins={profile?.coins || 0}
          lootMult={teamRoom?.lootMult || 1}
          onChoose={handleChooseBranch}
          onEnterNext={handleBranchNext}
          onRetreat={handleAbandon}
          canControl={isHost}
          difficulty={dungeonDifficulty}
          family={dungeonFamily}
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
      onSharedDone:finishFunctionRoom,
    };
    return (
      <div className="relative min-h-screen flex flex-col">
        <TeamRoomVotingBar
          teamRoom={teamRoom}
          myId={myId}
          isHost={isHost}
          onForceAdvance={forceAdvanceFunctionRoom}
        />
        <div className="flex-1">
          {(() => {
            switch (mapState.pendingRoom.type) {
              case "shop":
                return <DungeonShop {...common} memberData={{ ...myMember, id: myId, coins: profile?.coins || 0 }} />;
              case "event":
              case "general_event":
                return <DungeonEvent
                  {...common}
                  event={mapState.pendingRoom?.event || teamRoom?.currentEvent}
                  onResolveEvent={resolveTeamEvent}
                />;
              case "trap":
                return <DungeonTrap {...common} />;
              case "chest":
                return <DungeonChest {...common} />;
              case "rest":
                return <DungeonRest {...common} coins={profile?.coins || 0} />;
              default:
                return null;
            }
          })()}
        </div>
      </div>
    );
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
        cardCollection={cardCollection}
        lootMult={teamRoom?.lootMult || 1}
        // 整場射箭表現與擊殺獎勵都要各自累積：handleFloorDone 只有房主會跑，隊員得靠這兩條回報
        onArrowsCollected={arrows => setRunArrows(previous => [...previous, ...arrows])}
        onKillRewardCollected={({ coins, archerXP }) => setKillTotals(previous => ({
          coins: previous.coins + coins,
          archerXP: previous.archerXP + archerXP,
          kills: previous.kills + 1,
        }))}
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
