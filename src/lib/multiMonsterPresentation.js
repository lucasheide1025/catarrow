import { MONSTER_STATUSES } from "./monsterStatus";

export const MULTI_PRESENTATION_DELAY = Object.freeze({
  player_attack: 420,
  arrow_miss: 620,
  target_damage: 720,
  cat_action: 760,
  status_applied: 760,
  rune_heal: 680,
  round_heal: 680,
  monster_counter: 760,
  member_down: 900,
  monster_killed: 1250,
  round_end: 500,
  battle_win: 1400,
  battle_lose: 1400,
});

const amount = value => Math.max(0, Math.round(Number(value) || 0));
const targetName = (event, context) => context?.targets?.[event?.targetId]?.name || "怪物";
const memberName = (event, context) => context?.members?.[event?.memberId]?.name || "隊員";

export function getMultiMonsterPresentationPolicy(mode) {
  const id = ["free_hunt_solo","free_hunt_party","dungeon_solo","dungeon_team"].includes(mode) ? mode : "free_hunt_party";
  return Object.freeze({
    id,
    combineCatDamage:true,
    statusDamageFloat:true,
    skipHiddenStatusWait:true,
    preservePlayerArrows:id === "dungeon_solo",
  });
}

export function describePartyPresentationEvent(event = {}, context = {}) {
  const target = targetName(event, context);
  const member = memberName(event, context);
  switch (event.type) {
    case "player_attack": return `${member} 拉弓瞄準`;
    case "arrow_miss": return `${member} 的箭落空了`;
    case "target_damage": {
      const damage = amount(event.damage ?? event.amount);
      if (event.source === "status") return `${target} 受到持續傷害 ${damage}`;
      if (event.source === "reflect") return `${target} 受到反射傷害 ${damage}`;
      if (event.source === "cat") return `🐱 貓貓對${target}造成 ${damage} 傷害`;
      return `${target} -${damage} HP`;
    }
    case "status_applied": {
      const status = MONSTER_STATUSES[event.statusId];
      const statusLabel = status ? `${status.icon} ${status.name}` : "✨ 異常狀態";
      return `${member} 對${target}附加 ${statusLabel}`;
    }
    case "cat_action": {
      const cat = context?.members?.[event.memberId]?.catName || "貓貓";
      const effects = [];
      if (amount(event.amount)) effects.push(`對${target}造成 ${amount(event.amount)} 傷害`);
      if (amount(event.heal)) effects.push(`替${member}恢復 ${amount(event.heal)} HP`);
      if (amount(event.shield)) effects.push(`替${member}獲得 ${amount(event.shield)} 護盾`);
      return `🐱 ${cat}${event.strong ? " 強力支援：" : " 支援："}${effects.join("，") || "守護隊伍"}`;
    }
    case "rune_heal": return `${target} 恢復 ${amount(event.heal ?? event.amount)} HP`;
    case "round_heal": return `${member} 回合結束恢復 ${amount(event.amount ?? event.heal)} HP`;
    case "monster_counter": {
      const absorbed = amount(event.absorbed);
      return absorbed
        ? `${member} 受到 ${amount(event.damage ?? event.amount)} 傷害（護盾抵擋 ${absorbed}）`
        : `${member} 受到 ${amount(event.damage ?? event.amount)} 傷害`;
    }
    case "member_down": return `${member} 倒下了`;
    case "monster_killed": return `${target} 擊破！`;
    case "round_end": return "本回合結束";
    case "battle_win": return "🏆 討伐成功";
    case "battle_lose": return "💀 討伐失敗";
    default: return "戰鬥效果發動";
  }
}

export function groupPartyPresentationBeats(events = [], policy = {}) {
  const combineCatDamage = policy.combineCatDamage ?? policy.dungeonSolo ?? false;
  const statusDamageFloat = policy.statusDamageFloat ?? policy.dungeonSolo ?? false;
  const beats = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event?.type === "status_applied") {
      beats.push({ ...event, overlay:false });
      continue;
    }
    if (statusDamageFloat && event?.type === "target_damage" && event?.source === "status") {
      beats.push({ ...event, type:"status_damage", overlay:false, color:MONSTER_STATUSES[event.statusId]?.color || "#fbbf24" });
      continue;
    }
    if (combineCatDamage && event?.type === "target_damage" && event?.source === "cat") {
      let actionIndex = index + 1;
      const between = [];
      while (events[actionIndex]?.type === "monster_killed") { between.push(events[actionIndex]); actionIndex += 1; }
      const action = events[actionIndex];
      if (action?.type === "cat_action" && action.memberId === event.memberId && action.targetId === event.targetId) {
        beats.push({ ...action, damage:event.damage, amount:event.damage, remainingHp:event.remainingHp });
        beats.push(...between);
        index = actionIndex;
        continue;
      }
    }
    if (event?.type !== "target_damage" || event?.source !== "player") {
      beats.push(event);
      continue;
    }
    const hits = [];
    let cursor = index;
    while (cursor < events.length && events[cursor]?.type === "target_damage" && events[cursor]?.source === "player") {
      hits.push(events[cursor]);
      cursor += 1;
    }
    beats.push({ id:`${event.id || "damage"}:batch`, type:"target_damage_batch", memberId:event.memberId, hits });
    index = cursor - 1;
  }
  return beats;
}

export function groupSoloPresentationBeats(events = [], policy = {}) {
  const output = [];
  let hits = new Map();
  let deferred = [];
  const flush = () => {
    if (hits.size) output.push({
      phase:"player",
      type:"multi_target_damage_batch",
      hits:[...hits.values()],
    });
    output.push(...deferred);
    hits = new Map();
    deferred = [];
  };
  for (const event of events) {
    const isPlayerDamage = event?.phase === "player" && (event.type === "multi_arrow_hit" || event.type === "multi_arrow_crit");
    if (isPlayerDamage) {
      const payload = event.payload || {};
      const previous = hits.get(payload.targetIndex) || { ...payload, damage:0, isCrit:false };
      hits.set(payload.targetIndex, {
        ...previous,
        ...payload,
        damage:amount(previous.damage) + amount(payload.damage),
        isCrit:previous.isCrit || payload.isCrit || event.type === "multi_arrow_crit",
      });
      continue;
    }
    if (event?.phase === "player" && event.type !== "multi_phase") {
      deferred.push(event.type === "multi_status_applied" && policy.skipHiddenStatusWait !== false ? { ...event, overlay:false } : event);
      continue;
    }
    flush();
    output.push(event);
  }
  flush();
  return output;
}

export function presentationEventKey(resolution, event, index) {
  return event?.id || `${resolution?.resolutionId || "resolution"}:${index}`;
}

export function partyPresentationEvents(resolution, { preservePlayerArrows = false } = {}) {
  if (!resolution?.resolutionId) return [];
  const rawEvents = Array.isArray(resolution.events) ? resolution.events : [];
  const hp = { ...(resolution.targetHpBefore || {}) };
  const events = [];
  let playerBlock = null;
  const flushPlayer = () => {
    if (!playerBlock) return;
    events.push({ id:`${playerBlock.firstId}:attack`, type:"player_attack", memberId:playerBlock.memberId, arrowIndex:playerBlock.arrowIndex });
    for (const [targetId, damage] of playerBlock.damageByTarget) {
      const remainingHp = Math.max(0, (Number(hp[targetId]) || 0) - damage);
      hp[targetId] = remainingHp;
      events.push({ id:`${playerBlock.firstId}:damage:${targetId}`, type:"target_damage", memberId:playerBlock.memberId, arrowIndex:playerBlock.arrowIndex, targetId, source:"player", damage, amount:damage, remainingHp });
    }
    if (!playerBlock.damageByTarget.size && playerBlock.missed) events.push({ id:`${playerBlock.firstId}:miss`, type:"arrow_miss", memberId:playerBlock.memberId });
    events.push(...playerBlock.after);
    playerBlock = null;
  };
  for (const event of rawEvents) {
    const isPlayerDamage = event.type === "target_damage" && event.source === "player" && event.memberId;
    const isPlayerMiss = event.type === "arrow_miss" && event.memberId;
    if (isPlayerDamage || isPlayerMiss) {
      if (playerBlock?.memberId !== event.memberId || (preservePlayerArrows && playerBlock?.arrowIndex !== event.arrowIndex)) flushPlayer();
      playerBlock ||= { memberId:event.memberId, arrowIndex:event.arrowIndex, firstId:event.id, damageByTarget:new Map(), missed:false, after:[] };
      if (isPlayerDamage) playerBlock.damageByTarget.set(event.targetId, (playerBlock.damageByTarget.get(event.targetId) || 0) + Math.max(0, Number(event.damage ?? event.amount) || 0));
      else playerBlock.missed = true;
      continue;
    }
    if (playerBlock && (event.type === "monster_killed" || event.type === "status_applied")) {
      playerBlock.after.push(event);
      continue;
    }
    flushPlayer();
    const normalized = { ...event };
    if (event.type === "target_damage") {
      normalized.damage = Math.max(0, Number(event.damage ?? event.amount) || 0);
      normalized.remainingHp = Number.isFinite(Number(event.remainingHp)) ? Number(event.remainingHp) : Math.max(0, (Number(hp[event.targetId]) || 0) - normalized.damage);
      hp[event.targetId] = normalized.remainingHp;
    }
    if (event.type === "monster_counter") normalized.damage = Math.max(0, Number(event.damage ?? event.amount) || 0);
    events.push(normalized);
  }
  flushPlayer();
  const outcome = resolution.outcome || resolution.result;
  return [
    ...events.map((event, index) => ({ ...event, id:presentationEventKey(resolution, event, index) })),
    { id:`${resolution.resolutionId}:round-end`, type:"round_end", round:resolution.round },
    ...(outcome === "win" ? [{ id:`${resolution.resolutionId}:victory`, type:"battle_win" }] : []),
    ...(outcome === "lose" ? [{ id:`${resolution.resolutionId}:defeat`, type:"battle_lose" }] : []),
  ];
}

export function shouldRevealTerminal(roomStatus, activeResolutionId, completedResolutionIds) {
  if (roomStatus !== "victory" && roomStatus !== "defeat") return false;
  return !activeResolutionId || completedResolutionIds.has(activeResolutionId);
}

export function presentationDelay(type, { dungeonSolo = false, overlay = true } = {}) {
  if (!overlay) return type === "status_damage" ? 280 : 40;
  if (dungeonSolo) {
    if (type === "player_attack") return 180;
    if (type === "target_damage_batch") return 380;
    if (type === "cat_action") return 620;
    if (type === "status_damage") return 280;
  }
  return MULTI_PRESENTATION_DELAY[type] || 600;
}
