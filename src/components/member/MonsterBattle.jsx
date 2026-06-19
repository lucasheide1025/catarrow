// src/components/member/MonsterBattle.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import CatMsg from "../cat/CatMsg";
import {
  getCertRecords, getCertification, subscribeDexGrants, getDexConfig,
  createNotification, saveMonsterLog, getMonsterLogs, subscribeMonsterLogs,
  getMonsterDailyConfig, subscribeMonsterEventConfig, checkMonsterDailyLimit, recordMonsterSession,
  addChests, subscribePotions, usePotions, addFragments, addPracticeLog, addMaterials,
  addCoins, addMonsterCard, recordPotionUsed, addAdventurerXP,
} from "../../lib/db";

const ADVENTURER_XP_PER_TIER = { common:15, rare:30, elite:50, fierce:75, boss:100, mythic:150 };
import BattleRecords from "./BattleRecords";
import { makeChests, openChestContents, CHEST_TYPES, getPotion, calcPotionBuffs, MAX_POTIONS_PER_BATTLE } from "../../lib/itemData";
import { computeDexStats } from "../../lib/achievementDex";
import {
  MONSTERS, FAMILIES, TIER_LABEL,
  calcArcherStats, calcArcherPower, drawMatchedMonsters,
  calcDamage, calcCounterDamage, resolveHitPart,
} from "../../lib/monsterData";
import { LOOT_TABLE_GUEST, drawLoot, isRareLoot, rollCoins, rollMaterialDrop, rollCardDrop, makeCoinChest } from "../../lib/lootTable";
import LootBox from "./LootBox";
import { drawRandomEvent, shouldTriggerEvent } from "../../lib/randomEvents";
import { sfxEpic, sfxSuccess, sfxTap, sfxSoftFail, sfxCast, sfxBuff, sfxDebuff, sfxArrowHit, sfxCritBoom, sfxOrganHit, sfxCounter, sfxCounterCrit, sfxMonsterDead, sfxRevive, sfxRoundEnd, sfxPotionDrink, vibrate } from "../../lib/sound";
import BattleCard from "./BattleCard";
import MonsterSVG, { MonsterBattleImg } from "../MonsterSVG";
import { CAT_IDS, CATS } from "../../lib/catData";

const ARROWS_PER_ROUND   = 6;
const ARROWS_PER_COUNTER = 2;
const DISTANCE_START = 15;
const VETERAN_MULT = { hp:1.5, atk:1.5, def:1.3 };
const PRESET_DISTANCES_NOVICE = [5, 7, 10];
const PRESET_DISTANCES = [5, 7, 10, 13.5, 15, 18];  // 學生 + 老手

const HALF_SCORES = [
  { label:"X",  val:10, color:"#fbbf24", cls:"bg-yellow-400 text-yellow-900" },
  { label:"10", val:10, color:"#fbbf24", cls:"bg-yellow-300 text-yellow-900" },
  { label:"9",  val:9,  color:"#ef4444", cls:"bg-red-400 text-white" },
  { label:"8",  val:8,  color:"#ef4444", cls:"bg-red-300 text-white" },
  { label:"7",  val:7,  color:"#3b82f6", cls:"bg-blue-400 text-white" },
  { label:"6",  val:6,  color:"#3b82f6", cls:"bg-blue-300 text-white" },
  { label:"5",  val:5,  color:"#6b7280", cls:"bg-gray-500 text-white" },
  { label:"4",  val:4,  color:"#9ca3af", cls:"bg-gray-400 text-white" },
  { label:"3",  val:3,  color:"#d1d5db", cls:"bg-gray-300 text-gray-800" },
  { label:"2",  val:2,  color:"#e5e7eb", cls:"bg-gray-200 text-gray-700" },
  { label:"1",  val:1,  color:"#f3f4f6", cls:"bg-gray-100 text-gray-600" },
  { label:"M",  val:0,  color:"#64748b", cls:"bg-slate-600 text-gray-200" },
];

const BATTLE_CSS = `
@keyframes mb-pop         { 0%{transform:scale(.7);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
@keyframes mb-shake       { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-9px)} 50%{transform:translateX(9px)} 80%{transform:translateX(-5px)} }
@keyframes mb-shake-heavy { 0%,100%{transform:translateX(0) scale(1)} 15%{transform:translateX(-15px) scale(1.05)} 35%{transform:translateX(13px) scale(1.03)} 55%{transform:translateX(-10px) scale(1.02)} 75%{transform:translateX(7px)} 90%{transform:translateX(-4px)} }
@keyframes mb-bounce      { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-14px)} 70%{transform:translateY(-6px)} }
@keyframes mb-glow        { 0%,100%{box-shadow:0 0 10px #fbbf2488} 50%{box-shadow:0 0 32px #fbbf24cc,0 0 60px #fbbf2455} }
@keyframes mb-chest       { 0%,100%{transform:translateY(0) scale(1)} 30%{transform:translateY(-16px) scale(1.14)} 60%{transform:translateY(-4px) scale(1.06)} }
@keyframes mb-tier        { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
@keyframes mb-drop        { 0%{transform:translateY(-30px) scale(.5);opacity:0} 60%{transform:translateY(6px) scale(1.08);opacity:1} 100%{transform:translateY(0) scale(1);opacity:1} }
@keyframes mb-coin        { 0%{transform:translateY(-20px) scale(.6) rotate(-15deg);opacity:0} 70%{transform:translateY(4px) scale(1.1) rotate(5deg);opacity:1} 100%{transform:translateY(0) scale(1) rotate(0);opacity:1} }
@keyframes mb-float       { 0%{transform:translateY(0) scale(1.2);opacity:1} 100%{transform:translateY(-70px) scale(0.8);opacity:0} }
@keyframes mb-crit-flash  { 0%{opacity:0} 20%{opacity:0.55} 60%{opacity:0.3} 100%{opacity:0} }
@keyframes mb-monster-die { 0%{transform:scale(1) rotate(0deg);opacity:1} 40%{transform:scale(1.2) rotate(-8deg);opacity:0.8} 100%{transform:scale(0) rotate(15deg);opacity:0} }
@keyframes mb-revive-glow { 0%{box-shadow:none;background:rgba(255,255,255,0)} 30%{box-shadow:0 0 30px #22c55e,0 0 60px #86efac;background:rgba(34,197,94,0.15)} 70%{box-shadow:0 0 20px #22c55e;background:rgba(34,197,94,0.08)} 100%{box-shadow:none;background:rgba(255,255,255,0)} }
@keyframes mb-hp-danger   { 0%,100%{background:rgba(239,68,68,0.12)} 50%{background:rgba(239,68,68,0.35)} }
@keyframes mb-event-buff  { 0%{transform:scale(.8) translateY(12px);opacity:0} 60%{transform:scale(1.04) translateY(-3px);opacity:1} 100%{transform:scale(1) translateY(0);opacity:1} }
@keyframes mb-event-debuff{ 0%{transform:scale(.8) translateY(-12px);opacity:0} 60%{transform:scale(1.04);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes mb-counter-warn{ 0%{transform:scale(1);opacity:1} 40%{transform:scale(1.06);opacity:0.9} 100%{transform:scale(1);opacity:1} }
@keyframes mb-archer-shoot { 0%{transform:translateY(0)} 30%{transform:translateY(-14px)} 65%{transform:translateY(-5px)} 100%{transform:translateY(0)} }
@keyframes mb-archer-miss  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 50%{transform:translateX(7px)} 75%{transform:translateX(-4px)} }
@keyframes mb-archer-crit  { 0%,100%{opacity:0} 15%{opacity:1} 60%{opacity:0.75} }
@keyframes mb-archer-hurt  { 0%,100%{transform:translateX(0) rotate(0)} 20%{transform:translateX(-13px) rotate(-4deg)} 45%{transform:translateX(10px) rotate(3deg)} 70%{transform:translateX(-7px) rotate(-1deg)} 88%{transform:translateX(4px)} }
@keyframes mb-monster-attack { 0%{transform:translateY(0) scale(1)} 35%{transform:translateY(50px) scale(1.12)} 68%{transform:translateY(22px) scale(1.04)} 100%{transform:translateY(0) scale(1)} }
@keyframes mb-monster-attack-crit { 0%{transform:translateY(0) scale(1);filter:brightness(1)} 35%{transform:translateY(50px) scale(1.15);filter:brightness(1.8) drop-shadow(0 0 18px #ef4444) drop-shadow(0 0 36px #dc262688)} 68%{transform:translateY(22px) scale(1.05);filter:brightness(1.2)} 100%{transform:translateY(0) scale(1);filter:brightness(1)} }
@keyframes mb-cat-glow-purple { 0%,100%{filter:drop-shadow(0 0 4px #a78bfa)} 50%{filter:drop-shadow(0 0 14px #a78bfa) brightness(1.35)} }
@keyframes mb-cat-glow-green  { 0%,100%{filter:drop-shadow(0 0 4px #10b981)} 50%{filter:drop-shadow(0 0 14px #10b981) brightness(1.35)} }
@keyframes mb-cat-glow-red    { 0%,100%{filter:drop-shadow(0 0 4px #ef4444)} 50%{filter:drop-shadow(0 0 14px #ef4444) brightness(1.35)} }
`;

const HIT_TEXTS = {
  head:   ["爆頭！腦殼震裂💥","正中眉心，眼冒金星💀","頭骨共鳴！整個人在轉😵‍💫","顱骨命中！擊昏！💥"],
  neck:   ["頸動脈命中！鮮血噴湧🩸","咽喉要害！⚡","頸部重擊，呼吸困難！🎯","致命頸擊！🗡️"],
  chest:  ["胸腔震盪！肋骨嘎嘎響💢","正中胸口，心跳亂跳！🫀","胸部命中，前後貫穿！❤️‍🔥","肋骨碎裂！"],
  belly:  ["腹部重擊！腸子在移位😱","肚子痛到無法動彈！🤢","腹腔命中，悶哼一聲…","內臟震動！"],
  arm:    ["手臂被射穿！武器脫手💨","側翼命中，影響平衡！","肩膀中箭，行動受阻！💪","手臂貫穿！"],
  groin:  ["正中要害！天下第一痛😭","下三路！整個人跪下了⚡","要命一擊！後代存亡危機💥","GG了！🦵"],
  heart:  ["心臟穿透！生命流逝中…❤️‍🔥","致命一擊！心跳停止！☠️","心室命中，鮮血瀑布！💔","心跳…停了…"],
  kidney: ["腎臟破碎！劇烈疼痛🫘","腰部命中，內臟劇痛！😭","腎臟穿透，昏倒邊緣！","致命內傷！生命流逝…"],
  lung:   ["肺葉穿透，血沫四濺！🫁","氣胸！空氣洩漏中…😤","呼吸困難，溺水一樣的感覺！🫧","雙肺血染！"],
  balls:  ["GG了！💥 後代斷絕！","天下第一痛——不可言說！😭","要害！對方蹲下來了…","某處…某個珍貴的地方…碎了。"],
  miss:   ["嗖～沒中！","靶紙在哪裡？😅","差一點點！","風的問題，不是我的問題"],
};

function getHitText(partId) {
  const pool = HIT_TEXTS[partId] || HIT_TEXTS.chest;
  return pool[Math.floor(Math.random() * pool.length)];
}
function randDistStep() { return Math.floor(Math.random() * 5) + 1; }

function arrowLabelToVal(label) {
  if (label === "M") return 0;
  return parseInt(label) || 10; // "X" → 10
}

function calcStats(allArrows) {
  if (!allArrows?.length) return null;
  const total  = allArrows.reduce((s,v)=>s+v,0);
  const count  = allArrows.length;
  const avg    = (total/count).toFixed(1);
  const tens   = allArrows.filter(v=>v===10).length;
  const misses = allArrows.filter(v=>v===0).length;
  const dist   = {};
  allArrows.forEach(v=>{ dist[v]=(dist[v]||0)+1; });
  return { total, count, avg, tens, misses, dist };
}

export default function MonsterBattle({ onBack, isGuest = false, questContext = null, onKillForQuest = null }) {
  const { profile } = useAuth();
  const { hasCat, catName, catMsg, clearCatMsg, triggerCatAction, saveBond } = useCatCompanion();
  const [phase, setPhase]           = useState(() => localStorage.getItem("mb_archer_style") ? "select" : "archer_select");
  const [archerStyle, setArcherStyle]               = useState(() => localStorage.getItem("mb_archer_style") || "");
  const [archerSelectReturn, setArcherSelectReturn] = useState("select");
  const [battleMode, setBattleMode] = useState("score");
  const [mode, setMode]             = useState("novice");
  const [monster, setMonster]       = useState(null);
  const [archerStats, setArcherStats] = useState(null);
  const [certRecords, setCertRecords] = useState([]);
  const [certification, setCertification] = useState(null);
  const [dexGrants, setDexGrants]   = useState([]);
  const [dexConfig, setDexConfig]   = useState({ physicalMax:20, pointMax:20 });
  const [history, setHistory]       = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyCard, setHistoryCard] = useState(null); // 從歷史開小卡用
  const [dailyLeft, setDailyLeft]   = useState(null);
  const [dailyMax, setDailyMax]     = useState(5);

  // 匹配怪物（6族各1隻）
  const [matchedMonsters, setMatchedMonsters] = useState([]);
  const [pickedMonster, setPickedMonster]     = useState(null);

  const [archerHP, setArcherHP]         = useState(100);
  const [monsterHP, setMonsterHP]       = useState(0);
  const [archerATKMod, setArcherATKMod] = useState(0);
  const [distance, setDistance]         = useState(DISTANCE_START);
  const [round, setRound]               = useState(1);
  const [log, setLog]                   = useState([]);
  const [battlePhase, setBattlePhase]   = useState("input");
  const [arrows, setArrows]             = useState([]);
  const [allArrows, setAllArrows]       = useState([]);
  const [roundScores, setRoundScores]   = useState([]);
  const [unlockedParts, setUnlockedParts] = useState(new Set());
  const [revived, setRevived]           = useState(false);
  const [loot, setLoot]                 = useState(null);
  const [lootRevealed, setLootRevealed] = useState(false);
  const [showLootBox, setShowLootBox]   = useState(false);
  const [showBattleCard, setShowBattleCard] = useState(false);
  const [droppedMaterials, setDroppedMaterials] = useState([]);
  const [droppedCoins,    setDroppedCoins]     = useState(0);
  const [droppedCard,     setDroppedCard]      = useState(null);
  const [droppedCoinChest, setDroppedCoinChest] = useState(null);
  const [gainedXP,        setGainedXP]        = useState(0);
  const [guestWonBefore,  setGuestWonBefore]   = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [skipCounter, setSkipCounter]   = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [totalDmgDealt, setTotalDmgDealt] = useState(0);
  const [totalDmgRecvd, setTotalDmgRecvd] = useState(0);
  const [critCount, setCritCount]       = useState(0);
  const [animHit, setAnimHit]           = useState(false);
  const [animHitCrit, setAnimHitCrit]   = useState(false);
  const [animCounter, setAnimCounter]       = useState(false);
  const [animCounterCrit, setAnimCounterCrit] = useState(false);
  const [floatCounterDmgs, setFloatCounterDmgs] = useState([]);
  const [floatDmgs, setFloatDmgs]       = useState([]);
  const [animArcherShoot,    setAnimArcherShoot]    = useState(false);
  const [animArcherCrit,     setAnimArcherCrit]     = useState(false);
  const [animArcherMiss,     setAnimArcherMiss]     = useState(false);
  const [animArcherHit,      setAnimArcherHit]      = useState(false);
  const [animMonsterAttack,  setAnimMonsterAttack]  = useState(false);
  const [animMonsterCritAtk, setAnimMonsterCritAtk] = useState(false);
  const [floatArcherEffects, setFloatArcherEffects] = useState([]);
  const [logOpen, setLogOpen] = useState(true);
  const [savedBattle] = useState(() => {
    try {
      const v = sessionStorage.getItem("mb_battle_save");
      if (!v) return null;
      const s = JSON.parse(v);
      if (Date.now() - s.ts > 30 * 60 * 1000) { sessionStorage.removeItem("mb_battle_save"); return null; }
      return s;
    } catch { return null; }
  });
  const [showRestorePrompt, setShowRestorePrompt] = useState(() => !!savedBattle);
  // ⚗️ 藥劑與 📦 寶箱
  const [potionInv, setPotionInv]             = useState({});
  const [selectedPotions, setSelectedPotions] = useState([]);
  const [battleStats, setBattleStats]         = useState(null); // 本場有效數值（含藥劑加成）
  const [wonChests, setWonChests]             = useState([]); // 本場掉落的寶箱陣列（含貓貓箱）
  const [skipBigRound, setSkipBigRound]       = useState(false); // 麻痺毒素：跳過整個大回合反擊
  const [distanceMode, setDistanceMode]       = useState("fixed"); // "fixed"|"random"|"dynamic"
  const [selectedDistance, setSelectedDistance] = useState(15);
  const [eventConfig, setEventConfig]         = useState(null); // 賽事模式設定
  const [eventMode, setEventMode]             = useState(false); // 是否走賽事流程
  const logEndRef = useRef(null);
  const lastPickedRef = useRef(null);
  const phaseRef = useRef("select");
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // 任務模式：進入選怪階段時自動預選指定怪物
  useEffect(() => {
    if (!questContext?.monsterId) return;
    if (phase !== "select" && phase !== "event_select") return;
    const target = MONSTERS.find(m => m.id === questContext.monsterId);
    if (target) setPickedMonster(target);
  }, [questContext, phase]); // eslint-disable-line

  // ✅ 戰鬥進行中自動存檔，防止頁面重載後遺失進度
  useEffect(() => {
    if (isGuest) return;
    if (phase === "loot" || phase === "result" || phase === "select") {
      if (phase === "loot" || phase === "result") sessionStorage.removeItem("mb_battle_save");
      return;
    }
    if (phase !== "battle") return;
    const save = {
      ts: Date.now(),
      monster, mode, battleMode, monsterHP, archerHP,
      round, roundScores, selectedDistance, distanceMode, battleStats,
      log: log.slice(-8),
    };
    try { sessionStorage.setItem("mb_battle_save", JSON.stringify(save)); } catch {}
  }, [phase, monsterHP, archerHP, round]); // eslint-disable-line

  useEffect(() => {
    if (isGuest) { setArcherStats({ hp:100, atk:10, def:10 }); setDailyLeft(null); return; }
    if (!profile?.id) return;

    // ── sessionStorage 快取（同一 session 不重複讀）────────
    function ssGet(k) { try { const v=sessionStorage.getItem(k); return v?JSON.parse(v):null; } catch { return null; } }
    function ssSet(k,v) { try { sessionStorage.setItem(k,JSON.stringify(v)); } catch {} }

    const cached_cr   = ssGet(`mb_cr_${profile.id}`);
    const cached_cert = ssGet(`mb_cert_${profile.id}`);
    const cached_dcfg = ssGet("mb_dexCfg");

    if (cached_cr)   setCertRecords(cached_cr);
    else getCertRecords(profile.id).then(v => { setCertRecords(v); ssSet(`mb_cr_${profile.id}`, v); }).catch(()=>{});

    if (cached_cert) setCertification(cached_cert);
    else getCertification(profile.id).then(v => { setCertification(v); ssSet(`mb_cert_${profile.id}`, v); }).catch(()=>{});

    if (cached_dcfg) setDexConfig(cached_dcfg);
    else getDexConfig().then(v => { setDexConfig(v); ssSet("mb_dexCfg", v); }).catch(()=>{});

    const unsub = subscribeDexGrants(profile.id, setDexGrants);
    const unsubPotions = subscribePotions(profile.id, setPotionInv);

    const cached_dcnt = ssGet("mb_dailyCfg");
    if (cached_dcnt) {
      setDailyMax(cached_dcnt.dailyMax||5);
      checkMonsterDailyLimit(profile.id, cached_dcnt.dailyMax||5).then(left=>setDailyLeft(left));
    } else {
      getMonsterDailyConfig().then(cfg => {
        setDailyMax(cfg.dailyMax||5);
        ssSet("mb_dailyCfg", cfg);
        checkMonsterDailyLimit(profile.id, cfg.dailyMax||5).then(left=>setDailyLeft(left));
      }).catch(()=>setDailyLeft(5));
    }

    const unsubEvent = subscribeMonsterEventConfig(setEventConfig);
    const unsubLogs  = subscribeMonsterLogs(profile.id, v => setHistory(v), 100);
    return () => { unsub && unsub(); unsubPotions && unsubPotions(); unsubEvent && unsubEvent(); unsubLogs(); };
  }, [profile?.id, isGuest]); // eslint-disable-line

  useEffect(() => {
    if (isGuest || !profile || !certRecords) return;
    const ds = computeDexStats({ member:profile, certification, certRecords, checkinCount:profile?.dailyQuestCount||0, granted:dexGrants, physicalMax:dexConfig.physicalMax, pointMax:dexConfig.pointMax });
    const stats = calcArcherStats({ member:profile, certification, certRecords, dexStats:ds });
    setArcherStats(stats);
  }, [profile, certification, certRecords, dexGrants, isGuest]); // eslint-disable-line

  // ✅ 射手數值就緒後，依戰力匹配6隻怪物
  useEffect(() => {
    if (!archerStats) return;
    const power = calcArcherPower(archerStats);
    const matched = drawMatchedMonsters(power);
    setMatchedMonsters(matched);
    // 只在選怪階段才重置選取，避免進入 prebattle/battle 後被清空
    if (phaseRef.current === "select" || phaseRef.current === "event_select") {
      setPickedMonster(null);
    }
  }, [archerStats]);

  // 記住最後選定的怪物（profile 更新時 pickedMonster 可能被清空，用 ref 保存以便再挑戰）
  useEffect(() => { if (pickedMonster) lastPickedRef.current = pickedMonster; }, [pickedMonster]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior:"smooth" });
  }, [log]);

  function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }
  function addLog(entry) {
    setLog(l=>[...l,entry]);
    if (entry.type === "hit" || entry.type === "hit_crit" || entry.type === "hit_organ") triggerCatAction();
  }
  function showFloatDmg(dmg, isCrit, isOrgan) {
    const id   = Date.now() + Math.random();
    const left = 15 + Math.floor(Math.random() * 55);
    const text = dmg > 0 ? `+${dmg}` : "MISS";
    setFloatDmgs(prev => [...prev, { id, text, isCrit, isOrgan, left }]);
    setTimeout(() => setFloatDmgs(prev => prev.filter(f => f.id !== id)), 1300);
  }
  function showFloatCounterDmg(dmg, isCrit) {
    const id   = Date.now() + Math.random();
    const left = 15 + Math.floor(Math.random() * 55);
    setFloatCounterDmgs(prev => [...prev, { id, text: `-${dmg}`, isCrit, left }]);
    setTimeout(() => setFloatCounterDmgs(prev => prev.filter(f => f.id !== id)), 1300);
  }
  function showArcherEffect(text, color="#94a3b8") {
    const id = Date.now() + Math.random();
    setFloatArcherEffects(prev=>[...prev,{id,text,color}]);
    setTimeout(()=>setFloatArcherEffects(prev=>prev.filter(e=>e.id!==id)), 1200);
  }

  function rerollMonsters() {
    if (!archerStats) return;
    const power = calcArcherPower(archerStats);
    const matched = drawMatchedMonsters(power);
    setMatchedMonsters(matched);
    setPickedMonster(null);
  }

  function enterEventMode() {
    if (!eventConfig?.active) return;
    const ec = eventConfig;
    setBattleMode(ec.battleMode || "score");
    setMode(ec.mode || "student");
    const dm = ec.distanceMode || "fixed";
    setDistanceMode(dm);
    const dist = dm === "dynamic" ? (ec.dynamicStart ?? 15) : (ec.fixedDistance ?? 15);
    setSelectedDistance(dist);
    setEventMode(true);
    setPickedMonster(null);
    setPhase("event_select");
  }

  function inputArrow(label) {
    if (arrows.length>=ARROWS_PER_ROUND||processing) return;
    sfxTap();
    setArrows(prev=>[...prev,label]);
  }
  function undoArrow() {
    if (!arrows.length||processing) return;
    setArrows(prev=>prev.slice(0,-1));
  }

  async function submitRound() {
    if (arrows.length<ARROWS_PER_ROUND||processing) return;
    setProcessing(true);
    setBattlePhase("processing");
    try {
    const bSt = battleStats || archerStats; // 本場有效數值（含藥劑加成）

    let curMonHP    = monsterHP;
    let curArchHP   = archerHP;
    let curUnlocked = new Set(unlockedParts);
    let curDist     = distance;
    let headHitCount = 0;
    let skipCtr     = skipCounter;

    addLog({ type:"system", text:`── 第 ${round} 回合，距離 ${distance}米 ──` });
    await delay(400);

    for (let i=0; i<ARROWS_PER_ROUND; i++) {
      // 分數藥水：每箭 +1分，10→X 再+1 = 雙倍爆擊
      const rawLabel = arrows[i];
      const isX = rawLabel === "X";
      const rawScore = arrowLabelToVal(rawLabel);
      let score = rawScore;
      const sp = (battleStats?.scorePlus) || 0;
      let forceCrit = false;
      if (sp > 0) {
        score = Math.min(rawScore + sp, 10);
        if (rawScore >= 10) { score = 10; forceCrit = true; }
      }
      const baseCritMult = (isX || forceCrit) ? 2.0 : 1.0;
      const part = resolveHitPart(score, curUnlocked, isX);
      if (part.id==="chest") curUnlocked=new Set([...curUnlocked,"chest"]);
      if (part.id==="belly") curUnlocked=new Set([...curUnlocked,"belly"]);
      if (part.id==="groin") curUnlocked=new Set([...curUnlocked,"groin"]);
      setUnlockedParts(curUnlocked);

      const effATK = (bSt?.atk||10) + archerATKMod;
      const dmg = calcDamage({ score, archerATK:effATK, monsterDEF:monster.def, partMult:part.mult * baseCritMult });
      if (part.id==="head") headHitCount++;

      const isOrganPart = ["heart","kidney","lung","balls"].includes(part.id);
      const hitText = getHitText(part.id);

      // 弓箭手射箭躍起
      setAnimArcherShoot(true);
      setTimeout(()=>setAnimArcherShoot(false), 500);

      if (part.mult===0) {
        sfxSoftFail();
        showFloatDmg(0, false, false);
        addLog({ type:"miss", text:`${i+1}箭　${hitText}　(${score}分)` });
        setAnimArcherMiss(true);
        showArcherEffect("MISS", "#94a3b8");
        setTimeout(()=>setAnimArcherMiss(false), 600);
      } else if (isOrganPart) {
        sfxOrganHit();
        showFloatDmg(dmg, true, true);
        addLog({ type:"hit_organ", text:`${i+1}箭 ${score}分　${part.icon} ${hitText}　傷害 ${dmg}！` });
        setAnimArcherCrit(true);
        setTimeout(()=>setAnimArcherCrit(false), 700);
      } else if (part.mult>=1.8||score>=10) {
        sfxCritBoom();
        showFloatDmg(dmg, true, false);
        addLog({ type:"hit_crit", text:`${i+1}箭 ${score}分　${part.icon} ${hitText}　傷害 ${dmg}💥` });
        setAnimArcherCrit(true);
        setTimeout(()=>setAnimArcherCrit(false), 700);
      } else if (score>=8) {
        sfxArrowHit();
        showFloatDmg(dmg, false, false);
        addLog({ type:"hit", text:`${i+1}箭 ${score}分　${part.icon} ${hitText}　傷害 ${dmg}` });
      } else {
        sfxTap();
        showFloatDmg(dmg, false, false);
        addLog({ type:"hit", text:`${i+1}箭 ${score}分　${part.icon} ${part.name}　傷害 ${dmg}` });
      }

      const isBigHit = isOrganPart || part.mult >= 1.8 || score >= 10;
      curMonHP = Math.max(0, curMonHP-dmg);
      setMonsterHP(curMonHP);
      setAnimHit(true);
      if (isBigHit) { setAnimHitCrit(true); setTimeout(()=>setAnimHitCrit(false), 700); }
      setTimeout(()=>setAnimHit(false), 600);
      if (dmg>0) setTotalDmgDealt(v=>v+dmg);
      if (score>=10) setCritCount(v=>v+1);
      await delay(1500);

      if (curMonHP<=0) {
        const roundArr=arrows.map(arrowLabelToVal);
        setAllArrows(prev=>[...prev,...roundArr]);
        setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundArr.reduce((s,v)=>s+v,0)}]);
        await endBattle("win",curArchHP,curMonHP);
        setProcessing(false); return;
      }

      if ((i+1)%ARROWS_PER_COUNTER===0) {
        if (shouldTriggerEvent()) {
          const ev=drawRandomEvent();
          setCurrentEvent(ev); setBattlePhase("event");
          addLog({ type:ev.type==="buff"?"event_good":"event_bad", text:`✨【${ev.title}】${ev.desc}` });
          // 音效依事件類型分流（buff/debuff 不同）
          if (ev.type==="buff") sfxBuff(); else if (ev.type==="debuff") sfxDebuff(); else sfxCast();
          const ef=ev.effect||{};
          if (ef.healArcher)  curArchHP=Math.min(bSt?.hp||100,curArchHP+ef.healArcher);
          if (ef.archerHP)    curArchHP=Math.max(0,curArchHP+ef.archerHP);
          if (ef.archerATK)   setArcherATKMod(m=>m+ef.archerATK);
          if (ef.extraDmg)    curMonHP=Math.max(0,curMonHP-ef.extraDmg);  // 修：補上缺失的 extraDmg 處理
          if (ef.monsterHP)   curMonHP=Math.max(0,curMonHP+ef.monsterHP);
          if (ef.skipCounter) skipCtr=true;
          setArcherHP(curArchHP); setMonsterHP(curMonHP);
          await delay(2600);
          setCurrentEvent(null); // 確保事件卡片在繼續戰鬥前清除
          if (curMonHP<=0) {
            const roundArr=arrows.map(arrowLabelToVal);
            setAllArrows(prev=>[...prev,...roundArr]);
            setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundArr.reduce((s,v)=>s+v,0)}]);
            await endBattle("win",curArchHP,curMonHP);
            setProcessing(false); return;
          }
        }

        if (skipBigRound) {
          addLog({ type:"system", text:"🕸️ 麻痺毒素！怪物本回合完全無法反擊！" });
          setSkipBigRound(false);
        } else if (!skipCtr) {
          const critChance=(mode==="veteran")?Math.max(0,(DISTANCE_START-curDist)/DISTANCE_START*0.5):(mode==="student")?Math.max(0,(DISTANCE_START-curDist)/DISTANCE_START*0.3):0;
          const isCrit=Math.random()<critChance;
          const headStunned=headHitCount>0&&battleMode==="zombie";
          const cdmg=calcCounterDamage({ monsterATK:monster.atk, archerDEF:bSt?.def||10, headStunned, isCrit });
          const counterTxt=isCrit
            ? `${monster.icon} 爆擊！${monster.name} 猛烈反擊！受到 ${cdmg} 傷害`
            : headStunned?`${monster.icon} 被打暈，反擊減半，受到 ${cdmg} 傷害`
            : `${monster.icon} ${monster.name} 反擊！受到 ${cdmg} 傷害`;
          // 怪物往下撲擊動畫
          if (isCrit) {
            setAnimMonsterCritAtk(true);
            sfxCounterCrit();
            vibrate([0, 60, 80, 60]);
            setAnimCounterCrit(true);
            setTimeout(() => setAnimCounterCrit(false), 900);
          } else {
            setAnimMonsterAttack(true);
            sfxCounter();
            vibrate([0, 30, 50]);
          }
          await delay(480); // 等怪物俯衝到底
          // 弓箭手受擊抖動
          setAnimArcherHit(true);
          showArcherEffect(isCrit?`💥 -${cdmg}`:`-${cdmg}`, isCrit?"#f43f5e":"#fca5a5");
          addLog({ type:"counter", text:counterTxt });
          curArchHP=Math.max(0,curArchHP-cdmg);
          setArcherHP(curArchHP);
          if (cdmg>0) setTotalDmgRecvd(v=>v+cdmg);
          await delay(700);
          setAnimMonsterAttack(false); setAnimMonsterCritAtk(false); setAnimArcherHit(false);

          if (curArchHP<=0) {
            if (!revived) {
              const reviveHP=Math.ceil((bSt?.hp||100)*0.3);
              setArcherHP(reviveHP); curArchHP=reviveHP; setRevived(true);
              addLog({ type:"revive", text:"💖 教練施展【完全治癒術】！「你不能死在這裡！」恢復 30% HP，最後一條命！" });
              sfxRevive(); await delay(2800);
            } else {
              const roundArr=arrows.map(arrowLabelToVal);
              setAllArrows(prev=>[...prev,...roundArr]);
              setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundArr.reduce((s,v)=>s+v,0)}]);
              await endBattle("lose",curArchHP,curMonHP);
              setProcessing(false); return;
            }
          }
        } else {
          addLog({ type:"system", text:"🛡️ 怪物反擊被阻止！" });
          skipCtr=false;
        }
        setSkipCounter(false); setCurrentEvent(null); headHitCount=0;
        setBattlePhase("processing"); // 反擊/事件結束後恢復 processing，避免卡在 counter 畫面
      }
    }

    if (distanceMode==="dynamic") {
      if (mode==="veteran") {
        const step=randDistStep();
        const newDist=Math.max(1,curDist-step);
        if (newDist!==curDist) { curDist=newDist; setDistance(curDist); addLog({ type:"event_bad", text:`📍 怪物逼近！請往前移動 ${step}米 → 現在距離 ${curDist}米` }); await delay(600); }
        if (battleMode==="zombie"&&headHitCount>0) {
          const pushBack=Math.min(3,headHitCount);
          curDist=Math.min(selectedDistance||DISTANCE_START,curDist+pushBack);
          setDistance(curDist);
          addLog({ type:"event_good", text:`💀 頭部命中！距離延長 ${pushBack}米 → 現在 ${curDist}米` });
          await delay(600);
        }
      } else if (mode==="student") {
        const step=randDistStep();
        const newDist=Math.max(1,curDist-step);
        if (newDist!==curDist) { curDist=newDist; setDistance(curDist); addLog({ type:"event_bad", text:`📍 怪物逼近！請往前 ${step}米 → 現在距離 ${curDist}米` }); await delay(600); }
      }
    }

    const roundTotal=arrows.reduce((s,v)=>s+arrowLabelToVal(v),0);
    const roundArr=arrows.map(arrowLabelToVal);
    setAllArrows(prev=>[...prev,...roundArr]);
    setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundTotal}]);
    sfxRoundEnd();
    const hpPct = Math.round(curMonHP / monster.hp * 100);
    const hpTag = hpPct <= 10 ? "⚠️ 殘血！" : hpPct <= 30 ? "🩸 危險！" : "";
    addLog({ type:"total", text:`回合 ${round} 結算：${roundTotal}分　${monster.icon} ${monster.name} 剩 HP：${curMonHP} ${hpTag}` });
    await delay(1400);
    setArrows([]); setArcherATKMod(0); setRound(r=>r+1); setBattlePhase("input"); setProcessing(false);
    } catch(err) {
      // 回合中途發生錯誤，完整重設回輸入狀態
      setCurrentEvent(null);
      setSkipCounter(false);
      setArcherATKMod(0);
      setBattlePhase("input");
      setProcessing(false);
    }
  }

  function restoreBattle(s) {
    setMonster(s.monster);
    setMode(s.mode || "novice");
    setBattleMode(s.battleMode || "score");
    setMonsterHP(s.monsterHP);
    setArcherHP(s.archerHP);
    setRound(s.round || 1);
    setRoundScores(s.roundScores || []);
    setSelectedDistance(s.selectedDistance || 15);
    setDistanceMode(s.distanceMode || "fixed");
    if (s.battleStats) setBattleStats(s.battleStats);
    setLog(s.log || [{ type:"system", text:"⚔️ 戰鬥已從中斷點恢復！繼續作戰！" }]);
    setArrows([]); setBattlePhase("input"); setProcessing(false);
    setPhase("battle");
    sessionStorage.removeItem("mb_battle_save");
    setShowRestorePrompt(false);
  }

  async function startBattle() {
    if (profile?.id && !questContext) { await recordMonsterSession(profile.id).catch(()=>{}); setDailyLeft(l=>Math.max(0,(l||1)-1)); }

    // ⚗️ 戰前喝藥：消耗藥劑、計算本場加成（只影響當場）
    const buffs = calcPotionBuffs(selectedPotions);
    // 老手模式：解除加成最低限制（敵方可被削弱至 0）
    if (mode==="veteran") {
      buffs.monAtkMult = Math.max(0, buffs.monAtkMult);
      buffs.monDefMult = Math.max(0, buffs.monDefMult);
    }
    if (selectedPotions.length>0 && profile?.id && !isGuest) {
      await usePotions(profile.id, selectedPotions).catch(()=>{});
      await recordPotionUsed(profile.id, selectedPotions).catch(()=>{});
    }
    const baseStats = { ...(archerStats || { hp:200, atk:10, def:10 }) };
    if (mode==="veteran") baseStats.hp = Math.max(600, baseStats.hp);
    const bStats = {
      hp:  Math.round(baseStats.hp  * buffs.hpMult),
      atk: Math.round(baseStats.atk * buffs.atkMult),
      def: baseStats.def,
    };
    setBattleStats(bStats);
    // 投擲型藥劑：立即對怪物扣血＋麻痺效果（開戰前）
    let throwDmgTotal = 0;
    let throwSkip = null;
    buffs.throwEffects.forEach(te => {
      throwDmgTotal += te.dmg || 0;
      if (te.skipRound) throwSkip = te.skipRound;
    });
    if (throwSkip === "big") setSkipBigRound(true);

    // 怪物倍率：新手HP×1.5, 學生HP×2, 老手HP×4+ATK×2+DEF×2
    const modeHPMult  = mode==="novice" ? 1.5 : mode==="student" ? 2.0 : 4.0;
    const modeATKMult = mode==="veteran" ? 2 : 1;
    const modeDEFMult = mode==="veteran" ? 2 : 1;
    const boosted = {
      ...pickedMonster,
      hp:  Math.round(pickedMonster.hp  * modeHPMult),
      atk: Math.round(pickedMonster.atk * modeATKMult),
      def: Math.round(pickedMonster.def * modeDEFMult),
    };
    // 敵方削弱藥劑（在老手增幅之後套用）
    const boostedMonster = {
      ...boosted,
      atk: Math.max(1, Math.round(boosted.atk * buffs.monAtkMult)),
      def: Math.max(0, Math.round(boosted.def * buffs.monDefMult)),
    };
    // 投擲型藥劑直接扣怪物 HP（開戰前）
    const monStartHP = Math.max(1, boostedMonster.hp - throwDmgTotal);
    setMonster(boostedMonster);
    setArcherHP(bStats.hp);
    setMonsterHP(monStartHP);
    const initDist = distanceMode==="dynamic" ? DISTANCE_START : selectedDistance;
    setRound(1); setDistance(initDist);
    setAllArrows([]); setRoundScores([]);
    setLog([
      { type:"system", text:`⚔️ ${boostedMonster.icon} ${boostedMonster.name}【${TIER_LABEL[boostedMonster.tier]?.label}】 出現！做好準備，戰鬥開始！` },
      { type:"system", text:`🎯 ${battleMode==="zombie"?"殭屍靶紙":"分數靶紙"}　${mode==="veteran"?`⚠️ 老手（HP:${boostedMonster.hp} ATK:${boostedMonster.atk} DEF:${boostedMonster.def}）`:mode==="student"?"🎓 學生模式":"🟢 新手模式"}　距離 ${initDist}米` },
      ...buffs.used.map(p=>({ type:"event_good", text:`⚗️ 使用 ${p.icon}「${p.name}」：${p.effectText}！` })),
      ...(throwDmgTotal>0?[{type:"event_bad", text:`💥 投擲命中！怪物直接失去 ${throwDmgTotal} HP！`}]:[]),
      ...(mode==="veteran"&&distanceMode==="dynamic"?[{type:"system",text:"📍 每回合結束後怪物逼近，隨機縮短 1~5 米！"}]:[]),
      ...(mode==="student"&&distanceMode==="dynamic"?[{type:"system",text:"📍 每回合結束怪物逼近，距離縮短 1~5 米！"}]:[]),
    ]);
    if (buffs.used.length>0) sfxBuff();
    setSelectedPotions([]);
    setBattlePhase("input"); setArrows([]); setUnlockedParts(new Set());
    setRevived(false); setLoot(null); setLootRevealed(false); setWonChests([]); setSkipBigRound(false);
    setCurrentEvent(null); setSkipCounter(false); setArcherATKMod(0);
    setDroppedCoins(0); setDroppedCard(null); setGuestWonBefore(false); setDroppedCoinChest(null);
    setPhase("battle"); setTotalDmgDealt(0); setTotalDmgRecvd(0); setCritCount(0); setDroppedMaterials([]);
    sfxTap();
  }

  async function endBattle(result, finalArchHP, finalMonHP) {
    try {
    if (result==="win") {
      sfxMonsterDead();
      setTimeout(() => sfxSuccess(), 600);

      // ── 寶箱（固定必掉）────────────────────────────────
      const { mainChest, catChest, potionChest } = makeChests(monster, mode);
      const chestCfg = CHEST_TYPES[mainChest.type] || CHEST_TYPES.wood;

      if (isGuest || !profile?.id) {
        // 訪客：判斷是否第一次勝利（全域）
        const wonBefore = sessionStorage.getItem("guest_won_once");
        if (!wonBefore) {
          const guestLootItem = drawLoot(LOOT_TABLE_GUEST, monster.id, monster.tier);
          setLoot(guestLootItem);
          sessionStorage.setItem("guest_won_once", "1");
          if (isRareLoot(guestLootItem)) {/* no notification for guests */}
        } else {
          setLoot(null);
          setGuestWonBefore(true);
        }
        setWonChests([]);
        setDroppedMaterials([]);
      } else {
        // 一般射手：先算好所有寶箱，再一次 addChests（避免兩次 getDoc+setDoc 競態）
        const mainChests = [mainChest, catChest, potionChest].filter(Boolean);
        setWonChests(mainChests);

        // 材料掉落（機率）
        const mat = rollMaterialDrop(monster);
        if (mat) {
          setDroppedMaterials([mat]);
          if (mat.id?.startsWith("frag_")) {
            addFragments(profile.id, [{ id: mat.id }]).catch(() => {});
          } else {
            addMaterials(profile.id, [{ id: mat.id }]).catch(() => {});
          }
        } else {
          setDroppedMaterials([]);
        }

        // 金幣（必掉）
        const baseCoins = rollCoins(monster.tier, mode);
        if (isGuest || !profile?.id) {
          const boost   = parseFloat(sessionStorage.getItem("guest_coin_boost") || "5");
          const total   = Math.round(baseCoins * boost);
          sessionStorage.removeItem("guest_coin_boost");
          const prev    = parseInt(sessionStorage.getItem("guest_coins") || "500", 10);
          sessionStorage.setItem("guest_coins", String(prev + total));
          setDroppedCoins(total);
        } else {
          // 金幣寶箱 + 主寶箱合成一次寫入，避免競態覆蓋
          const coinChest = makeCoinChest(monster.tier, "打怪掉落");
          setDroppedCoins(baseCoins);
          setDroppedCoinChest(coinChest);
          addCoins(profile.id, baseCoins).catch(() => {});
          addChests(profile.id, [...mainChests, coinChest]).catch(() => {});
        }

        // 怪物卡片（1%）
        const card = rollCardDrop(monster);
        if (card) {
          setDroppedCard(card);
          addMonsterCard(profile.id, card).catch(() => {});
        }
      }

      // 戰鬥記錄
      if (profile?.id && !isGuest) {
        const equipment  = profile?.equipment || [];
        const bowLabel   = Array.isArray(equipment) && equipment[0]?.label
          ? equipment[0].label : (typeof equipment === "string" ? equipment : "打怪練習");
        const practiceRounds = roundScores.map(rs => rs.scores || []);
        addPracticeLog(profile.id, {
          date: new Date().toISOString().slice(0, 10), source: "monster",
          monsterName: monster.name, mode, battleMode, result,
          equipment: bowLabel, rounds: practiceRounds,
          total: practiceRounds.flat().reduce((s, v) => s + v, 0),
          distance: selectedDistance,
        }, profile.id).catch(() => {});
      }

      addLog({ type:"win",    text:`🏆 擊倒 ${monster.name}！激烈的戰鬥結束——你贏了！` });
      if (!isGuest) {
        addLog({ type:"system", text:`${chestCfg.icon} 獲得「${chestCfg.name}」！已放進背包` });
        if (catChest)   addLog({ type:"event_good", text:`🐱 幸運！額外獲得「貓貓箱」！` });
        if (potionChest) addLog({ type:"event_good", text:`🧪 幸運！額外獲得「藥水箱」！` });
      }

      if (profile?.id) {
        setRoundScores(rs => {
          saveMonsterLog(profile.id, {
            monsterName:monster.name, monsterId:monster.id, result:"win", rounds:round,
            mode, battleMode, chestType:mainChest.type, catChest:!!catChest, roundScores:rs,
            distance: selectedDistance,
          }).catch(() => {});
          return rs;
        });
      }

      if (!isGuest) saveBond("monster");
      // 冒險者 XP（依怪物階級）
      if (!isGuest && profile?.id) {
        const xp = ADVENTURER_XP_PER_TIER[monster.tier] || 15;
        setGainedXP(xp);
        addAdventurerXP(profile.id, xp).catch(() => {});
      }
      // 任務擊殺回報
      if (questContext?.monsterId === monster.id && onKillForQuest) onKillForQuest(monster.id);
      await delay(1000); setPhase("loot");
    } else {
      sfxSoftFail();
      addLog({ type:"lose", text:`💀 不…被 ${monster.name} 擊倒了！世界漸漸變黑…下次一定要贏…！` });
      if (profile?.id) {
        setRoundScores(rs => {
          saveMonsterLog(profile.id, {
            monsterName:monster.name, monsterId:monster.id, result:"lose", rounds:round,
            mode, battleMode, materials:[], roundScores:rs,
            distance: selectedDistance,
          }).catch(() => {});
          return rs;
        });
      }
      await delay(1000); setPhase("result");
    }
    } catch {
      setPhase(result === "win" ? "loot" : "result");
    }
  }

  // ── 畫面 ─────────────────────────────────────────────────

  if (phase==="archer_select") {
    return (
      <div style={{ height:"100dvh", display:"flex", flexDirection:"column", background:"#0f172a", color:"white", fontFamily:"sans-serif" }}>
        <style>{BATTLE_CSS}</style>
        {/* Header */}
        <div style={{ flexShrink:0, padding:"16px 16px 8px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
          {archerStyle && (
            <button onClick={() => setPhase(archerSelectReturn)}
              style={{ background:"none", border:"none", color:"#64748b", fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:8, padding:0 }}>
              ← 返回
            </button>
          )}
          <div style={{ fontWeight:900, fontSize:18, letterSpacing:"0.02em" }}>🐾 選擇出戰外觀</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>
            {archerStyle ? "選好後進入戰場就是這隻的樣子！" : "第一次進入打怪模式，請先選擇你的出戰外觀！"}
          </div>
        </div>

        {/* Cat grid */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 12px 24px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10 }}>
            {CAT_IDS.map(catId => {
              const cat = CATS[catId];
              const isSelected = archerStyle === catId;
              return (
                <button key={catId}
                  onClick={() => {
                    localStorage.setItem("mb_archer_style", catId);
                    setArcherStyle(catId);
                    setPhase(archerSelectReturn);
                  }}
                  style={{
                    background: isSelected ? "rgba(109,40,217,0.35)" : "rgba(255,255,255,0.05)",
                    border: `2px solid ${isSelected ? "#7c3aed" : "rgba(255,255,255,0.1)"}`,
                    borderRadius:12, padding:"10px 6px 8px", cursor:"pointer",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                    position:"relative", transition:"all .15s",
                  }}>
                  {/* Portrait */}
                  <img
                    src={`/cats/portraits/${catId}.webp`}
                    alt={cat?.name}
                    style={{ width:64, height:64, objectFit:"cover", borderRadius:"50%",
                      border: isSelected ? "2px solid #a78bfa" : "2px solid rgba(255,255,255,0.15)" }}
                  />
                  {/* Archer preview */}
                  <img
                    src={`/cats/archers/${catId}.webp`}
                    alt=""
                    style={{ width:42, height:52, objectFit:"contain", objectPosition:"center bottom" }}
                  />
                  <div style={{ fontSize:11, fontWeight:900, color: isSelected ? "#c4b5fd" : "#e2e8f0" }}>
                    {cat?.name}
                  </div>
                  {isSelected && (
                    <div style={{
                      position:"absolute", top:5, right:6,
                      background:"#7c3aed", borderRadius:20, padding:"1px 6px",
                      fontSize:9, fontWeight:900, color:"white"
                    }}>✓ 使用中</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (phase==="select") {
    const power = archerStats ? calcArcherPower(archerStats) : 0;
    const qMon = questContext?.monsterId ? MONSTERS.find(m => m.id === questContext.monsterId) : null;
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <CatMsg msg={catMsg} onDone={clearCatMsg}/>
        {/* 任務模式橫幅 */}
        {questContext && qMon && (
          <div className="rounded-xl px-4 py-2.5 flex items-center gap-3" style={{ background:"linear-gradient(90deg,rgba(124,58,237,0.25),rgba(37,99,235,0.18))", border:"1px solid rgba(124,58,237,0.4)" }}>
            <span className="text-purple-300 text-xs font-black">🎯 任務模式</span>
            <span className="text-white/80 text-xs flex-1">{qMon.icon} {qMon.name} 擊殺 {questContext.killsSoFar}/{questContext.killsNeeded}</span>
            <span className="text-purple-400 text-[10px]">找到牠並戰鬥</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          {onBack && <button onClick={onBack} className="text-slate-400 text-sm">← 返回</button>}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setArcherSelectReturn("select"); setPhase("archer_select"); }}
              className="flex items-center gap-1.5 text-xs text-purple-300 font-bold">
              <img src={`/cats/portraits/${archerStyle || CAT_IDS[0]}.webp`}
                style={{ width:18, height:18, borderRadius:"50%", objectFit:"cover" }} alt="" />
              🎨 外觀
            </button>
            {!isGuest && (
              <button onClick={()=>{ getMonsterLogs(profile.id, 20).then(v => { setHistory(v); setHistoryExpanded(false); }); setPhase("history"); }}
                className="text-xs text-blue-400 font-bold">📊 戰績記錄</button>
            )}
          </div>
        </div>

        {/* 射手戰力卡 */}
        <div className="rounded-2xl p-4 text-white" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs tracking-widest text-purple-200 font-black">⚔️ 打怪模式</div>
            <div className="text-xs text-purple-200">戰力 <span className="font-black text-white text-sm">{power}</span></div>
          </div>
          {archerStats && (
            <div className="flex gap-2 text-xs flex-wrap">
              <span className="bg-white/15 px-2 py-0.5 rounded-full">❤️ {archerStats.hp}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">⚔️ {archerStats.atk}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full">🛡️ {archerStats.def}</span>
              {!isGuest && dailyLeft!==null && (
                <span className={`px-2 py-0.5 rounded-full font-bold ${dailyLeft>0?"bg-emerald-500/80":"bg-red-500/80"} text-white`}>
                  今日剩 {dailyLeft}/{dailyMax} 次
                </span>
              )}
              {isGuest && <span className="bg-amber-500/80 px-2 py-0.5 rounded-full font-bold text-white">⭐ 體驗</span>}
            </div>
          )}
        </div>

        {!isGuest && showRestorePrompt && savedBattle && (
          <div style={{ background:"rgba(251,191,36,0.12)", border:"1px solid #fbbf24aa", borderRadius:12, padding:"12px 16px" }}>
            <div style={{ fontWeight:900, color:"#fbbf24", fontSize:13, marginBottom:4 }}>⚔️ 上次戰鬥被中斷</div>
            <div style={{ color:"#cbd5e1", fontSize:11, marginBottom:10 }}>
              對手：{savedBattle.monster?.name}　第 {savedBattle.round} 回合
              {" • "}怪物 HP {savedBattle.monsterHP}/{savedBattle.monster?.hp}
              {" • "}你的 HP {savedBattle.archerHP}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button
                onClick={() => restoreBattle(savedBattle)}
                disabled={!archerStats}
                style={{ flex:1, padding:"8px 0", borderRadius:10, fontWeight:900, fontSize:13, cursor:"pointer", border:"none",
                  background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12",
                  opacity: archerStats ? 1 : 0.5 }}>
                {archerStats ? "⚔️ 繼續戰鬥！" : "⏳ 載入中…"}
              </button>
              <button
                onClick={() => { sessionStorage.removeItem("mb_battle_save"); setShowRestorePrompt(false); }}
                style={{ flex:1, padding:"8px 0", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer",
                  background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", color:"#94a3b8" }}>
                放棄
              </button>
            </div>
          </div>
        )}

        {!isGuest && !questContext && dailyLeft===0 ? (
          <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">😴</div>
            <div className="font-black text-red-400">今日挑戰次數已用完</div>
            <div className="text-slate-400 text-sm mt-1">明天再來挑戰！</div>
          </div>
        ) : (
          <>

            {/* 六族各1隻，依家族排列 */}
            <div className="flex items-center justify-between mb-1">
              <div className="text-slate-300 text-sm font-black">今日對手（六族匹配）</div>
              <button onClick={rerollMonsters} className="text-xs text-purple-300 font-bold bg-purple-900/30 px-2.5 py-1 rounded-full border border-purple-500/30">
                🎲 重新抽怪
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {matchedMonsters.map(m => {
                const tier   = TIER_LABEL[m.tier] || {};
                const family = FAMILIES[m.family] || {};
                const isPicked = pickedMonster?.id===m.id;
                return (
                  <button key={m.id} onClick={()=>setPickedMonster(m)}
                    className="rounded-2xl p-4 text-left transition-all active:scale-95 relative overflow-hidden"
                    style={{ background:isPicked?"rgba(109,40,217,0.3)":"rgba(255,255,255,0.05)", border:`2px solid ${isPicked?"#7c3aed":"rgba(255,255,255,0.1)"}` }}>
                    {/* 族別標籤 */}
                    <div className="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background:family.color+"33", color:family.color }}>
                      {family.icon} {family.label}
                    </div>
                    <div className="mb-2"><MonsterBattleImg id={m.id} icon={m.icon} size={56}/></div>
                    <div className="font-black text-slate-100 text-sm pr-14">{m.name}</div>
                    <div className="text-xs mt-0.5 font-bold px-1.5 py-0.5 rounded-full inline-block"
                      style={{ background:tier.bg, color:tier.color }}>
                      【{tier.label}】
                    </div>
                    <div className="flex gap-2 mt-1.5 text-xs text-slate-500">
                      <span>❤️{m.hp}</span><span>⚔️{m.atk}</span><span>🛡️{m.def}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {pickedMonster && (
              <button onClick={()=>{ setMonster(pickedMonster); setPhase("mode"); }}
                className="w-full py-4 rounded-2xl font-black text-lg text-white"
                style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)", animation:"mb-glow 2s ease infinite" }}>
                ⚔️ 挑戰 {pickedMonster.name}！
              </button>
            )}

            {/* 近期戰鬥紀錄摘要 */}
            {!isGuest && history.length > 0 && (
              <BattleRecords logs={history.slice(0, 30)} title="📊 近期戰鬥紀錄" maxGroups={6}/>
            )}
          </>
        )}
      </div>
    );
  }

  if (phase==="event_select") {
    const ec = eventConfig || {};
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => { setEventMode(false); setPhase("select"); }} className="text-slate-400 text-sm self-start">← 返回</button>

        <div className="rounded-2xl p-4 text-white" style={{ background:"linear-gradient(135deg,#92400e,#b45309)" }}>
          <div className="text-xs font-black tracking-widest text-amber-200 mb-1">🏆 賽事模式</div>
          <div className="text-white font-black text-lg">{ec.name || "賽事打怪"}</div>
          {ec.desc && <div className="text-amber-100 text-sm mt-1">{ec.desc}</div>}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              {ec.battleMode === "zombie" ? "🧟 殭屍靶" : "🎯 分數靶"}
            </span>
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              {ec.mode === "novice" ? "🟢 新手" : ec.mode === "student" ? "🎓 學生" : "🟠 老手"}
            </span>
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              {ec.distanceMode === "dynamic" ? `🏃 動態 ${ec.dynamicStart ?? 15}m起` : `📍 ${ec.fixedDistance ?? 15}m`}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-slate-300 text-sm font-black">選擇對手（六族匹配）</div>
          <button onClick={rerollMonsters} className="text-xs text-purple-300 font-bold bg-purple-900/30 px-2.5 py-1 rounded-full border border-purple-500/30">
            🎲 重新抽怪
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {matchedMonsters.map(m => {
            const tier   = TIER_LABEL[m.tier] || {};
            const family = FAMILIES[m.family] || {};
            const isPicked = pickedMonster?.id === m.id;
            return (
              <button key={m.id} onClick={() => setPickedMonster(m)}
                className="rounded-2xl p-4 text-left transition-all active:scale-95 relative overflow-hidden"
                style={{ background: isPicked ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", border: `2px solid ${isPicked ? "#f59e0b" : "rgba(255,255,255,0.1)"}` }}>
                <div className="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: family.color+"33", color: family.color }}>
                  {family.icon} {family.label}
                </div>
                <div className="mb-2"><MonsterBattleImg id={m.id} icon={m.icon} size={56}/></div>
                <div className="font-black text-slate-100 text-sm pr-14">{m.name}</div>
                <div className="text-xs mt-0.5 font-bold px-1.5 py-0.5 rounded-full inline-block"
                  style={{ background: tier.bg, color: tier.color }}>
                  【{tier.label}】
                </div>
                <div className="flex gap-2 mt-1.5 text-xs text-slate-500">
                  <span>❤️{m.hp}</span><span>⚔️{m.atk}</span><span>🛡️{m.def}</span>
                </div>
              </button>
            );
          })}
        </div>

        {pickedMonster && (
          <button onClick={() => { setMonster(pickedMonster); setPhase("prebattle"); }}
            className="w-full py-4 rounded-2xl font-black text-lg text-white"
            style={{ background:"linear-gradient(90deg,#f59e0b,#d97706)", animation:"mb-glow 2s ease infinite" }}>
            🏆 挑戰 {pickedMonster.name}！（賽事模式）
          </button>
        )}
      </div>
    );
  }

  if (phase==="mode") {
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <button onClick={()=>setPhase("select")} className="text-slate-400 text-sm self-start">← 返回</button>
        <div className="text-white font-black text-xl text-center">選擇靶紙模式</div>
        <button onClick={()=>{ setBattleMode("score"); setPhase("difficulty"); }}
          className="rounded-2xl p-5 text-left border-2 border-blue-500/40 bg-blue-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🎯 分數靶紙模式</div>
          <div className="font-black text-white mb-1">輸入每箭環數，系統算傷害</div>
          <div className="text-slate-400 text-sm">簡單直接，分數越高傷害越大。</div>
        </button>
        <button onClick={()=>{ setBattleMode("zombie"); setPhase("difficulty"); }}
          className="rounded-2xl p-5 text-left border-2 border-purple-500/40 bg-purple-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🧟 殭屍靶紙模式</div>
          <div className="font-black text-white mb-1">分數決定命中部位，觸發部位加成</div>
          <div className="text-slate-400 text-sm">高分命中頭部/心臟，傷害爆表！解鎖器官部位增加趣味。</div>
        </button>
      </div>
    );
  }

  if (phase==="difficulty") {
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <button onClick={()=>setPhase("mode")} className="text-slate-400 text-sm self-start">← 返回</button>
        <div className="text-white font-black text-xl text-center">選擇難度</div>
        <button onClick={()=>{ setMode("novice"); setDistanceMode("fixed"); setSelectedDistance(5); setPhase("distance"); }}
          className="rounded-2xl p-5 text-left border-2 border-green-500/40 bg-green-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🟢 新手模式</div>
          <div className="font-black text-white mb-1">固定距離 5 / 7 / 10 米，無爆擊</div>
          <div className="text-slate-400 text-sm">怪物 HP×1.5，使用本人射手數值。每2箭怪物反擊一次，傷害穩定。</div>
          <div className="text-green-400 text-xs font-bold mt-2">💰 金幣×1.0 / 材料40% / 卡片1% / 寶箱必掉</div>
        </button>
        <button onClick={()=>{ setMode("student"); setDistanceMode("fixed"); setSelectedDistance(5); setPhase("distance"); }}
          className="rounded-2xl p-5 text-left border-2 border-blue-500/40 bg-blue-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🎓 學生模式</div>
          <div className="font-black text-white mb-1">自選距離，含爆擊（距離越近越高）</div>
          <div className="text-slate-400 text-sm">怪物 HP×2，使用本人射手數值。動態模式每回合距離縮短 1~5 米。</div>
          <div className="text-blue-400 text-xs font-bold mt-2">💰 金幣×1.5 / 材料60% / 卡片1% / 寶箱必掉</div>
        </button>
        <button onClick={()=>{ setMode("veteran"); setDistanceMode("dynamic"); setSelectedDistance(DISTANCE_START); setPhase("distance"); }}
          className="rounded-2xl p-5 text-left border-2 border-orange-500/40 bg-orange-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🟠 老手模式</div>
          <div className="font-black text-white mb-1">怪物大幅增強，射手最低 600 HP，加成無上限</div>
          <div className="text-slate-400 text-sm">怪物 HP×4、ATK×2、DEF×2。固定、隨機、或動態距離（每回合縮短 1~5 米）。</div>
          <div className="text-orange-400 text-xs font-bold mt-2">💰 金幣×2.0 / 材料75% / 卡片1% / 高品質寶箱</div>
        </button>

        {eventConfig?.active && (
          <button onClick={enterEventMode}
            className="rounded-2xl p-5 text-left border-2 border-amber-400 active:scale-95 transition-transform relative overflow-hidden"
            style={{ background:"linear-gradient(135deg,#92400e,#b45309)" }}>
            <div className="absolute -right-3 -bottom-3 text-7xl opacity-15 pointer-events-none">🏆</div>
            <div className="relative">
              <div className="text-xs font-black tracking-widest text-amber-200 mb-0.5">教練設定</div>
              <div className="text-white font-black text-lg mb-1">🏆 {eventConfig.name || "比賽模式"}</div>
              {eventConfig.desc && <div className="text-amber-100 text-sm mb-2">{eventConfig.desc}</div>}
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                  {eventConfig.battleMode === "zombie" ? "🧟 殭屍靶" : "🎯 分數靶"}
                </span>
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                  {eventConfig.mode === "novice" ? "🟢 新手" : eventConfig.mode === "student" ? "🎓 學生" : "🟠 老手"}
                </span>
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                  {eventConfig.distanceMode === "dynamic" ? `🏃 動態 ${eventConfig.dynamicStart ?? 15}m起` : `📍 ${eventConfig.fixedDistance ?? 15}m`}
                </span>
              </div>
            </div>
          </button>
        )}

      </div>
    );
  }

  if (phase==="distance") {
    const isAdvanced = mode !== "novice";
    const btnBase = "flex-1 py-2.5 rounded-xl text-sm font-black border transition-all";
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <button onClick={()=>setPhase("difficulty")} className="text-slate-400 text-sm self-start">← 返回</button>
        <div className="text-white font-black text-xl text-center">選擇距離</div>

        {isAdvanced && (
          <div className="flex gap-2">
            <button onClick={()=>setDistanceMode("fixed")}
              className={`${btnBase} ${distanceMode==="fixed"?"bg-blue-600 text-white border-blue-600":"bg-white/10 text-slate-300 border-white/20"}`}>
              📍 固定幾米
            </button>
            <button onClick={()=>{
              const d=PRESET_DISTANCES[Math.floor(Math.random()*PRESET_DISTANCES.length)];
              setSelectedDistance(d); setDistanceMode("random");
            }}
              className={`${btnBase} ${distanceMode==="random"?"bg-purple-600 text-white border-purple-600":"bg-white/10 text-slate-300 border-white/20"}`}>
              🎲 隨機距離
            </button>
            <button onClick={()=>{ setDistanceMode("dynamic"); setSelectedDistance(DISTANCE_START); }}
              className={`${btnBase} ${distanceMode==="dynamic"?"bg-orange-500 text-white border-orange-500":"bg-white/10 text-slate-300 border-white/20"}`}>
              🏃 動態15m起
            </button>
          </div>
        )}

        {distanceMode!=="dynamic" && (
          <div>
            {distanceMode==="random" ? (
              <div className="text-center">
                <div className="text-5xl font-black text-purple-400 my-4">🎲 {selectedDistance}米</div>
                <button onClick={()=>{
                  const d=PRESET_DISTANCES[Math.floor(Math.random()*PRESET_DISTANCES.length)];
                  setSelectedDistance(d);
                }} className="text-sm text-purple-400 font-bold underline">重新抽取</button>
              </div>
            ) : (
              <div>
                <div className="text-sm text-slate-400 font-bold mb-2">選擇距離</div>
                <div className="flex flex-wrap gap-2">
                  {(mode==="novice" ? PRESET_DISTANCES_NOVICE : PRESET_DISTANCES).map(d=>(
                    <button key={d} onClick={()=>setSelectedDistance(d)}
                      className={`px-4 py-2 rounded-xl font-black text-sm border-2 transition-all ${
                        selectedDistance===d?"bg-blue-600 text-white border-blue-600":"bg-white/10 text-slate-300 border-white/20"
                      }`}>
                      {d}米
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {distanceMode==="dynamic" && (
          <div className={`rounded-2xl p-4 ${mode==="veteran"?"bg-orange-900/20 border-2 border-orange-500/40":"bg-blue-900/20 border-2 border-blue-500/40"}`}>
            <div className={`font-black text-lg mb-1 ${mode==="veteran"?"text-orange-300":"text-blue-300"}`}>
              {mode==="veteran"?"🏹 動態距離（老手）":"🎓 動態距離（學生）"}
            </div>
            <div className="text-sm text-slate-400">
              {mode==="veteran"
                ?"從15米出發，每回合怪物逼近縮短 1~5 米，距離越近爆擊率越高。"
                :"從15米出發，每回合怪物逼近縮短 1~5 米，越來越緊張！"}
            </div>
          </div>
        )}

        <button onClick={()=>setPhase("prebattle")}
          className="w-full py-3 bg-blue-600 text-white font-black rounded-xl text-base active:scale-95 transition-transform">
          確認 → 選擇藥水
        </button>
      </div>
    );
  }

  if (phase==="prebattle") {
    if (!pickedMonster) return null;
    const tier   = TIER_LABEL[pickedMonster.tier] || {};
    const family = FAMILIES[pickedMonster.family] || {};
    const previewHPMult = mode==="novice" ? 1.5 : mode==="student" ? 2.0 : 4.0;
    const previewHP  = Math.round(pickedMonster.hp  * previewHPMult);
    const previewATK = mode==="veteran" ? Math.round(pickedMonster.atk * 2) : pickedMonster.atk;
    const previewDEF = mode==="veteran" ? Math.round(pickedMonster.def * 2) : pickedMonster.def;
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => setPhase(eventMode ? "event_select" : "distance")} className="text-slate-400 text-sm self-start">← 返回</button>
        <div className="rounded-2xl p-6 text-white text-center" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="mb-2 flex justify-center" style={{ animation:"mb-bounce 1.5s ease infinite" }}>
            <MonsterBattleImg id={pickedMonster.id} icon={pickedMonster.icon} size={96}/>
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:family.color+"33", color:"#fff" }}>{family.icon} {family.label}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:tier.color+"44", color:"#fff" }}>【{tier.label}】</span>
          </div>
          <div className="text-2xl font-black mb-1">{pickedMonster.name}</div>
          <div className="text-purple-200 text-sm mb-4">{pickedMonster.desc}</div>
          <div className="flex justify-center gap-3 mb-3">
            {[["HP",previewHP],["ATK",previewATK],["DEF",previewDEF]].map(([k,v])=>(
              <div key={k} className="bg-white/15 rounded-xl px-4 py-2">
                <div className="text-purple-200 text-xs">{k}</div>
                <div className="font-black text-xl">{v}</div>
              </div>
            ))}
          </div>
          {mode==="veteran"&&<div className="bg-orange-500/30 text-orange-200 text-xs font-bold px-3 py-1.5 rounded-full mb-3 inline-block">⚠️ 老手：數值增強，HP基礎 200，加成無上限</div>}
          {mode==="student"&&<div className="bg-blue-500/30 text-blue-100 text-xs font-bold px-3 py-1.5 rounded-full mb-3 inline-block">🎓 學生模式：{distanceMode==="dynamic"?"動態距離從15米起":distanceMode==="random"?`隨機距離 ${selectedDistance}米`:`固定 ${selectedDistance}米`}</div>}
          {mode==="novice"&&<div className="bg-green-500/30 text-green-100 text-xs font-bold px-3 py-1.5 rounded-full mb-3 inline-block">🟢 新手模式：固定 {selectedDistance}米</div>}
          {archerStats&&(
            <div className="bg-white/10 rounded-xl p-3 mb-3">
              <div className="text-purple-200 text-xs mb-2 text-center">你的數值</div>
              <div className="flex justify-around text-sm">
                {[["HP",archerStats.hp],["ATK",archerStats.atk],["DEF",archerStats.def]].map(([k,v])=>(
                  <div key={k} className="text-center"><div className="text-purple-200 text-xs">{k}</div><div className="font-black">{v}</div></div>
                ))}
              </div>
            </div>
          )}
          <div className="text-purple-200 text-xs mb-4">
            {battleMode==="zombie"?"🧟 殭屍靶紙":"🎯 分數靶紙"}　
            {mode==="veteran"?"⚔️ 老手・起始15米":mode==="student"?`🎓 學生・${distanceMode==="dynamic"?"動態15m起":`固定${selectedDistance}米`}`:`🟢 新手・固定${selectedDistance}米`}　每 {ARROWS_PER_COUNTER} 箭反擊
          </div>

          {/* ⚗️ 戰前喝藥（只影響本場） */}
          {!isGuest && Object.values(potionInv).some(v=>v>0) && (
            <div className="bg-white/10 rounded-xl p-3 mb-4 text-left">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-200 text-xs font-black">⚗️ 戰前喝藥（最多 {MAX_POTIONS_PER_BATTLE} 瓶）</span>
                <span className="text-purple-300 text-xs">只影響本場</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(potionInv).filter(([,c])=>c>0).map(([pid,count])=>{
                  const p=getPotion(pid);
                  if (!p) return null;
                  const selected=selectedPotions.includes(pid);
                  return (
                    <button key={pid}
                      onClick={()=>{
                        sfxPotionDrink();
                        setSelectedPotions(prev=>
                          prev.includes(pid)
                            ? prev.filter(x=>x!==pid)
                            : prev.length>=MAX_POTIONS_PER_BATTLE ? prev : [...prev,pid]
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border-2
                        ${selected?"bg-amber-400 text-amber-900 border-amber-300":"bg-white/10 text-white border-white/20"}`}>
                      {p.icon} {p.name}{p.kind==="throw"?" 🎯投":""}  ×{count}
                    </button>
                  );
                })}
              </div>
              {selectedPotions.length>0 && (
                <div className="mt-2 text-amber-300 text-xs font-bold">
                  {selectedPotions.map(pid=>getPotion(pid)?.effectText).filter(Boolean).join("、")}
                </div>
              )}
            </div>
          )}

          {/* 外觀更換 */}
          <button
            onClick={() => { setArcherSelectReturn("prebattle"); setPhase("archer_select"); }}
            className="w-full py-2 rounded-xl text-sm font-bold mb-1"
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <img src={`/cats/portraits/${archerStyle || CAT_IDS[0]}.webp`}
              style={{ width:22, height:22, borderRadius:"50%", objectFit:"cover" }} alt="" />
            🎨 更換射手外觀（{CATS[archerStyle]?.name || "未選擇"}）
          </button>

          {hasCat && (
            <div className="flex items-center justify-center gap-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl py-2 px-3 text-xs text-indigo-200 mb-1">
              🐱 {catName} 將在戰鬥中協助你！
            </div>
          )}
          <button onClick={startBattle} className="w-full py-4 rounded-2xl font-black text-lg"
            style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>
            ⚔️ 開始挑戰！{selectedPotions.length>0?`（帶 ${selectedPotions.length} 瓶藥）`:""}
          </button>
        </div>
      </div>
    );
  }

  if (phase==="battle") {
    const maxHP = (battleStats||archerStats)?.hp||100;
    const archPct = Math.max(0, Math.round(archerHP/maxHP*100));
    const monPct  = monster ? Math.max(0, Math.round(monsterHP/monster.hp*100)) : 0;
    const total6  = arrows.reduce((s,v)=>s+arrowLabelToVal(v),0);
    const monLv   = monster?.tier==="mythic"?99:monster?.tier==="boss"?75:monster?.tier==="fierce"?50:monster?.tier==="elite"?35:monster?.tier==="rare"?20:10;
    const catType = profile?.equippedCat?.type || "allround";
    const catGlowColor = catType === "healer" ? "#10b981" : catType === "attacker" ? "#ef4444" : "#a78bfa";
    const catGlowAnim = catMsg ? (catType === "healer" ? "mb-cat-glow-green 1.2s ease-in-out infinite" : catType === "attacker" ? "mb-cat-glow-red 1.2s ease-in-out infinite" : "mb-cat-glow-purple 1.2s ease-in-out infinite") : undefined;

    return (
      <div style={{
        position:"fixed", top:0, bottom:0,
        left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:540,
        overflow:"hidden", zIndex:9999,
        backgroundImage:"url(/ui/dungeon-bg.webp)",
        backgroundSize:"cover", backgroundPosition:"center",
        display:"flex", flexDirection:"column"
      }}>
        <style>{BATTLE_CSS}</style>
        <CatMsg msg={catMsg} onDone={clearCatMsg}/>

        {/* 閃光特效層 */}
        {animHitCrit    && <div style={{position:"fixed",inset:0,background:"rgba(255,220,0,0.18)",pointerEvents:"none",zIndex:50,animation:"mb-crit-flash .6s ease-out forwards"}}/>}
        {animCounterCrit && <div style={{position:"fixed",inset:0,background:"rgba(239,68,68,0.22)",pointerEvents:"none",zIndex:50,animation:"mb-crit-flash .7s ease-out forwards"}}/>}

        {/* 返回按鈕（右上角懸浮） */}
        {onBack && (
          <button onClick={onBack} style={{
            position:"absolute", top:8, right:8, zIndex:100,
            background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.2)",
            borderRadius:20, padding:"3px 10px", color:"#94a3b8",
            fontSize:11, fontWeight:700, cursor:"pointer"
          }}>✕ 離開</button>
        )}

        {/* ── 上半：戰鬥 log（左）+ 怪物展示（右）── */}
        <div style={{flex:"1 1 0", minHeight:0, display:"flex", gap:6, padding:"8px 8px 0"}}>

          {/* 左：戰鬥紀錄（可折疊，高度自適應內容不超過怪物） */}
          <div style={{
            flexShrink:0, background:"rgba(0,0,0,0.82)", borderRadius:8,
            border:"1px solid rgba(255,255,255,0.07)",
            display:"flex", flexDirection:"column", overflow:"hidden",
            width: logOpen ? 180 : 36, transition:"width .2s ease",
            alignSelf:"flex-start", maxHeight:200
          }}>
            {/* 標題列 + 折疊按鈕 */}
            <button onClick={()=>setLogOpen(v=>!v)} style={{
              display:"flex", alignItems:"center", gap:4, padding:"5px 6px",
              background:"none", border:"none", cursor:"pointer", width:"100%",
              borderBottom: logOpen?"1px solid rgba(255,255,255,0.06)":"none"
            }}>
              <span style={{fontSize:12}}>📜</span>
              {logOpen && <span style={{color:"#475569", fontSize:9, fontWeight:900, letterSpacing:1, whiteSpace:"nowrap"}}>戰鬥紀錄</span>}
              <span style={{marginLeft:"auto", color:"#475569", fontSize:10}}>{logOpen?"◀":"▶"}</span>
            </button>
            {/* 內容 */}
            {logOpen && (
              <div style={{flex:1, overflowY:"auto", padding:"2px 6px"}}>
                {log.map((e,i)=>(
                  <div key={i} style={{
                    fontSize:10, lineHeight:1.5, padding:"0.5px 0",
                    color: e.type==="win"?"#fbbf24":e.type==="lose"?"#f87171":
                      e.type==="revive"?"#f472b6":e.type==="event_good"?"#34d399":
                      e.type==="event_bad"?"#f87171":e.type==="counter"?"#fb923c":
                      e.type==="total"?"#67e8f9":e.type==="hit_organ"?"#c084fc":
                      e.type==="hit_crit"?"#fb923c":e.type==="hit"?"#86efac":
                      e.type==="miss"?"#64748b":"#94a3b8"
                  }}>{e.text}</div>
                ))}
                <div ref={logEndRef}/>
              </div>
            )}
          </div>

          {/* 右：怪物展示 */}
          <div style={{flex:1, display:"flex", flexDirection:"column", minWidth:0, paddingTop:28}}>
            {/* 名稱列 */}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:3}}>
              <span style={{color:"white", fontWeight:900, fontSize:17, textShadow:"0 2px 8px #000"}}>{monster?.name}</span>
              <span style={{color:"#94a3b8", fontSize:10}}>Lv.{monLv}</span>
            </div>

            {/* HP 條 */}
            <div style={{
              background:"#1e293b", borderRadius:20, height:21,
              border:"1.5px solid #7f1d1d", overflow:"hidden", position:"relative", marginBottom:5
            }}>
              <div style={{
                width:`${monPct}%`, height:"100%", transition:"width .7s ease",
                background:monPct>50?"#dc2626":monPct>25?"#f59e0b":"#7f1d1d"
              }}/>
              <div style={{
                position:"absolute", inset:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"white", fontSize:10, fontWeight:900
              }}>
                {monsterHP?.toLocaleString()} / {monster?.hp?.toLocaleString()}
              </div>
            </div>

            {/* 狀態標籤列 */}
            <div style={{display:"flex", gap:3, marginBottom:4, flexWrap:"wrap"}}>
              {[
                ["💀", `${round}回`, "rgba(255,255,255,0.07)", "#94a3b8"],
                ["⚔️", monster?.atk, "rgba(239,68,68,0.15)", "#f87171"],
                ["🛡️", monster?.def, "rgba(59,130,246,0.15)", "#60a5fa"],
              ].map(([ic,val,bg,col])=>(
                <div key={ic} style={{
                  background:bg, border:`1px solid ${col}44`,
                  borderRadius:5, padding:"1px 5px", fontSize:10, color:col
                }}>{ic} {val}</div>
              ))}
              {distanceMode==="dynamic" && (
                <div style={{background:"rgba(251,191,36,0.15)",border:"1px solid #fbbf2444",borderRadius:5,padding:"1px 5px",fontSize:10,color:"#fbbf24"}}>📍{distance}m</div>
              )}
            </div>

            {/* 怪物大圖 + 浮動傷害 */}
            <div style={{flex:1, position:"relative", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <div style={
                animMonsterCritAtk ? {animation:"mb-monster-attack-crit .75s ease"} :
                animMonsterAttack  ? {animation:"mb-monster-attack .65s ease"} :
                animHitCrit        ? {animation:"mb-shake-heavy .65s ease"} :
                animHit            ? {animation:"mb-shake .5s ease"} : {}
              }>
                <MonsterBattleImg id={monster?.id}/>
              </div>
              <div style={{position:"absolute", inset:0, pointerEvents:"none"}}>
                {floatDmgs.map(f=>(
                  <span key={f.id} style={{
                    position:"absolute", left:`${f.left}%`, top:"10%",
                    animation:"mb-float 1.3s ease-out forwards", fontWeight:900,
                    fontSize:f.isOrgan?"1.3rem":f.isCrit?"1.15rem":"0.95rem",
                    color:f.isOrgan?"#f97316":f.isCrit?"#fbbf24":f.text==="MISS"?"#94a3b8":"#f87171",
                    textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap"
                  }}>{f.text}{f.isOrgan?"💥":f.isCrit?"⚡":""}</span>
                ))}
                {floatCounterDmgs.map(f=>(
                  <span key={f.id} style={{
                    position:"absolute", left:`${f.left}%`, top:"55%",
                    animation:"mb-float 1.3s ease-out forwards", fontWeight:900,
                    fontSize:f.isCrit?"1.15rem":"0.95rem",
                    color:f.isCrit?"#f43f5e":"#fca5a5",
                    textShadow:"0 2px 8px rgba(0,0,0,0.9)", whiteSpace:"nowrap"
                  }}>{f.text}{f.isCrit?"💢":""}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 弓箭手排列 + 射手資訊 ── */}
        <div style={{flex:"0 0 auto", display:"flex", flexDirection:"column", overflow:"hidden"}}>
          {/* 弓箭手圖：固定高度 100px */}
          <div style={{height:100, display:"flex", alignItems:"flex-end", justifyContent:"center"}}>
            <div style={{
              height:"100%", aspectRatio:"3/5", position:"relative",
              animation: animArcherHit   ? "mb-archer-hurt 0.65s ease"  :
                         animArcherMiss  ? "mb-archer-miss 0.55s ease"  :
                         animArcherShoot ? "mb-archer-shoot 0.45s ease" : undefined
            }}>
              <img
                src={`/cats/archers/${archerStyle || profile?.equippedCat?.catId || CAT_IDS[0]}.webp`}
                alt="archer"
                style={{width:"100%", height:"100%", objectFit:"contain", objectPosition:"center bottom", display:"block"}}
              />
              {/* 金色底光 */}
              <div style={{position:"absolute", inset:0, pointerEvents:"none",
                boxShadow:"inset 0 -2px 0 #fbbf24"}}/>
              {animArcherCrit && (
                <div style={{
                  position:"absolute", inset:0, pointerEvents:"none",
                  background:"rgba(251,191,36,0.4)",
                  boxShadow:"0 0 24px 8px rgba(251,191,36,0.65)",
                  animation:"mb-archer-crit 0.7s ease forwards"
                }}/>
              )}
              {floatArcherEffects.map(e=>(
                <div key={e.id} style={{
                  position:"absolute", top:"10%", left:"50%", transform:"translateX(-50%)",
                  animation:"mb-float 1.2s ease-out forwards",
                  color:e.color, fontWeight:900, fontSize:"1rem",
                  textShadow:"0 2px 8px rgba(0,0,0,0.95)",
                  pointerEvents:"none", zIndex:20, whiteSpace:"nowrap"
                }}>{e.text}</div>
              ))}
            </div>
          </div>

          {/* 射手資訊列：直向欄位（多人可並排，單人置中） */}
          <div style={{
            background:"rgba(0,0,0,0.82)", borderTop:"1px solid rgba(255,255,255,0.08)",
            display:"flex", justifyContent:"center", alignItems:"center", gap:8, padding:"5px 8px"
          }}>
            {/* 射手欄位 */}
            <div style={{
              textAlign:"center", padding:"5px 18px", minWidth:80,
              border:"1px solid rgba(255,255,255,0.18)",
              borderRadius:8,
              background:"rgba(255,255,255,0.04)"
            }}>
              <div style={{
                width:18, height:18, borderRadius:"50%", margin:"0 auto 3px",
                background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.28)",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"white", fontSize:9, fontWeight:900
              }}>1</div>
              <div style={{color:"white", fontSize:10, fontWeight:900, lineHeight:1.3}}>
                {(profile?.nickname||profile?.name||"射手").slice(0,6)}
              </div>
              <div style={{ height:4, borderRadius:3, background:"rgba(255,255,255,0.08)", overflow:"hidden", margin:"3px 0 2px" }}>
                <div style={{ height:"100%", borderRadius:3, transition:"width 0.5s ease",
                  width:`${Math.max(0,archerHP/(maxHP||1))*100}%`,
                  background: archerHP/(maxHP||1)>0.5?"linear-gradient(90deg,#16a34a,#4ade80)":archerHP/(maxHP||1)>0.25?"linear-gradient(90deg,#d97706,#fbbf24)":"linear-gradient(90deg,#dc2626,#f87171)"
                }}/>
              </div>
              <div style={{color:archerHP/(maxHP||1)<=0.25?"#f87171":"#34d399", fontSize:9, fontWeight:700}}>
                HP {archerHP}/{maxHP}{revived?" 💖":""}
              </div>
              <div style={{display:"flex", gap:6, justifyContent:"center", marginTop:2}}>
                <span style={{color:"#f87171", fontSize:9, fontWeight:700}}>ATK {archerStats?.atk||0}</span>
                <span style={{color:"#60a5fa", fontSize:9, fontWeight:700}}>DEF {archerStats?.def||0}</span>
              </div>
            </div>

            {/* 貓貓夥伴框 */}
            {hasCat && (
              <div style={{
                textAlign:"center", padding:"4px 8px",
                border:`1px solid ${catMsg ? catGlowColor : "rgba(255,255,255,0.18)"}`,
                borderRadius:8, background:"rgba(255,255,255,0.04)",
                position:"relative", transition:"border-color .3s, box-shadow .3s",
                boxShadow: catMsg ? `0 0 14px ${catGlowColor}88` : "none",
                minWidth:52,
              }}>
                <img
                  src={`/cats/portraits/${profile?.equippedCat?.catId || CAT_IDS[0]}.webp`}
                  alt={catName}
                  style={{
                    width:36, height:36, objectFit:"contain", display:"block", margin:"0 auto",
                    animation: catGlowAnim,
                  }}
                />
                <div style={{color: catMsg ? catGlowColor : "#c4b5fd", fontSize:9, fontWeight:700, marginTop:1, transition:"color .3s"}}>
                  {(catName||"貓貓").slice(0,4)}
                </div>
                {catMsg && (
                  <div style={{
                    position:"absolute", bottom:"105%", left:"50%", transform:"translateX(-50%)",
                    background:"rgba(88,28,135,0.92)", border:`1px solid ${catGlowColor}`,
                    borderRadius:8, padding:"3px 8px", fontSize:10, color:"#e9d5ff",
                    whiteSpace:"nowrap", fontWeight:700,
                    animation:"mb-float 2s ease-out forwards", pointerEvents:"none",
                  }}>🐱 {catMsg}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 輸入區 ── */}
        <div style={{flex:"0 0 auto", padding:"3px 6px", background:"rgba(0,0,0,0.68)"}}>

          {/* HP 危機 */}
          {archPct<=25 && battlePhase==="input" && (
            <div style={{
              textAlign:"center", fontSize:11, fontWeight:900, color:"#ef4444",
              marginBottom:4, animation:"mb-hp-danger 1s ease-in-out infinite",
              background:"rgba(239,68,68,0.12)", borderRadius:6, padding:"2px 0"
            }}>⚠️ 生命值危急！</div>
          )}

          {/* 事件卡 */}
          {battlePhase==="event" && currentEvent && (
            <div style={{
              padding:"6px 10px", borderRadius:10, marginBottom:4, textAlign:"center",
              background:currentEvent.type==="buff"?"rgba(16,185,129,0.25)":currentEvent.type==="debuff"?"rgba(239,68,68,0.25)":"rgba(59,130,246,0.25)",
              border:`1px solid ${currentEvent.type==="buff"?"#10b981":currentEvent.type==="debuff"?"#ef4444":"#3b82f6"}55`,
              animation:currentEvent.type==="buff"?"mb-event-buff .45s ease":"mb-event-debuff .45s ease"
            }}>
              <span style={{fontSize:16}}>{currentEvent.icon}</span>
              <span style={{color:"white", fontWeight:900, fontSize:12, marginLeft:6}}>{currentEvent.title}</span>
              <div style={{color:"#cbd5e1", fontSize:10, marginTop:1}}>{currentEvent.desc}</div>
            </div>
          )}


          {/* 輸入階段 */}
          {battlePhase==="input" && (
            <>
              {/* 箭槽 */}
              <div style={{display:"flex", gap:3, marginBottom:4, justifyContent:"center", alignItems:"center"}}>
                {Array.from({length:ARROWS_PER_ROUND}).map((_,i)=>(
                  <div key={i} style={{
                    width:26, height:26, borderRadius:5, flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:900,
                    background:i<arrows.length?"#2563eb":i===arrows.length?"rgba(37,99,235,0.3)":"rgba(255,255,255,0.05)",
                    border:`2px solid ${i<arrows.length?"#60a5fa":i===arrows.length?"#3b82f6":"rgba(255,255,255,0.1)"}`,
                    color:i<arrows.length?"white":"#475569"
                  }}>
                    {i<arrows.length ? arrows[i] : ""}
                  </div>
                ))}
                {arrows.length>0 && (
                  <button onClick={undoArrow} style={{background:"none",border:"none",color:"#64748b",fontSize:14,cursor:"pointer",paddingLeft:4}}>↩</button>
                )}
              </div>

              {/* 分數按鈕（滿6箭自動隱藏）兩排 × 6欄 */}
              {arrows.length < ARROWS_PER_ROUND && <div style={{
                display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:3, marginBottom:4,
                background:"rgb(20,12,5)", borderRadius:6, padding:"3px"
              }}>
                {HALF_SCORES.map(s=>(
                  <button key={s.label} onClick={()=>inputArrow(s.label)}
                    disabled={arrows.length>=ARROWS_PER_ROUND||processing}
                    style={{
                      backgroundImage:"url(/ui/score-btn.webp)",
                      backgroundSize:"cover", backgroundPosition:"center",
                      backgroundColor:"rgb(30,16,6)",
                      WebkitAppearance:"none", appearance:"none",
                      border:"none", borderRadius:5, height:40, width:"100%",
                      color:s.label==="X"?"#fbbf24":s.label==="M"?"#94a3b8":
                        s.val>=9?"#fef3c7":s.val>=7?"#bfdbfe":s.val>=5?"#d1d5db":"#9ca3af",
                      fontWeight:900, fontSize:14, cursor:"pointer",
                      opacity:arrows.length>=ARROWS_PER_ROUND||processing?0.4:1,
                      textShadow:"0 1px 6px #000", padding:0, transition:"transform .08s"
                    }}
                    onTouchStart={e=>e.currentTarget.style.transform="scale(0.88)"}
                    onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}
                  >{s.label}</button>
                ))}
              </div>}

              {/* TURN + 回合總分 + 送出 */}
              <div style={{display:"flex", gap:4, alignItems:"center"}}>
                {/* 回合計數格 */}
                <div style={{
                  flexShrink:0, width:46, height:40,
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  background:"rgba(0,0,0,0.6)", border:"1.5px solid #92400e", borderRadius:7
                }}>
                  <span style={{color:"white", fontWeight:900, fontSize:17, lineHeight:1}}>{round}</span>
                  <span style={{color:"#92400e", fontSize:7, fontWeight:900, letterSpacing:1}}>TURN</span>
                </div>
                {/* 總分 */}
                <div style={{
                  flex:1, background:"rgba(255,255,255,0.05)", borderRadius:8,
                  border:"1px solid rgba(255,255,255,0.1)", padding:"5px 10px",
                  display:"flex", justifyContent:"space-between", alignItems:"center"
                }}>
                  <span style={{color:"#94a3b8", fontSize:11}}>回合總分</span>
                  <span style={{color:"#60a5fa", fontWeight:900, fontSize:18}}>
                    {total6}<span style={{color:"#475569", fontSize:10, marginLeft:2}}>/60</span>
                  </span>
                </div>
                <button
                  onClick={submitRound}
                  disabled={arrows.length<ARROWS_PER_ROUND||processing}
                  style={{
                    flex:2, padding:"8px 0",
                    background:arrows.length>=ARROWS_PER_ROUND
                      ?"linear-gradient(90deg,#7c3aed,#2563eb)"
                      :"rgba(255,255,255,0.07)",
                    border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:8, color:"white",
                    fontWeight:900, fontSize:14, cursor:arrows.length>=ARROWS_PER_ROUND?"pointer":"default",
                    opacity:processing?0.5:(arrows.length<ARROWS_PER_ROUND?0.3:1),
                    transition:"background .2s, opacity .2s"
                  }}
                >{processing?"計算中…":"⚔️ 送出！"}</button>
              </div>
            </>
          )}
        </div>

      </div>
    );
  }

  if (phase==="loot") {
    const stats=calcStats(allArrows);
    return (
      <div className="p-4 flex flex-col gap-4 items-center bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <div className="text-center mt-4">
          <div className="text-amber-400 font-black text-xl mb-1">🏆 擊倒 {monster?.name}！</div>
          <div className="text-slate-400 text-sm">第 {round} 回合完成</div>
        </div>
        <div className="w-full grid grid-cols-3 gap-2">
          {[["⚔️ 總傷害",totalDmgDealt],["🛡️ 承傷",totalDmgRecvd],["💥 爆擊",`${critCount}次`]].map(([lbl,val])=>(
            <div key={lbl} className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
              <div className="text-slate-400 text-xs">{lbl}</div>
              <div className="font-black text-white text-xl">{val}</div>
            </div>
          ))}
        </div>
        {stats&&(
          <div className="w-full bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4">
            <div className="text-blue-300 text-xs font-black mb-3">🎯 本場射箭統計（{stats.count} 箭）</div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[["總分",stats.total],["平均",stats.avg],["X/10",stats.tens],["脫靶",stats.misses]].map(([l,v])=>(
                <div key={l} className="bg-white/5 rounded-xl p-2 text-center border border-white/10">
                  <div className="text-blue-400 text-xs">{l}</div>
                  <div className="font-black text-white text-lg">{v}</div>
                </div>
              ))}
            </div>
            <div className="text-blue-400 text-xs font-bold mb-1.5">分數分佈</div>
            <div className="flex gap-1 flex-wrap">
              {[10,9,8,7,6,5,4,3,2,1,0].map(s=>{
                const c=stats.dist[s]||0;
                if (!c) return null;
                const col=HALF_SCORES.find(h=>h.val===s)?.color||"#9ca3af";
                return (
                  <div key={s} className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-black text-slate-300">{c}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ background:col }}>{s===0?"M":s===10?"X":s}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* 冒險者 XP 顯示 */}
        {gainedXP > 0 && !isGuest && (
          <div className="w-full rounded-xl px-4 py-2.5 flex items-center gap-2" style={{ background:"linear-gradient(90deg,rgba(124,58,237,0.2),rgba(37,99,235,0.15))", border:"1px solid rgba(124,58,237,0.35)" }}>
            <span className="text-purple-300 font-black text-sm">⚔️ 冒險者 XP</span>
            <span className="text-white font-black text-lg ml-auto">+{gainedXP}</span>
          </div>
        )}
        {/* ── 掉落物顯示（怪物死亡後的戰利品）── */}
        {(isGuest || !profile?.id) ? (
          /* 訪客掉落區 */
          loot ? (
            <div className="w-full" style={{ animation:"mb-drop .6s ease" }}>
              {!lootRevealed ? (
                <button onClick={()=>{ setLootRevealed(true); setShowLootBox(true); }}
                  className="w-full flex flex-col items-center gap-3 active:scale-95 transition-transform py-4"
                  style={{ animation:"mb-chest 1.5s ease infinite" }}>
                  <div className="text-8xl">🎁</div>
                  <div className="text-amber-600 font-black text-xl">點擊開紀念寶箱！</div>
                </button>
              ) : (
                <div className="w-full bg-amber-900/20 border-2 border-amber-400/40 rounded-2xl p-4 flex flex-col items-center gap-3">
                  <div className="text-5xl">{loot.icon}</div>
                  <div className="font-black text-xl text-white">{loot.name}</div>
                  <div className="text-slate-400 text-sm text-center">{loot.desc}</div>
                  <div className="text-amber-300 text-xs font-bold bg-amber-900/30 rounded-xl px-3 py-1.5">
                    📸 請截圖後出示給教練！
                  </div>
                </div>
              )}
            </div>
          ) : guestWonBefore ? (
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-2">🎮</div>
              <div className="text-slate-300 font-black text-sm">紀念寶箱已領取</div>
              <div className="text-slate-500 text-xs mt-1">成為正式射手才能獲得更多獎勵！</div>
            </div>
          ) : null
        ) : (
          /* 射手掉落區 */
          <div className="w-full flex flex-col gap-3">
            {/* 即時掉落（材料、金幣、卡片）*/}
            {(droppedMaterials.length > 0 || droppedCoins > 0 || droppedCard || droppedCoinChest) && (
              <div className="w-full rounded-2xl border-2 border-yellow-500/40 bg-yellow-900/20 p-3">
                <div className="text-yellow-400 text-xs font-black mb-2 text-center">⚔️ 擊殺掉落</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {droppedCoins > 0 && (
                    <div className="flex flex-col items-center gap-1 px-3 py-2 bg-yellow-400/30 rounded-xl"
                      style={{ animation:"mb-coin .7s ease" }}>
                      <span className="text-2xl">🪙</span>
                      <span className="font-black text-yellow-800 text-sm">+{droppedCoins}</span>
                      <span className="text-yellow-600 text-xs">金幣</span>
                    </div>
                  )}
                  {droppedCoinChest && (
                    <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl"
                      style={{ background:`${droppedCoinChest.color}22`, border:`1px solid ${droppedCoinChest.color}66` }}>
                      <span className="text-2xl">{droppedCoinChest.icon}</span>
                      <span className="font-black text-xs" style={{ color: droppedCoinChest.color }}>{droppedCoinChest.name}</span>
                      <span className="text-yellow-600 text-xs">🎒 已放入背包</span>
                    </div>
                  )}
                  {droppedMaterials.map((m,i) => (
                    <div key={i} className="flex flex-col items-center gap-1 px-3 py-2 bg-purple-900/30 rounded-xl"
                      style={{ animation:`mb-drop .6s ease ${0.15+i*0.1}s both` }}>
                      <span className="text-2xl">{m.icon}</span>
                      <span className="font-black text-purple-300 text-xs">{m.name}</span>
                      <span className="text-purple-400 text-xs">材料</span>
                    </div>
                  ))}
                  {droppedCard && (
                    <div className="flex flex-col items-center gap-1 px-3 py-2 bg-rose-900/30 rounded-xl"
                      style={{ animation:"mb-drop .6s ease .3s both" }}>
                      <span className="text-2xl">{droppedCard.icon}</span>
                      <span className="font-black text-rose-300 text-xs">{droppedCard.name}</span>
                      <span className="text-rose-400 text-xs">🃏 卡片！</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 寶箱（進背包）*/}
            {wonChests.length > 0 && (
              <div className="w-full flex flex-col gap-2">
                {wonChests.map((ch, idx) => {
                  const cc = CHEST_TYPES[ch.type] || CHEST_TYPES.wood;
                  return (
                    <div key={idx} className="rounded-xl p-3 border-2 flex items-center gap-3"
                      style={{ background:cc.color+"15", borderColor:cc.color+"66" }}>
                      <div className="text-4xl" style={{ animation:"mb-chest 1.5s ease infinite" }}>{cc.icon}</div>
                      <div className="flex-1">
                        <div className="font-black text-sm" style={{ color:cc.color }}>
                          獲得「{cc.name}」！{ch.type==="cat"?" 🎉 Lucky！":""}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5">已放進背包，到「🎒 背包」頁開箱</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button onClick={()=>setShowBattleCard(true)}
          className="w-full py-3 rounded-xl font-black text-white"
          style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)" }}>
          📤 產生戰績分享卡
        </button>
        <div className="flex gap-3 w-full">
          <button onClick={()=>setPhase("select")} className="flex-1 py-3 rounded-xl bg-white/10 text-slate-300 font-bold">換對手</button>
          {(questContext||dailyLeft===null||dailyLeft>0)&&(
            <button onClick={()=>{ const m=lastPickedRef.current; if(m) setPickedMonster(m); setPhase("prebattle"); }}
              className="flex-1 py-3 rounded-xl font-black"
              style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
          )}
        </div>
        <details className="w-full">
          <summary className="text-gray-400 text-xs cursor-pointer text-center">▼ 查看戰鬥記錄</summary>
          <div className="bg-gray-900 rounded-xl p-3 mt-2 max-h-40 overflow-y-auto">
            {log.map((e,i)=><div key={i} className="text-xs text-gray-400 py-0.5">{e.text}</div>)}
          </div>
        </details>
        {showLootBox&&loot&&<LootBox loot={loot} onDone={()=>setShowLootBox(false)} />}
        {showBattleCard&&(
          <BattleCard onClose={()=>setShowBattleCard(false)}
            battleData={{ monster, totalDmg:totalDmgDealt, totalReceived:totalDmgRecvd, critCount, loot, round, mode, battleMode }} />
        )}
      </div>
    );
  }

  if (phase==="result") {
    const stats=calcStats(allArrows);
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <div className="rounded-2xl p-6 text-white text-center" style={{ background:"linear-gradient(135deg,#7f1d1d,#4c1d95)" }}>
          <div className="text-5xl mb-3" style={{ animation:"mb-bounce 1s ease infinite" }}>💀</div>
          <div className="text-2xl font-black mb-1">敗北…</div>
          <div className="text-sm opacity-80 mb-4">被 {monster?.name} 擊倒了，{round} 回合</div>
          <div className="flex gap-2">
            <button onClick={()=>setPhase("select")} className="flex-1 py-3 rounded-xl bg-white/20 text-white font-bold">換對手</button>
            {(questContext||dailyLeft===null||dailyLeft>0)&&(
              <button onClick={()=>{ const m=lastPickedRef.current; if(m) setPickedMonster(m); setPhase("prebattle"); }}
                className="flex-1 py-3 rounded-xl font-black"
                style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
            )}
          </div>
        </div>
        {stats&&(
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4">
            <div className="text-blue-300 text-xs font-black mb-3">🎯 本場射箭統計（{stats.count} 箭）</div>
            <div className="grid grid-cols-4 gap-2">
              {[["總分",stats.total],["平均",stats.avg],["X/10",stats.tens],["脫靶",stats.misses]].map(([l,v])=>(
                <div key={l} className="bg-white/5 rounded-xl p-2 text-center border border-white/10">
                  <div className="text-blue-400 text-xs">{l}</div>
                  <div className="font-black text-white text-lg">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <details className="w-full">
          <summary className="text-slate-500 text-xs cursor-pointer text-center">▼ 查看戰鬥記錄</summary>
          <div className="bg-slate-800 rounded-xl p-3 mt-2 max-h-40 overflow-y-auto">
            {log.map((e,i)=><div key={i} className="text-xs text-slate-400 py-0.5">{e.text}</div>)}
          </div>
        </details>
      </div>
    );
  }

  if (phase==="history") {
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <button onClick={()=>setPhase("select")} className="text-slate-400 text-sm self-start">← 返回</button>
        <BattleRecords logs={history} title="📊 打怪戰鬥紀錄" maxGroups={12}/>
      </div>
    );
  }

  return null;
}