// src/components/dungeon/DungeonBattleRoom.jsx — 地下城戰鬥室
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import { useFirestoreRound } from "../../battle/useFirestoreRound";
import { useMiniRoundReveal } from "../../battle/useMiniRoundReveal";
import CatMsg from "../cat/CatMsg";
import {
  subscribeDungeonRoom, submitDungeonArrows, processDungeonRound,
  forceSkipDungeonPlayer,
  clearDungeonProcessing, claimDungeonReward, returnToMapAfterBattle,
  trySetDungeonFirstClear, addDungeonBroadcast, setDungeonMemberRole,
} from "../../lib/dungeonDb";
import { resolveHitPart, MONSTERS, TIER_LABEL } from "../../lib/monsterData";
import { VARIANT_LABEL } from "../../lib/monsterRegistry";
import { calcDungeonContractDmg, getContractDesc, CONTRACT_TYPES, DUNGEON_MAPS } from "../../lib/dungeonData";
import { calcDungeonCounter } from "../../lib/damage";
import { recordBattleDex, addCoins, addMaterials, addChests, addPracticeLog, addArrowdew, addArcherXP, addGachaCoins, usePotions, addRoundArrows } from "../../lib/db";
import { DUNGEON_FLOOR_XP, MONSTER_TIER_XP } from "../../lib/archerLevel";
import { addCatXP } from "../../lib/catDb";
import { CAT_DUNGEON_FLOOR_XP } from "../../lib/catLevel";
import { rollCoins, rollMaterialDrop, rollMaterialDrops, openCoinChest, floorToMonsterTier, makeCoinChest } from "../../lib/lootTable";
import { rollRuneDrop, calcRuneBonus as calcRuneBonusFn } from "../../lib/runeData";
import { addRune, getEquippedRunes } from "../../lib/runeDb";
import { rollFamilyDrop, rollBossDrops, getFirstClearTrophy, COLLECTIBLE_MAP } from "../../lib/dungeonCollectibles";
import { addCollectibles } from "../../lib/dungeonDb";
import {
  sfxTap, sfxArrowShoot, sfxCast, sfxCounter, sfxCritBoom,
  sfxRoundEnd, sfxSuccess, sfxSoftFail, sfxMonsterDead, sfxPotionDrink, vibrate,
} from "../../lib/sound";
import DungeonShop from "./DungeonShop";
import DungeonEvent from "./DungeonEvent";
import CatRoundOverlay from "../cat/CatRoundOverlay";
import BattleBottomBar from "../member/BattleBottomBar";
import { getPotion } from "../../lib/itemData";
import { BattleHPBar, BattleArrowSlots, BattleStatusTags, BattleLogPanel } from "../shared/SharedBattleComponents";
import { BattleResultPanel, RESULT_CONFIG_DUNGEON } from "../shared/BattleResultPanel";
import { SCORE_MAP, SCORE_LABELS, SCORE_COLORS, SCORE_GATE_LABELS } from "../../lib/score";
import { getDungeonTargetLabel } from "../../lib/dungeonRunSettings";

// SCORE_MAP/SCORE_LABELS/SCORE_GATE_LABELS/SCORE_COLORS 統一由 ../../lib/score 管理

function calcContractDmgFn(arrows, atk, monsterDef, contract, dmgMult = 1) {
  return calcDungeonContractDmg(arrows, atk, monsterDef, contract, resolveHitPart, dmgMult);
}

function calcCtrFn(monsterAtk, archerDef) {
  return calcDungeonCounter(monsterAtk, archerDef);
}

const MONSTER_VARIANT_STYLE = {
  weak: {
    icon: "🔵",
    color: "#93c5fd",
    background: "rgba(37,99,235,0.2)",
    border: "rgba(96,165,250,0.55)",
    glow: "0 0 18px rgba(96,165,250,0.5), 0 0 36px rgba(96,165,250,0.2)",
  },
  normal: {
    icon: "⚪",
    color: "#e2e8f0",
    background: "rgba(100,116,139,0.22)",
    border: "rgba(148,163,184,0.45)",
    glow: "0 0 14px rgba(148,163,184,0.22)",
  },
  strong: {
    icon: "🔴",
    color: "#fdba74",
    background: "rgba(194,65,12,0.24)",
    border: "rgba(249,115,22,0.6)",
    glow: "0 0 18px rgba(239,68,68,0.5), 0 0 36px rgba(239,68,68,0.25), 0 0 54px rgba(249,115,22,0.15)",
  },
  boss: {
    icon: "👑",
    color: "#fda4af",
    background: "rgba(159,18,57,0.28)",
    border: "rgba(244,63,94,0.65)",
    glow: "0 0 22px rgba(244,63,94,0.6), 0 0 46px rgba(190,24,93,0.3)",
  },
};

function getMonsterVariantStyle(variant) {
  return MONSTER_VARIANT_STYLE[variant] || MONSTER_VARIANT_STYLE.normal;
}

function MonsterVariantBadge({ variant }) {
  const key = MONSTER_VARIANT_STYLE[variant] ? variant : "normal";
  const style = getMonsterVariantStyle(key);
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:3,
      padding:"2px 7px", borderRadius:999, flexShrink:0,
      fontSize:10, lineHeight:1.4, fontWeight:900,
      color:style.color, background:style.background,
      border:`1px solid ${style.border}`,
    }}>
      <span aria-hidden="true">{style.icon}</span>
      {VARIANT_LABEL[key]?.label || "普通"}
    </span>
  );
}

function DungeonMonsterImg({ id, icon, charge, hit, variant }) {
  const [err, setErr] = useState(false);
  const anim = charge ? "mb-charge 0.7s ease infinite" : hit ? "mb-monster-hit 0.5s ease" : undefined;
  const glowShadow = getMonsterVariantStyle(variant).glow;
  return err ? (
    <span style={{ fontSize:80, display:"block", textAlign:"center", animation:anim }}>{icon}</span>
  ) : (
    <div style={{ display:"inline-flex", position:"relative" }}>
      <img src={`/monsters/${id}.webp`} alt={icon} onError={() => setErr(true)}
        style={{ maxWidth:"82%", maxHeight:200, objectFit:"contain", animation:anim,
          boxShadow: glowShadow, borderRadius: 14, transition:"box-shadow 0.3s ease" }}/>
    </div>
  );
}

function HPBar({ current, max, color = "bg-emerald-500" }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) * 100 : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width:`${pct}%` }} />
    </div>
  );
}

function ContractBadge({ contract }) {
  if (!contract) return null;
  const info = CONTRACT_TYPES[contract.type];
  if (!info) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-white/10 ${info.bg} ${info.color} font-semibold`}>
      {info.icon} {info.name}
      {contract.param != null && <span>({contract.param})</span>}
    </span>
  );
}

function pickBg(family) {
  const idx = Math.ceil(Math.random() * 6);
  return family ? `/ui/battle-bg/bg_${family}_${idx}.webp` : `/ui/dungeon-bg.webp`;
}

export default function DungeonBattleRoom({ roomId, onExit, isMapMode = true, onReturnToMap, expeditionMode = false }) {
  const { profile } = useAuth();
  const { catMsg, clearCatMsg, triggerCatAction, saveBond, hasCat, catName: myCatName } = useCatCompanion();
  const myId        = profile?.id;
  const bondSavedRef         = useRef(false);
  const battleBgRef          = useRef(null);
  const claimLootRef         = useRef(null);  // loot preview locked on first render
  const firstClearCheckedRef = useRef(false);
  const roomRef              = useRef(null); // sync with hook's room for timeout closures

  // ── 統一 Firestore 回合生命週期 ────────────────────────────
  const {
    room: fsRoom,
    submitted,
    setSubmitted: setFsSubmitted,
    handleSubmit: fsHandleSubmit,
    localProcessing: submitting,
    allReady,
    readyCountdown,
    confirmNow,
  } = useFirestoreRound({
    roomId, myId,
    subscribe: subscribeDungeonRoom,
    submit: (roomId, id, arrows, choice) => submitDungeonArrows(roomId, id, arrows, choice),
    processRound: processDungeonRound,
    getMembers: (r) => Object.entries(r.members || {}).map(([id, m]) => ({ id, ...m })),
    isProcessing: (r) => r.processing,
    getRound: (r) => r.round || 1,
    getExtraProcessArgs: () => [calcContractDmgFn, calcCtrFn],
    processDelayMs: 1000,
    confirmDelayMs: 5000,
    maxRetries: 5,
    onBeforeSubmit: () => { sfxArrowShoot(); vibrate([10,10,10]); },
    onSubmitError: (reason) => { console.warn("[DungeonSubmit]", reason); },
    onSubmitSuccess: (submittedArrows) => {
      if (myId && Array.isArray(submittedArrows) && submittedArrows.length > 0) {
        addRoundArrows(myId, submittedArrows.length).catch(() => {});
      }
    },
  });
  const room = fsRoom;

  const [arrows,        setArrows]        = useState([]);
  const [rearChoice,    setRearChoice]    = useState(null); // "heal" | "dmg" | null（後衛選擇）
  const targetFmt = room?.targetFmt || "full_110";
  const [shopDone,      setShopDone]      = useState(false);
  const [localClaimed,  setLocalClaimed]  = useState(false); // 非房主領取後等待狀態
  const [controlsStarted, setControlsStarted] = useState(false); // 先點開始計分，再開啟底部控制列
  const [viewRearInInput, setViewRearInInput] = useState(false); // 輸入時後衛視角切換

  // ── 小回合動畫（useMiniRoundReveal 統一管理）───────────────
  const reveal = useMiniRoundReveal();
  const {
    liveEntry, liveMiniIdx,
    animHit, animMonsterCharge, animScreenShake,
    floatCounterDmgs, floatDmg, localHpOverride, attackingIds,
    setAttackingIds,
  } = reveal;
  // 回合結算覆蓋（動畫結束後顯示）
  const [showRoundResult,   setShowRoundResult]   = useState(false);
  const [firstClearBonus,   setFirstClearBonus]   = useState(null); // null=未檢查 false=非首殺 {coins}=首殺
  // 進場戰鬥動畫
  const [showEntryAnim,     setShowEntryAnim]     = useState(true); // 預設 true 防止閃爍
  const entryAnimFloorRef   = useRef(null); // 追蹤哪個房間已播過進場
  // 擊殺動畫
  const [showKillAnim,      setShowKillAnim]      = useState(false);
  const [killInfo,          setKillInfo]          = useState(null);   // { memberName, label, monsterName }
  const [showBattleLog,     setShowBattleLog]     = useState(false);
  const [bottomTab,           setBottomTab]           = useState("score");
  const [potionSubTab,        setPotionSubTab]        = useState("carry");
  const [scoringModeChosen,   setScoringModeChosen]   = useState(false);
  const [potionUsedThisRound, setPotionUsedThisRound] = useState(false);
  const [potionInv,          setPotionInv]           = useState(() => ({}));

  const logEndRef           = useRef(null);
  const lastAnimKeyRef      = useRef(null);
  const prevRoundKeyRef     = useRef(null); // "${floor}-${round}" 換回合才清箭
  const readySyncedRef      = useRef(false); // 重整後 ready 同步只做一次

  const isHost = room?.hostId === myId;
  const me     = room?.members?.[myId] || {};
  const status = room?.status;

  // 合約 Tailwind class → inline 可用 hex
  const CONTRACT_HEX = {
    standard:     "#cbd5e1",
    score_gate:   "#93c5fd",
    hit_count:    "#86efac",
    all_hit:      "#fde047",
    x_crit:       "#d8b4fe",
    target_score: "#fbbf24",
    reversal:     "#fb923c",
    odd_only:     "#67e8f9",
    even_only:    "#f9a8d4",
  };

  // Boss 房間偵測（地圖模式用）— 優先讀 generatedFloors
  const _dungeonForRoom  = isMapMode ? DUNGEON_MAPS.find(d => d.id === room?.mapDungeonId) : null;
  const _generatedFloors = room?.generatedFloors || null;
  const _curFloorData    = _generatedFloors
    ? (_generatedFloors[room?.mapFloorIndex || 0] || null)
    : _dungeonForRoom?.floors?.[room?.mapFloorIndex || 0];
  const _curRoomMeta    = _curFloorData?.rooms?.find(r => r.id === (room?.mapCurrentRoomId || ""));
  const isBossRoom      = _curRoomMeta?.type === "boss";

  // ── 訂閱：已遷移至 useFirestoreRound hook 內部管理 ────────────
  // 以下 effect 處理訂閱 callback 中的額外副作用

  // roomRef sync（供 timeout closures 讀取最新 room）
  useEffect(() => { roomRef.current = room; }, [room]);

  // 戰鬥背景圖
  useEffect(() => {
    if (room?.monster?.family && !battleBgRef.current) {
      battleBgRef.current = pickBg(room.monster.family);
    }
  }, [room?.monster?.family]);

  // 換回合時重置 submitted/arrows（Firestore round 變化）
  useEffect(() => {
    if (!room || room.status !== "active") return;
    const key = `${room.currentFloor || 1}-${room.round || 1}`;
    if (key !== prevRoundKeyRef.current) {
      prevRoundKeyRef.current = key;
      setFsSubmitted(false);
      setArrows([]);
    }
  }, [room?.status, room?.currentFloor, room?.round]); // eslint-disable-line

  // 返回地圖探索時重置結算狀態
  useEffect(() => {
    if (room?.status === "map_explore") {
      claimLootRef.current = null;
      firstClearCheckedRef.current = false;
      setFirstClearBonus(null);
    }
  }, [room?.status]); // eslint-disable-line

  // ── 進場戰鬥動畫（只在戰鬥剛開始時顯示一次）────────────
  // showEntryAnim 預設 true 防止首次渲染閃爍，
  // 此 effect 負責在不需要動畫時立即隱藏，需要時延遲隱藏。
  useEffect(() => {
    if (!room || room.status !== "active") {
      setShowEntryAnim(false);
      return;
    }
    // 地圖模式：用 roomId+roomId 區分每個房間；傳統模式：用樓層
    const animKey = isMapMode
      ? `${room.mapCurrentRoomId || room.currentFloor || 1}`
      : `${room.currentFloor || 1}`;
    if (animKey === entryAnimFloorRef.current) {
      setShowEntryAnim(false);
      return;
    }
    const logLen = room?.log?.length || 0;
    if (logLen > 0) { setShowEntryAnim(false); return; } // 重整後已有 log 不重播
    if ((room.round || 1) !== 1) { setShowEntryAnim(false); return; }
    entryAnimFloorRef.current = animKey;
    setShowEntryAnim(true);
    const t = setTimeout(() => setShowEntryAnim(false), 2800);
    return () => clearTimeout(t);
  }, [room?.status, room?.currentFloor, room?.mapCurrentRoomId]); // eslint-disable-line

  // ── 擊殺動畫自動轉場 ───────────────────────────────────
  // 擊殺後：Boss/普通房都跳過 RoundResultOverlay，直接進完成畫面
  // 因為 Firestore 已將 status 設為 "completed"，hide kill anim 後完成畫面自動渲染
  useEffect(() => {
    if (!showKillAnim) return;
    const t = setTimeout(() => {
      setShowKillAnim(false);
      // 不再 setShowRoundResult(true) — 擊殺後直接讓 status="completed" 渲染完成畫面
    }, 3000);
    return () => clearTimeout(t);
  }, [showKillAnim]);

  // ── 日誌捲底 ─────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }, [room?.log]);

  // ── processing 超時自動重置（15 秒仍卡住 → 強制清除 Firestore）────
  useEffect(() => {
    if (!isHost || !room?.processing) return;
    const t = setTimeout(() => {
      clearDungeonProcessing(roomId);
    }, 15000);
    return () => clearTimeout(t);
  }, [room?.processing, isHost, roomId]); // eslint-disable-line

  // ── 非房主：processing 卡住 12 秒 → 自動重置本地 submitted 讓玩家可重新輸入 ──
  useEffect(() => {
    if (isHost || !room?.processing) return;
    const t = setTimeout(() => {
      const r = roomRef.current;
      if (!r || r.status !== "active") return;
      setFsSubmitted(false);
      import("firebase/firestore").then(({ updateDoc, doc }) =>
        import("../../lib/firebase").then(({ db }) =>
          updateDoc(doc(db, "dungeonRooms", roomId), {
            [`members.${myId}.ready`]: false,
            [`members.${myId}.arrows`]: [],
          }).catch(() => {})
        )
      );
    }, 12000);
    return () => clearTimeout(t);
  }, [room?.processing, isHost, roomId, myId]); // eslint-disable-line

  // ── 同步 potionInv（room 更新時從 me.items 刷新）──────────────────
  useEffect(() => {
    const items = room?.members?.[myId]?.items;
    if (items) setPotionInv(items);
  }, [room?.members?.[myId]?.items]); // eslint-disable-line

  // ── 各自領取按鈕已取代此自動存檔（handleClaimSelf 處理所有獎勵）

  // ── 重整後同步：如果 Firestore 顯示已送出但本地未送出，重置 ready 讓玩家重來 ─
  useEffect(() => {
    if (!room || !myId || myId.startsWith("guest")) return;
    if (submitted) return;
    if (readySyncedRef.current) return;
    if (me.ready && room.status === "active") {
      readySyncedRef.current = true;
      import("firebase/firestore").then(({ updateDoc, doc }) =>
        import("../../lib/firebase").then(({ db }) =>
          updateDoc(doc(db, "dungeonRooms", roomId), {
            [`members.${myId}.ready`]: false,
            [`members.${myId}.arrows`]: [],
          }).catch(() => {})
        )
      );
    }
  }, [room?.status, submitted]); // eslint-disable-line

  // ── 進入新回合時觸發貓貓補助提示（整個回合只一次）────────────
  useEffect(() => {
    if (!room?.round || room?.status !== "active") return;
    triggerCatAction();
  }, [room?.round, room?.currentFloor]); // eslint-disable-line

  // ── 小回合動畫（新 log 到 → 逐箭播放，useMiniRoundReveal）──
  useEffect(() => {
    const len = room?.log?.length || 0;
    if (len === 0) return;
    const entry = room.log[len - 1];
    if (!entry) return;
    const key = `${room.currentFloor || 1}-${entry.round}`;
    if (key === lastAnimKeyRef.current) return;
    lastAnimKeyRef.current = key;

    setShowRoundResult(false);

    reveal.startReveal(entry, {
      key,
      members: room?.members || {},
      onMiniTick: (mini, idx) => {
        sfxArrowShoot();
        vibrate(8);
        if (!mini.isCounter) {
          const atkIds = new Set((mini.playerLog || []).filter(p => (p.dmg||0) > 0).map(p => p.id));
          if (atkIds.size > 0) {
            setAttackingIds(atkIds);
            setTimeout(() => setAttackingIds(new Set()), 500);
          }
        }
      },
      onCounterHit: (mini, idx) => {
        sfxCounter();
        vibrate([0, 35, 55, 30]);
      },
      onEntryEnd: (entry) => {
        const monsterDied = entry.monsterHPAfter <= 0;
        const allDead     = Object.values(room?.members || {}).every(m => !m.alive);
        if (monsterDied) {
          const lastHit = entry.lastHit;
          setKillInfo({
            memberName: lastHit?.memberName || "未知射手",
            label: lastHit?.label || "?",
            monsterName: room?.monster?.name || "",
          });
          setShowKillAnim(true);
          sfxMonsterDead();
          sfxSuccess();
        } else {
          if (allDead) { sfxSoftFail(); }
          else         { sfxRoundEnd(); }
          setShowRoundResult(true);
        }
      },
    });
    return () => reveal.stopReveal();
  }, [room?.log?.length, room?.currentFloor]); // eslint-disable-line

  // ── 首殺檢查（Boss 房通關時，提前顯示徽章用）─────────────────
  useEffect(() => {
    if (!isBossRoom || !isMapMode || !isHost) return;
    if (status !== "completed" || room?.result !== "win") return;
    if (firstClearCheckedRef.current) return;
    firstClearCheckedRef.current = true;
    const dungeonInfo = DUNGEON_MAPS.find(d => d.id === room?.mapDungeonId);
    if (!dungeonInfo) { setFirstClearBonus(false); return; }
    const teamNames = Object.values(room?.members || {}).map(m => m.name).filter(Boolean);
    trySetDungeonFirstClear(room.mapDungeonId, myId, me.name || "", teamNames).then(fcRes => {
      if (fcRes?.ok && fcRes?.isFirst) {
        setFirstClearBonus({ coins: 500, arrowdew: 50, gachaCoins: 5 });
        addDungeonBroadcast(room.mapDungeonId, dungeonInfo.name, dungeonInfo.difficultyLabel, dungeonInfo.emoji, teamNames).catch(() => {});
      } else {
        setFirstClearBonus(false);
      }
    }).catch(() => setFirstClearBonus(false));
  }, [status, room?.result]); // eslint-disable-line

  // 註：host processing 邏輯已移至 useFirestoreRound hook 內部管理
  // （包含 1000ms processDelayMs, guardRef, maxRetries, processing 防重複）
  // loading 狀態由 hook 的 submitting 處理

  // ── 藥水處理器 ────────────────────────────────────────────────
  function onCarryPotion(lv) {
    if (potionUsedThisRound) return;
    const count = (potionInv[lv.id] || 0);
    if (count <= 0) return;
    sfxPotionDrink();
    setPotionInv(prev => ({ ...prev, [lv.id]: (prev[lv.id]||0) - 1 }));
    setPotionUsedThisRound(true);
    const pot = getPotion(lv.id);
    if (pot && myId && !myId.startsWith("guest")) {
      usePotions(myId, [lv.id]).catch(() => {});
    }
    setBottomTab("score");
  }

  function onThrowPotion(p) {
    const _apr = room?.arrowsPerRound || 6;
    if (potionUsedThisRound || arrows.length >= _apr) return;
    const count = (potionInv[p.id] || 0);
    if (count <= 0) return;
    sfxCast();
    setPotionInv(prev => ({ ...prev, [p.id]: (prev[p.id]||0) - 1 }));
    setPotionUsedThisRound(true);
    if (myId && !myId.startsWith("guest")) {
      usePotions(myId, [p.id]).catch(() => {});
    }
    addArrow(p.id);
    setBottomTab("score");
  }

  async function handleSubmit() {
    const _apr = room?.arrowsPerRound || 6;
    if (arrows.length < _apr || submitted || submitting) return;
    const choice = me.role === "rear" ? (rearChoice || "dmg") : null;
    const ok = await fsHandleSubmit(arrows, choice);
    if (ok) {
      setRearChoice(null);
      setArrows([]);
    }
  }

  function addArrow(label) {
    if (arrows.length >= (room?.arrowsPerRound || 6)) return;
    sfxTap();
    const rawScore = label === "命中" ? 10 : (SCORE_MAP[label] ?? 0);
    const score = (targetFmt === "field_16" && rawScore > 0)
      ? Math.min(rawScore + 5, 10)
      : rawScore;
    setArrows(prev => [...prev, { label, score }]);
  }

  function undoArrow() {
    setArrows(prev => prev.slice(0, -1));
    if (submitted) setFsSubmitted(false);
  }

  // ── 各自領取獎勵（每人自己點自己的按鈕）─────────────────────
  async function handleClaimSelf() {
    if (expeditionMode) {
      // 遠征模式：不發放個人獎勵，僅跳轉（獎勵由遠征系統統一發放）
      if (isHost) {
        await returnToMapAfterBattle(roomId, room.mapCurrentRoomId || "", room.mapClearedIds || []).catch(() => {});
      } else {
        setLocalClaimed(true);
      }
      return;
    }

    if (myId?.startsWith("guest")) {
      // 訪客直接跳導航（訪客視為房主行為，不顯示等待畫面）
      if (isMapMode) {
        if (isBossRoom) { onReturnToMap?.(); }
        else { await returnToMapAfterBattle(roomId, room.mapCurrentRoomId || "", room.mapClearedIds || []).catch(() => {}); }
      } else { onExit?.({ preserve: true }); }
      return;
    }
    const goldMult      = room?.nextFloorModifiers?.goldMult || 1;
    const baseMaterials = rollMaterialDrops(room?.monster);
    const totalFloors   = isMapMode
      ? (isBossRoom ? (_generatedFloors?.length || _dungeonForRoom?.floorCount || 1) : 1)
      : (room.totalFloors || 7);

    // 自己的金幣/寶箱/素材/圖鑑
    const baseCoins = rollCoins(room?.monster?.tier || "common", 1);
    await claimDungeonReward(myId, baseCoins, goldMult);
    const memberChests = Array.from({ length: totalFloors }, (_, i) =>
      makeCoinChest(floorToMonsterTier(i + 1), `地下城第${i + 1}層`)
    );
    if (memberChests.length > 0) await addChests(myId, memberChests).catch(() => {});
    if (baseMaterials.length > 0) await addMaterials(myId, baseMaterials).catch(() => {});
    if (room.monster?.id) await recordBattleDex(myId, room.monster.id).catch(() => {});

    // 練習紀錄 + 箭露 + XP
    const practiceRounds = (room.log || []).map(entry => {
      const pl = (entry.playerLog || []).find(p => p.id === myId);
      return (pl?.arrowBreakdown || []).map(a =>
        a.label === "X" ? 10 : a.label === "M" ? 0 : (parseInt(a.label) || 0)
      );
    }).filter(r => r.length > 0);
    if (practiceRounds.length > 0) {
      const arrowCount = practiceRounds.flat().length;
      addPracticeLog(myId, {
        date: new Date().toISOString().slice(0, 10), source: "dungeon",
        monsterName: room.monster?.name || "地下城", result: "win",
        rounds: practiceRounds,
        total: practiceRounds.flat().reduce((s, v) => s + v, 0),
        totalArrows: arrowCount, totalFloors,
      }, myId).catch(() => {});
      if (arrowCount > 0) addArrowdew(myId, arrowCount).catch(() => {});
    }
    // XP 依怪物 tier 縮放（打怪模式標準）
    const monsterTierKey = room?.monster?.tier || "common";
    const tierXP = MONSTER_TIER_XP[monsterTierKey] || DUNGEON_FLOOR_XP;
    addArcherXP(myId, totalFloors * tierXP).catch(() => {});
    const _selfCatId = profile?.equippedCat?.catId;
    if (_selfCatId) addCatXP(myId, _selfCatId, totalFloors * CAT_DUNGEON_FLOOR_XP).catch(() => {});

    // 地圖模式稀有獎勵
    if (isMapMode) {
      if (isBossRoom) {
        addArrowdew(myId, totalFloors * 8).catch(() => {});
        addGachaCoins(myId, 2).catch(() => {});
        const dungeonMap2 = DUNGEON_MAPS.find(d => d.id === (room?.mapDungeonId || room?.dungeonId));
        const dungeonTier = { normal:1, hard:2, elite:3, nightmare:4 }[dungeonMap2?.difficulty] || 1;
        const droppedRune = rollRuneDrop(dungeonTier);
        if (droppedRune) addRune(myId, droppedRune.id, 1).catch(() => {});
        const collectDrops = [...(claimLootRef.current?.collectibles || [])];
        if (firstClearBonus && room?.mapDungeonId) {
          const trophy = getFirstClearTrophy(room.mapDungeonId);
          if (trophy) collectDrops.push(trophy);
        }
        if (collectDrops.length > 0) addCollectibles(myId, collectDrops).catch(() => {});
      } else {
        addArrowdew(myId, 5).catch(() => {});
        if (claimLootRef.current?.collectibles?.length) {
          addCollectibles(myId, claimLootRef.current.collectibles).catch(() => {});
        }
      }
    }

    // 首殺獎勵
    if (firstClearBonus) {
      if (firstClearBonus.coins)      addCoins(myId, firstClearBonus.coins).catch(() => {});
      if (firstClearBonus.arrowdew)   addArrowdew(myId, firstClearBonus.arrowdew).catch(() => {});
      if (firstClearBonus.gachaCoins) addGachaCoins(myId, firstClearBonus.gachaCoins).catch(() => {});
    }

    sfxSuccess();

    if (isBossRoom) {
      onReturnToMap?.();
    } else if (isHost) {
      // 只有房主呼叫，觸發 Firestore status→map_explore，全員跟著路由
      await returnToMapAfterBattle(roomId, room.mapCurrentRoomId || "", room.mapClearedIds || []).catch(() => {});
    } else {
      // 非房主：顯示等待房主畫面，DungeonController 訂閱 status 變化後自動路由
      setLocalClaimed(true);
    }
  }

  // ── path_select 處理 ──────────────────────────────────────
  // 經典模式（!isMapMode）：path_select 不可能發生（已移除），保留做 fallback
  // 地圖模式：path_select 是怪物擊殺後（非最後一層）的正常狀態，
  // 跳過中間 UI，由完成畫面處理（與 completed 共用渲染）
  if (!isMapMode && status === "path_select" && !liveEntry && !showRoundResult) {
    if (isHost) {
      returnToMapAfterBattle(roomId, room.mapCurrentRoomId || "", room.mapClearedIds || []);
    }
    return (
      <div style={{ minHeight:"100dvh", background:"#0a0a0f", color:"rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
        房間通關，返回地圖中…
      </div>
    );
  }

  // ── 商店 ───────────────────────────────────────────────────
  if (status === "shop") {
    return (
      <DungeonShop
        roomId={roomId} room={room}
        memberId={myId} memberData={{ ...me, coins: profile?.coins || 0 }}
        isHost={isHost}
        onDone={() => {
          setShopDone(true);
          if (isHost) {
            import("../../lib/dungeonDb").then(({ clearDungeonProcessing: _ }) =>
              import("firebase/firestore").then(({ updateDoc, doc }) =>
                import("../../lib/firebase").then(({ db }) =>
                  updateDoc(doc(db, "dungeonRooms", roomId), { status:"floor_transition" })
                )
              )
            );
          }
        }}
      />
    );
  }

  // ── 事件 ───────────────────────────────────────────────────
  if (status === "event") {
    return <DungeonEvent roomId={roomId} room={room} isHost={isHost} />;
  }

  // ── 完成畫面（等動畫和結算結束才顯示）─────────────────────
  // 檢查最新 log 是否已播完動畫（避免 Firestore 剛更新 status 但動畫未播時閃爍）
  const latestLogEntry = (room?.log || []).at(-1);
  const animKey = latestLogEntry ? `${room.currentFloor || 1}-${latestLogEntry.round}` : null;
  const hasNewAnim = animKey && animKey !== lastAnimKeyRef.current;

  if ((status === "completed" || (status === "path_select" && isMapMode))
    && !liveEntry && !showRoundResult && !showKillAnim && !hasNewAnim) {
    // 地圖模式 path_select = 怪物已被擊殺 = 勝利
    const isPathSelectWin = status === "path_select" && isMapMode;
    const won = isPathSelectWin || room?.result === "win";
    if (won && !bondSavedRef.current) { bondSavedRef.current = true; saveBond("dungeon"); }

    if (!won) {
      // 失敗結算畫面
      const floorsCleared = (room.currentFloor || 1) - 1;
      const allPlayerLogs  = (room.log || []).flatMap(e => e.playerLog || []);
      const maxSingleDmg   = allPlayerLogs.length
        ? Math.max(...allPlayerLogs.map(p => p.dmg || 0))
        : 0;
      // 安慰金幣箱：每通關一層給一個木幣箱
      const consolationChests = Array.from({ length: floorsCleared },
        (_, i) => ({ floor: i + 1, ...openCoinChest("common") }));
      const consolationCoins = consolationChests.reduce((s, c) => s + c.coins, 0);

      return (
        <div className="h-[100dvh] overflow-y-auto flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
          <div className="flex flex-col items-center px-6 pt-10 pb-6 text-center gap-4">
            <div className="text-7xl">💀</div>
            <div className="text-3xl font-black">全員陣亡</div>
            <div className="text-slate-400 text-sm">被《{room.monster?.icon}{room.monster?.name}》擊敗</div>
          </div>

          <div className="px-5 space-y-3 pb-8">
            {/* 探索成果 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="text-xs text-slate-400 font-bold mb-1">📊 探索成果</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-indigo-300">{room.currentFloor}</div>
                  <div className="text-xs text-slate-400 mt-0.5">到達層數</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-amber-300">{floorsCleared}</div>
                  <div className="text-xs text-slate-400 mt-0.5">通關層數</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-rose-300">{maxSingleDmg}</div>
                  <div className="text-xs text-slate-400 mt-0.5">本層最高單人傷</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-emerald-300">+{consolationCoins}</div>
                  <div className="text-xs text-slate-400 mt-0.5">探索金幣</div>
                </div>
              </div>
            </div>

            {/* 隊伍 */}
            {Object.keys(room.members || {}).length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-bold mb-2">🧙 隊伍成員</div>
                <div className="flex flex-wrap gap-2">
                  {Object.values(room.members || {}).map((m, i) => (
                    <div key={i} className={`text-sm px-3 py-1.5 rounded-xl border ${m.alive ? "border-emerald-500/30 bg-emerald-900/20 text-emerald-300" : "border-rose-500/30 bg-rose-900/20 text-rose-300"}`}>
                      {m.alive ? "🧙" : "💀"} {m.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 本層戰鬥紀錄摘要 */}
            {(room.log || []).length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-bold mb-2">⚔️ 本層戰鬥（{room.log.length} 回合）</div>
                <div className="space-y-1.5">
                  {(room.log || []).map((entry, i) => (
                    <div key={i} className="flex justify-between text-xs text-slate-300">
                      <span className="text-slate-500">第 {entry.round} 回合</span>
                      <span className="text-amber-300 font-bold">傷害 {entry.totalDmg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 安慰金幣箱 */}
            <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4">
              <div className="text-xs text-amber-300 font-bold mb-2">🎁 探索金幣箱（每通關一層各得一個）</div>
              {consolationChests.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {consolationChests.map((c, i) => (
                      <div key={i} className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1">
                        <span>{c.icon}</span>
                        <span className="text-xs text-slate-300">{c.name}</span>
                        <span className="text-xs text-amber-300 font-bold">+{c.coins}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-amber-300 font-black">💰 合計 +{consolationCoins} 金幣</div>
                </>
              ) : (
                <div className="text-xs text-slate-500">未通關任何一層，無探索獎勵</div>
              )}
            </div>

            <button onClick={async () => {
              // 儲存失敗紀錄
              if (myId && !myId.startsWith("guest")) {
                const practiceRounds = (room.log || []).map(entry => {
                  const pl = (entry.playerLog || []).find(p => p.id === myId);
                  return (pl?.arrowBreakdown || []).map(a =>
                    a.label === "X" ? 10 : a.label === "M" ? 0 : (parseInt(a.label) || 0)
                  );
                }).filter(r => r.length > 0);
                if (practiceRounds.length > 0) {
                  const arrowCount = practiceRounds.flat().length;
                  addPracticeLog(myId, {
                    date: new Date().toISOString().slice(0, 10), source: "dungeon",
                    monsterName: room.monster?.name || "地下城", result: "lose",
                    rounds: practiceRounds,
                    total: practiceRounds.flat().reduce((s, v) => s + v, 0),
                    totalArrows: arrowCount, floorsCleared,
                  }, myId).catch(() => {});
                  if (arrowCount > 0) addArrowdew(myId, arrowCount).catch(() => {});
                }
              }
              if (isMapMode) {
                // 非 Boss 房：回地圖重試或撤退（Firestore status→map_explore，Controller 自動路由）
                // Boss 房：地下城結束，離開
                if (isBossRoom) {
                  onReturnToMap?.();
                } else if (isHost) {
                  await returnToMapAfterBattle(
                    roomId, room.mapCurrentRoomId || "", room.mapClearedIds || [], false
                  ).catch(() => {});
                } else {
                  setLocalClaimed(true);
                }
              } else {
                onExit?.({ preserve: true });
              }
            }}
              className="w-full py-4 rounded-2xl font-black bg-white/10 text-slate-300 text-lg active:scale-95">
              {isMapMode ? "返回地圖" : "返回大廳"}
            </button>
          </div>
        </div>
      );
    }

    // 鎖定掉寶預覽（Boss 房渲染時計算一次；path_select 也計算）
      if (!claimLootRef.current && room.monster && (status === "completed" || status === "path_select")) {
        const gm        = room?.nextFloorModifiers?.goldMult || 1;
        const tier       = room.monster.tier || "common";
        const tf         = isBossRoom ? (_generatedFloors?.length || _dungeonForRoom?.floorCount || 1) : 1;
        const myRunes    = getEquippedRunes(room, myId);
        const rb         = calcRuneBonusFn(myRunes);
        const dungeonMap = DUNGEON_MAPS.find(d => d.id === (room?.mapDungeonId || room?.dungeonId));
        const family     = dungeonMap?.family || "ghost";
        const roomType   = room?.mapCurrentRoomType || (isBossRoom ? "boss" : "monster");
        // 人數獎勵倍率（從 Firestore 存的 rewardMult 讀取，fallback 自己算）
        const rewardMult = room?.rewardMult || (1 + (Object.keys(room?.members || {}).length - 1) * 0.2);
        const collectibles = isBossRoom
          ? rollBossDrops(family, dungeonMap?.difficulty, rewardMult)
          : [rollFamilyDrop(family, roomType === "chest" ? "chest" : roomType === "elite" ? "elite" : "monster", rewardMult)].filter(Boolean);
        const previewTierXP = MONSTER_TIER_XP[tier] || DUNGEON_FLOOR_XP;
        claimLootRef.current = {
          coins:      Math.round(rollCoins(tier, 1) * gm * rewardMult * (isBossRoom ? 2 : 1) * rb.goldMult),
          materials:  rollMaterialDrops(room.monster),
          archerXP:   Math.round(tf * previewTierXP * rewardMult * rb.xpMult),
          catXP:      profile?.equippedCat?.catId ? Math.round(tf * CAT_DUNGEON_FLOOR_XP * rewardMult * rb.xpMult) : 0,
          chestCount: tf,
          arrowdew:   isBossRoom ? tf * 8 : 5,
          gachaCoins: isBossRoom ? 2 : 0,
          runeDrop:   isBossRoom ? rollRuneDrop({ normal:1, hard:2, elite:3, nightmare:4 }[dungeonMap?.difficulty] || 1) : null,
          collectibles,
        };
      }
      const loot        = claimLootRef.current;
      const memberList  = Object.entries(room.members || {});
      const hostMember  = memberList.find(([id]) => id === room.hostId);
      const otherMembers = memberList.filter(([id]) => id !== room.hostId);

      if (isBossRoom) {
        // ── 地下城首領通關 → 詳細結算畫面 ─────────────────────
        const totalFloors = _generatedFloors?.length || _dungeonForRoom?.floorCount || 1;
        return (
          <div className="h-[100dvh] overflow-y-auto text-white pb-10"
            style={{ background:"linear-gradient(160deg,#1c0a04,#0f172a,#0a0f1a)" }}>

            {/* 標題 */}
            <div className="text-center pt-8 pb-4 px-5">
              <div style={{ fontSize:72 }}>🏆</div>
              <div className="text-3xl font-black mt-2">地下城通關！</div>
              {_dungeonForRoom && (
                <div className="text-amber-300 font-bold text-lg mt-1">
                  {_dungeonForRoom.emoji} {_dungeonForRoom.name}（{_dungeonForRoom.difficultyLabel}）
                </div>
              )}
              <div className="text-slate-400 text-sm mt-1">全 {totalFloors} 層探索完成，首領已擊敗！</div>
              {firstClearBonus && (
                <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full font-black text-sm"
                  style={{ background:"rgba(245,158,11,0.2)", border:"1px solid rgba(245,158,11,0.5)", color:"#fcd34d" }}>
                  🌟 首殺！+{firstClearBonus.coins} 金幣 +{firstClearBonus.gachaCoins} 扭蛋幣 +{firstClearBonus.arrowdew} 箭露
                </div>
              )}
            </div>

            <div className="px-5 space-y-3">
              {/* 首領資訊 */}
              {room.monster && (
                <div className="rounded-2xl p-3 flex items-center gap-3"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)" }}>
                  <span style={{ fontSize:32 }}>{room.monster.icon}</span>
                  <div>
                    <div className="font-black text-sm text-white">擊敗首領：{room.monster.name}</div>
                    <div className="text-xs text-slate-400">{TIER_LABEL[room.monster.tier]?.label || room.monster.tier}</div>
                  </div>
                </div>
              )}

              {/* 參戰成員 */}
              {memberList.length > 0 && (
                <div className="rounded-2xl p-3"
                  style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
                  <div className="text-xs text-slate-400 font-bold mb-2">👥 參戰成員</div>
                  <div className="flex flex-wrap gap-2">
                    {hostMember && (
                      <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
                        style={{ background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.35)" }}>
                        <span className="text-xs">⭐</span>
                        <span className="text-sm font-bold" style={{ color:"#fcd34d" }}>{hostMember[1].name}</span>
                        <span className="text-xs" style={{ color:"rgba(252,211,77,0.6)" }}>隊長</span>
                      </div>
                    )}
                    {otherMembers.map(([id, m]) => (
                      <div key={id} className="flex items-center gap-1.5 rounded-full px-3 py-1"
                        style={{ background:"rgba(255,255,255,0.08)" }}>
                        <span className="text-xs">{m.role === "rear" ? "🛡️" : "⚔️"}</span>
                        <span className="text-sm font-bold">{m.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 獎勵明細 */}
              {loot && (
                <div className="rounded-2xl p-4 space-y-2"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)" }}>
                  <div className="text-xs text-slate-400 font-bold mb-3">📊 獎勵明細</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">🏹 射手經驗</span>
                    <span className="font-black" style={{ color:"#7dd3fc" }}>+{loot.archerXP} XP</span>
                  </div>
                  {loot.catXP > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">🐱 貓貓經驗</span>
                      <span className="font-black" style={{ color:"#f9a8d4" }}>+{loot.catXP} XP</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">💰 金幣 <span className="text-xs" style={{ color:"#fbbf24" }}>×2 通關</span></span>
                    <span className="font-black" style={{ color:"#fcd34d" }}>+{loot.coins.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">📦 寶箱</span>
                    <span className="font-black" style={{ color:"#4ade80" }}>{loot.chestCount} 個（各層各一）</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">💧 箭露</span>
                    <span className="font-black" style={{ color:"#38bdf8" }}>+{loot.arrowdew}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">🎰 扭蛋幣</span>
                    <span className="font-black" style={{ color:"#e879f9" }}>+{loot.gachaCoins}</span>
                  </div>
                  {firstClearBonus && (
                    <div className="flex items-center justify-between text-sm pt-2"
                      style={{ borderTop:"1px solid rgba(255,255,255,0.1)" }}>
                      <span className="text-slate-300">🌟 首殺加碼</span>
                      <span className="font-black" style={{ color:"#fcd34d" }}>+{firstClearBonus.coins} 金 · +{firstClearBonus.gachaCoins} 扭蛋 · +{firstClearBonus.arrowdew} 箭露</span>
                    </div>
                  )}
                  {loot.materials.length > 0 && (
                    <div className="pt-2" style={{ borderTop:"1px solid rgba(255,255,255,0.1)" }}>
                      <div className="text-xs text-slate-400 mb-2">素材掉落</div>
                      <div className="flex flex-wrap gap-1.5">
                        {loot.materials.map((m, i) => (
                          <span key={i} className="text-xs rounded-full px-2 py-0.5"
                            style={{ background:"rgba(255,255,255,0.08)", color:"#cbd5e1" }}>
                            {m.icon} {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 收藏品掉落 */}
              {((loot?.collectibles?.length > 0) || firstClearBonus) && (
                <div className="rounded-2xl p-4 space-y-2"
                  style={{ background:"rgba(168,85,247,0.07)", border:"1px solid rgba(168,85,247,0.25)" }}>
                  <div className="text-xs font-bold mb-3" style={{ color:"#c084fc" }}>🔮 收藏品掉落</div>
                  {(loot?.collectibles || []).map((drop, i) => {
                    const item = COLLECTIBLE_MAP[drop.itemId];
                    if (!item) return null;
                    const isSuperRare = item.rarity === "superRare";
                    return (
                      <div key={i} className="flex items-center gap-3"
                        style={isSuperRare ? { background:"rgba(250,204,21,0.08)", borderRadius:8, padding:"6px 8px" } : {}}>
                        <span style={{ fontSize:28 }}>{item.icon}</span>
                        <div>
                          <div className="text-sm font-black" style={{ color: isSuperRare ? "#fde047" : "#fff" }}>{item.name}
                            {isSuperRare
                              ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full"
                                  style={{ background:"rgba(250,204,21,0.3)", color:"#fde047" }}>✦ 超稀有</span>
                              : <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full"
                                  style={{ background:"rgba(168,85,247,0.3)", color:"#d8b4fe" }}>Boss 掉落</span>
                            }
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                  {firstClearBonus && room?.mapDungeonId && (() => {
                    const trophy = getFirstClearTrophy(room.mapDungeonId);
                    const item = trophy ? COLLECTIBLE_MAP[trophy.itemId] : null;
                    return item ? (
                      <div className="flex items-center gap-3 pt-2" style={{ borderTop:"1px solid rgba(168,85,247,0.2)" }}>
                        <span style={{ fontSize:28 }}>{item.icon}</span>
                        <div>
                          <div className="text-sm font-black" style={{ color:"#fcd34d" }}>{item.name}
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background:"rgba(245,158,11,0.3)", color:"#fde68a" }}>★ 首殺限定</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            <div className="px-5 mt-5">
              <button onClick={handleClaimSelf}
                className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-lg active:scale-95 transition-transform"
                style={{ background:"linear-gradient(90deg,#f59e0b,#ef4444)" }}>
                🎊 領取獎勵並返回大廳
              </button>
            </div>
          </div>
        );
      }

    // ── 普通房間通關 ───────────────────────────────────────
      return (
        <div className="h-[100dvh] overflow-y-auto text-white pb-8"
          style={{ background:"linear-gradient(160deg,#0f172a,#1e1b4b)" }}>
          <div className="text-center pt-8 pb-4 px-5">
            <div style={{ fontSize:64 }}>✨</div>
            <div className="text-3xl font-black mt-2">房間通關！</div>
            <div className="text-sm mt-1 text-slate-400">
              擊敗 {room.monster?.icon}{room.monster?.name}，繼續探索地圖
            </div>
          </div>

          <div className="px-5 space-y-3">
            {(() => {
              // 從 room.log 嘗試提取個人傷害統計
              const logs = room.log || [];
              const totalDmg = logs.reduce((sum, entry) => {
                const p = (entry.playerLog || []).find(pl => pl.id === myId);
                return sum + (p?.dmg || 0);
              }, 0);
              const dungeonRoomStats = totalDmg > 0 ? { dmgDealt: totalDmg } : null;

              const dungeonRoomData = {
                monster: room.monster || null,
                drops: loot ? {
                  coins:     loot.coins    || 0,
                  materials: loot.materials || [],
                  arrowDew:  loot.arrowdew  || 0,
                  chest:     (loot.chestCount || 0) > 0,
                } : null,
                stats: dungeonRoomStats,
              };

              const dungeonRoomConfig = {
                ...RESULT_CONFIG_DUNGEON,
                showIsDungeonBoss: false,
                showSpecialItem:   false,
                showDmgTaken:      false,
                showAvgScore:      false,
                showCritCount:     false,
                showArrowCount:    false,
                showRoundCount:    false,
                showScoreBreakdown:false,
                showPartyMembers:  false,
                showPartyLeader:   false,
                showDmgDealt:      !!dungeonRoomStats?.dmgDealt,
                showGoldChest:     false,
                showCard:          false,
              };

              return (
                <>
                  <BattleResultPanel data={dungeonRoomData} config={dungeonRoomConfig} />

                  {/* 經驗 + 扭蛋幣（BattleResultPanel 不支援的欄位） */}
                  {loot && (loot.archerXP > 0 || loot.catXP > 0 || loot.gachaCoins > 0) && (
                    <div className="rounded-2xl p-3 space-y-1.5"
                      style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
                      <div className="text-xs text-slate-400 font-bold mb-2">✨ 經驗獎勵</div>
                      {loot.archerXP > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">🏹 射手 XP</span>
                          <span className="font-black" style={{ color:"#7dd3fc" }}>+{loot.archerXP}</span>
                        </div>
                      )}
                      {loot.catXP > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">🐱 貓貓 XP</span>
                          <span className="font-black" style={{ color:"#f9a8d4" }}>+{loot.catXP}</span>
                        </div>
                      )}
                      {loot.gachaCoins > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">🎰 扭蛋幣</span>
                          <span className="font-black" style={{ color:"#e879f9" }}>+{loot.gachaCoins}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 收藏品掉落 */}
                  {loot?.collectibles && loot.collectibles.length > 0 && (
                    <div className="rounded-2xl p-4 space-y-2"
                      style={{ background:"rgba(168,85,247,0.07)", border:"1px solid rgba(168,85,247,0.25)" }}>
                      <div className="text-xs font-bold mb-2" style={{ color:"#c084fc" }}>🔮 收藏品掉落</div>
                      {loot.collectibles.map((drop, i) => {
                        const item = COLLECTIBLE_MAP[drop.itemId];
                        return item ? (
                          <div key={i} className="flex items-center gap-2">
                            <span style={{ fontSize:20 }}>{item.icon}</span>
                            <div>
                              <span className="text-xs font-black text-purple-300">{item.name}</span>
                              <span className="ml-1.5 text-[10px] text-slate-500">收藏品</span>
                            </div>
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </>
              );
            })()}

            <button onClick={handleClaimSelf}
              className="w-full py-4 rounded-2xl font-black text-lg text-white shadow-lg active:scale-95"
              style={{ background:"linear-gradient(90deg,#7c3aed,#8b5cf6)" }}>
              🗺️ 領取獎勵並回地圖
            </button>
          </div>
        </div>
      );
  }

  if (!room) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-900 text-slate-400">
        等待房間資料…
      </div>
    );
  }

  if (status === "waiting") {
    return (
      <div style={{ minHeight:"100dvh", background:"#0f172a", color:"white", display:"flex", flexDirection:"column", padding:"20px 16px", gap:12 }}>
        <div style={{ fontWeight:900, fontSize:16, color:"#fbbf24" }}>⚔️ 地下城戰鬥準備</div>
        <div style={{ fontSize:12, color:"#94a3b8" }}>
          本場規則：{room?.arrowsPerRound || 6} 箭／回合 · {getDungeonTargetLabel(targetFmt)}
        </div>
        <div style={{ color:"#64748b", fontSize:13 }}>等待房主開始戰鬥…</div>
      </div>
    );
  }

  // ── 主體 ───────────────────────────────────────────────────
  const members     = room.members || {};
  const aliveIds    = Object.keys(members).filter(id => members[id].alive);
  const isDead      = me.alive === false;
  const monster     = room.monster || {};
  const entryCatId  = me.catId || profile?.equippedCat?.catId || "";
  const entryCatName = me.catName || profile?.equippedCat?.name || "";
  const myContract  = me.contract || { type:"standard", param:null };
  const contractInfo= CONTRACT_TYPES[myContract.type] || CONTRACT_TYPES.standard;

  // 動畫中用小回合 HP；否則用 Firestore 值
  const curMini      = liveEntry?.miniRounds?.[liveMiniIdx];
  const displayHP    = liveEntry ? (curMini?.monsterHPAfter ?? room.monsterHP) : room.monsterHP;
  const lastEntry    = (room.log || []).at(-1);
  const isCatMini    = !!(curMini?.isCat);
  const catOverlayCats = (isCatMini && curMini?.playerLog)
    ? curMini.playerLog.map(p => ({
        catId:   members[p.id]?.catId || "baobao",
        catName: p.catName || p.name || "貓貓",
        dmg:     p.dmg || 0,
      }))
    : [];

  // 前後排成員分配
  const memberList = Object.entries(members)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => {
      if (a.id === myId) return -1;
      if (b.id === myId) return 1;
      if (a.id === room.hostId) return -1;
      if (b.id === room.hostId) return 1;
      return a.id < b.id ? -1 : 1;
    });
  const memberCount  = memberList.length;
  const aliveCount   = memberList.filter(m => m.alive).length;
  const isAnimating  = !!liveEntry;

  // 顯示分組（displayGroup 優先；動畫中用 displayGroupsBefore 防止回合中途跳位）
  const dgOf = (m) =>
    (liveEntry?.displayGroupsBefore?.[m.id]) ?? (m.displayGroup ?? m.role ?? "front");

  const frontDisplayMembers = memberList.filter(m => dgOf(m) !== "rear");
  const rearDisplayMembers  = memberList.filter(m => dgOf(m) === "rear");

  // 我的視角分組
  const myDisplayGroup   = (liveEntry?.displayGroupsBefore?.[myId]) ?? (me?.displayGroup ?? me?.role ?? "front");
  const myRowMembers     = myDisplayGroup === "rear" ? rearDisplayMembers  : frontDisplayMembers;
  const otherRowMembers  = myDisplayGroup === "rear" ? frontDisplayMembers : rearDisplayMembers;

  // 卡片寬度
  const myRowW    = Math.min(120, Math.floor((528 - Math.max(0, myRowMembers.length   - 1) * 3) / (myRowMembers.length   || 1)));
  const otherRowW = Math.min(76,  Math.floor((528 - Math.max(0, otherRowMembers.length - 1) * 3) / (otherRowMembers.length || 1)));

  // 輸入視角切換（Bug 3b）
  const hasRearMembers = rearDisplayMembers.length > 0;
  const displayedRowMembers = (!liveEntry && !submitted && viewRearInInput && hasRearMembers)
    ? rearDisplayMembers : myRowMembers;
  const displayRowW = Math.min(120, Math.floor((528 - Math.max(0, displayedRowMembers.length - 1) * 3) / (displayedRowMembers.length || 1)));

  function handleLeave() {
    onExit?.({ preserve: true });
  }

  return (
    <div style={{
      position:"fixed", top:0, bottom:0, left:"50%", transform:"translateX(-50%)",
      width:"100%", maxWidth:540, zIndex:9999, overflow:"hidden",
      backgroundImage:`url(${battleBgRef.current || "/ui/dungeon-bg.webp"})`, backgroundSize:"cover", backgroundPosition:"center",
      display:"flex", flexDirection:"column", fontFamily:"sans-serif",
    }}>
      <style>{`
@keyframes mb-float{0%{transform:translateY(0) scale(1.15);opacity:1}100%{transform:translateY(-70px) scale(0.80);opacity:0}}
@keyframes mb-miss{0%{transform:translateY(0) scale(1.1);opacity:1}100%{transform:translateY(-55px) scale(0.65);opacity:0}}
@keyframes mb-charge{0%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.35) rotate(-12deg)}60%{transform:scale(1.5) rotate(0deg)}80%{transform:scale(1.35) rotate(10deg)}100%{transform:scale(1) rotate(0deg)}}
@keyframes mb-screen-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}80%{transform:translateX(-3px)}}
@keyframes mb-monster-hit{0%{filter:brightness(1)}40%{filter:brightness(2) saturate(0)}100%{filter:brightness(1)}}
@keyframes mb-archer-attack{0%{transform:translateX(0)}30%{transform:translateX(8px)}60%{transform:translateX(-3px)}100%{transform:translateX(0)}}
@keyframes db-archer-atk{0%{transform:translateY(0) scale(1)}30%{transform:translateY(-16px) scale(1.12)}65%{transform:translateY(-8px) scale(1.05)}100%{transform:translateY(0) scale(1)}}
@keyframes db-intro-archer{0%{opacity:0;transform:translateX(-90px) scale(0.6)}100%{opacity:1;transform:translateX(0) scale(1)}}
@keyframes db-intro-monster{0%{opacity:0;transform:translateX(90px) scale(0.6)}100%{opacity:1;transform:translateX(0) scale(1)}}
@keyframes db-intro-vs{0%{opacity:0;transform:scale(0.2) rotate(-18deg)}55%{transform:scale(1.3) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes db-intro-start{0%{opacity:0;transform:translateY(18px) scale(0.85)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes db-die-monster{0%{filter:brightness(1)}20%{filter:brightness(3.5) drop-shadow(0 0 40px #ef4444)}100%{filter:brightness(0.1) grayscale(0.8) drop-shadow(0 0 6px #555)}}
@keyframes db-die-badge{0%{opacity:0;transform:scale(2.2) rotate(-20deg)}55%{opacity:1;transform:scale(0.92) rotate(6deg)}100%{opacity:1;transform:scale(1) rotate(-8deg)}}
@keyframes db-die-victory{0%{opacity:0;transform:scale(0.3) rotate(-12deg)}55%{transform:scale(1.2) rotate(3deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
@keyframes db-die-stats{0%{opacity:0;transform:translateY(14px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

      <CatMsg msg={catMsg} onDone={clearCatMsg}/>
      <CatRoundOverlay
        open={!!liveEntry && isCatMini}
        cats={catOverlayCats}
        totalDmg={curMini?.totalDmg}
      />

      {/* ── 頂部 HUD ── */}
      {isHost && (
        <button onClick={() => clearDungeonProcessing(roomId)}
          style={{ position:"fixed", top:56, right:12, zIndex:100, fontSize:9, padding:"2px 8px", borderRadius:4, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", color:"#fca5a5", cursor:"pointer", lineHeight:"18px" }}>
          ⚙️ 強制重置
        </button>
      )}
      <div style={{ flexShrink:0, background:"rgba(0,0,0,0.78)", zIndex:2, borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"4px 10px 5px" }}>
        {/* 第一行：怪物名稱 + 等級徽章 + 離開 */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontSize:15, fontWeight:900, color:monster.accent||"#f59e0b", textShadow:"0 2px 8px #000" }}>{monster.name||"怪物"}</span>
            {monster.tier && (() => {
              const tl = TIER_LABEL[monster.tier] || {};
              return (
                <span style={{ fontSize:10, fontWeight:700, color:"white", background:tl.color||"#6b7280", borderRadius:4, padding:"1px 5px" }}>
                  {tl.label||monster.tier}
                </span>
              );
            })()}
            <MonsterVariantBadge variant={monster.variant} />
          </div>
          <div style={{ display:"flex", gap:4 }}>
            <button onClick={() => setShowBattleLog(v => !v)}
              style={{ background: showBattleLog?"rgba(251,191,36,0.2)":"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color: showBattleLog?"#fbbf24":"rgba(255,255,255,0.55)", borderRadius:7, padding:"1px 8px", fontSize:11, cursor:"pointer" }}>
              📜
            </button>
            <button onClick={handleLeave}
              style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color:"rgba(255,255,255,0.55)", borderRadius:7, padding:"1px 8px", fontSize:11, cursor:"pointer" }}>
              離開
            </button>
          </div>
        </div>
        <BattleHPBar current={displayHP} max={room.monsterMaxHP || 0} />            {/* 樓層強度 & 獎勵指示器 */}
            {(() => {
              const rewardMult = room?.rewardMult || 1;
              const floor = room?.currentFloor || 1;
              const total = room?.totalFloors || 7;
              const isLastFloor = floor >= total;
              const rewardPct = Math.round((rewardMult - 1) * 100);
              return (
                <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, color:"#94a3b8", background:"rgba(0,0,0,0.35)", borderRadius:5, padding:"1px 7px", display:"inline-flex", alignItems:"center", gap:3 }}>
                    🏰 {floor}/{total}層 R{room?.round||1}
                  </span>
                  <span style={{ fontSize:10, color:"#fcd34d", background:"rgba(251,192,45,0.12)", borderRadius:5, padding:"1px 7px", display:"inline-flex", alignItems:"center", gap:3 }}>
                    ✦ {rewardPct >= 0 ? `+${rewardPct}%` : `${rewardPct}%`}獎勵
                  </span>
                  <span style={{ fontSize:10, color:isLastFloor?"#f87171":"#60a5fa", background:"rgba(255,255,255,0.06)", borderRadius:5, padding:"1px 7px", display:"inline-flex", alignItems:"center", gap:3 }}>
                    {isLastFloor ? "👑 Boss" : `⚔️ 層${floor}`}
                  </span>
                  {isLastFloor && room?.isBossRoom && (
                    <span style={{ fontSize:10, color:"#fbbf24", background:"rgba(251,191,36,0.15)", borderRadius:5, padding:"1px 7px", fontWeight:900 }}>
                      🏆 首領戰
                    </span>
                  )}
                </div>
              );
            })()}
            <BattleStatusTags tags={[
              { icon:"⚔️", label:monster.atk||0, color:"#f87171", bg:"rgba(239,68,68,0.15)" },
              { icon:"🛡️", label:monster.def||0, color:"#60a5fa", bg:"rgba(59,130,246,0.15)" },
              { icon:"👤", label:`${aliveCount}/${memberCount}`, color:"#94a3b8" },
              { icon:contractInfo.icon, label:contractInfo.name, color:CONTRACT_HEX[myContract.type]||"#cbd5e1", bg:"rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.12)" },
            ]} />
      </div>

      {/* ── 怪物展示區 ── */}
      <div style={{ flex:"1 1 0", position:"relative", minHeight:0, overflow:"hidden", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:6 }}>
        <DungeonMonsterImg id={monster.id} icon={monster.icon} charge={animMonsterCharge} hit={animHit} variant={monster.variant}/>
        {/* 浮動傷害 */}
        {floatDmg && (
          floatDmg.isMiss
            ? <span style={{ position:"absolute", top:"25%", left:"50%", transform:"translateX(-50%)", fontSize:"1.3rem", fontWeight:900, color:"#94a3b8", textShadow:"0 2px 8px rgba(0,0,0,0.9)", animation:"mb-miss 2.0s ease-out forwards", pointerEvents:"none", whiteSpace:"nowrap" }}>MISS</span>
            : <span style={{ position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)", fontSize:floatDmg.isCrit?"2rem":"1.6rem", fontWeight:900, color:floatDmg.isCrit?"#fbbf24":"#f87171", textShadow:"0 2px 10px rgba(0,0,0,0.9)", animation:"mb-float 2.0s ease-out forwards", pointerEvents:"none", whiteSpace:"nowrap" }}>
                -{floatDmg.dmg}{floatDmg.isCrit?"💥":""}
              </span>
        )}
        {/* 小回合進度點 */}
        {liveEntry && (
          <div style={{ position:"absolute", bottom:8, left:0, right:0, display:"flex", justifyContent:"center", alignItems:"center", gap:4 }}>
            {(liveEntry.miniRounds||[]).map((mini,i) => (
              <div key={i} style={{ width:7, height:7, borderRadius:"50%", background: i===liveMiniIdx?"#fbbf24":i<liveMiniIdx?(mini.isCounter?"#f97316":"#6366f1"):"rgba(255,255,255,0.1)", transform:i===liveMiniIdx?"scale(1.4)":"scale(1)", transition:"all 0.3s" }}/>
            ))}
            {curMini?.isCounter && <span style={{ fontSize:10, color:"#fb923c", fontWeight:900, marginLeft:4 }}>⚡反擊</span>}
          </div>
        )}

        {/* ── 戰鬥紀錄折疊面板 ── */}
        <BattleLogPanel open={showBattleLog} onClose={() => setShowBattleLog(false)}>
          {(room?.log || []).length === 0 ? (
            <div style={{ color:"#475569", padding:"20px 0", textAlign:"center" }}>尚無戰鬥紀錄</div>
          ) : (
            (room.log || []).map((entry, i) => (
              <div key={i} style={{ marginBottom:8, borderBottom:"1px solid rgba(255,255,255,0.04)", paddingBottom:6 }}>
                <div style={{ color:"#fbbf24", fontWeight:700, fontSize:11, marginBottom:2 }}>
                  第 {entry.round} 回合 · 傷害 {entry.totalDmg} · HP {entry.monsterHPBefore}→{entry.monsterHPAfter}
                </div>
                {(entry.playerLog || []).map((p, j) => (
                  <div key={j} style={{ paddingLeft:6, color:"#cbd5e1", marginBottom:1, lineHeight:1.5 }}>
                    <span style={{ color:"#94a3b8" }}>🏹</span> {p.name}: <span style={{ color:"#f87171", fontWeight:700 }}>+{p.dmg}</span>
                    {p.crits > 0 && <span style={{ color:"#fbbf24" }}> 💥{p.crits}</span>}
                    {p.ctr > 0 && <span style={{ color:"#fb923c" }}> ⚡-{p.ctr}</span>}
                    <span style={{ color:"#475569", fontSize:9, marginLeft:4 }}>{(p.arrowBreakdown || []).map(a => a.label).join(" ")}</span>
                  </div>
                ))}
                {entry.event && (
                  <div style={{ paddingLeft:6, color:"#67e8f9", fontSize:10, marginTop:1 }}>
                    ✨ {entry.event.icon} {entry.event.title}: {entry.event.desc}
                  </div>
                )}
                {entry.counterRound && (
                  <div style={{ paddingLeft:6, color:"#fb923c", fontSize:10, marginTop:1 }}>💥 反擊回合</div>
                )}
              </div>
            ))
          )}
        </BattleLogPanel>
      </div>

      {/* ── 角色列（視角分排：平時只顯示自己那排，動畫時補顯對方排小卡）── */}
      <div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.82)", borderTop:"1px solid rgba(255,255,255,0.08)" }}>

        {/* 動畫進行中 → 顯示「對方排」緊湊小卡（前攻/後衛上下文） */}
        {isAnimating && otherRowMembers.length > 0 && (
          <div style={{ display:"flex", gap:2, padding:"2px 6px 1px", justifyContent:"center", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ alignSelf:"center", fontSize:8, color:"rgba(255,255,255,0.35)", marginRight:3 }}>
              {myDisplayGroup === "rear" ? "⚔️前衛" : "🛡後衛"}
            </span>
            {otherRowMembers.map(m => {
              const displayHp = localHpOverride[m.id] !== undefined ? localHpOverride[m.id] : m.hp;
              const hpPct = m.maxHP > 0 ? Math.max(0, Math.min(1, displayHp/m.maxHP)) : 0;
              const isOtherAtk = attackingIds.has(m.id);
              const otherBorder = m.role==="rear" ? "rgba(20,184,166,0.35)" : "rgba(251,113,133,0.35)";
              return (
                <div key={m.id} style={{
                  flexShrink:0, width:otherRowW, display:"flex", flexDirection:"column",
                  border:`1px solid ${otherBorder}`, borderRadius:6, overflow:"hidden",
                  background:"rgba(0,0,0,0.25)",
                  animation: isOtherAtk ? "db-archer-atk 0.45s ease-out" : undefined,
                }}>
                  <div style={{ height:48, position:"relative", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                    {floatCounterDmgs.filter(f=>f.memberId===m.id).map(f => (
                      <span key={f.id} style={{ position:"absolute", top:"0%", left:"50%", transform:"translateX(-50%)", zIndex:10, animation:"mb-float 1.3s ease-out forwards", fontWeight:900, fontSize:"0.7rem", color:"#f43f5e", textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap", pointerEvents:"none" }}>{f.text}💢</span>
                    ))}
                    <img src={`/cats/archers/${m.archerStyle||"baobao"}.webp`} alt={m.name}
                      style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom",
                        filter: !m.alive ? "grayscale(100%) opacity(0.25)" : undefined }}
                      onError={e => { e.target.style.display="none"; }}/>
                  </div>
                  <div style={{ padding:"2px 2px 3px", textAlign:"center" }}>
                    <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:1 }}>
                      <div style={{ height:"100%", width:`${hpPct*100}%`,
                        background: hpPct>0.5?"#16a34a":hpPct>0.25?"#d97706":"#dc2626" }}/>
                    </div>
                    <div style={{ fontSize:7.5, color:!m.alive?"#f87171":"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {!m.alive?"💀":""}{(m.name||"").slice(0,5)}
                    </div>
                    <div style={{ fontSize:7, color:m.role==="rear"?"#a78bfa":"#34d399" }}>
                      {m.role==="rear"?"🛡":"⚔️"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 排頭標籤（有後衛存在時顯示） + 視角切換按鈕 */}
        {rearDisplayMembers.length > 0 && (
          <div style={{ padding:"2px 8px 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:9, fontWeight:900, letterSpacing:1,
              color: viewRearInInput ? "rgba(45,212,191,0.7)" : "rgba(251,113,133,0.7)" }}>
              {viewRearInInput ? "🛡 後衛" : "⚔️ 前衛"}
            </span>
            {!liveEntry && !submitted && (
              <button onClick={() => setViewRearInInput(v => !v)}
                style={{ fontSize:9, padding:"1px 6px", borderRadius:4, background:"rgba(255,255,255,0.08)",
                  color:"#94a3b8", border:"none", cursor:"pointer", fontWeight:700 }}>
                {viewRearInInput ? "⚔️ 前衛" : "🛡後衛"}
              </button>
            )}
          </div>
        )}

        {/* 主排（我的視角 / 切換後衛視角）完整卡片 */}
        <div style={{ display:"flex", gap:3, padding:"2px 6px 4px", justifyContent:"center",
          animation: animScreenShake ? "mb-screen-shake 0.55s ease" : undefined }}>
          {displayedRowMembers.map(m => {
            const displayHp = localHpOverride[m.id] !== undefined ? localHpOverride[m.id] : m.hp;
            const hpPct = m.maxHP > 0 ? Math.max(0, Math.min(1, displayHp/m.maxHP)) : 0;
            const isMe = m.id === myId;
            const mContract = CONTRACT_TYPES[m.contract?.type] || CONTRACT_TYPES.standard;
            const isAttacking = attackingIds.has(m.id);
            // 邊框：isMe→金；front視角但role已改rear（滿員未移動）→紫；後衛排→青；正常前衛→透明
            const isRearInFront = myDisplayGroup !== "rear" && m.role === "rear";
            const isViewingRear = viewRearInInput && !liveEntry && !submitted;
            const cardBorder = isMe
              ? "rgba(251,191,36,0.45)"
              : isRearInFront || isViewingRear
              ? "rgba(168,85,247,0.45)"
              : myDisplayGroup === "rear"
              ? "rgba(20,184,166,0.4)"
              : "rgba(255,255,255,0.07)";
            const cardBg = isMe
              ? "rgba(251,191,36,0.04)"
              : isRearInFront || isViewingRear
              ? "rgba(168,85,247,0.04)"
              : myDisplayGroup === "rear"
              ? "rgba(20,184,166,0.04)"
              : "rgba(255,255,255,0.01)";
            return (
              <div key={m.id} style={{
                flexShrink:0, width:displayRowW, display:"flex", flexDirection:"column",
                border:`1px solid ${cardBorder}`,
                borderRadius:8, overflow:"hidden",
                background: cardBg,
                animation: isAttacking ? "db-archer-atk 0.45s ease-out" : undefined,
              }}>
                <div style={{ height:90, position:"relative", flexShrink:0, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                  {floatCounterDmgs.filter(f=>f.memberId===m.id).map(f => (
                    <span key={f.id} style={{ position:"absolute", top:"5%", left:"50%", transform:"translateX(-50%)", zIndex:10, animation:"mb-float 1.3s ease-out forwards", fontWeight:900, fontSize:"0.9rem", color:"#f43f5e", textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap", pointerEvents:"none" }}>{f.text}💢</span>
                  ))}
                  <img src={`/cats/archers/${m.archerStyle||"baobao"}.webp`} alt={m.name}
                    style={{ height:"100%", objectFit:"contain", objectPosition:"center bottom",
                      filter: !m.alive ? "grayscale(100%) opacity(0.25)" : undefined,
                      outline: isMe ? "2px solid rgba(251,191,36,0.6)" : undefined,
                      outlineOffset:"2px", borderRadius:2 }}
                    onError={e => { e.target.style.display="none"; }}/>
                </div>
                <div style={{ height:1, background:"rgba(255,255,255,0.06)", flexShrink:0 }}/>
                <div style={{ padding:"3px 3px 4px", textAlign:"center" }}>
                  <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden", marginBottom:2 }}>
                    <div style={{ height:"100%", borderRadius:3, width:`${hpPct*100}%`, transition:"width 0.5s ease",
                      background: hpPct>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":hpPct>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)",
                      boxShadow:hpPct<=0.25?"0 0 6px rgba(239,68,68,0.8)":undefined }}/>
                  </div>
                  <div style={{ fontSize:10, fontWeight:700, color:isMe?"#fbbf24":!m.alive?"#f87171":"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:1 }}>
                    {!m.alive?"💀":""}{(m.name||"").slice(0,6)}
                  </div>
                  <div style={{ fontSize:8, fontWeight:900, marginBottom:1,
                    color: m.role==="rear"?"#a78bfa":"#34d399" }}>
                    {m.role==="rear"?"🛡後衛":"⚔️前衛"}
                  </div>
                  <div style={{ display:"flex", justifyContent:"center", gap:4, marginBottom:1 }}>
                    <div style={{ fontSize:9, color:"#f87171" }}>⚔️{Math.round((m.atk||0)*(m.buffs?.atkMult||1))}{(m.buffs?.atkMult||1)>1&&<span style={{color:"#fbbf24",fontSize:7}}>↑</span>}</div>
                    <div style={{ fontSize:9, color:"#60a5fa" }}>🛡{Math.round((m.def||0)*(m.buffs?.defMult||1))}{(m.buffs?.defMult||1)>1&&<span style={{color:"#fbbf24",fontSize:7}}>↑</span>}</div>
                  </div>
                  {((m.buffs?.dmgMult||1)>1||(m.buffs?.hasRevival)) && (
                    <div style={{ fontSize:7, color:"#fbbf24", marginBottom:1 }}>
                      {(m.buffs?.dmgMult||1)>1&&`傷×${m.buffs.dmgMult}`} {m.buffs?.hasRevival&&"💫"}
                    </div>
                  )}
                  <div style={{ fontSize:8, marginBottom:1 }} className={mContract.color}>
                    {mContract.icon} {mContract.name}
                  </div>
                  <div style={{ fontSize:9, color: liveEntry?"#64748b":m.ready?"#4ade80":!m.alive?"#475569":"#fbbf24" }}>
                    {!m.alive?"⬛":liveEntry?"⚙️":m.ready?"✅":"⏳"}
                  </div>
                  {isHost && m.alive && !m.ready && m.id!==myId && (
                    <button onClick={()=>forceSkipDungeonPlayer(roomId, m.id)}
                      style={{ fontSize:8, padding:"1px 4px", borderRadius:3, background:"rgba(255,255,255,0.08)", color:"#64748b", border:"none", cursor:"pointer", marginTop:1 }}>
                      跳
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 輸入區 ── */}
      <div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.68)", padding:"3px 6px 10px", paddingBottom:"max(10px, env(safe-area-inset-bottom))" }}>
        {liveEntry ? (
          <div style={{ textAlign:"center", color:"rgba(148,163,184,0.7)", fontSize:12, padding:"10px 0" }}>⚔️ 戰鬥進行中…</div>
        ) : isDead ? (
          <div style={{ textAlign:"center", color:"#f87171", fontWeight:900, fontSize:12, padding:"10px 0" }}>💀 你已陣亡，等待隊友繼續…</div>
        ) : submitted ? (
          <div style={{ textAlign:"center", padding:"6px 0" }}>
            <div style={{ color:"#4ade80", fontWeight:900, fontSize:12, marginBottom:6 }}>✅ 已送出，等待隊友…</div>
            {allReady && isHost && (
              <div style={{ textAlign:"center", padding:12 }}>
                <div style={{ color:"#fbbf24", fontWeight:700, fontSize:14, marginBottom:6 }}>
                  ⚔️ 全員就緒！{readyCountdown} 秒後自動開始
                </div>
                <button onClick={confirmNow} style={{
                  padding:"8px 24px", borderRadius:8, fontWeight:700,
                  background:"#22c55e", color:"#000", fontSize:13, cursor:"pointer", border:"none",
                }}>
                  立即開始
                </button>
              </div>
            )}
            {allReady && !isHost && (
              <div style={{ color:"#94a3b8", fontSize:12, textAlign:"center", marginBottom:6 }}>
                ⏳ 等待隊長確認…
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"center", gap:2, flexWrap:"wrap" }}>
              {arrows.map((a,i) => (
                <span key={i} className={`px-2 py-0.5 rounded-lg text-xs font-bold ${SCORE_COLORS[a.label]||"bg-slate-600 text-white"}`}>{a.label}</span>
              ))}
            </div>
            <button onClick={() => {
              if (isHost) {
                clearDungeonProcessing(roomId);
              } else {
                // 非房主：重置本地 submitted + Firestore ready 重新輸入
                setFsSubmitted(false);
                import("firebase/firestore").then(({ updateDoc, doc }) =>
                  import("../../lib/firebase").then(({ db }) =>
                    updateDoc(doc(db, "dungeonRooms", roomId), {
                      [`members.${myId}.ready`]: false,
                      [`members.${myId}.arrows`]: [],
                    }).catch(() => {})
                  )
                );
              }
            }}
              style={{ marginTop:8, width:"100%", padding:"4px", borderRadius:8, fontSize:10, color:"#64748b", background:"rgba(255,255,255,0.05)", border:"none", cursor:"pointer" }}>
              {isHost ? "👑 強制重置（卡住時）" : "🔄 重新輸入"}
            </button>
          </div>
        ) : (
          <>
            {/* 後衛選擇（前衛死亡後變後衛時出現）*/}
            {me.role === "rear" && !submitted && (
              <div style={{ background:"rgba(0,0,0,0.7)", border:"2px solid rgba(168,85,247,0.6)", borderRadius:10, padding:"8px 10px", marginBottom:6 }}>
                <div style={{ color:"#e2e8f0", fontSize:10, fontWeight:700, textAlign:"center", marginBottom:6 }}>🛡️ 後衛 — 選擇行動</div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => setRearChoice("heal")}
                    style={{ flex:1, padding:"8px 0", borderRadius:8, border:`2px solid ${rearChoice==="heal"?"#4ade80":"rgba(74,222,128,0.3)"}`,
                      background: rearChoice==="heal" ? "rgba(74,222,128,0.25)" : "rgba(0,0,0,0.4)",
                      color:"#4ade80", fontWeight:900, fontSize:12, cursor:"pointer" }}>
                    💚 治癒 (25% HP)
                  </button>
                  <button onClick={() => setRearChoice("dmg")}
                    style={{ flex:1, padding:"8px 0", borderRadius:8, border:`2px solid ${rearChoice==="dmg"?"#f87171":"rgba(248,113,113,0.3)"}`,
                      background: rearChoice==="dmg" ? "rgba(248,113,113,0.25)" : "rgba(0,0,0,0.4)",
                      color:"#f87171", fontWeight:900, fontSize:12, cursor:"pointer" }}>
                    ⚔️ 攻擊 (+50% 傷害)
                  </button>
                </div>
              </div>
            )}
            {/* 任務提示 */}
            <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:4, padding:"2px 6px", borderRadius:6, background:"rgba(0,0,0,0.3)" }} className={contractInfo.color}>
              <span style={{ fontSize:11 }}>{contractInfo.icon}</span>
              <span style={{ fontSize:9, fontWeight:700 }}>{getContractDesc(myContract)}</span>
            </div>
            <BattleArrowSlots
                arrows={arrows}
                totalArrows={room.arrowsPerRound || 6}
                onUndo={undoArrow}
                showUndo={arrows.length>0}
                slotSize={36}
              />
            {/* 分數按鈕格（依合約類型調整）*/}
            {myContract.type === "hit_count" ? (
              /* 命中關：命中/M 兩顆按鈕 */
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:4 }}>
                <button onClick={() => addArrow("命中")} disabled={arrows.length>=(room.arrowsPerRound||6)}
                  className="rounded-xl font-black active:scale-95 bg-emerald-500 text-white"
                  style={{ fontSize:18, padding:"14px 0", opacity:arrows.length>=(room.arrowsPerRound||6)?0.3:1 }}>
                  命中
                </button>
                <button onClick={() => addArrow("M")} disabled={arrows.length>=(room.arrowsPerRound||6)}
                  className={`rounded-xl font-black active:scale-95 ${SCORE_COLORS["M"]}`}
                  style={{ fontSize:18, padding:"14px 0", opacity:arrows.length>=(room.arrowsPerRound||6)?0.3:1 }}>
                  M
                </button>
              </div>
            ) : (
              <BattleBottomBar
                bottomTab={bottomTab} setBottomTab={setBottomTab}
                potionSubTab={potionSubTab} setPotionSubTab={setPotionSubTab}
                potionUsedThisRound={potionUsedThisRound}
                scoringModeChosen={scoringModeChosen} setScoringModeChosen={setScoringModeChosen}
                targetMode={false} setTargetMode={() => {}}
                arrows={arrows} onArrow={addArrow}
                potionInv={me.items || {}}
                onCarryPotion={onCarryPotion}
                onThrowPotion={onThrowPotion}
                controlsLocked={!controlsStarted}
                onStartScoring={() => { setControlsStarted(true); setBottomTab("score"); }}
                showModeChooser={false}
              />
            )}
            {/* 送出 */}
            {controlsStarted && (
              <button onClick={handleSubmit} disabled={arrows.length<(room.arrowsPerRound||6)}
                style={{ width:"100%", padding:"10px", borderRadius:10, fontWeight:900, fontSize:14, color:"white", cursor:"pointer", border:"none",
                  background: arrows.length>=(room.arrowsPerRound||6)?"linear-gradient(135deg,#059669,#10b981)":"rgba(255,255,255,0.1)",
                  opacity: arrows.length<(room.arrowsPerRound||6)?0.5:1, transition:"all 0.2s" }}>
                🏹 送出 {room.arrowsPerRound||6} 箭 {arrows.length>0?`(${arrows.length}/${room.arrowsPerRound||6})`:""}
              </button>
            )}
            {hasCat && (
              <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4, padding:"2px 6px", borderRadius:6, background:"rgba(79,70,229,0.15)", border:"1px solid rgba(99,102,241,0.3)" }}>
                <span style={{ fontSize:11 }}>🐱</span>
                <span style={{ fontSize:9, color:"#a5b4fc", fontWeight:700 }}>{myCatName} 陪戰中</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 進場戰鬥動畫 ── */}
      {showEntryAnim && (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
          background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24,
        }}>
          {/* VS 對決畫面 */}
          <div style={{
            width:"100%", display:"flex", alignItems:"center",
            justifyContent:"space-around", padding:"0 20px",
          }}>
            {/* 射手從左進場 */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8,
              animation:"db-intro-archer 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"center", gap:4 }}>
                <img src={`/cats/archers/${me.archerStyle||"baobao"}.webp`} alt={me.name || "射手"}
                  style={{ width:entryCatId ? 82 : 100, height:100, objectFit:"contain", filter:"drop-shadow(0 0 16px #7c3aed)" }}/>
                {entryCatId && (
                  <div style={{ position:"relative", marginLeft:-12 }}>
                    <img
                      src={`/cats/portraits/${entryCatId}.webp`}
                      alt={entryCatName || "陪練貓咪"}
                      width="62"
                      height="62"
                      style={{
                        width:62, height:62, borderRadius:"50%", objectFit:"cover",
                        border:"3px solid #f472b6",
                        boxShadow:"0 0 18px rgba(244,114,182,0.65)",
                      }}
                    />
                    <span style={{
                      position:"absolute", right:-3, bottom:-3,
                      fontSize:16, lineHeight:1, padding:3, borderRadius:"50%",
                      background:"#4c1d95", border:"1px solid #f9a8d4",
                    }} aria-hidden="true">🐾</span>
                  </div>
                )}
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:"#c4b5fd", textShadow:"0 0 8px #7c3aed" }}>
                {me.name || "射手"}
              </span>
              {entryCatId && (
                <span style={{ marginTop:-5, fontSize:10, fontWeight:800, color:"#f9a8d4" }}>
                  🐱 {entryCatName || "貓貓"} 陪練
                </span>
              )}
            </div>
            {/* VS */}
            <div style={{
              fontSize:42, fontWeight:900, color:"#fbbf24",
              textShadow:"0 0 24px #f59e0b, 0 0 48px #f59e0b",
              animation:"db-intro-vs 0.8s 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
            }}>
              VS
            </div>
            {/* 怪物從右進場 */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8,
              animation:"db-intro-monster 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
              <div>
                <DungeonMonsterImg id={monster.id} icon={monster.icon} charge={false} variant={monster.variant}/>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:"#fca5a5", textShadow:"0 0 8px #ef4444" }}>
                {monster.name || "怪物"}
              </span>
              <MonsterVariantBadge variant={monster.variant} />
            </div>
          </div>
          {/* 戰鬥開始 */}
          <div style={{ animation:"db-intro-start 0.5s 1.2s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div style={{ fontSize:28, fontWeight:900, color:"#fff",
              textShadow:"0 0 24px #fbbf24", letterSpacing:4, textAlign:"center" }}>
              ⚔️ 戰鬥開始！
            </div>
          </div>
          {/* 合約提示 */}
          <div style={{ animation:"db-intro-start 0.5s 1.6s cubic-bezier(0.34,1.56,0.64,1) both",
            fontSize:12, color:"#94a3b8", textAlign:"center", padding:"0 24px" }}>
            {contractInfo.icon} {contractInfo.name}
            {myContract.param != null && <span>（{myContract.param}）</span>}
            {getContractDesc && <div style={{ fontSize:10, color:"rgba(148,163,184,0.6)", marginTop:2 }}>{getContractDesc(myContract)}</div>}
          </div>
        </div>
      )}

      {/* ── 擊殺動畫 ── */}
      {showKillAnim && killInfo && (
        <div style={{
          position:"fixed", inset:0, zIndex:9998,
          background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28,
        }}>
          {/* 怪物死亡動畫 + 擊殺印章 */}
          <div style={{ position:"relative", display:"inline-block" }}>
            <div style={{ animation:"db-die-monster 1.5s ease-out both" }}>
              <DungeonMonsterImg id={monster.id} icon={monster.icon} charge={false} variant={monster.variant}/>
            </div>
            {/* 擊殺印章 */}
            <div style={{
              position:"absolute", inset:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              animation:"db-die-badge 0.5s 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
              pointerEvents:"none",
            }}>
              <div style={{
                fontSize:28, fontWeight:900, color:"#ef4444",
                border:"4px solid #ef4444", borderRadius:8,
                padding:"4px 14px", letterSpacing:4,
                textShadow:"0 0 12px #ef4444",
                boxShadow:"0 0 18px #ef444488",
                background:"rgba(0,0,0,0.55)",
                transform:"rotate(-8deg)",
              }}>
                擊殺
              </div>
            </div>
          </div>

          {/* 擊殺文字 */}
          <div style={{ animation:"db-die-victory 0.6s 0.8s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div style={{ fontSize:36, fontWeight:900, color:"#fbbf24",
              textShadow:"0 0 32px #f59e0b", letterSpacing:4, textAlign:"center" }}>
              💀 擊殺！
            </div>
            <div style={{ fontSize:14, color:"#94a3b8", textAlign:"center", marginTop:4 }}>
              {killInfo.monsterName} 已被消滅
            </div>
          </div>

          {/* 最後一擊資訊 */}
          <div style={{ animation:"db-die-stats 0.5s 1.2s ease-out both",
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)",
            borderRadius:12, padding:"12px 20px", textAlign:"center" }}>
            <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>⚡ 最後一擊</div>
            <div style={{ fontSize:18, fontWeight:900, color:"#fbbf24" }}>
              {killInfo.memberName}
            </div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>
              以 {killInfo.label} 分擊殺
            </div>
          </div>
        </div>
      )}

      {/* ── 回合結算蓋板 ── */}
      {showRoundResult && lastEntry && (
        <RoundResultOverlay
          entry={lastEntry} room={room} status={status}
          onContinue={() => {
            setShowRoundResult(false);
            // 全隊陣亡時不重置 submitted/arrows，直接顯示失敗畫面
            const allDead = Object.values(room?.members || {}).every(m => !m.alive);
            const isWipe = (status === "completed" && room?.result === "lose") || allDead;
    if (!isWipe) {
      setFsSubmitted(false);
      setArrows([]);
    }
          }}
        />
      )}

      {/* ── 非房主：已領取獎勵，等待房主回地圖 ── */}
      {localClaimed && (
        <div style={{
          position:"fixed", inset:0, zIndex:10000,
          background:"rgba(10,10,15,0.96)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20,
          color:"white",
        }}>
          <style>{`@keyframes lc-pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
          <div style={{ fontSize:52 }}>✅</div>
          <div style={{ fontSize:20, fontWeight:900 }}>獎勵已領取！</div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.5)", textAlign:"center" }}>
            等待房主進行下一步…
          </div>
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width:9, height:9, borderRadius:"50%", background:"#60a5fa",
                animation:`lc-pulse 1.2s ease-in-out ${i*0.4}s infinite`,
              }}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RoundResultOverlay({ entry, room, status, onContinue }) {
  const [countdown, setCountdown] = useState(5);
  const allMembersDead = Object.values(room?.members || {}).every(m => !m.alive);
  const partyWiped     = (status === "completed" && room?.result === "lose") || allMembersDead;

  // 5 秒倒數計時
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  let title, icon, btnLabel, btnColor;
  if (partyWiped) {
    const killer = room?.monster ? `${room.monster.icon}${room.monster.name}` : "怪物";
    icon = "💀"; title = `被《${killer}》擊殺！`; btnLabel = "查看結果"; btnColor = "bg-rose-600";
  } else {
    // 一般回合結束（怪物存活，非擊殺回合）
    icon = "⚔️"; title = `第 ${entry.round} 回合結束`; btnLabel = "下一回合"; btnColor = "bg-slate-700";
  }

  const canContinue = countdown <= 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 gap-5 text-white"
      style={{ background: "rgba(15,23,42,0.97)" }}>
      <div className="text-6xl">{icon}</div>
      <div className="text-2xl font-black text-center whitespace-pre-line">{title}</div>

      {/* 本回合傷害摘要 */}
      <div className="w-full max-w-sm bg-white/8 border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="text-xs text-slate-400 font-bold mb-2 flex justify-between">
          <span>本回合總傷害</span>
          <span className="text-amber-300 font-black">{entry.totalDmg?.toLocaleString()}</span>
        </div>
        {(entry.playerLog || []).map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 flex-1 truncate">{p.name}</span>
            <span className="text-[11px] text-slate-500 font-mono">
              {(p.arrowBreakdown || []).map(a => a.label).join(" ")}
            </span>
            <span className="font-black text-amber-300 min-w-[36px] text-right">{p.dmg}</span>
            {p.crits > 0 && <span className="text-yellow-400 text-xs">💥</span>}
            {p.ctr  > 0 && <span className="text-rose-400 text-xs">-{p.ctr}</span>}
          </div>
        ))}
        <div className="flex justify-between text-xs text-slate-400 border-t border-white/10 pt-2 mt-1">
          <span>怪物剩餘 HP</span>
          <span className="text-rose-300 font-bold">{room.monsterHP?.toLocaleString()}</span>
        </div>
      </div>

      <button onClick={canContinue ? onContinue : undefined}
        disabled={!canContinue}
        className={`w-full max-w-sm py-4 rounded-2xl font-black text-lg text-white shadow-lg active:scale-95 transition-all ${
          canContinue ? btnColor : "bg-slate-700/50 text-slate-400 cursor-not-allowed"
        }`}>
        {canContinue ? btnLabel : `⏳ ${countdown} 秒後可繼續`}
      </button>
    </div>
  );
}
