// src/components/party/PartyBattleRoom.jsx — 組隊打怪房間
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribePartyRoom, startPartyBattle, updateBattleMemberStats,
  submitArrows, processPartyRound, leavePartyRoom, partyHPRange,
  forceSkipPlayer, storeBattleRewards, claimBattleReward, confirmBattleResult,
  resetPartyRoom, sendPartyCheer, addBotToPartyRoom, removeBotFromPartyRoom,
  clearPartyProcessing,
} from "../../lib/partyDb";
import { generateBotArrows, BOT_STATS, makeBotId, randomBotName } from "../../lib/botUtils";
import { subscribePotions, usePotions, checkPartyBattleLimit, recordPartyBattleSession, addCoins, addMaterials, addMonsterCard, recordBattleDex, subscribeCardCollection } from "../../lib/db";
import { calcEquippedBonus } from "../../lib/monsterCards";
import { sfxTap, sfxArrowShoot, sfxCast, sfxBuff, sfxDebuff, sfxEpic, sfxSuccess, sfxSoftFail, sfxCounter, sfxCounterCrit, sfxCritBoom, sfxRoundEnd, sfxPotionDrink, vibrate } from "../../lib/sound";
import { calcDamage, calcCounterDamage, calcArcherStats, calcArcherPower, drawMatchedMonsters, TIER_LABEL, FAMILIES, resolveHitPart } from "../../lib/monsterData";
import { makeChests, CHEST_TYPES, getPotion, calcPotionBuffs, MAX_POTIONS_PER_BATTLE } from "../../lib/itemData";
import PartyBattleCard from "./PartyBattleCard";
import { LOOT_TABLE_GUEST, drawLoot, rollCoins, rollMaterialDrop, rollCardDrop } from "../../lib/lootTable";

const SCORE_MAP    = { X:10, 10:10, 9:9, 8:8, 7:7, 6:6, 5:5, 4:4, 3:3, 2:2, 1:1, M:0 };
const SCORE_LABELS = ["X","10","9","8","7","6","5","4","3","M"];
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
];

// 依 profile 計算實際數值（帶入裝備 / 成就 / 報到次數 / 怪物卡片）
function getArcherStats(profile, potionIds = [], cardBonus = { hp: 0, atk: 0, def: 0 }) {
  const base = calcArcherStats({ member: profile, certification: null, certRecords: [], dexStats: null });
  let hp  = base.hp  + (cardBonus.hp  || 0);
  let atk = base.atk + (cardBonus.atk || 0);
  let def = base.def + (cardBonus.def || 0);
  if (potionIds.length) {
    const buffs = calcPotionBuffs(potionIds);
    hp  = Math.round(hp  * buffs.hpMult);
    atk = Math.round(atk * buffs.atkMult);
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

// guestOverride = { id, name } — 訪客模式時傳入，覆蓋 profile.id
export default function PartyBattleRoom({ roomId, isHost, onLeave, guestOverride }) {
  const { profile: authProfile } = useAuth();
  const profile = guestOverride ? null : authProfile;
  const [room,            setRoom]            = useState(null);
  const [arrows,          setArrows]          = useState([]);
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

  const statsWrittenRef   = useRef(false); // 戰鬥中寫入
  const statsWaitingRef   = useRef(false); // 等待室寫入
  const rewardStoredRef   = useRef(false); // 防重複存獎勵
  const roundGuardRef  = useRef(0);    // 已派出結算的回合號（ref = 同步，避免 stale closure）
  const retryCountRef  = useRef(0);   // 同回合連續失敗次數（≥3 停止重試）
  const retryRoundRef  = useRef(0);   // retryCount 所屬的回合（換回合時歸零）
  const cardCollRef       = useRef({ cards: {}, equipped: [] }); // 怪物卡片裝備（ref 避免影響 effect 依賴）
  const partyRecordedRef  = useRef(false); // 每日次數記錄（只記一次）
  const dexRecordedRef    = useRef(false); // 圖鑑記錄（每場只記一次）
  const prevLogLenRef     = useRef(0);     // 動畫觸發用
  const logInitializedRef = useRef(false); // 首次載入時跳過已存在的 log（F5 防重播）
  const revealTimersRef   = useRef([]);    // 逐人揭曉計時器
  const logEndRef         = useRef(null);

  const myId = guestOverride?.id || authProfile?.id;

  useEffect(() => {
    const unsub = subscribePartyRoom(roomId, setRoom);
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
  }, [room?.status]); // eslint-disable-line

  // 房主：進入等待室時預查今日剩餘次數（訪客無限制，略過）
  useEffect(() => {
    if (!myId || !isHost || myId.startsWith("guest")) return;
    checkPartyBattleLimit(myId).then(setPartyBattleLeft);
  }, [myId, isHost]); // eslint-disable-line

  // 房主：依自身戰力抽出 6 隻怪物候選（每族1隻）
  useEffect(() => {
    if (!isHost || !room || room.status !== "waiting" || drawnMonsters.length > 0) return;
    const stats = getArcherStats(profile, [], getMyCardBonus());
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
    const stats = getArcherStats(profile, [], getMyCardBonus());
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def);
  }, [room?.status, myId]); // eslint-disable-line

  // 開戰後套入藥水 buff 重新寫入最終數值
  useEffect(() => {
    if (!room || !myId || room.status !== "active" || statsWrittenRef.current) return;
    const me = room.members?.[myId];
    if (!me) return;
    statsWrittenRef.current = true;
    const stats = getArcherStats(profile, selectedPotions, getMyCardBonus());
    updateBattleMemberStats(roomId, myId, stats.hp, stats.hp, stats.atk, stats.def);
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
    // 未 ready 的機器人：立即幫牠送出箭分，等下一次 snapshot 再檢查
    const botsUnready = aliveIds.filter(id => members[id].isBot && !members[id].ready);
    if (botsUnready.length > 0) {
      botsUnready.forEach(botId => {
        const arrows = generateBotArrows(members[botId].difficulty || "normal");
        submitArrows(roomId, botId, arrows).catch(() => {});
      });
      return;
    }
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
    storeBattleRewards(roomId, memberIds, room.monster)
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

    // 怪物受擊動畫
    setAnimHit(true);
    setTimeout(() => setAnimHit(false), 700);

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

    // 逐小回合播放（每 1.2 秒一個，反擊小回合多 1.5 秒動畫時間）
    const miniRounds = entry.miniRounds || [];
    let delay = eventDelay;
    miniRounds.forEach((mini, idx) => {
      // 每支箭顯示時都播音效
      const t = setTimeout(() => { setLiveMiniRoundIdx(idx); sfxArrowShoot(); vibrate(8); }, delay);
      revealTimersRef.current.push(t);

      if (mini.isCounter) {
        // 600ms 後蓄力（讓玩家先看清箭傷），1400ms 反擊
        const t1 = setTimeout(() => setAnimMonsterCharge(true),  delay + 600);
        const t2 = setTimeout(() => {
          setAnimMonsterCharge(false);
          setAnimCounter(true);
          setAnimScreenShake(true);
          // 根據反擊傷害選擇音效
          const totalCtrDmg = (mini.playerLog || []).reduce((s, p) => s + (p.ctr || 0), 0);
          if (totalCtrDmg > 80) sfxCounterCrit(); else sfxCounter();
          vibrate([0, 35, 55, 30]);
          const floats = (mini.playerLog || [])
            .filter(p => p.ctr > 0)
            .map(p => ({ id: Date.now() + Math.random(), memberId: p.id, text: `-${p.ctr}`, left: 15 + Math.floor(Math.random() * 55) }));
          if (floats.length) {
            setFloatCounterDmgs(floats);
            setTimeout(() => setFloatCounterDmgs([]), 1400);
          }
          setTimeout(() => { setAnimCounter(false); setAnimScreenShake(false); }, 850);
        }, delay + 1400);
        revealTimersRef.current.push(t1, t2);
        delay += 2700;
      } else {
        delay += 1200;
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

  // 怪物死亡後：等動畫跑完，房主自動確認進入結算
  useEffect(() => {
    if (room?.status !== "pending_confirm" || liveEntry || !isHost) return;
    const t = setTimeout(() => { handleConfirmResult(); }, 3000);
    return () => clearTimeout(t);
  }, [room?.status, liveEntry]); // eslint-disable-line

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
    const score = SCORE_MAP[label] ?? 0;
    sfxTap(); vibrate(8);
    setArrows(prev => [...prev, { score, label }]);
  }
  function removeLastArrow() {
    if (myReady) return;
    setArrows(prev => prev.slice(0, -1));
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
    if (memberList.length < 2) {
      setStartError("組隊打怪至少需要 2 位玩家！");
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
      const myDmg = (room.log || []).reduce((s, entry) => {
        const p = (entry.playerLog || []).find(p => p.id === myId);
        return s + (p?.dmg || 0);
      }, 0);
      // 使用預覽時已 roll 好的值，保持顯示一致
      const reward   = previewReward || {};
      const coins    = reward.coins    ?? rollCoins(room.monster?.tier || "common", room.mode || "student");
      const material = reward.material ?? rollMaterialDrop(room.monster);
      const card     = reward.card     ?? rollCardDrop(room.monster);
      const res = await claimBattleReward(roomId, myId, myChests, room.monster?.id, room.result, myDmg);
      if (!res?.ok) throw new Error(res?.reason || "領取失敗");
      addCoins(myId, coins).catch(() => {});
      if (material) addMaterials(myId, [{ id: material.id }]).catch(() => {});
      if (card)     addMonsterCard(myId, card).catch(() => {});
      if (!dexRecordedRef.current && room.monster?.id) {
        dexRecordedRef.current = true;
        recordBattleDex(myId, room.monster.id, "win", myDmg).catch(() => {});
      }
      setClaimResult({ coins, material, card });
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
    const stats = getArcherStats(profile, [], getMyCardBonus());
    const power = calcArcherPower(stats);
    setDrawnMonsters(drawMatchedMonsters(power));
    setSetupMonster(null);
  }

  const tierInfo = room.monster ? TIER_LABEL[room.monster.tier] : null;
  const famInfo  = room.monster ? FAMILIES[room.monster.family] : null;
  const myStats  = getArcherStats(profile, [], getMyCardBonus());
  const myEquip  = equipSummary(profile);

  // ── 等待/大廳畫面 ──────────────────────────────────────────
  if (room.status === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-black text-lg">⚔️ 組隊打怪</div>
            <button onClick={copyCode} className="text-sm flex items-center gap-1 mt-0.5 active:opacity-70">
              <span className="font-mono tracking-widest text-indigo-300">{room.code}</span>
              <span>{copied ? "✅" : "📋"}</span>
            </button>
          </div>
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
                  </div>
                )}
              </div>
            );
          })}
          {memberList.length < 8 && (
            <div className="text-slate-500 text-xs text-center py-1">等待夥伴加入…</div>
          )}
          {isHost && (
            <div className="flex flex-col gap-1 pt-1">
              <div className="text-[10px] text-slate-500 font-bold">
                🤖 加入AI機器人（{memberList.length}/8）
              </div>
              <div className="flex gap-2">
                {Object.entries(BOT_STATS).map(([diff, s]) => (
                  <button key={diff} onClick={async () => {
                    if (memberList.length >= 8) return;
                    const id = makeBotId();
                    await addBotToPartyRoom(roomId, id, randomBotName(diff), diff, s);
                  }}
                    disabled={memberList.length >= 8}
                    className="flex-1 py-1.5 text-xs font-black rounded-xl bg-slate-600/70 text-slate-200 border border-slate-500/50 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isHost && memberList.some(m => m.isBot) && (
            <button onClick={async () => {
              for (const m of memberList.filter(b => b.isBot)) {
                await removeBotFromPartyRoom(roomId, m.id);
              }
            }}
              className="text-xs text-red-400 text-center py-1 active:opacity-70">
              🗑️ 移除全部機器人
            </button>
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl">{m.icon}</span>
                        <span className="text-white font-bold text-sm leading-tight truncate">{m.name}</span>
                        {setupMonster?.id === m.id && <span className="ml-auto text-indigo-400 shrink-0">✅</span>}
                      </div>
                      <div className="text-xs" style={{ color: tier?.color }}>{tier?.label}</div>
                      <div className="text-xs text-slate-500">{fam?.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
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
            <button onClick={handleStart}
              disabled={!setupMonster || starting || (memberList.length < 2 && !memberList.some(m => m.isBot)) || (partyBattleLeft !== null && partyBattleLeft <= 0)}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-orange-500 text-white font-black text-base rounded-2xl shadow-lg active:scale-95 transition-transform disabled:opacity-50">
              {starting ? "開始中…"
                : memberList.length < 2 && !memberList.some(m => m.isBot) ? `⚔️ 等待更多玩家（${memberList.length}/2）`
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

  // ── 怪物死亡確認畫面（動畫結束後才顯示，3秒後自動結算）────────
  // logInited：確保 F5 後也等初始化完才顯示，防止搶在擊殺動畫前跳出
  const hasUnseenLog = !logInited || (room?.log?.length || 0) > prevLogLenRef.current;
  if (room.status === "pending_confirm" && !liveEntry && !hasUnseenLog) {
    const lastEntry = room.log?.[room.log.length - 1];
    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-950 to-slate-900 flex flex-col items-center justify-center px-4 gap-6">
        <div className="text-7xl animate-bounce">💥</div>
        <div className="text-2xl font-black text-yellow-300 text-center">
          {room.monster?.name} 已倒下！
        </div>
        {lastEntry && (
          <div className="bg-white/10 rounded-2xl px-5 py-3 text-center">
            <div className="text-slate-400 text-xs mb-1">最終回合共造成</div>
            <div className="text-3xl font-black text-rose-400">{lastEntry.totalDmg}</div>
            <div className="text-slate-300 text-xs">點傷害</div>
          </div>
        )}
        <button
          onClick={isHost ? handleConfirmResult : () => setLocalCompleted(true)}
          disabled={isHost && confirming}
          className="w-full max-w-xs py-5 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-black text-xl rounded-2xl shadow-xl active:scale-95 transition-transform disabled:opacity-50 animate-pulse">
          {isHost && confirming ? "確認中…" : "🏆 確認討伐！進入結算"}
        </button>
        {!isHost && (
          <div className="text-slate-400 text-xs text-center">
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
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="text-6xl">{won ? "🏆" : "💀"}</div>
          <div className="text-2xl font-black text-white">{won ? "討伐成功！" : "全滅了…"}</div>
          {room.monster && (
            <div className="text-slate-400 text-sm">
              {room.monster.icon} {room.monster.name} · {room.log?.length || 0} 回合
            </div>
          )}
        </div>

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
                      storeBattleRewards(roomId, memberIds, room.monster).catch(() => {});
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
  const curMiniDmgMap  = liveEntry
    ? Object.fromEntries((curMini?.playerLog || []).map(p => [p.id, p.dmg]))
    : {};
  const curMiniMaxDmg  = liveEntry ? Math.max(...Object.values(curMiniDmgMap), 1) : 0;
  // 自己上一回合的 arrowBreakdown（顯示在送出按鈕上方）
  const myLastPLog = room.log?.length > 0
    ? room.log[room.log.length - 1]?.playerLog?.find(p => p.id === myId)
    : null;
  const myArrowTotal   = arrows.reduce((s, a) => s + a.score, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col max-w-lg mx-auto">
      <style>{`
@keyframes mb-float{0%{transform:translateY(0) scale(1.15);opacity:1}100%{transform:translateY(-60px) scale(0.85);opacity:0}}
@keyframes mb-charge{0%{transform:scale(1) rotate(0deg)}25%{transform:scale(1.35) rotate(-12deg)}60%{transform:scale(1.5) rotate(0deg)}80%{transform:scale(1.35) rotate(10deg)}100%{transform:scale(1) rotate(0deg)}}
@keyframes mb-screen-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-10px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}80%{transform:translateX(-3px)}}
      `}</style>
      {/* 加油通知 */}
      {cheerMsg && (
        <div className="fixed top-14 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
          <div className="bg-indigo-600/90 text-white font-black text-sm px-5 py-2.5 rounded-full shadow-xl animate-bounce">
            {cheerMsg}
          </div>
        </div>
      )}
      {/* 頂部 */}
      <div className="px-4 pt-5 pb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-white font-black">第 {liveEntry ? liveEntry.round : room.round} 回合</span>
            <span className="text-xs text-slate-400 ml-2">
              ⚔️ 每回合結束後怪物反擊
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">{aliveCount}/{memberList.length} 存活</span>
            <button onClick={handleLeave} className="px-2.5 py-1 bg-slate-700 text-slate-400 text-xs rounded-lg">離開</button>
          </div>
        </div>

        {/* 隨機事件彈窗 */}
        {showEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background:"rgba(0,0,0,0.65)", pointerEvents:"none" }}>
            <div className={`rounded-2xl shadow-2xl p-5 text-center max-w-xs w-full border-4 ${
              showEvent.type === "buff"    ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-400"
            : showEvent.type === "debuff" ? "bg-gradient-to-br from-red-50 to-rose-50 border-red-400"
            : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-400"
            }`} style={{ animation:"pop .4s ease" }}>
              <div className="text-5xl mb-2">{showEvent.icon}</div>
              <div className={`font-black text-lg mb-2 ${
                showEvent.type === "buff" ? "text-emerald-700" :
                showEvent.type === "debuff" ? "text-red-700" : "text-blue-700"
              }`}>{showEvent.title}</div>
              <div className="text-gray-600 text-sm leading-relaxed mb-3">{showEvent.desc}</div>
              <div className={`text-xs font-black px-3 py-1 rounded-full inline-block ${
                showEvent.type === "buff" ? "bg-emerald-100 text-emerald-600"
                : showEvent.type === "debuff" ? "bg-red-100 text-red-600"
                : "bg-blue-100 text-blue-600"
              }`}>
                {showEvent.type === "buff" ? "✨ 有利事件" : showEvent.type === "debuff" ? "⚠️ 不利事件" : "ℹ️ 中性事件"}
              </div>
            </div>
          </div>
        )}

        {room.monster && (
          <div className={`rounded-2xl p-3 flex flex-col gap-2 transition-all duration-300 ${
            animHit ? "bg-orange-800/70 scale-[1.01]" : "bg-slate-800"
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl" style={animMonsterCharge ? { animation:"mb-charge .7s ease infinite", display:"inline-block" } : { display:"inline-block" }}>
                {room.monster.icon}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-black text-sm">{room.monster.name}</span>
                  {tierInfo && <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: tierInfo.color, background: tierInfo.bg }}>{tierInfo.label}</span>}
                </div>
                <div className="text-xs text-slate-400">
                  {famInfo?.label} · ⚔️{room.monster.atk} 🛡️{room.monster.def}
                </div>
              </div>
              <div className="text-right text-sm font-black text-white">
                {displayHP} / {room.monsterMaxHP}
              </div>
            </div>
            <HPBar current={displayHP} max={room.monsterMaxHP}
              color={monsterPct > 0.5 ? "#22c55e" : monsterPct > 0.25 ? "#f59e0b" : "#ef4444"} />
          </div>
        )}

        {/* 隊員 HP */}
        <div className="grid grid-cols-2 gap-2" style={animScreenShake ? { animation:"mb-screen-shake .55s ease" } : {}}>
          {memberList.map(m => {
            // 攻擊高亮：動畫期間，有傷害=高亮，傷害最高=金色，否則暗化
            const miniDmg   = curMiniDmgMap[m.id];
            const isAttacking  = liveEntry && m.alive && miniDmg !== undefined && !animCounter;
            const isTopHit     = isAttacking && miniDmg > 0 && miniDmg >= curMiniMaxDmg;
            const isMiss       = isAttacking && miniDmg === 0;
            return (
            <div key={m.id} style={{ position:"relative" }}
              className={`rounded-xl p-2.5 flex flex-col gap-1 transition-all duration-300 ${
                !m.alive        ? "bg-slate-800/40 opacity-50" :
                animCounter     ? "bg-red-900/60 border border-red-500/50" :
                isTopHit        ? "bg-yellow-900/50 border border-yellow-400/70 scale-[1.02]" :
                isAttacking && !isMiss ? "bg-indigo-900/40 border border-indigo-400/50" :
                isMiss          ? "bg-slate-800/40 opacity-60" :
                m.id === myId   ? "bg-indigo-900/40 border border-indigo-500/50"
                                : "bg-slate-700/40"
              }`}>
              {floatCounterDmgs.filter(f => f.memberId === m.id).map(f => (
                <span key={f.id} style={{
                  position:"absolute", left:`${f.left}%`, top:"0px", zIndex:10,
                  animation:"mb-float 1.3s ease-out forwards",
                  fontWeight:900, fontSize:"1.1rem",
                  color:"#f43f5e", textShadow:"0 2px 8px rgba(0,0,0,0.9)",
                  whiteSpace:"nowrap", pointerEvents:"none",
                }}>
                  {f.text}💢
                </span>
              ))}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold truncate ${m.id === myId ? "text-indigo-300" : "text-white"}`}>
                  {m.alive ? "" : "💀"}{m.name}
                </span>
                <span className="text-xs text-slate-400 ml-1 shrink-0">{m.hp}/{m.maxHP}</span>
              </div>
              <HPBar current={m.hp} max={m.maxHP} color={m.id === myId ? "#818cf8" : "#64748b"} />
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-slate-500">⚔️{m.atk} 🛡️{m.def}</span>
                {m.alive && (
                  <span className="text-[10px] text-slate-500">
                    {liveEntry ? "⚙️ 結算中" : m.ready ? (m.skipped ? "⏭️ 跳過" : "✅ 送出") : m.arrows?.length > 0 ? `🏹 ${m.arrows.length}支` : "等待…"}
                  </span>
                )}
              </div>
              {/* 即時箭分揭曉：動畫期間顯示在卡片內 */}
              {liveEntry && curMini && (() => {
                const pLog = (curMini.playerLog || []).find(p => p.id === m.id);
                const a = pLog?.arrowBreakdown?.[0];
                if (!pLog) return null;
                return (
                  <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold mt-0.5 leading-snug ${
                    !a || a.dmg === 0 ? "bg-slate-700/50 text-slate-500" :
                    a.isCrit ? "bg-yellow-900/50 text-yellow-200" : "bg-slate-700/40 text-slate-300"
                  }`}>
                    {liveMiniRoundIdx + 1}箭 {a ? `${a.label} ${a.partIcon}${a.partName}` : "脫靶"}
                    {a?.dmg > 0 && <span className="text-rose-400 font-black ml-1">+{a.dmg}</span>}
                    {a?.isCrit && " 💥"}
                    {curMini.isCounter && pLog.ctr > 0 && <span className="text-orange-300 ml-1">受-{pLog.ctr}</span>}
                  </div>
                );
              })()}
              {isHost && m.alive && !m.ready && m.id !== myId && !room.processing && (
                <button onClick={() => handleForceSkip(m.id)} disabled={skipping === m.id}
                  className="text-[9px] px-1.5 py-0.5 bg-slate-600 text-slate-300 rounded font-bold self-end active:scale-95 disabled:opacity-40">
                  {skipping === m.id ? "…" : "跳過"}
                </button>
              )}
            </div>
          );})}
        </div>
      </div>

      {/* 箭分輸入（自己存活且未 ready，且動畫未播放中）*/}
      {me.alive && !myReady && !liveEntry && (
        <div className="px-4 flex flex-col gap-3 pb-4">
          <div className="flex gap-1.5 items-center">
            <div className="text-xs text-slate-400 w-8 shrink-0">{arrows.length}/{ARROWS_PER_ROUND}</div>
            <div className="flex gap-1 flex-1 flex-wrap">
              {arrows.map((a, i) => (
                <span key={i} className={`text-xs font-black px-2 py-0.5 rounded-full ${SCORE_COLORS[a.label] || "bg-slate-600 text-white"}`}>
                  {a.label}
                </span>
              ))}
              {Array.from({ length: ARROWS_PER_ROUND - arrows.length }).map((_, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-500">○</span>
              ))}
            </div>
            <div className="text-xs font-black text-white shrink-0">{myArrowTotal}分</div>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {SCORE_LABELS.map(label => (
              <button key={label} onClick={() => addArrow(label)}
                disabled={arrows.length >= ARROWS_PER_ROUND}
                className={`py-3 rounded-xl font-black text-sm ${SCORE_COLORS[label] || "bg-slate-600 text-white"} disabled:opacity-40 active:scale-90 transition-transform`}>
                {label}
              </button>
            ))}
          </div>

          {/* 自己數值 + 上回合逐箭明細 */}
          <div className="bg-slate-800/60 rounded-xl px-3 py-2 flex flex-col gap-1">
            <div className="text-[10px] text-slate-500">
              ⚔️{myStats.atk} 🛡️{myStats.def}
              {myLastPLog?.ctr > 0 && <span className="ml-2 text-orange-400">受擊 -{myLastPLog.ctr}</span>}
            </div>
            {(myLastPLog?.arrowBreakdown || []).map((a, ai) => (
              <span key={ai} className={`text-[10px] font-bold ${
                a.dmg === 0 ? "text-slate-600" : a.isCrit ? "text-yellow-400" : "text-slate-400"
              }`}>
                {ai + 1}箭 {a.label}分　{a.partIcon} {a.partName}
                {a.dmg > 0 && <span className="text-rose-400 ml-1">+{a.dmg}</span>}
                {a.isCrit && <span className="text-yellow-300 ml-0.5">💥</span>}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={removeLastArrow} disabled={arrows.length === 0}
              className="flex-1 py-2.5 bg-slate-700 text-slate-300 font-bold rounded-xl text-sm disabled:opacity-30 active:scale-95">
              ← 撤銷
            </button>
            <button onClick={handleSubmit} disabled={arrows.length < ARROWS_PER_ROUND || submitting}
              className="flex-1 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-sm disabled:opacity-40 active:scale-95 transition-transform">
              {submitting ? "送出中…" : `✅ 送出 (${myArrowTotal}分)`}
            </button>
          </div>
        </div>
      )}

      {me.alive && myReady && (
        <div className="px-4 py-3 flex flex-col items-center gap-2">
          <div className="text-emerald-400 font-black text-sm">
            ✅ 已送出，等待其他隊員…
            {room.processing && <span className="ml-2 text-yellow-400 animate-pulse">⚙️ 計算中…</span>}
          </div>
          <button
            onClick={() => sendPartyCheer(roomId, me.name)}
            className="px-5 py-2 bg-indigo-900/40 border border-indigo-500/50 text-indigo-300 text-sm font-black rounded-xl active:scale-95 transition-transform">
            💪 為隊友加油！
          </button>
        </div>
      )}
      {!me.alive && room.status === "active" && (
        <div className="px-4 py-6 text-center text-slate-500 font-black text-sm">
          💀 你已陣亡，觀戰中…
        </div>
      )}

      {/* 即時進度條（箭分已整合進玩家卡片） */}
      {liveEntry && (
        <div className="px-4 pb-1 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>第 {liveEntry.round} 回合 · 第 {liveMiniRoundIdx + 1}/{liveEntry.miniRounds?.length || 6} 箭</span>
            <span>怪物剩 <span className="text-yellow-300 font-black">{curMini?.monsterHPAfter ?? liveEntry.monsterHPAfter}</span></span>
          </div>
          <div className="flex justify-center gap-1.5">
            {(liveEntry.miniRounds || []).map((mini, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === liveMiniRoundIdx ? "bg-yellow-400 scale-125" :
                i < liveMiniRoundIdx  ? (mini.isCounter ? "bg-orange-500" : "bg-indigo-500") :
                "bg-slate-700"
              }`} />
            ))}
          </div>
          {curMini?.isCounter && (
            <div className="text-orange-300 font-bold text-[10px] text-center animate-pulse">💥 怪物反擊！</div>
          )}
        </div>
      )}

      {/* 戰鬥 Log（含每人明細）*/}
      {(room.log || []).length > 0 && (
        <div className="px-4 pb-6 flex flex-col gap-2 mt-2">
          <div className="text-xs font-black text-slate-500 uppercase tracking-widest">戰鬥記錄</div>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
            {[...room.log].reverse().map((entry, i) => {
              if (i === 0 && liveEntry) return null; // 揭曉中跳過，避免重複
              return (
              <div key={i} className="bg-slate-800/70 rounded-xl p-3 text-xs text-slate-300 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-slate-400 font-black">
                  <span>第 {entry.round} 回合</span>
                  <span>怪物剩 <span className="text-yellow-300">{entry.monsterHPAfter}</span></span>
                </div>
                {/* 事件 */}
                {entry.event && (
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg ${
                    entry.event.type === "buff"    ? "bg-emerald-900/40 text-emerald-300" :
                    entry.event.type === "debuff"  ? "bg-red-900/40 text-red-300"
                                                   : "bg-yellow-900/40 text-yellow-300"
                  }`}>
                    <span>{entry.event.icon}</span>
                    <span>{entry.event.title}</span>
                  </div>
                )}
                {(entry.playerLog || []).map((p, j) => (
                  <div key={j} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-300">🏹 {p.name}</span>
                      <span>造成 <span className="text-rose-400 font-black">{p.dmg}</span> 傷</span>
                      {p.crits > 0 && <span className="text-yellow-300 text-[10px]">💥×{p.crits}</span>}
                      {entry.counterRound && p.ctr > 0 && (
                        <span className="text-orange-400 ml-auto">受到 -{p.ctr}</span>
                      )}
                    </div>
                    {p.arrowBreakdown && p.arrowBreakdown.length > 0 && (
                      <div className="flex flex-col gap-0.5 ml-3 mt-0.5">
                        {p.arrowBreakdown.map((a, ai) => (
                          <span key={ai} className={`text-[10px] font-bold ${
                            a.dmg === 0 ? "text-slate-600" :
                            a.isCrit    ? "text-yellow-400" : "text-slate-400"
                          }`}>
                            {ai + 1}箭 {a.label}分　{a.partIcon} {a.partName}
                            {a.dmg > 0 && <span className="text-rose-400 ml-1">+{a.dmg}</span>}
                            {a.isCrit && <span className="text-yellow-300 ml-0.5">💥</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {entry.counterRound && (
                  <div className="text-orange-300 font-bold border-t border-white/10 pt-1 mt-0.5">
                    💥 怪物反擊！
                  </div>
                )}
              </div>
            ); })}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
