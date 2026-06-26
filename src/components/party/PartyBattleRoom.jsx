// src/components/party/PartyBattleRoom.jsx — 組隊打怪房間
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import CatMsg from "../cat/CatMsg";
import {
  subscribePartyRoom, startPartyBattle, updateBattleMemberStats,
  submitArrows, processPartyRound, leavePartyRoom, partyHPRange,
  forceSkipPlayer, storeBattleRewards, claimBattleReward, confirmBattleResult,
  resetPartyRoom, sendPartyCheer, clearPartyProcessing,
} from "../../lib/partyDb";
import { subscribePotions, usePotions, checkPartyBattleLimit, recordPartyBattleSession, addCoins, addMaterials, addMonsterCard, recordBattleDex, subscribeCardCollection, addChests, addPracticeLog, subscribePracticeLogs, addArrowdew, addArcherXP, addAdventurerXP } from "../../lib/db";
import { MONSTER_TIER_XP, PARTY_XP_MULT, PARTY_BONUS_CHEST_CHANCE, archerLevelFromXP, archerLevelBonus } from "../../lib/archerLevel";
import { addCatXP } from "../../lib/catDb";
import { CAT_TIER_XP } from "../../lib/catLevel";
import { calcEquippedBonus } from "../../lib/monsterCards";
import { sfxTap, sfxArrowShoot, sfxCast, sfxBuff, sfxDebuff, sfxEpic, sfxSuccess, sfxSoftFail, sfxCounter, sfxCounterCrit, sfxCritBoom, sfxRoundEnd, sfxPotionDrink, vibrate } from "../../lib/sound";
import { calcDamage, calcCounterDamage, calcArcherStats, calcArcherPower, drawMatchedMonsters, TIER_LABEL, FAMILIES, resolveHitPart } from "../../lib/monsterData";
import { makeChests, CHEST_TYPES, getPotion, calcPotionBuffs, MAX_POTIONS_PER_BATTLE } from "../../lib/itemData";
import PartyBattleCard from "./PartyBattleCard";
import { LOOT_TABLE_GUEST, drawLoot, rollCoins, rollMaterialDrop, rollCardDrop, makeCoinChest } from "../../lib/lootTable";
import TargetFaceOverlay, { TargetFmtPicker, InputModePicker, getBattleTargetFmt, setBattleTargetFmt, getBattleInputMode, setBattleInputMode } from "../shared/TargetFaceOverlay";
import CatRoundOverlay from "../cat/CatRoundOverlay";
import { BattleHPBar, BattleArrowSlots, BattleScoreButtons, BattleStatusTags, BattleResultHeader } from "../shared/SharedBattleComponents";

const SCORE_MAP    = { X:10, 10:10, 9:9, 8:8, 7:7, 6:6, 5:5, 4:4, 3:3, 2:2, 1:1, M:0 };
const SCORE_LABELS = ["X","10","9","8","7","6","5","4","3","2","1","M"];
const SCORE_COLORS = {
  X:"bg-yellow-400 text-yellow-900", 10:"bg-yellow-300 text-yellow-900",
  9:"bg-red-400 text-white", 8:"bg-red-300 text-white",
  7:"bg-blue-400 text-white", 6:"bg-blue-300 text-white",
  5:"bg-gray-500 text-white", 4:"bg-gray-400 text-white",
  3:"bg-gray-300 text-gray-800", 2:"bg-gray-200 text-gray-700",
  1:"bg-gray-100 text-gray-600", M:"bg-black/30 text-gray-300"
};
const ARROWS_PER_ROUND = 6;
const MODE_OPTIONS = [
  { id:"novice",  label:"新手", icon:"🌱" },
  { id:"student", label:"學生", icon:"📚" },
  { id:"veteran", label:"老手", icon:"🏹" },
  { id:"match",   label:"賽事", icon:"🏆" },
];
const ADVENTURER_XP_PER_TIER = { common:15, rare:30, elite:50, fierce:75, boss:100, mythic:150 };

// 依 profile 計算實際數值（帶入裝備 / 成就 / 報到次數 / 怪物卡片 / 射手等級）
function getArcherStats(profile, potionIds = [], cardBonus = { hp: 0, atk: 0, def: 0 }, catMult = 1.0) {
  const base  = calcArcherStats({ member: profile, certification: null, certRecords: [], dexStats: null });
  const lvBon = archerLevelBonus(archerLevelFromXP(profile?.archerXP || 0));
  let hp  = base.hp  + (cardBonus.hp  || 0) + lvBon.hp;
  let atk = base.atk + (cardBonus.atk || 0) + lvBon.atk;
  let def = base.def + (cardBonus.def || 0) + lvBon.def;
  if (potionIds.length) {
    const buffs = calcPotionBuffs(potionIds);
    hp  = Math.round(hp  * buffs.hpMult);
    atk = Math.round(atk * buffs.atkMult);
  }
  if (catMult !== 1.0) {
    hp  = Math.round(hp  * catMult);
    atk = Math.round(atk * catMult);
    def = Math.round(def * catMult);
  }
  return { hp, atk, def };
}

// 裝備欄位計數
function equipSummary(profile) {
  const bows  = (profile?.equipment  || []).length;
  const armor = (profile?.armorSets  || []).reduce((s, set) =>
    s + Object.values(set).filter(v => v && typeof v === "string" && v.trim()).length, 0);
  const acc   = (profile?.accessorySets || []).reduce((s, set) =>
    s + Object.values(set).filter(Boolean).length, 0);
  return { bows, armor, acc };
}

// 回傳 { dmg, crits, arrowBreakdown } — 部位在結算時才決定，送出前不預覽
function calcDmgFn(arrows, atk, monsterDEF) {
  let dmg = 0, crits = 0;
  const arrowBreakdown = [];
  const unlocked = new Set();
  for (const arrow of arrows) {
    const score = arrow.score ?? 0;
    const part  = resolveHitPart(score, unlocked, arrow.label === "X");
    if (!part) {
      console.error("[calcDmgFn] resolveHitPart undefined", { score, label: arrow.label, unlocked: [...unlocked] });
      arrowBreakdown.push({ label: arrow.label || "M", partIcon: "💨", partName: "脫靶", dmg: 0, isCrit: false });
      continue;
    }
    if (part.id === "chest") unlocked.add("chest");
    if (part.id === "belly") unlocked.add("belly");
    if (part.id === "groin") unlocked.add("groin");
    const pMult = part.mult;
    if (!score || pMult === 0) {
      arrowBreakdown.push({ label: arrow.label || "M", partIcon: "💨", partName: "脫靶", dmg: 0, isCrit: false });
      continue;
    }
    const base   = 8 + (atk || 10) * 0.7 + score * 1.2 - (monsterDEF || 0) * 0.35;
    const mult   = 0.85 + Math.random() * 0.3;
    const isCrit = mult > 1.05 || pMult >= 1.8;
    const d      = Math.max(1, Math.round(base * pMult * mult));
    dmg  += d;
    if (isCrit) crits++;
    arrowBreakdown.push({
      label: arrow.label, partIcon: part.icon,
      partName: part.name, partMult: pMult, dmg: d, isCrit,
    });
  }
  return { dmg, crits, arrowBreakdown };
}
function calcCtrFn(monsterATK, archerDEF) {
  return calcCounterDamage({ monsterATK, archerDEF: archerDEF || 10, headStunned: false, isCrit: Math.random() < 0.1 });
}

function HPBar({ current, max, color = "#22c55e" }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct*100}%`, background: color }} />
    </div>
  );
}

function PartyMonsterImg({ id, icon, charge, size }) {
  const [err, setErr] = useState(false);
  const anim = charge ? "mb-charge 0.7s ease infinite" : undefined;
  const h = size || 148;
  return err ? (
    <span style={{ fontSize: size ? Math.round(size*0.6) : 40, display:"block", textAlign:"center", animation:anim }}>{icon}</span>
  ) : (
    <img src={`/monsters/${id}.webp`} alt={icon} onError={() => setErr(true)}
      style={{ maxWidth: size ? size : "82%", maxHeight: h, objectFit:"contain", animation:anim }}/>
  );
}

function pickBg(family) {
  const idx = Math.ceil(Math.random() * 6);
  return family ? `/ui/battle-bg/bg_${family}_${idx}.webp` : `/ui/dungeon-bg.webp`;
}

// guestOverride = { id, name } — 訪客模式時傳入，覆蓋 profile.id
export default function PartyBattleRoom({ roomId, isHost, onLeave, guestOverride }) {
  const { profile: authProfile } = useAuth();
  const profile = guestOverride ? null : authProfile;
  const { catMsg, clearCatMsg, triggerCatAction, saveBond, hasCat, catName, catATK } = useCatCompanion();
  const [room,            setRoom]            = useState(null);
  const battleBgRef = useRef(null);
  const [arrows,          setArrows]          = useState([]);
  const [targetMode,      setTargetMode]      = useState(() => getBattleInputMode() === "target");
  const [targetPending,   setTargetPending]   = useState(false);
  const [targetFmt,       setTargetFmt]       = useState(getBattleTargetFmt);
  const [submitting,      setSubmitting]      = useState(false);
  const [setupMonster,    setSetupMonster]    = useState(null);
  const [setupMode,       setSetupMode]       = useState("student");
  const [starting,        setStarting]        = useState(false);
  const [copied,          setCopied]          = useState(false);
  const [potionInv,       setPotionInv]       = useState({});
  const [selectedPotions, setSelectedPotions] = useState([]);
  const [claiming,        setClaiming]        = useState(false);
  const [skipping,        setSkipping]        = useState(null);
  const [confirming,      setConfirming]      = useState(false);
  const [localCompleted,  setLocalCompleted]  = useState(false);
  const [resetting,       setResetting]       = useState(false);
  const [partyBattleLeft, setPartyBattleLeft] = useState(null);
  const [startError,      setStartError]      = useState("");
  const [animHit,         setAnimHit]         = useState(false);
  const [animCounter,       setAnimCounter]       = useState(false);
  const [animMonsterCharge, setAnimMonsterCharge] = useState(false);
  const [animScreenShake,   setAnimScreenShake]   = useState(false);
  const [floatCounterDmgs,  setFloatCounterDmgs]  = useState([]);
  const [localHpOverride,   setLocalHpOverride]   = useState({});
  const [showEvent,       setShowEvent]       = useState(null);
  const [logInited,       setLogInited]       = useState(false); // 首次 log 初始化後為 true，用於 pending_confirm 時序
  const [showFullLog,     setShowFullLog]     = useState(false);
  const [showShareCard,   setShowShareCard]   = useState(false);
  const [guestLoot,       setGuestLoot]       = useState(null);
  const [guestAlreadyWon, setGuestAlreadyWon] = useState(false);
  const [claimResult,     setClaimResult]     = useState(null); // { coins, material, card }
  const [previewReward,   setPreviewReward]   = useState(null); // 領取前預覽
  const [drawnMonsters,   setDrawnMonsters]   = useState([]);
  const [liveEntry,       setLiveEntry]       = useState(null);  // 正在逐人揭曉的回合
  const [liveMiniRoundIdx, setLiveMiniRoundIdx] = useState(0);   // 目前顯示的小回合索引 (0-5)
  const [cheerMsg,        setCheerMsg]        = useState("");
  const [scoringReady,    setScoringReady]    = useState(false);

  const statsWrittenRef   = useRef(false); // 戰鬥中寫入
  const statsWaitingRef   = useRef(false); // 等待室寫入
  const rewardStoredRef   = useRef(false); // 防重複存獎勵
  const roundGuardRef  = useRef(0);    // 已派出結算的回合號（ref = 同步，避免 stale closure）
  const retryCountRef  = useRef(0);   // 同回合連續失敗次數（≥3 停止重試）
  const retryRoundRef  = useRef(0);   // retryCount 所屬的回合（換回合時歸零）
  const cardCollRef       = useRef({ cards: {}, equipped: [] }); // 怪物卡片裝備（ref 避免影響 effect 依賴）
  const partyRecordedRef  = useRef(false); // 每日次數記錄（只記一次）
  const dexRecordedRef    = useRef(false); // 圖鑑記錄（每場只記一次）
  const autoClaimFiredRef = useRef(false); // 自動領取寶箱（每場只觸發一次）
  const prevLogLenRef     = useRef(0);     // 動畫觸發用
  const logInitializedRef = useRef(false); // 首次載入時跳過已存在的 log（F5 防重播）
  const revealTimersRef   = useRef([]);    // 逐人揭曉計時器
  const logEndRef         = useRef(null);

  const myId = guestOverride?.id || authProfile?.id;

  useEffect(() => {
    const unsub = subscribePartyRoom(roomId, r => {
      setRoom(r);
      if (r?.monster?.family && !battleBgRef.current) {
        battleBgRef.current = pickBg(r.monster.family);
      }
    });
    return unsub;
  }, [roomId]);

  // 訂閱怪物卡片裝備（存 ref，不觸發 re-render，確保寫入時取到最新值）
  useEffect(() => {
    if (!myId || myId.startsWith("guest")) return;
    return subscribeCardCollection(myId, data => { cardCollRef.current = data; });
  }, [myId]); // eslint-disable-line

  // 下一場重置：room 回到 waiting 時清掉所有 one-time ref 與本地狀態
  useEffect(() => {
    if (room?.status !== "waiting") return;
    statsWrittenRef.current  = false;
    statsWaitingRef.current  = false;
    rewardStoredRef.current  = false;
    partyRecordedRef.current = false;
    dexRecordedRef.current   = false;
    autoClaimFiredRef.current = false;
    prevLogLenRef.current    = 0;
    logInitializedRef.current = false;
    roundGuardRef.current = 0;
    retryCountRef.current = 0;
    retryRoundRef.current = 0;
    setLocalCompleted(false);
    setArrows([]);
    setSetupMonster(null);
    setSelectedPotions([]);
    setGuestLoot(null);
    setGuestAlreadyWon(false);
    setLiveEntry(null);
    setShowFullLog(false);
    setClaimResult(null);
    setStartError("");
    setLogInited(false);
    setLocalHpOverride({});
    setScoringReady(false);
  }, [room?.status]); // eslint-disable-line

  // 每回合開始時重置計分門禁
  useEffect(() => { setScoringReady(false); }, [room?.round]); // eslint-disable-line

  // 房主：進入等待室時預查今日剩餘次數（訪客無限制，略過）
  useEffect(() => {
    if (!myId || !isHost || myId.startsWith("guest")) return;
    checkPartyBattleLimit(myId).then(setPartyBattleLeft);
  }, [myId, isHost]); // eslint-disable-line

  // 房主：依自身戰力抽出 6 隻怪物候選（每族1隻）
  useEffect(() => {
    if (!isHost || !room || room.status !== "waiting" || drawnMonsters.length > 0) return;
    const stats = getArcherStats(profile, [], getMyCardBonus(), 1.0);
    const power = calcArcherPower(stats);
    setDrawnMonsters(drawMatchedMonsters(power));
  }, [isHost, room?.status]); // eslint-disable-line

  // 戰鬥開始時所有人記錄一次（訪客略過次數限制）
  useEffect(() => {
    if (!room || !myId || room.status !== "active" || partyRecordedRef.current) return;
    partyRecordedRef.current = true;
    if (!myId.startsWith("guest")) {
      recordPartyBattleSession(myId).catch(() => {});
      if (isHost) setPartyBattleLeft(l => Math.max(0, (l ?? 1) - 1));
    }
  }, [room?.status]); // eslint-disable-line

  // 訂閱藥水庫存
  useEffect(() => {
    if (!myId) return;
    const unsub = subscribePotions(myId, setPotionInv);
    return unsub;
  }, [myId]);

  // 計算自己當前裝備的怪物卡片加成（從 ref 取最新值，不觸發 re-render）
  function getMyCardBonus() {
    const data = cardCollRef.current;
    const equipped = (data.equipped || []).map(id => data.cards?.[id]).filter(Boolean);
    return calcEquippedBonus(equipped);
  }

  // 等待室就先寫入真實數值（讓所有人看到彼此的數值）
  useEffect(() => {
    if (!room || !myId || room.status !== "waiting" || statsWaitingRef.current) return;
    const me = room.members?.[myId];
    if (!me) return;
    statsWaitingRef.current = true;
    const stats = getArcherStats(profile, [], getMyCardBonus(), 1.0);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def, localStorage.getItem("mb_archer_style") || "", hasCat ? (catATK || 0) : 0, hasCat ? (catName || "") : "");
  }, [room?.status, myId]); // eslint-disable-line

  // 開戰後套入藥水 buff 重新寫入最終數值
  useEffect(() => {
    if (!room || !myId || room.status !== "active" || statsWrittenRef.current) return;
    const me = room.members?.[myId];
    if (!me) return;
    statsWrittenRef.current = true;
    // 若已有 HP（中途重連），不覆蓋——避免戰鬥中途重連時把 HP 重置回滿血
    if (me.hp > 0 && me.maxHP > 0 && (room.round || 1) > 1) return;
    const stats = getArcherStats(profile, selectedPotions, getMyCardBonus(), 1.0);
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def, localStorage.getItem("mb_archer_style") || "", hasCat ? (catATK || 0) : 0, hasCat ? (catName || "") : "");
    if (selectedPotions.length > 0) usePotions(myId, selectedPotions).catch(() => {});
  }, [room?.status]); // eslint-disable-line

  // 房主：檢查所有人是否 ready → 先幫機器人補送箭分，再觸發結算
  useEffect(() => {
    if (!room || !isHost || room.status !== "active") return;
    if (!room.monster) return;
    const currentRound = room.round || 1;
    if (roundGuardRef.current === currentRound) return; // 同回合已派出，等結果

    // 進入新回合時，重置 retryCount（前回合的失敗次數不應影響下一回合）
    if (currentRound !== retryRoundRef.current) {
      retryRoundRef.current = currentRound;
      retryCountRef.current = 0;
    }

    if (room.processing) return; // Firestore 正在寫入，等下次 snapshot
    const members  = room.members || {};
    const aliveIds = Object.keys(members).filter(id => members[id].alive);
    if (aliveIds.length === 0) return;
    if (!aliveIds.every(id => members[id].ready)) return;
    if (retryCountRef.current >= 5) return; // 同回合失敗 5 次，停止重試（網路不順給更多機會）
    roundGuardRef.current = currentRound; // 立即鎖住，同步生效，不等 re-render
    processPartyRound(roomId, room, calcDmgFn, calcCtrFn)
      .then(res => {
        if (res?.ok) { retryCountRef.current = 0; }
        else { roundGuardRef.current = 0; retryCountRef.current++; }
      })
      .catch(() => { roundGuardRef.current = 0; retryCountRef.current++; });
  }, [room]); // eslint-disable-line

  // 房主：勝利 → 存獎勵到 Firestore（每人一份獨立寶箱）
  useEffect(() => {
    if (!room || !isHost || room.result !== "win" || rewardStoredRef.current) return;
    if (room.rewardPending) return; // 已存過
    rewardStoredRef.current = true;
    const memberIds = Object.keys(room.members || {});
    storeBattleRewards(roomId, memberIds, room.monster, room.mode || "student")
      .then(res => { if (!res?.ok) rewardStoredRef.current = false; })
      .catch(()  => { rewardStoredRef.current = false; });
  }, [room?.result, room?.rewardPending]); // eslint-disable-line

  // 滾動 log 到底
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.log?.length]);

  // 回合更新：動畫 + 音效 + 事件先觸發 → 再逐人揭曉傷害（每 2 秒一位）
  useEffect(() => {
    const len = room?.log?.length || 0;
    // 首次載入（含 F5）：直接把 ref 同步到當前長度，跳過歷史 log 不重播
    if (!logInitializedRef.current) { logInitializedRef.current = true; prevLogLenRef.current = len; setLogInited(true); return; }
    if (len <= prevLogLenRef.current) return;
    prevLogLenRef.current = len;
    const entry = room.log[len - 1];
    if (!entry) return;

    // 清除上一回合的揭曉計時器
    revealTimersRef.current.forEach(t => clearTimeout(t));
    revealTimersRef.current = [];

    // 重置即時揭曉
    setLiveEntry(entry);
    setLiveMiniRoundIdx(0);

    // 音效（事件優先）
    if (entry.event?.type === "buff")    sfxBuff();
    else if (entry.event?.type === "debuff") sfxDebuff();
    else if (entry.totalDmg > 150)       sfxEpic();
    else                                 sfxRoundEnd();
    vibrate(20);

    // 有突發事件：先顯示彈窗 3.5s
    const eventDelay = entry.event ? 3500 : 0;
    if (entry.event) {
      setShowEvent(entry.event);
      const et = setTimeout(() => setShowEvent(null), 3500);
      revealTimersRef.current.push(et);
    }

    // 逐小回合播放（每位玩家 1.4s，反擊回合 2.7s）
    const miniRounds = entry.miniRounds || [];
    let delay = eventDelay;
    miniRounds.forEach((mini, idx) => {
      const t = setTimeout(() => { setLiveMiniRoundIdx(idx); sfxArrowShoot(); vibrate(8); triggerCatAction(); }, delay);
      revealTimersRef.current.push(t);

      if (mini.isCounter) {
        // 反擊開始前：先把 HP bar 鎖在「受擊前」，讓 Firestore 已更新的值不提前顯示
        const ctrLog = mini.playerLog || [];
        const tLock = setTimeout(() => {
          setLocalHpOverride(prev => {
            const next = { ...prev };
            ctrLog.forEach(p => {
              // 從 room.members 讀目前值（已是扣血後），加回 ctr 還原為受擊前 HP
              const mem = room?.members?.[p.id];
              if (mem) next[p.id] = Math.min(mem.maxHP || 9999, (mem.hp || 0) + (p.ctr || 0));
            });
            return next;
          });
        }, delay);
        // 600ms 後蓄力（讓玩家先看清箭傷），1400ms 反擊
        const t1 = setTimeout(() => setAnimMonsterCharge(true),  delay + 600);
        const t2 = setTimeout(() => {
          setAnimMonsterCharge(false);
          setAnimCounter(true);
          setAnimScreenShake(true);
          // 反擊動畫同步：清除 override，血條帶 CSS transition 順滑滑落
          setLocalHpOverride({});
          // 根據反擊傷害選擇音效
          const totalCtrDmg = ctrLog.reduce((s, p) => s + (p.ctr || 0), 0);
          if (totalCtrDmg > 80) sfxCounterCrit(); else sfxCounter();
          vibrate([0, 35, 55, 30]);
          const floats = ctrLog
            .filter(p => p.ctr > 0)
            .map(p => ({ id: Date.now() + Math.random(), memberId: p.id, text: `-${p.ctr}`, left: 15 + Math.floor(Math.random() * 55) }));
          if (floats.length) {
            setFloatCounterDmgs(floats);
            setTimeout(() => setFloatCounterDmgs([]), 1400);
          }
          setTimeout(() => { setAnimCounter(false); setAnimScreenShake(false); }, 850);
        }, delay + 1400);
        revealTimersRef.current.push(tLock, t1, t2);
        delay += 2700;
      } else {
        // 玩家攻擊：200ms 後怪物閃白受擊
        if (mini.totalDmg > 0) {
          const th = setTimeout(() => { setAnimHit(true); setTimeout(() => setAnimHit(false), 450); }, delay + 200);
          revealTimersRef.current.push(th);
        }
        delay += 1400;
      }
    });

    // liveEntry 清除
    const ct = setTimeout(() => { setLiveEntry(null); setLiveMiniRoundIdx(0); }, delay + 1500);
    revealTimersRef.current.push(ct);
  }, [room?.log?.length]); // eslint-disable-line

  // 勝利音效：等動畫播完（liveEntry 清除）再播，讓玩家先看到擊殺動畫
  useEffect(() => {
    if (room?.status === "pending_confirm" && !liveEntry && logInited) {
      sfxSuccess(); setTimeout(() => sfxEpic(), 350);
    }
    if (room?.result === "lose") sfxSoftFail();
  }, [room?.status, room?.result, liveEntry]); // eslint-disable-line

  // processing 卡住防護：processing: true 超過 15 秒自動清除（網路不順時可能殘留）
  useEffect(() => {
    if (!isHost || !room?.processing) return;
    const t = setTimeout(() => { clearPartyProcessing(roomId); }, 15000);
    return () => clearTimeout(t);
  }, [room?.processing, isHost, roomId]); // eslint-disable-line

  // 隊友加油通知（不顯示自己發的）
  useEffect(() => {
    if (!room?.cheer?.fromName) return;
    if (room.members?.[myId]?.name === room.cheer.fromName) return;
    setCheerMsg(`💪 ${room.cheer.fromName} 為大家加油！`);
    const t = setTimeout(() => setCheerMsg(""), 3000);
    return () => clearTimeout(t);
  }, [room?.cheer?.ts]); // eslint-disable-line

  // 組隊敗場 → 記錄怪物圖鑑（勝場由 handleClaim 負責）
  useEffect(() => {
    if (!room || !myId || myId.startsWith("guest") || dexRecordedRef.current) return;
    if (room.status !== "completed" || room.result !== "lose") return;
    if (!room.monster?.id) return;
    dexRecordedRef.current = true;
    const myDmg = (room.log || []).reduce((s, entry) => {
      const p = (entry.playerLog || []).find(p => p.id === myId);
      return s + (p?.dmg || 0);
    }, 0);
    recordBattleDex(myId, room.monster.id, "lose", myDmg).catch(() => {});
  }, [room?.status]); // eslint-disable-line

  // 訪客組隊勝利：抽取紀念獎勵（sessionStorage 確保每位訪客只領一次）
  useEffect(() => {
    if (!room || room.status !== "completed" || room.result !== "win") return;
    if (!myId?.startsWith("guest")) return;
    const already = sessionStorage.getItem("guest_won_once");
    if (already) {
      setGuestAlreadyWon(true);
    } else {
      const loot = drawLoot(LOOT_TABLE_GUEST, "party", "common");
      setGuestLoot(loot);
      sessionStorage.setItem("guest_won_once", "1");
    }
  }, [room?.status, room?.result]); // eslint-disable-line

  // 提早計算（room 可能為 null，用 ?. 保安全，讓 useEffect 位於 early return 之前）
  const myChests  = room?.rewardPending?.[myId] || [];
  const myClaimed = (room?.rewardClaimed || []).includes(myId);

  // 寶箱出現時預先 roll 金幣 + 掉落物，讓玩家看到等待中的獎勵
  useEffect(() => {
    if (!myChests.length || myClaimed || previewReward || !room) return;
    const coins    = rollCoins(room.monster?.tier || "common", room.mode || "student");
    const material = rollMaterialDrop(room.monster);
    const card     = rollCardDrop(room.monster);
    setPreviewReward({ coins, material, card });
  }, [myChests.length, myClaimed]); // eslint-disable-line

  // 自動領取寶箱（previewReward 準備好後立即入庫，無需手動點擊）
  useEffect(() => {
    if (!previewReward || !myChests.length || myClaimed || claiming || autoClaimFiredRef.current) return;
    autoClaimFiredRef.current = true;
    handleClaim();
  }, [previewReward]); // eslint-disable-line

  if (!room) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-lg font-bold animate-pulse">載入中…</div>
    </div>
  );

  const members    = room.members || {};
  const memberList = Object.entries(members)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => {
      if (a.id === myId) return -1;
      if (b.id === myId) return 1;
      if (a.id === room.hostId) return -1;
      if (b.id === room.hostId) return 1;
      return a.id < b.id ? -1 : 1;
    });
  const me         = members[myId] || {};
  const aliveCount = memberList.filter(m => m.alive).length;
  const myReady    = me.ready || false;
  const isGuestPlayer = myId?.startsWith("guest");

  function addArrow(label) {
    if (arrows.length >= ARROWS_PER_ROUND || myReady) return;
    const rawScore = SCORE_MAP[label] ?? 0;
    const score = (targetFmt === "field_16" && rawScore > 0)
      ? Math.min(rawScore + 5, 10)
      : rawScore;
    sfxTap(); vibrate(8);
    setArrows(prev => [...prev, { score, label }]);
  }
  function removeLastArrow() {
    if (myReady) return;
    setArrows(prev => prev.slice(0, -1));
  }
  function handleTargetSubmit() {
    setTargetPending(true);
    setTimeout(() => { setTargetPending(false); handleSubmit(); }, 2000);
  }
  async function handleSubmit() {
    if (arrows.length < ARROWS_PER_ROUND || myReady || submitting) return;
    sfxCast(); vibrate([0, 20, 40]);
    setSubmitting(true);
    const res = await submitArrows(roomId, myId, arrows);
    if (res?.ok === false) {
      alert("送出失敗，請重試（" + (res.reason || "未知錯誤") + "）");
      setSubmitting(false);
      return;
    }
    setArrows([]);
    setSubmitting(false);
  }
  async function handleStart() {
    if (!setupMonster || starting) return;
    if (memberList.length < 1 || (memberList.length < 2 && !hasCat)) {
      setStartError("組隊打怪至少需要 2 位玩家！（或裝備貓咪陪你獨自出戰）");
      return;
    }
    if (partyBattleLeft !== null && partyBattleLeft <= 0) {
      setStartError("今日組隊打怪次數已達上限（5次）");
      return;
    }
    setStartError("");
    setStarting(true);
    await startPartyBattle(roomId, room, setupMonster, setupMode, "preset", 18);
    setStarting(false);
  }
  async function handleLeave() {
    // 戰鬥進行中：防誤觸確認
    if (room?.status === "active") {
      if (!window.confirm("⚠️ 戰鬥進行中！確定要離開房間嗎？")) return;
    }
    await leavePartyRoom(roomId, myId, isHost);
    sessionStorage.removeItem("guest_party_session");
    onLeave();
  }
  async function handleForceSkip(targetId) {
    if (skipping) return;
    setSkipping(targetId);
    await forceSkipPlayer(roomId, targetId);
    setSkipping(null);
  }
  async function handleClaim() {
    if (!myChests.length || claiming) return;
    setClaiming(true);
    try {
      let archerXPForResult = 0, catXPForResult = 0;
      const myDmg = (room.log || []).reduce((s, entry) => {
        const p = (entry.playerLog || []).find(p => p.id === myId);
        return s + (p?.dmg || 0);
      }, 0);
      // 使用預覽時已 roll 好的值，保持顯示一致
      const reward   = previewReward || {};
      const coins    = reward.coins    ?? rollCoins(room.monster?.tier || "common", room.mode || "student");
      const material = reward.material ?? rollMaterialDrop(room.monster);
      const card     = reward.card     ?? rollCardDrop(room.monster);
      const monsterTier = room.monster?.tier || "common";
      const coinChest = makeCoinChest(monsterTier, "組隊戰鬥掉落");
      const bonusChest = Math.random() < PARTY_BONUS_CHEST_CHANCE ? makeCoinChest(monsterTier, "組隊加成寶箱") : null;
      const res = await claimBattleReward(roomId, myId, myChests, room.monster?.id, room.result, myDmg);
      if (!res?.ok) throw new Error(res?.reason || "領取失敗");
      addCoins(myId, coins).catch(() => {});
      addChests(myId, bonusChest ? [coinChest, bonusChest] : [coinChest]).catch(() => {});
      if (material) addMaterials(myId, [{ id: material.id }]).catch(() => {});
      if (card)     addMonsterCard(myId, card).catch(() => {});
      if (!dexRecordedRef.current && room.monster?.id) {
        dexRecordedRef.current = true;
        recordBattleDex(myId, room.monster.id, "win", myDmg).catch(() => {});
      }
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
            date: new Date().toISOString().slice(0, 10), source: "party",
            monsterName: room.monster?.name || "怪物", result: "win",
            rounds: practiceRounds,
            total: practiceRounds.flat().reduce((s, v) => s + v, 0),
            totalArrows: arrowCount,
            distance: room.distance || null,
          }, myId).catch(() => {});
          if (arrowCount > 0) addArrowdew(myId, arrowCount).catch(() => {});
        }
        // 組隊模式永遠給 50% XP 加成
        const xpMult = PARTY_XP_MULT;
        const xp = Math.round((MONSTER_TIER_XP[monsterTier] || 5) * xpMult);
        addArcherXP(myId, xp).catch(() => {});
        const advXP = Math.round((ADVENTURER_XP_PER_TIER[monsterTier] || 15) * xpMult);
        addAdventurerXP(myId, advXP).catch(() => {});
        const _ptyCatId = authProfile?.equippedCat?.catId;
        const catXP = _ptyCatId ? Math.round((CAT_TIER_XP[monsterTier] || 5) * xpMult) : 0;
        if (_ptyCatId) addCatXP(myId, _ptyCatId, catXP).catch(() => {});
        archerXPForResult = xp;
        catXPForResult = catXP;
      }
      saveBond("party");
      setClaimResult({ coins, material, card, coinChest, archerXP: archerXPForResult, catXP: catXPForResult });
    } catch (e) {
      console.warn("handleClaim error:", e?.message);
    } finally {
      setClaiming(false);
    }
  }
  async function handleConfirmResult() {
    if (!isHost || confirming) return;
    setConfirming(true);
    await confirmBattleResult(roomId);
    setConfirming(false);
  }
  async function handleNextRound() {
    if (!isHost || resetting) return;
    setResetting(true);
    const memberIds = Object.keys(room.members || {});
    await resetPartyRoom(roomId, memberIds);
    setResetting(false);
  }
  function copyCode() {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function handleRedrawMonsters() {
    const stats = getArcherStats(profile, [], getMyCardBonus(), 1.0);
    const power = calcArcherPower(stats);
    setDrawnMonsters(drawMatchedMonsters(power));
    setSetupMonster(null);
  }

  const tierInfo = room.monster ? TIER_LABEL[room.monster.tier] : null;
  const famInfo  = room.monster ? FAMILIES[room.monster.family] : null;
  const myStats  = getArcherStats(profile, [], getMyCardBonus(), 1.0);
  const myEquip  = equipSummary(profile);

  // ── 等待/大廳畫面 ──────────────────────────────────────────
  if (room.status === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <div className="text-white font-black text-lg">⚔️ 組隊打怪</div>
          <button onClick={handleLeave} className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-bold rounded-lg">離開</button>
        </div>

        {/* 隊員列表（含數值）*/}
        <div className="bg-slate-700/40 rounded-2xl p-4 flex flex-col gap-3">
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">隊員 {memberList.length}/8</div>
          {memberList.map(m => {
            const isMe = m.id === myId;
            return (
              <div key={m.id} className={`rounded-xl p-3 flex flex-col gap-1.5 ${isMe ? "bg-indigo-900/40 border border-indigo-500/30" : "bg-slate-700/30"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{m.id === room.hostId ? "👑" : "🏹"}</span>
                  <span className={`font-black text-sm ${isMe ? "text-indigo-300" : "text-white"}`}>
                    {m.name}{isMe ? " (我)" : ""}
                  </span>
                </div>
                {m.maxHP > 0 && (
                  <div className="flex gap-3 text-xs text-slate-400 flex-wrap">
                    <span>❤️ {m.maxHP}</span>
                    <span>⚔️ {m.atk}</span>
                    <span>🛡️ {m.def}</span>
                  </div>
                )}
                {isMe && (
                  <div className="flex gap-2 text-xs text-slate-500 flex-wrap mt-0.5">
                    {myEquip.bows  > 0 && <span>🏹 {myEquip.bows}弓組</span>}
                    {myEquip.armor > 0 && <span>🛡️ {myEquip.armor}護具</span>}
                    {myEquip.acc   > 0 && <span>💎 {myEquip.acc}飾品</span>}
                    {hasCat && <span className="text-indigo-300 bg-indigo-900/30 px-1.5 py-0.5 rounded">🐱 {catName} 光環 +10%</span>}
                  </div>
                )}
              </div>
            );
          })}
          {memberList.length < 8 && (
            <div className="text-slate-500 text-xs text-center py-1">等待夥伴加入…</div>
          )}
        </div>

        {/* 藥水選擇（自己的庫存）*/}
        {Object.values(potionInv).some(v => v > 0) && (
          <div className="bg-slate-700/40 rounded-2xl p-4 flex flex-col gap-2">
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
              開戰前選擇藥水（最多 {MAX_POTIONS_PER_BATTLE} 瓶）
            </div>
            <div className="flex flex-col gap-1.5">
              {Object.entries(potionInv).filter(([, c]) => c > 0).map(([pid, count]) => {
                const p = getPotion(pid);
                if (!p) return null;
                const selected = selectedPotions.includes(pid);
                return (
                  <button key={pid}
                    onClick={() => {
                      if (selected) setSelectedPotions(prev => prev.filter(id => id !== pid));
                      else if (selectedPotions.length < MAX_POTIONS_PER_BATTLE)
                        setSelectedPotions(prev => [...prev, pid]);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all text-sm ${
                      selected ? "border-indigo-400 bg-indigo-900/40" : "border-slate-600 bg-slate-700/30"
                    }`}>
                    <span className="text-xl">{p.icon}</span>
                    <div className="flex-1">
                      <div className={`font-bold text-xs ${selected ? "text-indigo-200" : "text-white"}`}>{p.name}</div>
                      <div className="text-xs text-slate-400">{p.effectText}</div>
                    </div>
                    <span className="text-xs text-slate-500">×{count}</span>
                    {selected && <span className="text-indigo-400">✅</span>}
                  </button>
                );
              })}
            </div>
            {selectedPotions.length > 0 && (
              <div className="text-xs text-indigo-300 font-bold mt-1">
                已選：{selectedPotions.map(pid => getPotion(pid)?.name).join("、")}
              </div>
            )}
          </div>
        )}

        {/* 怪物選擇（房主）*/}
        {isHost && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {MODE_OPTIONS.map(m => (
                <button key={m.id} onClick={() => setSetupMode(m.id)}
                  className={`py-2.5 rounded-xl text-sm font-black border transition-all ${
                    setupMode === m.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-700 text-slate-300 border-slate-600"
                  }`}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">系統抽出候選怪物（六族各1）</div>
              <button onClick={handleRedrawMonsters}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/60 text-indigo-200 text-xs font-black rounded-lg active:scale-95 transition-transform">
                🎲 重新抽取
              </button>
            </div>

            {drawnMonsters.length === 0 ? (
              <div className="text-slate-500 text-xs text-center py-4 animate-pulse">抽取中…</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {drawnMonsters.map(m => {
                  const tier = TIER_LABEL[m.tier];
                  const fam  = FAMILIES[m.family];
                  const ms   = setupMode === "novice" ? 1.5 : setupMode === "student" ? 2.0 : 4.0;
                  const atkM = setupMode === "veteran" ? 2 : 1;
                  const { min, max } = partyHPRange(memberList.length);
                  return (
                    <button key={m.id} onClick={() => setSetupMonster(m)}
                      className={`text-left rounded-xl p-3 border-2 transition-all flex flex-col gap-1 ${
                        setupMonster?.id === m.id ? "border-indigo-500 bg-indigo-900/40" : "border-slate-600 bg-slate-700/30"
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <PartyMonsterImg id={m.id} icon={m.icon} charge={false} size={52}/>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-bold text-sm leading-tight truncate">{m.name}</div>
                          <div className="text-xs" style={{ color: tier?.color }}>{tier?.label} · {fam?.label}</div>
                        </div>
                        {setupMonster?.id === m.id && <span className="text-indigo-400 shrink-0 self-start">✅</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        ❤️ {Math.round(m.hp * ms * min)}~{Math.round(m.hp * ms * max)}
                      </div>
                      <div className="text-xs text-slate-500">
                        ⚔️ {Math.round(m.atk * atkM)} 🛡️ {Math.round(m.def * atkM)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {setupMonster && (() => {
              const ms  = setupMode === "novice" ? 1.5 : setupMode === "student" ? 2.0 : 4.0;
              const { min, max } = partyHPRange(memberList.length);
              return (
                <div className="bg-indigo-900/40 border border-indigo-500/50 rounded-xl p-3 flex items-center justify-between text-sm">
                  <span className="text-indigo-200 font-black">{setupMonster.icon} {setupMonster.name}</span>
                  <span className="text-slate-400 text-xs">
                    HP {Math.round(setupMonster.hp * ms * min)}~{Math.round(setupMonster.hp * ms * max)}
                  </span>
                </div>
              );
            })()}

            {/* 剩餘次數 & 防呆訊息 */}
            {partyBattleLeft !== null && (
              <div className={`flex items-center gap-1.5 text-xs font-bold ${partyBattleLeft > 0 ? "text-emerald-400" : "text-red-400"}`}>
                <span>{partyBattleLeft > 0 ? "⚔️" : "😴"}</span>
                <span>今日組隊剩餘 {partyBattleLeft}/5 次</span>
              </div>
            )}
            {startError && (
              <div className="bg-red-900/50 border border-red-500/50 rounded-xl px-3 py-2 text-red-300 text-xs font-bold text-center">
                {startError}
              </div>
            )}
            <div className="bg-slate-800/60 border border-slate-600/40 rounded-xl p-3 flex flex-col gap-3">
              <TargetFmtPicker value={targetFmt} onChange={v => { setTargetFmt(v); setBattleTargetFmt(v); }} />
              <InputModePicker value={targetMode ? "target" : "button"} onChange={v => { const t = v === "target"; setTargetMode(t); setBattleInputMode(v); }} />
            </div>
            {/* 貓貓虛擬夥伴提示 */}
            {hasCat && memberList.length < 2 && (
              <div className="bg-purple-900/40 border border-purple-500/40 rounded-xl px-3 py-2 text-purple-300 text-xs font-bold text-center">
                🐱 {catName} 將作為虛擬夥伴陪你出戰<br/>
                <span className="text-purple-400/70 font-normal">實際組隊加成（XP×1.5）需要真實隊友</span>
              </div>
            )}
            <button onClick={handleStart}
              disabled={!setupMonster || starting || (memberList.length < 1 || (memberList.length < 2 && !hasCat)) || (partyBattleLeft !== null && partyBattleLeft <= 0)}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white font-black text-base rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {starting ? "開始中…"
                : memberList.length < 2 && !hasCat ? `⚔️ 等待更多玩家（${memberList.length}/2）`
                : memberList.length < 2 && hasCat ? `⚔️ 與 🐱${catName} 出戰`
                : `⚔️ 開始戰鬥（${memberList.length}人）`}
            </button>
          </div>
        )}
        {!isHost && (
          <div className="text-center text-slate-400 text-sm py-8 animate-pulse">
            等待房主選擇怪物並開始戰鬥…
          </div>
        )}
      </div>
    );
  }

  // ── 怪物死亡確認畫面（華麗擊殺動畫 + 3秒後自動結算）────────
  // logInited：確保 F5 後也等初始化完才顯示，防止搶在擊殺動畫前跳出
  const hasUnseenLog = !logInited || (room?.log?.length || 0) > prevLogLenRef.current;
  if (room.status === "pending_confirm" && !liveEntry && !hasUnseenLog) {
    const lastEntry = room.log?.[room.log.length - 1];
    const totalTeamDmg = (room.log || []).reduce((s, e) => s + (e.totalDmg || 0), 0);
    const totalRounds  = room.log?.length || 0;
    return (
      <div style={{
        position:"fixed", top:0, bottom:0,
        left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:540,
        overflow:"hidden", zIndex:9999,
        background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20,
      }}>
        <style>{`
@keyframes pbr-die-monster { 0%{filter:brightness(1)} 20%{filter:brightness(3.5) drop-shadow(0 0 40px #ef4444)} 100%{filter:brightness(0.1) grayscale(0.8) drop-shadow(0 0 6px #555)} }
@keyframes pbr-die-badge   { 0%{opacity:0;transform:scale(2.2) rotate(-20deg)} 55%{opacity:1;transform:scale(0.92) rotate(6deg)} 100%{opacity:1;transform:scale(1) rotate(-8deg)} }
@keyframes pbr-die-victory { 0%{opacity:0;transform:scale(0.3) rotate(-12deg)} 55%{transform:scale(1.2) rotate(3deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
@keyframes pbr-die-stats   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes pbr-die-vs      { 0%{opacity:0;transform:scale(0.2) rotate(-18deg)} 55%{transform:scale(1.3) rotate(4deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        `}</style>

        {/* 怪物 + 打倒印章 */}
        <div style={{ position:"relative", display:"inline-block" }}>
          <div style={{ animation:"pbr-die-monster 1.5s ease-out both" }}>
            <PartyMonsterImg id={room.monster?.id} icon={room.monster?.icon} charge={false} size={140}/>
          </div>
          {/* 打倒 印章 */}
          <div style={{
            position:"absolute", inset:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            animation:"pbr-die-badge 0.5s 0.5s cubic-bezier(0.34,1.56,0.64,1) both", opacity:0,
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
              討伐
            </div>
          </div>
        </div>

        {/* 討伐成功文字 */}
        <div style={{ animation:"pbr-die-victory 0.6s 0.8s cubic-bezier(0.34,1.56,0.64,1) both", opacity:0 }}>
          <div style={{ fontSize:36, fontWeight:900, color:"#fbbf24", textShadow:"0 0 32px #f59e0b", letterSpacing:4, textAlign:"center" }}>
            💀 討伐成功！
          </div>
          <div style={{ fontSize:14, color:"#94a3b8", textAlign:"center", marginTop:4 }}>
            {room.monster?.icon} {room.monster?.name} 已被消滅
          </div>
        </div>

        {/* 戰績統計 */}
        <div style={{ animation:"pbr-die-stats 0.5s 1.2s ease-out both", opacity:0, display:"flex", gap:20 }}>
          <div style={{
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)",
            borderRadius:12, padding:"12px 20px", textAlign:"center",
          }}>
            <div style={{ fontSize:22, fontWeight:900, color:"#f87171" }}>{lastEntry?.totalDmg?.toLocaleString() || totalTeamDmg.toLocaleString()}</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>⚔️ 最終傷害</div>
          </div>
          <div style={{
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)",
            borderRadius:12, padding:"12px 20px", textAlign:"center",
          }}>
            <div style={{ fontSize:22, fontWeight:900, color:"#fff" }}>{totalRounds}</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>🔄 回合數</div>
          </div>
          <div style={{
            background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)",
            borderRadius:12, padding:"12px 20px", textAlign:"center",
          }}>
            <div style={{ fontSize:22, fontWeight:900, color:"#fbbf24" }}>{Object.keys(room.members||{}).length}</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>👤 參戰人數</div>
          </div>
        </div>

        {/* 確認按鈕 */}
        <button
          onClick={isHost ? handleConfirmResult : () => setLocalCompleted(true)}
          disabled={isHost && confirming}
          style={{
            width:"100%", maxWidth:280, padding:"14px 0",
            borderRadius:16, fontWeight:900, fontSize:18,
            background:"linear-gradient(90deg,#fbbf24,#f59e0b)",
            color:"#7c2d12", border:"none", cursor:"pointer",
            boxShadow:"0 0 24px #f59e0b66",
            animation:"pbr-die-vs 0.6s 1.6s cubic-bezier(0.34,1.56,0.64,1) both",
            opacity: isHost && confirming ? 0.5 : undefined,
            pointerEvents: isHost && confirming ? "none" : undefined,
          }}>
          {isHost && confirming ? "確認中…" : "🏆 確認討伐！進入結算"}
        </button>
        {!isHost && (
          <div style={{ fontSize:11, color:"#475569", textAlign:"center" }}>
            （房主確認後自動跳轉，或點上方按鈕直接查看結果）
          </div>
        )}
      </div>
    );
  }

  // ── 戰鬥結算畫面 ──────────────────────────────────────────
  if (room.status === "completed" || localCompleted) {
    const won = room.result === "win";

    // 從戰鬥 log 彙總各人數據
    const statsMap = {};
    (room.log || []).forEach(entry => {
      (entry.playerLog || []).forEach(p => {
        if (!statsMap[p.id]) statsMap[p.id] = { name: p.name, dmgDealt: 0, dmgRecvd: 0, crits: 0 };
        statsMap[p.id].dmgDealt += p.dmg   || 0;
        statsMap[p.id].dmgRecvd += p.ctr   || 0;
        statsMap[p.id].crits    += p.crits || 0;
      });
    });
    // 補上沒有 log 的成員（可能全程觀戰）
    memberList.forEach(m => {
      if (!statsMap[m.id]) statsMap[m.id] = { name: m.name, dmgDealt: 0, dmgRecvd: 0, crits: 0 };
    });
    const statsList = Object.entries(statsMap).map(([id, s]) => ({
      id, ...s,
      maxHP: members[id]?.maxHP || 0,
      atk:   members[id]?.atk   || 0,
      def:   members[id]?.def   || 0,
    })).sort((a, b) => b.dmgDealt - a.dmgDealt);
    const mvpId = statsList[0]?.dmgDealt > 0 ? statsList[0].id : null;

    return (
      <div className={`min-h-screen flex flex-col px-4 py-6 gap-4 max-w-lg mx-auto overflow-y-auto ${
        won ? "bg-gradient-to-b from-yellow-900 to-slate-900" : "bg-gradient-to-b from-red-900 to-slate-900"
      }`}>
        {/* 標題 */}
        <BattleResultHeader
          emoji={won ? "🏆" : "💀"}
          title={won ? "討伐成功！" : "全滅了…"}
          subtitle={room.monster ? `${room.monster.icon} ${room.monster.name} · ${room.log?.length || 0} 回合` : ""}
          color={won ? "amber" : "red"}
        />

        {/* 詳細戰績表 */}
        <div className="bg-white/10 rounded-2xl overflow-hidden">
          <div className="px-4 py-2 bg-white/5 text-xs font-black text-slate-400 uppercase tracking-widest">
            戰鬥詳情
          </div>
          {statsList.map(s => {
            const isMvp = s.id === mvpId && won;
            const isMe  = s.id === myId;
            return (
              <div key={s.id}
                className={`px-4 py-3 border-t border-white/5 flex flex-col gap-1.5 ${
                  isMvp ? "bg-yellow-500/20" : ""
                }`}>
                <div className="flex items-center gap-2">
                  {isMvp && <span className="text-yellow-400 text-xs font-black bg-yellow-500/30 px-2 py-0.5 rounded-full">👑 MVP</span>}
                  <span className={`font-black text-sm ${isMe ? "text-indigo-300" : "text-white"}`}>
                    {s.name}{isMe ? " (我)" : ""}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">
                    {members[s.id]?.alive ? "✅ 存活" : "💀 陣亡"}
                  </span>
                </div>
                <div className="flex gap-3 text-xs flex-wrap">
                  <span className="text-rose-400 font-bold">⚔️ 造成 {s.dmgDealt}</span>
                  <span className="text-orange-400">🛡️ 承受 {s.dmgRecvd}</span>
                  {s.crits > 0 && <span className="text-yellow-300">✨ 爆擊 {s.crits} 次</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 完整戰鬥紀錄（可展開）*/}
        {(room.log || []).length > 0 && (
          <div className="bg-white/10 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowFullLog(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-black text-slate-300 active:opacity-70">
              <span>📜 完整戰鬥紀錄（{room.log.length} 回合）</span>
              <span>{showFullLog ? "▲" : "▼"}</span>
            </button>
            {showFullLog && (
              <div className="flex flex-col gap-2 px-4 pb-4 max-h-72 overflow-y-auto">
                {room.log.map((entry, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 text-xs text-slate-300 flex flex-col gap-1.5">
                    <div className="flex justify-between font-black text-slate-400">
                      <span>第 {entry.round} 回合 · 總傷 {entry.totalDmg}</span>
                      <span>{entry.monsterHPBefore} → <span className="text-yellow-300">{entry.monsterHPAfter}</span></span>
                    </div>
                    {entry.event && (
                      <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${
                        entry.event.type === "buff"   ? "bg-emerald-900/40 text-emerald-300" :
                        entry.event.type === "debuff" ? "bg-red-900/40 text-red-300"
                                                      : "bg-yellow-900/40 text-yellow-300"
                      }`}>
                        {entry.event.icon} {entry.event.title}：{entry.event.desc}
                      </div>
                    )}
                    {(entry.playerLog || []).map((p, j) => (
                      <div key={j} className="flex items-center gap-2 text-[11px]">
                        <span className="text-indigo-300">🏹 {p.name}</span>
                        <span className="text-rose-400 font-black">+{p.dmg}</span>
                        {p.crits > 0 && <span className="text-yellow-300">✨{p.crits}</span>}
                        {entry.counterRound && p.ctr > 0 && <span className="text-orange-400 ml-auto">-{p.ctr}</span>}
                      </div>
                    ))}
                    {entry.counterRound && <div className="text-orange-300 text-[10px]">💥 反擊回合</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 勝利：領取寶箱 */}
        {won && (
          <div className="flex flex-col gap-3">
            {isGuestPlayer ? (
              /* 訪客：無背包，直接顯示紀念獎勵 */
              guestAlreadyWon ? (
                <div className="bg-slate-700/50 border border-slate-600 rounded-2xl p-4 text-center">
                  <div className="text-2xl mb-2">🎮</div>
                  <div className="text-slate-300 font-black text-sm">感謝體驗組隊打怪！</div>
                  <div className="text-slate-500 text-xs mt-1">此次不提供額外獎勵（每位訪客限領一次）</div>
                </div>
              ) : guestLoot ? (
                <div className="bg-yellow-900/50 border-2 border-yellow-500 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="text-yellow-200 font-black text-sm text-center">🎁 體驗獎勵</div>
                  <div className="flex flex-col items-center gap-2 py-2">
                    <span className="text-5xl">{guestLoot.icon}</span>
                    <span className="text-white font-black text-base">{guestLoot.name}</span>
                    <span className="text-slate-300 text-xs text-center px-4">{guestLoot.desc}</span>
                  </div>
                  <div className="bg-yellow-500/20 rounded-xl p-2 text-center text-yellow-300 text-xs font-bold">
                    📸 請截圖後出示給教練領取！
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-xs text-center animate-pulse">計算獎勵中…</div>
              )
            ) : (
              /* 一般會員：正常寶箱領取流程 */
              <>
                {!myClaimed && myChests.length > 0 && (
                  <div className="bg-yellow-900/50 border-2 border-yellow-500 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="text-yellow-200 font-black text-sm text-center">🎁 你的戰利品</div>

                    {/* 寶箱列表 */}
                    <div className="flex justify-center gap-3 flex-wrap">
                      {myChests.map(c => {
                        const info = CHEST_TYPES[c.type];
                        return info ? (
                          <div key={c.id} className="flex flex-col items-center gap-1">
                            <span className="text-3xl">{info.icon}</span>
                            <span className="text-xs text-white font-bold">{info.name}</span>
                          </div>
                        ) : null;
                      })}
                    </div>

                    {/* 金幣 + 掉落預覽 */}
                    {previewReward && (
                      <div className="bg-black/30 rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap justify-center">
                        <div className="flex items-center gap-1">
                          <span className="text-base">🪙</span>
                          <span className="text-yellow-300 font-black text-sm">+{previewReward.coins}</span>
                        </div>
                        {previewReward.material && (
                          <div className="flex items-center gap-1">
                            <span className="text-base">{previewReward.material.icon}</span>
                            <span className="text-slate-300 text-xs font-bold">{previewReward.material.name}</span>
                          </div>
                        )}
                        {previewReward.card && (
                          <div className="flex items-center gap-1">
                            <span className="text-base">{previewReward.card.icon}</span>
                            <span className="text-rose-300 text-xs font-black">🃏 {previewReward.card.name}</span>
                          </div>
                        )}
                        {!previewReward.material && !previewReward.card && (
                          <span className="text-slate-500 text-xs">本次無材料掉落</span>
                        )}
                      </div>
                    )}

                    <button onClick={handleClaim} disabled={claiming}
                      className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 font-black rounded-xl active:scale-95 transition-transform disabled:opacity-50">
                      {claiming ? "領取中…" : "✅ 確認領取寶箱"}
                    </button>
                  </div>
                )}
                {myClaimed && (
                  <div className="flex flex-col gap-2">
                    <div className="bg-emerald-900/40 border border-emerald-500 rounded-2xl p-3 text-emerald-400 font-black text-sm text-center">
                      ✅ 寶箱已入庫！
                    </div>
                    {claimResult && (
                      <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-2xl p-3">
                        <div className="text-yellow-300 text-xs font-black mb-2 text-center">⚔️ 擊殺掉落</div>
                        <div className="flex gap-3 justify-center flex-wrap">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xl">🪙</span>
                            <span className="text-yellow-200 font-black text-sm">+{claimResult.coins}</span>
                          </div>
                          {claimResult.coinChest && (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xl">{claimResult.coinChest.icon}</span>
                              <span className="text-xs font-black" style={{ color: claimResult.coinChest.color }}>{claimResult.coinChest.name}</span>
                              <span className="text-yellow-200 text-xs">🎒 已放入背包</span>
                            </div>
                          )}
                          {claimResult.material && (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xl">{claimResult.material.icon}</span>
                              <span className="text-slate-300 text-xs">{claimResult.material.name}</span>
                            </div>
                          )}
                          {claimResult.card && (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xl">{claimResult.card.icon}</span>
                              <span className="text-rose-300 text-xs font-black">🃏 {claimResult.card.name}</span>
                            </div>
                          )}
                          {claimResult.archerXP > 0 && (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xl">🏹</span>
                              <span className="text-sky-300 font-black text-sm">+{claimResult.archerXP} XP</span>
                              <span className="text-slate-400 text-xs">射手經驗</span>
                            </div>
                          )}
                          {claimResult.catXP > 0 && (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xl">🐱</span>
                              <span className="text-pink-300 font-black text-sm">+{claimResult.catXP} XP</span>
                              <span className="text-slate-400 text-xs">貓貓經驗</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!myChests.length && !room.rewardPending && !myClaimed && (
                  isHost ? (
                    <button onClick={() => {
                      rewardStoredRef.current = false;
                      const memberIds = Object.keys(room.members || {});
                      storeBattleRewards(roomId, memberIds, room.monster, room.mode || "student").catch(() => {});
                    }} className="w-full py-2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-xs font-black rounded-xl active:opacity-70">
                      🔄 發放獎勵（點此重試）
                    </button>
                  ) : (
                    <div className="text-slate-400 text-xs text-center animate-pulse">等待房主發放獎勵…</div>
                  )
                )}
              </>
            )}
          </div>
        )}

        {/* 分享戰績小卡 */}
        <button onClick={() => setShowShareCard(true)}
          className="w-full py-3 bg-slate-700 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-transform border border-slate-500">
          📤 分享戰績小卡
        </button>

        {isHost ? (
          <>
            <button onClick={handleNextRound} disabled={resetting}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {resetting ? "重置中…" : "🔄 繼續下一場"}
            </button>
            <button onClick={onLeave}
              className="w-full py-3 bg-white text-slate-900 font-black rounded-2xl shadow-lg active:scale-95 transition-transform">
              🏠 解散房間
            </button>
          </>
        ) : (
          <>
            <div className="text-slate-400 text-xs text-center">
              房間仍開啟，房主可繼續下一場
            </div>
            <button onClick={onLeave}
              className="w-full py-3 bg-white text-slate-900 font-black rounded-2xl shadow-lg active:scale-95 transition-transform">
              🏠 離開房間
            </button>
          </>
        )}

        {showShareCard && (
          <PartyBattleCard
            onClose={() => setShowShareCard(false)}
            partyData={{
              monster:   room.monster,
              statsList,
              mvpId,
              result:    room.result,
              rounds:    room.log?.length || 0,
            }}
          />
        )}
      </div>
    );
  }

  // ── 戰鬥中畫面 ────────────────────────────────────────────
  // 動畫期間用當前小回合的 HP，動畫結束後回到 Firestore 最終值
  const curMini        = liveEntry?.miniRounds?.[liveMiniRoundIdx];
  const displayHP      = liveEntry ? (curMini?.monsterHPAfter ?? room.monsterHP) : room.monsterHP;
  const monsterPct     = room.monsterMaxHP > 0 ? (displayHP / room.monsterMaxHP) : 0;
  // 當前小回合每位玩家的傷害 Map（高亮用）
  const isCatMini      = !!(curMini?.isCat);
  const catOverlayCats = (isCatMini && curMini?.playerLog)
    ? curMini.playerLog.map(p => ({
        catId:   room?.members?.[p.id]?.archerStyle || "baobao",
        catName: (p.name || "").replace(/^🐱/, "") || "貓貓",
        dmg:     p.dmg || 0,
      }))
    : [];
  const curMiniDmgMap  = liveEntry
    ? Object.fromEntries((curMini?.playerLog || []).map(p => [p.id, p.dmg]))
    : {};
  const curMiniMaxDmg  = liveEntry ? Math.max(...Object.values(curMiniDmgMap), 1) : 0;
  // 自己上一回合的 arrowBreakdown（顯示在送出按鈕上方）
  const myLastPLog = room.log?.length > 0
    ? room.log[room.log.length - 1]?.playerLog?.find(p => p.id === myId)
    : null;
  const myArrowTotal   = arrows.reduce((s, a) => s + a.score, 0);
  // 每位玩家欄位等寬：(540 容器 - 12px 左右 padding - gap*(n-1)) / n，上限 100px
  const frontMembers = memberList.slice(0, 4);
  const backMembers  = memberList.slice(4);
  const frontW = Math.min(100, Math.floor((528 - Math.max(0, frontMembers.length - 1) * 3) / (frontMembers.length || 1)));
  const backW  = Math.min(80,  Math.floor((528 - Math.max(0, backMembers.length  - 1) * 3) / (backMembers.length  || 1)));
  const showBackRow = !!(liveEntry || room.processing);

  return (
    <div style={{
      position:"fixed", top:0, bottom:0, left:"50%", transform:"translateX(-50%)",
      width:"100%", maxWidth:540, zIndex:9999, overflow:"hidden",
      backgroundImage:`url(${battleBgRef.current || "/ui/dungeon-bg.webp"})`, backgroundSize:"cover", backgroundPosition:"center",
      display:"flex", flexDirection:"column",
    }}>
      <style>{`
@keyframes mb-float{0%{transform:translateY(0) scale(1.15);opacity:1}100%{transform:translateY(-60px) scale(0.85);opacity:0}}
@keyframes mb-charge{0%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.35) rotate(-12deg)}60%{transform:scale(1.5) rotate(0deg)}80%{transform:scale(1.35) rotate(10deg)}100%{transform:scale(1) rotate(0deg)}}
@keyframes mb-screen-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}80%{transform:translateX(-3px)}}
@keyframes mb-monster-hit{0%{filter:brightness(1)}40%{filter:brightness(2) saturate(0)}100%{filter:brightness(1)}}
@keyframes mb-archer-attack{0%{transform:translateX(0)}30%{transform:translateX(8px)}60%{transform:translateX(-3px)}100%{transform:translateX(0)}}
@keyframes pop{0%{transform:scale(0.7);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
      `}</style>

      <CatMsg msg={catMsg} onDone={clearCatMsg}/>
      <CatRoundOverlay
        open={!!liveEntry && isCatMini}
        cats={catOverlayCats}
        totalDmg={curMini?.totalDmg}
      />

      {/* 加油通知 */}
      {cheerMsg && (
        <div style={{ position:"fixed", top:48, left:0, right:0, zIndex:60, display:"flex", justifyContent:"center", pointerEvents:"none", padding:"0 16px" }}>
          <div style={{ background:"rgba(79,70,229,0.92)", color:"#fff", fontWeight:900, fontSize:13, padding:"8px 20px", borderRadius:24, boxShadow:"0 4px 20px rgba(0,0,0,0.5)" }}>
            {cheerMsg}
          </div>
        </div>
      )}

      {/* 隨機事件彈窗 */}
      {showEvent && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 24px", background:"rgba(0,0,0,0.72)", pointerEvents:"none" }}>
          <div style={{
            borderRadius:20, padding:"20px 24px", textAlign:"center", maxWidth:280, width:"100%", animation:"pop .4s ease",
            background: showEvent.type==="buff" ? "linear-gradient(135deg,#064e3b,#065f46)" : showEvent.type==="debuff" ? "linear-gradient(135deg,#450a0a,#7f1d1d)" : "linear-gradient(135deg,#1e3a5f,#1e40af)",
            border: showEvent.type==="buff" ? "2px solid #10b981" : showEvent.type==="debuff" ? "2px solid #ef4444" : "2px solid #3b82f6",
          }}>
            <div style={{ fontSize:48, marginBottom:8 }}>{showEvent.icon}</div>
            <div style={{ fontWeight:900, fontSize:17, marginBottom:8, color: showEvent.type==="buff" ? "#6ee7b7" : showEvent.type==="debuff" ? "#fca5a5" : "#93c5fd" }}>{showEvent.title}</div>
            <div style={{ color:"#cbd5e1", fontSize:12, lineHeight:1.6 }}>{showEvent.desc}</div>
          </div>
        </div>
      )}

      {/* 戰鬥日誌（左上角小視窗）*/}
      {room.status === "active" && (() => {
        const events = [];
        for (const entry of (room.log || []).slice(-3)) {
          for (const mini of (entry.miniRounds || [])) {
            if (mini.isCounter) {
              const totalCtr = (mini.playerLog || []).reduce((s, p) => s + (p.ctr || 0), 0);
              events.push({ key: `c${entry.round}_${mini.miniRound}`, text: `⚡ 反擊 -${totalCtr}`, color: "#fb923c" });
            } else if (mini.isCat) {
              const totalCat = (mini.playerLog || []).reduce((s, p) => s + (p.dmg || 0), 0);
              events.push({ key: `k${entry.round}_${mini.miniRound}`, text: `🐱 貓咪 -${totalCat}`, color: "#f9a8d4" });
            } else {
              const pl = mini.playerLog?.[0];
              if (pl) events.push({ key: `a${entry.round}_${mini.miniRound}`, text: `🏹 ${pl.name.slice(0, 4)} -${pl.dmg}${pl.crits > 0 ? "💥" : ""}`, color: "#93c5fd" });
            }
          }
        }
        const shown = events.slice(-8);
        if (!shown.length) return null;
        return (
          <div style={{ position:"absolute", top:8, left:8, width:160, zIndex:30, display:"flex", flexDirection:"column", gap:2, pointerEvents:"none" }}>
            {shown.map(ev => (
              <div key={ev.key} style={{ background:"rgba(0,0,0,0.75)", borderRadius:5, padding:"2px 6px", fontSize:10, fontWeight:700, color:ev.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {ev.text}
              </div>
            ))}
          </div>
        );
      })()}

      {/* 上半：左側 log + 右側怪物 */}
      <div style={{ flex:"1 1 0", minHeight:0, display:"flex", gap:6, padding:"8px 8px 0" }}>

        {/* 怪物區（全寬） */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, paddingTop:8 }}>
          {/* 怪物名稱 + 離開按鈕 */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
              <span style={{ color:"white", fontWeight:900, fontSize:17, textShadow:"0 2px 8px #000" }}>{room.monster?.name}</span>
              {tierInfo && <span style={{ fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:4, color:tierInfo.color, background:tierInfo.bg }}>{tierInfo.label}</span>}
            </div>
            <button onClick={handleLeave} style={{ padding:"3px 9px", borderRadius:8, fontSize:11, fontWeight:700, border:"none", cursor:"pointer", background:"rgba(255,255,255,0.07)", color:"#94a3b8" }}>離開</button>
          </div>

          <BattleHPBar current={displayHP} max={room.monsterMaxHP || 0} />

          <BattleStatusTags tags={[
              { icon:"⚔️", label:`第${liveEntry ? liveEntry.round : room.round}回`, color:"#94a3b8" },
              { icon:"💢", label:room.monster?.atk, color:"#f87171", bg:"rgba(239,68,68,0.15)" },
              { icon:"🛡️", label:room.monster?.def, color:"#60a5fa", bg:"rgba(59,130,246,0.15)" },
              { icon:"👤", label:`${aliveCount}/${memberList.length}`, color:"#94a3b8" },
              ...(isCatMini ? [{ icon:"🐱", label:"貓咪出擊！", color:"#f9a8d4", bg:"rgba(236,72,153,0.2)", style:{fontWeight:900} }] : []),
            ]} />

          {/* 怪物圖（上對齊，縮小顯示）*/}
          <div style={{ flex:1, position:"relative", display:"flex", alignItems:"flex-start", justifyContent:"center", minHeight:0 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", animation: animMonsterCharge ? "mb-charge 0.7s ease infinite" : animHit ? "mb-monster-hit 0.5s ease" : undefined }}>
              <PartyMonsterImg id={room.monster?.id} icon={room.monster?.icon} charge={false}/>
            </div>
            {/* 浮動傷害數字 */}
            {liveEntry && curMini && (() => {
              const totalNow = Object.values(curMiniDmgMap).reduce((s,d)=>s+d,0);
              if (totalNow <= 0) return null;
              return (
                <span key={liveMiniRoundIdx} style={{ position:"absolute", top:"18%", left:"50%", transform:"translateX(-50%)", fontSize:"1.5rem", fontWeight:900, color:"#fbbf24", textShadow:"0 2px 10px rgba(0,0,0,0.9)", animation:"mb-float 1.4s ease-out forwards", pointerEvents:"none", whiteSpace:"nowrap" }}>
                  -{totalNow}
                </span>
              );
            })()}
          </div>

          {/* 小回合進度點 */}
          {liveEntry && (
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:4, padding:"3px 0 5px" }}>
              {(liveEntry.miniRounds||[]).map((mini,i) => (
                <div key={i} style={{ width:7, height:7, borderRadius:"50%", background: i===liveMiniRoundIdx?"#fbbf24":i<liveMiniRoundIdx?(mini.isCounter?"#f97316":"#6366f1"):"rgba(255,255,255,0.1)", transform:i===liveMiniRoundIdx?"scale(1.4)":"scale(1)", transition:"all 0.3s" }}/>
              ))}
              {curMini?.isCounter && <span style={{ fontSize:10, color:"#fb923c", fontWeight:900, marginLeft:4 }}>⚡反擊</span>}
            </div>
          )}
        </div>
      </div>

      {/* 弓箭手 + 玩家資訊：前後排 */}
      <div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.82)", borderTop:"1px solid rgba(255,255,255,0.08)" }}>
        {/* 前排（最多4人）：完整顯示 */}
        <div style={{
          display:"flex", gap:3, padding:"4px 6px 4px", justifyContent:"center",
          animation: animScreenShake ? "mb-screen-shake 0.55s ease" : undefined,
        }}>
          {frontMembers.map(m => {
            const miniDmg = curMiniDmgMap[m.id];
            const isTopHit = liveEntry && m.alive && miniDmg !== undefined && !animCounter && !isCatMini && miniDmg > 0 && miniDmg >= curMiniMaxDmg;
            const memberArcherStyle = m.archerStyle || "baobao";
            const isMe = m.id === myId;
            const pLog = liveEntry && curMini ? (curMini.playerLog||[]).find(p=>p.id===m.id) : null;
            const pArrow = pLog?.arrowBreakdown?.[0];
            const displayHp = localHpOverride[m.id] !== undefined ? localHpOverride[m.id] : m.hp;
            const hpPct = m.maxHP > 0 ? Math.max(0, Math.min(1, displayHp/m.maxHP)) : 0;
            const catId = m.archerStyle || "baobao";
            const hasMyCatMsg = isMe && catMsg;
            return (
              <div key={m.id} style={{
                flexShrink:0, width:frontW, display:"flex", flexDirection:"column",
                border:`1px solid ${isMe?"rgba(251,191,36,0.35)":"rgba(255,255,255,0.07)"}`,
                borderRadius:8, overflow:"hidden",
                background: isMe?"rgba(251,191,36,0.04)":"rgba(255,255,255,0.01)",
              }}>
                {/* 弓箭手圖 */}
                <div style={{ height:90, position:"relative", flexShrink:0, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                  {floatCounterDmgs.filter(f=>f.memberId===m.id).map(f => (
                    <span key={f.id} style={{ position:"absolute", top:"5%", left:"50%", transform:"translateX(-50%)", zIndex:10, animation:"mb-float 1.3s ease-out forwards", fontWeight:900, fontSize:"0.9rem", color:"#f43f5e", textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap", pointerEvents:"none" }}>{f.text}💢</span>
                  ))}
                  {pArrow && (
                    <div style={{ position:"absolute", bottom:"100%", left:"50%", transform:"translateX(-50%)", zIndex:15, background:"rgba(0,0,0,0.85)", borderRadius:5, padding:"1px 4px", fontSize:9, fontWeight:900, whiteSpace:"nowrap", marginBottom:2, color: pArrow.dmg===0?"#64748b":pArrow.isCrit?"#fbbf24":"#f87171" }}>
                      {pArrow.dmg>0?`+${pArrow.dmg}`:"miss"}{pArrow.isCrit?"💥":""}{curMini?.isCounter&&pLog.ctr>0?`/-${pLog.ctr}`:""}
                    </div>
                  )}
                  <img src={`/cats/archers/${memberArcherStyle}.webp`} alt={m.name}
                    style={{
                      height:"100%", objectFit:"contain", objectPosition:"center bottom",
                      filter: !m.alive ? "grayscale(100%) opacity(0.25)" : undefined,
                      animation: isTopHit && !animCounter ? "mb-archer-attack 0.4s ease" : undefined,
                      outline: isMe ? "2px solid rgba(251,191,36,0.6)" : undefined,
                      outlineOffset:"2px", borderRadius:2,
                    }}
                    onError={e => { e.target.style.display="none"; }}/>
                </div>
                <div style={{ height:1, background:"rgba(255,255,255,0.06)", flexShrink:0 }}/>
                <div style={{ padding:"3px 3px 4px", textAlign:"center" }}>
                  <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden", marginBottom:2 }}>
                    <div style={{ height:"100%", borderRadius:3, width:`${hpPct*100}%`, transition:"width 0.5s ease", background: hpPct>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":hpPct>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)", boxShadow:hpPct<=0.25?"0 0 6px rgba(239,68,68,0.8)":undefined }}/>
                  </div>
                  <div style={{ fontSize:10, fontWeight:700, color:isMe?"#fbbf24":"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:1 }}>
                    {!m.alive&&"💀"}{m.name.slice(0,6)}{m.id===room.hostId?" 👑":""}
                  </div>
                  <div style={{ display:"flex", justifyContent:"center", gap:4, marginBottom:1 }}>
                    <div style={{ fontSize:9, color:"#f87171" }}>⚔️{m.atk}</div>
                    <div style={{ fontSize:9, color:"#60a5fa" }}>🛡{m.def}</div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"center", marginBottom:1 }}>
                    <div style={{ width:16, height:16, borderRadius:"50%", overflow:"hidden", border:`1px solid ${hasMyCatMsg?"#a78bfa":"rgba(255,255,255,0.18)"}`, boxShadow:hasMyCatMsg?"0 0 6px rgba(167,139,250,0.9)":undefined, transition:"box-shadow 0.3s" }}>
                      <img src={`/cats/portraits/${catId}.webp`} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{e.target.style.display="none"}}/>
                    </div>
                  </div>
                  <div style={{ fontSize:9, color: liveEntry?"#64748b":m.ready?"#4ade80":m.arrows?.length>0?"#fbbf24":"#475569" }}>
                    {!m.alive?"💀":liveEntry?"⚙️":m.ready?(m.skipped?"⏭":"✅"):m.arrows?.length>0?`🏹${m.arrows.length}`:"⏳"}
                  </div>
                  {isHost && m.alive && !m.ready && m.id!==myId && !room.processing && (
                    <button onClick={()=>handleForceSkip(m.id)} disabled={skipping===m.id}
                      style={{ fontSize:8, padding:"1px 4px", borderRadius:3, background:"rgba(255,255,255,0.08)", color:"#64748b", border:"none", cursor:"pointer", marginTop:1 }}>
                      {skipping===m.id?"…":"跳"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* 後排（第5-8人）：僅射手圖+血條+名字，戰鬥期間才顯示 */}
        {backMembers.length > 0 && showBackRow && (
          <div style={{ display:"flex", gap:3, padding:"0 6px 6px", justifyContent:"center" }}>
            {backMembers.map(m => {
              const displayHp = localHpOverride[m.id] !== undefined ? localHpOverride[m.id] : m.hp;
              const hpPct = m.maxHP > 0 ? Math.max(0, Math.min(1, displayHp/m.maxHP)) : 0;
              const memberArcherStyle = m.archerStyle || "baobao";
              const isMe = m.id === myId;
              return (
                <div key={m.id} style={{
                  flexShrink:0, width:backW, display:"flex", flexDirection:"column",
                  border:`1px solid ${isMe?"rgba(251,191,36,0.35)":"rgba(255,255,255,0.07)"}`,
                  borderRadius:8, overflow:"hidden",
                  background: isMe?"rgba(251,191,36,0.04)":"rgba(255,255,255,0.01)",
                }}>
                  <div style={{ height:60, position:"relative", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
                    {floatCounterDmgs.filter(f=>f.memberId===m.id).map(f => (
                      <span key={f.id} style={{ position:"absolute", top:"5%", left:"50%", transform:"translateX(-50%)", zIndex:10, animation:"mb-float 1.3s ease-out forwards", fontWeight:900, fontSize:"0.75rem", color:"#f43f5e", textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap", pointerEvents:"none" }}>{f.text}💢</span>
                    ))}
                    <img src={`/cats/archers/${memberArcherStyle}.webp`} alt={m.name}
                      style={{
                        height:"100%", objectFit:"contain", objectPosition:"center bottom",
                        filter: !m.alive ? "grayscale(100%) opacity(0.25)" : undefined,
                        outline: isMe ? "2px solid rgba(251,191,36,0.6)" : undefined,
                        outlineOffset:"2px", borderRadius:2,
                      }}
                      onError={e => { e.target.style.display="none"; }}/>
                  </div>
                  <div style={{ height:1, background:"rgba(255,255,255,0.06)" }}/>
                  <div style={{ padding:"2px 2px 3px", textAlign:"center" }}>
                    <div style={{ height:4, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden", marginBottom:1 }}>
                      <div style={{ height:"100%", borderRadius:3, width:`${hpPct*100}%`, transition:"width 0.5s ease", background: hpPct>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":hpPct>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)" }}/>
                    </div>
                    <div style={{ fontSize:9, fontWeight:700, color:isMe?"#fbbf24":"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {!m.alive&&"💀"}{m.name.slice(0,5)}{m.id===room.hostId?" 👑":""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 輸入區 */}
      <div style={{ flex:"0 0 auto", background:"rgba(0,0,0,0.68)", padding:"3px 6px 10px" }}>
        {me.alive && !myReady && !liveEntry && !scoringReady && (
          <button onClick={() => setScoringReady(true)} style={{ width:"100%", padding:"11px 0", borderRadius:12, fontWeight:900, fontSize:14, cursor:"pointer", background:"linear-gradient(90deg,#7c3aed,#2563eb)", color:"white", border:"none", marginTop:2 }}>
            🎯 開始計分
          </button>
        )}
        {me.alive && !myReady && !liveEntry && scoringReady && (
          <>
            {/* HP 危機警告 */}
            {me.hp > 0 && me.maxHP > 0 && me.hp/me.maxHP < 0.25 && (
              <div style={{ textAlign:"center", color:"#ef4444", fontWeight:900, fontSize:11, padding:"2px 0 3px" }}>
                ⚠️ HP 危急！請謹慎作戰
              </div>
            )}
            <BattleArrowSlots
                arrows={arrows}
                totalArrows={ARROWS_PER_ROUND}
                onUndo={removeLastArrow}
                showUndo={arrows.length>0}
                extraContent={
                  <button onClick={() => setTargetMode(m => !m)} style={{
                    marginLeft:2, padding:"2px 7px", borderRadius:6, fontSize:11, fontWeight:700,
                    background: targetMode?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.07)",
                    border:`1px solid ${targetMode?"#22c55e":"rgba(255,255,255,0.15)"}`,
                    color: targetMode?"#4ade80":"rgba(255,255,255,0.4)", cursor:"pointer",
                  }}>🎯</button>
                }
              />
            {targetPending && (
              <div style={{ textAlign:"center", fontSize:12, color:"#a78bfa", fontWeight:700, marginBottom:4 }}>計算中…⚔️</div>
            )}
            <BattleScoreButtons
                labels={SCORE_LABELS}
                onScore={addArrow}
                variant="image"
              />
            <TargetFaceOverlay
              open={targetMode && !targetPending && !myReady}
              fmtId={targetFmt}
              arrowLabels={arrows.map(a => a.label)}
              arrowsPerRound={ARROWS_PER_ROUND}
              onArrow={addArrow}
              onUndo={removeLastArrow}
              onSubmit={handleTargetSubmit}
              onClose={() => { setTargetMode(false); setBattleInputMode("button"); }}
            />
            {/* 送出 */}
            <button onClick={handleSubmit} disabled={arrows.length<ARROWS_PER_ROUND||submitting||targetPending}
              style={{ width:"100%", padding:"9px 0", borderRadius:12, fontWeight:900, fontSize:13, cursor:"pointer",
                background: (arrows.length===ARROWS_PER_ROUND&&!targetPending) ? "linear-gradient(90deg,#7c3aed,#2563eb)" : "rgba(255,255,255,0.07)",
                color:"white", border:"none", opacity:(arrows.length<ARROWS_PER_ROUND||submitting||targetPending)?0.55:1 }}>
              {(submitting||targetPending)?"計算中…":`✅ 送出 (${myArrowTotal}分)`}
            </button>
          </>
        )}

        {me.alive && myReady && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"4px 0" }}>
            <div style={{ color:"#4ade80", fontWeight:900, fontSize:12 }}>
              ✅ 已送出，等待其他隊員…
              {room.processing && <span style={{ color:"#fbbf24", marginLeft:8 }}>⚙️</span>}
            </div>
            <button onClick={() => sendPartyCheer(roomId, me.name)}
              style={{ padding:"6px 18px", borderRadius:12, fontWeight:900, fontSize:12, cursor:"pointer", background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.35)", color:"#a5b4fc" }}>
              💪 為隊友加油！
            </button>
          </div>
        )}

        {!me.alive && room.status==="active" && (
          <div style={{ textAlign:"center", padding:"6px 0", color:"#475569", fontWeight:900, fontSize:12 }}>
            💀 你已陣亡，觀戰中…
          </div>
        )}
      </div>
    </div>
  );
}
