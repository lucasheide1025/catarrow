// src/components/member/MonsterBattle.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import CatMsg from "../cat/CatMsg";
import { useCatBuddyEvent } from "../cat/CatBuddyContext";
import {
  getCertRecords, getCertification, subscribeDexGrants, getDexConfig,
  createNotification, saveMonsterLog,
  getMonsterDailyConfig, subscribeMonsterEventConfig, checkMonsterDailyLimit, recordMonsterSession,
  addChests, subscribePotions, usePotions, addPracticeLog, addMaterials,
  addCoins, addMonsterCard, recordPotionUsed,
  subscribeCardCollection, addArcherXP, addRoundArrows, recordGuestBattleStats, finalizeMonsterShootingSession,
} from "../../lib/db";
import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";
import { MONSTER_TIER_XP, archerLevelFromXP, archerLevelBonus } from "../../lib/archerLevel";
import { CAT_TIER_XP } from "../../lib/catLevel";
import { getMaterialPool } from "../../lib/monsterMaterials";
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
import { resolveSoloMonsterAbility } from "../../lib/soloMonsterAbilityEngine";
import { calcStandardCounter } from "../../lib/damage";
import { MATERIAL_BY_ID as EXPANSION_MATERIAL_BY_ID } from "../../lib/monsterEconomyCatalog";
import { calcCardCombatEffectsFromCollection } from "../../lib/cardTalents";
import { SOLO_CHALLENGE_LEVELS, applyChallengeLevel } from "../../lib/monsterExpansionAdapter";
import { createDispatch } from "../../battle/BattleAnimation";
import { RoundController } from "../../battle/RoundController";
import { sfxEpic, sfxBattleIntro, sfxVictoryFanfare, sfxSuccess, sfxTap, sfxSoftFail, sfxCast, sfxBuff, sfxDebuff, sfxArrowHit, sfxCritBoom, sfxOrganHit, sfxCounter, sfxCounterCrit, sfxMonsterDead, sfxRevive, sfxRoundEnd, sfxPotionDrink, unlockAudio, vibrate } from "../../lib/sound";
import BattleCard from "./BattleCard";
import MonsterSVG, { MonsterBattleImg } from "../MonsterSVG";
import { CAT_IDS, CATS } from "../../lib/catData";
import TargetFaceOverlay, { TargetFmtPicker, InputModePicker, getBattleTargetFmt, setBattleTargetFmt, getBattleInputMode, setBattleInputMode } from "../shared/TargetFaceOverlay";
import BattleShootingProfile from "../shared/BattleShootingProfile";
import { loadBattleShootingProfile } from "../../lib/battlePractice";
import { BattleStatCard } from "../shared/SharedBattleComponents";
import { labelToValue, HALF_SCORES, calcArrowStats } from "../../lib/score";
import DungeonKillResult from "../dungeon/DungeonKillResult";
import BattleScreen from "../battle/BattleScreen";
import { playBattleSound } from "../../lib/battleSound";
import BattleSoundIndicator from "../shared/BattleSoundIndicator";
import { getBattleBackgroundUrl } from "../../lib/battleAssets";;
import { createMonsterBattleSnapshot, normalizeMonsterBattleSnapshot } from "../../lib/monsterBattleSnapshot";
import { isMonsterExpansionEnabled } from "../../lib/monsterExpansionFeature";
import { buildSoloExpansionReward } from "../../lib/soloRewardEngine";
import { claimMonsterBattleReward, flushPendingMonsterBattleRewards } from "../../lib/monsterRewardDb";

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
  return getBattleBackgroundUrl(family);
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
  // 僅 kid（QR/一次性）才限制獎勵與功能；guest（有記憶的訪客）比照正式會員
  const isLimitedAccount = false; // 訪客/兒童皆比照正式會員
  const { hasCat, catName, catId, catMsg, clearCatMsg, triggerCatAction, saveBond, saveXP, calcCatRoundDamage, triggerCatSkill, catHP: catMaxHP, catDEF: catBaseDEF } = useCatCompanion(isGuest ? profile : null);
  const [phase, setPhase]           = useState("select");
  const [archerStyle, setArcherStyle]               = useState(() => localStorage.getItem("mb_archer_style") || "");
  const [archerSelectReturn, setArcherSelectReturn] = useState("select");
  const [battleMode, setBattleMode] = useState(() => loadMbDefaults()?.battleMode || "score");
  // 難度由怪物的弱化／普通／強悍變體承擔；打怪模式固定學生規則。
  const [mode, setMode]             = useState("student");
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
  // 挑戰強度（方案A）：玩家進場自選,取代隨機變體;記住上次選擇
  const [challengeLevel, setChallengeLevel]   = useState(() => localStorage.getItem("mb_challenge_level") || "standard");

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
  const emitCatEvent = useCatBuddyEvent();
  const skipCatFeatures = isGuest || kidMode;
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
  const [battleRuntimeSnapshot, setBattleRuntimeSnapshot] = useState(null);
  const handleBattleRuntimeSnapshot = useCallback((snapshot) => setBattleRuntimeSnapshot(snapshot), []);
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
  const battleEndHandledRef = useRef(false);
  const battleSessionIdRef = useRef(null);
  const shootingPerformanceSavedRef = useRef(false);
  const lastPickedRef = useRef(null);
  const phaseRef = useRef("select");
  const [cardColl, setCardColl] = useState({ cards: {}, equipped: [] });
  const cardCollRef = useRef({ cards: {}, equipped: [] }); // 供 startBattle 同步讀取
  const extraDexRef = useRef({}); // monsterDex/craftStats/... 不放 dep array，用 ref 同步最新值
  extraDexRef.current = { monsterDex, craftStats, chestStats, potionDex, duelStats, cardColl };
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (profile?.id && !isLimitedAccount) flushPendingMonsterBattleRewards(profile.id).catch(() => {});
  }, [profile?.id, isLimitedAccount]);

  useEffect(() => {
    const immersivePhases = new Set(["battle_intro", "battle", "monster_die", "loot", "result"]);
    onImmersiveChange?.(immersivePhases.has(phase));
    return () => onImmersiveChange?.(false);
  }, [phase, onImmersiveChange]);

  // 讀取今日已有箭數（用於里程碑計算）

  // 進場動畫：50ms 後播音效（確保動畫已渲染），2.5 秒後自動進入戰鬥
  useEffect(() => {
    if (phase !== "battle_intro") return;
    const sfxTimer = setTimeout(() => sfxBattleIntro(), 50);
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
    const t = setTimeout(() => sfxVictoryFanfare(), 80);
    return () => clearTimeout(t);
  }, [phase]);

  // 進入戰鬥時解鎖 AudioContext（讓後續音效正常播放）
  useEffect(() => {
    if (phase !== "battle") return;
    unlockAudio();
  }, [phase]);

  // 重整彈窗：戰鬥中離開頁面時提醒確認
  useEffect(() => {
    const isActive = ["battle","battle_intro"].includes(phase);
    if (!isActive) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = "戰鬥正在進行中，確定要離開嗎？"; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
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
    if (phase !== "result") return;
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
    if (isLimitedAccount) return;
    if (phase === "loot" || phase === "result" || phase === "select") {
      if (phase === "loot" || phase === "result") sessionStorage.removeItem("mb_battle_save");
      pendingPotionRef.current = []; // 離開戰鬥時清空未寫的藥水
      return;
    }
    if (phase !== "battle") return;
    const save = createMonsterBattleSnapshot({
      ts: Date.now(),
      monster, mode, battleMode, monsterHP, archerHP,
      round, roundScores, selectedDistance, distanceMode, battleStats,
      arrowsPerRound, targetFmt, targetMode,
      battleSessionId: battleSessionIdRef.current,
      runtimeSnapshot: battleRuntimeSnapshot,
      activeCarryBuffs, potionShield, monsterDmgTakenPct, counterReducePct, poisonEffect,
      log: log.slice(-8),
    });
    try { sessionStorage.setItem("mb_battle_save", JSON.stringify(save)); } catch {}
  }, [phase, monsterHP, archerHP, round, arrowsPerRound, targetFmt, targetMode, battleRuntimeSnapshot]); // eslint-disable-line

  useEffect(() => {
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
  }, [profile?.id]); // eslint-disable-line

  useEffect(() => {
    if (isLimitedAccount || !profile || !certRecords) return;
    const { monsterDex: mDex, craftStats: cSt, chestStats: chSt, potionDex: pDex, duelStats: dSt, cardColl: cColl } = extraDexRef.current;
    const ds = computeDexStats({ member:profile, certification, certRecords, checkinCount:profile?.dailyQuestCount||0, granted:dexGrants, physicalMax:dexConfig.physicalMax, pointMax:dexConfig.pointMax, monsterDex:mDex, craftStats:cSt, chestStats:chSt, potionDex:pDex, duelStats:dSt, cardData:cColl });
    const stats = calcArcherStats({ member:profile, certification, certRecords, dexStats:ds });
    setArcherStats(stats);
  }, [profile, certification, certRecords, dexGrants, isGuest]); // eslint-disable-line

  useEffect(() => {
    if (!profile?.id) return;
    return subscribeCardCollection(profile.id, data => {
      setCardColl(data);
      cardCollRef.current = data;
    });
  }, [profile?.id]); // eslint-disable-line

  // ✅ 射手數值就緒後，依戰力匹配6隻怪物
  useEffect(() => {
    if (!archerStats) return;
    const power = calcArcherPower(archerStats);
    let cancelled = false;
    setMatchedMonsters(drawMatchedMonsters(power));
    if (isMonsterExpansionEnabled()) {
      import("../../lib/monsterExpansionAdapter").then(({ drawExpansionSoloMonsters }) => {
        if (!cancelled) setMatchedMonsters(drawExpansionSoloMonsters(power));
      }).catch(error => console.warn("monster expansion matcher unavailable", error));
    }
    // 只在選怪階段才重置選取；任務模式已由 questInitDone 鎖定，不能清空
    if (!questInitDone.current && (phaseRef.current === "select" || phaseRef.current === "event_select")) {
      setPickedMonster(null);
    }
    return () => { cancelled = true; };
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
    if (entry.type === "hit" || entry.type === "hit_crit" || entry.type === "hit_organ") {
      triggerCatAction();
      if (entry.type === "hit_crit" || entry.type === "hit_organ") {
        emitCatEvent({ animation: "happy", duration: 1000, context: "encourage" });
      } else {
        emitCatEvent({ animation: "attack", duration: 800, context: "encourage" });
      }
    } else if (entry.type === "miss") {
      emitCatEvent({ animation: "miss", duration: 700, context: "lose" });
    }
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
  const abilityNonceRef = useRef(Date.now());          // 每場戰鬥的技能 once-only 基底
  const resolvedAbilityKeysRef = useRef(new Set());    // 已結算技能 key（防動畫重播重複扣血）
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
    setPickedMonster(null);
    if (!isMonsterExpansionEnabled()) {
      setMatchedMonsters(drawMatchedMonsters(power));
      return;
    }
    import("../../lib/monsterExpansionAdapter").then(({ drawExpansionSoloMonsters }) => {
      setMatchedMonsters(drawExpansionSoloMonsters(power));
    }).catch(error => {
      console.warn("monster expansion reroll unavailable", error);
      setMatchedMonsters(drawMatchedMonsters(power));
    });
  }

  function enterEventMode() {
    if (!eventConfig?.active) return;
    const ec = eventConfig;
    setBattleMode(ec.battleMode || "score");
    setMode("student");
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
    if (!profile?.id || isLimitedAccount) return;
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
    if (!profile?.id || isLimitedAccount) return;
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
      if (profile?.id && !isLimitedAccount) {
        usePotions(profile.id, pendingPotions).catch(()=>{});
        recordPotionUsed(profile.id, pendingPotions).catch(()=>{});
      }
    }
    // ── 立即更新終身箭數（每回合送出即計，不需報到）──────────────
    if (profile?.id) {
      const submittedArrowCount = arrows.length;
      addRoundArrows(profile.id, submittedArrowCount).catch(error => {
        console.warn("MonsterBattle arrow progress sync failed; local mileage was preserved:", error?.message || error);
      });
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

    // ── 2.5 怪物技能結算（招牌/共用;MonsterBattle 自有流程,BattleEngine 不含技能）──
    // 傷害=標準反擊×技能倍率（已含破解減幅）;ATK 減益立即掛到下一回合;once-only key 防重複。
    if (monster?.signatureSkillId) {
      if (round === 1) { abilityNonceRef.current = Date.now(); resolvedAbilityKeysRef.current.clear(); }
      const hpRatio = (monster.hp || 1) > 0 ? Math.max(0, (finalState?.monsterHP ?? monsterHP) / monster.hp) : 1;
      const ability = resolveSoloMonsterAbility({
        battleId: `mb:${monster.id}:${abilityNonceRef.current}`,
        monster, round,
        arrows: arrows.map(a => a?.label ?? a?.score ?? a),
        targetFmt, monsterHpRatio: hpRatio,
      });
      const resolved = ability?.resolved;
      if (resolved?.resolvedKey && !resolvedAbilityKeysRef.current.has(resolved.resolvedKey)) {
        resolvedAbilityKeysRef.current.add(resolved.resolvedKey);
        const lv = resolved.outcome?.level;
        const breakText = lv === "full" ? "🛡️ 完全破解！技能無效"
          : lv === "major" ? "💪 高分破解！大幅削弱"
          : lv === "partial" ? "👍 部分破解！效果減半" : "💢 未破解，全額生效";
        addLog({ type:"counter_crit", text:`⚡ ${monster.name} 發動「${resolved.name || ability.scheduled?.name || "技能"}」！${breakText}` });
        if (resolved.skillDamageMult > 0) {
          const skillDmg = Math.max(0, Math.round(calcStandardCounter(monster.atk || 10, bSt.def || 0) * resolved.skillDamageMult));
          if (skillDmg > 0) {
            setArcherHP(h => Math.max(1, h - skillDmg));
            showFloatCounterDmg(skillDmg, lv === "none");
            addLog({ type:"counter", text:`💥 技能傷害：-${skillDmg} HP` });
          }
        }
        for (const st of (resolved.statuses || [])) {
          if (st.id === "atkDown" && typeof st.strength === "number") {
            const drop = Math.round((bSt.atk || 10) * st.strength / 100);
            setArcherATKMod(m => m - drop);
            addLog({ type:"debuff", text:`🌀 ${st.name || "虛弱"}：ATK -${st.strength}%（下一回合）` });
          } else if (st.id === "poison" && typeof st.strength === "number") {
            const poisonDmg = Math.max(1, Math.round((bSt.hp || 100) * st.strength / 100));
            setArcherHP(h => Math.max(1, h - poisonDmg));
            addLog({ type:"debuff", text:`🕷️ 中毒：-${poisonDmg} HP（毒不致死）` });
          } else {
            addLog({ type:"debuff", text:`🌀 附加「${st.name || st.id}」（${st.duration || 1} 回合）` });
          }
        }
        if (resolved.selfShieldMaxHpPct > 0) addLog({ type:"buff", text:`🛡 ${monster.name} 展開護盾！` });
        if (resolved.delayedMult > 0) addLog({ type:"buff", text:`⏳ ${monster.name} 正在蓄力，下回合追加攻擊！` });
      }
    }

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
    s = normalizeMonsterBattleSnapshot(s);
    setMonster(s.monster);
    setBattleBg(pickBg(s.monster?.family));
    setMode(s.mode || "student");
    setBattleMode(s.battleMode || "score");
    setArrowsPerRound([3, 6].includes(s.arrowsPerRound) ? s.arrowsPerRound : 6);
    if (["full_110", "half_610", "field_16"].includes(s.targetFmt)) {
      setTargetFmt(s.targetFmt);
      setBattleTargetFmt(s.targetFmt);
    }
    if (typeof s.targetMode === "boolean") {
      setTargetMode(s.targetMode);
      setBattleInputMode(s.targetMode ? "target" : "button");
    }
    battleSessionIdRef.current = s.battleSessionId || battleSessionIdRef.current;
    setBattleRuntimeSnapshot(s.runtimeSnapshot || null);
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
    setBattleRuntimeSnapshot(null);
    battleEndHandledRef.current = false;
    shootingPerformanceSavedRef.current = false;
    battleSessionIdRef.current = profile?.id && !isLimitedAccount
      ? `monster_${profile.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : null;
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
    // 戰前藥水不再套用；消耗效果在正式回合流程中處理。
    const baseStats = { ...(archerStats || { hp:200, atk:10, def:10 }) };
    if (mode==="veteran") baseStats.hp = Math.max(600, baseStats.hp);
    // 怪物卡片裝備加成（優先用 ref 避免 closure stale 問題）
    const cardData = cardCollRef.current?.equipped ? cardCollRef.current : cardColl;
    const cardBonus = calcEquippedBonus(resolveEquippedCards(cardData));
    // 射手等級加成
    const lvBon = isLimitedAccount ? { hp:0, atk:0, def:0 } : archerLevelBonus(archerLevelFromXP(profile?.archerXP||0));
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

    // 挑戰強度（方案A）：輕鬆×0.8/標準×1.0/挑戰×1.2,取代舊模式倍率與隨機變體
    const boosted = applyChallengeLevel(pickedMonster, challengeLevel);
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
      { type:"system", text:`🎯 ${"分數靶紙"}　${mode==="veteran"?`⚠️ 老手（HP:${boostedMonster.hp} ATK:${boostedMonster.atk} DEF:${boostedMonster.def}）`:mode==="student"?"🎓 學生模式":"🟢 新手模式"}　距離 ${initDist}米` },
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
    // BattleScreen owns the intro animation and its sound effects.
    setPhase("battle");
  }

  async function endBattle(result, finalArchHP, finalMonHP, lastRoundArr = null) {
    // 🐱 貓貓勝利／戰敗動畫（透過 Context 通知全局 CatBuddy）
    if (result === "win") {
      emitCatEvent({ animation: "victory", duration: 2500, context: "victory" });
    } else if (result === "lose") {
      emitCatEvent({ animation: "miss", duration: 2000, context: "lose" });
    }
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
    persistMonsterShootingPerformance({
      result, finalMonsterHp:finalMonHP, totalDamage:totalDmgDealt,
      capturedEnds:completedPracticeRounds.map(scores => scores.map(label => ({ label:String(label) }))),
    });
    if (isLimitedAccount && profile?.id) {
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
      setTimeout(() => sfxSuccess(), 600);

      // ── 寶箱（固定必掉）────────────────────────────────
      const { mainChest, potionChest } = makeChests(monster, mode);
      const chestCfg = CHEST_TYPES[mainChest.type] || CHEST_TYPES.wood;

      if (isLimitedAccount || !profile?.id) {
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
        if (isLimitedAccount || !profile?.id) {
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
      if (profile?.id && !isLimitedAccount) {
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
      if (!isLimitedAccount) {
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

      if (!isLimitedAccount) {
        saveBond("monster");
        saveXP(CAT_TIER_XP[monster.tier] || 5).catch(() => {});
      }
          // 經驗值：射手（主要）+ 貓貓；冒險者 XP 已取消（改由世界王/公會任務取得）
      if (!isLimitedAccount && profile?.id) {
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
        if (!isLimitedAccount && completedPracticeRounds.length > 0) {
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

  // ═══ archer_select removed — avatar system replaces cat archer selection ═══
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
        {!skipCatFeatures && <CatMsg msg={catMsg} onDone={clearCatMsg}/>}
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
              🎨 外觀
            </button>
          </div>
        </div>

        {/* 射手戰力卡 */}
        <div className="rounded-2xl p-4 text-white" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs tracking-widest text-purple-200 font-black">⚔️ 打怪模式</div>
            <div className="flex items-center gap-2 text-xs text-purple-200">
              {!isLimitedAccount && <span style={{ color:"#f9a8d4", fontWeight:900 }}>⚔️ Lv.{archerLevelFromXP(profile?.archerXP||0)}</span>}
              <span>戰力 <span className="font-black text-white text-sm">{power}</span></span>
            </div>
          </div>
          {archerStats && (
            <div className="flex gap-2 text-xs flex-wrap">
              {(() => {
                const lvBonus = isLimitedAccount ? { hp:0, atk:0, def:0 } : archerLevelBonus(archerLevelFromXP(profile?.archerXP||0));
                const cardBonus = isLimitedAccount ? { hp:0, atk:0, def:0 } : calcEquippedBonus(resolveEquippedCards(cardColl));
                return (
                  <>
                    <span className="bg-white/15 px-2 py-0.5 rounded-full">❤️ {archerStats.hp + lvBonus.hp + cardBonus.hp}</span>
                    <span className="bg-white/15 px-2 py-0.5 rounded-full">⚔️ {archerStats.atk + lvBonus.atk + cardBonus.atk}</span>
                    <span className="bg-white/15 px-2 py-0.5 rounded-full">🛡️ {archerStats.def + lvBonus.def + cardBonus.def}</span>
                    {!isLimitedAccount && (cardBonus.hp + cardBonus.atk + cardBonus.def) > 0 && (
                      <span className="bg-purple-500/30 px-2 py-0.5 rounded-full text-purple-200">🃏 卡牌+{cardBonus.hp+cardBonus.atk+cardBonus.def}</span>
                    )}
                  </>
                );
              })()}
              {!isLimitedAccount && dailyLeft!==null && (
                <span className={`px-2 py-0.5 rounded-full font-bold ${dailyLeft>0?"bg-emerald-500/80":"bg-red-500/80"} text-white`}>
                  今日剩 {dailyLeft}/{dailyMax} 次
                </span>
              )}
              {isLimitedAccount && <span className="bg-amber-500/80 px-2 py-0.5 rounded-full font-bold text-white">⭐ 體驗</span>}
            </div>
          )}
        </div>

        {/* 計分設定 */}
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"12px 14px", display:"flex", flexDirection:"column", gap:12 }}>
          <BattleShootingProfile memberId={profile?.id || "guest"} />
          <TargetFmtPicker value={targetFmt} onChange={v => { setTargetFmt(v); setBattleTargetFmt(v); }} />
          <InputModePicker value={targetMode ? "target" : "button"} onChange={v => { const t = v === "target"; setTargetMode(t); setBattleInputMode(v); }} />
        </div>

        {!isLimitedAccount && showRestorePrompt && savedBattle && (
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

        {!isLimitedAccount && !questContext && dailyLeft===0 ? (
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
                    {/* 族別標籤 ＋ 招牌技能名 */}
                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                      <div className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background:family.color+"33", color:family.color }}>
                        {family.icon} {family.label}
                      </div>
                      {m.signatureName && (
                        <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background:"rgba(196,181,253,.18)", color:"#c4b5fd" }}>
                          ⚡ {m.signatureName}
                        </div>
                      )}
                    </div>
                    {/* HP/ATK/DEF 數值（取代舊變體標籤,讓玩家直接看強度） */}
                    <div className="absolute top-16 right-2 flex flex-col items-end gap-0.5 text-[10px] font-black tabular-nums">
                      <span style={{ color:"#4ade80" }}>❤️ {m.hp}</span>
                      <span style={{ color:"#fb923c" }}>⚔️ {m.atk}</span>
                      <span style={{ color:"#60a5fa" }}>🛡️ {m.def}</span>
                    </div>
                    <div className="mb-2"><MonsterBattleImg id={m.id} icon={m.icon} size={112}/></div>
                    <div className="font-black text-slate-100 text-sm pr-14">{m.name}</div>
                    <div className="text-xs mt-0.5 font-bold px-1.5 py-0.5 rounded-full inline-block"
                      style={{ background:tier.bg, color:tier.color }}>
                      【{tier.label}】
                    </div>
                  </button>
                );
              })}
            </div>

            {pickedMonster && (() => {
              const defs = loadMbDefaults();
              const modeLabel = mode==="veteran"?"🟠老手":mode==="student"?"🎓學生":"🟢新手";
              const bmLabel   = "🎯分數";
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
                  {/* 挑戰強度選擇（方案A）：明確告知數值與掉落差異 */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                    <div className="flex gap-2">
                      {Object.values(SOLO_CHALLENGE_LEVELS).map(level => (
                        <button key={level.id}
                          onClick={() => { setChallengeLevel(level.id); localStorage.setItem("mb_challenge_level", level.id); }}
                          className={`flex-1 py-2 rounded-xl text-sm font-black border transition-all ${
                            challengeLevel === level.id
                              ? level.id === "hard" ? "bg-rose-600 text-white border-rose-500"
                                : level.id === "easy" ? "bg-emerald-600 text-white border-emerald-500"
                                : "bg-blue-600 text-white border-blue-500"
                              : "bg-white/8 text-slate-400 border-white/15"
                          }`}>
                          {level.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-center text-[11px] font-bold text-amber-300">
                      {(SOLO_CHALLENGE_LEVELS[challengeLevel] || SOLO_CHALLENGE_LEVELS.standard).desc}
                    </div>
                  </div>
                  <button onClick={()=>{ setMonster(pickedMonster); setBattleBg(pickBg(pickedMonster.family)); setPhase(defs ? "prebattle" : "mode"); }}
                    className="w-full py-4 rounded-2xl font-black text-lg text-white"
                    style={{ background:"linear-gradient(90deg,#7c3aed,#2563eb)", animation:"mb-glow 2s ease infinite" }}>
                    ⚔️ 挑戰 {pickedMonster.name}！（{(SOLO_CHALLENGE_LEVELS[challengeLevel] || SOLO_CHALLENGE_LEVELS.standard).label.slice(2)}）
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
              {"🎯 分數靶"}
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
            const dropMats = getMaterialPool(`${m.family}_`, m.tier).filter(x => !x.id?.startsWith("frag_"));
            const aXP = MONSTER_TIER_XP[m.tier] || 5;
            const cXP = CAT_TIER_XP[m.tier] || 5;
            return (
              <button key={m.id} onClick={() => setPickedMonster(m)}
                className="rounded-2xl p-4 text-left transition-all active:scale-95 relative overflow-hidden"
                style={{ background: isPicked ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)", border: `2px solid ${isPicked ? "#f59e0b" : "rgba(255,255,255,0.1)"}` }}>
                <div className="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: family.color+"33", color: family.color }}>
                  {family.icon} {family.label}
                </div>
                <div className="mb-2"><MonsterBattleImg id={m.id} icon={m.icon} size={112}/></div>
                <div className="font-black text-slate-100 text-sm pr-14">{m.name}</div>
                <div className="text-xs mt-0.5 font-bold px-1.5 py-0.5 rounded-full inline-block"
                  style={{ background: tier.bg, color: tier.color }}>
                  【{tier.label}】
                </div>
                <div className="flex gap-2 mt-1.5 text-xs text-slate-500">
                  <span>❤️{m.hp}</span><span>⚔️{m.atk}</span><span>🛡️{m.def}</span>
                </div>
                {/* 掉落材料 + XP 預覽 */}
                {dropMats.length > 0 && (
                  <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-1.5 text-[10px] text-slate-400 leading-tight">
                    {dropMats.map(mat => (
                      <span key={mat.id}>{mat.icon}{mat.name}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-1 text-[10px] font-bold">
                  <span style={{ color:"#f9a8d4" }}>⚔️XP+{aXP}</span>
                  <span style={{ color:"#fcd34d" }}>🐱XP+{cXP}</span>
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
        <button onClick={()=>{ setBattleMode("score"); setMode("student"); setPhase("distance"); }}
          className="rounded-2xl p-5 text-left border-2 border-blue-500/40 bg-blue-900/20 active:scale-95 transition-transform">
          <div className="text-2xl mb-1 text-white">🎯 分數靶紙模式</div>
          <div className="font-black text-white mb-1">輸入每箭環數，系統算傷害</div>
          <div className="text-slate-400 text-sm">簡單直接，分數越高傷害越大。</div>
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
                  {"🎯 分數靶"}
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
    return (
      <div className="p-4 flex flex-col gap-4 bg-slate-900 min-h-screen">
        <style>{BATTLE_CSS}</style>
        <button onClick={() => setPhase(eventMode ? "event_select" : loadMbDefaults() ? "select" : "distance")} className="text-slate-400 text-sm self-start">← 返回</button>
        <div className="rounded-2xl p-6 text-white text-center" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
          <div className="mb-2 flex justify-center" style={{ animation:"mb-bounce 1.5s ease infinite" }}>
            <MonsterBattleImg id={pickedMonster.id} icon={pickedMonster.icon} size={192}/>
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:family.color+"33", color:"#fff" }}>{family.icon} {family.label}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:tier.color+"44", color:"#fff" }}>【{tier.label}】</span>
          </div>
          <div className="text-2xl font-black mb-1">{pickedMonster.name}</div>
          <div className="text-purple-200 text-sm mb-4">{pickedMonster.desc}</div>
          {pickedMonster.signatureSkillId && (
            <div className="w-full text-left rounded-xl p-3 mb-3" style={{background:"rgba(15,23,42,.55)",border:"1px solid rgba(251,191,36,.35)"}}>
              <div className="text-amber-300 text-xs font-black mb-1">⚡ 招牌技能情報・{pickedMonster.signatureName}</div>
              <div className="text-slate-200 text-xs leading-relaxed">{pickedMonster.signatureSummary}</div>
              {pickedMonster.counterSummary && <div className="text-emerald-300 text-xs mt-1.5">破解提示：{pickedMonster.counterSummary}</div>}
            </div>
          )}
          {mode==="veteran"&&<div className="bg-orange-500/30 text-orange-200 text-xs font-bold px-3 py-1.5 rounded-full mb-3 inline-block">⚠️ 老手：數值增強，HP基礎 200，加成無上限</div>}
          {mode==="student"&&<div className="bg-blue-500/30 text-blue-100 text-xs font-bold px-3 py-1.5 rounded-full mb-3 inline-block">🎓 學生模式：{distanceMode==="dynamic"?"動態距離從15米起":distanceMode==="random"?`隨機距離 ${selectedDistance}米`:`固定 ${selectedDistance}米`}</div>}
          {mode==="novice"&&<div className="bg-green-500/30 text-green-100 text-xs font-bold px-3 py-1.5 rounded-full mb-3 inline-block">🟢 新手模式：固定 {selectedDistance}米</div>}
          {archerStats&&(()=>{
            const _lvBon=isLimitedAccount?{hp:0,atk:0,def:0}:archerLevelBonus(archerLevelFromXP(profile?.archerXP||0));
            const _cardBonus=isLimitedAccount?{hp:0,atk:0,def:0}:calcEquippedBonus(resolveEquippedCards(cardColl));
            const _fHp=archerStats.hp+_lvBon.hp+_cardBonus.hp;
            const _fAtk=archerStats.atk+_lvBon.atk+_cardBonus.atk;
            const _fDef=archerStats.def+_lvBon.def+_cardBonus.def;
            return (
            <div className="bg-white/10 rounded-xl p-3 mb-3">
              <div className="text-purple-200 text-xs mb-2 text-center">你的數值</div>
              <div className="flex justify-around text-sm">
                {[["HP",_fHp],["ATK",_fAtk],["DEF",_fDef]].map(([k,v])=>(
                  <div key={k} className="text-center"><div className="text-purple-200 text-xs">{k}</div><div className="font-black">{v}</div></div>
                ))}
              </div>
              {(_cardBonus.hp+_cardBonus.atk+_cardBonus.def+_lvBon.hp+_lvBon.atk+_lvBon.def)>0&&(
                <div className="text-xs text-center text-purple-300 mt-1">🃏 {_cardBonus.hp+_cardBonus.atk+_cardBonus.def>0?`卡片加成+${_cardBonus.hp+_cardBonus.atk+_cardBonus.def}`:''}{_lvBon.hp+_lvBon.atk+_lvBon.def>0?`${_cardBonus.hp+_cardBonus.atk+_cardBonus.def>0?'  ':'●'}射手等級+${_lvBon.hp+_lvBon.atk+_lvBon.def}`:''}</div>
              )}
            </div>
            );
          })()}
          <div className="text-purple-200 text-xs mb-4">
            {"🎯 分數靶紙"}
            {mode==="veteran"?"⚔️ 老手・起始15米":mode==="student"?`🎓 學生・${distanceMode==="dynamic"?"動態15m起":`固定${selectedDistance}米`}`:`🟢 新手・固定${selectedDistance}米`}　🏹 {arrowsPerRound}箭／回合
          </div>

          {/* 外觀更換 - 使用大頭像 */}
          <button
            onClick={() => { if (typeof onImmersiveChange === 'function' && onImmersiveChange.toString().includes('||')){/* noop */ } if (onBack) onBack(); else onImmersiveChange?.(false); setTimeout(() => window.scrollTo(0,0), 50); }}
            className="w-full py-2 rounded-xl text-sm font-bold mb-1"
            style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#94a3b8", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            🎨 更換大頭像（可在「我的」頁面設定）
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
            <MonsterBattleImg id={monster?.id} icon={monster?.icon} size={280} />
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

  const availablePotions = [...THROW_POTIONS, ...CARRY_POTIONS].filter(p => (potionInv[p.id] || 0) > 0);

  if (phase==="battle") {
    // Use BattleScreen component instead of inline battle UI
    const playerCatId = archerStyle || (profile?.equippedCat?.catId) || CAT_IDS[0];
    return (
      <div style={{ position:"fixed", inset:0, zIndex:60, display:"flex", flexDirection:"column", background:"#0f172a", color:"white", fontFamily:"sans-serif" }}>
        <style>{BATTLE_CSS}</style>
        {/* 沉浸模式切換鈕 */}
        {typeof onImmersiveChange === 'function' && (
          <button onClick={() => onImmersiveChange?.(true)}
            style={{position:"absolute",top:6,right:6,zIndex:50,width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.5)",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:0.5,transition:"opacity .2s"}}
            onMouseEnter={e=>e.currentTarget.style.opacity=1}
            onMouseLeave={e=>e.currentTarget.style.opacity=0.5}
            title="隱藏導覽列"
          >⛶</button>
        )}
        <BattleScreen
          battleId={battleSessionIdRef.current}
          initialBattleSnapshot={battleRuntimeSnapshot}
          onBattleSnapshot={handleBattleRuntimeSnapshot}
          player={{
            name: profile?.name || "射手",
            catId: playerCatId,
            avatarId: profile?.avatarId || null,
            hp: (battleStats||archerStats)?.hp || 100,
            maxHp: (battleStats||archerStats)?.hp || 100,
            atk: (battleStats||archerStats)?.atk || 10,
            def: (battleStats||archerStats)?.def || 10,
            lv: typeof archerLevelFromXP === 'function' ? archerLevelFromXP(profile?.archerXP || 0) : 0,
          }}
          monster={{
            id: monster?.id,
            name: monster?.name,
            family: monster?.family,
            hp: monsterHP,
            maxHp: monster?.hp || monsterHP,
            atk: monster?.atk || 0,
            def: monster?.def || 0,
            color: monster?.color,
            tier: monster?.tier,
            variant: monster?.variant,
            icon: monster?.icon,
            encounter: monster?.encounter,
            role: monster?.role,
            signatureSkillId: monster?.signatureSkillId,
            signatureName: monster?.signatureName,
            signatureSummary: monster?.signatureSummary,
            counterSummary: monster?.counterSummary,
            commonSkillIds: monster?.commonSkillIds,
          }}
          battleMode="score"
          scoreInput={targetMode ? "target" : "keypad"}
          targetFormat={targetFmt}
          difficulty={{hp:1, atk:1, def:1}}
          arrowsPerRound={arrowsPerRound}
          allies={[]}
          cat={hasCat ? { catId, catName, type: "allround", catXP: 0, bond: 0 } : null}
          bgImage={battleBg}
          onBattleEnd={handleMBBattleEnd}
          hideStandaloneResult
          onShootingAbandon={handleMBShootingAbandon}
          onLeaveBattle={() => {
            if (!window.confirm("確定要離開戰鬥嗎？本場未完成的進度不會保留。")) return false;
            sessionStorage.removeItem("mb_battle_save");
            pendingPotionRef.current = [];
            if (questContext) onBack?.();
            else setPhase("select");
            return true;
          }}
          autoStart={!battleRuntimeSnapshot}
          fullScreen
          potions={availablePotions}
          onPotionUsed={(pid) => {
            setPotionInv(prev => ({ ...prev, [pid]: Math.max(0, (prev[pid] || 0) - 1) }));
            if (profile?.id && !isLimitedAccount) recordPotionUsed?.(profile.id, [pid]).catch(() => {});
          }}
          renderMonster={(size, mon) => <MonsterBattleImg id={mon?.id} icon={mon?.icon} size={size} />}
        />
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
    const lootArcherXP = !isLimitedAccount && monster?.tier ? (MONSTER_TIER_XP[monster.tier] || 5) : 0;
    const lootCatXP    = !isLimitedAccount && hasCat && monster?.tier ? (CAT_TIER_XP[monster.tier] || 5) : 0;
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
        // 寶箱明細（面板直接顯示取得了什麼箱）
        chestList: wonChests.map(ch => ({ icon: (CHEST_TYPES[ch.type] || CHEST_TYPES.wood).icon, name: (CHEST_TYPES[ch.type] || CHEST_TYPES.wood).name })),
        coinChestName: droppedCoinChest ? `${droppedCoinChest.name || "金幣寶箱"}` : null,
        // 經驗值合併進戰利品欄
        adventurerXP: gainedXP || 0,
        archerXP: lootArcherXP || 0,
        catXP: lootCatXP || 0,
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
        {/* === 戰鬥統計 + 戰利品（2026-07-19 改用與地下城同一套結算元件）===
            使用者要求打怪與地下城看起來是同一個系統。用 embedded 模式只換掉這一段，
            外層的擊倒標題、任務進度、分享卡與再戰按鈕都保留。
            ⚠️ 打怪特有的卡片與指定素材一定要傳進去 —— 那是這個模式的重頭戲。 */}
        {!isLimitedAccount && (
          <DungeonKillResult
            embedded
            monster={monster}
            self={{
              id: profile?.id,
              name: profile?.nickname || profile?.name || "我",
              arrows: allArrows,
              dmgDealt: totalDmgDealt,
              dmgTaken: totalDmgRecvd,
              crits: critCount,
            }}
            materials={droppedMaterials.map(mat => ({
              id: mat.id, name: mat.name || mat.id, icon: mat.icon, count: mat.count || 1,
            }))}
            card={droppedCard}
            /* ⚠️ 金幣寶箱是獨立的 droppedCoinChest，不在 chestList 裡 ——
               漏掉它會變成「實際有領到金幣寶箱，結算頁卻沒列出」（使用者實測抓到）。 */
            chestRows={[
              ...resultData.drops.chestList.map((chest, index) => ({
                key: `${chest.name}-${index}`, icon: chest.icon, name: chest.name, count: 1,
              })),
              ...(droppedCoinChest ? [{
                key: "coin-chest",
                icon: droppedCoinChest.icon || "🪙",
                name: droppedCoinChest.name || "金幣寶箱",
                count: 1,
              }] : []),
            ]}
            coins={droppedCoins}
            archerXP={resultData.drops.archerXP}
            adventurerXP={resultData.drops.adventurerXP}
            catXP={resultData.drops.catXP}
            catName={catName}
            targetFmt={targetFmt}
          />
        )}
        {/* 經驗值已合併進 BattleResultPanel 戰利品欄（2026-07-18 使用者指示） */}
        {isLimitedAccount && (droppedCoins > 0 || droppedMaterials.length > 0) && (
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
        {(isLimitedAccount || !profile?.id) ? (
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
        ) : null /* 寶箱明細已併入 BattleResultPanel 戰利品欄,底部提醒卡移除（2026-07-18 使用者指示） */}

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

  function persistMonsterShootingPerformance({ result, finalMonsterHp, totalDamage, capturedEnds }) {
    if (shootingPerformanceSavedRef.current || isLimitedAccount || !profile?.id || !battleSessionIdRef.current) return;
    shootingPerformanceSavedRef.current = true;
    if (totalDamage > 0) {
      import("../../lib/villageGoalDb").then(m => m.contributeDamageToGoal(profile.id, totalDamage)).catch(() => {});
    }
    const shootingProfile = shootingProfileRef.current || loadBattleShootingProfile(profile.id);
    finalizeMonsterShootingSession({
      sessionId:battleSessionIdRef.current,
      memberId:profile.id,
      capturedEnds,
      shootingProfile,
      targetFormat:targetFmt,
      arrowsPerEnd:arrowsPerRound,
      result,
      monster,
      totalDamage,
      finalMonsterHp,
      characterSnapshot:{
        level:profile?.archerLevel,
        attack:(battleStats || archerStats)?.atk,
        defense:(battleStats || archerStats)?.def,
      },
    }).catch(error => console.warn("shooting performance dual-write failed", error));
  }

  function handleMBShootingAbandon(summary = {}) {
    persistMonsterShootingPerformance({
      result:"abandoned",
      finalMonsterHp:summary.monsterHp,
      totalDamage:summary.totalDamage,
      capturedEnds:summary.shootingEnds || [],
    });
  }

  // BattleScreen callback: handle battle end -> full loot/XP/rewards
  async function handleMBBattleEnd(result, summary = {}) {
    if (battleEndHandledRef.current) return;
    battleEndHandledRef.current = true;
    // Sync battle stats from BattleScreen summary
    if (summary.totalDamage !== undefined) setTotalDmgDealt(summary.totalDamage);
    if (summary.crits !== undefined) setCritCount(summary.crits);
    if (summary.arrowScores && summary.arrowScores.length > 0) {
      // BattleScreen preserves X/M labels, while battle statistics operate on
      // numeric rings.  Normalise here so X is never recorded as six misses.
      const numericScores = summary.arrowScores.map(score => score === "X" ? 10 : score === "M" ? 0 : Number(score) || 0);
      setAllArrows(numericScores);
      setRoundScores([{ round: summary.rounds || 1, scores: numericScores, total: numericScores.reduce((s,v) => s+v, 0) }]);
    }
    if (summary.playerHp !== undefined && (battleStats || archerStats)?.hp) {
      const initialHp = (battleStats || archerStats)?.hp || 100;
      setTotalDmgRecvd(Math.max(0, initialHp - summary.playerHp));
    }
    if (summary.rounds) setRound(summary.rounds);
    const capturedEnds = Array.isArray(summary.shootingEnds) && summary.shootingEnds.length
      ? summary.shootingEnds
      : (summary.arrowScores || []).reduce((ends, label, index) => {
        const endIndex = Math.floor(index / arrowsPerRound);
        (ends[endIndex] ||= []).push({ label:String(label) });
        return ends;
      }, []);
    persistMonsterShootingPerformance({
      result:result === "won" ? "win" : "lose",
      finalMonsterHp:summary.monsterHp,
      totalDamage:summary.totalDamage,
      capturedEnds,
    });
    if (result === "won") {
      // Guest vs member rewards
      if (isLimitedAccount || !profile?.id) {
        const wonBefore = sessionStorage.getItem("guest_won_once");
        if (!wonBefore) {
          const guestLootItem = drawLoot(LOOT_TABLE_GUEST, monster?.id, monster?.tier);
          setLoot(guestLootItem);
          sessionStorage.setItem("guest_won_once", "1");
        } else {
          setLoot(null);
          setGuestWonBefore(true);
        }
        setWonChests([]);
      } else {
        const { mainChest, potionChest } = makeChests(monster, mode);
        const mainChests = [mainChest, potionChest].filter(Boolean);
        setWonChests(mainChests);
        // 機率金幣寶箱：依挑戰強度（輕鬆20%/標準50%/挑戰必掉）
        const coinChestChance = (SOLO_CHALLENGE_LEVELS[monster?.challengeLevel || challengeLevel] || SOLO_CHALLENGE_LEVELS.standard).coinChestChance;
        const coinChest = Math.random() < coinChestChance ? makeCoinChest(monster?.tier, "打怪掉落") : null;
        if (coinChest) setDroppedCoinChest(coinChest);
        addChests(profile.id, [...mainChests, ...(coinChest ? [coinChest] : [])]).catch(() => {});
      }

      // Materials + coins（掉落全查挑戰強度表:SOLO_CHALLENGE_LEVELS）
      const rewardLevel = SOLO_CHALLENGE_LEVELS[monster?.challengeLevel || challengeLevel] || SOLO_CHALLENGE_LEVELS.standard;
      if (!isLimitedAccount && profile?.id) {
        // 職場/寶箱套裝：打怪金幣加成（cardTalents）
        const coinFx = calcCardCombatEffectsFromCollection(cardCollRef.current || {});
        const baseCoins = Math.round(rollCoins(monster?.tier, mode) * rewardLevel.coinMult * (1 + (coinFx.coinBonusPct || 0) / 100));
        const expansionReward = buildSoloExpansionReward({
          battleId:battleSessionIdRef.current,
          memberId:profile.id,
          monster,
          materialQty:rewardLevel.materialQty,
          cardChance:rewardLevel.cardChance,
        });
        if (expansionReward) {
          const displayMaterials = expansionReward.materials.map(material => ({
            ...material,
            // 中文名從素材目錄查（adapter 只帶 materialId,舊寫法會露出原始 id）
            name:EXPANSION_MATERIAL_BY_ID[material.id]?.name || monster?.materialName || material.id,
          }));
          try {
            // 卡片與素材提示必須以 callable 已確認、已寫入的結果為準。
            // 不可先顯示前端隨機結果，否則會出現「畫面說拿到卡、收藏卻沒有」的假提示。
            const claimResult = await claimMonsterBattleReward({
              battleId:battleSessionIdRef.current,
              memberId:profile.id,
              rewardType:"solo_hunt",
              materials:expansionReward.materials,
              coins:0,
              card:expansionReward.card,
              metadata:{ mode, challengeLevel:monster?.challengeLevel || challengeLevel, monsterId:monster.id, catalogVersion:1, source:"solo" },
            });
            const trustedReward = claimResult?.reward || {};
            setDroppedCoins(Math.max(0, Number(trustedReward.coins) || 0));
            const trustedMaterials = Object.entries(trustedReward.materialTotals || {}).map(([id, quantity]) => ({
              id, quantity,
              name:EXPANSION_MATERIAL_BY_ID[id]?.name || monster?.materialName || id,
            }));
            setDroppedMaterials(trustedMaterials.length ? trustedMaterials : displayMaterials);
            setDroppedCard(trustedReward.card || null);
          } catch (error) {
            // claim 已排入本機重試佇列；未經伺服器確認前不可宣稱取得卡片。
            setDroppedMaterials([]);
            setDroppedCard(null);
            setDroppedCoins(0);
            console.warn("solo expansion reward claim deferred", error);
          }
        } else {
          const mats = (mode === "novice"
            ? rollMaterialDrops(monster)
            : rollMaterialDropsGuaranteed(monster, (mode === "veteran" || mode === "match") ? 2 : 1)
          ).filter(m => !m.id?.startsWith("frag_"));
          setDroppedMaterials(mats);
          if (mats.length > 0) addMaterials(profile.id, mats).catch(() => {});
          addCoins(profile.id, baseCoins).catch(() => {});

          const card = rollCardDrop(monster);
          if (card) {
            setDroppedCard(card);
            addMonsterCard(profile.id, card).catch(() => {});
          }
        }
      } else if (isLimitedAccount || profile?.id) {
        const mats = rollMaterialDrops(monster).filter(m => !m.id?.startsWith("frag_")).slice(0, 1);
        setDroppedMaterials(mats);
        if (profile?.id && mats.length > 0) addMaterials(profile.id, mats).catch(() => {});

        const baseCoins = rollCoins(monster?.tier, mode);
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
      }

      // Archer XP + cat bond
      if (!isLimitedAccount) {
        const archerXP = MONSTER_TIER_XP[monster?.tier] || 5;
        setGainedArcherXP(archerXP);
        addArcherXP(profile.id, archerXP).catch(() => {});
        const catXP = hasCat ? (CAT_TIER_XP[monster?.tier] || 5) : 0;
        setGainedCatXP(catXP);
        if (hasCat) {
          saveBond("monster");
          saveXP(CAT_TIER_XP[monster?.tier] || 5).catch(() => {});
        }
      }

      // Save monster log
      if (profile?.id) {
        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "win",
          rounds: summary.rounds || 1, mode, battleMode,
          totalDamage: summary.totalDamage || 0, crits: summary.crits || 0,
          totalArrows: summary.arrows || 0,
        }).catch(() => {});
        if (!isLimitedAccount && summary.arrows > 0) addPracticeLog(profile.id, {
          date: new Date().toISOString().slice(0, 10), source: "monster",
          monsterName: monster?.name, monsterTier: monster?.tier, mode, battleMode, result: "win",
          rounds: [], total: 0, totalArrows: summary.arrows,
          battleStats: { totalDamage: summary.totalDamage || 0, crits: summary.crits || 0, rounds: summary.rounds || 1 },
        }, profile.id).catch(() => {});
      }

      // Quest kill callback
      if (questContext?.monsterId === monster?.id && onKillForQuest) onKillForQuest(monster?.id);

      // Milestone check
      if (profile?.id && !isLimitedAccount) {
        import("../../lib/db").then(mod => {
          if (mod.checkAndGrantArrowMilestones) {
            mod.checkAndGrantArrowMilestones(profile.id, arrowsPerRound).then(res => {
              if (res.milestones?.length > 0) {
                setMilestoneQueue(res.milestones.map(ms => ({ ms, rewards: getRewardsForMilestone(ms) })));
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      // BattleScreen has already shown the knockdown and victory animation.
      setPhase("loot");
    } else {
      if (profile?.id) {
        saveMonsterLog(profile.id, {
          monsterName: monster?.name, monsterId: monster?.id, result: "lose",
          rounds: summary.rounds || 1, mode, battleMode,
          totalDamage: summary.totalDamage || 0, crits: summary.crits || 0,
          totalArrows: summary.arrows || 0,
        }).catch(() => {});
      }
      // Do not remount the legacy defeat panel after BattleScreen's result.
      setPhase("select");
    }
  }


  return null;
}
