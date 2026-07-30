// src/guild/domain/expeditionFlow.js
// ─────────────────────────────────────────────────────────────
// 委託遠征「戰鬥核心狀態機」（純函數）。一回合流程：
//   1. 玩家射箭（真實分數）→ 對選定目標造成傷害（六維 ATK vs 怪 DEF，LUK→爆擊）
//   2. 波次清空 → 進下一波；最後一波清空 → 勝利（該回合給喘息，怪不推進）
//   3. 存活怪 distance −1；歸零 → 攻擊玩家（DEF 減傷、AGI 閃避），攻擊後退回
//   4. 消耗食/水（VIT 減緩）；任一歸零 → 飢渴掉血
//   5. HP≤0 → 失敗（陣亡 or 補給耗盡＋力竭＝強迫撤退）
// ⚠️ 只用公會自己的六維（guildStats），不碰主線戰力。
// ─────────────────────────────────────────────────────────────
import { deriveGuildCombat } from "./guildStats";
import { advanceCounter, applySignedEffect, createCounter, proximityDamageMultiplier, toGridMonster } from "./guildCombatV2";

function cloneWaveMonsters(wave, combatV2 = false) {
  return (wave?.monsters || []).map((m, index) => {
    if (!combatV2) return { ...m };
    const grid = toGridMonster(m, index);
    return { ...grid, distance: grid.position.depth };
  });
}

// 公會箭傷公式（重用「分數×攻擊 − 防禦」概念，獨立於主線 damage.js 呼叫）
// export：組隊版狀態機（teamExpeditionFlow）要用同一條公式，單人/組隊的手感才會一致。
export function arrowDamage(score, atk, def, crit) {
  const base = Math.max(1, Math.round(atk * (0.5 + (score || 0) / 11) - def * 0.5));
  return crit ? Math.round(base * 1.5) : base;
}

const effectBonus = (state, targetId, stat) => Object.values(state.effects || {})
  .filter(effect => effect.targetId === targetId && effect.stat === stat)
  .reduce((sum, effect) => sum + effect.value, 0);

function counterForMonster(monster) {
  if (monster.combatRole === "caster") return createCounter("exactRing", {
    targetId: monster.instanceId,
    exactRing: 3,
    exactRings: { full_110: 3, indoor_40: 3, compound_510: 6, half_610: 7, triple: 7, field_16: 3 },
  });
  if (monster.combatRole === "support") return createCounter("defeatCaster", { targetId: monster.instanceId });
  if (monster.combatRole === "heavy") return createCounter("totalScore", { targetId: monster.instanceId, threshold: 20 });
  return createCounter("minScore", { targetId: monster.instanceId, threshold: 9 });
}

export function resolveShotTarget(monsters = [], selectedInstanceId) {
  const selected = monsters.find(monster =>
    monster.instanceId === selectedInstanceId && monster.hp > 0
  );
  if (selected) return selected;

  return monsters
    .map((monster, index) => ({ monster, index }))
    .filter(({ monster }) => monster.hp > 0)
    .sort((a, b) =>
      (a.monster.distance ?? Infinity) - (b.monster.distance ?? Infinity)
      || a.monster.hp - b.monster.hp
      || a.index - b.index
    )[0]?.monster || null;
}

// 一回合可射幾箭：3 或 6（跟主線地下城/組隊的 ARROWS_OPTIONS 同規格）。
// ⚠️ 平衡：6 箭清場快一倍，若補給照舊消耗就變成「一律選 6」。所以**補給消耗隨箭數等比放大**
//   （6 箭 = 2 倍消耗），變成真正的取捨：快速清場 vs 撐得久。
export const MAX_ARROW_SCORE = 11;   // X = 11 分（跟主線 score.js 同規格）
export const GUILD_ARROWS_OPTIONS = Object.freeze([3, 6]);
export const DEFAULT_GUILD_ARROWS = 3;
const BASE_ARROWS = 3;

export function normalizeArrowsPerRound(n) {
  return GUILD_ARROWS_OPTIONS.includes(Number(n)) ? Number(n) : DEFAULT_GUILD_ARROWS;
}

// cats: [{ id, name, icon?, atk, def }]（由 calcCatCombatStats 映射；每回合自動攻擊）
export function createExpeditionState(expedition, guildStats, supplies = { food: 6, water: 6 }, cats = [], opts = {}) {
  const derived = deriveGuildCombat(guildStats);
  const missionMode = opts.missionMode || "assault";
  const defenseRoster = missionMode === "defense"
    ? (expedition.waves || []).flatMap(wave => cloneWaveMonsters(wave, true))
    : [];
  const defenseVisible = defenseRoster.slice(0, 3);
  const defenseQueue = defenseRoster.slice(3).map((monster, index) => ({
    ...monster,
    distance: 11 + index,
    position: { ...monster.position, depth: 11 + index },
  }));
  return {
    arrowsPerRound: normalizeArrowsPerRound(opts.arrowsPerRound),
    targetFormat: opts.targetFormat || "full_110",
    // 整趟的射擊表現：命中越準，結算掉落越好（這是射箭遊戲，射得準就該有回報）
    shotStats: { count: 0, score: 0 },
    expedition,
    guildStats,
    derived,
    cats: cats.map(c => ({ ...c })),
    combatVersion: opts.combatV2 ? 2 : 1,
    missionMode,
    maxHp: derived.maxHP,
    hp: derived.maxHP,
    supplies: { ...supplies },
    waveIndex: 0,
    monsters: missionMode === "defense" ? defenseVisible : cloneWaveMonsters(expedition.waves[0], opts.combatV2),
    defense: missionMode === "defense" ? {
      clock: 0,
      duration: Math.max(6, defenseRoster.length + 2),
      gateHp: Math.max(100, derived.maxHP),
      gateMaxHp: Math.max(100, derived.maxHP),
      queue: defenseQueue,
      assistanceUsed: [],
      assistanceOffset: Array.from(String(expedition?.id || "")).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5,
      nextAssistanceRound: 3,
    } : null,
    round: 1,
    status: "fighting", // fighting | won | lost
    lostReason: null,
    log: [],
  };
}

const TRAVEL_EVENTS = Object.freeze([
  { id: "lost_trail", label: "迷失山徑", food: -1, water: -0.5, hpPct: 0 },
  { id: "bad_weather", label: "惡劣天候", food: -0.5, water: -1.5, hpPct: 0 },
  { id: "hidden_trap", label: "誤觸陷阱", food: 0, water: 0, hpPct: -0.08 },
  { id: "rest_spring", label: "發現休息泉", food: 0, water: 1, hpPct: 0.08 },
]);

export function pickTravelEvent(rand = Math.random) {
  return TRAVEL_EVENTS[Math.min(TRAVEL_EVENTS.length - 1, Math.floor(rand() * TRAVEL_EVENTS.length))];
}

// 清波後的旅途事件。獨立傳入 rand，避免事件抽選改變爆擊／閃避的亂數序列。
export function resolveTravelEvent(state, rand = Math.random, selectedEvent = null) {
  const event = selectedEvent || pickTravelEvent(rand);
  const next = {
    ...state,
    supplies: { ...state.supplies },
    log: [...(state.log || [])],
  };
  next.supplies.food = Math.max(0, Math.round((next.supplies.food + event.food) * 100) / 100);
  next.supplies.water = Math.max(0, Math.round((next.supplies.water + event.water) * 100) / 100);
  const hpDelta = Math.round(next.maxHp * event.hpPct);
  next.hp = Math.max(0, Math.min(next.maxHp, next.hp + hpDelta));
  next.log.push({
    type: "travelEvent",
    id: event.id,
    label: event.label,
    food: event.food,
    water: event.water,
    hp: hpDelta,
  });
  if (next.supplies.food <= 0 && next.supplies.water <= 0) {
    next.status = "lost";
    next.lostReason = "糧食與飲水完全耗盡，強迫撤退";
  } else if (next.hp <= 0) {
    next.status = "lost";
    next.lostReason = "途中受創過重，強迫撤退";
  }
  return next;
}

export function prepareExpeditionWave(state, waveIndex, opts = {}) {
  const safeWaveIndex = Math.max(
    0,
    Math.min(state.expedition.totalWaves - 1, Number(waveIndex) || 0),
  );
  const prepared = {
    ...state,
    waveIndex: safeWaveIndex,
    monsters: cloneWaveMonsters(state.expedition.waves[safeWaveIndex], state.combatVersion === 2),
    status: "fighting",
    lostReason: null,
    log: [],
    effects: {},
    skippedWaveIndexes: [],
  };
  return resolveTravelEvent(
    prepared,
    opts.eventRand || Math.random,
    opts.selectedEvent || null,
  );
}

// shots: [{ targetInstanceId, score }]（一回合射出的箭）
export function consumeTravelSupplies(state, amount = 0.25) {
  const s = {
    ...state,
    supplies: { ...state.supplies },
    log: [...(state.log || [])],
  };
  const savePct = Number(s.derived?.supplySavePct) || 0;
  const rate = Math.round(Math.max(0, amount * (1 - savePct)) * 100) / 100;
  s.supplies.food = Math.max(0, Math.round((s.supplies.food - rate) * 100) / 100);
  s.supplies.water = Math.max(0, Math.round((s.supplies.water - rate) * 100) / 100);
  s.log.push({ type: "travelSupply", food: -rate, water: -rate });
  return s;
}

export function processRound(state, shots = [], opts = {}) {
  if (state.status !== "fighting" || state.eventGate) return state;
  const rand = opts.rand || Math.random;
  const skillRand = opts.skillRand || rand;
  const lockedShots = shots.map(shot => ({ ...shot, targetFormat: state.targetFormat || "full_110" }));
  const s = {
    ...state,
    monsters: state.monsters.map(m => ({ ...m })),
    supplies: { ...state.supplies },
    shotStats: { ...(state.shotStats || { count: 0, score: 0 }) },
    effects: { ...(state.effects || {}) },
    log: [],
    defense: state.defense ? { ...state.defense, queue: state.defense.queue.map(monster => ({ ...monster, position: { ...monster.position } })), assistanceUsed: [...state.defense.assistanceUsed] } : null,
  };
  // 累計射擊表現（含射空的：對著已死目標的箭也是射出去的箭）
  for (const shot of shots) {
    s.shotStats.count += 1;
    s.shotStats.score += Math.max(0, Math.min(MAX_ARROW_SCORE, Number(shot?.score) || 0));
  }
  const d = s.derived;

  // 1. 玩家射箭
  for (const shot of lockedShots) {
    const mon = resolveShotTarget(s.monsters, shot.targetInstanceId);
    if (!mon) break;
    const crit = rand() < d.critChance;
    const effectiveAtk = Math.max(1, s.guildStats.atk + effectBonus(s, "player", "atk"));
    const effectiveDef = Math.max(0, mon.def + effectBonus(s, mon.instanceId, "def"));
    const dmg = arrowDamage(shot.score, effectiveAtk, effectiveDef, crit);
    mon.hp = Math.max(0, mon.hp - dmg);
    s.log.push({
      type: "arrow",
      target: mon.instanceId,
      redirected: mon.instanceId !== shot.targetInstanceId,
      selectedTarget: shot.targetInstanceId,
      dmg,
      crit,
      killed: mon.hp <= 0,
    });
  }
  s.monsters = s.monsters.filter(m => m.hp > 0);

  if (s.combatVersion === 2) {
    const livingIds = s.monsters.map(monster => monster.instanceId);
    for (const mon of s.monsters) {
      if (!mon.intent?.counter) continue;
      const counter = advanceCounter(mon.intent.counter, lockedShots, livingIds);
      if (counter.success) {
        s.log.push({ type: "counterSuccess", monsterId: mon.instanceId, skill: mon.intent.name, counter });
        mon.intent = null;
        mon.cooldownLeft = mon.cooldown;
        continue;
      }
      const skillDmg = Math.max(1, Math.round(mon.atk * 1.35));
      if (mon.combatRole === "caster") {
        const applied = applySignedEffect(s, {
          targetId: "player", stat: "atk", value: -Math.max(1, Math.round(s.guildStats.atk * 0.2)),
          duration: 2, sourceId: mon.instanceId, appliedRound: s.round,
        });
        s.effects = applied.effects;
        s.log.push(...applied.log.filter(event => event.type.startsWith("effect")));
      } else if (mon.combatRole === "support") {
        const applied = applySignedEffect(s, {
          targetId: mon.instanceId, stat: "atk", value: Math.max(1, Math.round(mon.atk * 0.25)),
          duration: 2, sourceId: mon.instanceId, appliedRound: s.round,
        });
        s.effects = applied.effects;
        s.log.push(...applied.log.filter(event => event.type.startsWith("effect")));
      } else if (s.missionMode === "defense" && mon.targetPolicy === "gate") {
        s.defense.gateHp = Math.max(0, s.defense.gateHp - skillDmg);
      } else {
        s.hp = Math.max(0, s.hp - skillDmg);
      }
      s.log.push({ type: "skillResolve", monsterId: mon.instanceId, skill: mon.intent.name, damage: skillDmg, counter });
      mon.intent = null;
      mon.cooldownLeft = mon.cooldown;
    }
  }

  // 1b. 貓貓攻擊（自動鎖定最近/低血怪，助攻清場）
  for (const cat of s.cats || []) {
    const alive = s.monsters.filter(m => m.hp > 0);
    if (!alive.length) break;
    const target = alive.slice().sort((a, b) => a.distance - b.distance || a.hp - b.hp)[0];
    const dmg = Math.max(1, Math.round((cat.atk || 10) - target.def * 0.3));
    target.hp = Math.max(0, target.hp - dmg);
    s.log.push({ type: "catAttack", cat: cat.id, name: cat.name, target: target.instanceId, dmg, killed: target.hp <= 0 });
  }
  s.monsters = s.monsters.filter(m => m.hp > 0);

  // 2. 波次清空 → 勝利 / 進下一波（清波該回合怪不推進）
  let clearedWave = false;
  if (s.monsters.length === 0) {
    if (s.missionMode === "defense" && s.defense.queue.length) {
      clearedWave = true;
    } else if (s.missionMode === "defense") {
      clearedWave = true;
      s.status = "won";
    } else {
    clearedWave = true;
    if (s.waveIndex + 1 >= s.expedition.totalWaves) {
      s.status = "won";
    } else if (opts.pauseBetweenWaves) {
      s.status = "waveCleared";
      s.log.push({ type: "waveClear", nextWave: s.waveIndex + 1 });
    } else {
      s.waveIndex += 1;
      s.monsters = cloneWaveMonsters(s.expedition.waves[s.waveIndex], s.combatVersion === 2);
      s.log.push({ type: "waveClear", nextWave: s.waveIndex });
      const afterEvent = resolveTravelEvent(s, opts.eventRand || rand);
      Object.assign(s, afterEvent);
      if (s.status !== "fighting") return s;
    }
    }
  }

  // 3. 存活怪推進 + 距離歸零攻擊（清波回合跳過）
  if (!clearedWave) {
    const occupied = new Set(s.monsters.map(mon => `${mon.position?.lane ?? 0}:${mon.distance}`));
    for (const mon of s.monsters) {
      const oldCell = `${mon.position?.lane ?? 0}:${mon.distance}`;
      occupied.delete(oldCell);
      const speed = s.combatVersion === 2 ? Math.max(0, mon.moveSpeed || 1) : 1;
      const range = s.combatVersion === 2 ? Math.max(0, mon.attackRange || 0) : 0;
      let nextDistance = Math.max(0, mon.distance - speed);
      let lane = mon.position?.lane ?? 0;
      if (s.combatVersion === 2 && occupied.has(`${lane}:${nextDistance}`)) {
        const alternate = [0, 1, 2].find(candidate => !occupied.has(`${candidate}:${nextDistance}`));
        if (alternate == null) nextDistance = mon.distance;
        else lane = alternate;
      }
      const movedFrom = mon.distance;
      const movedLaneFrom = mon.position?.lane ?? lane;
      mon.distance = nextDistance;
      if (mon.position) mon.position = { lane, depth: nextDistance };
      occupied.add(`${lane}:${nextDistance}`);
      // 推進事件：舊版只改 distance 不留 log，UI 沒有錨點可以演出，怪物只會在回合
      // 最後 setState 時一次跳位——使用者回報「怪物好像也沒有移動畫面」就是這個。
      if (movedFrom !== nextDistance || movedLaneFrom !== lane) {
        s.log.push({
          type: "monsterMove", id: mon.instanceId,
          from: movedFrom, to: nextDistance, lane, laneFrom: movedLaneFrom,
        });
      }
      if (mon.distance <= range) {
        if (rand() < d.dodgeChance) { s.log.push({ type: "dodge", from: mon.instanceId }); continue; }
        const effectiveMonsterAtk = Math.max(1, mon.atk + effectBonus(s, mon.instanceId, "atk"));
        // 距離越近越痛：射程邊緣 ×1、貼到 0 格 ×2（見 guildCombatV2.PROXIMITY_DAMAGE）
        const proximity = s.combatVersion === 2 ? proximityDamageMultiplier(mon.distance, range) : 1;
        const dmg = Math.max(1, Math.round(effectiveMonsterAtk * (1 - d.dmgReducePct / 100) * proximity));
        if (s.missionMode === "defense" && mon.targetPolicy === "gate") {
          s.defense.gateHp = Math.max(0, s.defense.gateHp - dmg);
        } else {
          s.hp = Math.max(0, s.hp - dmg);
        }
        if (s.combatVersion !== 2) mon.distance = 2;
        s.log.push({ type: "monsterAttack", from: mon.instanceId, dmg, range,
          distance: mon.distance, contact: s.combatVersion === 2 && mon.distance === 0,
          role: mon.combatRole });
      }
    }
  }

  if (s.missionMode === "defense" && s.status === "fighting") {
    s.defense.clock += 1;
    if (s.defense.clock <= s.defense.duration && s.defense.queue.length && s.monsters.length < 8) {
      const arriving = { ...s.defense.queue.shift() };
      arriving.distance = 10;
      arriving.position = { ...arriving.position, depth: 10 };
      s.monsters.push(arriving);
      s.log.push({ type: "defenseSpawn", monsterId: arriving.instanceId, remaining: s.defense.queue.length });
    }
    const maxAssists = s.defense.duration <= 6 ? 1 : s.defense.duration <= 10 ? 2 : 3;
    if (s.defense.clock === s.defense.nextAssistanceRound && s.defense.assistanceUsed.length < maxAssists) {
      const assistancePool = ["hunter_volley", "gate_guard", "scout_report", "trap_team", "supply_runner"];
      let assistanceId = assistancePool[(s.defense.assistanceOffset + s.defense.assistanceUsed.length) % assistancePool.length];
      if (assistanceId === "supply_runner" && s.defense.clock >= s.defense.duration) assistanceId = "hunter_volley";
      s.defense.assistanceUsed.push(assistanceId);
      if (assistanceId === "supply_runner") {
        s.supplies.food = Math.min(10, s.supplies.food + 1);
        s.supplies.water = Math.min(10, s.supplies.water + 1);
        s.log.push({ type: "villagerAssist", id: assistanceId, label: "補給隊送達", summary: "補充食物 1、飲用水 1", food: 1, water: 1, leaves: true });
      } else if (assistanceId === "hunter_volley") {
        const volleyDamage = Math.max(1, Math.round(s.guildStats.atk * 0.5));
        const targets = s.monsters.map(monster => {
          const hpBefore = monster.hp;
          monster.hp = Math.max(0, monster.hp - volleyDamage);
          return { instanceId: monster.instanceId, name: monster.name, hpBefore, hpAfter: monster.hp, damage: hpBefore - monster.hp, defeated: monster.hp <= 0 };
        });
        s.monsters = s.monsters.filter(monster => monster.hp > 0);
        const totalDamage = targets.reduce((sum, target) => sum + target.damage, 0);
        s.log.push({ type: "villagerAssist", id: assistanceId, label: "獵人齊射", summary: `命中 ${targets.length} 隻怪物，共造成 ${totalDamage} 傷害`, totalDamage, targets, leaves: true });
      } else if (assistanceId === "gate_guard") {
        const healed = Math.max(1, Math.round(s.defense.gateMaxHp * 0.15));
        const hpBefore = s.defense.gateHp;
        s.defense.gateHp = Math.min(s.defense.gateMaxHp, s.defense.gateHp + healed);
        const restored = s.defense.gateHp - hpBefore;
        s.log.push({ type: "villagerAssist", id: assistanceId, label: "守衛修補城門", summary: `城門恢復 ${restored} 生命`, gateHp: restored, hpBefore, hpAfter: s.defense.gateHp, leaves: true });
      } else if (assistanceId === "trap_team") {
        const trapDamage = Math.max(1, Math.round(s.guildStats.atk * 0.3));
        const targets = s.monsters.map(monster => {
          const hpBefore = monster.hp;
          monster.hp = Math.max(0, monster.hp - trapDamage);
          monster.distance += 1;
          if (monster.position) monster.position = { ...monster.position, depth: monster.distance };
          return { instanceId: monster.instanceId, name: monster.name, hpBefore, hpAfter: monster.hp, damage: hpBefore - monster.hp, pushed: 1, defeated: monster.hp <= 0 };
        });
        s.monsters = s.monsters.filter(monster => monster.hp > 0);
        const totalDamage = targets.reduce((sum, target) => sum + target.damage, 0);
        s.log.push({ type: "villagerAssist", id: assistanceId, label: "陷阱隊伏擊", summary: `命中 ${targets.length} 隻怪物，共造成 ${totalDamage} 傷害並擊退 1 格`, totalDamage, targets, leaves: true });
      } else {
        const revealed = s.defense.queue.slice(0, 3).map(monster => monster.name);
        s.log.push({ type: "villagerAssist", id: assistanceId, label: "斥候回報敵情", summary: revealed.length ? `發現即將接近的敵人：${revealed.join("、")}` : "目前沒有新的敵軍接近", revealed, leaves: true });
      }
      s.defense.nextAssistanceRound += 4;
      s.eventGate = { ...s.log.at(-1) };
    }
    if (s.defense.gateHp <= 0) {
      s.status = "lost";
      s.lostReason = "城門遭到摧毀，防守失敗";
    } else if (!s.defense.queue.length && !s.monsters.length) {
      s.status = "won";
    }
  }

  if (s.combatVersion === 2 && s.status === "fighting") {
    const resolvedThisRound = new Set(s.log.filter(event =>
      event.type === "counterSuccess" || event.type === "skillResolve"
    ).map(event => event.monsterId));
    for (const mon of s.monsters) {
      if (mon.intent || resolvedThisRound.has(mon.instanceId)) continue;
      mon.cooldownLeft = Math.max(0, (mon.cooldownLeft ?? mon.cooldown) - 1);
      if (mon.cooldownLeft === 0 && skillRand() < (mon.skillChance ?? 0.25)) {
        mon.intent = {
          name: mon.signatureName || `${mon.combatRole}技能`,
          target: mon.targetPolicy,
          consequence: mon.combatRole === "caster" ? "降低玩家 ATK 2 次行動" : "造成強力攻擊",
          counter: counterForMonster(mon),
        };
        s.log.push({ type: "skillIntent", monsterId: mon.instanceId, intent: mon.intent });
      }
    }
    for (const [key, effect] of Object.entries(s.effects)) {
      if ((effect.appliedRound ?? s.round) >= s.round) continue;
      const duration = effect.duration - 1;
      if (duration <= 0) {
        delete s.effects[key];
        s.log.push({ type: "effectRemove", effect });
      } else {
        s.effects[key] = { ...effect, duration };
      }
    }
  }

  // 4. 消耗補給（VIT 減緩；箭數越多消耗越快——見 GUILD_ARROWS_OPTIONS 的平衡說明）
  const arrowScale = normalizeArrowsPerRound(s.arrowsPerRound) / BASE_ARROWS;
  const rate = (1 - d.supplySavePct) * arrowScale;
  s.supplies.food = Math.max(0, Math.round((s.supplies.food - rate) * 100) / 100);
  s.supplies.water = Math.max(0, Math.round((s.supplies.water - rate) * 100) / 100);
  const starving = s.supplies.food <= 0 || s.supplies.water <= 0;
  if (starving) {
    const dmg = Math.max(1, Math.round(s.maxHp * 0.1));
    s.hp = Math.max(0, s.hp - dmg);
    s.log.push({ type: "starve", dmg });
  }

  s.round += 1;

  // 5. 敗北判定
  if (s.hp <= 0 && s.status !== "won") {
    s.status = "lost";
    s.lostReason = starving ? "補給耗盡＋力竭，強迫撤退" : "陣亡";
  }
  return s;
}

// 整趟命中率（0~1）：總得分 ÷ 總滿分。沒射過箭 → 0（跳過回合不會白賺加成）
export function shootingRatio(state) {
  const st = state?.shotStats || { count: 0, score: 0 };
  if (!st.count) return 0;
  return Math.max(0, Math.min(1, st.score / (st.count * MAX_ARROW_SCORE)));
}

// 目前可鎖定的存活目標（畫面用，≤4 由 rollExpedition 保證）
export function aliveTargets(state) {
  return state.monsters.filter(m => m.hp > 0);
}
