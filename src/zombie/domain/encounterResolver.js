// src/zombie/domain/encounterResolver.js
// ═══════════════════════════════════════════════════════════════
//  殭屍生存模式 — 遭遇解析器（純函數）
//  Phase 2：5 種特殊箭矢 + 4 種殭屍原型完整規則 + 防具/感染整合
//  無副作用、無 React、無 Firestore
// ═══════════════════════════════════════════════════════════════

import { ZOMBIE_STATUS, getArchetype, generateEncounterProfile } from "../data/zombieArchetypes";

// ═════════════════════════════════════════════════════════════
//  事件類型常數
// ═════════════════════════════════════════════════════════════

export const EVENT = {
  ARROW_HIT:           "arrow_hit",
  ARROW_MISS:          "arrow_miss",
  ZOMBIE_KILLED:       "zombie_killed",
  KNOCKBACK:           "knockback",
  SPECIAL_KNOCKBACK:   "special_knockback",   // 特殊箭額外擊退
  SLOWED:              "slowed",
  ARM_DISABLED:        "arm_disabled",
  ZOMBIE_MOVE:         "zombie_move",
  ZOMBIE_ARRIVE:       "zombie_arrive",
  RESCUE_WINDOW:       "rescue_window",
  RESCUE_SUCCESS:      "rescue_success",
  RESCUE_FAILED:       "rescue_failed",
  ARMOR_BLOCK:         "armor_block",
  INFECTION:           "infection",
  CHARGE_ATTACK:       "charge_attack",        // 重裝殭屍破甲衝撞
  AUTO_INTERFERE:      "auto_interfere",       // 遠程殭屍干擾
  INTERFERE_LOSE_ARROW: "interfere_lose_arrow",// 干擾失去箭矢
  PENETRATION_HIT:     "penetration_hit",      // 穿透箭第二目標
  EXPLOSION:           "explosion",            // 爆炸箭範圍
  ENCOUNTER_WIN:       "encounter_win",
  ENCOUNTER_LOSE:      "encounter_lose",
  ROUND_END:           "round_end",
};

// ═════════════════════════════════════════════════════════════
//  核心：處理完整回合
// ═════════════════════════════════════════════════════════════

/**
 * 處理一整個回合
 * @param {ResolverState} state
 * @param {Object<string, ZombieArrow[]>} submissions — memberId → [{ targetSlot, isMiss, arrowType?, nx?, ny? }]
 * @param {object} [options]
 * @param {number}  [options.maxArrowsPerPlayer=3]
 * @param {boolean} [options.randomize=true]
 * @returns {ResolverResult}
 */
export function processRound(state, submissions, options = {}) {
  const { maxArrowsPerPlayer = 3, randomize = true } = options;
  const rand = randomize ? Math.random : () => 0.5;

  const events = [];
  const nextZombies = JSON.parse(JSON.stringify(state.zombies));
  const nextSurvivors = JSON.parse(JSON.stringify(state.survivors));
  const round = state.round + 1;

  // 收集所有已處理的爆炸/穿透影響（避免重複處理）
  const processedEffects = new Set();

  // ── Phase 1a：遠程殭屍自動干擾（回合開始時）────────────
  const rangedZombies = Object.values(nextZombies).filter(
    z => z.alive && z.archetypeId === "ranged" && z.distanceM <= 8
  );
  for (const z of rangedZombies) {
    // 干擾一名隨機存活射手
    const shooters = Object.keys(nextSurvivors).filter(
      id => nextSurvivors[id].alive
    );
    if (shooters.length === 0) continue;
    const targetId = shooters[Math.floor(rand() * shooters.length)];
    events.push({
      type: EVENT.AUTO_INTERFERE,
      payload: { zombieId: z.id, targetId, distance: z.distanceM },
    });
    // 標記目標受干擾（後續削減箭數）
    if (!z.rangedInterfered) z.rangedInterfered = true;
  }

  // ── Phase 1b：檢查干擾影響（減少受干擾射手的可用箭數）──
  const effectiveMaxArrows = {};
  for (const [mid] of Object.entries(submissions)) {
    let max = maxArrowsPerPlayer;
    // 是否被遠程殭屍干擾
    const interfered = Object.values(nextZombies).some(
      z => z.alive && z.rangedInterfered && submissions[mid]
    );
    if (interfered) {
      max = Math.max(1, max - 1);
      events.push({
        type: EVENT.INTERFERE_LOSE_ARROW,
        payload: { memberId: mid, originalMax: maxArrowsPerPlayer, reducedTo: max },
      });
    }
    effectiveMaxArrows[mid] = max;
  }

  // 清除干擾標記（每回合重置）
  for (const z of Object.values(nextZombies)) {
    delete z.rangedInterfered;
  }

  // ── Phase 2：玩家箭矢 ─────────────────────────────────
  for (const [memberId, arrows] of Object.entries(submissions)) {
    const survivor = nextSurvivors[memberId];
    if (!survivor || !survivor.alive) continue;

    const maxArrows = effectiveMaxArrows[memberId] || maxArrowsPerPlayer;
    const shotArrows = [];

    for (let i = 0; i < Math.min(arrows.length, maxArrows); i++) {
      const arrow = arrows[i];
      const arrowType = arrow.arrowType || "normal";

      // 找到目標殭屍（依 targetSlot 配對）
      const zombieEntry = Object.entries(nextZombies).find(
        ([, z]) => z.alive && z.targetSlot === arrow.targetSlot
      );
      if (!zombieEntry) {
        events.push({
          type: EVENT.ARROW_MISS,
          payload: { memberId, targetSlot: arrow.targetSlot, reason: "no_target", arrowType },
        });
        shotArrows.push(arrow);
        continue;
      }
      const [zombieId, zombie] = zombieEntry;

      // 解析命中（含特殊箭效果）
      const hitResult = resolveArrowHit(arrow, zombie, zombie.archetypeId, rand, arrowType, {
        thresholdArrows: arrows,
        allZombies: nextZombies,
        allSurvivors: nextSurvivors,
        processedEffects,
        shuffle: (arr) => {
          const a = [...arr];
          for (let j = a.length - 1; j > 0; j--) {
            const k = Math.floor(rand() * (j + 1));
            [a[j], a[k]] = [a[k], a[j]];
          }
          return a;
        },
        eventEmitter: (evt) => events.push(evt),
      });
      events.push(...hitResult.events);

      // 更新殭屍部位狀態
      if (hitResult.hitPart && hitResult.hitPart !== "miss") {
        zombie.body[hitResult.hitPart] = (zombie.body[hitResult.hitPart] || 0) + 1;

        // 擊退（含特殊箭加成）
        let totalKnockback = hitResult.knockback || 0;
        if (hitResult.specialKnockback > 0) {
          totalKnockback += hitResult.specialKnockback;
          events.push({
            type: EVENT.SPECIAL_KNOCKBACK,
            payload: { zombieId, bonus: hitResult.specialKnockback, total: totalKnockback },
          });
        }
        if (totalKnockback > 0) {
          zombie.distanceM = Math.min(20, zombie.distanceM + totalKnockback);
          events.push({
            type: EVENT.KNOCKBACK,
            payload: { zombieId, distance: totalKnockback, newDistance: zombie.distanceM },
          });
        }

        // 手臂失效
        if (hitResult.armDisabled) {
          const armHits = zombie.body.arm || 0;
          if (armHits >= 2) {
            if (!zombie.statuses.includes(ZOMBIE_STATUS.GRAB_DISABLED)) {
              zombie.statuses.push(ZOMBIE_STATUS.GRAB_DISABLED);
              events.push({ type: EVENT.ARM_DISABLED, payload: { zombieId, level: "full" } });
            }
          } else if (armHits >= 1) {
            if (!zombie.statuses.includes(ZOMBIE_STATUS.GRAB_HALVED)) {
              zombie.statuses.push(ZOMBIE_STATUS.GRAB_HALVED);
              events.push({ type: EVENT.ARM_DISABLED, payload: { zombieId, level: "half" } });
            }
          }
        }

        // 減速（骨盆命中）
        if (hitResult.slowEffect) {
          if (!zombie.statuses.includes(ZOMBIE_STATUS.PELVIS_HIT)) {
            zombie.statuses.push(ZOMBIE_STATUS.PELVIS_HIT);
            events.push({ type: EVENT.SLOWED, payload: { zombieId } });
          }
        }
      }

      // 檢查擊殺
      if (hitResult.killed) {
        zombie.alive = false;
        events.push({
          type: EVENT.ZOMBIE_KILLED,
          payload: { zombieId, memberId, part: hitResult.hitPart, reason: hitResult.killReason, arrowType },
        });
      }

      shotArrows.push(arrow);
    }
  }

  // 檢查是否所有殭屍都被擊殺
  const aliveZombies = Object.values(nextZombies).filter(z => z.alive);
  if (aliveZombies.length === 0) {
    events.push({ type: EVENT.ENCOUNTER_WIN, payload: { round } });
    events.push({ type: EVENT.ROUND_END, payload: { round } });
    return {
      events,
      nextState: { round, zombies: nextZombies, survivors: nextSurvivors },
      encounterOver: true,
    };
  }

  // ── Phase 3：殭屍移動 ─────────────────────────────────
  for (const zombie of aliveZombies) {
    if (zombie.justArrived) {
      zombie.justArrived = false;
      continue;
    }

    const archetype = getArchetype(zombie.archetypeId);
    if (!archetype) continue;

    let moveAmount = roll(archetype.speed.min, archetype.speed.max, rand);

    // 骨盆命中 → 減速（依 archetype 可能有不同效果）
    if (zombie.statuses.includes(ZOMBIE_STATUS.PELVIS_HIT)) {
      const pelvisOverride = archetype.bodyOverrides?.groin?.slowTo;
      if (pelvisOverride) {
        moveAmount = roll(pelvisOverride.min, pelvisOverride.max, rand);
      } else {
        moveAmount = roll(0, 1, rand);
      }
    }

    // 重型殭屍衝刺（累積距離越近越快）
    if (zombie.archetypeId === "armored" && zombie.distanceM <= 4 && zombie.distanceM > 0) {
      moveAmount = Math.max(moveAmount, 2); // 近距離強制加速
    }

    const newDist = Math.max(0, zombie.distanceM - moveAmount);
    const oldDist = zombie.distanceM;
    zombie.distanceM = newDist;

    if (newDist !== oldDist) {
      events.push({
        type: EVENT.ZOMBIE_MOVE,
        payload: { zombieId: zombie.id, from: oldDist, to: newDist, amount: moveAmount, archetypeId: zombie.archetypeId },
      });
    }

    // 抵達 0m
    if (newDist <= 0 && oldDist > 0) {
      zombie.distanceM = 0;
      events.push({
        type: EVENT.ZOMBIE_ARRIVE,
        payload: { zombieId: zombie.id, archetypeId: zombie.archetypeId },
      });
    }
  }

  // ── Phase 4：救援窗口（0m 殭屍 50% 觸發）──────────────
  const zombiesAt0 = aliveZombies.filter(z => z.distanceM <= 0);
  for (const zombie of zombiesAt0) {
    if (rand() < 0.5) {
      events.push({
        type: EVENT.RESCUE_WINDOW,
        payload: { zombieId: zombie.id, seconds: 15 },
      });
    }
  }

  // ── Phase 5：殭屍攻擊 ────────────────────────────────
  for (const zombie of zombiesAt0) {
    if (!zombie.alive) continue;

    const archetype = getArchetype(zombie.archetypeId);
    const targetIds = Object.keys(nextSurvivors).filter(
      id => nextSurvivors[id].alive
    );

    if (targetIds.length === 0) {
      events.push({ type: EVENT.ENCOUNTER_LOSE, payload: { round, reason: "all_down" } });
      events.push({ type: EVENT.ROUND_END, payload: { round } });
      return {
        events,
        nextState: { round, zombies: nextZombies, survivors: nextSurvivors },
        encounterOver: true,
      };
    }

    const targetId = targetIds[zombie.threatCursor % targetIds.length];
    zombie.threatCursor = (zombie.threatCursor + 1) % targetIds.length;
    const survivor = nextSurvivors[targetId];

    // ── 重裝殭屍：破甲衝撞（攻擊判定不同於一般咬傷）────
    if (zombie.archetypeId === "armored") {
      // 衝撞無視部分防具
      const chargePower = (archetype.behavior?.damageBonus || 1.0);
      let blocked = false;

      // 胸甲優先承受衝撞
      const chestArmor = survivor.armor?.chestplate;
      if (chestArmor && chestArmor.durability > 0) {
        const blockChance = getBlockRateForArmor(chestArmor.itemId) * 0.5; // 對衝撞僅 50% 格擋
        if (rand() < blockChance) {
          blocked = true;
          chestArmor.durability = Math.max(0, chestArmor.durability - 2); // 衝撞雙倍耐久消耗
          events.push({
            type: EVENT.ARMOR_BLOCK,
            payload: {
              survivorId: targetId, zombieId: zombie.id,
              armorSlot: "chestplate", attackType: "charge",
              durabilityLeft: chestArmor.durability,
            },
          });
        }
      }

      if (!blocked) {
        // 衝穿防具：直接感染 + 全防具減 1 耐久
        for (const armor of Object.values(survivor.armor || {})) {
          if (armor.durability > 0) armor.durability = Math.max(0, armor.durability - 1);
        }
        survivor.lifeState = "infected";
        events.push({
          type: EVENT.CHARGE_ATTACK,
          payload: { survivorId: targetId, zombieId: zombie.id, penetrated: true },
        });
        events.push({
          type: EVENT.INFECTION,
          payload: { survivorId: targetId, zombieId: zombie.id, source: "重裝殭屍·破甲衝撞", attackType: "charge" },
        });
      } else {
        events.push({
          type: EVENT.CHARGE_ATTACK,
          payload: { survivorId: targetId, zombieId: zombie.id, penetrated: false },
        });
      }
      continue;
    }

    // ── 一般攻擊（咬傷 / 近戰） ─────────────────────────
    let blocked = false;
    const attackPart = getAttackTargetPart(archetype);
    const armorPiece = survivor.armor?.[attackPart];

    if (armorPiece && armorPiece.durability > 0) {
      const blockChance = getBlockRateForArmor(armorPiece.itemId);
      if (rand() < blockChance) {
        blocked = true;
        armorPiece.durability = Math.max(0, armorPiece.durability - 1);
        events.push({
          type: EVENT.ARMOR_BLOCK,
          payload: {
            survivorId: targetId, zombieId: zombie.id,
            armorSlot: attackPart, durabilityLeft: armorPiece.durability,
          },
        });
      }
    }

    if (!blocked) {
      survivor.lifeState = "infected";
      events.push({
        type: EVENT.INFECTION,
        payload: { survivorId: targetId, zombieId: zombie.id, source: archetype?.name || "殭屍", attackType: "bite" },
      });
    }
  }

  events.push({ type: EVENT.ROUND_END, payload: { round } });

  return {
    events,
    nextState: { round, zombies: nextZombies, survivors: nextSurvivors },
    encounterOver: false,
  };
}

// ═════════════════════════════════════════════════════════════
//  單箭命中解析（含特殊箭）
// ═════════════════════════════════════════════════════════════

/**
 * 解析單一箭矢對單一殭屍的命中結果
 * @param {ZombieArrow} arrow
 * @param {ZombieState} zombie
 * @param {string} archetypeId
 * @param {function} rand
 * @param {string} [arrowType="normal"] — ARROW_TYPE 其一
 * @param {object} [ctx] — 擴充上下文（穿透/爆炸用）
 * @returns {object}
 */
export function resolveArrowHit(arrow, zombie, archetypeId, rand = Math.random,
  arrowType = "normal", ctx = {}) {
  const archetype = getArchetype(archetypeId);
  if (!archetype) {
    return {
      events: [{ type: EVENT.ARROW_MISS, payload: { reason: "unknown_archetype" } }],
      hitPart: null, killed: false, knockback: 0, specialKnockback: 0,
      armDisabled: false, slowEffect: false, killReason: null,
    };
  }

  const baseEvents = [];

  // 脫靶
  if (arrow.isMiss) {
    baseEvents.push({ type: EVENT.ARROW_MISS, payload: { zombieId: zombie.id, arrowType } });
    return {
      events: baseEvents, hitPart: "miss", killed: false,
      knockback: 0, specialKnockback: 0, armDisabled: false, slowEffect: false,
      killReason: null,
    };
  }

  const hitPart = determineHitPart(arrow, archetype, rand);

  if (hitPart === "miss") {
    baseEvents.push({ type: EVENT.ARROW_MISS, payload: { zombieId: zombie.id, arrowType } });
    return {
      events: baseEvents, hitPart: "miss", killed: false,
      knockback: 0, specialKnockback: 0, armDisabled: false, slowEffect: false,
      killReason: null,
    };
  }

  const currentHits = (zombie.body[hitPart] || 0) + 1;

  // ── 套用特殊箭效果 ─────────────────────────────────────
  let torsoReduction = 0;
  let bonusKnockback = 0;
  let isPenetration = false;
  let isExplosive = false;
  let isSilent = false;

  switch (arrowType) {
    case "arrow_threshold":
      torsoReduction = 1; // 軀幹門檻 -1
      break;
    case "arrow_knockback":
      bonusKnockback = 2; // 額外擊退 2m
      break;
    case "arrow_penetration":
      isPenetration = true;
      break;
    case "arrow_explosive":
      isExplosive = true;
      break;
    case "arrow_silent":
      isSilent = true;
      break;
  }

  let killed = false;
  let killReason = null;
  let knockback = 0;
  let armDisabled = false;
  let slowEffect = false;

  switch (hitPart) {
    case "head": {
      const headThreshold = archetype.killThreshold.head;
      const gearRequired = archetype.bodyOverrides?.head?.gearRequired;
      if (gearRequired && !arrow.specialEquipment) {
        if (currentHits >= headThreshold) {
          killed = true;
          killReason = `頭部累積 ${headThreshold} 次擊殺`;
        }
      } else {
        if (currentHits >= headThreshold) {
          killed = true;
          killReason = headThreshold === 1 ? "頭部一箭必殺" : `頭部累積 ${headThreshold} 次擊殺`;
        }
      }
      break;
    }

    case "neck": {
      if (currentHits >= 2) {
        killed = true;
        killReason = "第二次頸部命中必殺";
      } else if (rand() < 0.5) {
        killed = true;
        killReason = "頸部致命命中";
      } else {
        knockback = 1;
      }
      break;
    }

    case "chest":
    case "belly": {
      const torsoHits = (zombie.body.chest || 0) + (zombie.body.belly || 0) + 1;
      const torsoThreshold = Math.max(1, (archetype.killThreshold.torso || 3) - torsoReduction);
      knockback = 1;
      if (torsoHits >= torsoThreshold) {
        killed = true;
        killReason = `軀幹累積 ${torsoThreshold} 箭擊殺${torsoReduction > 0 ? "（貫穿箭效果）" : ""}`;
      }
      break;
    }

    case "arm": {
      knockback = 1;
      armDisabled = true;
      break;
    }

    case "groin": {
      knockback = 1;
      slowEffect = true;
      break;
    }

    default:
      break;
  }

  const hitEvent = {
    type: EVENT.ARROW_HIT,
    payload: {
      zombieId: zombie.id, part: hitPart,
      partName: getPartName(hitPart),
      currentHits, killed, arrowType,
    },
  };
  baseEvents.push(hitEvent);

  if (killed) {
    baseEvents.push({
      type: EVENT.ZOMBIE_KILLED,
      payload: { zombieId: zombie.id, part: hitPart, reason: killReason, arrowType },
    });
  }

  // ── 特殊箭：穿透箭（第二目標）─────────────────────────
  if (isPenetration && !killed) {
    const { allZombies, eventEmitter } = ctx;
    if (allZombies) {
      // 找在同一直線上的第二個殭屍（相同目標距離範圍）
      const otherZombies = Object.values(allZombies).filter(
        z => z.id !== zombie.id && z.alive && Math.abs(z.distanceM - zombie.distanceM) <= 4
      );
      if (otherZombies.length > 0) {
        const secondTarget = otherZombies[Math.floor(rand() * otherZombies.length)];
        // 第二目標：臂/腿等非致命部位，傷害減半
        const secondPart = determineHitPart(arrow, getArchetype(secondTarget.archetypeId) || archetype, rand);
        if (secondPart && secondPart !== "miss") {
          secondTarget.body[secondPart] = (secondTarget.body[secondPart] || 0) + 1;
          baseEvents.push({
            type: EVENT.PENETRATION_HIT,
            payload: {
              primaryZombie: zombie.id, secondaryZombie: secondTarget.id,
              part: secondPart, currentHits: secondTarget.body[secondPart],
            },
          });
        }
      }
    }
  }

  // ── 特殊箭：爆炸箭（範圍傷害）─────────────────────────
  if (isExplosive) {
    const { allZombies, eventEmitter } = ctx;
    if (allZombies) {
      const blastRadius = 3;
      const nearby = Object.values(allZombies).filter(
        z => z.id !== zombie.id && z.alive && Math.abs(z.distanceM - zombie.distanceM) <= blastRadius
      );
      for (const nz of nearby) {
        // 爆炸造成 1 點隨機部位傷害
        const blastPart = ["chest", "belly", "arm", "groin"][Math.floor(rand() * 4)];
        nz.body[blastPart] = (nz.body[blastPart] || 0) + 1;
        // 爆炸擊退 1m
        nz.distanceM = Math.min(20, nz.distanceM + 1);
        baseEvents.push({
          type: EVENT.EXPLOSION,
          payload: {
            origin: zombie.id, target: nz.id,
            part: blastPart, newDistance: nz.distanceM,
          },
        });
      }
      // 主目標也受爆炸擊退
      if (!killed) {
        bonusKnockback = Math.max(bonusKnockback, 1);
      }
    }
  }

  return {
    events: baseEvents,
    hitPart, killed,
    knockback,
    specialKnockback: bonusKnockback,
    armDisabled, slowEffect, killReason,
  };
}

// ═════════════════════════════════════════════════════════════
//  遭遇初始化
// ═════════════════════════════════════════════════════════════

/**
 * 建立初始遭遇狀態（支援所有風險區）
 * @param {string} zoneType — ZONE_TYPE 其一
 * @param {string[]} memberIds
 * @param {object} [options]
 * @param {number} [options.startDistanceMin=8]
 * @param {number} [options.startDistanceMax=15]
 * @param {number} [options.forceRound] — 強制指定回合（影響怪物密度）
 * @param {boolean} [options.allowBoss=false]
 * @param {function} [options.rand]
 * @returns {ResolverState}
 */
export function createEncounterState(zoneType, memberIds, options = {}) {
  const {
    startDistanceMin = 8,
    startDistanceMax = 15,
    forceRound,
    allowBoss = false,
    rand = Math.random,
  } = options;

  const profile = generateEncounterProfile(zoneType, forceRound || 1);

  const zombies = {};
  const targetSlots = ["A", "B", "C", "D", "E", "F", "G", "H"];
  let slotIndex = 0;

  for (const archetypeId of profile.archetypes) {
    const perType = Math.ceil(profile.count / profile.archetypes.length);
    for (let i = 0; i < perType; i++) {
      if (slotIndex >= targetSlots.length) break;
      const dist = roll(startDistanceMin, startDistanceMax, rand);
      const zombieId = `zombie_${archetypeId}_${Object.keys(zombies).length}`;
      zombies[zombieId] = {
        id: zombieId,
        archetypeId,
        distanceM: dist,
        targetSlot: targetSlots[slotIndex++],
        body: {},
        statuses: [],
        threatCursor: 0,
        alive: true,
        justArrived: true,
      };
    }
  }

  const survivors = {};
  for (const id of memberIds) {
    survivors[id] = {
      id,
      name: `玩家 ${id.slice(0, 4)}`,
      role: "main_archer",
      alive: true,
      lifeState: "healthy",
      armor: {},
      // Phase 2 擴充：感染狀態、配件
      infection: null,
      accessories: [],
      accessoryUses: {},
    };
  }

  return { round: 0, zombies, survivors };
}

// ═════════════════════════════════════════════════════════════
//  輔助函數
// ═════════════════════════════════════════════════════════════

function roll(min, max, rand = Math.random) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function determineHitPart(arrow, archetype, rand = Math.random) {
  // SVG 座標命中判定（預留）
  const r = rand();
  if (r < 0.10) return "head";
  if (r < 0.20) return "neck";
  if (r < 0.50) return "chest";
  if (r < 0.60) return "belly";
  if (r < 0.75) return "arm";
  if (r < 0.85) return "groin";
  return "miss";
}

function getPartName(partId) {
  const names = {
    head: "頭部", neck: "頸部", chest: "胸腔", belly: "腹部",
    arm: "手臂", groin: "鼠蹊", heart: "心臟", lung: "肺葉",
    kidney: "腎臟", balls: "要害", miss: "脫靶",
  };
  return names[partId] || partId;
}

function getAttackTargetPart(archetype) {
  if (archetype?.behavior?.attackType === "charge") return "chestplate";
  return "helmet";
}

function getBlockRateForArmor(armorId) {
  const match = armorId?.match(/t(\d)$/);
  if (!match) return 0;
  const tier = parseInt(match[1], 10);
  const rates = { 1: 0.40, 2: 0.55, 3: 0.70, 4: 0.82, 5: 0.92 };
  return rates[tier] || 0;
}
