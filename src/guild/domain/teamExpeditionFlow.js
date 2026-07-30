// src/guild/domain/teamExpeditionFlow.js
// ─────────────────────────────────────────────────────────────
// 委託遠征「組隊版」戰鬥核心（純函數）。與單人版 `expeditionFlow.js` 的關係：
//   ✅ 共用：箭傷公式（`arrowDamage`）、六維推導（`deriveGuildCombat`）、波次資料結構
//   🔀 不同：怪物是**全隊共享**的，但 HP／補給／六維／貓／射擊表現是**每人各自一份**
//
// 為什麼不硬塞進單人版：單人狀態機只有一個 `hp`／`guildStats`／`supplies`。要支援多人得把
// 那三樣改成 map，等於整支重寫，而且會讓單人流程也承擔多人的複雜度。分兩支、共用公式最乾淨。
//
// 一回合流程（跟單人版同順序，只是每一步都跑過所有人）：
//   1. 全隊射箭 → 各自用自己的 ATK 打共享怪物
//   2. 全隊的貓助攻
//   3. 波次清空 → 進下一波；最後一波清空 → 勝利（清波回合怪不推進）
//   4. 存活怪 distance −1；歸零 → **隨機挑一個還活著的隊員**攻擊（用該員的 DEF／AGI 判定）
//   5. 每人各自消耗補給（VIT 減緩、箭數放大）
//   6. HP≤0 → 該員 `down`（不能再射，但全隊繼續）；**全員 down 才算失敗**
//
// ⚠️ 隔離鐵律照舊：只用公會六維（guildStats），永不碰主線戰力。
// ─────────────────────────────────────────────────────────────
import { deriveGuildCombat } from "./guildStats";
import {
  arrowDamage,
  resolveShotTarget,
  normalizeArrowsPerRound,
  MAX_ARROW_SCORE,
  pickTravelEvent,
  resolveTravelEvent,
} from "./expeditionFlow";
import { advanceCounter, createCounter, toGridMonster } from "./guildCombatV2";

export const MAX_TEAM_SIZE = 4;          // 遠征是精銳小隊；人越多怪也越硬（見 partyHpScale）
const BASE_ARROWS = 3;
const teamCounterFor = monster => monster.combatRole === "caster"
  ? createCounter("exactRing", {
    targetId: monster.instanceId,
    exactRing: 3,
    exactRings: { full_110: 3, indoor_40: 3, compound_510: 6, half_610: 7, triple: 7, field_16: 3 },
  })
  : monster.combatRole === "support"
    ? createCounter("defeatCaster", { targetId: monster.instanceId })
    : monster.combatRole === "heavy"
      ? createCounter("totalScore", { targetId: monster.instanceId, threshold: 20 })
      : createCounter("minScore", { targetId: monster.instanceId, threshold: 9 });

// 人數加成：4 人打單人份的怪會三回合清場，沒有挑戰。怪物 HP 隨人數放大，
// 但**放大幅度小於人數**（1 人 1.0 → 4 人 2.8，不是 4.0），讓組隊仍然比較輕鬆——
// 組隊的獎勵是「效率」而不是「更難」。
export function partyHpScale(size) {
  const n = Math.max(1, Math.min(MAX_TEAM_SIZE, Math.floor(size) || 1));
  return Math.round((1 + 0.6 * (n - 1)) * 100) / 100;
}

// 把 rollExpedition 產出的 expedition 依人數放大怪物 HP（純函數，不動原物件）
export function scaleExpeditionForParty(expedition, size) {
  const mult = partyHpScale(size);
  if (mult === 1) return expedition;
  return {
    ...expedition,
    partySize: size,
    partyHpScale: mult,
    waves: (expedition.waves || []).map(w => ({
      ...w,
      monsters: (w.monsters || []).map(m => ({
        ...m,
        hp: Math.max(1, Math.round(m.hp * mult)),
        maxHp: Math.max(1, Math.round((m.maxHp ?? m.hp) * mult)),
      })),
    })),
  };
}

function cloneWaveMonsters(wave) {
  return (wave?.monsters || []).map((m, index) => {
    const grid = toGridMonster(m, index);
    return { ...grid, distance: grid.position.depth };
  });
}

// members: [{ id, name, guildStats, supplies, cats, arrowsPerRound, avatarId? }]
export function createTeamState(expedition, members = [], opts = {}) {
  const roster = members.slice(0, MAX_TEAM_SIZE);
  const scaled = opts.alreadyScaled ? expedition : scaleExpeditionForParty(expedition, roster.length);
  const memberMap = {};
  for (const m of roster) {
    const derived = deriveGuildCombat(m.guildStats);
    memberMap[m.id] = {
      id: m.id,
      name: m.name || "隊員",
      avatarId: m.avatarId || null,
      guildStats: m.guildStats,
      derived,
      maxHp: derived.maxHP,
      hp: derived.maxHP,
      supplies: { food: m.supplies?.food ?? 6, water: m.supplies?.water ?? 6 },
      cats: (m.cats || []).map(c => ({ ...c })),
      arrowsPerRound: normalizeArrowsPerRound(m.arrowsPerRound),
      targetFormat: m.targetFormat || opts.targetFormat || "full_110",
      shotStats: { count: 0, score: 0 },
      status: "alive",                 // alive | down
    };
  }
  const missionMode = opts.missionMode || "assault";
  const defenseRoster = missionMode === "defense"
    ? (scaled.waves || []).flatMap(wave => cloneWaveMonsters(wave))
    : [];
  return {
    expedition: scaled,
    missionMode,
    partySize: roster.length,
    combatVersion: 2,
    members: memberMap,
    order: roster.map(m => m.id),
    waveIndex: 0,
    monsters: missionMode === "defense" ? defenseRoster.slice(0, 3) : cloneWaveMonsters(scaled.waves[0]),
    defense: missionMode === "defense" ? {
      clock: 0,
      duration: Math.max(6, defenseRoster.length + 2),
      gateHp: 150 + roster.length * 50,
      gateMaxHp: 150 + roster.length * 50,
      queue: defenseRoster.slice(3).map((monster, index) => ({
        ...monster, distance: 11 + index, position: { ...monster.position, depth: 11 + index },
      })),
      assistanceUsed: [],
    } : null,
    round: 1,
    status: "fighting",                // fighting | won | lost
    lostReason: null,
    log: [],
    effects: {},
  };
}

export function aliveTeamTargets(state) {
  return (state?.monsters || []).filter(m => m.hp > 0);
}

export function aliveMemberIds(state) {
  return (state?.order || []).filter(id => state.members[id]?.status === "alive");
}

// 單一隊員的整趟命中率（結算掉落加成用；跟單人版 shootingRatio 同定義）
export function memberShootingRatio(state, memberId) {
  const st = state?.members?.[memberId]?.shotStats || { count: 0, score: 0 };
  if (!st.count) return 0;
  return Math.max(0, Math.min(1, st.score / (st.count * MAX_ARROW_SCORE)));
}

// 把組隊狀態「投影」成單人版的形狀，讓 `settleExpedition` 原封不動就能用。
// 每人各自用**自己的** derived（LUK 掉寶加成）與 shotStats（命中率分帶）結算，
// 所以同一場戰鬥裡射得準的人拿得比較好——這才符合「這是射箭遊戲」。
//
// ⚠️ 刻意的設計：`settleExpedition` 只數「怪物隻數」不看 HP，而組隊只放大 HP 不加隻數，
//    所以每人拿到的量跟單人一樣。4 人打 2.8 倍血、每人拿滿額 → 組隊確實划算，這是故意的
//    （組隊的獎勵就是效率）。要收緊的話改這裡的 opts，不要去動 settleExpedition。
export function memberSettleState(teamState, memberId) {
  const m = teamState?.members?.[memberId];
  if (!m) return null;
  return {
    status: teamState.status,
    lostReason: teamState.lostReason || null,
    derived: m.derived,
    guildStats: m.guildStats,
    shotStats: m.shotStats,
    expedition: teamState.expedition,
    hp: m.hp,
    maxHp: m.maxHp,
    supplies: { ...m.supplies },
  };
}

// shotsByMember: { [memberId]: [{ targetInstanceId, score }] }
export function processTeamRound(state, shotsByMember = {}, opts = {}) {
  if (state.status !== "fighting" || state.eventGate) return state;
  const rand = opts.rand || Math.random;
  const skillRand = opts.skillRand || rand;
    const s = {
    ...state,
    monsters: state.monsters.map(m => ({ ...m })),
    members: Object.fromEntries(Object.entries(state.members).map(([id, m]) => [id, {
      ...m,
      supplies: { ...m.supplies },
      shotStats: { ...(m.shotStats || { count: 0, score: 0 }) },
    }])),
      log: [],
      effects: { ...(state.effects || {}) },
      defense: state.defense ? { ...state.defense, queue: state.defense.queue.map(monster => ({ ...monster })) } : null,
  };

  // 1. 全隊射箭（每人用自己的 ATK 與爆擊率；已 down 的人射出的箭一律忽略）
  for (const memberId of s.order) {
    const me = s.members[memberId];
    if (!me || me.status !== "alive") continue;
    for (const shot of shotsByMember[memberId] || []) {
      // 射擊表現照算（射空的也是射出去的箭），這樣掉落加成才誠實
      me.shotStats.count += 1;
      me.shotStats.score += Math.max(0, Math.min(MAX_ARROW_SCORE, Number(shot?.score) || 0));
      const mon = resolveShotTarget(s.monsters, shot.targetInstanceId);
      if (!mon) break;
      const crit = rand() < me.derived.critChance;
      const dmg = arrowDamage(shot.score, me.guildStats.atk, mon.def, crit);
      mon.hp = Math.max(0, mon.hp - dmg);
      s.log.push({
        type: "arrow",
        by: memberId,
        byName: me.name,
        target: mon.instanceId,
        redirected: mon.instanceId !== shot.targetInstanceId,
        selectedTarget: shot.targetInstanceId,
        dmg,
        crit,
        killed: mon.hp <= 0,
      });
    }
  }
  s.monsters = s.monsters.filter(m => m.hp > 0);

  const allShots = s.order.flatMap(memberId =>
    (shotsByMember[memberId] || []).map(shot => ({
      ...shot,
      targetFormat: s.members[memberId]?.targetFormat || "full_110",
    }))
  );
  const livingMonsterIds = s.monsters.map(monster => monster.instanceId);
  for (const monster of s.monsters) {
    if (!monster.intent?.counter) continue;
    const counter = advanceCounter(monster.intent.counter, allShots, livingMonsterIds);
    if (counter.success) {
      s.log.push({ type: "counterSuccess", monsterId: monster.instanceId, skill: monster.intent.name, counter });
    } else {
      const victims = aliveMemberIds(s);
      const victimId = victims[0];
      if (victimId) {
        const victim = s.members[victimId];
        const damage = Math.max(1, Math.round(monster.atk * 1.35));
        victim.hp = Math.max(0, victim.hp - damage);
        s.log.push({ type: "skillResolve", monsterId: monster.instanceId, skill: monster.intent.name, by: victimId, damage, counter });
      }
    }
    monster.intent = null;
    monster.cooldownLeft = monster.cooldown;
  }

  // 2. 全隊的貓助攻（各自鎖定最近/低血怪）
  for (const memberId of s.order) {
    const me = s.members[memberId];
    if (!me || me.status !== "alive") continue;
    for (const cat of me.cats || []) {
      const alive = s.monsters.filter(m => m.hp > 0);
      if (!alive.length) break;
      const target = alive.slice().sort((a, b) => a.distance - b.distance || a.hp - b.hp)[0];
      const dmg = Math.max(1, Math.round((cat.atk || 10) - target.def * 0.3));
      target.hp = Math.max(0, target.hp - dmg);
      s.log.push({ type: "catAttack", by: memberId, cat: cat.id, name: cat.name, target: target.instanceId, dmg, killed: target.hp <= 0 });
    }
  }
  s.monsters = s.monsters.filter(m => m.hp > 0);

  // 3. 波次清空 → 勝利 / 進下一波
  let clearedWave = false;
  if (s.monsters.length === 0) {
    clearedWave = true;
    if (s.missionMode === "defense" && s.defense.queue.length) {
      // 還有視距外增援時，暫時清場不結算。
    } else if (s.missionMode === "defense") {
      s.status = "won";
    } else if (s.waveIndex + 1 >= s.expedition.totalWaves) {
      s.status = "won";
    } else if (s.missionMode === "exploration") {
      s.awaitingMap = true;
      s.log.push({ type:"mapEncounterClear", waveIndex:s.waveIndex });
    } else {
      s.waveIndex += 1;
      s.monsters = cloneWaveMonsters(s.expedition.waves[s.waveIndex]);
      s.log.push({ type: "waveClear", nextWave: s.waveIndex });
    }

    // 全隊共同遭遇同一個旅途事件，但依各自補給與 HP 套用結果。
    const event = s.status === "won" ? null : pickTravelEvent(opts.eventRand || rand);
    for (const memberId of aliveMemberIds(s)) {
      const me = s.members[memberId];
      if (!event) continue;
      const resolved = resolveTravelEvent({
        supplies: me.supplies,
        hp: me.hp,
        maxHp: me.maxHp,
        status: "fighting",
        lostReason: null,
        log: [],
      }, opts.eventRand || rand, event);
      me.supplies = resolved.supplies;
      me.hp = resolved.hp;
      if (resolved.status === "lost") me.status = "down";
      s.log.push({ ...resolved.log[0], by: memberId, byName: me.name });
    }
    if (!aliveMemberIds(s).length) {
      s.status = "lost";
      s.lostReason = "全隊補給耗盡，強迫撤退";
      return s;
    }
  }

  // 4. 怪物推進 → 距離歸零時隨機挑一個還活著的隊員打（用該員的閃避/減傷）
  if (!clearedWave) {
    for (const mon of s.monsters) {
      mon.distance = Math.max(0, mon.distance - (mon.moveSpeed || 1));
      if (mon.position) mon.position = { ...mon.position, depth: mon.distance };
      if (mon.distance > (mon.attackRange || 0)) continue;
      const targets = aliveMemberIds(s);
      if (!targets.length) break;
      const victimId = targets[Math.floor(rand() * targets.length)];
      const victim = s.members[victimId];
      if (rand() < victim.derived.dodgeChance) {
        s.log.push({ type: "dodge", by: victimId, byName: victim.name, from: mon.instanceId });
        continue;
      }
        const dmg = Math.max(1, Math.round(mon.atk * (1 - victim.derived.dmgReducePct / 100)));
        if (s.missionMode === "defense" && mon.targetPolicy === "gate") s.defense.gateHp = Math.max(0, s.defense.gateHp - dmg);
        else victim.hp = Math.max(0, victim.hp - dmg);
      s.log.push({ type: "monsterAttack", by: victimId, byName: victim.name, from: mon.instanceId, dmg });
    }
  }

  if (s.missionMode === "defense" && s.status === "fighting") {
    s.defense.clock += 1;
    if (s.defense.clock <= s.defense.duration && s.defense.queue.length && s.monsters.length < 8) {
      const arriving = { ...s.defense.queue.shift(), distance: 10 };
      arriving.position = { ...arriving.position, depth: 10 };
      s.monsters.push(arriving);
      s.log.push({ type: "defenseSpawn", monsterId: arriving.instanceId, remaining: s.defense.queue.length });
    }
    if (s.defense.clock === 3) {
      s.defense.assistanceUsed.push("hunter_volley");
      const targets = s.monsters.map(monster => {
        const hpBefore = monster.hp;
        monster.hp = Math.max(0, monster.hp - 10);
        return { instanceId: monster.instanceId, name: monster.name, hpBefore, hpAfter: monster.hp, damage: hpBefore - monster.hp, defeated: monster.hp <= 0 };
      });
      s.monsters = s.monsters.filter(monster => monster.hp > 0);
      const totalDamage = targets.reduce((sum, target) => sum + target.damage, 0);
      const assistEvent = { type: "villagerAssist", id: "hunter_volley", label: "獵人齊射", summary: `命中 ${targets.length} 隻怪物，共造成 ${totalDamage} 傷害`, totalDamage, targets, leaves: true };
      s.log.push(assistEvent);
      s.eventGate = { ...assistEvent };
    }
    if (s.defense.gateHp <= 0) {
      s.status = "lost";
      s.lostReason = "城門遭到摧毀，防守失敗";
    } else if (!s.defense.queue.length && !s.monsters.length) {
      s.status = "won";
    }
  }

  if (s.status === "fighting") {
    const resolvedThisRound = new Set(s.log.filter(event =>
      event.type === "counterSuccess" || event.type === "skillResolve"
    ).map(event => event.monsterId));
    for (const monster of s.monsters) {
      if (monster.intent || resolvedThisRound.has(monster.instanceId)) continue;
      monster.cooldownLeft = Math.max(0, (monster.cooldownLeft ?? monster.cooldown) - 1);
      if (monster.cooldownLeft === 0 && skillRand() < (monster.skillChance ?? 0.25)) {
        monster.intent = {
          name: monster.signatureName || `${monster.combatRole}技能`,
          target: monster.targetPolicy,
          consequence: "對隊伍或據點造成強力效果",
          counter: teamCounterFor(monster),
        };
        s.log.push({ type: "skillIntent", monsterId: monster.instanceId, intent: monster.intent });
      }
    }
  }

  // 5. 每人各自消耗補給
  for (const memberId of s.order) {
    const me = s.members[memberId];
    if (!me || me.status !== "alive") continue;
    const arrowScale = normalizeArrowsPerRound(me.arrowsPerRound) / BASE_ARROWS;
    const rate = (1 - me.derived.supplySavePct) * arrowScale;
    me.supplies.food = Math.max(0, Math.round((me.supplies.food - rate) * 100) / 100);
    me.supplies.water = Math.max(0, Math.round((me.supplies.water - rate) * 100) / 100);
    if (me.supplies.food <= 0 || me.supplies.water <= 0) {
      const dmg = Math.max(1, Math.round(me.maxHp * 0.1));
      me.hp = Math.max(0, me.hp - dmg);
      s.log.push({ type: "starve", by: memberId, byName: me.name, dmg });
    }
  }

  // 6. 倒地判定：個人歸零只是 down（全隊繼續打），**全員 down 才失敗**
  for (const memberId of s.order) {
    const me = s.members[memberId];
    if (me && me.status === "alive" && me.hp <= 0) {
      me.status = "down";
      s.log.push({ type: "memberDown", by: memberId, byName: me.name });
    }
  }
  s.round += 1;
  if (!aliveMemberIds(s).length && s.status === "fighting") {
    s.status = "lost";
    s.lostReason = "全隊倒地，遠征失敗";
  }
  return s;
}

export function prepareTeamExpeditionWave(state, waveIndex) {
  if (!state?.expedition?.waves?.[waveIndex]) return state;
  return {
    ...state,
    status:"fighting",
    awaitingMap:false,
    waveIndex,
    monsters:cloneWaveMonsters(state.expedition.waves[waveIndex]),
    log:[],
  };
}
