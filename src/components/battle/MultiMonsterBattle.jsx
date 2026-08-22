// src/components/battle/MultiMonsterBattle.jsx
// 單人複數怪完整戰鬥：六箭輸入 -> 玩家 -> 貓 -> 異常 -> 反擊 -> 恢復。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateMultiMonsterEncounter } from "../../lib/multiMonsterEncounter";
import {
  MULTI_BATTLE_EVENT,
  MULTI_BATTLE_PHASE,
  aggregateMultiMonsterRewardClaims,
  createMultiMonsterBattleState,
  getMultiMonsterPlayerStats,
  processMultiMonsterRound,
} from "../../lib/multiMonsterBattle";
import { getBattleBackgroundUrl, getBattleMonsterSources } from "../../lib/battleAssets";
import { buildCombatModifiers, describeModifiers } from "../../lib/combatModifiers";
import { describeMonsterStatuses, MONSTER_STATUSES } from "../../lib/monsterStatus";
import { calcCardCombatEffectsFromCollection } from "../../lib/cardTalents";
import { buildAdventurerCombatStats } from "../../lib/adventurerCombatStats";
import { getEquipSpecializations } from "../../lib/equipSpecializationDb";
import { subscribeCardCollection } from "../../lib/db";
import { claimMultiMonsterBattleReward } from "../../lib/monsterRewardDb";
import { MATERIAL_BY_ID } from "../../lib/monsterEconomyCatalog";
import { aggregateRewardChests, resolveSoloBattlePlayer, resolveSoloCatProfile, shouldFinishSoloPresentation } from "../../lib/multiMonsterSoloView";
import { getMultiMonsterPresentationPolicy, groupSoloPresentationBeats } from "../../lib/multiMonsterPresentation";
import { FREE_HUNT_QUOTA_MODE } from "../../lib/freeHuntQuota";
import { consumeFreeHuntAttempt, freeHuntQuotaErrorMessage } from "../../lib/freeHuntQuotaDb";
import {
  clearMultiMonsterLocalBattle,
  createMultiMonsterBattleIdentity,
  createMultiMonsterLocalRandom,
  loadMultiMonsterLocalBattle,
  saveMultiMonsterLocalBattle,
} from "../../lib/multiMonsterLocalBattleStore";
import { useAuth } from "../../hooks/useAuth";
import { recordBattleRoundArrows } from "../../lib/db";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import { PlayerAvatar } from "../shared/PlayerAvatar";
import CatSVG from "../cat/CatSVG";
import {
  sfxArrowHit,
  sfxArrowShoot,
  sfxBattleIntroSafe,
  sfxBuff,
  sfxCast,
  sfxCounter,
  sfxCritBoom,
  sfxDebuff,
  sfxDefeat,
  sfxMonsterDead,
  sfxRoundEnd,
  sfxTap,
  sfxVictoryFanfare,
} from "../../lib/sound";

const ARROWS_PER_ROUND = 6;
const SOLO_PRESENTATION_POLICY = getMultiMonsterPresentationPolicy("free_hunt_solo");
const SCORE_KEYS = ["X", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "M"];
const PHASE_LABEL = {
  [MULTI_BATTLE_PHASE.PLAYER]: ["🏹", "玩家攻擊"],
  [MULTI_BATTLE_PHASE.CAT]: ["🐱", "貓貓攻擊"],
  [MULTI_BATTLE_PHASE.STATUS]: ["☠️", "異常效果"],
  [MULTI_BATTLE_PHASE.COUNTER]: ["👹", "怪物反擊"],
  [MULTI_BATTLE_PHASE.RECOVERY]: ["💚", "回合恢復"],
};

const CSS = `
@keyframes mmIntroIn{0%{opacity:0;transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}
@keyframes mmVs{0%{opacity:0;transform:scale(2.1) rotate(-8deg)}55%{opacity:1;transform:scale(.92) rotate(2deg)}100%{transform:scale(1)}}
@keyframes mmMonsterIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes mmShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
@keyframes mmFloat{0%{opacity:1;transform:translate(-50%,0) scale(.85)}100%{opacity:0;transform:translate(-50%,-55px) scale(1.16)}}
@keyframes mmBanner{0%{opacity:0;transform:translate(-50%,-50%) scale(1.35)}20%,75%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0}}
@keyframes mmTarget{0%,100%{box-shadow:0 0 8px rgba(251,191,36,.28)}50%{box-shadow:0 0 23px rgba(251,191,36,.7)}}
@keyframes mmPlayerFloat{0%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-40px)}}
@keyframes mmKO{0%{opacity:1;transform:translateY(0) scale(1);filter:brightness(1)}28%{opacity:1;transform:translateY(-8px) scale(1.08);filter:brightness(2)}58%{opacity:.8;transform:translateY(4px) scale(.92) rotate(-3deg);filter:brightness(.65) grayscale(.45)}100%{opacity:0;transform:translateY(28px) scale(.62) rotate(7deg);filter:brightness(.2) grayscale(1)}}
@keyframes mmKOStamp{0%{opacity:0;transform:translate(-50%,-50%) scale(1.8) rotate(-10deg)}35%,78%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(-5deg)}100%{opacity:0;transform:translate(-50%,-65%) scale(.92) rotate(-5deg)}}
@media (prefers-reduced-motion: reduce) {
  [data-multi-monster-battle] *, [data-multi-monster-battle] *::before, [data-multi-monster-battle] *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function safeSound(play) {
  try {
    const result = play();
    if (result?.catch) result.catch(() => {});
  } catch {}
}

function toEquipSpec(raw) {
  const pick = slot => {
    const row = raw?.[slot];
    const trackId = row?.activeTrackId;
    const level = trackId ? row?.tracks?.[trackId]?.level || 0 : 0;
    return trackId && level > 0 ? { trackId, level } : null;
  };
  return { weapon: pick("weapon"), armor: pick("armor"), accessory: pick("accessory") };
}

export default function MultiMonsterBattle({ family, tier, playerStats, memberProfile = null, sharedData = null, onBack, onWin, onLose, encounter = null, dungeonBattleId = null }) {
  const { profile: authProfile } = useAuth();
  const profile = memberProfile || authProfile;
  const catProfile = useMemo(() => resolveSoloCatProfile(profile, sharedData?.cats), [profile, sharedData?.cats]);
  const cat = useCatCompanion(catProfile);
  const [screen, setScreen] = useState("loading");
  const [battleState, setBattleState] = useState(null);
  const [battleMeta, setBattleMeta] = useState(null);
  const [visualState, setVisualState] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(0);
  const [attackMode, setAttackMode] = useState("focus");
  const [arrows, setArrows] = useState([]);
  const [cardCollection, setCardCollection] = useState(sharedData?.cardData ?? null);
  const [cardsReady, setCardsReady] = useState(sharedData?.cardData !== undefined);
  const [equipSpec, setEquipSpec] = useState(null);
  const [equipReady, setEquipReady] = useState(false);
  const [phaseBanner, setPhaseBanner] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [monsterFloat, setMonsterFloat] = useState(null);
  const [monsterDamageFloats, setMonsterDamageFloats] = useState({});
  const [playerFloat, setPlayerFloat] = useState(null);
  const [shakeIndex, setShakeIndex] = useState(null);
  const [knockoutIndex, setKnockoutIndex] = useState(null);
  const [drops, setDrops] = useState(null);
  const [settlementError, setSettlementError] = useState("");
  const [startError, setStartError] = useState("");
  const [showModifiers, setShowModifiers] = useState(false);
  const playToken = useRef(0);
  const autoSubmitRef = useRef(false);
  const settlementRef = useRef(null);
  const pendingBattleMetaRef = useRef(null);
  const battleRewardRootRef = useRef(`multi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  const isDungeonEncounter = Array.isArray(encounter?.targets) && encounter.targets.length > 1;
  const storageIdentity = useMemo(() => isDungeonEncounter
    ? { memberId:profile?.id, family:`dungeon_${encounter.encounterId}`, tier:1 }
    : { memberId:profile?.id, family, tier:Number(tier) },
  [isDungeonEncounter, profile?.id, encounter?.encounterId, family, tier]);

  useEffect(() => {
    if (sharedData?.cardData !== undefined) {
      setCardCollection(sharedData.cardData || {});
      setCardsReady(true);
      return undefined;
    }
    if (!profile?.id) {
      setCardCollection({});
      setCardsReady(true);
      return undefined;
    }
    let stopped = false;
    let unsubscribe = null;
    unsubscribe = subscribeCardCollection(profile.id, collection => {
      if (stopped) return;
      setCardCollection(collection || {});
      setCardsReady(true);
      stopped = true;
      setTimeout(() => unsubscribe?.(), 0);
    });
    return () => { stopped = true; unsubscribe?.(); };
  }, [profile?.id, sharedData?.cardData]);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.id) {
      setEquipSpec(null);
      setEquipReady(true);
      return undefined;
    }
    getEquipSpecializations(profile.id)
      .then(raw => { if (!cancelled) setEquipSpec(toEquipSpec(raw)); })
      .catch(() => { if (!cancelled) setEquipSpec(null); })
      .finally(() => { if (!cancelled) setEquipReady(true); });
    return () => { cancelled = true; };
  }, [profile?.id]);

  const cardFx = useMemo(() => {
    if (!cardsReady) return null;
    try {
      return calcCardCombatEffectsFromCollection(cardCollection || {}, {
        enemyFamily: family,
        enemyClass: "monster",
      });
    } catch {
      return null;
    }
  }, [cardsReady, cardCollection, family]);

  const mods = useMemo(() => buildCombatModifiers({ cardFx, equipSpec }), [cardFx, equipSpec]);
  const modifierRows = useMemo(() => describeModifiers(mods), [mods]);

  const effectivePlayer = useMemo(() => {
    const stats = buildAdventurerCombatStats({ member:profile || {}, sharedData:{ ...(sharedData || {}), cardData:cardCollection || {} }, equipSpec });
    return resolveSoloBattlePlayer({ calculated:stats, playerStats, carryOver:isDungeonEncounter });
  }, [profile, sharedData, cardCollection, equipSpec, playerStats, isDungeonEncounter]);

  useEffect(() => {
    if (!family || !tier || !profile?.id || !cardsReady || !equipReady || battleState) return undefined;
    let cancelled = false;
    const identity = { memberId:profile.id, family, tier:Number(tier) };

    (async () => {
      try {
        if (isDungeonEncounter) {
          const saved = await loadMultiMonsterLocalBattle(storageIdentity);
          if (saved?.battleState && saved.battleId === (dungeonBattleId || encounter.encounterId)) {
            setBattleMeta({ battleId:saved.battleId, encounterSeed:saved.encounterSeed, actionHistory:saved.actionHistory || [] });
            setBattleState(saved.battleState);
            setVisualState(saved.battleState);
            setSelectedTarget(Number.isInteger(saved.selectedTarget) ? saved.selectedTarget : 0);
            setAttackMode(saved.attackMode === "all" ? "all" : "focus");
            setArrows(Array.isArray(saved.arrows) ? saved.arrows : []);
            setScreen(saved.terminal === "lose" ? "lose" : "input");
            return;
          }
          const monsters = encounter.targets.map(target => ({ ...target }));
          const initial = createMultiMonsterBattleState(monsters, effectivePlayer, { mods });
          const nextMeta = { battleId:dungeonBattleId || encounter.encounterId, encounterSeed:encounter.seed, actionHistory:[] };
          await saveMultiMonsterLocalBattle({ ...storageIdentity, ...nextMeta, battleState:initial, selectedTarget:0, attackMode:"focus", arrows:[], terminal:null });
          setBattleMeta(nextMeta);
          setBattleState(initial);
          setVisualState(initial);
          setSelectedTarget(Math.max(0, initial.monsters.findIndex(monster => monster.alive)));
          setScreen("intro");
          try { sfxBattleIntroSafe(); } catch {}
          return;
        }
        const saved = await loadMultiMonsterLocalBattle(identity);
        if (cancelled) return;
        if (saved?.battleState && saved.family === family && Number(saved.tier) === Number(tier)) {
          const restoredState = saved.battleState;
          const nextTarget = Number.isInteger(saved.selectedTarget)
            ? saved.selectedTarget
            : Math.max(0, restoredState.monsters.findIndex(monster => monster.alive && !monster.isRunePillar));
          pendingBattleMetaRef.current = null;
          setStartError("");
          setBattleMeta({
            battleId:saved.battleId,
            encounterSeed:saved.encounterSeed,
            actionHistory:Array.isArray(saved.actionHistory) ? saved.actionHistory : [],
          });
          setBattleState(restoredState);
          setVisualState(restoredState);
          setSelectedTarget(nextTarget);
          setAttackMode(saved.attackMode === "all" ? "all" : "focus");
          setArrows(Array.isArray(saved.arrows) ? saved.arrows : []);
          const frontMonsters = restoredState.monsters.filter(monster => !monster.isRunePillar);
          const won = saved.terminal === "win" || (frontMonsters.length > 0 && frontMonsters.every(monster => monster.alive === false || Number(monster.currentHp) <= 0));
          const lost = saved.terminal === "lose" || Number(restoredState.player?.hp) <= 0;
          if (won) {
            setSettlementError("此戰已完成，但獎勵尚未確認入帳。請重新同步結算。");
            setScreen("settlement_error");
          } else if (lost) {
            setScreen("lose");
          } else {
            setScreen("input");
          }
          return;
        }

        const meta = pendingBattleMetaRef.current || createMultiMonsterBattleIdentity(identity);
        pendingBattleMetaRef.current = meta;
        const encounter = generateMultiMonsterEncounter(family, tier, { rand:createMultiMonsterLocalRandom(meta.encounterSeed) });
        const initial = createMultiMonsterBattleState(encounter.monsters, effectivePlayer, { mods });
        const selected = Math.max(0, initial.monsters.findIndex(monster => monster.alive && !monster.isRunePillar));
        const quota = await consumeFreeHuntAttempt({
          memberId:profile.id, mode:FREE_HUNT_QUOTA_MODE.MULTI, battleId:meta.battleId,
        });
        if (!quota?.ok || cancelled) return;
        const nextMeta = { ...meta, actionHistory:[] };
        await saveMultiMonsterLocalBattle({
          ...identity,
          ...nextMeta,
          battleState:initial,
          selectedTarget:selected,
          attackMode:"focus",
          arrows:[],
          terminal:null,
        });
        if (cancelled) return;
        pendingBattleMetaRef.current = null;
        setStartError("");
        setBattleMeta(nextMeta);
        setBattleState(initial);
        setVisualState(initial);
        setSelectedTarget(selected);
        setScreen("intro");
        try {
          const maybePromise = sfxBattleIntroSafe();
          if (maybePromise?.catch) maybePromise.catch(() => {});
        } catch {}
      } catch (error) {
        if (cancelled) return;
        console.error("[MultiMonsterBattle:init]", error);
        setStartError(freeHuntQuotaErrorMessage(error, FREE_HUNT_QUOTA_MODE.MULTI));
        setScreen("error");
      }
    })();

    return () => { cancelled = true; };
  }, [family, tier, cardsReady, equipReady, battleState, effectivePlayer, mods, profile?.id, encounter, dungeonBattleId, isDungeonEncounter, storageIdentity]);

  // Intro timing must live outside encounter initialization. The init effect sets
  // battleState, which immediately causes that effect to re-run; keeping this timer
  // there would make React cleanup cancel it before the 2.5s transition can fire.
  useEffect(() => {
    if (screen !== "intro") return undefined;
    const timer = setTimeout(() => setScreen("input"), 2500);
    return () => clearTimeout(timer);
  }, [screen]);

  const chooseTarget = useCallback(index => {
    const target = visualState?.monsters?.[index];
    if (screen !== "input" || !target?.alive) return;
    setSelectedTarget(index);
    setAttackMode("focus");
    sfxTap();
  }, [screen, visualState]);

  const addScore = useCallback(score => {
    const target = visualState?.monsters?.[selectedTarget];
    if (screen !== "input" || arrows.length >= ARROWS_PER_ROUND) return;
    if (attackMode === "focus" && !target?.alive) return;
    sfxTap();
    setArrows(previous => [...previous, {
      score,
      isMiss: score === "M",
      targetIndex: attackMode === "all" ? -1 : selectedTarget,
    }]);
  }, [screen, arrows.length, visualState, selectedTarget, attackMode]);

  const undo = useCallback(() => {
    if (screen !== "input" || !arrows.length) return;
    sfxTap();
    setArrows(previous => previous.slice(0, -1));
    autoSubmitRef.current = false;
  }, [screen, arrows.length]);

  const showPhase = useCallback(async phaseId => {
    const label = PHASE_LABEL[phaseId];
    if (!label) return;
    setPhaseBanner({ icon: label[0], label: label[1] });
    await sleep(phaseId === MULTI_BATTLE_PHASE.CAT ? 240 : 650);
    setPhaseBanner(null);
  }, []);

  const applyVisualEvent = useCallback(async (event, token) => {
    if (token !== playToken.current) return;
    const p = event.payload || {};
    setActiveEvent(event.overlay === false || event.type === "multi_target_damage_batch" || event.type === MULTI_BATTLE_EVENT.STATUS_TICK ? null : event);

    if (event.type === "multi_target_damage_batch") {
      safeSound(sfxArrowShoot);
      await sleep(150);
      if (token !== playToken.current) return;
      safeSound(event.hits.some(hit => hit.isCrit) ? sfxCritBoom : sfxArrowHit);
      setMonsterDamageFloats(Object.fromEntries(event.hits.map(hit => [hit.targetIndex, { text:`-${hit.damage}`, crit:hit.isCrit }])));
      setVisualState(prev => event.hits.reduce((next, hit) => updateMonster(next, hit.targetIndex, { currentHp:hit.remainingHp }), prev));
      await sleep(event.hits.some(hit => hit.isCrit) ? 720 : 520);
      setMonsterDamageFloats({});
    } else if ([MULTI_BATTLE_EVENT.ARROW_HIT, MULTI_BATTLE_EVENT.ARROW_CRIT].includes(event.type)) {
      safeSound(sfxArrowShoot);
      await sleep(150);
      if (token !== playToken.current) return;
      safeSound(event.type === MULTI_BATTLE_EVENT.ARROW_CRIT ? sfxCritBoom : sfxArrowHit);
      setShakeIndex(p.targetIndex);
      setMonsterFloat({ index: p.targetIndex, text: `-${p.damage}`, crit: !!p.isCrit });
      setVisualState(prev => updateMonster(prev, p.targetIndex, { currentHp: p.remainingHp }));
      await sleep(p.isCrit ? 720 : 520);
    } else if (event.type === MULTI_BATTLE_EVENT.ARROW_MISS) {
      safeSound(sfxArrowShoot);
      setMonsterFloat({ index: p.targetIndex, text: "MISS", miss: true });
      await sleep(460);
    } else if (event.type === MULTI_BATTLE_EVENT.MONSTER_KILLED) {
      safeSound(sfxMonsterDead);
      setKnockoutIndex(p.targetIndex);
      setVisualState(prev => updateMonster(prev, p.targetIndex, { currentHp: 0, alive: false }));
      await sleep(1150);
      setKnockoutIndex(null);
    } else if ([MULTI_BATTLE_EVENT.STATUS_APPLIED, MULTI_BATTLE_EVENT.CAT_STATUS].includes(event.type)) {
      safeSound(sfxDebuff);
      setVisualState(prev => updateMonster(prev, p.targetIndex, { statuses: p.statuses || [] }));
      await sleep(SOLO_PRESENTATION_POLICY.skipHiddenStatusWait ? 40 : 500);
    } else if (event.type === MULTI_BATTLE_EVENT.CAT_ATTACK) {
      safeSound(sfxCast);
      setShakeIndex(p.targetIndex);
      setMonsterFloat({ index: p.targetIndex, text: `🐾 -${p.damage}`, cat: true });
      setVisualState(prev => updateMonster(prev, p.targetIndex, { currentHp: p.remainingHp }));
      await sleep(700);
    } else if ([MULTI_BATTLE_EVENT.CAT_HEAL, MULTI_BATTLE_EVENT.CAT_SHIELD].includes(event.type)) {
      safeSound(sfxBuff);
      setPlayerFloat({
        text: event.type === MULTI_BATTLE_EVENT.CAT_HEAL ? `+${p.heal} HP` : `+${p.shield} 護盾`,
        heal: true,
      });
      setVisualState(prev => prev ? {
        ...prev,
        player: { ...prev.player, hp: p.playerHp ?? prev.player.hp },
        playerShield: p.playerShield ?? prev.playerShield,
      } : prev);
      await sleep(580);
    } else if (event.type === MULTI_BATTLE_EVENT.STATUS_TICK) {
      safeSound(sfxDebuff);
      setShakeIndex(p.targetIndex);
      setMonsterFloat({ index: p.targetIndex, text: `-${p.damage}`, color:MONSTER_STATUSES[p.status?.id]?.color || "#fbbf24" });
      setVisualState(prev => updateMonster(prev, p.targetIndex, { currentHp: p.remainingHp, statuses: p.statuses || [] }));
      await sleep(280);
    } else if (event.type === MULTI_BATTLE_EVENT.STATUS_EXPIRED) {
      setVisualState(prev => updateMonster(prev, p.targetIndex, { statuses: p.statuses || [] }));
      await sleep(300);
    } else if (event.type === MULTI_BATTLE_EVENT.MONSTER_ATTACK) {
      safeSound(sfxCounter);
      setPlayerFloat({ text: p.shieldAbsorbed ? `-${p.damage} HP · 🛡${p.shieldAbsorbed}` : `-${p.damage} HP` });
      setVisualState(prev => prev ? {
        ...prev,
        player: { ...prev.player, hp: p.playerHp },
        playerShield: p.playerShield,
      } : prev);
      await sleep(680);
    } else if (event.type === MULTI_BATTLE_EVENT.MONSTER_BLOCKED) {
      safeSound(sfxDebuff);
      setMonsterFloat({ index: p.targetIndex, text: "⚡ 反擊中斷", miss: true });
      await sleep(560);
    } else if (event.type === MULTI_BATTLE_EVENT.REFLECT_DAMAGE) {
      setShakeIndex(p.targetIndex);
      setMonsterFloat({ index: p.targetIndex, text: `↩ -${p.damage}` });
      setVisualState(prev => updateMonster(prev, p.targetIndex, { currentHp: p.remainingHp }));
      await sleep(500);
    } else if (event.type === MULTI_BATTLE_EVENT.PLAYER_RECOVER) {
      safeSound(sfxBuff);
      setPlayerFloat({ text: `+${p.heal} HP`, heal: true });
      setVisualState(prev => prev ? { ...prev, player: { ...prev.player, hp: p.playerHp } } : prev);
      await sleep(560);
    } else if (event.type === MULTI_BATTLE_EVENT.RUNE_PILLAR_HEAL) {
      safeSound(sfxBuff);
      setMonsterFloat({ index: p.targetIndex, text: `+${p.heal}`, heal: true });
      setVisualState(prev => updateMonster(prev, p.targetIndex, { currentHp: p.remainingHp }));
      await sleep(500);
    } else if (event.type === MULTI_BATTLE_EVENT.ROUND_END) {
      safeSound(sfxRoundEnd);
      await sleep(320);
    } else if (event.type === MULTI_BATTLE_EVENT.BATTLE_WIN) {
      safeSound(sfxVictoryFanfare);
      setPhaseBanner({ icon:"🏆", label:"討伐成功" });
      await sleep(1400);
      setPhaseBanner(null);
    } else if (event.type === MULTI_BATTLE_EVENT.BATTLE_LOSE) {
      safeSound(sfxDefeat);
      setPhaseBanner({ icon:"💀", label:"討伐失敗" });
      await sleep(1400);
      setPhaseBanner(null);
    }

    setShakeIndex(null);
    setMonsterFloat(null);
    setPlayerFloat(null);
  }, []);

  const settleVictory = useCallback(async defeated => {
    if (!profile?.id) throw new Error("missing_member_profile");
    if (!battleMeta?.battleId) throw new Error("missing_battle_identity");
    if (isDungeonEncounter) return { dungeonEncounter:true, defeated, monsterCount:defeated.length };
    if (settlementRef.current) return settlementRef.current;

    const settlementPromise = (async () => {
      const receipt = await claimMultiMonsterBattleReward({
        battleId:battleMeta.battleId,
        memberId:profile.id,
        family,
        tierIndex:Number(tier),
        monsterIds:defeated.map(monster => monster.id),
        mode:"student",
        challengeLevel:"standard",
      });
      if (!receipt?.ok) throw new Error(receipt?.reason || "multi_reward_claim_failed");
      const trusted = receipt.reward || {};
      const materials = Object.entries(trusted.materialTotals || {}).map(([id, rawQuantity]) => {
        const quantity = Math.max(0, Number(rawQuantity) || 0);
        if (!quantity) return null;
        const meta = MATERIAL_BY_ID[id] || {};
        return {
          id,
          quantity,
          name:meta.name || id,
          icon:meta.icon || meta.emoji || "素材",
        };
      }).filter(Boolean);
      return {
        ...trusted,
        materials,
        monsterCount:defeated.length,
      };
    })();

    settlementRef.current = settlementPromise;
    try {
      return await settlementPromise;
    } catch (error) {
      settlementRef.current = null;
      throw error;
    }
  }, [profile?.id, battleMeta?.battleId, family, tier, isDungeonEncounter]);

  const finalizeVictory = useCallback(async finalState => {
    const defeated = finalState?.monsters?.filter(monster => !monster.isRunePillar && !monster.alive) || [];
    setSettlementError("");
    setScreen("settling");
    try {
      const reward = await settleVictory(defeated);
      await clearMultiMonsterLocalBattle(storageIdentity);
      setDrops(reward);
      setScreen("win");
    } catch (error) {
      console.error("[MultiMonsterBattle:settlement]", error);
      setSettlementError(error?.message === "missing_member_profile"
        ? "找不到會員資料，無法安全入帳。"
        : "戰利品同步失敗；可重新同步，已成功入帳的怪物不會重複發放。");
      setScreen("settlement_error");
    }
  }, [settleVictory, storageIdentity]);

  const playRound = useCallback(async currentArrows => {
    if (!battleState || screen !== "input") return;
    const token = ++playToken.current;
    setScreen("presenting");
    const result = processMultiMonsterRound(battleState, currentArrows, {
      mods,
      cat,
      selectedTarget,
      attackMode,
    });
    if (profile?.id && battleMeta?.battleId) recordBattleRoundArrows({ memberId:profile.id, battleId:battleMeta.battleId, round:battleState.round || 1, count:currentArrows.length, accountType:profile?.accountType || "official" }).catch(()=>{});
    const nextSelectedTarget = Math.max(0, result.nextState.monsters.findIndex(monster => monster.alive && !monster.isRunePillar));
    const actionHistory = [
      ...(battleMeta?.actionHistory || []),
      {
        round:result.nextState.round,
        attackMode,
        selectedTarget,
        arrows:currentArrows.map(arrow => ({ score:arrow.score, targetIndex:arrow.targetIndex })),
      },
    ].slice(-120);
    const nextMeta = battleMeta ? { ...battleMeta, actionHistory } : battleMeta;
    if (nextMeta?.battleId) {
      await saveMultiMonsterLocalBattle({
        ...storageIdentity,
        ...nextMeta,
        battleState:result.nextState,
        selectedTarget:nextSelectedTarget,
        attackMode,
        arrows:[],
        terminal:result.result || null,
      });
      setBattleMeta(nextMeta);
    }
    let lastPhase = null;
    const livingEnemyCount=battleState.monsters.filter(monster=>monster.alive&&!monster.isRunePillar).length;
    let killedCount=0;
    for (const event of groupSoloPresentationBeats(result.events, SOLO_PRESENTATION_POLICY)) {
      if (token !== playToken.current) return;
      if (event.type === MULTI_BATTLE_EVENT.PHASE) {
        if (event.phase !== lastPhase && PHASE_LABEL[event.phase]) {
          lastPhase = event.phase;
          await showPhase(event.phase);
        }
        continue;
      }
      if (event.phase !== lastPhase && PHASE_LABEL[event.phase]) {
        lastPhase = event.phase;
        await showPhase(event.phase);
      }
      await applyVisualEvent(event, token);
      if(event.type===MULTI_BATTLE_EVENT.MONSTER_KILLED)killedCount+=1;
      if(shouldFinishSoloPresentation({result:result.result,eventType:event.type,killedCount,livingEnemyCount}))break;
    }
    if (token !== playToken.current) return;

    setBattleState(result.nextState);
    setVisualState(result.nextState);
    setActiveEvent(null);
    if (result.result === "win") {
      await finalizeVictory(result.nextState);
      return;
    }
    if (result.result === "lose") {
      setScreen("lose");
      return;
    }
    setArrows([]);
    autoSubmitRef.current = false;
    setSelectedTarget(nextSelectedTarget);
    setScreen("input");
  }, [battleState, screen, mods, cat, selectedTarget, attackMode, showPhase, applyVisualEvent, finalizeVictory, battleMeta, profile?.id, storageIdentity]);

  useEffect(() => {
    if (screen !== "input" || !battleState || !battleMeta?.battleId) return undefined;
    const timer = setTimeout(() => {
      saveMultiMonsterLocalBattle({
        ...storageIdentity,
        ...battleMeta,
        battleState,
        selectedTarget,
        attackMode,
        arrows,
        terminal:null,
      }).catch(() => {});
    }, 80);
    return () => clearTimeout(timer);
  }, [screen, battleState, battleMeta, profile?.id, storageIdentity, selectedTarget, attackMode, arrows]);

  const abandonBattle = useCallback(async ({ confirmActive = true } = {}) => {
    if (confirmActive && battleState && typeof window !== "undefined" && !window.confirm("戰鬥尚未結束，離開後會放棄這場本機戰鬥。確定離開？")) return;
    playToken.current += 1;
    await clearMultiMonsterLocalBattle(storageIdentity);
    onBack?.();
  }, [battleState, storageIdentity, onBack]);

  useEffect(() => {
    if (screen !== "input" || arrows.length !== ARROWS_PER_ROUND || autoSubmitRef.current) return undefined;
    autoSubmitRef.current = true;
    const timer = setTimeout(() => playRound(arrows), 260);
    return () => clearTimeout(timer);
  }, [screen, arrows, playRound]);

  useEffect(() => () => { playToken.current += 1; }, []);

  if (screen === "error") return <SimpleResult title="無法開始複數討伐" icon="❌" subtitle={startError || "遭遇生成失敗"} onClick={onBack} button="返回" />;
  if (!visualState) return <div style={S.loading}>⚔️ 載入戰鬥資料…</div>;
  if (screen === "settling") return <SimpleResult title="戰利品結算中…" icon="⏳" subtitle="正在同步三隻怪物的掉落、材料與射手經驗" />;
  if (screen === "settlement_error") return <SimpleResult title="結算同步失敗" icon="⚠️" subtitle={settlementError} onClick={() => finalizeVictory(visualState)} button="重新同步獎勵" />;
  if (screen === "win") return <VictoryResult subtitle={`第 ${visualState.round} 回合擊敗全部怪物`} reward={drops} onClick={() => onWin?.(drops, visualState, battleMeta)} />;
  if (screen === "lose") return <SimpleResult title="戰敗" icon="💀" subtitle={`撐到第 ${visualState.round} 回合`} onClick={async () => {
    if (isDungeonEncounter && onLose) {
      await clearMultiMonsterLocalBattle(storageIdentity);
      onLose(visualState, battleMeta);
      return;
    }
    abandonBattle({ confirmActive:false });
  }} button="返回" />;

  const player = visualState.player;
  const livePlayerStats = getMultiMonsterPlayerStats(visualState);
  const playerName = profile?.nickname || profile?.name || profile?.displayName || "射手";
  const alive = visualState.monsters.filter(m => m.alive && !m.isRunePillar).length;
  const frontMonsters = visualState.monsters
    .map((monster, index) => ({ monster, index }))
    .filter(({ monster }) => !monster.isRunePillar);
  const rearPillars = visualState.monsters
    .map((monster, index) => ({ monster, index }))
    .filter(({ monster }) => monster.isRunePillar);
  const bg = getBattleBackgroundUrl(family);
  const currentRound = Math.max(1, visualState.round + (screen === "input" ? 1 : 0));

  return <div data-multi-monster-battle="true" style={{ ...S.root, backgroundImage: `linear-gradient(180deg,rgba(2,6,23,.72),rgba(2,6,23,.15) 42%,rgba(2,6,23,.94)),url(${bg})` }}>
    <style>{CSS}</style>
    <header style={S.header}>
      <button style={S.back} onClick={() => abandonBattle({ confirmActive:true })}>←</button>
      <div style={S.headerCenter}><small>ENCOUNTER</small><b>第 {currentRound} 回合</b></div>
      <div style={S.alive}>👾 {alive}</div>
      <div style={S.playerBarRow}>
        <div style={S.playerNameAndMods}><span style={S.playerIdentity}><PlayerAvatar avatarId={profile?.avatarId} size={28}/><span>{playerName}</span></span>{modifierRows.length > 2 ? <button type="button" style={S.modButton} onClick={()=>setShowModifiers(true)}>✨ 加成 {modifierRows.length}</button> : modifierRows.length > 0 && <div style={S.modRows}>{modifierRows.map((row, i) => <span key={`${row.label}-${i}`} style={S.modPill}>{row.icon} {row.text}</span>)}</div>}</div>
        <b>{Math.round(livePlayerStats.hp)} / {Math.round(livePlayerStats.maxHp)}</b>
      </div>
      <div style={S.hpTrack}><div style={{ ...S.playerHp, width: `${Math.max(0, Math.min(100, livePlayerStats.hp / Math.max(1, livePlayerStats.maxHp) * 100))}%` }} /></div>
      <div data-multi-player-stats="true" style={S.playerStatsRow}>
        <LivePlayerStat icon="❤️" label="HP" value={Math.round(livePlayerStats.hp)} suffix={` / ${Math.round(livePlayerStats.maxHp)}`} />
        <LivePlayerStat icon="⚔️" label="ATK" value={Math.round(livePlayerStats.atk)} base={Math.round(livePlayerStats.baseAtk)} />
        <LivePlayerStat icon="🛡️" label="DEF" value={Math.round(livePlayerStats.def)} base={Math.round(livePlayerStats.baseDef)} />
      </div>
      {visualState.playerShield > 0 && <div style={S.shield}>🛡 護盾 {visualState.playerShield}</div>}
    </header>

    <main style={S.battlefield}>
      {rearPillars.length > 0 && <div style={S.rearLine}>
        {rearPillars.map(({ monster, index }) => <Monster
          key={monster.instanceId || `${monster.id}-${index}`}
          monster={monster}
          index={index}
          selected={attackMode === "all" ? monster.alive : selectedTarget === index}
          allTarget={attackMode === "all"}
          disabled={screen !== "input"}
          onSelect={() => chooseTarget(index)}
          shaking={shakeIndex === index}
          knockout={knockoutIndex === index}
          floating={monsterDamageFloats[index] || (monsterFloat?.index === index ? monsterFloat : null)}
        />)}
      </div>}
      <div style={S.enemyLine}>
        {frontMonsters.map(({ monster, index }) => <Monster
          key={monster.instanceId || `${monster.id}-${index}`}
          monster={monster}
          index={index}
          selected={attackMode === "all" ? monster.alive : selectedTarget === index}
          allTarget={attackMode === "all"}
          disabled={screen !== "input"}
          onSelect={() => chooseTarget(index)}
          shaking={shakeIndex === index}
          knockout={knockoutIndex === index}
          floating={monsterDamageFloats[index] || (monsterFloat?.index === index ? monsterFloat : null)}
        />)}
      </div>
      {cat.hasCat && <div style={S.catBadge} data-multi-solo-cat="true"><CatSVG catId={cat.catId} size={30}/><span><b>{cat.catName || "貓貓"}</b> · 羈絆 Lv.{cat.bondLv || 0} · ATK {cat.catATK || 0}</span></div>}
      {screen === "input" && <div style={S.targetHint}>{attackMode === "all"
        ? "⚔️ 全員攻擊 · 每個目標傷害 -50%"
        : `🎯 ${visualState.monsters[selectedTarget]?.name || "選擇目標"}`}</div>}
      {activeEvent && screen === "presenting" && <div style={S.eventText}>{eventText(activeEvent)}</div>}
      {playerFloat && <div style={{ ...S.playerFloat, color: playerFloat.heal ? "#86efac" : "#fecaca" }}>{playerFloat.text}</div>}
    </main>

    {screen === "input" && <section style={S.inputDock}>
      <div style={S.modeRow}>
        <button type="button" style={{ ...S.modeBtn, ...(attackMode === "focus" ? S.modeBtnActive : {}) }} onClick={() => { setAttackMode("focus"); sfxTap(); }}>🎯 單一集火</button>
        <button type="button" style={{ ...S.modeBtn, ...(attackMode === "all" ? S.modeBtnActive : {}) }} onClick={() => { setAttackMode("all"); sfxTap(); }}>⚔️ 全員攻擊 -50%</button>
      </div>
      <div style={S.arrowRow}>{Array.from({ length: ARROWS_PER_ROUND }).map((_, i) => {
        const arrow = arrows[i];
        return <div key={i} style={{ ...S.arrowSlot, ...(arrow ? S.arrowFilled : {}) }}>
          {arrow ? <><b>{arrow.score}</b><small>{arrow.targetIndex < 0 ? "ALL" : `#${arrow.targetIndex + 1}`}</small></> : i + 1}
        </div>;
      })}</div>
      <div style={S.keypad}>{SCORE_KEYS.map(score => <button
        key={score}
        style={{ ...S.scoreBtn, ...(score === "X" ? S.xBtn : score === "M" ? S.mBtn : {}) }}
        onClick={() => addScore(score)}
      >{score}</button>)}</div>
      <div style={S.inputFoot}><span>輸入第 {Math.min(6, arrows.length + 1)} / 6 箭</span><button onClick={undo} disabled={!arrows.length} style={S.undo}>↶ 撤回</button></div>
    </section>}

    {screen === "presenting" && <div style={S.locked}>戰鬥演出中 · 本回合已鎖定</div>}
    {phaseBanner && <div style={S.banner}><div>{phaseBanner.icon}</div><b>{phaseBanner.label}</b></div>}
    {screen === "intro" && <BattleIntro monsters={visualState.monsters} bg={bg} playerName={playerName} avatarId={profile?.avatarId} cat={cat} />}
    {showModifiers && <div role="dialog" aria-modal="true" aria-label="本場戰鬥加成" style={S.modBackdrop} onClick={()=>setShowModifiers(false)}><section style={S.modSheet} onClick={event=>event.stopPropagation()}><div style={S.modSheetHead}><b>✨ 本場戰鬥加成</b><button type="button" onClick={()=>setShowModifiers(false)}>關閉</button></div><div style={S.modList}>{modifierRows.map((row,i)=><div key={`${row.label}-${i}`} style={S.modListRow}><span>{row.icon}</span><b>{row.text}</b></div>)}</div></section></div>}
  </div>;
}

function updateMonster(state, index, patch) {
  if (!state || index == null || !state.monsters?.[index]) return state;
  return { ...state, monsters: state.monsters.map((monster, i) => i === index ? { ...monster, ...patch } : monster) };
}

function LivePlayerStat({ icon, label, value, base = null, suffix = "" }) {
  const hasBase = Number.isFinite(base);
  const delta = hasBase ? Number(value) - Number(base) : 0;
  const changed = hasBase && delta !== 0;
  return <div style={{
    ...S.liveStat,
    ...(changed ? (delta > 0 ? S.liveStatUp : S.liveStatDown) : {}),
  }}>
    <span style={S.liveStatLabel}>{icon} {label}</span>
    <b style={S.liveStatValue}>{value}{suffix}</b>
    {changed && <small style={S.liveStatDelta}>{delta > 0 ? "+" : ""}{delta}</small>}
  </div>;
}

function BattleIntro({ monsters, bg, playerName, avatarId, cat }) {
  return <div style={{ ...S.intro, backgroundImage: `linear-gradient(135deg,rgba(2,6,23,.96),rgba(15,23,42,.68)),url(${bg})` }}>
    <div style={S.introSide} data-multi-solo-intro-player="true">
      <div style={S.archerPortrait}><PlayerAvatar avatarId={avatarId} size={88}/></div>
      <small>ARCHER</small><b>{playerName}</b>
      {cat?.hasCat && <div style={S.introCat}><CatSVG catId={cat.catId} size={42}/><span><b>{cat.catName || "貓貓"}</b><small>{cat.catType || "allround"} · 羈絆 Lv.{cat.bondLv || 0}</small></span></div>}
    </div>
    <div style={S.vs}>VS</div>
    <div style={S.introEnemies}>
      <div style={S.introMonsterLine}>{monsters.filter(m => !m.isRunePillar).slice(0, 4).map((monster, i) => <BattleMonsterImage key={monster.instanceId || i} monster={monster} style={{ width: 72, height: 72, marginLeft: i ? -18 : 0 }} />)}</div>
      <small>ENEMY GROUP</small>
    </div>
  </div>;
}

function BattleMonsterImage({ monster, style }) {
  const sources = getBattleMonsterSources(monster.id);
  const [sourceIndex, setSourceIndex] = useState(0);
  if (monster.isRunePillar) return <div style={{ ...style, display: "grid", placeItems: "center", fontSize: 48 }}>🔮</div>;
  if (sourceIndex >= sources.length) return <div style={{ ...style, display: "grid", placeItems: "center", fontSize: 46 }}>👾</div>;
  return <img
    src={sources[sourceIndex]}
    alt={monster.name || "怪物"}
    onError={() => setSourceIndex(index => index + 1)}
    style={{ objectFit: "contain", filter: "drop-shadow(0 12px 12px rgba(0,0,0,.65))", ...style }}
  />;
}

function Monster({ monster, index, selected, allTarget, disabled, onSelect, shaking, knockout, floating }) {
  const hpPct = Math.max(0, Math.min(100, monster.currentHp / Math.max(1, monster.maxHp) * 100));
  const statuses = describeMonsterStatuses(monster.statuses || []);
  return <button
    disabled={disabled || !monster.alive}
    onClick={onSelect}
    style={{
      ...S.monster,
      ...(selected && monster.alive ? S.monsterSelected : {}),
      opacity: knockout ? 1 : monster.alive ? 1 : .22,
      animation: knockout ? "mmKO 1.15s ease forwards" : shaking ? "mmShake .36s ease" : "mmMonsterIdle 2.8s ease-in-out infinite",
    }}
  >
    {selected && monster.alive && <span style={S.targetTag}>{allTarget ? "ALL" : "TARGET"}</span>}
    <BattleMonsterImage monster={monster} style={{ width: 86, height: 92 }} />
    <div style={S.monsterName}>#{index + 1} {monster.name}</div>
    {statuses.length > 0 && <div style={S.statuses} role="status" aria-live="polite" aria-label={statuses.map(status => status.text).join("、")}>{statuses.slice(0, 3).map((status, i) => <span key={`${status.id || "status"}-${i}`} style={S.statusPill} title={status.text} aria-hidden="true">{status.icon || "☠️"}</span>)}</div>}
    {!monster.isRunePillar && monster.variantLabel && <small style={S.variantTag}>{monster.variantLabel}</small>}
    <div style={S.monHpTrack}><div style={{ ...S.monHp, width: `${hpPct}%` }} /></div>
    <small style={S.monHpText}>{Math.round(monster.currentHp)}/{Math.round(monster.maxHp)}</small>
    {knockout && <div style={S.koStamp}>擊倒</div>}
    {floating && <div role="status" aria-live="polite" style={{ ...S.float, color:floating.color || (floating.heal ? "#86efac" : floating.miss ? "#fde68a" : floating.crit ? "#fbbf24" : "#fecaca") }}>{floating.text}</div>}
  </button>;
}

function eventText(event) {
  const p = event.payload || {};
  switch (event.type) {
    case MULTI_BATTLE_EVENT.ARROW_HIT: return `第 ${(p.arrowIndex ?? 0) + 1} 箭命中 ${p.monsterName || "怪物"} · ${p.damage} 傷害`;
    case MULTI_BATTLE_EVENT.ARROW_CRIT: return `💥 第 ${(p.arrowIndex ?? 0) + 1} 箭爆擊 · ${p.damage} 傷害`;
    case MULTI_BATTLE_EVENT.ARROW_MISS: return `第 ${(p.arrowIndex ?? 0) + 1} 箭脫靶`;
    case MULTI_BATTLE_EVENT.CAT_ATTACK: return `🐾 貓貓追擊 ${p.monsterName || "怪物"} · ${p.damage} 傷害`;
    case MULTI_BATTLE_EVENT.CAT_HEAL: return `🐱 貓貓治療 +${p.heal} HP`;
    case MULTI_BATTLE_EVENT.CAT_SHIELD: return `🐱 貓貓護盾 +${p.shield}`;
    case MULTI_BATTLE_EVENT.STATUS_TICK: return `☠️ 異常傷害 · ${p.monsterName || "怪物"} -${p.damage}`;
    case MULTI_BATTLE_EVENT.MONSTER_ATTACK: return `👹 ${p.monsterName} 反擊 · -${p.damage} HP`;
    case MULTI_BATTLE_EVENT.MONSTER_BLOCKED: return `⚡ ${p.monsterName} 無法反擊`;
    case MULTI_BATTLE_EVENT.PLAYER_RECOVER: return `💚 回合恢復 +${p.heal} HP`;
    case MULTI_BATTLE_EVENT.RUNE_PILLAR_HEAL: return `🔮 符文柱治療 ${p.monsterName} +${p.heal}`;
    default: return "";
  }
}

function SimpleResult({ title, icon, subtitle, onClick, button }) {
  return <div style={S.simple}>
    <div style={{ fontSize: 58 }}>{icon}</div>
    <h2>{title}</h2>
    {subtitle && <p>{subtitle}</p>}
    {button && <button style={S.resultBtn} onClick={onClick}>{button}</button>}
  </div>;
}

function VictoryResult({ subtitle, reward, onClick }) {
  const materials = reward?.materials || [];
  const chests = aggregateRewardChests(reward?.chests || []);
  const cards = reward?.cards || [];
  return <div style={S.simple}>
    <div style={{ fontSize: 58 }}>🏆</div>
    <h2>勝利！</h2>
    {subtitle && <p>{subtitle}</p>}

    <div style={S.rewardGrid}>
      <div style={S.rewardCard}><span>🪙</span><b>{reward?.coins || 0}</b><small>金幣</small></div>
      <div style={S.rewardCard}><span>✨</span><b>{reward?.archerXP || 0}</b><small>射手 EXP</small></div>
    </div>

    <div style={S.rewardSection}>
      <div style={S.rewardTitle}>戰利品清單</div>
      {materials.length > 0 ? materials.map(material => <div key={material.id} style={S.rewardRow}>
        <RewardMaterialIcon material={material}/>
        <span style={S.rewardName}>{material.name}</span>
        <b>×{material.quantity}</b>
      </div>) : <div style={S.rewardEmpty}>本場沒有素材掉落</div>}
      {chests.map((chest, index) => <div key={chest.id || `${chest.type}-${index}`} style={S.rewardRow}>
        <span style={S.rewardIcon}>{chest.icon || "📦"}</span>
        <span style={S.rewardName}>{chest.name || chest.type || chest.id || "寶箱"}</span>
        <b>×{Math.max(1, Number(chest.quantity ?? chest.count ?? chest.qty) || 1)}</b>
      </div>)}
      {cards.map((card, index) => <div key={`${card.monsterId || card.id || "card"}-${index}`} style={S.rewardRow}>
        <span style={S.rewardIcon}>{card.icon || "🎴"}</span>
        <span style={S.rewardName}>{card.name || card.monsterName || card.monsterId || "怪物卡片"}</span>
        <b>卡片</b>
      </div>)}
    </div>

    <button style={S.resultBtn} onClick={onClick}>完成</button>
  </div>;
}

function RewardMaterialIcon({ material }) {
  const [failed,setFailed]=useState(false);
  if(!failed&&material?.id)return <img src={`/items/monster-materials/${material.id}.webp`} alt="" onError={()=>setFailed(true)} style={{...S.rewardIcon,width:28,height:28,objectFit:"cover",borderRadius:7}}/>;
  return <span style={S.rewardIcon}>{material?.icon || "🪨"}</span>;
}

const S = {
  root: { position: "relative", width: "100%", maxWidth: 560, margin: "0 auto", height: "100dvh", minHeight: 620, overflow: "hidden", display: "flex", flexDirection: "column", backgroundSize: "cover", backgroundPosition: "center", color: "#f8fafc", fontFamily: "system-ui,sans-serif" },
  loading: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#020617", color: "#94a3b8" },
  header: { position: "relative", zIndex: 10, padding: "10px 12px 0", display: "grid", gridTemplateColumns: "40px 1fr 52px", gap: 8, alignItems: "center" },
  back: { width: 38, height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,.15)", background: "rgba(2,6,23,.62)", color: "white", fontSize: 20 },
  headerCenter: { display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.05 },
  alive: { justifySelf: "end", padding: "7px 9px", borderRadius: 12, background: "rgba(127,29,29,.48)", fontSize: 11, fontWeight: 900 },
  playerBarRow: { gridColumn: "1/-1", display: "flex", alignItems:"center", justifyContent: "space-between", gap:8, fontSize: 11, padding: "5px 3px 0" },
  playerNameAndMods:{minWidth:0,flex:1,display:"flex",alignItems:"center",gap:8,overflow:"hidden"},
  playerIdentity: { display:"inline-flex", alignItems:"center", gap:7, minWidth:0, fontWeight:900 },
  hpTrack: { gridColumn: "1/-1", height: 7, borderRadius: 999, overflow: "hidden", background: "rgba(127,29,29,.45)" },
  playerHp: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#ef4444,#fb7185)", transition: "width .3s" },
  playerStatsRow: { gridColumn: "1/-1", display: "grid", gridTemplateColumns: "1.35fr 1fr 1fr", gap: 5, marginTop: 3 },
  liveStat: { minWidth: 0, minHeight: 38, padding: "5px 7px", borderRadius: 10, background: "rgba(2,6,23,.7)", border: "1px solid rgba(148,163,184,.18)", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", columnGap: 4 },
  liveStatUp: { border: "1px solid rgba(74,222,128,.5)", background: "rgba(20,83,45,.4)" },
  liveStatDown: { border: "1px solid rgba(248,113,113,.52)", background: "rgba(127,29,29,.38)" },
  liveStatLabel: { fontSize: 7, color: "#94a3b8", fontWeight: 900, letterSpacing: ".04em" },
  liveStatValue: { gridColumn: "1/2", fontSize: 11, color: "#f8fafc", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  liveStatDelta: { gridColumn: "2/3", gridRow: "1/3", alignSelf: "center", fontSize: 8, fontWeight: 1000, color: "#fde68a" },
  shield: { gridColumn: "1/-1", fontSize: 9, color: "#93c5fd", textAlign: "right" },
  modRows: { minWidth:0, display: "flex", gap: 5, overflowX: "auto", padding:"2px 0", scrollbarWidth: "none" },
  modPill: { whiteSpace: "nowrap", flexShrink:0, fontSize: 11, lineHeight:1.2, fontWeight:800, padding: "5px 7px", borderRadius: 999, color:"#e2e8f0", background: "rgba(15,23,42,.82)", border: "1px solid rgba(148,163,184,.28)" },
  modButton:{whiteSpace:"nowrap",flexShrink:0,borderRadius:999,border:"1px solid rgba(250,204,21,.38)",background:"rgba(113,63,18,.76)",color:"#fef3c7",fontSize:12,fontWeight:900,padding:"6px 10px"},
  modBackdrop:{position:"fixed",inset:0,zIndex:140,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(2,6,23,.72)",padding:"12px"},
  modSheet:{width:"100%",maxWidth:520,maxHeight:"70dvh",overflowY:"auto",borderRadius:20,border:"1px solid rgba(250,204,21,.28)",background:"#0f172a",padding:16,boxShadow:"0 -18px 55px rgba(0,0,0,.5)"},
  modSheetHead:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,fontSize:16,color:"#fef3c7",marginBottom:12},
  modList:{display:"grid",gap:8},
  modListRow:{display:"grid",gridTemplateColumns:"28px 1fr",alignItems:"center",gap:8,minHeight:44,borderRadius:12,background:"rgba(255,255,255,.06)",padding:"9px 12px",fontSize:14,color:"#e2e8f0"},
  battlefield: { position: "relative", zIndex: 3, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 8px 210px" },
  enemyLine: { display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 0, width: "100%", maxWidth: 400 },
  rearLine: { display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, width: "100%", maxWidth: 250, marginBottom: -12, transform: "scale(.82)", transformOrigin: "center bottom", opacity: .94 },
  monster: { position: "relative", width: "clamp(78px,22vw,98px)", minWidth: 0, padding: "5px 2px 7px", margin: "0 -3px", border: "1px solid transparent", borderRadius: 16, background: "transparent", color: "#fff", transition: "opacity .2s,transform .2s", overflow: "visible" },
  monsterSelected: { transform: "translateY(-7px) scale(1.05)", border: "1px solid rgba(251,191,36,.65)", background: "rgba(69,26,3,.35)", animation: "mmTarget 1.2s ease infinite" },
  targetTag: { position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", fontSize: 7, letterSpacing: ".18em", fontWeight: 1000, padding: "3px 7px", borderRadius: 999, background: "#92400e", border: "1px solid #fbbf24", zIndex: 4 },
  monsterName: { fontSize: 9, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center", textShadow: "0 2px 5px #000" },
  monHpTrack: { height: 5, borderRadius: 999, overflow: "hidden", background: "rgba(127,29,29,.55)", margin: "4px 3px 0" },
  monHp: { height: "100%", background: "linear-gradient(90deg,#dc2626,#fb7185)", transition: "width .3s" },
  monHpText: { display: "block", fontSize: 7, color: "#cbd5e1", textAlign: "center", marginTop: 2 },
  variantTag: { display: "block", width: "fit-content", margin: "2px auto 0", padding: "1px 5px", borderRadius: 999, background: "rgba(120,53,15,.65)", color: "#fde68a", fontSize: 7, fontWeight: 900 },
  statuses: { display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap", marginTop: 3 },
  statusPill: { fontSize: 6, padding: "2px 3px", borderRadius: 5, background: "rgba(69,10,10,.55)" },
  koStamp: { position:"absolute", left:"50%", top:"46%", zIndex:30, transform:"translate(-50%,-50%) rotate(-5deg)", padding:"5px 10px", borderRadius:8, border:"2px solid #fecaca", background:"rgba(127,29,29,.88)", color:"#fff", fontSize:13, fontWeight:1000, letterSpacing:".14em", textShadow:"0 2px 6px #000", boxShadow:"0 0 24px rgba(239,68,68,.65)", animation:"mmKOStamp 1.15s ease forwards", pointerEvents:"none" },
  catBadge: { marginTop: 8, fontSize: 9, padding: "5px 9px", borderRadius: 999, background: "rgba(88,28,135,.55)", border: "1px solid rgba(216,180,254,.28)", display:"inline-flex", alignItems:"center", gap:7 },
  targetHint: { marginTop: 7, fontSize: 11, fontWeight: 900, color: "#fde68a", textShadow: "0 2px 5px #000" },
  eventText: { position: "absolute", bottom: 165, left: 18, right: 18, textAlign: "center", fontSize: 11, fontWeight: 800, padding: "8px 10px", borderRadius: 12, background: "rgba(2,6,23,.76)", border: "1px solid rgba(255,255,255,.12)" },
  float: { position: "absolute", top: 20, left: "50%", zIndex: 20, fontSize: 16, fontWeight: 1000, textShadow: "0 2px 7px #000", animation: "mmFloat .9s ease-out forwards", pointerEvents: "none" },
  playerFloat: { position: "absolute", left: "50%", bottom: 195, zIndex: 30, fontSize: 20, fontWeight: 1000, textShadow: "0 2px 8px #000", animation: "mmPlayerFloat .9s ease-out forwards" },
  inputDock: { position: "absolute", zIndex: 20, left: 0, right: 0, bottom: 0, padding: "8px 12px max(12px,env(safe-area-inset-bottom))", background: "linear-gradient(180deg,transparent,rgba(2,6,23,.92) 13%,#020617 44%)" },
  modeRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 7 },
  modeBtn: { height: 34, borderRadius: 10, border: "1px solid rgba(148,163,184,.22)", background: "rgba(15,23,42,.78)", color: "#94a3b8", fontSize: 10, fontWeight: 900 },
  modeBtnActive: { border: "1px solid rgba(251,191,36,.7)", background: "rgba(120,53,15,.62)", color: "#fde68a" },
  arrowRow: { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5, marginBottom: 7 },
  arrowSlot: { height: 34, borderRadius: 9, border: "1px solid rgba(148,163,184,.22)", background: "rgba(15,23,42,.7)", display: "flex", alignItems: "center", justifyContent: "center", gap: 2, color: "#64748b", fontSize: 10 },
  arrowFilled: { color: "#fde68a", border: "1px solid rgba(245,158,11,.5)", background: "rgba(120,53,15,.46)" },
  keypad: { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 },
  scoreBtn: { height: 39, borderRadius: 10, border: "1px solid rgba(255,255,255,.12)", background: "rgba(30,41,59,.9)", color: "#f8fafc", fontWeight: 900, fontSize: 13 },
  xBtn: { background: "linear-gradient(135deg,#d97706,#92400e)", color: "#fff7ed" },
  mBtn: { background: "rgba(127,29,29,.65)", color: "#fecaca" },
  inputFoot: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "#94a3b8" },
  undo: { border: "none", background: "transparent", color: "#cbd5e1", fontSize: 10 },
  locked: { position: "absolute", zIndex: 20, left: 12, right: 12, bottom: 18, textAlign: "center", padding: "11px", borderRadius: 13, background: "rgba(2,6,23,.86)", border: "1px solid rgba(255,255,255,.12)", fontSize: 10, color: "#cbd5e1" },
  banner: { position: "absolute", zIndex: 60, left: "50%", top: "47%", transform: "translate(-50%,-50%)", minWidth: 210, textAlign: "center", padding: "18px 24px", borderRadius: 20, background: "rgba(2,6,23,.9)", border: "1px solid rgba(251,191,36,.45)", boxShadow: "0 20px 60px rgba(0,0,0,.5)", fontSize: 20, animation: "mmBanner .65s ease both" },
  intro: { position: "absolute", zIndex: 100, inset: 0, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 18, padding: 24, backgroundSize: "cover", backgroundPosition: "center", animation: "mmIntroIn .5s ease both" },
  introSide: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5 },
  archerPortrait: { width: 96, height: 96, borderRadius: 26, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#0f172a,#1e3a8a)", border: "2px solid #60a5fa", boxShadow: "0 0 30px rgba(59,130,246,.35)", overflow:"hidden" },
  introCat: { marginTop:6, display:"flex", alignItems:"center", gap:7, padding:"6px 8px", borderRadius:13, background:"rgba(88,28,135,.62)", border:"1px solid rgba(216,180,254,.3)", maxWidth:150, textAlign:"left" },
  vs: { fontSize: 36, fontStyle: "italic", fontWeight: 1000, color: "#fbbf24", textShadow: "0 0 22px rgba(245,158,11,.8)", animation: "mmVs .7s .2s ease both" },
  introEnemies: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  introMonsterLine: { display: "flex", justifyContent: "center", alignItems: "center", maxWidth: 160 },
  simple: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at 50% 32%,#1e293b,#020617 65%)", color: "#f8fafc", padding: 24, textAlign: "center" },
  rewardGrid: { width: "100%", maxWidth: 360, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0" },
  rewardCard: { minHeight: 82, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 16, background: "rgba(15,23,42,.72)", border: "1px solid rgba(251,191,36,.2)" },
  rewardSection: { width: "100%", maxWidth: 360, maxHeight: "38vh", overflowY: "auto", margin: "2px 0 16px", padding: 10, borderRadius: 16, background: "rgba(2,6,23,.72)", border: "1px solid rgba(148,163,184,.16)", textAlign: "left" },
  rewardTitle: { padding: "2px 4px 8px", color: "#fde68a", fontSize: 11, fontWeight: 1000, letterSpacing: ".08em" },
  rewardRow: { minHeight: 38, display: "grid", gridTemplateColumns: "30px 1fr auto", alignItems: "center", gap: 8, padding: "6px 5px", borderTop: "1px solid rgba(148,163,184,.09)", fontSize: 11 },
  rewardIcon: { fontSize: 20, textAlign: "center" },
  rewardName: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e2e8f0", fontWeight: 800 },
  rewardEmpty: { padding: "12px 5px", borderTop: "1px solid rgba(148,163,184,.09)", color: "#64748b", fontSize: 10, textAlign: "center" },
  resultBtn: { minWidth: 150, padding: "12px 18px", border: 0, borderRadius: 14, background: "#f59e0b", color: "#111827", fontWeight: 900 },
};
