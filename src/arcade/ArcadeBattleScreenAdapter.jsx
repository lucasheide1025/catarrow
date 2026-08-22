import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BattleScreen from "../components/battle/BattleScreen";
import { arcadeCatById } from "./arcadeData";
import { resolveRound, rollSoloRing } from "./arcadeBattle";
import { getArcadeEquippedCardEffects, getArcadePlayerStats } from "./arcadeProgression";

function normalizeArrow(score, record) {
  const numeric = Math.max(0, Math.min(10, Number(score) || 0));
  if (record?.nx != null && record?.ny != null) {
    return {
      score:numeric,
      nx:Number(record.nx),
      ny:Number(record.ny),
      displayLabel:record?.displayLabel ?? record?.label ?? record?.score ?? score,
    };
  }
  return { score:numeric, displayLabel:record?.displayLabel ?? record?.score ?? score };
}

function monsterPresentation(monster, hp, statuses) {
  return {
    ...monster,
    hp,
    maxHp:monster.hp,
    statuses,
    bossTagged:monster.ability === "boss",
    encounter:monster.ability === "boss" ? "boss" : monster.elite ? "elite" : "normal",
    tier:monster.ability === "boss" ? "boss" : monster.elite ? "elite" : "normal",
    variant:monster.ability === "boss" ? "boss" : monster.elite ? "strong" : "normal",
  };
}

export default function ArcadeBattleScreenAdapter({
  profile,
  monster,
  playerHp,
  playerState = null,
  runBuffs = null,
  battleState = null,
  onRound,
  onVictory,
  onDefeat,
}) {
  const stats = useMemo(() => getArcadePlayerStats(profile), [profile]);
  const equippedCards = useMemo(() => getArcadeEquippedCardEffects(profile), [profile]);
  const visitorCat = useMemo(() => arcadeCatById(profile?.selectedCat) || arcadeCatById("haji"), [profile?.selectedCat]);
  const initialMonsterHp = Number(battleState?.monsterHp ?? monster?.hp) || 1;
  const [monsterHp, setMonsterHp] = useState(initialMonsterHp);
  const [monsterStatuses, setMonsterStatuses] = useState(() => battleState?.monsterStatuses || []);
  const [roundKey, setRoundKey] = useState(Number(battleState?.roundKey) || 0);
  const [locked, setLocked] = useState(false);
  const [demo, setDemo] = useState(null);
  const [ring, setRing] = useState(() => monster?.ability === "boss" ? (battleState?.ring || rollSoloRing()) : null);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => {
    setMonsterHp(Number(battleState?.monsterHp ?? monster?.hp) || 1);
    setMonsterStatuses(battleState?.monsterStatuses || []);
    setRoundKey(Number(battleState?.roundKey) || 0);
    setRing(monster?.ability === "boss" ? (battleState?.ring || rollSoloRing()) : null);
    setDemo(null);
    setLocked(false);
  }, [monster?.id]); // monster identity is the battle boundary

  const player = useMemo(() => ({
    id:profile?.visitorId || "visitor",
    name:profile?.nickname || "訪客射手",
    lv:stats.level,
    hp:Math.max(0, Number(playerState?.hp ?? playerHp) || 0),
    maxHp:Math.max(1, Number(playerState?.maxHp ?? playerState?.maxHP ?? stats.maxHp) || stats.maxHp),
    atk:Math.max(1, Number(playerState?.atk) || Math.round(stats.atk * (Number(runBuffs?.atkMult) || 1))),
    def:Math.max(0, Number(playerState?.def) || Math.round(stats.def * (Number(runBuffs?.defMult) || 1))),
  }), [profile?.visitorId, profile?.nickname, stats, playerHp, playerState, runBuffs?.atkMult, runBuffs?.defMult]);

  const presentedMonster = useMemo(
    () => monsterPresentation(monster, monsterHp, monsterStatuses),
    [monster, monsterHp, monsterStatuses],
  );

  const handleSubmit = useCallback((scores, arrowRecords) => {
    if (locked || !monster) return;
    setLocked(true);
    const arrows = scores.map((score, index) => normalizeArrow(score, arrowRecords?.[index]));
    const result = resolveRound({
      playerHp:player.hp,
      playerMaxHp:player.maxHp,
      playerAtk:player.atk,
      playerDef:player.def,
      cat:visitorCat,
      monster,
      monsterHp,
      atkBuff:(Number(runBuffs?.damageMult) || Number(runBuffs?.dmgMult) || 1),
      skillChanceBuff:Number(runBuffs?.skillChanceBuff) || 0,
      equippedCards,
      monsterStatuses,
      ring,
    }, arrows);

    setMonsterHp(result.monsterHp);
    setMonsterStatuses(result.monsterStatuses || []);
    const eventKey = `${monster.id}-${roundKey + 1}-${Date.now()}`;
    setDemo({
      type:"arrow",
      key:`${eventKey}-hit`,
      damage:Math.max(0, result.dmg + (result.statusDamage || 0)),
      isMiss:result.dmg <= 0 && (result.statusDamage || 0) <= 0,
      isCrit:result.weakHits > 0,
      message:(result.log || []).map(item => item.text).filter(Boolean).slice(-2).join(" / "),
    });
    const roundResult = { ...result, ring, arrows, monsterId:monster.id, roundKey:roundKey + 1 };
    onRound?.(roundResult);

    if (result.victory) {
      timerRef.current = setTimeout(() => {
        setLocked(false);
        onVictory?.(roundResult);
      }, 650);
      return;
    }
    if (result.defeat) {
      timerRef.current = setTimeout(() => {
        setDemo({ type:"counter", key:`${eventKey}-counter`, damage:result.counter || 0 });
        setLocked(false);
        onDefeat?.(roundResult);
      }, 650);
      return;
    }

    timerRef.current = setTimeout(() => {
      if (result.counter > 0) setDemo({ type:"counter", key:`${eventKey}-counter`, damage:result.counter });
      setRoundKey(value => value + 1);
      setLocked(false);
    }, 650);
  }, [locked, monster, monsterHp, monsterStatuses, player, visitorCat, runBuffs?.damageMult, runBuffs?.dmgMult, runBuffs?.skillChanceBuff, equippedCards, ring, roundKey, onRound, onVictory, onDefeat]);

  return (
    <BattleScreen
      player={player}
      monster={presentedMonster}
      battleMode="score"
      scoreInput={monster?.ability === "boss" ? "target" : "keypad"}
      targetFormat={monster?.ability === "boss" ? "half_17" : "full_110"}
      arrowsPerRound={6}
      autoStart
      externalBattle
      isolateStudentProgression
      hideLeaveControl
      externalRoundKey={roundKey}
      externalLocked={locked}
      externalDemo={demo}
      targetRing={ring}
      onSubmit={handleSubmit}
      hideStandaloneResult
      potions={[]}
      fullScreen
      renderMonster={(size, current) => current?.image ? <img src={current.image} alt={current.name || "怪物"} style={{ width:size, height:size, objectFit:"contain", imageRendering:"auto" }} /> : null}
    />
  );
}
