// src/components/member/MonsterBattle.jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import CatMsg from "../cat/CatMsg";
import {
  getCertRecords, getCertification, subscribeDexGrants, getDexConfig,
  createNotification, saveMonsterLog,
  getMonsterDailyConfig, subscribeMonsterEventConfig, checkMonsterDailyLimit, recordMonsterSession,
  addChests, subscribePotions, usePotions, addPracticeLog, addMaterials,
  addCoins, addMonsterCard, recordPotionUsed,
  subscribeCardCollection, addArcherXP, addRoundArrows, recordGuestBattleStats,
} from "../../lib/db";
import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";
import { MONSTER_TIER_XP, archerLevelFromXP, archerLevelBonus } from "../../lib/archerLevel";
import { CAT_TIER_XP } from "../../lib/catLevel";
import { getRewardsForMilestone } from "../../lib/arrowMilestone";
import { useCheckinActive } from "../../hooks/useCheckinActive";

import ArrowMilestonePopup from "./ArrowMilestonePopup";
import { makeChests, openChestContents, CHEST_TYPES, calcPotionBuffs, CARRY_POTIONS, THROW_POTIONS } from "../../lib/itemData";
import { mergeCarryBuff, resolveConsumable } from "../../lib/consumableSystem";
import { computeDexStats } from "../../lib/achievementDex";
import {
  MONSTERS, FAMILIES, TIER_LABEL,
  calcArcherStats, calcArcherPower, drawMatchedMonsters,
} from "../../lib/monsterData";
import { LOOT_TABLE_GUEST, drawLoot, isRareLoot, rollCoins, rollMaterialDrop, rollMaterialDrops, rollMaterialDropsGuaranteed, rollCardDrop, makeCoinChest, COIN_CHEST_CHANCE_BY_MODE } from "../../lib/lootTable";
import LootBox from "./LootBox";
import { EventType } from "../../battle/BattleEvents";
import { processMonsterRound } from "../../battle/BattleEngine";
import { createDispatch } from "../../battle/BattleAnimation";
import { RoundController } from "../../battle/RoundController";
import { sfxTap, sfxSoftFail, sfxCast, sfxBuff, sfxDebuff, sfxArrowHit, sfxCritBoom, sfxOrganHit, sfxCounter, sfxCounterCrit, sfxRevive, sfxRoundEnd, sfxPotionDrink, unlockAudio, vibrate } from "../../lib/sound";
import { playBattleSound } from "../../lib/battleSound";
import BattleSoundIndicator from "../shared/BattleSoundIndicator";
import BattleCard from "./BattleCard";
import MonsterSVG, { MonsterBattleImg } from "../MonsterSVG";
import { CAT_IDS, CATS } from "../../lib/catData";
import TargetFaceOverlay, { TargetFmtPicker, InputModePicker, getBattleTargetFmt, setBattleTargetFmt, getBattleInputMode, setBattleInputMode } from "../shared/TargetFaceOverlay";
import BattleShootingProfile from "../shared/BattleShootingProfile";
import { loadBattleShootingProfile } from "../../lib/battlePractice";
import { BattleHPBar, BattleArrowSlots, BattleScoreButtons, BattleStatusTags, BattleStatCard, BattleLogPanel } from "../shared/SharedBattleComponents";
import BattleBottomBar from "./BattleBottomBar";
import { labelToValue, HALF_SCORES, calcArrowStats } from "../../lib/score";
import { BattleResultPanel, RESULT_CONFIG_SOLO } from "../shared/BattleResultPanel";

// 向後相容 alias（逐步取代為直接使用 labelToValue / calcArrowStats）
const arrowLabelToVal = labelToValue;
const calcStats = calcArrowStats;

const ARROWS_PER_ROUND   = 6;
const ARROWS_PER_COUNTER = 2;
const DISTANCE_START = 15;
const VETERAN_MULT = { hp:1.5, atk:1.5, def:1.3 };
const PRESET_DISTANCES_NOVICE = [5, 7, 10];
const PRESET_DISTANCES = [5, 7, 10, 13.5, 15, 18];  // 學生 + 老手

// HALF_SCORES 統一由 ../../lib/score 管理

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
@keyframes mb-intro-archer  { from{opacity:0;transform:translateX(-90px) scale(0.6)} to{opacity:1;transform:translateX(0) scale(1)} }
@keyframes mb-intro-monster { from{opacity:0;transform:translateX(90px) scale(0.6)} to{opacity:1;transform:translateX(0) scale(1)} }
@keyframes mb-intro-vs      { 0%{opacity:0;transform:scale(0.2) rotate(-18deg)} 55%{transform:scale(1.3) rotate(4deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
@keyframes mb-intro-start   { from{opacity:0;transform:translateY(18px) scale(0.85)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes mb-die-monster   { 0%{filter:brightness(1)} 20%{filter:brightness(3.5) drop-shadow(0 0 40px #ef4444)} 100%{filter:brightness(0.1) grayscale(0.8) drop-shadow(0 0 6px #555)} }
@keyframes mb-die-badge     { 0%{opacity:0;transform:scale(2.2) rotate(-20deg)} 55%{opacity:1;transform:scale(0.92) rotate(6deg)} 100%{opacity:1;transform:scale(1) rotate(-8deg)} }
@keyframes mb-die-victory   { 0%{opacity:0;transform:scale(0.3) rotate(-12deg)} 55%{transform:scale(1.2) rotate(3deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
@keyframes mb-die-stats     { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes mb-monster-attack { 0%{transform:translateY(0) scale(1)} 35%{transform:translateY(50px) scale(1.12)} 68%{transform:translateY(22px) scale(1.04)} 100%{transform:translateY(0) scale(1)} }
@keyframes mb-monster-attack-crit { 0%{transform:translateY(0) scale(1);filter:brightness(1)} 35%{transform:translateY(50px) scale(1.15);filter:brightness(1.8) drop-shadow(0 0 18px #ef4444) drop-shadow(0 0 36px #dc262688)} 68%{transform:translateY(22px) scale(1.05);filter:brightness(1.2)} 100%{transform:translateY(0) scale(1);filter:brightness(1)} }
@keyframes mb-cat-glow-purple { 0%,100%{filter:drop-shadow(0 0 4px #a78bfa)} 50%{filter:drop-shadow(0 0 14px #a78bfa) brightness(1.35)} }
@keyframes mb-cat-glow-green  { 0%,100%{filter:drop-shadow(0 0 4px #10b981)} 50%{filter:drop-shadow(0 0 14px #10b981) brightness(1.35)} }
@keyframes mb-cat-glow-red    { 0%,100%{filter:drop-shadow(0 0 4px #ef4444)} 50%{filter:drop-shadow(0 0 14px #ef4444) brightness(1.35)} }
`;

// HIT_TEXTS／getHitText／randDistStep 已移至 BattleEngine.js

// 使用 labelToValue from ../../lib/score

// 使用 calcArrowStats from ../../lib/score

function pickBg(family) {
  const idx = Math.ceil(Math.random() * 6);
  return family ? `/ui/battle-bg/bg_${family}_${idx}.webp` : `/ui/dungeon-bg.webp`;
}

// ── 預設設定 helpers ────────────────────────────────────────
function loadMbDefaults() {
  try { return JSON.parse(localStorage.getItem("mb_defaults") || "null"); } catch { return null; }
}
function saveMbDefaults(obj) {
  localStorage.setItem("mb_defaults", JSON.stringify(obj));
}

export default function MonsterBattle({ onBack, isGuest = false, kidMode = false, guestProfile = null, questContext = null, onKillForQuest = null, onImmersiveChange = null, monsterDex = {}, craftStats = {}, chestStats = {}, potionDex = {}, duelStats = null }) {
  const { profile: authProfile } = useAuth();
  const profile = guestProfile || authProfile;
  const checkinActive = useCheckinActive(isGuest ? null : profile?.id);
  const { hasCat, catName, catMsg, clearCatMsg, triggerCatAction, saveBond, saveXP, calcCatRoundDamage, triggerCatSkill, catHP: catMaxHP, catDEF: catBaseDEF } = useCatCompanion(isGuest ? profile : null);
  const [phase, setPhase]           = useState(() => localStorage.getItem("mb_archer_style") ? "select" : "archer_select");
  const [archerStyle, setArcherStyle]               = useState(() => localStorage.getItem("mb_archer_style") || "");
  const [archerSelectReturn, setArcherSelectReturn] = useState("select");
  const [battleMode, setBattleMode] = useState(() => loadMbDefaults()?.battleMode || "score");
  const [mode, setMode]             = useState(() => loadMbDefaults()?.mode || localStorage.getItem("mb_default_mode") || "novice");
  const [arrowsPerRound, setArrowsPerRound] = useState(() => loadMbDefaults()?.arrowsPerRound || 6);
  const [monster, setMonster]       = useState(null);
  const [battleBg, setBattleBg]     = useState("/ui/dungeon-bg.webp");
  const [archerStats, setArcherStats] = useState(null);
  const [certRecords, setCertRecords] = useState([]);
  const [certification, setCertification] = useState(null);
  const [dexGrants, setDexGrants]   = useState([]);
  const [dexConfig, setDexConfig]   = useState({ physicalMax:20, pointMax:20 });
  const [dailyLeft, setDailyLeft]   = useState(null);
  const [dailyMax, setDailyMax]     = useState(5);

  // 匹配怪物（6族各1隻）
  const [matchedMonsters, setMatchedMonsters] = useState([]);
  const [pickedMonster, setPickedMonster]     = useState(null);

  const [archerHP, setArcherHP]         = useState(100);
  const [monsterHP, setMonsterHP]       = useState(0);
  const [archerATKMod, setArcherATKMod] = useState(0);
  const [activeCarryBuffs, setActiveCarryBuffs] = useState({});
  const [potionShield, setPotionShield] = useState(0);
  const [monsterDmgTakenPct, setMonsterDmgTakenPct] = useState(0);
  const [counterReducePct, setCounterReducePct] = useState(0);
  const [poisonEffect, setPoisonEffect] = useState(null);
  const [distance, setDistance]         = useState(DISTANCE_START);
  const [round, setRound]               = useState(1);
  const [log, setLog]                   = useState([]);
  const [battlePhase, setBattlePhase]   = useState("input");
  const [arrows, setArrows]             = useState([]);
  const [allArrows, setAllArrows]       = useState([]);
  const [battleArrowPositions, setBattleArrowPositions] = useState([]);
  const [roundScores, setRoundScores]   = useState([]);
  const [unlockedParts, setUnlockedParts] = useState(new Set());
  const [revived, setRevived]           = useState(false);
  const [loot, setLoot]                 = useState(null);
  const [lootRevealed, setLootRevealed] = useState(false);
  const [milestoneQueue, setMilestoneQueue] = useState([]);
  const [showLootBox, setShowLootBox]   = useState(false);
  const [showBattleCard, setShowBattleCard] = useState(false);
  const [droppedMaterials, setDroppedMaterials] = useState([]);
  const [droppedCoins,    setDroppedCoins]     = useState(0);
  const [droppedCard,     setDroppedCard]      = useState(null);
  const [droppedCoinChest, setDroppedCoinChest] = useState(null);
  const [gainedXP,        setGainedXP]        = useState(0);
  const [gainedArcherXP,  setGainedArcherXP]  = useState(0);
  const [gainedCatXP,     setGainedCatXP]     = useState(0);
  const [guestWonBefore,  setGuestWonBefore]   = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [skipCounter, setSkipCounter]   = useState(false);
  const catDefShieldRef = useRef(null); // { reduction, blockFull } — 貓貓防禦技能保護下回合
  const [catCurrentHP,  setCatCurrentHP]  = useState(0);
  const catCurrentHPRef = useRef(0);
  const pendingPotionRef = useRef([]); // 擱置的藥水消耗，submitRound 時批次寫入
  const shootingProfileRef = useRef(null);
  const [processing, setProcessing]     = useState(false);
  const [targetMode, setTargetMode]     = useState(() => getBattleInputMode() === "target");
  const [targetPending, setTargetPending] = useState(false);
  const [targetFmt, setTargetFmt]       = useState(getBattleTargetFmt);
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
  const [bottomTab, setBottomTab]               = useState("score"); // "score"|"potion"|"party"
  const [potionSubTab, setPotionSubTab]         = useState("carry"); // "carry"|"throw"
  const [potionUsedThisRound, setPotionUsedThisRound] = useState(false);
  const [usedPotionThisRound, setUsedPotionThisRound] = useState(null); // { icon, name, effectText }
  const [scoringModeChosen, setScoringModeChosen]     = useState(false);
  const [distanceMode, setDistanceMode]       = useState(() => loadMbDefaults()?.distanceMode || "fixed");
  const [selectedDistance, setSelectedDistance] = useState(() => loadMbDefaults()?.selectedDistance || 15);
  const [eventConfig, setEventConfig]         = useState(null); // 賽事模式設定
  const [eventMode, setEventMode]             = useState(false); // 是否走賽事流程
  const logEndRef = useRef(null);
  const lastPickedRef = useRef(null);
  const phaseRef = useRef("select");
  const [cardColl, setCardColl] = useState({ cards: {}, equipped: [] });
  const cardCollRef = useRef({ cards: {}, equipped: [] }); // 供 startBattle 同步讀取
  const extraDexRef = useRef({}); // monsterDex/craftStats/... 不放 dep array，用 ref 同步最新值
  extraDexRef.current = { monsterDex, craftStats, chestStats, potionDex, duelStats, cardColl };
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    const immersivePhases = new Set(["battle_intro", "battle", "monster_die", "loot", "result"]);
    onImmersiveChange?.(immersivePhases.has(phase));
    return () => onImmersiveChange?.(false);
  }, [phase, onImmersiveChange]);

  // 讀取今日已有箭數（用於里程碑計算）

  // 進場動畫：50ms 後播音效（確保動畫已渲染），2.5 秒後自動進入戰鬥
  useEffect(() => {
    if (phase !== "battle_intro") return;
    const sfxTimer = setTimeout(() => playBattleSound("battle_intro", { monsterName: monster?.name, playerName: profile?.name }), 50);
    const t = setTimeout(() => setPhase("battle"), 2500);
    return () => { clearTimeout(sfxTimer); clearTimeout(t); };
  }, [phase]);

  // 擊倒動畫：3 秒後自動進入戰利品
  useEffect(() => {
    if (phase !== "monster_die") return;
    const t = setTimeout(() => setPhase("loot"), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  // 進入戰利品畫面：播放凱旋音效
  useEffect(() => {
    if (phase !== "loot") return;
    const t = setTimeout(() => playBattleSound("victory_fanfare", { monsterName: monster?.name, round, roundDmg: totalDmgDealt }), 80);
    return () => clearTimeout(t);
  }, [phase]);

  // 進入戰鬥時解鎖 AudioContext（讓後續音效正常播放）
  useEffect(() => {
    if (phase !== "battle") return;
    unlockAudio();
  }, [phase]);

  // 任務完成後 3 秒自動返回公會
  const questCompletedRef = useRef(false);
  useEffect(() => {
    if (!questContext?.completed || phase !== "loot") return;
    if (questCompletedRef.current) return;
    questCompletedRef.current = true;
    const t = setTimeout(() => { if (onBack) onBack(); }, 3000);
    return () => clearTimeout(t);
  }, [questContext?.completed, phase]); // eslint-disable-line

  // 怪物死亡／戰敗後 15 秒自動返回（非任務模式）
  const autoReturnTimerRef = useRef(null);
  useEffect(() => {
    if (phase !== "loot" && phase !== "result") return;
    if (questContext?.completed) return; // 任務模式已有 3 秒返回
    autoReturnTimerRef.current = setTimeout(() => {
      if (onBack) onBack();
    }, 15000);
    return () => {
      if (autoReturnTimerRef.current) clearTimeout(autoReturnTimerRef.current);
    };
  }, [phase]); // eslint-disable-line

  // 任務模式：archerStats 就緒後直接跳到 prebattle，跳過選怪
  const questInitDone = useRef(false);
  useEffect(() => {
    if (questInitDone.current) return;
    if (!questContext?.monsterId || !archerStats) return;
    // 若還在選出戰外觀且未設定，讓玩家先選完再說
    if (phase === "archer_select" && !archerStyle) return;
    const target = MONSTERS.find(m => m.id === questContext.monsterId);
    if (!target) return;
    questInitDone.current = true;
    setPickedMonster(target);
    setMonster(target);
    setBattleBg(pickBg(target.family));
    setPhase("prebattle");
  }, [questContext?.monsterId, archerStats, phase, archerStyle]); // eslint-disable-line

  // ✅ 戰鬥進行中自動存檔，防止頁面重載後遺失進度
  useEffect(() => {
    if (isGuest) return;
    if (phase === "loot" || phase === "result" || phase === "select") {
      if (phase === "loot" || phase === "result") sessionStorage.removeItem("mb_battle_save");
      pendingPotionRef.current = []; // 離開戰鬥時清空未寫的藥水
      return;
    }
    if (phase !== "battle") return;
    const save = {
      ts: Date.now(),
      monster, mode, battleMode, monsterHP, archerHP,
      round, roundScores, selectedDistance, distanceMode, battleStats,
      activeCarryBuffs, potionShield, monsterDmgTakenPct, counterReducePct, poisonEffect,
      log: log.slice(-8),
    };
    try { sessionStorage.setItem("mb_battle_save", JSON.stringify(save)); } catch {}
  }, [phase, monsterHP, archerHP, round]); // eslint-disable-line

  useEffect(() => {
    if (isGuest) {
      // 訪客/兒童共用同一組基礎數值——刻意不因 kidMode 拉高數值，
      // 因為 archerStats 會餵給 calcArcherPower 決定配對怪物階級，
      // 拉高數值反而會解鎖更強的 elite 怪物，讓兒童模式變得更難打（已驗證：65→121 戰力會跨過100門檻）。
      // 兒童模式的「更好打」改用 UI 簡化（大按鈕/簡短文字）與家長協戰達成，不動戰鬥數值。
      setArcherStats({ hp:100, atk:10, def:10 });
      setDailyLeft(null);
      return;
    }
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
    return () => { unsub && unsub(); unsubPotions && unsubPotions(); unsubEvent && unsubEvent(); };
  }, [profile?.id, isGuest]); // eslint-disable-line

  useEffect(() => {
    if (isGuest || !profile || !certRecords) return;
    const { monsterDex: mDex, craftStats: cSt, chestStats: chSt, potionDex: pDex, duelStats: dSt, cardColl: cColl } = extraDexRef.current;
    const ds = computeDexStats({ member:profile, certification, certRecords, checkinCount:profile?.dailyQuestCount||0, granted:dexGrants, physicalMax:dexConfig.physicalMax, pointMax:dexConfig.pointMax, monsterDex:mDex, craftStats:cSt, chestStats:chSt, potionDex:pDex, duelStats:dSt, cardData:cColl });
    const stats = calcArcherStats({ member:profile, certification, certRecords, dexStats:ds });
    setArcherStats(stats);
  }, [profile, certification, certRecords, dexGrants, isGuest]); // eslint-disable-line

  useEffect(() => {
    if (isGuest || !profile?.id) return;
    return subscribeCardCollection(profile.id, data => {
      setCardColl(data);
      cardCollRef.current = data;
    });
  }, [profile?.id, isGuest]); // eslint-disable-line

  // ✅ 射手數值就緒後，依戰力匹配6隻怪物
  useEffect(() => {
    if (!archerStats) return;
    const power = calcArcherPower(archerStats);
    const matched = drawMatchedMonsters(power);
    setMatchedMonsters(matched);
    // 只在選怪階段才重置選取；任務模式已由 questInitDone 鎖定，不能清空
    if (!questInitDone.current && (phaseRef.current === "select" || phaseRef.current === "event_select")) {
      setPickedMonster(null);
    }
  }, [archerStats]);

  // 記住最後選定的怪物（profile 更新時 pickedMonster 可能被清空，用 ref 保存以便再挑戰）
  useEffect(() => { if (pickedMonster) lastPickedRef.current = pickedMonster; }, [pickedMonster]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }, [log]);

  function delay(ms) { return new Promise(r=>setTimeout(r,ms)); }
  function addLog(type, text) {
    // 支援兩種呼叫格式：addLog({type, text}) 或 addLog(type, text)
    const entry = typeof type === 'object' ? type : { type, text };
    setLog(l=>[...l, entry]);
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

  // ⚡ 動畫派遣器 + 回合控制器（只在首次渲染時建立）
  const dispatchRef = useRef(null);
  const controllerRef = useRef(null);
  const randomEventResolveRef = useRef(null); // 等玩家確認隨機事件彈窗再繼續
  const sessionArrowsRef = useRef(0); // 本場 session 累積箭數（供跨回合里程碑計算）
  if (!dispatchRef.current) {
    dispatchRef.current = createDispatch(
      {
        shoot() { setAnimArcherShoot(true); setTimeout(()=>setAnimArcherShoot(false), 500); },
        hit(isCrit) {
          setAnimHit(true); setTimeout(()=>setAnimHit(false), 600);
          if (isCrit) { setAnimHitCrit(true); setTimeout(()=>setAnimHitCrit(false), 700); }
        },
        crit() { setAnimArcherCrit(true); setTimeout(()=>setAnimArcherCrit(false), 700); },
        miss() { setAnimArcherMiss(true); setTimeout(()=>setAnimArcherMiss(false), 600); },
        archerHit() { setAnimArcherHit(true); },
        monsterAttack(isCrit) { if (isCrit) setAnimMonsterCritAtk(true); else setAnimMonsterAttack(true); },
        monsterAttackReset() { setAnimMonsterAttack(false); setAnimMonsterCritAtk(false); setAnimArcherHit(false); },
        counterCrit() { setAnimCounterCrit(true); setTimeout(()=>setAnimCounterCrit(false), 900); },
      },
      { arrowHit: sfxArrowHit, critBoom: sfxCritBoom, organHit: sfxOrganHit, softFail: sfxSoftFail,
        counter: sfxCounter, counterCrit: sfxCounterCrit, revive: sfxRevive, roundEnd: sfxRoundEnd,
        buff: sfxBuff, debuff: sfxDebuff, cast: sfxCast },
      { floatDmg: showFloatDmg, floatCounterDmg: showFloatCounterDmg, archerEffect: showArcherEffect, vibrate },
      addLog, delay,
    );
  }
  if (!controllerRef.current) {
    controllerRef.current = new RoundController(dispatchRef.current);
  }
  const dispatch = dispatchRef.current;
  const controller = controllerRef.current;

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

  function inputArrow(label, landing) {
    if (arrows.length>=arrowsPerRound||processing) return;
    shootingProfileRef.current ||= loadBattleShootingProfile(profile?.id || "guest");
    sfxTap();
    setArrows(prev=>[...prev,label]);
    if (landing) {
      setBattleArrowPositions(prev=>[...prev, {
        ...landing,
        score:landing.label,
        round,
        arrow:arrows.length + 1,
      }]);
    }
  }
  function undoArrow() {
    if (!arrows.length||processing) return;
    const removedArrow = arrows.length;
    setArrows(prev=>prev.slice(0,-1));
    setBattleArrowPositions(prev=>prev.filter(position =>
      position.round !== round || position.arrow !== removedArrow
    ));
  }

  function handleTargetSubmit() {
    if (targetPending) return; // 防止重複觸發疊加多個 timeout
    setTargetPending(true);
    setTimeout(() => { setTargetPending(false); submitRound(); }, 2000);
  }
  // 🧪 使用攜帶型藥水（回合開始喝）
  function useCarryPotion(potion) {
    if (potionUsedThisRound || processing) return;
    if (!profile?.id || isGuest) return;
    const count = potionInv[potion.id] || 0;
    if (count <= 0) return;
    sfxPotionDrink();
    pendingPotionRef.current.push(potion.id); // 延後寫入，submitRound 時批次消耗
    setPotionInv(prev => ({ ...prev, [potion.id]: (prev[potion.id]||0) - 1 }));
    setActiveCarryBuffs(current => mergeCarryBuff(current, potion));
    if (potion.effect.hpPct) {
      const maxHP = (battleStats||archerStats)?.hp||100;
      const heal = Math.round(maxHP * potion.effect.hpPct / 100);
      setArcherHP(h => Math.min(maxHP, h + heal));
    }
    if (potion.effect.shieldPct) {
      const maxHP = (battleStats||archerStats)?.hp||100;
      setPotionShield(current => Math.max(current, Math.round(maxHP * potion.effect.shieldPct / 100)));
    }
    setUsedPotionThisRound({ icon:potion.icon, name:potion.name, effectText:potion.effectText });
    setPotionUsedThisRound(true);
    setBottomTab("score");
  }

  // 🎯 使用投擲道具（取代一箭）
  function useThrowPotion(potion) {
    if (potionUsedThisRound || processing) return;
    if (potion.actionCost === "arrow" && arrows.length >= arrowsPerRound) return;
    if (!profile?.id || isGuest) return;
    const count = potionInv[potion.id] || 0;
    if (count <= 0) return;
    sfxTap();
    pendingPotionRef.current.push(potion.id); // 延後寫入，submitRound 時批次消耗
    setPotionInv(prev => ({ ...prev, [potion.id]: (prev[potion.id]||0) - 1 }));
    if (potion.actionCost === "arrow") {
      setArrows(prev => [...prev, potion.id]);
    } else {
      const resolved = resolveConsumable(potion, {
        mode:"monster", playerAtk:(battleStats||archerStats)?.atk || 10,
        enemyHp:monsterHP, enemyMaxHp:monster?.hp || monsterHP,
        isBoss:["boss","mythic"].includes(monster?.tier),
      });
      const effect = resolved.effect || {};
      if (effect.monAtkPct) setMonster(current => ({ ...current, atk:Math.max(1, Math.round(current.atk * (1 - effect.monAtkPct / 100))) }));
      if (effect.monDefPct) setMonster(current => ({ ...current, def:Math.max(0, Math.round(current.def * (1 - effect.monDefPct / 100))) }));
      if (effect.teamDmgPct) setMonsterDmgTakenPct(current => Math.max(current, effect.teamDmgPct));
      if (effect.skipRound === "big" && !["boss","mythic"].includes(monster?.tier)) setSkipBigRound(true);
      if (effect.bossCounterReducePct && ["boss","mythic"].includes(monster?.tier)) setCounterReducePct(current => Math.min(70, Math.max(current, effect.bossCounterReducePct)));
      if (effect.counterReducePct) setCounterReducePct(current => Math.min(70, current + effect.counterReducePct));
    }
    setUsedPotionThisRound({ icon:potion.icon, name:potion.name, effectText:potion.effectText });
    setPotionUsedThisRound(true);
    setBottomTab("score");
  }

  async function submitRound() {
    if (arrows.length<arrowsPerRound||processing) return;
    setProcessing(true);
    setBattlePhase("processing");
    // 🧪 批次消耗擱置藥水
    const pendingPotions = pendingPotionRef.current;
    if (pendingPotions.length > 0) {
      pendingPotionRef.current = [];
      if (profile?.id && !isGuest) {
        usePotions(profile.id, pendingPotions).catch(()=>{});
        recordPotionUsed(profile.id, pendingPotions).catch(()=>{});
      }
    }
    // ── 立即更新終身箭數（每回合送出即計，不需報到）──────────────
    if (profile?.id && !isGuest) {
      addRoundArrows(profile.id, arrowsPerRound).catch(() => {});
    }

    try {
    const bSt = battleStats || archerStats;

    // ── 1. 建立引擎輸入 ─────────────────────────────────
    const roundConfig = { mode, battleMode, targetFmt, selectedDistance, distanceMode, arrowsPerRound };
    const consumableBuffs = calcPotionBuffs(Object.values(activeCarryBuffs).map(entry => entry.id));
    const roundCtx = {
      monster, archerStats: bSt,
      monsterHP, archerHP, distance, round,
      unlockedParts: new Set(unlockedParts),
      skipCounter, skipBigRound,
      headHitCount: 0, revived, archerATKMod,
      totalDmgDealt, totalDmgRecvd, critCount,
      consumableBuffs, potionShield, monsterDmgTakenPct, counterReducePct, poisonEffect,
    };
    const catCtx = hasCat ? {
      hasCat, catName,
      catCurrentHP: catCurrentHPRef.current,
      catMaxHP, catBaseDEF,
      catDefShield: catDefShieldRef.current,
      calcCatRoundDamage, triggerCatSkill,
    } : null;
    if (catCtx?.catDefShield) catDefShieldRef.current = null; // 引擎會消耗，同步清 ref

    // ── 2. 呼叫引擎 ─────────────────────────────────────
    let events, finalState;
    try {
      const result = processMonsterRound(roundConfig, roundCtx, arrows, catCtx);
      events = result.events;
      finalState = result.finalState;
    } catch (engineErr) {
      console.error('BattleEngine error:', engineErr);
      setArrows([]); setArcherATKMod(0); setRound(r=>r+1); setBattlePhase("input"); setProcessing(false);
      return;
    }
    if (catCtx) catCurrentHPRef.current = catCtx.catCurrentHP;

    // ── 3. 事件驅動 via RoundController ───────────────
    addLog({ type:"system", text:`── 第 ${round} 回合，距離 ${distance}米 ──` });
    await delay(400);

    const eventCtx = { monster, catName, bSt };

    const { battleEnded, battleResult } = await controller.playEvents(events, eventCtx, {
      // ── 狀態更新 handler ──────────────────────────────
      [EventType.ARROW_HIT]: (p) => {
        if (p.dmg>0) {
          setTotalDmgDealt(v=>v+p.dmg);
          setMonsterHP(prev => Math.max(0, prev - p.dmg));
        }
        if (p.score>=10) setCritCount(v=>v+1);
      },
      [EventType.ARROW_CRIT]: (p) => {
        if (p.dmg>0) {
          setTotalDmgDealt(v=>v+p.dmg);
          setMonsterHP(prev => Math.max(0, prev - p.dmg));
        }
        if (p.score>=10) setCritCount(v=>v+1);
      },
      [EventType.ARROW_ORGAN_HIT]: (p) => {
        if (p.dmg>0) {
          setTotalDmgDealt(v=>v+p.dmg);
          setMonsterHP(prev => Math.max(0, prev - p.dmg));
        }
        if (p.score>=10) setCritCount(v=>v+1);
      },
      [EventType.ARROW_THROW_POTION]: (p) => {
        const ee = p.extraEffects||{};
        if (ee.monAtkPct) setMonster(m=>({...m,atk:Math.max(1,Math.round((ee.oldAtk||m.atk)*(100-ee.monAtkPct)/100))}));
        if (ee.monDefPct) setMonster(m=>({...m,def:Math.max(0,Math.round((ee.oldDef||m.def)*(100-ee.monDefPct)/100))}));
        if (p.dmg>0) {
          setTotalDmgDealt(v=>v+p.dmg);
          setMonsterHP(prev => Math.max(0, prev - p.dmg));
        }
      },
      [EventType.COUNTER]: (p) => {
        if (p.dmg>0) {
          setTotalDmgRecvd(v=>v+p.dmg);
          setArcherHP(prev => Math.max(0, prev - p.dmg));
        }
      },
      [EventType.COUNTER_CRIT]: (p) => {
        if (p.dmg>0) {
          setTotalDmgRecvd(v=>v+p.dmg);
          setArcherHP(prev => Math.max(0, prev - p.dmg));
        }
      },
      [EventType.COUNTER_HEAD_STUNNED]: (p) => {
        if (p.dmg>0) {
          setTotalDmgRecvd(v=>v+p.dmg);
          setArcherHP(prev => Math.max(0, prev - p.dmg));
        }
      },
      [EventType.COUNTER_REDUCED]: (p) => {
        if (p.dmg>0) {
          setTotalDmgRecvd(v=>v+p.dmg);
          setArcherHP(prev => Math.max(0, prev - p.dmg));
        }
      },
      [EventType.RANDOM_EVENT]: (p) => { setCurrentEvent(p.event); setBattlePhase('event'); },
      [EventType.DISTANCE_CHANGE]: (p) => { setDistance(p.newDist); },
      [EventType.CAT_DEFEND]: (p) => { catDefShieldRef.current = { reduction: p.reduction, blockFull: p.blockFull }; },
      [EventType.CAT_HIT]: (p) => { setCatCurrentHP(catCtx?.catCurrentHP || 0); },
      [EventType.BATTLE_WIN]: (p) => {
        const roundArr = arrows.map(arrowLabelToVal);
        setAllArrows(prev=>[...prev,...roundArr]);
        setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundArr.reduce((s,v)=>s+v,0)}]);
      },
      [EventType.BATTLE_LOSE]: (p) => {
        const roundArr = arrows.map(arrowLabelToVal);
        setAllArrows(prev=>[...prev,...roundArr]);
        setRoundScores(prev=>[...prev,{round,scores:roundArr,total:roundArr.reduce((s,v)=>s+v,0)}]);
      },
      onRandomEventEnd: () => new Promise(resolve => {
        // 把 resolve 存起來，讓玩家點「確認」後才繼續後續事件
        randomEventResolveRef.current = resolve;
      }),
    });
    const battleResultStr = battleResult === EventType.BATTLE_WIN ? 'win' : 'lose';

    // ── 4. 套用最終狀態 ─────────────────────────────────
    setMonsterHP(finalState.monsterHP);
    setArcherHP(finalState.archerHP);
    setDistance(finalState.distance);
    setUnlockedParts(finalState.unlockedParts);
    setSkipCounter(finalState.skipCounter);
    setSkipBigRound(finalState.skipBigRound);
    setRevived(finalState.revived);
    setArcherATKMod(finalState.archerATKMod);
    setPotionShield(finalState.potionShield || 0);
    setCounterReducePct(0);
    setPoisonEffect(finalState.poisonEffect || null);
    setTotalDmgDealt(finalState.totalDmgDealt);
    setTotalDmgRecvd(finalState.totalDmgRecvd);
    setCritCount(finalState.critCount);
    if (catCtx) setCatCurrentHP(catCtx.catCurrentHP);

    if (battleEnded) {
      const roundArr = arrows.map(arrowLabelToVal);
      await endBattle(battleResultStr, finalState.archerHP, finalState.monsterHP, roundArr);
      setProcessing(false);
      return;
    }

    // ── 5. 下一回合準備 ─────────────────────────────────
    // 累積非最終回合的分數（讓 endBattle 的 practiceRounds 包含所有回合）
    const midRoundArr = arrows.map(arrowLabelToVal);
    setRoundScores(prev => [...prev, { round, scores: midRoundArr, total: midRoundArr.reduce((s,v)=>s+v,0) }]);
    await delay(500);
    setArrows([]); setArcherATKMod(0); setRound(r=>r+1); setBattlePhase("input"); setProcessing(false);
    } catch(err) {
      setCurrentEvent(null);
      setSkipCounter(false);
      setArcherATKMod(0);
      setBattlePhase("input");
      setProcessing(false);
    }
  }

  function restoreBattle(s) {
    setMonster(s.monster);
    setBattleBg(pickBg(s.monster?.family));
    setMode(s.mode || "novice");
    setBattleMode(s.battleMode || "score");
    setMonsterHP(s.monsterHP);
    setArcherHP(s.archerHP);
    setRound(s.round || 1);
    setRoundScores(s.roundScores || []);
    setActiveCarryBuffs(s.activeCarryBuffs || {});
    setPotionShield(s.potionShield || 0);
    setMonsterDmgTakenPct(s.monsterDmgTakenPct || 0);
    setCounterReducePct(s.counterReducePct || 0);
    setPoisonEffect(s.poisonEffect || null);
    setSelectedDistance(s.selectedDistance || 15);
    setDistanceMode(s.distanceMode || "fixed");
    if (s.battleStats) setBattleStats(s.battleStats);
    setLog(s.log || [{ type:"system", text:"⚔️ 戰鬥已從中斷點恢復！繼續作戰！" }]);
    setArrows([]); setBattlePhase("input"); setProcessing(false);
    setPotionUsedThisRound(false); setUsedPotionThisRound(null);
    setBottomTab("score"); setScoringModeChosen(false);
    pendingPotionRef.current = []; // 恢復戰鬥時清空未寫的藥水
    setPhase("battle");
    sessionStorage.removeItem("mb_battle_save");
    setShowRestorePrompt(false);
  }

  async function startBattle() {
    // 記錄每日場次改成「背景執行、不 await」：這是一次 Firestore 寫入，網路偶爾很慢時
    // 若 await 會把後面的進場（setPhase("battle_intro")）一起卡住，造成「按了開始挑戰卻無法進場」。
    // 場次上限的檢查在按鈕出現前就做過了，這裡只是記錄，不需要擋住進場。
    if (profile?.id && !questContext) { recordMonsterSession(profile.id).catch(()=>{}); setDailyLeft(l=>Math.max(0,(l||1)-1)); }

    // ⚗️ 戰前喝藥：消耗藥劑、計算本場加成（只影響當場）
    const buffs = calcPotionBuffs(selectedPotions);
    // 老手模式：解除加成最低限制（敵方可被削弱至 0）
    if (mode==="veteran") {
      buffs.monAtkMult = Math.max(0, buffs.monAtkMult);
      buffs.monDefMult = Math.max(0, buffs.monDefMult);
    }
    // 戰前藥水已移至 BattleBottomBar 回合中消耗，此處不再使用
    const baseStats = { ...(archerStats || { hp:200, atk:10, def:10 }) };
    if (mode==="veteran") baseStats.hp = Math.max(600, baseStats.hp);
    // 怪物卡片裝備加成（優先用 ref 避免 closure stale 問題）
    const cardData = cardCollRef.current?.equipped ? cardCollRef.current : cardColl;
    const cardBonus = calcEquippedBonus(resolveEquippedCards(cardData));
    // 射手等級加成
    const lvBon = isGuest ? { hp:0, atk:0, def:0 } : archerLevelBonus(archerLevelFromXP(profile?.archerXP||0));
    const bStats = {
      hp:  Math.round((baseStats.hp  + cardBonus.hp  + lvBon.hp)  * buffs.hpMult),
      atk: Math.round((baseStats.atk + cardBonus.atk + lvBon.atk) * buffs.atkMult),
      def: baseStats.def + cardBonus.def + lvBon.def,
    };
    setBattleStats(bStats);
    setActiveCarryBuffs({});
    setPotionShield(0);
    setMonsterDmgTakenPct(0);
    setCounterReducePct(0);
    setPoisonEffect(null);
    // 投擲型藥劑：立即對怪物扣血＋麻痺效果（開戰前）
    let throwDmgTotal = 0;
    let throwSkip = null;
    buffs.throwEffects.forEach(te => {
      throwDmgTotal += te.dmg || 0;
      if (te.skipRound) throwSkip = te.skipRound;
    });
    if (throwSkip === "big") setSkipBigRound(true);

    // 怪物倍率：新手/學生HP×1；老手/賽事HP×1.5+ATK×1.25+DEF×1.25
    const modeHPMult  = (mode==="veteran" || mode==="match") ? 1.5 : 1.0;
    const modeATKMult = (mode==="veteran" || mode==="match") ? 1.25 : 1;
    const modeDEFMult = (mode==="veteran" || mode==="match") ? 1.25 : 1;
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
    // 貓貓 HP 重置
    if (hasCat) { catCurrentHPRef.current = catMaxHP; setCatCurrentHP(catMaxHP); }
    const initDist = distanceMode==="dynamic" ? DISTANCE_START : selectedDistance;
    setRound(1); setDistance(initDist);
    setAllArrows([]); setRoundScores([]); setBattleArrowPositions([]); sessionArrowsRef.current = 0;
    shootingProfileRef.current = null;
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
    setTotalDmgDealt(0); setTotalDmgRecvd(0); setCritCount(0); setDroppedMaterials([]);
    setBottomTab("score");
    setPotionUsedThisRound(false);
    setUsedPotionThisRound(null);
    setScoringModeChosen(false);
    setPhase("battle_intro");
  }

  async function endBattle(result, finalArchHP, finalMonHP, lastRoundArr = null) {
    try {
    const shootingProfile = shootingProfileRef.current
      || loadBattleShootingProfile(profile?.id || "guest");
    const completedRoundScores = lastRoundArr
      ? [...roundScores, { scores:lastRoundArr }]
      : roundScores;
    const completedPracticeRounds = completedRoundScores.map(entry => entry.scores || []);
    const completedScoresFlat = completedPracticeRounds.flat();
    const completedScoreTotal = completedScoresFlat.reduce((sum, score) => sum + Number(score || 0), 0);
    const completedArrowCount = completedScoresFlat.length;
    if (isGuest && profile?.id) {
      recordGuestBattleStats(profile.id, {
        mode: "monster",
        result,
        arrows: completedArrowCount,
        score: completedScoreTotal,
        damage: totalDmgDealt,
        target: monster?.name || "怪物",
      }).catch(() => {});
    }
    if (result==="win") {
      playBattleSound("monster_death", { monsterName: monster?.name });
      setTimeout(() => playBattleSound("victory_cheer", {}), 600);

      // ── 寶箱（固定必掉）────────────────────────────────
      const { mainChest, potionChest } = makeChests(monster, mode);
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

        const mats = rollMaterialDrops(monster)
          .filter(m => !m.id?.startsWith("frag_"))
          .slice(0, 1);
        setDroppedMaterials(mats);
        if (profile?.id && mats.length > 0) {
          addMaterials(profile.id, mats).catch(() => {});
        }

        const baseCoins = rollCoins(monster.tier, mode);
        const boost = parseFloat(sessionStorage.getItem("guest_coin_boost") || "1");
        const total = Math.max(1, Math.round(baseCoins * boost));
        sessionStorage.removeItem("guest_coin_boost");
        setDroppedCoins(total);
        if (profile?.id) {
          addCoins(profile.id, total).catch(() => {});
        } else {
          const prev = parseInt(sessionStorage.getItem("guest_coins") || "0", 10);
          sessionStorage.setItem("guest_coins", String(prev + total));
        }
      } else {
        // 一般射手：先算好所有寶箱，再一次 addChests（避免兩次 getDoc+setDoc 競態）
        const mainChests = [mainChest, potionChest].filter(Boolean);
        setWonChests(mainChests);

        // 材料掉落（新手機率；學生/老手/賽事保證掉落；老手/賽事x2）
        const matMult = (mode==="veteran" || mode==="match") ? 2 : 1;
        const mats = (mode==="novice"
          ? rollMaterialDrops(monster)
          : rollMaterialDropsGuaranteed(monster, matMult)
        ).filter(m => !m.id?.startsWith("frag_"));
        setDroppedMaterials(mats);
        if (mats.length > 0) {
          addMaterials(profile.id, mats).catch(() => {});
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
          // 金幣寶箱：依模式機率決定是否掉落
          const coinChestChance = COIN_CHEST_CHANCE_BY_MODE[mode] ?? 0.5;
          const coinChest = Math.random() < coinChestChance ? makeCoinChest(monster.tier, "打怪掉落") : null;
          setDroppedCoins(baseCoins);
          if (coinChest) setDroppedCoinChest(coinChest);
          addCoins(profile.id, baseCoins).catch(() => {});
          addChests(profile.id, [...mainChests, ...(coinChest ? [coinChest] : [])]).catch(() => {});
        }

        // 怪物卡片（固定 20%，不依模式）
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
        const practiceRounds = completedPracticeRounds;
        if (profile?.id) {
          const todayStr = new Date().toISOString().slice(0, 10);
          addPracticeLog(profile.id, {
            date: todayStr, source: "monster",
            monsterName: monster.name, monsterTier:monster.tier, mode, battleMode, result,
            equipment: bowLabel, rounds: practiceRounds,
            total: practiceRounds.flat().reduce((s, v) => s + v, 0),
            totalArrows: practiceRounds.flat().length,
            bowType:shootingProfile.bowType,
            distance:shootingProfile.distance,
            battleDistance:selectedDistance,
            targetFormat:targetFmt,
            inputMode:targetMode ? "target" : "button",
            ...(battleArrowPositions.length ? { arrowPositions:battleArrowPositions } : {}),
          }, profile.id).catch(() => {});

          // 里程碑即時提示（使用統一函式查詢今日實際累計箭數）
          const arrowCount = practiceRounds.flat().length;
          if (arrowCount > 0) {
            const { checkAndGrantArrowMilestones } = await import("../../lib/db");
            checkAndGrantArrowMilestones(profile.id, arrowCount).then(res => {
              if (res.milestones.length > 0) {
                setMilestoneQueue(res.milestones.map(ms => ({ ms, rewards: getRewardsForMilestone(ms) })));
              }
            }).catch(() => {});
          }
        }
      }

      addLog({ type:"win",    text:`🏆 擊倒 ${monster.name}！激烈的戰鬥結束——你贏了！` });
      if (!isGuest) {
        addLog({ type:"system", text:`${chestCfg.icon} 獲得「${chestCfg.name}」！已放進背包` });
        if (potionChest) addLog({ type:"event_good", text:`🧪 幸運！額外獲得「藥水箱」！` });
      }

      if (profile?.id) {
        saveMonsterLog(profile.id, {
          monsterName:monster.name, monsterId:monster.id, result:"win", rounds:round,
          mode, battleMode, chestType:mainChest.type, roundScores:completedRoundScores,
          bowType:shootingProfile.bowType,
          distance:shootingProfile.distance,
          battleDistance:selectedDistance,
          targetFmt,
          ...(battleArrowPositions.length ? { arrowPositions:battleArrowPositions } : {}),
        }).catch(() => {});
      }

      if (!isGuest) {
        saveBond("monster");
        saveXP(CAT_TIER_XP[monster.tier] || 5).catch(() => {});
      }
      // 經驗值：射手（主要）+ 貓貓；冒險者 XP 已取消（改由世界王/公會任務取得）
      if (!isGuest && profile?.id) {
        // 射手等級 XP
        const archerXP = MONSTER_TIER_XP[monster.tier] || 5;
        setGainedArcherXP(archerXP);
        addArcherXP(profile.id, archerXP).catch(() => {});
        // 貓貓 XP
        const catXP = hasCat ? (CAT_TIER_XP[monster.tier] || 5) : 0;
        setGainedCatXP(catXP);
      }
      // 任務擊殺回報
      if (questContext?.monsterId === monster.id && onKillForQuest) onKillForQuest(monster.id);
      await delay(600); setPhase("monster_die");
    } else {
      playBattleSound("soft_fail", { monsterName: monster?.name, playerName: profile?.name, round });
      addLog({ type:"lose", text:`💀 不…被 ${monster.name} 擊倒了！世界漸漸變黑…下次一定要贏…！` });
      if (profile?.id) {
        if (!isGuest && completedPracticeRounds.length > 0) {
          addPracticeLog(profile.id, {
            date:new Date().toISOString().slice(0, 10),
            source:"monster",
            monsterName:monster.name,
            monsterTier:monster.tier,
            mode,
            battleMode,
            result:"lose",
            bowType:shootingProfile.bowType,
            distance:shootingProfile.distance,
            battleDistance:selectedDistance,
            rounds:completedPracticeRounds,
            total:completedPracticeRounds.flat().reduce((sum, score) => sum + score, 0),
            totalArrows:completedPracticeRounds.flat().length,
            targetFormat:targetFmt,
            inputMode:battleArrowPositions.length ? "target" : "button",
            ...(battleArrowPositions.length ? { arrowPositions:battleArrowPositions } : {}),
          }, profile.id).catch(() => {});
        }
        saveMonsterLog(profile.id, {
          monsterName:monster.name, monsterId:monster.id, result:"lose", rounds:round,
          mode, battleMode, materials:[], roundScores:completedRoundScores,
          bowType:shootingProfile.bowType,
          distance:shootingProfile.distance,
          battleDistance:selectedDistance,
          targetFmt,
          ...(battleArrowPositions.length ? { arrowPositions:battleArrowPositions } : {}),
        }).catch(() => {});
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
    // 任務模式：直接顯示過渡畫面，等 useEffect 設完 monster 跳 prebattle
    if (questContext?.monsterId) {
      const qMon = MONSTERS.find(m => m.id === questContext.monsterId);
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 p-8">
          <style>{BATTLE_CSS}</style>
          <div style={{ animation:"mb-bounce 1.2s ease infinite", fontSize: 64 }}>{qMon?.icon || "⚔️"}</div>
          <div className="text-white font-black text-2xl">{qMon?.name || "目標怪物"}</div>
          <div className="text-slate-400 text-sm">任務：{questContext.title}</div>
          <div className="text-purple-300 text-xs mt-2">準備進入戰鬥…</div>
        </div>
      );
    }
    const power = archerStats ? calcArcherPower(archerStats) : 0;
    const qMon = null;
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
          </div>
        </div>

        {/* 射手戰力卡 */}
        <div className="rounded-2xl p-4 text-white" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs tracking-widest text-purple-200 font-black">⚔️ 打怪模式</div>
            <div className="flex items-center gap-2 text-xs text-purple-200">
              {!isGuest && <span style={{ color:"#f9a8d4", fontWeight:900 }}>⚔️ Lv.{archerLevelFromXP(profile?.archerXP||0)}</span>}
              <span>戰力 <span className="font-black text-white text-sm">{power}</span></span>
            </div>
          </div>
          {archerStats && (
            <div className="flex gap-2 text-xs flex-wrap">
              {(() => {
                const lvBonus = isGuest ? { hp:0, atk:0, def:0 } : archerLevelBonus(archerLevelFromXP(profile?.archerXP||0));
                const cardBonus = isGuest ? { hp:0, atk:0, def:0 } : calcEquippedBonus(resolveEquippedCards(cardColl));
                return (
                  <>
                    <span className="bg-white/15 px-2 py-0.5 rounded-full">❤️ {archerStats.hp + lvBonus.hp + cardBonus.hp}</span>
                    <span className="bg-white/15 px-2 py-0.5 rounded-full">⚔️ {archerStats.atk + lvBonus.atk + cardBonus.atk}</span>
                    <span className="bg-white/15 px-2 py-0.5 rounded-full">🛡️ {archerStats.def + lvBonus.def + cardBonus.def}</span>
                    {!isGuest && (cardBonus.hp + cardBonus.atk + cardBonus.def) > 0 && (
                      <span className="bg-purple-500/30 px-2 py-0.5 rounded-full text-purple-200">🃏 卡牌+{cardBonus.hp+cardBonus.atk+cardBonus.def}</span>
                    )}
                  </>
                );
              })()}
              {!isGuest && dailyLeft!==null && (
                <span className={`px-2 py-0.5 rounded-full font-bold ${dailyLeft>0?"bg-emerald-500/80":"bg-red-500/80"} text-white`}>
                  今日剩 {dailyLeft}/{dailyMax} 次
                </span>
              )}
              {isGuest && <span className="bg-amber-500/80 px-2 py-0.5 rounded-full font-bold text-white">⭐ 體驗</span>}
            </div>
          )}
        </div>

        {/* 計分設定 */}
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"12px 14px", display:"flex", flexDirection:"column", gap:12 }}>
          <BattleShootingProfile memberId={profile?.id || "guest"} />
          <TargetFmtPicker value={targetFmt} onChange={v => { setTargetFmt(v); setBattleTargetFmt(v); }} />
          <InputModePicker value={targetMode ? "target" : "button"} onChange={v => { const t = v === "target"; setTargetMode(t); setBattleInputMode(v); }} />
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
                    {/* 難度標籤：弱化/普通/強悍 */}
                    {m.variant && (
                      <div className="absolute top-10 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: m.variant === 'weak' ? 'rgba(34,197,94,0.25)' : m.variant === 'strong' ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)',
                          color: m.variant === 'weak' ? '#22c55e' : m.variant === 'strong' ? '#ef4444' : '#eab308',
                        }}>
                        {m.variant === 'weak' ? '🟢 弱化' : m.variant === 'strong' ? '🔴 強悍' : '🟡 普通'}
                      </div>
                    )}
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

            {pickedMonster && (() => {
              const defs = loadMbDefaults();
              const modeLabel = mode==="veteran"?"🟠老手":mode==="student"?"🎓學生":"🟢新手";
              const bmLabel   = battleMode==="zombie"?"🧟殭屍":"🎯分數";
              const distLabel = distanceMode==="dynamic"?"🏃動態":distanceMode==="random"?`🎲${selectedDistance}m`:`📍${selectedDistance}m`;
              return (
                <>
                  {defs && (
                    <div className="flex flex-col gap-1.5 -mb-1">
                      {/* 預設模式摘要 */}
                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 flex-wrap">
                        <span className="bg-white/8 px-2 py-0.5 rounded-full">{modeLabel}</span>
                        <span className="bg-white/8 px-2 py-0.5 rounded-full">{bmLabel}靶</span>
                        <span className="bg-white/8 px-2 py-0.5 rounded-full">{distLabel}</span>
                        <button onClick={()=>{ setMonster(pickedMonster); setBattleBg(pickBg(pickedMonster.family)); setPhase("mode"); }}
                          className="text-purple-300 font-bold underline underline-offset-2">更改設定</button>
                      </div>
                      {/* 3/6箭 快速切換（讓射手每次可直接改，不需進更改設定） */}
                      <div className="flex gap-2 px-1">
                        {[3, 6].map(n => (
                          <button key={n}
                            onClick={() => {
                              setArrowsPerRound(n);
                              const cur = loadMbDefaults() || {};
                              saveMbDefaults({ ...cur, arrowsPerRound: n });
                            }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-black border transition-all ${
                              arrowsPerRound === n
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white/8 text-slate-400 border-white/15"
                            }`}>
                            🏹 {n} 箭 / 回合
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={()=>{ setMonster(pickedMonster); setBattleBg(pickBg(pickedMonster.family)); setPhase(defs ? "prebattle" : "mode"); }}
                    className="w-full py-4 rounded-2xl font-black text-lg text-white"
                    style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)", animation:"mb-glow 2s ease infinite" }}>
                    ⚔️ 挑戰 {pickedMonster.name}！
                  </button>
                </>
              );
            })()}

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
          <button onClick={() => { setMonster(pickedMonster); setBattleBg(pickBg(pickedMonster.family)); setPhase("prebattle"); }}
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
        <button onClick={()=>{ setMode("novice"); localStorage.setItem("mb_default_mode","novice"); setDistanceMode("fixed"); setSelectedDistance(5); setPhase("distance"); }}
          className="rounded-2xl p-5 text-left border-2 border-green-500/40 bg-green-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🟢 新手模式</div>
          <div className="font-black text-white mb-1">固定距離 5 / 7 / 10 米，無爆擊，無限復活</div>
          <div className="text-slate-400 text-sm">怪物 HP×1，使用含卡片加成的射手數值。</div>
          <div className="text-green-400 text-xs font-bold mt-2">💰 金幣×1 / 材料機率掉落 / 卡片10% / 金幣寶箱20%</div>
        </button>
        <button onClick={()=>{ setMode("student"); localStorage.setItem("mb_default_mode","student"); setDistanceMode("fixed"); setSelectedDistance(5); setPhase("distance"); }}
          className="rounded-2xl p-5 text-left border-2 border-blue-500/40 bg-blue-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🎓 學生模式</div>
          <div className="font-black text-white mb-1">自選距離，含爆擊（距離越近越高），一次復活</div>
          <div className="text-slate-400 text-sm">怪物 HP×1，使用含卡片加成的射手數值。30% HP 復活一次。</div>
          <div className="text-blue-400 text-xs font-bold mt-2">💰 金幣×2 / 材料必掉×1 / 卡片15% / 金幣寶箱50%</div>
        </button>
        <button onClick={()=>{ setMode("veteran"); localStorage.setItem("mb_default_mode","veteran"); setDistanceMode("dynamic"); setSelectedDistance(DISTANCE_START); setPhase("distance"); }}
          className="rounded-2xl p-5 text-left border-2 border-orange-500/40 bg-orange-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🟠 老手模式</div>
          <div className="font-black text-white mb-1">怪物增強，射手最低 600 HP，加成無上限，死亡不復活</div>
          <div className="text-slate-400 text-sm">怪物 HP×1.5、ATK×1.25、DEF×1.25。固定、隨機、或動態距離。</div>
          <div className="text-orange-400 text-xs font-bold mt-2">💰 金幣×3 / 材料必掉×2 / 卡片20% / 金幣寶箱必出 / 雙寶箱</div>
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

        {/* 每回合箭數 */}
        <div>
          <div className="text-sm text-slate-400 font-bold mb-2">每回合箭數</div>
          <div className="flex gap-3">
            {[3, 6].map(n => (
              <button key={n} onClick={() => setArrowsPerRound(n)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${
                  arrowsPerRound === n
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white/10 text-slate-300 border-white/20"
                }`}>
                {n} 箭 / 回合
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => {
          saveMbDefaults({ battleMode, mode, distanceMode, selectedDistance, arrowsPerRound });
          setPhase("prebattle");
        }}
          className="w-full py-3 bg-blue-600 text-white font-black rounded-xl text-base active:scale-95 transition-transform">
          確認 → 選擇藥水
        </button>
      </div>
    );
  }

  if (phase==="prebattle") {
    if (!pickedMonster) return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <style>{BATTLE_CSS}</style>
        <div className="text-slate-400">載入中…</div>
      </div>
    );
    const tier   = TIER_LABEL[pickedMonster.tier] || {};
    const family = FAMILIES[pickedMonster.family] || {};
    const previewHPMult = (mode==="veteran" || mode==="match") ? 1.5 : 1.0;
    const previewHP  = Math.round(pickedMonster.hp  * previewHPMult);
    const previewATK = (mode==="veteran" || mode==="match") ? Math.round(pickedMonster.atk * 1.25) : pickedMonster.atk;
    const previewDEF = (mode==="veteran" || mode==="match") ? Math.round(pickedMonster.def * 1.25) : pickedMonster.def;
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => setPhase(eventMode ? "event_select" : loadMbDefaults() ? "select" : "distance")} className="text-slate-400 text-sm self-start">← 返回</button>
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
            {mode==="veteran"?"⚔️ 老手・起始15米":mode==="student"?`🎓 學生・${distanceMode==="dynamic"?"動態15m起":`固定${selectedDistance}米`}`:`🟢 新手・固定${selectedDistance}米`}　🏹 {arrowsPerRound}箭／回合
          </div>

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
          <button onClick={startBattle} className={`w-full rounded-2xl font-black ${kidMode ? "py-6 text-2xl" : "py-4 text-lg"}`}
            style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>
            {kidMode ? "⚔️ 出發打怪！" : "⚔️ 開始挑戰！"}
          </button>
        </div>
      </div>
    );
  }

  if (phase==="battle_intro") {
    const catId = archerStyle || (profile?.equippedCat?.catId) || CAT_IDS[0];
    return (
      <div style={{
        position:"fixed", top:0, bottom:0,
        left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:540,
        overflow:"hidden", zIndex:9999,
        background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      }}>
        <style>{BATTLE_CSS}</style>
        {/* VS 對決畫面 */}
        <div style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-around", padding:"0 16px" }}>
          {/* 射手 - 從左進場 */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, animation:"mb-intro-archer 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <img src={`/cats/archers/${catId}.webp`}
              alt="archer"
              style={{ width:100, height:100, objectFit:"contain", filter:"drop-shadow(0 0 16px #7c3aed)", outline:"none", border:"none", display:"block" }} />
            <div style={{ fontSize:13, fontWeight:700, color:"#c4b5fd", textShadow:"0 0 8px #7c3aed" }}>
              {profile?.name || "射手"}
            </div>
          </div>

          {/* VS */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, animation:"mb-intro-vs 0.8s 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div style={{ fontSize:42, fontWeight:900, color:"#fbbf24", textShadow:"0 0 24px #f59e0b, 0 0 48px #f59e0b", letterSpacing:2 }}>VS</div>
          </div>

          {/* 怪物 - 從右進場 */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, animation:"mb-intro-monster 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div style={{ filter:"drop-shadow(0 0 16px #ef4444)" }}>
              <MonsterBattleImg id={monster?.id} icon={monster?.icon} size={100} />
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:"#fca5a5", textShadow:"0 0 8px #ef4444" }}>
              {monster?.name || "怪物"}
            </div>
          </div>
        </div>

        {/* 戰鬥開始！ */}
        <div style={{ marginTop:40, animation:"mb-intro-start 0.5s 1.2s cubic-bezier(0.34,1.56,0.64,1) both", opacity:0 }}>
          <div style={{ fontSize:28, fontWeight:900, color:"#fff", textShadow:"0 0 24px #fbbf24", letterSpacing:4, textAlign:"center" }}>
            ⚔️ 戰鬥開始！
          </div>
        </div>
      </div>
    );
  }

  if (phase==="monster_die") {
    return (
      <div style={{
        position:"fixed", top:0, bottom:0,
        left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:540,
        overflow:"hidden", zIndex:9999,
        background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24,
      }}>
        <style>{BATTLE_CSS}</style>
        {/* 怪物 + 擊倒印章 */}
        <div style={{ position:"relative", display:"inline-block" }}>
          <div style={{ animation:"mb-die-monster 1.5s ease-out both" }}>
            <MonsterBattleImg id={monster?.id} icon={monster?.icon} size={140} />
          </div>
          {/* 擊倒 印章 */}
          <div style={{
            position:"absolute", inset:0,
            display:"flex", alignItems:"center", justifyContent:"center",
            animation:"mb-die-badge 0.5s 0.5s cubic-bezier(0.34,1.56,0.64,1) both", opacity:0,
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
              擊倒
            </div>
          </div>
        </div>

        {/* 擊倒！文字 */}
        <div style={{ animation:"mb-die-victory 0.6s 0.8s cubic-bezier(0.34,1.56,0.64,1) both", opacity:0 }}>
          <div style={{ fontSize:36, fontWeight:900, color:"#fbbf24", textShadow:"0 0 32px #f59e0b", letterSpacing:4, textAlign:"center" }}>
            💀 擊倒！
          </div>
          <div style={{ fontSize:16, color:"#94a3b8", textAlign:"center", marginTop:4 }}>
            {monster?.name} 已被消滅
          </div>
        </div>

        {/* 戰績統計 */}
        <div style={{ animation:"mb-die-stats 0.5s 1.2s ease-out both", opacity:0, display:"flex", gap:20 }}>
          <BattleStatCard icon="⚔️" label="總傷害" value={totalDmgDealt} />
          <BattleStatCard icon="🔄" label="回合數" value={round - 1} />
        </div>
      </div>
    );
  }

  if (phase==="battle") {
    const maxHP = (battleStats||archerStats)?.hp||100;
    const archPct = Math.max(0, Math.round(archerHP/maxHP*100));
    const monPct  = monster ? Math.max(0, Math.round(monsterHP/monster.hp*100)) : 0;
    const total6  = arrows.reduce((s,v)=>s+arrowLabelToVal(v),0);
    const maxRoundScore = targetFmt === "field_16" ? 36 : 60;
    const monLv   = monster?.tier==="mythic"?99:monster?.tier==="boss"?75:monster?.tier==="fierce"?50:monster?.tier==="elite"?35:monster?.tier==="rare"?20:10;
    const catType = profile?.equippedCat?.type || "allround";
    const catGlowColor = catType === "healer" ? "#10b981" : catType === "attacker" ? "#ef4444" : "#a78bfa";
    const catGlowAnim = catMsg ? (catType === "healer" ? "mb-cat-glow-green 1.2s ease-in-out infinite" : catType === "attacker" ? "mb-cat-glow-red 1.2s ease-in-out infinite" : "mb-cat-glow-purple 1.2s ease-in-out infinite") : undefined;

    return (
      <div style={{
        position:"fixed", top:0, bottom:0,
        left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:540,
        // 小螢幕上底部輸入區＋送出鈕可能超出可視高度：改成 Y 軸可捲，確保一定捲得到「送出」
        // （修：訪客單人戰鬥輸入完分數畫面卡住、拉不到送出鈕）。X 軸維持 hidden 不讓橫向亂跑。
        overflowX:"hidden", overflowY:"auto", zIndex:9999,
        backgroundImage:`url(${battleBg})`,
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
          <BattleLogPanel variant="sidebar" open={logOpen} onClose={()=>setLogOpen(v=>!v)}>
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
          </BattleLogPanel>

          {/* 右：怪物展示 */}
          <div style={{flex:1, display:"flex", flexDirection:"column", minWidth:0, paddingTop:28}}>
            {/* 名稱列 */}
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:3, background:"rgba(0,0,0,0.55)", borderRadius:6, padding:"2px 6px"}}>
              <span style={{color:"white", fontWeight:900, fontSize:17, textShadow:"0 2px 8px #000"}}>{monster?.name}</span>
              <span style={{display:"inline-flex", alignItems:"center", gap:4}}><BattleSoundIndicator compact /><span style={{color:"#cbd5e1", fontSize:10, fontWeight:700}}>Lv.{monLv}</span></span>
            </div>

            {/* HP 條 */}
            <BattleHPBar current={monsterHP} max={monster?.hp || 0} />

            <BattleStatusTags tags={[
              { icon:"💀", label:`${round}回`, color:"#e2e8f0", bg:"rgba(0,0,0,0.55)" },
              { icon:"⚔️", label:monster?.atk, color:"#fca5a5", bg:"rgba(239,68,68,0.50)" },
              { icon:"🛡️", label:monster?.def, color:"#93c5fd", bg:"rgba(59,130,246,0.50)" },
              ...(distanceMode==="dynamic" ? [{ icon:"📍", label:`${distance}m`, color:"#fde68a", bg:"rgba(251,191,36,0.50)" }] : []),
            ]} />

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
                <span style={{color:"#f87171", fontSize:9, fontWeight:700}}>ATK {(battleStats||archerStats)?.atk||0}</span>
                <span style={{color:"#60a5fa", fontSize:9, fontWeight:700}}>DEF {(battleStats||archerStats)?.def||0}</span>
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
                {/* 貓貓 HP 條 */}
                {(() => {
                  const catPct = catMaxHP > 0 ? Math.max(0, catCurrentHP / catMaxHP) : 0;
                  const catClr = catPct > 0.5 ? "#f9a8d4" : catPct > 0.25 ? "#f59e0b" : "#ef4444";
                  return (
                    <div style={{ marginTop:3 }}>
                      <div style={{ height:4, borderRadius:3, background:"rgba(255,255,255,0.1)", overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:3, width:`${catPct*100}%`, background:catClr, transition:"width 0.4s ease" }} />
                      </div>
                      <div style={{ fontSize:8, color: catCurrentHP <= 0 ? "#ef4444" : "#f9a8d4aa", fontWeight:700, marginTop:1 }}>
                        {catCurrentHP <= 0 ? "💀" : `HP ${catCurrentHP}/${catMaxHP}`}
                      </div>
                    </div>
                  );
                })()}
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
        <div style={{
          flex:"0 0 auto",
          padding:"3px 6px max(8px, env(safe-area-inset-bottom))",
          background:"rgba(0,0,0,0.72)",
          borderTop:"1px solid rgba(255,255,255,0.08)",
        }}>

          {/* HP 危機 */}
          {archPct<=25 && battlePhase==="input" && (
            <div style={{
              textAlign:"center", fontSize:11, fontWeight:900, color:"#ef4444",
              marginBottom:4, animation:"mb-hp-danger 1s ease-in-out infinite",
              background:"rgba(239,68,68,0.12)", borderRadius:6, padding:"2px 0"
            }}>⚠️ 生命值危急！</div>
          )}

          {/* 事件卡（點擊確認後繼續後續動畫） */}
          {battlePhase==="event" && currentEvent && (
            <div style={{
              padding:"10px 12px", borderRadius:12, marginBottom:4, textAlign:"center",
              background:currentEvent.type==="buff"?"rgba(16,185,129,0.25)":currentEvent.type==="debuff"?"rgba(239,68,68,0.25)":"rgba(59,130,246,0.25)",
              border:`2px solid ${currentEvent.type==="buff"?"#10b981":currentEvent.type==="debuff"?"#ef4444":"#3b82f6"}`,
              animation:currentEvent.type==="buff"?"mb-event-buff .45s ease":"mb-event-debuff .45s ease",
              cursor:"pointer"
            }}
            onClick={() => {
              setCurrentEvent(null);
              setBattlePhase('processing');
              const resolve = randomEventResolveRef.current;
              randomEventResolveRef.current = null;
              resolve?.();
            }}>
              <div style={{fontSize:22, marginBottom:2}}>{currentEvent.icon}</div>
              <div style={{color:"white", fontWeight:900, fontSize:13}}>{currentEvent.title}</div>
              <div style={{color:"#cbd5e1", fontSize:10, marginTop:2, lineHeight:1.5}}>{currentEvent.desc}</div>
              <div style={{marginTop:6, fontSize:10, color: currentEvent.type==="buff"?"#6ee7b7":currentEvent.type==="debuff"?"#fca5a5":"#93c5fd", fontWeight:700}}>點擊繼續 ▶</div>
            </div>
          )}


          {/* 輸入階段 */}
          {battlePhase==="input" && (
            <>
              {/* 箭槽 + 模式切換 */}
              <BattleArrowSlots
                arrows={arrows}
                totalArrows={arrowsPerRound}
                onUndo={undoArrow}
                showUndo={arrows.length>0}
                slotSize={26}
                extraContent={
                  !scoringModeChosen ? (
                    <button onClick={()=>setTargetMode(m=>!m)} style={{
                      marginLeft:2, padding:"2px 7px", borderRadius:6, fontSize:11, fontWeight:700,
                      background: targetMode?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.07)",
                      border:`1px solid ${targetMode?"#22c55e":"rgba(255,255,255,0.15)"}`,
                      color: targetMode?"#4ade80":"rgba(255,255,255,0.4)", cursor:"pointer",
                    }}>🎯</button>
                  ) : null
                }
              />
              {/* targetPending 等待提示 */}
              {targetPending && (
                <div style={{ textAlign:"center", fontSize:12, color:"#a78bfa", fontWeight:700, marginBottom:4 }}>
                  計算中…⚔️
                </div>
              )}

              {/* 藥水效果提示 */}
              {usedPotionThisRound && (
                <div style={{
                  textAlign:"center", fontSize:11, fontWeight:900,
                  color:"#fbbf24", marginBottom:3,
                  background:"rgba(251,191,36,0.1)", borderRadius:6, padding:"3px 0",
                }}>
                  {usedPotionThisRound.icon} {usedPotionThisRound.name}：{usedPotionThisRound.effectText}
                </div>
              )}

              {/* 底部 Tab 系統 */}
              <BattleBottomBar
                bottomTab={bottomTab} setBottomTab={setBottomTab}
                potionSubTab={potionSubTab} setPotionSubTab={setPotionSubTab}
                potionUsedThisRound={potionUsedThisRound}
                scoringModeChosen={scoringModeChosen} setScoringModeChosen={setScoringModeChosen}
                targetMode={targetMode} setTargetMode={setTargetMode}
                arrows={arrows} onArrow={inputArrow}
                targetFmt={targetFmt}
                arrowsPerRound={arrowsPerRound}
                potionInv={potionInv}
                onCarryPotion={useCarryPotion}
                onThrowPotion={useThrowPotion}
              />
              <TargetFaceOverlay
                open={targetMode && !targetPending && !processing}
                fmtId={targetFmt}
                arrowLabels={arrows}
                arrowPositions={battleArrowPositions.filter(position => position.round === round)}
                arrowsPerRound={arrowsPerRound}
                onArrow={inputArrow}
                onUndo={undoArrow}
                onSubmit={handleTargetSubmit}
              />

              {/* TURN + 回合總分 + 送出 */}
              <div style={{
                display:"flex",
                gap:4,
                alignItems:"center",
                position:"sticky",
                bottom:0,
                zIndex:20,
                paddingTop:4,
                background:"linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,0.72) 18%)",
              }}>
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
                    {total6}<span style={{color:"#475569", fontSize:10, marginLeft:2}}>/{maxRoundScore}</span>
                  </span>
                </div>
                <button
                  onClick={submitRound}
                  disabled={arrows.length<arrowsPerRound||processing||targetPending}
                  style={{
                    flex:2, padding:"8px 0",
                    background:arrows.length>=arrowsPerRound&&!targetPending
                      ?"linear-gradient(90deg,#7c3aed,#2563eb)"
                      :"rgba(255,255,255,0.07)",
                    border:"1px solid rgba(255,255,255,0.1)",
                    borderRadius:8, color:"white",
                    fontWeight:900, fontSize:14, cursor:(arrows.length>=arrowsPerRound&&!processing&&!targetPending)?"pointer":"default",
                    opacity:(processing||targetPending)?0.5:(arrows.length<arrowsPerRound?0.3:1),
                    transition:"background .2s, opacity .2s"
                  }}
                >{(processing||targetPending)?"計算中…":"⚔️ 送出！"}</button>
              </div>
            </>
          )}
        </div>

      </div>
    );
  }

  if (phase==="loot") {
    const stats=calcStats(allArrows);
    const questDone = questContext?.completed === true;
    const qProgress = questContext
      ? { done: questContext.killsSoFar ?? 0, need: questContext.killsNeeded ?? 1 }
      : null;
    // 直接從 monster.tier 計算，避免 state 時序問題
    const lootArcherXP = !isGuest && monster?.tier ? (MONSTER_TIER_XP[monster.tier] || 5) : 0;
    const lootCatXP    = !isGuest && hasCat && monster?.tier ? (CAT_TIER_XP[monster.tier] || 5) : 0;
    const resultData = {
      monster: {
        id: monster?.id,
        name: monster?.name,
        icon: monster?.icon,
        tier: monster?.tier,
        family: monster?.family,
        variant: "normal",
        isDungeonBoss: false,
      },
      drops: {
        coins: droppedCoins,
        materials: droppedMaterials,
        chest: wonChests.some(ch => ch.type !== "coin_chest"),
        goldChest: !!droppedCoinChest,
        card: droppedCard,
        arrowDew: 0,
        specialItem: null,
      },
      stats: {
        dmgDealt:   totalDmgDealt,
        dmgTaken:   totalDmgRecvd,
        avgScore:   stats?.avg ?? 0,
        arrowCount: stats?.count ?? 0,
        roundCount: round,
        critCount,
        scoreBreakdown: Object.fromEntries(
          ["X", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, "M"].map(s => {
            const numVal = s === "X" ? 10 : s === "M" ? 0 : s;
            return [String(s), stats?.dist?.[numVal] || 0];
          }).filter(([, v]) => v > 0)
        ),
      },
    };
    return (
      <div className="p-4 flex flex-col gap-4 items-center bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>

        {milestoneQueue.length > 0 && (
          <ArrowMilestonePopup
            milestones={milestoneQueue.map(q => q.ms)}
            rewardsList={milestoneQueue.map(q => q.rewards)}
            onAllClose={() => setMilestoneQueue([])} />
        )}

        {/* ── 任務完成全幅通知 ── */}
        {questDone && (
          <div className="w-full rounded-2xl p-5 flex flex-col items-center gap-2 text-center"
            style={{ background:"linear-gradient(135deg,rgba(16,185,129,0.25),rgba(6,78,59,0.4))", border:"2px solid rgba(16,185,129,0.6)" }}>
            <div className="text-4xl" style={{ animation:"mb-bounce 0.8s ease infinite" }}>🎉</div>
            <div className="text-emerald-300 font-black text-xl">任務完成！</div>
            <div className="text-white/70 text-sm">「{questContext.title}」已達成</div>
            {questContext.badgeReward && (
              <div className="mt-1 px-3 py-1.5 rounded-xl text-xs font-black"
                style={{ background:"rgba(251,191,36,0.15)", border:"1px solid rgba(251,191,36,0.4)", color:"#fbbf24" }}>
                🎖️ 徽章申請已送出，等待教練審核
              </div>
            )}
            <div className="text-emerald-400/70 text-xs mt-1">3 秒後自動返回冒險者公會…</div>
          </div>
        )}

        {!questDone && (
          <div className="text-center mt-4">
            <div className="text-amber-400 font-black text-xl mb-1">🏆 擊倒 {monster?.name}！</div>
            <div className="text-slate-400 text-sm">第 {round} 回合完成</div>
          </div>
        )}

        {/* 任務進度條（未完成時顯示） */}
        {qProgress && !questDone && (
          <div className="w-full rounded-xl px-4 py-3 flex flex-col gap-1"
            style={{ background:"linear-gradient(90deg,rgba(99,102,241,0.2),rgba(59,130,246,0.15))", border:"1px solid rgba(99,102,241,0.4)" }}>
            <div className="flex justify-between items-center text-xs font-black">
              <span className="text-indigo-300">🎯 任務進度</span>
              <span className="text-white">{qProgress.done} / {qProgress.need} 次擊殺</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width:`${Math.min(100, qProgress.done/qProgress.need*100)}%` }}/>
            </div>
            <div className="text-xs text-indigo-300/70 text-center">
              還需擊殺 {qProgress.need - qProgress.done} 次
            </div>
          </div>
        )}
        {/* === 戰鬥統計 + 戰利品面板 === */}
        {!isGuest && (
          <BattleResultPanel data={resultData} config={RESULT_CONFIG_SOLO} />
        )}
        {/* 經驗值顯示（打怪勝利） */}
        {!isGuest && (gainedXP > 0 || lootArcherXP > 0 || lootCatXP > 0) && (
          <div className="w-full rounded-xl px-4 py-2.5 flex flex-col gap-1.5" style={{ background:"linear-gradient(90deg,rgba(124,58,237,0.15),rgba(37,99,235,0.1))", border:"1px solid rgba(124,58,237,0.3)" }}>
            <div className="text-[10px] text-purple-300 font-bold mb-0.5">✨ 獲得經驗值</div>
            {gainedXP > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-purple-300">⚔️ 冒險者 XP</span>
                <span className="text-white font-black text-sm">+{gainedXP}</span>
              </div>
            )}
            {lootArcherXP > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-300">🏹 射手等級 XP</span>
                <span className="text-white font-black text-sm">+{lootArcherXP}</span>
              </div>
            )}
            {lootCatXP > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-pink-300">🐱 貓貓 XP</span>
                <span className="text-white font-black text-sm">+{lootCatXP}</span>
              </div>
            )}
          </div>
        )}
        {isGuest && (droppedCoins > 0 || droppedMaterials.length > 0) && (
          <div className="w-full rounded-2xl p-4 flex flex-col gap-3"
            style={{ background:"linear-gradient(135deg,rgba(15,23,42,0.78),rgba(30,41,59,0.72))", border:"1px solid rgba(148,163,184,0.28)" }}>
            <div className="text-slate-200 font-black text-sm">🎒 本場獎勵已存入體驗角色</div>
            <div className="grid grid-cols-2 gap-2">
              {droppedCoins > 0 && (
                <div className="rounded-xl px-3 py-2 bg-amber-500/15 border border-amber-400/30">
                  <div className="text-[10px] text-amber-200 font-bold">金幣</div>
                  <div className="text-amber-300 font-black text-lg">+{droppedCoins}</div>
                </div>
              )}
              {droppedMaterials.map((mat, idx) => (
                <div key={`${mat.id}-${idx}`} className="rounded-xl px-3 py-2 bg-emerald-500/10 border border-emerald-400/25">
                  <div className="text-[10px] text-emerald-200 font-bold">材料</div>
                  <div className="text-emerald-100 font-black text-sm truncate">+1 {mat.name || mat.id}</div>
                </div>
              ))}
            </div>
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
          /* 射手掉落區：即時掉落已由 BattleResultPanel 顯示，此處只保留寶箱入背包 */
          wonChests.length > 0 ? (
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
          ) : null
        )}

        <button onClick={()=>setShowBattleCard(true)}
          className="w-full py-3 rounded-xl font-black text-white"
          style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)" }}>
          📤 產生戰績分享卡
        </button>
        <div className="flex gap-3 w-full">
          {questDone ? (
            // 任務完成：只顯示立即返回公會，禁止再挑戰
            <button onClick={onBack}
              className="flex-1 py-3 rounded-xl font-black text-white"
              style={{ background:"linear-gradient(90deg,#10b981,#059669)" }}>
              🏛️ 立即返回冒險者公會
            </button>
          ) : questContext ? (
            <>
              <button onClick={onBack} className="flex-1 py-3 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold">🏛️ 返回冒險者公會</button>
              <button onClick={()=>{ const m=lastPickedRef.current; if(m) setPickedMonster(m); setPhase("prebattle"); }}
                className="flex-1 py-3 rounded-xl font-black"
                style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
            </>
          ) : (
            <>
              <button onClick={()=>setPhase("select")} className="flex-1 py-3 rounded-xl bg-white/10 text-slate-300 font-bold">換對手</button>
              {(dailyLeft===null||dailyLeft>0)&&(
                <button onClick={()=>{ const m=lastPickedRef.current; if(m) setPickedMonster(m); setPhase("prebattle"); }}
                  className="flex-1 py-3 rounded-xl font-black"
                  style={{ background:"linear-gradient(90deg,#fbbf24,#f59e0b)", color:"#7c2d12" }}>再挑戰！</button>
              )}
            </>
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
            {questContext
              ? <button onClick={onBack} className="flex-1 py-3 rounded-xl bg-indigo-500/20 text-indigo-300 font-bold">🏛️ 返回冒險者公會</button>
              : <button onClick={()=>setPhase("select")} className="flex-1 py-3 rounded-xl bg-white/20 text-white font-bold">換對手</button>
            }
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

  return null;
}
