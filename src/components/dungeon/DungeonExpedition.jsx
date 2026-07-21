// src/components/dungeon/DungeonExpedition.jsx
// 遠征模式主體 — 單人、手動推進
// 第 1、2 層：5×5 迷霧格子地圖（expeditionGrid.generateGridFloor）
// 第 3 層：入口 → A/B/C 三選一（鎖定）→ 3 功能房 → 休息 → 王 → 寶箱
// HP / buff 全程跨房間、跨樓層持續；功能房走「本地單人模式」不寫 Firestore

import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { drawExpeditionBoss } from "../../lib/monsterData";
import { drawDungeonFloorMonsters, drawDungeonFallbackMonster } from "../../lib/dungeonExpansionMonsters";
import { resolveDungeonBossEncounter } from "../../lib/dungeonBossEncounter";
import { buildExpeditionMemberData } from "../../lib/expeditionMemberData";
import { subscribeCardCollection } from "../../lib/db";
import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";
import {
  getExcavationDifficulty,
  DUNGEON_SHOP_ITEMS,
  drawDungeonEvent,
} from "../../lib/dungeonData";
import {
  generateGridFloor,
  generateBranchFloor,
  isAdjacent,
  GRID_SIZE,
} from "../../lib/expeditionGrid";
import {
  createExpeditionBattleRoom,
  cleanupExpeditionRoom,
  broadcastExpeditionFailure,
  calculateExpeditionRewards,
  saveExpeditionRecord,
  grantExpeditionRewards,
  setActiveExpeditionProgress,
  clearActiveExpeditionProgress,
} from "../../lib/expeditionDb";
import { trySetDungeonFirstClear, addDungeonBroadcast, addCollectibles } from "../../lib/dungeonDb";
import { getExpeditionFirstClearTrophy } from "../../lib/dungeonCollectibles";
import {
  completeExcavation,
  abandonExcavation,
  removeSavedDungeon,
} from "../../lib/dungeonExcavation";
import {
  addArrowdew,
  addChests,
  addCoins,
  addArcherXP,
  addMaterials,
  grantKingVaultReward,
} from "../../lib/db";
import { rollDungeonKillReward, getDungeonDewMultiplier } from "../../lib/dungeonKillRewards";
import {
  buildExpeditionParty,
  collectBattleStats,
  collectBattleArrows,
  createExpeditionKillLoot,
  emptyExpeditionLoot,
  mergeExpeditionLoot,
  mergeExpeditionStats,
} from "../../lib/expeditionRewards";
import {
  sfxTap, sfxDoorOpen, sfxPathSelect, sfxBuff, sfxDebuff,
  sfxCoinDrop, sfxPotionDrink, sfxShopBuy, sfxVictory, sfxCounter, sfxError,
} from "../../lib/sound";
import DungeonBattleRoom from "./DungeonBattleRoom";
import DungeonKillResult from "./DungeonKillResult";
import DungeonExpeditionResult from "./DungeonExpeditionResult";
import DungeonShop from "./DungeonShop";
import DungeonTrap from "./DungeonTrap";
import DungeonEvent from "./DungeonEvent";
import DungeonChest from "./DungeonChest";
import DungeonRest from "./DungeonRest";
import DungeonTreasureRoom from "./DungeonTreasureRoom";
import { GridMapStage, BranchStage } from "./DungeonStages";

const DungeonBossRewardRoom = lazy(() => import("./DungeonBossRewardRoom"));

// ── 樓層名稱 ────────────────────────────────────────────
const FLOOR_LABELS = [
  { icon:"🌿", title:"第 1 層 · 探索層", desc:"迷霧籠罩的 5×5 地圖：少量怪物與大量事件，小心陷阱！" },
  { icon:"⚔️", title:"第 2 層 · 戰鬥層", desc:"迷霧更深、怪物更多，還有一隻精英怪擋路！" },
  { icon:"👑", title:"第 3 層 · 王關",   desc:"三條岔路只能選一條——盡頭是 Boss 與寶藏！" },
];

// 商店「一次性商品」規則：除了回血藥水(hp_restore)以外，所有商品整趟遠征只能買一次（防無限堆疊）。
// 以 effect 為單位（atk_boost×1.2 與 atk_large×1.5 都算 atk_mult，買了其一另一支也鎖）。
const isOneTimeShopEffect = (e) => !!e && e !== "hp_restore";


// ── 戰鬥包裝元件 ────────────────────────────────────────
function ExpeditionBattleRoom({
  memberData, memberName, monster,
  difficultyTier, floorIndex, roomType,
  arrowsPerRound, targetFmt,
  onDone, onAbandon, guestProfile,
}) {
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [battleDone, setBattleDone] = useState(false);
  const terminalHandledRef = useRef(false);
  const timerRef = useRef(null);

  // 建立戰鬥房間
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await createExpeditionBattleRoom({
        memberId: memberData?.id,
        memberName,
        memberData,
        monster,
        difficultyTier,
        floorIndex,
        roomType: roomType || "monster",
        arrowsPerRound,
        targetFmt,
      });
      if (cancelled) return;
      if (res.ok) {
        setRoomId(res.roomId);
        setLoading(false);
      } else {
        setError(res.reason);
        setLoading(false);
      }
    })().catch(failure => {
      if (cancelled) return;
      setError(failure?.message || "無法取得王房戰鬥資格");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  // 用 ref 避免 stale closure
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const memberIdRef = useRef(memberData?.id);
  memberIdRef.current = memberData?.id;

  // 監聽房間狀態變化；結束時帶回戰後成員狀態（HP/buff 跨房間持續）
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "dungeonRooms", roomId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const me = data.members?.[memberIdRef.current] || null;
      const finishBattle = (won, delay) => {
        if (terminalHandledRef.current) return;
        terminalHandledRef.current = true;
        setBattleDone(true);
        timerRef.current = setTimeout(async () => {
          await cleanupExpeditionRoom(roomId).catch(() => {});
          onDoneRef.current({ won, member: me, battle: { id:roomId, ...data } });
        }, delay);
      };

      // 檢測戰鬥結束
      if (data.status === "completed" && data.result === "lose") {
        finishBattle(false, 1500);
      } else if (data.status === "map_explore") {
        finishBattle(true, 300);
      }
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [roomId]);

  if (loading) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4"
        style={{ background:"#0a0a0f", color:"rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize:48 }}>⚔️</div>
        <div style={{ fontSize:14 }}>初始化戰鬥…</div>
      </div>
    );
  }

  if (error || !roomId) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4"
        style={{ background:"#0a0a0f", color:"rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize:48 }}>❌</div>
        <div style={{ fontSize:14 }}>戰鬥建立失敗：{error || "未知錯誤"}</div>
        <button onClick={onAbandon}
          style={{ padding:"8px 24px", borderRadius:12, background:"#334155", color:"#e2e8f0", border:"none", cursor:"pointer" }}>
          返回
        </button>
      </div>
    );
  }

  if (battleDone) {
    return (
      <div className="h-[100dvh] flex items-center justify-center"
        style={{ background:"#0a0a0f", color:"rgba(255,255,255,0.4)" }}>
        結算中…
      </div>
    );
  }

  return (
    <DungeonBattleRoom
      roomId={roomId}
      isMapMode={true}
      // 少了這個旗標，DungeonBattleRoom 會走舊的「房間通關！」結算畫面，
      // 玩家就會先看一次舊結算、再看一次 DungeonKillResult（使用者實測回報的重複）
      expeditionMode={true}
      onReturnToMap={() => {}}
      onExit={onAbandon}
      guestProfile={guestProfile}
    />
  );
}

// ── 樓層過場動畫 ────────────────────────────────────────
function FloorIntro({ floorIndex, difficultyTier, onStart }) {
  const [show, setShow] = useState(false);
  const [canStart, setCanStart] = useState(false);

  useEffect(() => {
    setShow(true);
    const t = setTimeout(() => setCanStart(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const floor = FLOOR_LABELS[floorIndex] || FLOOR_LABELS[0];
  const diff = getExcavationDifficulty(difficultyTier);

  return (
    <div className="h-[100dvh] flex flex-col items-center justify-center gap-6 px-6 text-white"
      style={{ background:"linear-gradient(160deg,#0f172a,#1e1b4b)" }}>
      <div style={{
        fontSize:64,
        animation: show ? "ei-bounce 0.6s ease-out" : "none",
      }}>{floor.icon}</div>
      <div style={{
        fontSize:24, fontWeight:900,
        animation: show ? "ei-fade 0.5s 0.3s ease both" : "none",
      }}>{floor.title}</div>
      <div style={{
        fontSize:13, color:"#94a3b8", textAlign:"center", maxWidth:280,
        animation: show ? "ei-fade 0.5s 0.5s ease both" : "none",
      }}>{floor.desc}</div>
      <div style={{
        display:"flex", gap:6,
        animation: show ? "ei-fade 0.5s 0.7s ease both" : "none",
      }}>
        <span style={{ background:"rgba(255,255,255,0.08)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"#94a3b8" }}>
          {diff?.icon} {diff?.label}
        </span>
        {floorIndex === 2 && (
          <span style={{ background:"rgba(239,68,68,0.15)", borderRadius:6, padding:"2px 8px", fontSize:11, color:"#f87171", fontWeight:700 }}>
            ⚠️ Boss 層
          </span>
        )}
      </div>
      {canStart && (
        <button onClick={onStart}
          style={{
            padding:"14px 48px", borderRadius:14, fontWeight:900, fontSize:16,
            border:"none", cursor:"pointer",
            background:"linear-gradient(90deg,#f59e0b,#d97706)",
            color:"white",
          }}>
          {floorIndex === 2 ? "⚔️ 出發！" : "🗺️ 開始探索"}
        </button>
      )}
      <style>{`
@keyframes ei-bounce{0%{transform:scale(0.3) rotate(-20deg);opacity:0}55%{transform:scale(1.2) rotate(5deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes ei-fade{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ▼▼▼  主元件  ▼▼▼
// ══════════════════════════════════════════════════════════════

export default function DungeonExpedition({
  excavation,
  profile,
  onComplete,
  onAbandon: onAbandonProp,
  isGuest,
  tierCap,
}) {
  const myId = profile?.id;
  // 卡片裝備加成（世界王卡等，地下城遠征本來沒串接，2026-07-09 補上）
  const [cardColl, setCardColl] = useState({ cards: {}, wbCards: {}, equipped: [] });
  const [cardReady, setCardReady] = useState(() => isGuest || !myId);
  useEffect(() => {
    if (!myId || isGuest) {
      setCardReady(true);
      return undefined;
    }
    setCardReady(false);
    return subscribeCardCollection(myId, data => {
      setCardColl(data);
      setCardReady(true);
    });
  }, [myId, isGuest]);
  const cardBonus = calcEquippedBonus(resolveEquippedCards(cardColl));
  // 難度封頂第二層防禦：訪客/兒童一律夾在 1~tierCap（不完全信任上游 GuestDungeonEntry 傳來的值）
  // 見 .trellis/tasks/07-10-guest-kid-dungeon-parity/design.md §3
  const difficultyTier = isGuest
    ? Math.min(Math.max(1, excavation?.difficulty || 1), tierCap || 2)
    : (excavation?.difficulty || 1);
  const isFromStorage = excavation?.fromStorage === true;
  const savedId = excavation?.savedId;
  const family = excavation?.family || "ghost";
  const expansionRunIdRef = useRef(
    excavation?.expansionRunId
      || `${myId || "guest"}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
  );
  // 訪客/兒童：不信任上游傳入的 boss 物件（可能是封頂前抽出的），一律用已封頂的 difficultyTier 重新抽王，
  // 確保王關戰鬥本身也真的被夾住，不只是樓層怪物池／獎勵倍率（design.md §3 的「兩層都要夾」）
  // useMemo 鎖定同一場遠征內的王身份，避免每次 render 都重抽（family/difficultyTier 不變就不重算）
  const guestFixedBoss = useMemo(
    () => (isGuest ? drawExpeditionBoss(difficultyTier, family) : null),
    [isGuest, difficultyTier, family],
  );
  // ⚠️ 這裡以前是 dynamic import + useEffect 非同步設 state，結果 startFloor 常在王
  // 算好之前就跑了：fixedBoss 是 null → 第 3 層整層 fallback 舊表（跨族跨階雜怪），
  // 而王本身也退回 excavation.boss 的舊值。改成同步 useMemo，fixedBoss 永不缺席。
  // 與選擇畫面共用 resolveDungeonBossEncounter，確保預覽與實戰是同一隻王。
  // 刻意「不」注入 expansionRunIdRef：那顆對舊地下城是隨機值，注入後預覽端永遠算不出
  // 同一隻王。交給 resolveDungeonBossRunId 依 bossRunId → id → revealedAt 推導，
  // 兩端拿到的是同一個 dungeon 物件，結果必然一致。
  const expansionBossEncounter = useMemo(
    () => resolveDungeonBossEncounter({ ...(excavation || {}), family }, { difficultyTier }),
    [excavation, family, difficultyTier],
  );
  const fixedBoss = expansionBossEncounter?.monsterSnapshot
    || (isGuest ? guestFixedBoss : (excavation?.boss || null));
  const isHidden = excavation?.isHidden || false;
  const arrowsPerRound = excavation?.arrowsPerRound === 3 ? 3 : 6;
  const targetFmt = excavation?.targetFmt || "full_110";
  // 意外離開/重整後「回到房間」：從已完成的層數（0~2）續玩，而不是被迫結算或從頭開始。
  // 戰利品本來就是打一隻入袋一次（已存帳），所以不必還原整張地圖，只要回到該層即可。
  // HP 不回滿——還原離開前保存的 HP，避免玩家靠「重整」無限回血刷關。
  const resumeFromFloor = Math.max(0, Math.min(2, Math.floor(Number(excavation?.resumeFromFloor) || 0)));
  const resumeHp = Math.max(0, Math.floor(Number(excavation?.resumeHp) || 0));
  const [phase, setPhase] = useState(isFromStorage ? "consume" : "intro");
  const [entryError, setEntryError] = useState("");

  // 從儲存槽啟動時先消耗槽位；失敗時不可進入戰鬥。
  useEffect(() => {
    if (isFromStorage && myId && savedId) {
      removeSavedDungeon(myId, savedId).then(result => {
        if (!result?.ok) {
          setEntryError(result?.reason || "無法消耗地下城儲存槽");
          setPhase("entry_error");
          return;
        }
        setPhase("intro");
      });
    }
  }, [isFromStorage, myId, savedId]);

  const [floorIndex, setFloorIndex] = useState(0);
  // 第 1、2 層：格子地圖狀態
  const [gridFloor, setGridFloor] = useState(null);
  const [playerPos, setPlayerPos] = useState(null);
  const [visitedIds, setVisitedIds] = useState(() => new Set());
  // 第 3 層：分支狀態
  const [branchFloor, setBranchFloor] = useState(null);
  const [branchChoice, setBranchChoice] = useState(null);
  const [branchStep, setBranchStep] = useState(0);
  // 進行中的房間
  const [pendingRoom, setPendingRoom] = useState(null);
  const [monsterPool, setMonsterPool] = useState({ monsters: [], elite: null, boss: null });
  const [floorsCleared, setFloorsCleared] = useState(0);
  const [wonLast, setWonLast] = useState(false);
  const [resultRewards, setResultRewards] = useState(null);
  // 出圖時決定的寶箱掉落倍數（1~3,整場固定;與組隊遠征同規格）
  const [runLootMult] = useState(() => 1 + Math.floor(Math.random() * 3));
  // 探索途中每殺即時入帳的金幣／射手 XP 累計。
  // ⚠️ 以前這兩個數字只餵給 4.5 秒的 killToast 就丟掉，結算頁因此只顯示通關獎勵，
  // 玩家實際入帳的卻是「通關獎勵 + 沿路擊殺」，數字對不上（使用者實測回報）。
  const [killTotals, setKillTotals] = useState({ coins:0, archerXP:0, kills:0 });
  // 一般怪擊倒後的單場結算畫面（使用者規格：不要只彈 4.5 秒小提示，要看完整數據）。
  // 有值時蓋住整個畫面，按「下一步」才 finishPendingRoom() 繼續跑房間。
  const [killResult, setKillResult] = useState(null);
  // 整場遠征累積的箭（跨房間、跨樓層），供最終結算的射箭表現分析使用
  const [runArrows, setRunArrows] = useState([]);
  const [bossRewardClaim, setBossRewardClaim] = useState(null);
  const [bossRewardRetry, setBossRewardRetry] = useState(null);
  // 玩家持續狀態（HP / buff 跨房間、跨樓層帶著走）
  const [playerState, setPlayerState] = useState(null);
  // 整趟遠征已買過的「一次性商店效果」（atk_mult/def_mult/revival）→ 商店據此鎖定，防跨商店堆疊
  const [boughtOneTime, setBoughtOneTime] = useState({});

  // 進度持久化：斷線/關閉瀏覽器後可在 DungeonLobby 偵測，選擇「回到房間續玩」或「結算」。
  // 一併保存目前 HP（隨 hp 變動即時更新），續玩時還原離開前的 HP，避免重整回滿血刷關。
  useEffect(() => {
    if (!myId) return;
    setActiveExpeditionProgress(myId, {
      family, difficultyTier, isHidden, floorsCleared,
      hp: playerState?.hp, maxHP: playerState?.maxHP,
      arrowsPerRound, targetFmt,
      expansionRunId: expansionRunIdRef.current,
      bossEncounter: expansionBossEncounter,
    }).catch(() => {});
  }, [myId, family, difficultyTier, isHidden, floorsCleared, playerState?.hp, playerState?.maxHP, arrowsPerRound, targetFmt, expansionBossEncounter]);
  const [runLoot, setRunLoot] = useState(() => emptyExpeditionLoot());
  const [runStats, setRunStats] = useState({});
  // 可變怪物佇列（每場戰鬥消耗一隻）
  const monsterQueueRef = useRef([]);
  // 樓層事件修正（怪物 HP/ATK 倍率等）
  const floorModsRef = useRef({});
  const nextFloorModsRef = useRef({});

  const coins = profile?.coins ?? 0; // profile 為即時快照，addCoins 後自動更新

  const startFloor = useCallback((fi) => {
    setFloorIndex(fi);
    setPendingRoom(null);
    floorModsRef.current = { ...nextFloorModsRef.current };
    nextFloorModsRef.current = {};
    const monsters = drawDungeonFloorMonsters(fi, difficultyTier, {
      family,
      fixedBoss,
    });
    setMonsterPool(monsters);
    monsterQueueRef.current = [...(monsters.monsters || [])];
    if (fi < 2) {
      const gen = generateGridFloor(fi, difficultyTier);
      setGridFloor(gen);
      setPlayerPos(gen.startPos);
      setVisitedIds(new Set([gen.grid[gen.startPos.y][gen.startPos.x]]));
      setBranchFloor(null);
    } else {
      setBranchFloor(generateBranchFloor());
      setBranchChoice(null);
      setBranchStep(0);
      setGridFloor(null);
    }
    setPhase("floor_intro");
  }, [difficultyTier, family, fixedBoss]);

  // 初始化玩家狀態 + 第一層
  useEffect(() => {
    if (phase === "intro" && cardReady) {
      const base = buildExpeditionMemberData(profile, cardBonus);
      // 續玩：HP 用離開前保存的值（夾在 1~maxHP，避免回滿刷血）；全新開始才用滿血 base.hp。
      const isResume = resumeFromFloor > 0 || resumeHp > 0;
      const startHp = isResume ? Math.max(1, Math.min(resumeHp || base.hp, base.maxHP)) : base.hp;
      setPlayerState({
        hp: startHp,
        maxHP: base.maxHP,
        atk: base.atk,
        def: base.def,
        wbBonus: base.wbBonus,
        buffs: { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: false },
      });
      if (resumeFromFloor > 0) setFloorsCleared(resumeFromFloor);
      startFloor(resumeFromFloor);
    }
  }, [phase, startFloor, cardReady]); // eslint-disable-line

  const showResult = useCallback((won, cleared) => {
    setWonLast(won);
    setFloorsCleared(cleared);
    const baseRewards = calculateExpeditionRewards({
      difficultyTier,
      floorsCleared: cleared,
      won,
      family,
    });
    // 箭露：基準 × 難度倍率 × 5（與組隊遠征同規格,dungeonKillRewards）
    setResultRewards({ ...baseRewards, arrowDew: Math.round((baseRewards.arrowDew || 0) * getDungeonDewMultiplier(difficultyTier)) });
    setPhase("result");
  }, [difficultyTier, family, myId]); // eslint-disable-line

  // ── 分支序列（第 3 層）──────────────────────────────────
  const branchSeq = useMemo(() => {
    if (!branchFloor || !branchChoice) return [];
    const b = branchFloor.branches[branchChoice];
    return [...b.rooms, branchFloor.boss, branchFloor.treasure];
  }, [branchFloor, branchChoice]);

  // ── 房間清除 ────────────────────────────────────────────
  const markRoomCleared = useCallback((roomId) => {
    setGridFloor(prev => prev ? {
      ...prev,
      rooms: prev.rooms.map(r => r.id === roomId ? { ...r, cleared: true } : r),
    } : prev);
  }, []);

  const finishPendingRoom = useCallback(() => {
    if (pendingRoom) {
      if (floorIndex < 2) {
        markRoomCleared(pendingRoom.id);
      } else {
        setBranchStep(s => s + 1);
      }
    }
    setPendingRoom(null);
    setPhase(floorIndex < 2 ? "grid" : "branch");
  }, [pendingRoom, floorIndex, markRoomCleared]);

  // ── 本地效果套用（功能房 → 玩家狀態）────────────────────
  const applyEventEffect = useCallback((ev) => {
    const eff = ev?.effect || {};
    const r2 = v => Math.round(v * 100) / 100;

    // 1. 代價 (Cost)
    if (ev?.cost) {
      if (ev.cost.hp) {
        setPlayerState(p => ({ ...p, hp: Math.max(1, Math.round(p.hp - p.maxHP * ev.cost.hp)) }));
      }
      if (ev.cost.gold) {
        addCoins(myId, -ev.cost.gold).catch(() => {});
      }
    }

    // 2. 隨機效果池 (Random)
    let finalEff = eff;
    if (eff.random && Array.isArray(eff.random)) {
      finalEff = eff.random[Math.floor(Math.random() * eff.random.length)];
    }

    // 3. 屬性修正 (限制在 ±10% 範圍)
    if (finalEff.hp) {
      (finalEff.hp > 0 ? sfxBuff : sfxDebuff)();
      setPlayerState(p => ({
        ...p,
        hp: Math.max(1, Math.min(p.maxHP, Math.round(p.hp + p.maxHP * finalEff.hp))),
      }));
    }
    if (finalEff.atk) {
      (finalEff.atk > 0 ? sfxBuff : sfxDebuff)();
      setPlayerState(p => ({
        ...p,
        buffs: { ...p.buffs, atkMult: r2((p.buffs?.atkMult || 1) * (1 + finalEff.atk)) },
      }));
    }
    if (finalEff.def) {
      (finalEff.def > 0 ? sfxBuff : sfxDebuff)();
      setPlayerState(p => ({
        ...p,
        buffs: { ...p.buffs, defMult: r2((p.buffs?.defMult || 1) * (1 + finalEff.def)) },
      }));
    }
    if (finalEff.dmg) {
      (finalEff.dmg > 0 ? sfxBuff : sfxDebuff)();
      setPlayerState(p => ({
        ...p,
        buffs: { ...p.buffs, dmgMult: r2((p.buffs?.dmgMult || 1) * (1 + finalEff.dmg)) },
      }));
    }
    if (finalEff.gold) {
      (finalEff.gold > 0 ? sfxCoinDrop : sfxDebuff)();
      addCoins(myId, finalEff.gold).catch(() => {});
    }

    // 舊相容 (Legacy type-based events)
    switch (eff.type) {
      case "hp_restore_all":
        sfxBuff();
        setPlayerState(p => ({ ...p, hp: Math.min(p.maxHP, Math.round(p.hp + p.maxHP * Math.min(0.1, eff.value))) }));
        break;
      case "atk_debuff_all":
      case "atk_buff_one":
        (eff.value >= 1 ? sfxBuff : sfxDebuff)();
        setPlayerState(p => ({ ...p, buffs: { ...p.buffs, atkMult: r2((p.buffs?.atkMult || 1) * Math.min(1.1, Math.max(0.9, eff.value))) } }));
        break;
      case "def_mult_all":
        sfxBuff();
        setPlayerState(p => ({ ...p, buffs: { ...p.buffs, defMult: r2((p.buffs?.defMult || 1) * Math.min(1.1, Math.max(0.9, eff.value))) } }));
        break;
      case "dmg_mult_all":
        (eff.value >= 1 ? sfxBuff : sfxDebuff)();
        setPlayerState(p => ({ ...p, buffs: { ...p.buffs, dmgMult: r2((p.buffs?.dmgMult || 1) * Math.min(1.1, Math.max(0.9, eff.value))) } }));
        break;
      case "gold_bonus":
        sfxCoinDrop();
        addCoins(myId, eff.value).catch(() => {});
        break;
      default:
        break;
    }
  }, [myId]);

  const handleLocalEffect = useCallback((effect) => {
    if (!effect) return;
    switch (effect.type) {
      case "hp_loss":
        sfxCounter();
        setPlayerState(p => ({ ...p, hp: Math.max(1, p.hp - effect.value) }));
        break;
      case "buff_mult":
        sfxDebuff();
        setPlayerState(p => ({
          ...p,
          buffs: { ...p.buffs, [effect.key]: Math.round((p.buffs[effect.key] || 1) * effect.value * 100) / 100 },
        }));
        break;
      case "heal_pct":
        sfxPotionDrink();
        setPlayerState(p => ({ ...p, hp: Math.min(p.maxHP, p.hp + Math.round(p.maxHP * effect.value)) }));
        break;
      case "cure":
        sfxBuff();
        setPlayerState(p => {
          const b = p.buffs || {};
          if ((b.atkMult || 1) < 1 || (b.defMult || 1) < 1) {
            return { ...p, buffs: { ...b, atkMult: 1, defMult: 1 } };
          }
          return p;
        });
        break;
      case "coins":
        sfxCoinDrop();
        addCoins(myId, effect.value).catch(() => {});
        break;
      case "event":
        applyEventEffect(effect.event);
        break;
      default:
        break;
    }
  }, [myId, applyEventEffect]);

  // 商店本地購買：扣金幣 + 套用效果
  const handleLocalBuy = useCallback((item) => {
    // 一次性商品（回血藥水以外）：已買過就擋下（不扣款、不套用）
    if (isOneTimeShopEffect(item.effect) && boughtOneTime[item.effect]) { sfxError(); return; }
    sfxShopBuy();
    addCoins(myId, -item.cost).catch(() => {});
    if (isOneTimeShopEffect(item.effect)) setBoughtOneTime(b => ({ ...b, [item.effect]: true }));
    setPlayerState(p => {
      switch (item.effect) {
        case "hp_restore":
          return { ...p, hp: Math.min(p.maxHP, Math.round(p.hp + p.maxHP * item.value)) };
        case "hp_max_boost": {
          const maxHP = Math.round(p.maxHP * (1 + item.value));
          return { ...p, maxHP, hp: Math.min(maxHP, Math.round(p.hp * (1 + item.value))) };
        }
        // ATK/DEF 藥水：寫進 base atk/def（整趟持續，不受換層時事件增益歸零影響）；且只能買一次
        case "atk_mult":
          return { ...p, atk: Math.round((p.atk || 0) * item.value) };
        case "def_mult":
          return { ...p, def: Math.round((p.def || 0) * item.value) };
        case "revival":
          return { ...p, buffs: { ...p.buffs, hasRevival: true } };
        default:
          return p;
      }
    });
  }, [myId, boughtOneTime]);

  // ── 進入房間 ────────────────────────────────────────────
  const enterRoom = useCallback((room) => {
    const r = { ...room };
    if (["battle", "elite_battle", "boss_battle"].includes(r.type)) {
      const mods = floorModsRef.current;
      const fallbackVariant = floorIndex === 0
        ? "weak"
        : floorIndex === 2
          ? "strong"
          : "normal";
      let mon = r.type === "elite_battle" ? monsterPool.elite
        : r.type === "boss_battle" ? (fixedBoss || monsterPool.boss)   // 王房用預覽同源的正確王，避免打到雜兵
        : (monsterQueueRef.current.shift()
          || drawDungeonFallbackMonster(fallbackVariant, Math.max(1, difficultyTier), { family }));
      if (!mon) {
        // 空房間：直接視為完成
        if (floorIndex < 2) markRoomCleared(r.id);
        else setBranchStep(s => s + 1);
        return;
      }
      r.monster = {
        ...mon,
        hp:  Math.round((mon.hp  || 100) * (mods.monsterHpMult  || 1)),
        atk: Math.round((mon.atk || 10) * (mods.monsterAtkMult || 1)),
      };
      setPendingRoom(r);
      setPhase("battle");
      return;
    }
    if (r.type === "treasure") {
      setPendingRoom(r);
      setPhase("treasure");
      return;
    }
    if (r.type === "shop") {
      const shuffled = [...DUNGEON_SHOP_ITEMS].sort(() => Math.random() - 0.5);
      r.shopItems = shuffled.slice(0, 5).map(i => i.id);
    }
    if (r.type === "event") {
      r.event = drawDungeonEvent("special");
    }
    if (r.type === "general_event") {
      r.event = drawDungeonEvent("general");
    }
    setPendingRoom(r);
    setPhase("func_room");
  }, [monsterPool, fixedBoss, difficultyTier, floorIndex, markRoomCleared]);

  // ── 格子點擊移動 ────────────────────────────────────────
  const handleCellClick = useCallback((room) => {
    if (!room || !playerPos || !isAdjacent(room.pos, playerPos)) return;
    sfxTap();
    setPlayerPos({ ...room.pos });
    setVisitedIds(prev => {
      const next = new Set(prev);
      next.add(room.id);
      return next;
    });
    // 兩段式：點格子只移動 + 揭露房間；進入事件改由底部「進入」按鈕觸發（enterRoom）
  }, [playerPos]);

  const handleDescend = useCallback(() => {
    sfxDoorOpen();
    // 進入下一層：事件增益/減益（atkMult/defMult/dmgMult）歸零，避免跨層無限堆疊。
    // 保留 hasRevival（商店復活符屬整趟持續）；ATK/DEF 藥水已寫進 base atk/def 不受影響。
    setPlayerState(p => p ? { ...p, buffs: { atkMult: 1, defMult: 1, dmgMult: 1, hasRevival: p.buffs?.hasRevival ?? false } } : p);
    setFloorsCleared(prev => Math.max(prev, floorIndex + 1));
    startFloor(floorIndex + 1);
  }, [floorIndex, startFloor]);

  // ── 分支操作（第 3 層）──────────────────────────────────
  const handleChooseBranch = useCallback((key) => {
    sfxPathSelect();
    setBranchChoice(key); // 選定即鎖
  }, []);

  const handleBranchNext = useCallback(() => {
    const room = branchSeq[branchStep];
    if (!room) return;
    sfxDoorOpen();
    enterRoom(room);
  }, [branchSeq, branchStep, enterRoom]);

  // ── 戰鬥結束 ────────────────────────────────────────────
  const claimBossReward = useCallback(async ({ battleId, monsterId }) => {
    const { createDungeonBossRewardClaim } = await import("../../lib/dungeonBossRewardDb");
    const claim = await createDungeonBossRewardClaim({ battleId, memberId:myId, monsterId });
    setBossRewardClaim(claim);
    setBossRewardRetry(null);
    return claim;
  }, [myId]);

  // 王房固定獎勵攤平成掉落清單，給結算畫面逐項列出（含卡片）
  const bossDropsFromEnvelope = useCallback((envelope) => {
    const fixed = envelope?.fixedReward;
    if (!fixed) return [];
    const drops = [];
    if (fixed.bossMaterial?.quantity > 0) {
      drops.push({ id:"bossMaterial", name:fixed.bossMaterial.name || "王怪素材", icon:"💎", count:fixed.bossMaterial.quantity });
    }
    if (fixed.bossMarks > 0) drops.push({ id:"bossMarks", name:"王之印記", icon:"🏅", count:fixed.bossMarks });
    if (fixed.runeFragment?.count > 0) drops.push({ id:"rune", name:"符文碎片", icon:"🔮", count:fixed.runeFragment.count });
    if (fixed.coins > 0) drops.push({ id:"coins", name:`金幣 ${fixed.coins.toLocaleString()}`, icon:"🪙", count:1 });
    if (envelope.card) drops.push({ id:"card", name:`怪物卡・${envelope.card.name}`, icon:"🃏", kind:"card", count:1 });
    return drops;
  }, []);

  const handleBattleDone = useCallback(async ({ won, member, battle }) => {
    // 戰後同步 HP/buff（用 ?? 避免 0 被復活）
    if (member) {
      setPlayerState(prev => prev ? {
        ...prev,
        hp:    member.hp    ?? prev.hp,
        maxHP: member.maxHP ?? prev.maxHP,
        atk:   member.atk   ?? prev.atk,
        def:   member.def   ?? prev.def,
        // 戰鬥中的增益（藥水/戰鬥buff）只對「該場戰鬥」有效：結束後不把倍率帶回，
        // 只保留事件增益(prev.buffs，換層才由 handleDescend 歸零) 與復活符消耗狀態。
        buffs: {
          ...prev.buffs,
          hasRevival: member.buffs?.hasRevival ?? prev.buffs?.hasRevival ?? false,
        },
      } : prev);
    }
    if (!won) {
      if (!isFromStorage) abandonExcavation(myId).catch(() => {});
      const diff = getExcavationDifficulty(difficultyTier);
      broadcastExpeditionFailure(profile?.name, diff?.label || "").catch(() => {});
      showResult(false, Math.max(floorsCleared, floorIndex));
      return;
    }
    const killedMonster = battle?.monster || pendingRoom?.monster;
    const killLoot = createExpeditionKillLoot(killedMonster, runLootMult);
    if (killLoot.chests.length > 0) {
      addChests(myId, killLoot.chests).catch(() => {});
      setRunLoot(previous => mergeExpeditionLoot(previous, killLoot));
    }
    // 每殺金幣（Tier 級距×5）＋射手 XP 即時入帳（王房獎勵另有 envelope,不重複——只對一般/精英房發）
    let killCoins = 0;
    let killArcherXP = 0;
    if (killedMonster && !isGuest && !["miniBoss", "boss"].includes(killedMonster.encounter)) {
      const kill = rollDungeonKillReward(killedMonster, { eliteMult: pendingRoom?.type === "elite_battle" ? 1.5 : 1 });
      if (kill) {
        killCoins = kill.coins;
        killArcherXP = kill.archerXP;
        addCoins(myId, kill.coins).catch(() => {});
        addArcherXP(myId, kill.archerXP).catch(() => {});
        // 累計起來給結算頁：這些是「已入帳」的部分，結算頁只是把它列出來，不再發一次
        setKillTotals(previous => ({
          coins: previous.coins + kill.coins,
          archerXP: previous.archerXP + kill.archerXP,
          kills: previous.kills + 1,
        }));
      }
    }
    const battleStats = collectBattleStats(battle?.log);
    setRunStats(previous => mergeExpeditionStats(previous, battleStats));
    // 整場射箭表現要用（結算頁的 X~M 分佈、命中率、評價）：把每一場的箭接起來
    const battleArrows = collectBattleArrows(battle?.log)[myId] || [];
    if (battleArrows.length) setRunArrows(previous => [...previous, ...battleArrows]);
    const defeatedMonster = battle?.monster || pendingRoom?.monster;
    if (defeatedMonster?.expansionVersion === 1
      && ["miniBoss", "boss"].includes(defeatedMonster.encounter)
      && battle?.id) {
      try {
        const claim = await claimBossReward({ battleId:battle.id, monsterId:defeatedMonster.id });
        // 王也要走單場結算（使用者規格：「擊倒王時也一樣」），按下一步才進補給箱領獎房
        setKillResult({
          monster: defeatedMonster,
          isBoss: true,
          bossDrops: bossDropsFromEnvelope(claim?.envelope),
          chests: killLoot.chests,
          coins: 0,          // 王房獎勵走 envelope，不重複發每殺金幣／XP
          archerXP: 0,
          lootMult: runLootMult,
          continueLabel: "前往戰利品房 →",
          self: {
            id: myId,
            name: profile?.nickname || profile?.name || "我",
            arrows: collectBattleArrows(battle?.log)[myId] || [],
            dmgDealt: battleStats[myId]?.dmgDealt || 0,
            dmgTaken: battleStats[myId]?.dmgTaken || 0,
            crits: battleStats[myId]?.crits || 0,
          },
        });
      } catch (error) {
        setBossRewardRetry({ battleId:battle.id, monsterId:defeatedMonster.id, error:error?.message || "王房獎勵同步失敗" });
        setPhase("boss_reward_retry");
      }
      return;
    }
    // 一般／精英怪：先停在單場結算畫面，玩家按「下一步」才進下一個房間。
    // 以前是直接 finishPendingRoom()，戰果只靠 4.5 秒的 toast 帶過（使用者要求改掉）。
    setKillResult({
      monster: killedMonster,
      chests: killLoot.chests,
      coins: killCoins,
      archerXP: killArcherXP,
      lootMult: runLootMult,
      self: {
        id: myId,
        name: profile?.nickname || profile?.name || "我",
        arrows: collectBattleArrows(battle?.log)[myId] || [],
        dmgDealt: battleStats[myId]?.dmgDealt || 0,
        dmgTaken: battleStats[myId]?.dmgTaken || 0,
        crits: battleStats[myId]?.crits || 0,
      },
    });
  }, [myId, isFromStorage, floorIndex, floorsCleared, difficultyTier, profile, pendingRoom, finishPendingRoom, showResult, claimBossReward, bossDropsFromEnvelope, runLootMult, isGuest]);

  const handleAbandon = useCallback(() => {
    if (!isFromStorage) abandonExcavation(myId).catch(() => {});
    clearActiveExpeditionProgress(myId).catch(() => {});
    onAbandonProp?.();
  }, [myId, isFromStorage, onAbandonProp]);

  // 寶藏房獎勵入袋（金幣 + 收藏品；一次性）
  const handleTreasureLoot = useCallback((loot) => {
    if (!loot) return;
    if (loot.coins > 0) addCoins(myId, loot.coins).catch(() => {});
    if (loot.arrowDew > 0) addArrowdew(myId, loot.arrowDew).catch(() => {});
    if (loot.material?.id) addMaterials(myId, [loot.material]).catch(() => {});
    if (loot.kingVault) grantKingVaultReward(myId, loot.kingVault).catch(() => {});
    // 地下城不掉怪物卡片（掉卡只保留在單人打怪 / 組隊）
    const treasureChestLoot = createExpeditionKillLoot(
      fixedBoss || monsterPool.boss || {
        id: "treasure_reward",
        name: "寶藏房",
        family,
        tier: ["common","rare","elite","fierce","boss","mythic"][difficultyTier - 1] || "common",
        variant: "boss",
      },
    );
    if (treasureChestLoot.chests.length > 0) {
      addChests(myId, treasureChestLoot.chests).catch(() => {});
    }
    if (loot.extraItem?.id) {
      import("../../lib/dungeonDb").then(({ addCollectibles }) => {
        addCollectibles(myId, [{ itemId: loot.extraItem.id, qty: 1 }]).catch(() => {});
      }).catch(() => {});
    }
    setRunLoot(previous => mergeExpeditionLoot(previous, treasureChestLoot, {
      bonusCoins: loot.coins || 0,
      bonusArrowDew: loot.arrowDew || 0,
      treasure: [
        ...(loot.material ? [{ ...loot.material, kind: "material" }] : []),
        ...(loot.extraItem ? [{ ...loot.extraItem, kind: "collectible" }] : []),
        ...(loot.arrowDew > 0
          ? [{ id: "arrowdew", name: `箭露 +${loot.arrowDew}`, icon: "💧", kind: "resource" }]
          : []),
      ],
    }));
  }, [myId, fixedBoss, monsterPool.boss, family, difficultyTier]);

  // 領取獎勵 + 儲存紀錄
  const handleFinish = useCallback(async () => {
    const rewards = resultRewards;
    if (!rewards) return;
    // 發放獎勵
    grantExpeditionRewards(myId, rewards).catch(() => {});
    clearActiveExpeditionProgress(myId).catch(() => {});
    // 儲存紀錄
    saveExpeditionRecord(myId, {
      family,
      difficulty: difficultyTier,
      isHidden,
      floorsCleared,
      won: wonLast,
      coins: rewards.coins,
      arrowDew: rewards.arrowDew,
      archerXP: rewards.archerXP,
    }).catch(() => {});

    // ── 遠征首殺判定 ────────────────────────────────────────
    if (wonLast) {
      const expeditionKey = `${family}_${["normal", "advanced", "hard", "hell"][difficultyTier - 1]}`;
      const diff = getExcavationDifficulty(difficultyTier);
      const FAMILY_MAP = { ghost:{e:"👻",l:"幽冥系"}, mountain:{e:"⛰️",l:"山嶺系"}, insect:{e:"🦋",l:"昆蟲系"}, workplace:{e:"💼",l:"職場系"}, exam:{e:"📝",l:"考試系"}, temple:{e:"🏛️",l:"神廟系"}, treasure:{e:"📦",l:"寶箱族"} };
      const f = FAMILY_MAP[family] || {e:"🏰",l:"遠征"};
      await trySetDungeonFirstClear(expeditionKey, myId, profile?.name || "射手", []).then(async fcResult => {
        if (fcResult.isFirst) {
          const trophy = getExpeditionFirstClearTrophy(family, difficultyTier);
          if (trophy) await addCollectibles(myId, [trophy]);
          addDungeonBroadcast(expeditionKey, `遠征-${f.l}`, diff?.label || `Lv.${difficultyTier}`, f.e, [], profile?.nickname || profile?.name || "射手").catch(() => {});
        }
      }).catch(() => {});
    }

    // 重置挖掘進度
    if (!isFromStorage) completeExcavation(myId).catch(() => {});
    onComplete?.();
    return true;
  }, [resultRewards, myId, isFromStorage, difficultyTier, floorsCleared, wonLast, family, isHidden, profile, onComplete]);

  // ── 本地房間文件（功能房共用，隨 playerState 即時更新）──
  const localRoomDoc = useMemo(() => {
    if (!playerState) return null;
    return {
      members: {
        [myId]: {
          name: profile?.nickname || profile?.name || "射手",
          hp: playerState.hp,
          maxHP: playerState.maxHP,
          atk: playerState.atk,
          def: playerState.def,
          alive: playerState.hp > 0,
          role: "front",
          buffs: playerState.buffs,
        },
      },
      roomConfirms: {},
      roomChoices: {},
      shopItems: pendingRoom?.shopItems || [],
      shopPurchases: {},
      currentEvent: pendingRoom?.event || null,
      mapDungeonId: `${family}_expedition`,
      activeRoomId: pendingRoom?.id || null,
    };
  }, [playerState, pendingRoom, myId, profile, family]);

  // ── 渲染 ────────────────────────────────────────────────

  // 單場擊殺結算：優先於所有 phase 畫面（此時 phase 還停在 battle）。
  // 按「下一步」才收掉並 finishPendingRoom() 進下一個房間。
  if (killResult) {
    return (
      <DungeonKillResult
        monster={killResult.monster}
        self={killResult.self}
        chests={killResult.chests}
        coins={killResult.coins}
        archerXP={killResult.archerXP}
        lootMult={killResult.lootMult}
        isBoss={killResult.isBoss}
        bossDrops={killResult.bossDrops}
        continueLabel={killResult.continueLabel || "下一步"}
        targetFmt={targetFmt}
        onContinue={() => { setKillResult(null); finishPendingRoom(); }}
      />
    );
  }

  if (phase === "entry_error") {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-white"
        style={{ background:"#0a0a0f" }}>
        <div className="text-5xl">⚠️</div>
        <div className="text-lg font-black">無法開始地下城</div>
        <div className="text-sm text-rose-300 text-center">{entryError}</div>
        <button onClick={onAbandonProp}
          className="px-6 py-3 rounded-xl bg-slate-700 font-bold">
          返回地下城選單
        </button>
      </div>
    );
  }

  if (phase === "floor_intro") {
    return (
      <FloorIntro
        floorIndex={floorIndex}
        difficultyTier={difficultyTier}
        onStart={() => setPhase(floorIndex < 2 ? "grid" : "branch")}
      />
    );
  }

  if (phase === "grid" && gridFloor && playerState) {
    return (
      <>
        <GridMapStage
          gridFloor={gridFloor}
          playerPos={playerPos}
          visitedIds={visitedIds}
          floorIndex={floorIndex}
          playerState={playerState}
          coins={coins}
          lootMult={runLootMult}
          onCellClick={handleCellClick}
          onEnterRoom={enterRoom}
          onDescend={handleDescend}
          onRetreat={handleAbandon}
          difficulty={difficultyTier}
          family={family}
        />
      </>
    );
  }

  if (phase === "branch" && branchFloor && playerState) {
    return (
      <>
        <BranchStage
          branchFloor={branchFloor}
          branchChoice={branchChoice}
          branchSeq={branchSeq}
          branchStep={branchStep}
          playerState={playerState}
          coins={coins}
          lootMult={runLootMult}
          onChoose={handleChooseBranch}
          onEnterNext={handleBranchNext}
          onRetreat={handleAbandon}
          difficulty={difficultyTier}
          family={family}
        />
      </>
    );
  }

  // 功能房（本地單人模式）
  if (phase === "func_room" && pendingRoom && localRoomDoc) {
    const common = {
      roomId: "local",
      room: localRoomDoc,
      memberId: myId,
      isHost: true,
      localMode: true,
      onLocalEffect: handleLocalEffect,
      onLocalDone: finishPendingRoom,
    };
    switch (pendingRoom.type) {
      case "shop":
        return (
          <DungeonShop
            {...common}
            memberData={{ id: myId, coins, hp: playerState.hp, maxHP: playerState.maxHP, buffs: playerState.buffs }}
            onLocalBuy={handleLocalBuy}
            boughtEffects={boughtOneTime}
          />
        );
      case "trap":
        return <DungeonTrap {...common} />;
      case "event":
      case "general_event":
        return <DungeonEvent {...common} event={pendingRoom?.event} />;
      case "chest":
        return <DungeonChest {...common} />;
      case "rest":
        return <DungeonRest {...common} />;
      default:
        // 不認得的房型：提供手動跳過（避免 render 期間觸發 setState）
        return (
          <div className="h-[100dvh] flex flex-col items-center justify-center gap-4 text-white/60"
            style={{ background:"#0a0a0f" }}>
            <div style={{ fontSize:40 }}>🗺️</div>
            <button onClick={finishPendingRoom}
              style={{ padding:"10px 28px", borderRadius:12, border:"none", cursor:"pointer",
                background:"#334155", color:"#e2e8f0", fontWeight:800 }}>
              繼續探索
            </button>
          </div>
        );
    }
  }

  // 寶藏房（第 3 層終點）
  if (phase === "boss_reward_retry" && bossRewardRetry) {
    return (
      <main className="min-h-[100dvh] bg-slate-950 px-5 text-white flex items-center justify-center">
        <div className="w-full max-w-sm rounded-3xl border border-rose-400/30 bg-slate-900 p-6 text-center">
          <div className="text-4xl" aria-hidden="true">📜</div>
          <h1 className="mt-3 text-xl font-black">戰利品尚未同步</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">戰鬥結果已保留，請重新同步；不會重複計算或遺失保底。</p>
          <div role="alert" className="mt-3 text-xs text-rose-300">{bossRewardRetry.error}</div>
          <button type="button" onClick={() => claimBossReward(bossRewardRetry).catch(error => setBossRewardRetry(current => ({ ...current, error:error?.message || "同步失敗" })))}
            className="mt-5 min-h-12 w-full rounded-2xl bg-amber-300 font-black text-slate-950">重新同步獎勵</button>
        </div>
      </main>
    );
  }

  if (phase === "treasure") {
    if (bossRewardClaim?.envelope) {
      return (
        <Suspense fallback={<div className="min-h-[100dvh] bg-slate-950 text-slate-400 flex items-center justify-center">正在整理王房戰利品…</div>}>
          <DungeonBossRewardRoom
            claimId={bossRewardClaim.claimId}
            envelope={bossRewardClaim.envelope}
            memberId={myId}
            onComplete={() => { sfxVictory(); showResult(true, 3); }}
          />
        </Suspense>
      );
    }
    return (
      <DungeonTreasureRoom
        difficultyTier={difficultyTier}
        family={family}
        onLoot={handleTreasureLoot}
        onClaim={() => { sfxVictory(); showResult(true, 3); }}
      />
    );
  }

  if (phase === "battle" && pendingRoom?.monster && playerState) {
    return (
      <>
      {/* 掉落倍率改顯示在樓層畫面的頂端狀態列（PlayerStatusBar），戰鬥中不再放浮動角標 */}
      <ExpeditionBattleRoom
        key={pendingRoom.id}
        memberData={{
          ...buildExpeditionMemberData(profile, cardBonus),
          id: myId,
          hp: playerState.hp,
          maxHP: playerState.maxHP,
          atk: playerState.atk,
          def: playerState.def,
          wbBonus: playerState.wbBonus,
          buffs: playerState.buffs,
        }}
        memberName={profile?.nickname || profile?.name || "射手"}
        monster={pendingRoom.monster}
        difficultyTier={difficultyTier}
        floorIndex={floorIndex}
        roomType={pendingRoom.type === "boss_battle" ? "boss" : pendingRoom.type === "elite_battle" ? "elite" : "monster"}
        arrowsPerRound={arrowsPerRound}
        targetFmt={targetFmt}
        onDone={handleBattleDone}
        onAbandon={handleAbandon}
        guestProfile={isGuest ? profile : undefined}
      />
      </>
    );
  }

  // ── 結算畫面 ────────────────────────────────────────────
  if (phase === "result") {
    if (!resultRewards) return null;
    return (
      <DungeonExpeditionResult
        won={wonLast}
        family={family}
        difficultyTier={difficultyTier}
        isHidden={isHidden}
        rewards={resultRewards}
        killTotals={killTotals}
        runArrows={runArrows}
        targetFmt={targetFmt}
        loot={runLoot}
        party={buildExpeditionParty({
          [myId]: {
            name: profile?.nickname || profile?.name || "射手",
            alive: playerState?.hp > 0,
          },
        }, myId, runStats)}
        boss={fixedBoss || monsterPool.boss}
        floorsCleared={floorsCleared}
        onFinish={handleFinish}
      />
    );
  }

  return (
    <div className="h-[100dvh] flex items-center justify-center text-white/40"
      style={{ background:"#0a0a0f" }}>
      載入遠征…
    </div>
  );
}
