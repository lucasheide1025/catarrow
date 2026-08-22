import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FAMILIES } from "../../lib/monsterData";
import { buildAdventurerCombatStats } from "../../lib/adventurerCombatStats";
import { claimMultiMonsterBattleReward } from "../../lib/monsterRewardDb";
import { claimDungeonEncounterTargetCard, claimDungeonMultiSoloReward } from "../../lib/dungeonBossRewardDb";
import { recordBattleRoundArrows } from "../../lib/db";
import { MATERIAL_BY_ID } from "../../lib/monsterEconomyCatalog";
import { FREE_HUNT_DAILY_LIMIT, FREE_HUNT_QUOTA_MODE, getFreeHuntRemaining } from "../../lib/freeHuntQuota";
import { describeMonsterStatuses } from "../../lib/monsterStatus";
import { consumeFreeHuntAttempt, freeHuntQuotaErrorMessage } from "../../lib/freeHuntQuotaDb";
import { getMultiMonsterPlayerStats } from "../../lib/multiMonsterBattle";
import { getBattleBackgroundUrl, getBattleMonsterSources } from "../../lib/battleAssets";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import { PlayerAvatar } from "../shared/PlayerAvatar";
import CatSVG from "../cat/CatSVG";
import { describePartyPresentationEvent, getMultiMonsterPresentationPolicy, groupPartyPresentationBeats, partyPresentationEvents, presentationDelay, shouldRevealTerminal } from "../../lib/multiMonsterPresentation";
import { playBattleSound } from "../../lib/battleSound";
import { describeModifiers } from "../../lib/combatModifiers";
import {
  cleanupMultiMonsterPartyRoom,
  leaveMultiMonsterPartyRoom,
  processMultiMonsterPartyRound,
  reviseMultiMonsterPartyRound,
  setMultiMonsterPartyArrowsPerRound,
  startMultiMonsterPartyBattle,
  submitMultiMonsterPartyRound,
  subscribeMultiMonsterPartyRoom,
  updateMultiMonsterPartyMemberStats,
} from "../../lib/multiMonsterPartyDb";

const SCORE_KEYS = ["X","10","9","8","7","6","5","4","3","2","1","M"];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function StatPill({ label, value, sub = null }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-center">
    <div className="text-[9px] font-black tracking-[.15em] text-slate-500">{label}</div>
    <div className="mt-0.5 text-sm font-black text-white">{value}</div>
    {sub != null && <div className="text-[9px] font-bold text-slate-500">{sub}</div>}
  </div>;
}

function MemberCard({ id, member, hostId }) {
  const stats = getMultiMonsterPlayerStats({ player:member || {} });
  const maxHp = Math.max(1, Number(member?.maxHp ?? member?.maxHP) || stats.maxHp || 1);
  const hp = Math.max(0, Number(member?.hp) || 0);
  const pct = Math.max(0, Math.min(100, hp / maxHp * 100));
  const ready = member?.ready === true;
  return <div data-multi-party-member={id} className={`rounded-2xl border p-3 ${member?.alive === false ? "border-red-500/25 bg-red-950/20 opacity-60" : ready ? "border-emerald-400/30 bg-emerald-500/5" : "border-white/10 bg-white/[.03]"}`}>
    <div className="mb-2 flex items-center gap-2.5" data-multi-party-cosmetic="true">
      <PlayerAvatar avatarId={member?.avatarId} size={44}/>
      <div className="min-w-0 flex-1"><div className="truncate text-[10px] font-black text-cyan-100">{member?.name || "射手"}</div>{member?.catId && <div className="mt-1 flex items-center gap-1.5 text-[9px] font-bold text-violet-200"><CatSVG catId={member.catId} size={22}/><span className="truncate">同行 {member?.catName || "貓貓"}</span></div>}</div>
    </div>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 truncate text-xs font-black text-white">{id === hostId ? "👑 " : ""}{member?.name || "射手"}</div>
      <div className={`text-[9px] font-black ${member?.alive === false ? "text-red-300" : ready ? "text-emerald-300" : "text-slate-500"}`}>{member?.alive === false ? "倒下" : ready ? "READY" : "準備中"}</div>
    </div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-400 transition-all" style={{ width:`${pct}%` }}/></div>
    <div className="mt-2 grid grid-cols-3 gap-1.5" data-multi-party-live-stats="true">
      <StatPill label="HP" value={`${hp}/${maxHp}`}/>
      <StatPill label="ATK" value={stats.atk}/>
      <StatPill label="DEF" value={stats.def}/>
    </div>
  </div>;
}

function PartyMonsterImage({ target, size = 72 }) {
  const sources = getBattleMonsterSources(target?.id);
  const [sourceIndex, setSourceIndex] = useState(0);
  if (target?.isRunePillar) return <div className="grid place-items-center" style={{ width:size, height:size, fontSize:Math.round(size * .62) }}>🔮</div>;
  if (sourceIndex >= sources.length) return <div className="grid place-items-center" style={{ width:size, height:size, fontSize:Math.round(size * .58) }}>👾</div>;
  return <img src={sources[sourceIndex]} alt={target?.name || "怪物"} onError={() => setSourceIndex(index => index + 1)} style={{ width:size, height:size, objectFit:"contain", filter:"drop-shadow(0 10px 10px rgba(0,0,0,.65))" }}/>;
}

function TargetCard({ id, target, selected, dimmed, onClick, floating = null }) {
  const maxHp = Math.max(1, Number(target?.maxHp) || 1);
  const hp = Math.max(0, Number(target?.currentHp) || 0);
  const pct = Math.max(0, Math.min(100, hp / maxHp * 100));
  const dead = target?.alive === false || hp <= 0;
  const variant = target?.variant?.label || target?.variantLabel || "普通";
  const displayName = target?.name || "未知目標";
  const statuses = describeMonsterStatuses(target?.statuses || []);
  return <button type="button" disabled={dead} onClick={onClick}
    aria-pressed={selected}
    aria-label={`${displayName}，${dead ? "已擊倒" : `生命值 ${hp} / ${maxHp}`}${selected ? "，目前選取" : ""}`}
    data-multi-party-target={id}
    className={`relative min-h-[118px] rounded-2xl border p-3 text-left transition-all ${selected ? "border-amber-300/70 bg-amber-400/10 ring-2 ring-amber-300/20" : "border-white/10 bg-slate-950/75"} ${dead ? "opacity-45 grayscale" : dimmed ? "opacity-65" : ""}`}>
    <div className="mb-1 flex justify-center"><PartyMonsterImage target={target} size={66}/></div>
    <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-xl">{target?.isRunePillar ? "🔮" : (FAMILIES[target?.family]?.icon || "👹")}</div>
        <div className="mt-1 text-xs font-black text-white">{displayName}</div>
        {statuses.length > 0 && <div className="mt-1 flex flex-wrap gap-1" role="status" aria-live="polite" aria-label={statuses.map(status => status.text).join("、")}>{statuses.map(status => <span key={status.id} title={status.text} className="text-sm" aria-hidden="true">{status.icon}</span>)}</div>}
      </div>
      <div className="text-[9px] font-black text-slate-400">{target?.isRunePillar ? "後排・治療" : variant}</div>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full ${target?.isRunePillar ? "bg-fuchsia-400" : "bg-red-400"}`} style={{ width:`${pct}%` }}/></div>
    <div className="mt-1 flex justify-between text-[9px] font-bold text-slate-400"><span>{dead ? "擊倒" : `${hp}/${maxHp}`}</span><span>{selected && !dead ? "已選取" : ""}</span></div>
    {dead && <div className="absolute inset-0 grid place-items-center"><span className="rotate-[-8deg] rounded border-2 border-red-400 px-2 py-1 text-sm font-black text-red-300">擊倒</span></div>}
    {floating && <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 rounded-full bg-slate-950/90 px-2 py-1 text-lg font-black shadow-xl" style={{ color:floating.color || "#fecaca" }} role="status" aria-live="polite" aria-label={`受到 ${floating.damage} 傷害`}>-{floating.damage}</div>}
  </button>;
}

function PartyBattleIntro({ members, hostId, targets, targetOrder, bg, localCat }) {
  const party = Object.entries(members || {}).slice(0, 8);
  const enemies = (targetOrder || []).map(id => targets?.[id]).filter(target => target && !target.isRunePillar).slice(0, 3);
  return <div data-multi-party-intro="true" className="fixed inset-0 z-[120] grid place-items-center overflow-hidden bg-slate-950 text-white" style={{ backgroundImage:`linear-gradient(110deg,rgba(2,6,23,.97),rgba(2,6,23,.62)),url(${bg})`, backgroundSize:"cover", backgroundPosition:"center" }}>
    <div className="grid w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
      <div><div className="mb-3 text-center text-[10px] font-black tracking-[.25em] text-cyan-200">HUNT PARTY</div><div className="flex flex-wrap justify-center gap-2">{party.map(([id, member]) => <div key={id} className="w-[86px] rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-2 text-center shadow-xl"><div className="mx-auto w-fit"><PlayerAvatar avatarId={member?.avatarId} size={48}/></div><div className="mt-1 truncate text-[9px] font-black">{id === hostId ? "👑 " : ""}{member?.name || "射手"}</div>{member?.catId && <div className="mx-auto mt-1 w-fit"><CatSVG catId={member.catId} size={24}/></div>}</div>)}</div>{localCat?.hasCat && <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-violet-300/25 bg-violet-950/60 px-3 py-1.5 text-[9px] font-black text-violet-100"><CatSVG catId={localCat.catId} size={28}/>{localCat.catName || "貓貓"} 同行</div>}</div>
      <div className="text-3xl font-black italic text-amber-300 drop-shadow-lg">VS</div>
      <div><div className="mb-3 text-center text-[10px] font-black tracking-[.25em] text-red-200">ENEMY GROUP</div><div className="flex justify-center">{enemies.map((target, index) => <div key={target.instanceId || target.id || index} className={index ? "-ml-4" : ""}><PartyMonsterImage target={target} size={82}/></div>)}</div></div>
    </div>
  </div>;
}

function BattleReport({ resolution, targets = {}, members = {} }) {
  if (!resolution) return null;
  const rows = [];
  for (const [id, afterRaw] of Object.entries(resolution.targetHpAfter || {})) {
    const before = Math.max(0, Number(resolution.targetHpBefore?.[id]) || 0);
    const after = Math.max(0, Number(afterRaw) || 0);
    const name = targets[id]?.name || id;
    if (after < before) rows.push(`${name} -${before - after} HP`);
    else if (after > before) rows.push(`${name} +${after - before} HP`);
    if (before > 0 && after <= 0) rows.push(`${name} 已擊倒`);
  }
  for (const [id, afterRaw] of Object.entries(resolution.memberHpAfter || {})) {
    const before = Math.max(0, Number(resolution.memberHpBefore?.[id]) || 0);
    const after = Math.max(0, Number(afterRaw) || 0);
    const name = members[id]?.name || id;
    if (after < before) rows.push(`${name} -${before - after} HP`);
    if (before > 0 && after <= 0) rows.push(`${name} 已倒下`);
  }
  if (resolution.result === "win") rows.push("本回合完成討伐");
  if (resolution.result === "lose") rows.push("本回合全隊倒下");
  if (!rows.length) return null;
  return <details className="rounded-2xl border border-white/10 bg-black/25 p-3" open>
    <summary className="cursor-pointer text-xs font-black text-slate-200">第 {resolution.round} 回合戰報</summary>
    <div className="mt-2 max-h-44 space-y-1 overflow-y-auto text-[10px] font-bold text-slate-400">
      {rows.slice(-18).map((row, index) => <div key={`${resolution.resolutionId}_${index}`}>{row}</div>)}
    </div>
  </details>;
}
function PartyPresentationOverlay({ event, targets, members }) {
  if (!event || event.overlay === false || event.type === "target_damage_batch" || event.type === "target_damage") return null;
  const text = describePartyPresentationEvent(event, { targets, members });
  return <div data-multi-party-presentation="true" className="pointer-events-none fixed inset-0 z-[125] grid place-items-center bg-black/10" aria-live="polite"><div className="rounded-2xl border border-white/15 bg-slate-950/90 px-5 py-3 text-center text-base font-black text-white shadow-2xl">{text}</div></div>;
}
function LootSummary({ loot }) {
  if (!loot) return null;
  const mats = Object.entries(loot.materialTotals || loot.materials || {});
  const chests = Array.isArray(loot.chests) ? loot.chests : [];
  const cards = Array.isArray(loot.cards) ? loot.cards : [];
  return <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-3 text-xs">
    <div className="font-black text-emerald-200">你的戰利品</div>
    <div className="mt-2 grid grid-cols-2 gap-2"><div>🪙 {loot.coins || 0} 金幣</div><div>✨ {loot.archerXP || 0} 射手 EXP</div></div>
    {mats.length > 0 && <div className="mt-2 text-slate-300">{mats.map(([id, qty]) => `${MATERIAL_BY_ID[id]?.name || id} ×${qty}`).join("、")}</div>}
    {chests.length > 0 && <div className="mt-2 text-slate-300">寶箱：{chests.length}</div>}
    {cards.length > 0 && <div className="mt-2 text-amber-200">怪物卡 ×{cards.length}</div>}
  </div>;
}

export default function MultiMonsterPartyRoom({ roomId, playerStats, memberProfile, sharedData = null, onLeave, dungeonMode = false, onDungeonDone }) {
  const myId = memberProfile?.id;
  const cat = useCatCompanion(memberProfile);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dungeonSettlementRetry, setDungeonSettlementRetry] = useState(0);
  const [attackMode, setAttackMode] = useState("focus");
  const [targetId, setTargetId] = useState(null);
  const [arrows, setArrows] = useState([]);
  const [loot, setLoot] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [dungeonSoloSettlement, setDungeonSoloSettlement] = useState(null);
  const [showBattleIntro, setShowBattleIntro] = useState(false);
  const [presentation, setPresentation] = useState(null);
  const [presentationTargets, setPresentationTargets] = useState(null);
  const [presentationMembers, setPresentationMembers] = useState(null);
  const [presentationEvent, setPresentationEvent] = useState(null);
  const [targetDamageFloats, setTargetDamageFloats] = useState({});
  const [presentationTargetIds, setPresentationTargetIds] = useState([]);
  const [completedPresentationIds, setCompletedPresentationIds] = useState(() => new Set());
  const [sheet, setSheet] = useState(null);
  const [quotaRemaining, setQuotaRemaining] = useState(() => getFreeHuntRemaining(memberProfile, FREE_HUNT_QUOTA_MODE.MULTI));
  const [submittingRound, setSubmittingRound] = useState(false);
  const processingRoundRef = useRef(null);
  const settlementRef = useRef(false);
  const submitFlightRef = useRef(null);
  const statsSignatureRef = useRef("");
  const introStatusRef = useRef(null);
  const presentationTokenRef = useRef(0);
  const queuedResolutionRef = useRef(null);
  const dungeonTerminalRef = useRef(null);
  const dungeonContinueRef = useRef(false);

  useEffect(() => {
    setQuotaRemaining(getFreeHuntRemaining(memberProfile, FREE_HUNT_QUOTA_MODE.MULTI));
  }, [memberProfile?.freeHuntUsage?.date, memberProfile?.freeHuntUsage?.multi]);

  useEffect(() => subscribeMultiMonsterPartyRoom(roomId, value => {
    setRoom(value);
    setLoading(false);
  }, { dungeonMode }), [roomId, dungeonMode]);

  const adventurer = useMemo(() => buildAdventurerCombatStats({ member:memberProfile || {}, sharedData:sharedData || {} }), [memberProfile, sharedData]);
  const entryStats = useMemo(() => {
    return {
      hp:adventurer.hp, maxHp:adventurer.hp, maxHP:adventurer.hp,
      atk:adventurer.atk, def:adventurer.def,
      baseAtk:adventurer.atk, baseDef:adventurer.def,
      atkMult:1, defMult:1, atkFlat:0, defFlat:0, statuses:[],
      combatVersion:2,
      loadoutSnapshot:{ version:2, baseStats:{ hp:adventurer.hp, atk:adventurer.atk, def:adventurer.def }, statSources:adventurer.statSources, cards:adventurer.cards },
      avatarId:memberProfile?.avatarId || "",
      catId:cat.hasCat ? (cat.catId || "") : "",
      catName:cat.hasCat ? (cat.catName || "") : "",
      catType:cat.hasCat ? (cat.catType || "") : "",
      bondLv:cat.hasCat ? (cat.bondLv || 0) : 0,
      catLevel:cat.hasCat ? cat.catLevel : 0,
      catHP:cat.hasCat ? cat.catHP : 0,
      catATK:cat.hasCat ? cat.catATK : 0,
      catDEF:cat.hasCat ? cat.catDEF : 0,
    };
  }, [adventurer, memberProfile?.avatarId, cat.hasCat, cat.catId, cat.catName, cat.catType, cat.bondLv, cat.catLevel, cat.catHP, cat.catATK, cat.catDEF]);

  useEffect(() => {
    if (!roomId || !myId || room?.status !== "waiting") return;
    const signature = JSON.stringify([roomId,myId,entryStats.hp,entryStats.atk,entryStats.def,entryStats.avatarId,entryStats.catId,entryStats.catName,entryStats.catType,entryStats.bondLv]);
    if (statsSignatureRef.current === signature) return;
    statsSignatureRef.current = signature;
    updateMultiMonsterPartyMemberStats(roomId, myId, entryStats, { dungeonMode }).then(result => {
      if (!result?.ok) setError(result?.reason || "同步角色能力失敗");
    });
  }, [roomId, myId, room?.status, entryStats, dungeonMode]);

  useEffect(() => {
    if (room?.status !== "active") {
      introStatusRef.current = room?.status || null;
      return undefined;
    }
    if (introStatusRef.current === "active") return undefined;
    introStatusRef.current = "active";
    setShowBattleIntro(true);
    const timer = setTimeout(() => setShowBattleIntro(false), 2400);
    return () => clearTimeout(timer);
  }, [room?.status]);

  const targets = room?.targets || {};
  const targetOrder = Array.isArray(room?.targetOrder) ? room.targetOrder : Object.keys(targets);
  const livingTargetIds = targetOrder.filter(id => targets[id]?.alive !== false && Number(targets[id]?.currentHp) > 0);
  const members = room?.members || {};
  const presentationPolicy = getMultiMonsterPresentationPolicy(
    dungeonMode ? (room?.dungeonSolo === true ? "dungeon_solo" : "dungeon_team") : "free_hunt_party",
  );
  const me = myId ? members[myId] : null;
  const myModifierRows = useMemo(() => describeModifiers(me?.loadoutSnapshot?.cards?.combatMods || {}), [me?.loadoutSnapshot?.cards?.combatMods]);
  const actualIsHost = Boolean(myId && room?.hostId === myId);
  const memberStatsReady = Object.values(members).length > 0 && Object.values(members).every(member =>
    Number.isFinite(Number(member?.maxHp ?? member?.maxHP)) &&
    Number.isFinite(Number(member?.baseAtk)) &&
    Number.isFinite(Number(member?.baseDef))
  );
  const myReady = me?.ready === true;
  const livingMembers = Object.entries(members).filter(([, member]) => member?.alive !== false && Number(member?.hp) > 0);
  const allReady = livingMembers.length > 0 && livingMembers.every(([, member]) => member?.ready === true && Number(member?.submission?.round) === Number(room?.round));

  useEffect(() => {
    const resolution = room?.lastResolution;
    if (!resolution?.resolutionId || queuedResolutionRef.current === resolution.resolutionId || completedPresentationIds.has(resolution.resolutionId)) return undefined;
    try {
      if (sessionStorage.getItem(`multi-party-presentation:${resolution.resolutionId}`) === "done") {
        queuedResolutionRef.current = resolution.resolutionId;
        setCompletedPresentationIds(current => new Set(current).add(resolution.resolutionId));
        return undefined;
      }
    } catch {}

    queuedResolutionRef.current = resolution.resolutionId;
    const token = ++presentationTokenRef.current;
    const beforeTargets = Object.fromEntries(Object.entries(room.targets || {}).map(([id, target]) => [id, {
      ...target,
      currentHp:Number(resolution.targetHpBefore?.[id] ?? target.currentHp) || 0,
      alive:Number(resolution.targetHpBefore?.[id] ?? target.currentHp) > 0,
    }]));
    const beforeMembers = Object.fromEntries(Object.entries(room.members || {}).map(([id, member]) => [id, {
      ...member,
      hp:Number(resolution.memberHpBefore?.[id] ?? member.hp) || 0,
      alive:Number(resolution.memberHpBefore?.[id] ?? member.hp) > 0,
    }]));
    setPresentation(resolution);
    setPresentationTargets(beforeTargets);
    setPresentationMembers(beforeMembers);

    (async () => {
      const terminalKillCount=Object.values(beforeTargets).filter(target=>target.position==="front"&&target.alive!==false&&Number(target.currentHp)>0).length;
      let shownKills=0;
      const dungeonSoloPresentation = presentationPolicy.id === "dungeon_solo";
      for (const event of groupPartyPresentationBeats(
        partyPresentationEvents(resolution, { preservePlayerArrows:presentationPolicy.preservePlayerArrows }),
        presentationPolicy,
      )) {
        if (token !== presentationTokenRef.current) return;
        setPresentationEvent(event);
        try {
          if (event.type === "player_attack" || event.type === "arrow_miss") playBattleSound("arrow_flight", event);
          else if (event.type === "target_damage" || event.type === "target_damage_batch") playBattleSound("arrow_hit", { dmg:event.damage || event.hits?.[0]?.damage, isCrit:event.score === "X" });
          else if (event.type === "cat_action") playBattleSound("cat_attack", event);
          else if (event.type === "monster_counter") playBattleSound("monster_counter", event);
          else if (event.type === "monster_killed") playBattleSound("monster_death", event);
          else if (event.type === "battle_win") playBattleSound("victory_fanfare", event);
          else if (event.type === "battle_lose" || event.type === "member_down") playBattleSound("defeat_sigh", event);
        } catch {}
        if (event.type === "target_damage") setPresentationTargets(current => ({ ...current, [event.targetId]:{ ...current?.[event.targetId], currentHp:event.remainingHp } }));
        if (event.type === "target_damage_batch") {
          setPresentationTargets(current => event.hits.reduce((next, hit) => ({ ...next, [hit.targetId]:{ ...next?.[hit.targetId], currentHp:hit.remainingHp } }), current));
          setTargetDamageFloats(Object.fromEntries(event.hits.map(hit => [hit.targetId, { damage:hit.damage }])));
          setPresentationTargetIds(event.hits.map(hit => hit.targetId));
        }
        if (event.type === "cat_action" && Number(event.damage) > 0) {
          setPresentationTargets(current => ({ ...current, [event.targetId]:{ ...current?.[event.targetId], currentHp:event.remainingHp } }));
          setTargetDamageFloats({ [event.targetId]:{ damage:event.damage, color:"#c4b5fd" } });
          setPresentationTargetIds([event.targetId]);
        }
        if (event.type === "status_damage") {
          setPresentationTargets(current => ({ ...current, [event.targetId]:{ ...current?.[event.targetId], currentHp:event.remainingHp } }));
          setTargetDamageFloats({ [event.targetId]:{ damage:event.damage, color:event.color } });
          setPresentationTargetIds([event.targetId]);
        }
        if (event.type === "status_applied") {
          setPresentationTargets(current => ({
            ...current,
            [event.targetId]: {
              ...current?.[event.targetId],
              statuses: (() => {
                const existing = current?.[event.targetId]?.statuses || [];
                if (existing.some(status => status?.id === event.statusId)) return existing;
                return [...existing, { id:event.statusId }];
              })(),
            },
          }));
        }
        if (event.type === "monster_killed") setPresentationTargets(current => ({ ...current, [event.targetId]:{ ...current?.[event.targetId], currentHp:0, alive:false } }));
        if (event.type === "rune_heal") setPresentationTargets(current => ({ ...current, [event.targetId]:{ ...current?.[event.targetId], currentHp:event.remainingHp } }));
        if (event.type === "monster_counter") setPresentationMembers(current => ({ ...current, [event.memberId]:{ ...current?.[event.memberId], hp:event.remainingHp } }));
        if (event.type === "member_down") setPresentationMembers(current => ({ ...current, [event.memberId]:{ ...current?.[event.memberId], hp:0, alive:false } }));
        await sleep(presentationDelay(event.type, { dungeonSolo:dungeonSoloPresentation, overlay:event.overlay !== false }));
        if (["target_damage_batch","cat_action","status_damage"].includes(event.type)) { setTargetDamageFloats({}); setPresentationTargetIds([]); }
        if(event.type==="monster_killed")shownKills+=1;
        if((resolution.outcome||resolution.result)==="win"&&terminalKillCount>0&&shownKills>=terminalKillCount)break;
      }
      if (token !== presentationTokenRef.current) return;
      try { sessionStorage.setItem(`multi-party-presentation:${resolution.resolutionId}`, "done"); } catch {}
      setCompletedPresentationIds(current => new Set(current).add(resolution.resolutionId));
      setPresentationEvent(null);
      setTargetDamageFloats({});
      setPresentationTargetIds([]);
      setPresentation(null);
      setPresentationTargets(null);
      setPresentationMembers(null);
    })();
    return () => { presentationTokenRef.current += 1; };
  }, [room?.lastResolution?.resolutionId]);

  useEffect(() => {
    if (attackMode !== "focus") return;
    if (targetId && targets[targetId]?.alive !== false && Number(targets[targetId]?.currentHp) > 0) return;
    const next = livingTargetIds.find(id => !targets[id]?.isRunePillar) || livingTargetIds[0] || null;
    setTargetId(next);
  }, [attackMode, targetId, livingTargetIds.join("|"), room?.round]); // eslint-disable-line

  useEffect(() => {
    setArrows([]);
    setError("");
    submitFlightRef.current = null;
    setSubmittingRound(false);
  }, [room?.round]);

  useEffect(() => {
    if (room?.combatVersion === 2 || room?.status !== "active" || !actualIsHost || !allReady || !room?.round) return;
    const expectedRound = Number(room.round);
    if (processingRoundRef.current === expectedRound) return;
    processingRoundRef.current = expectedRound;
    processMultiMonsterPartyRound(roomId, myId, expectedRound).then(result => {
      if (!result?.ok && result?.reason !== "stale_round") {
        processingRoundRef.current = null;
        setError(result?.reason || "回合結算失敗");
      }
    });
  }, [room?.status, room?.round, actualIsHost, allReady, roomId, myId]);

  const doLeave = useCallback(async () => {
    if (!myId) { onLeave?.(); return; }
    const active = room?.status === "active";
    const hostText = actualIsHost && Object.keys(members).length > 1 ? "離開後會把房主交給下一位隊員。" : "";
    if (active && !window.confirm(`戰鬥仍在進行中，確定離開？${hostText}`)) return;
    await leaveMultiMonsterPartyRoom(roomId, myId, { dungeonMode });
    onLeave?.();
  }, [myId, room?.status, actualIsHost, members, roomId, onLeave, dungeonMode]);

  async function startBattle() {
    if (!actualIsHost) { setError("只有房主可以開始複數討伐"); return; }
    if (!dungeonMode && quotaRemaining <= 0) { setError("今日複數討伐次數已用完（5/5）"); return; }
    setError("");
    try {
      if (!dungeonMode) {
        const quota = await consumeFreeHuntAttempt({
          memberId:myId, mode:FREE_HUNT_QUOTA_MODE.MULTI, battleId:`multi_party_${roomId}`, roomId,
        });
        setQuotaRemaining(quota.remaining);
      }
      const result = await startMultiMonsterPartyBattle(roomId, myId, { dungeonMode });
      if (!result?.ok) setError(result?.reason || "開始戰鬥失敗");
    } catch (startErr) {
      setError(freeHuntQuotaErrorMessage(startErr, FREE_HUNT_QUOTA_MODE.MULTI));
    }
  }

  async function setArrowCount(count) {
    setError("");
    const result = await setMultiMonsterPartyArrowsPerRound(roomId, myId, count, { dungeonMode });
    if (!result?.ok) setError(result?.reason || "設定箭數失敗");
  }

  async function submitRound() {
    const expectedRound = Number(room?.round);
    const flightKey = `${roomId}:${expectedRound}:${myId}`;
    if (!expectedRound || !myId || myReady || submitFlightRef.current === flightKey) return;
    const needed = [3,6].includes(Number(room.arrowsPerRound)) ? Number(room.arrowsPerRound) : 6;
    if (arrows.length !== needed) { setError(`請輸入完整 ${needed} 箭`); return; }
    if (attackMode === "focus" && !targetId) { setError("請選擇集火目標"); return; }
    submitFlightRef.current = flightKey;
    setSubmittingRound(true);
    setError("");
    try {
      const result = await submitMultiMonsterPartyRound(roomId, myId, expectedRound, { arrows, attackMode, targetId }, { dungeonMode });
      if (!result?.ok) {
        submitFlightRef.current = null;
        setError(result?.reason || "送出失敗");
        return;
      }
      recordBattleRoundArrows({memberId:myId,battleId:roomId,round:expectedRound,count:arrows.length,accountType:memberProfile?.accountType||"official"}).catch(()=>{});
    } finally {
      setSubmittingRound(false);
    }
  }

  async function reviseRound() {
    const result = await reviseMultiMonsterPartyRound(roomId, myId, room.round, { dungeonMode });
    if (!result?.ok) { setError(result?.reason === "round_locked" ? "本回合已開始結算，無法修改" : (result?.reason || "無法修改")); return; }
    submitFlightRef.current = null;
    setArrows(Array.isArray(me?.submission?.arrows) ? me.submission.arrows : []);
    setAttackMode(me?.submission?.attackMode === "all" ? "all" : "focus");
    if (me?.submission?.targetId) setTargetId(me.submission.targetId);
  }

  async function claimRewards() {
    if (!room || !myId || !memberProfile?.id || claiming || me?.rewardClaimed || settlementRef.current) return;
    settlementRef.current = true;
    setClaiming(true);
    setClaimError("");
    try {
      const defeatedFronts = targetOrder
        .map(id => ({ targetId:id, ...targets[id] }))
        .filter(target => target.position === "front" && !target.isRunePillar && (target.alive === false || Number(target.currentHp) <= 0));
      const receipt = await claimMultiMonsterBattleReward({
        battleId:roomId,
        roomId,
        memberId:memberProfile.id,
        family:room.multiFamily,
        tierIndex:Number(room.multiTier),
        monsterIds:defeatedFronts.map(target => target.id),
        mode:"student",
        challengeLevel:"standard",
      });
      if (!receipt?.ok) throw new Error(receipt?.reason || "reward_claim_failed");
      setLoot(receipt.reward || null);
    } catch (claimErr) {
      settlementRef.current = false;
      setClaimError(claimErr?.message || "reward_sync_failed");
    } finally {
      setClaiming(false);
    }
  }

  async function finishRoom() {
    if (!actualIsHost) { onLeave?.(); return; }
    const allClaimed = room?.status !== "victory" || Object.values(members).every(member => member?.rewardClaimed === true);
    let force = false;
    if (!allClaimed) {
      if (!window.confirm("仍有隊員尚未領取戰利品。現在關閉房間會讓他們無法回來領取，確定關閉？")) return;
      force = true;
    }
    const result = await cleanupMultiMonsterPartyRoom(roomId, myId, { force, dungeonMode });
    if (!result?.ok) { setError(result?.reason || "關閉房間失敗"); return; }
    onLeave?.();
  }

  useEffect(() => {
    if (!dungeonMode || !room || !shouldRevealTerminal(room.status, room.lastResolution?.resolutionId || null, completedPresentationIds)) return;
    const key=`${roomId}:${room.status}`;
    if(dungeonTerminalRef.current===key)return;
    dungeonTerminalRef.current=key;
    (async()=>{
      let dungeonReward=null;
      if(room.status==="victory"&&myId&&room.dungeonSolo===true){
        setDungeonSoloSettlement({ status:"syncing", won:true, reward:null, payload:null });
        const receipt=await claimDungeonMultiSoloReward({battleId:roomId,memberId:myId});
        if(!receipt?.ok)throw new Error(receipt?.reason||"dungeon_reward_sync_failed");
        dungeonReward=receipt?.reward||null;
        setError("");
      }else if(room.status==="victory"&&myId){
        const targets=room.targetOrder?.map(id=>room.targets?.[id]).filter(target=>target?.id&&target.encounter==="normal")||[];
        await Promise.all(targets.map(target=>claimDungeonEncounterTargetCard({battleId:roomId,memberId:myId,monsterId:target.id,targetInstanceId:target.instanceId}).catch(()=>null)));
      }
      const payload={won:room.status==="victory",members:room.members||{},battle:{id:roomId,...room,dungeonReward,monsters:room.targetOrder?.map(id=>room.targets?.[id]).filter(Boolean)||[]}};
      if(room.dungeonSolo===true){
        setDungeonSoloSettlement({ status:"ready", won:payload.won, reward:dungeonReward, payload });
      }else{
        onDungeonDone?.(payload);
      }
    })().catch(error=>{
      dungeonTerminalRef.current=null;
      if(room?.dungeonSolo===true)setDungeonSoloSettlement(current=>({ ...(current||{}), status:"error", won:room.status==="victory", error:error?.message||"dungeon_reward_sync_failed" }));
      else setError(error?.message||"dungeon_reward_sync_failed");
    });
  }, [dungeonMode, room, roomId, completedPresentationIds, onDungeonDone, myId, dungeonSettlementRetry]);

  function continueDungeonSolo() {
    if(dungeonContinueRef.current||dungeonSoloSettlement?.status!=="ready"||!dungeonSoloSettlement.payload)return;
    dungeonContinueRef.current=true;
    setDungeonSoloSettlement(current=>({ ...current, status:"continuing" }));
    Promise.resolve(onDungeonDone?.(dungeonSoloSettlement.payload)).catch(error=>{
      dungeonContinueRef.current=false;
      setDungeonSoloSettlement(current=>({ ...current, status:"ready", error:error?.message||"dungeon_continue_failed" }));
    });
  }

  if (loading) return <div className="min-h-screen bg-slate-950 p-6 text-center text-sm font-black text-slate-400">同步複數討伐房間…</div>;
  if (!room) return <div className="min-h-screen bg-slate-950 p-6 text-center text-white"><div className="text-lg font-black">房間已結束</div><button onClick={onLeave} className="mt-4 rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">返回自由狩獵</button></div>;

  const family = FAMILIES[room.multiFamily];
  const arrowsPerRound = [3,6].includes(Number(room.arrowsPerRound)) ? Number(room.arrowsPerRound) : 6;
  const activeResolutionId = presentation?.resolutionId || room.lastResolution?.resolutionId || null;
  const terminal = shouldRevealTerminal(room.status, activeResolutionId, completedPresentationIds);
  const activeLayout = room.status === "active" || Boolean(presentation);
  const displayTargets = presentationTargets || targets;
  const displayMembers = presentationMembers || members;
  const battleBg = getBattleBackgroundUrl(room.multiFamily);

  return <div className={`relative bg-cover bg-center px-3 text-white ${activeLayout ? "h-[100dvh] overflow-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]" : "min-h-screen pb-8 pt-3"}`} data-multi-monster-party-room="true" style={{ backgroundImage:`linear-gradient(180deg,rgba(2,6,23,.9),rgba(2,6,23,.48) 35%,rgba(2,6,23,.96)),url(${battleBg})` }}>
    <div className={`mx-auto flex w-full max-w-3xl flex-col ${activeLayout ? "h-full gap-1.5 py-1.5" : "gap-3"}`}>
      <header className={`${room.status === "active" ? "hidden" : "rounded-3xl border border-white/10 bg-slate-950/75 p-4 shadow-2xl backdrop-blur"}`}>
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-[9px] font-black tracking-[.22em] text-violet-300">MULTI PARTY HUNT</div><div className="mt-1 text-lg font-black">{family?.icon} {family?.label || room.multiFamily}・T{room.multiTier}</div></div>
          <button onClick={doLeave} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-300">離開</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-400"><span>房號 {room.code || roomId.slice(0,6)}</span><span>・</span><span>{Object.keys(members).length}/8 人</span>{room.status === "active" && <><span>・</span><span>第 {room.round} 回合</span></>}</div>
      </header>

      {error && <div className="rounded-2xl border border-red-400/30 bg-red-950/30 p-3 text-xs font-bold text-red-200">{error}</div>}

      {room.status === "waiting" && <>
        <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-4">
          <div className="flex items-center justify-between"><div className="text-sm font-black">隊伍等待室</div><div className="text-[10px] font-bold text-slate-500">最多 8 人</div></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(members).map(([id, member]) => <MemberCard key={id} id={id} member={member} hostId={room.hostId}/>)}</div>
        </section>
        <section className="rounded-3xl border border-amber-300/15 bg-slate-950/65 p-4">
          <div className="text-xs font-black text-amber-200">每回合箭數</div>
          <div className="mt-2 grid grid-cols-2 gap-2">{[3,6].map(count => <button key={count} disabled={!actualIsHost} onClick={() => setArrowCount(count)} className={`min-h-12 rounded-xl border text-sm font-black ${arrowsPerRound === count ? "border-amber-300 bg-amber-400/15 text-amber-100" : "border-white/10 bg-white/5 text-slate-400"} disabled:opacity-55`}>{count} 箭</button>)}</div>
          <div className="mt-2 text-[10px] text-slate-500">{actualIsHost ? "房主可設定；開戰後固定。" : "由房主設定。"}</div>
          {actualIsHost ? <>
            <div className={`mt-3 text-center text-[11px] font-black ${quotaRemaining > 0 ? "text-emerald-300" : "text-red-300"}`}>今日複數討伐剩餘 {quotaRemaining}/{FREE_HUNT_DAILY_LIMIT} 次（只扣房主）</div>
            <button onClick={startBattle} disabled={!memberStatsReady || quotaRemaining <= 0} className="mt-3 min-h-14 w-full rounded-2xl bg-gradient-to-r from-red-500 to-orange-400 text-base font-black shadow-lg disabled:opacity-40">⚔️ 開始複數討伐</button>
            {!memberStatsReady && <div className="mt-2 text-center text-[10px] font-bold text-amber-200">等待所有隊員同步正式 HP／ATK／DEF…</div>}
          </> : <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-3 text-center text-xs font-black text-cyan-200">等待房主開始戰鬥（隊友不扣次數）</div>}
        </section>
      </>}

      {activeLayout && <>
        <section data-multi-party-battle-hud="true" className="shrink-0 rounded-2xl border border-cyan-300/15 bg-slate-950/80 px-2 py-1.5 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 text-[11px] font-black"><span className="text-cyan-200">R{room.round || 1}</span><span className="text-emerald-300">HP {Math.max(0, Number(me?.hp) || 0)}/{Math.max(1, Number(me?.maxHp) || 1)}</span><span className="ml-auto text-slate-300">隊伍 {livingMembers.length}/{Object.keys(members).length}・已送 {livingMembers.filter(([,m])=>m.ready).length}/{livingMembers.length}</span><button onClick={()=>setSheet("team")} className="rounded-lg border border-white/10 px-2 py-1.5">隊伍</button><button onClick={()=>setSheet("effects")} className="rounded-full border border-amber-300/35 bg-amber-900/50 px-3 py-1.5 text-amber-100">✨ 加成 {myModifierRows.length}</button></div>
        </section>

        <section data-multi-party-battlefield="true" className="min-h-0 flex-1 rounded-2xl border border-red-400/15 bg-slate-950/50 p-2 shadow-2xl backdrop-blur-[2px]">
          <div className="grid grid-cols-3 gap-2">{targetOrder.filter(id => displayTargets[id]?.position === "front").map(id => {
            const presentingTargets = presentationTargetIds.length > 0;
            const selected = presentingTargets ? presentationTargetIds.includes(id) : attackMode === "focus" && targetId === id;
            const dimmed = presentingTargets ? !presentationTargetIds.includes(id) : attackMode === "focus" && targetId !== id;
            return <TargetCard key={id} id={id} target={displayTargets[id]} selected={selected} dimmed={dimmed} floating={targetDamageFloats[id]} onClick={() => { if (attackMode === "focus") setTargetId(id); }}/>;
          })}</div>
          {targetOrder.some(id => targets[id]?.position === "rear") && <div className="mt-1 flex justify-center gap-2 text-[9px] font-black text-fuchsia-200">{targetOrder.filter(id => targets[id]?.position === "rear").map(id => <span key={id} className="rounded-full border border-fuchsia-300/20 bg-fuchsia-950/50 px-2 py-1">🔮 {targets[id]?.name || "後排符文"} {Math.max(0,Number(targets[id]?.currentHp)||0)} HP</span>)}</div>}
        </section>

        {presentation ? <div className="shrink-0 rounded-2xl border border-amber-300/20 bg-slate-950/90 p-3 text-center text-sm font-black text-amber-100">戰鬥演出中 · 請稍候</div> : me?.alive === false || Number(me?.hp) <= 0 ? <div className="shrink-0 rounded-2xl border border-red-400/25 bg-red-950/80 p-3 text-center text-sm font-black text-red-200">你已倒下・觀看隊友作戰</div> : myReady ? <div className="shrink-0 rounded-2xl border border-emerald-400/20 bg-emerald-950/80 p-3 text-center"><div className="text-sm font-black text-emerald-200">已鎖定・{livingMembers.filter(([,m])=>m.ready).length}/{livingMembers.length}</div><button onClick={reviseRound} disabled={allReady || room.roundPhase === "resolving"} className="mt-1 rounded-lg border border-emerald-300/20 px-3 py-1 text-[10px] font-black disabled:opacity-35">修改本回合</button></div> : <section data-multi-party-action-dock="true" className="shrink-0 rounded-2xl border border-cyan-400/15 bg-slate-950/90 p-2 backdrop-blur">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setAttackMode("focus")} className={`min-h-12 rounded-xl border text-xs font-black ${attackMode === "focus" ? "border-cyan-300 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-400"}`}>🎯 單一集火・100%</button>
            <button onClick={() => setAttackMode("all")} className={`min-h-12 rounded-xl border text-xs font-black ${attackMode === "all" ? "border-orange-300 bg-orange-400/15 text-orange-100" : "border-white/10 bg-white/5 text-slate-400"}`}>💥 全員攻擊・50%</button>
          </div>
          <div className="mt-1 flex h-7 items-center gap-1 overflow-hidden">{Array.from({length:arrowsPerRound},(_,index)=><span key={index} className="grid h-7 min-w-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-[10px] font-black">{arrows[index] || "_"}</span>)}<span className="ml-auto text-[10px] font-black text-cyan-200">{arrows.length}/{arrowsPerRound}</span></div>
          <div className="mt-1 grid grid-cols-6 gap-1">{SCORE_KEYS.map(score => <button key={score} disabled={arrows.length >= arrowsPerRound} onClick={() => setArrows(current => current.length >= arrowsPerRound ? current : [...current,score])} className="min-h-11 rounded-lg border border-white/10 bg-white/[.04] text-xs font-black text-white active:scale-95 disabled:opacity-30">{score}</button>)}</div>
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-1"><button onClick={() => setArrows(current => current.slice(0,-1))} onContextMenu={event=>{event.preventDefault();setArrows([]);}} className="min-h-11 rounded-lg border border-white/10 px-3 text-xs font-black text-slate-300">撤回<small className="block text-[8px]">長按清空</small></button><button onClick={submitRound} disabled={submittingRound || arrows.length !== arrowsPerRound || (attackMode === "focus" && !targetId)} className="min-h-11 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 px-3 text-sm font-black text-slate-950 disabled:opacity-35">送出本回合</button></div>
        </section>}
      </>}

      {terminal && <section className={`rounded-3xl border p-5 text-center ${room.status === "victory" ? "border-amber-300/30 bg-amber-950/20" : "border-red-400/25 bg-red-950/20"}`}>
        <div className="text-3xl">{room.status === "victory" ? "🏆" : "☠️"}</div>
        <div className="mt-2 text-xl font-black">{room.status === "victory" ? "複數討伐成功" : "討伐失敗"}</div>
        <div className="mt-1 text-xs text-slate-400">{room.status === "victory" ? "只有三隻前排怪物會產生戰利品；治療符文沒有獎勵。" : "本場沒有戰利品。"}</div>
        {!dungeonMode && room.status === "victory" && <div className="mt-4">
          {me?.rewardClaimed ? <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs font-black text-emerald-200">✓ 你的戰利品已領取</div> : <button onClick={claimRewards} disabled={claiming} className="min-h-12 w-full rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 text-sm font-black text-amber-950 disabled:opacity-50">{claiming ? "同步戰利品…" : "🎁 領取我的戰利品"}</button>}
          {claimError && <div className="mt-2 text-xs font-bold text-red-300">{claimError}｜可再次嘗試</div>}
          <div className="mt-3"><LootSummary loot={loot}/></div>
        </div>}
        {dungeonMode && room.dungeonSolo === true && <div className="mt-4 space-y-3" data-dungeon-solo-settlement="true">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-left text-xs text-slate-300">
            <div className="font-black text-white">本次遭遇戰報</div>
            <div className="mt-1">戰鬥結果：{room.status === "victory" ? "勝利" : "敗北"}</div>
            <div>完成回合：{room.lastResolution?.round || Math.max(1, Number(room.round) - 1)}</div>
            <div>擊倒怪物：{targetOrder.filter(id => targets[id]?.position === "front" && (targets[id]?.alive === false || Number(targets[id]?.currentHp) <= 0)).length} / {targetOrder.filter(id => targets[id]?.position === "front").length}</div>
            <div>剩餘 HP：{Math.max(0, Number(me?.hp) || 0)} / {Math.max(1, Number(me?.maxHp) || 1)}</div>
          </div>
          {dungeonSoloSettlement?.status === "syncing" && <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs font-black text-amber-100">正在同步地下城戰利品…</div>}
          {dungeonSoloSettlement?.status === "error" && <div className="rounded-xl border border-red-400/25 bg-red-950/40 p-3 text-xs font-bold text-red-200">戰利品同步失敗：{dungeonSoloSettlement.error}<button type="button" onClick={()=>{dungeonTerminalRef.current=null;setDungeonSoloSettlement(null);setDungeonSettlementRetry(value=>value+1);}} className="mt-2 min-h-10 w-full rounded-lg border border-red-300/30">重新同步</button></div>}
          {dungeonSoloSettlement?.status === "ready" && <>
            {room.status === "victory" ? <LootSummary loot={dungeonSoloSettlement.reward}/> : <div className="rounded-xl border border-slate-500/20 bg-slate-900/50 p-3 text-xs text-slate-300">本次敗北，沒有取得遭遇戰利品。</div>}
            {dungeonSoloSettlement.error && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-950/40 p-3 text-xs font-bold text-red-200">返回地圖失敗：{dungeonSoloSettlement.error}，請再試一次。</div>}
            <button type="button" onClick={continueDungeonSolo} className="min-h-12 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-blue-400 text-sm font-black text-slate-950">返回地下城地圖</button>
          </>}
        </div>}
        {dungeonMode && error && <button type="button" onClick={()=>{setError("");setDungeonSettlementRetry(value=>value+1);}} className="mt-4 min-h-11 w-full rounded-xl border border-amber-300/30 bg-amber-400/10 text-xs font-black text-amber-100">重新同步地下城戰利品</button>}
        {!dungeonMode && <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={onLeave} className="min-h-11 rounded-xl border border-white/10 bg-white/5 text-xs font-black text-slate-300">先離開畫面</button>
          {actualIsHost && <button onClick={finishRoom} className="min-h-11 rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-xs font-black text-cyan-100">關閉本次隊伍</button>}
        </div>}
      </section>}
    </div>
    {showBattleIntro && <PartyBattleIntro members={members} hostId={room.hostId} targets={targets} targetOrder={targetOrder} bg={battleBg} localCat={cat}/>} 
    <PartyPresentationOverlay event={presentationEvent} targets={displayTargets} members={displayMembers}/>
    {sheet && <div className="fixed inset-0 z-[130] flex items-end bg-black/60" onClick={()=>setSheet(null)}><section className="max-h-[72dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-950 p-4" onClick={event=>event.stopPropagation()}><div className="mb-3 flex justify-between text-base font-black"><span>{sheet === "team" ? "隊伍狀態" : sheet === "effects" ? "✨ 本場戰鬥加成" : "戰報"}</span><button onClick={()=>setSheet(null)}>關閉</button></div>{sheet === "team" ? <div className="grid gap-2 sm:grid-cols-2">{Object.entries(members).map(([id,member])=><MemberCard key={id} id={id} member={member} hostId={room.hostId}/>)}</div> : sheet === "effects" ? <div className="space-y-2 text-sm text-slate-200"><div className="rounded-xl bg-white/5 p-3 font-bold">角色面板：HP {me?.loadoutSnapshot?.baseStats?.hp || me?.maxHp}・ATK {me?.loadoutSnapshot?.baseStats?.atk || me?.atk}・DEF {me?.loadoutSnapshot?.baseStats?.def || me?.def}</div>{myModifierRows.map((row,i)=><div key={`${row.label}-${i}`} className="flex min-h-11 items-center gap-3 rounded-xl bg-white/5 px-3 py-2"><span className="text-lg">{row.icon}</span><b>{row.text}</b></div>)}{me?.catId && <div className="rounded-xl bg-white/5 p-3 font-bold">🐱 {me.catName || "貓貓"} Lv.{me.catLevel || 1}・ATK {me.catATK || 0}・羈絆 {me.bondLv || 0}</div>}</div> : <BattleReport resolution={room.lastResolution} targets={targets} members={members}/>}</section></div>}
  </div>;
}
