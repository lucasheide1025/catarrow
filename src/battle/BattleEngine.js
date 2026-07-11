// src/battle/BattleEngine.js
// 戰鬥引擎：處理單回合流程，回傳事件陣列 + 最終狀態
// 為純函數設計 — 不涉及 React 狀態、不主動播放動畫
//
// 使用方式：
//   const { events, finalState } = processMonsterRound(config, context, arrows);
//   // 組件根據 events 播放動畫、最終套用 finalState

import { resolveHitPart } from '../lib/monsterData';
import { calcStandardArrowDmg, calcStandardCounter } from '../lib/damage';
import { labelToValue } from '../lib/score';
import { getPotion } from '../lib/itemData';
import { shouldTriggerEvent, drawRandomEvent } from '../lib/randomEvents';
import { ARROWS_PER_ROUND, DISTANCE_START, randomDistStep } from './BattleConfig';
import {
  createArrowEvent, createThrowPotionEvent, createCounterEvent,
  createRandomEvent, createReviveEvent, createDistanceChangeEvent,
  createRoundResultEvent, createCatAttackEvent, createCatHealEvent,
  createCatDefendEvent, createCatHitEvent, createBattleWinEvent,
  createBattleLoseEvent, EventType,
} from './BattleEvents';

// ── HIT_TEXT 池（部位命中台詞）────────────────────────────

const HIT_TEXTS = {
  head:   ['爆頭！腦殼震裂💥','正中眉心，眼冒金星💀','頭骨共鳴！整個人在轉😵‍💫','顱骨命中！擊昏！💥'],
  neck:   ['頸動脈命中！鮮血噴湧🩸','咽喉要害！⚡','頸部重擊，呼吸困難！🎯','致命頸擊！🗡️'],
  chest:  ['胸腔震盪！肋骨嘎嘎響💢','正中胸口，心跳亂跳！🫀','胸部命中，前後貫穿！❤️‍🔥','肋骨碎裂！'],
  belly:  ['腹部重擊！腸子在移位😱','肚子痛到無法動彈！🤢','腹腔命中，悶哼一聲…','內臟震動！'],
  arm:    ['手臂被射穿！武器脫手💨','側翼命中，影響平衡！','肩膀中箭，行動受阻！💪','手臂貫穿！'],
  groin:  ['正中要害！天下第一痛😭','下三路！整個人跪下了⚡','要命一擊！後代存亡危機💥','GG了！🦵'],
  heart:  ['心臟穿透！生命流逝中…❤️‍🔥','致命一擊！心跳停止！☠️','心室命中，鮮血瀑布！💔','心跳…停了…'],
  kidney: ['腎臟破碎！劇烈疼痛🫘','腰部命中，內臟劇痛！😭','腎臟穿透，昏倒邊緣！','致命內傷！生命流逝…'],
  lung:   ['肺葉穿透，血沫四濺！🫁','氣胸！空氣洩漏中…😤','呼吸困難，溺水一樣的感覺！🫧','雙肺血染！'],
  balls:  ['GG了！💥 後代斷絕！','天下第一痛——不可言說！😭','要害！對方蹲下來了…','某處…某個珍貴的地方…碎了。'],
  miss:   ['嗖～沒中！','靶紙在哪裡？😅','差一點點！','風的問題，不是我的問題'],
};

function getHitText(partId) {
  const pool = HIT_TEXTS[partId] || HIT_TEXTS.chest;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── 核心處理函數 ──────────────────────────────────────────

/**
 * @typedef {object} MonsterRoundConfig
 * @property {string}  mode          — 'novice'|'student'|'veteran'|'match'
 * @property {string}  battleMode    — 'score'|'zombie'
 * @property {string}  targetFmt     — 'standard'|'half'|'field_16'
 * @property {number}  selectedDistance — 玩家選定的距離（固定模式用）
 * @property {string}  [distanceMode]   — 'fixed'|'dynamic'|'random'
 *
 * @typedef {object} MonsterRoundContext
 * @property {object}  monster       — 怪物資料 { id, name, icon, atk, def, hp, tier, family }
 * @property {object}  archerStats   — 射手數值 { hp, atk, def }
 * @property {number}  monsterHP     — 當前怪物 HP
 * @property {number}  archerHP      — 當前射手 HP
 * @property {number}  distance      — 當前距離
 * @property {number}  round         — 當前回合數
 * @property {Set}     unlockedParts — 已解鎖部位
 * @property {boolean} skipCounter   — 是否跳過反擊
 * @property {boolean} skipBigRound  — 是否整回合跳過反擊
 * @property {number}  headHitCount  — 本回合頭部命中次數
 * @property {boolean} revived       — 本場是否已復活過
 * @property {number}  archerATKMod  — 弓箭手 ATK 修正值
 * @property {number}  totalDmgDealt — 本場累積輸出傷害
 * @property {number}  totalDmgRecvd — 本場累積承受傷害
 * @property {number}  critCount     — 本場爆擊次數
 *
 * @typedef {object} CatContext
 * @property {boolean} hasCat
 * @property {string}  catName
 * @property {number}  catCurrentHP
 * @property {number}  catMaxHP
 * @property {number}  catBaseDEF
 * @property {function} calcCatRoundDamage — (monster) => number
 * @property {function} triggerCatSkill    — () => { triggered, skillGroup, extraMult, healed, reduction, blockFull }
 */

/**
 * 處理 MonsterBattle 單回合流程
 * @param {MonsterRoundConfig} config
 * @param {MonsterRoundContext} ctx
 * @param {string[]} arrows — 6 箭標籤陣列
 * @param {CatContext|null} catCtx
 * @returns {{ events: object[], finalState: MonsterRoundContext, processedArrowScores: number[] }}
 */
export function processMonsterRound(config, ctx, arrows, catCtx = null) {
  const events = [];
  const {
    mode = 'novice', battleMode = 'score', targetFmt = 'standard',
    selectedDistance = 15, distanceMode = 'fixed',
    arrowsPerRound: configArrows = ARROWS_PER_ROUND,
  } = config;

  // 當前狀態拷貝（mutable，不直接修改 input）
  let monsterHP     = ctx.monsterHP;
  let archerHP      = ctx.archerHP;
  let curUnlocked   = new Set(ctx.unlockedParts);
  let curDist       = ctx.distance;
  let headHitCount  = 0;
  let skipCtr       = ctx.skipCounter;
  let skipBigRound  = ctx.skipBigRound;
  let curATKMod     = ctx.archerATKMod;
  let potionShield  = ctx.potionShield || 0;
  let poisonEffect  = ctx.poisonEffect || null;
  let revived       = ctx.revived;
  let roundTotalDmg = 0;
  let roundDmgRecvd = 0; // 本回合承受的傷害累計
  const processedArrowScores = [];

  if (poisonEffect?.rounds > 0 && monsterHP > 0) {
    const poisonDmg = Math.round(((ctx.archerStats?.atk || 0) + curATKMod) * poisonEffect.atkPct / 100);
    monsterHP = Math.max(0, monsterHP - poisonDmg);
    roundTotalDmg += poisonDmg;
    poisonEffect = { ...poisonEffect, rounds:poisonEffect.rounds - 1 };
    events.push(createThrowPotionEvent(-1, getPotion("throw_poison"), poisonDmg, `毒液持續傷害 ${poisonDmg}`, {}));
  }

  const consumableBuffs = ctx.consumableBuffs || {};
  let effATK = Math.round(((ctx.archerStats.atk || 10) + curATKMod) * (consumableBuffs.atkMult || 1));
  const maxFmtScore = targetFmt === 'field_16' ? 6 : 10;
  const scorePlus  = ctx.archerStats.scorePlus || 0;

  // ── Phase 0：隨機事件（回合最先發生，ATK 加成才能影響當回合箭傷）──
  // 事件 popup 在動畫播放序列裡排第一個，玩家看到後才播箭矢動畫，
  // 符合「隨機事件先顯示 → 玩家回合 → 貓貓回合 → 怪物回合」的設計。
  if (shouldTriggerEvent()) {
    const ev = drawRandomEvent();
    events.push(createRandomEvent(ev));
    const ef = ev.effect || {};
    if (ef.healArcher)  archerHP = Math.min(ctx.archerStats.hp || 100, archerHP + ef.healArcher);
    if (ef.archerHP)    archerHP = Math.max(0, archerHP + ef.archerHP);
    if (ef.archerATK) {
      curATKMod += ef.archerATK;
      effATK = (ctx.archerStats.atk || 10) + curATKMod; // 立即更新，讓箭傷使用新 ATK
    }
    if (ef.extraDmg) {
      monsterHP = Math.max(0, monsterHP - ef.extraDmg);
      roundTotalDmg += ef.extraDmg;
    }
    if (ef.monsterHP)   monsterHP = Math.max(0, monsterHP + ef.monsterHP);
    if (ef.skipCounter) skipCtr = true;

    // 若隨機事件已讓怪物歸零 → 直接勝利（不需射箭）
    if (monsterHP <= 0) {
      events.push(createBattleWinEvent(`${ev.title} 使 ${ctx.monster.name} 直接陣亡！`));
      return {
        events,
        finalState: {
          ...ctx,
          monsterHP, archerHP, distance: curDist,
          unlockedParts: curUnlocked, skipCounter: skipCtr, skipBigRound,
          archerATKMod: curATKMod, revived, headHitCount: 0,
          totalDmgDealt: ctx.totalDmgDealt + roundTotalDmg,
          totalDmgRecvd: ctx.totalDmgRecvd + roundDmgRecvd,
        },
        processedArrowScores,
      };
    }
  }

  // ── Phase 1：玩家回合（全部箭數，不穿插反擊）──────────────
  for (let i = 0; i < configArrows; i++) {
    const rawLabel = arrows[i];

    // 🎯 投擲道具處理
    const throwPotion = rawLabel && getPotion(rawLabel);
    if (throwPotion && throwPotion.kind === 'throw') {
      const ef = throwPotion.effect;
      let throwDmg = 0;
      if (ef.atkDamagePct) throwDmg = Math.round(((ctx.archerStats?.atk || 0) + curATKMod) * ef.atkDamagePct / 100) + (ef.throwDmg || 0);
      else if (ef.dotAtkPct) {
        throwDmg = Math.round(((ctx.archerStats?.atk || 0) + curATKMod) * ef.dotAtkPct / 100);
        poisonEffect = { atkPct:ef.dotAtkPct, rounds:Math.max(0, (ef.dotRounds || 1) - 1) };
      }
      else if (ef.throwDmg) throwDmg = ef.throwDmg;
      else if (ef.throwPct) throwDmg = Math.ceil(monsterHP * ef.throwPct);
      else if (ef.throwDmgMin && ef.throwDmgMax) throwDmg = Math.floor(Math.random() * (ef.throwDmgMax - ef.throwDmgMin + 1)) + ef.throwDmgMin;

      const extraEffects = {};
      if (ef.monAtkPct) extraEffects.monAtkPct = ef.monAtkPct;
      if (ef.monDefPct) extraEffects.monDefPct = ef.monDefPct;
      if (ef.skipRound === 'big') {
        skipBigRound = true;
        extraEffects.skipBigRound = true;
      }
      if (ef.monAtkPct || ef.monDefPct) {
        const oldAtk = ctx.monster.atk;
        const oldDef = ctx.monster.def;
        if (ef.monAtkPct) extraEffects.oldAtk = oldAtk;
        if (ef.monDefPct) extraEffects.oldDef = oldDef;
      }

      monsterHP = Math.max(0, monsterHP - throwDmg);
      roundTotalDmg += throwDmg;
      events.push(createThrowPotionEvent(i, throwPotion, throwDmg, throwPotion.effectText, extraEffects));

      if (monsterHP <= 0) {
        processedArrowScores.push(0);
        break;
      }
      processedArrowScores.push(0);
      continue;
    }

    // 🎯 正常計分箭
    const isX = rawLabel === 'X';
    const rawScore = labelToValue(rawLabel);
    const sp = scorePlus;
    let boostedRaw = rawScore;
    let forceCrit = false;
    if (sp > 0 && rawScore > 0) {
      boostedRaw = Math.min(rawScore + sp, maxFmtScore);
      if (rawScore >= maxFmtScore) { boostedRaw = maxFmtScore; forceCrit = true; }
    }
    if (targetFmt === 'field_16' && boostedRaw === 6) forceCrit = true;

    const score = (targetFmt === 'field_16' && boostedRaw > 0)
      ? Math.min(boostedRaw + 5, 10)
      : boostedRaw;

    const baseCritMult = (isX || forceCrit) ? 2.0 : 1.0;
    const part = resolveHitPart(score, curUnlocked, isX);

    // 部位解鎖
    if (['chest', 'belly', 'groin'].includes(part.id)) {
      curUnlocked = new Set([...curUnlocked, part.id]);
    }

    const dmg = Math.round(calcStandardArrowDmg(score, effATK, ctx.monster.def, part.mult * baseCritMult) * (consumableBuffs.dmgMult || 1) * (1 + (ctx.monsterDmgTakenPct || 0) / 100));

    if (part.id === 'head') headHitCount++;

    const isOrganPart = ['heart', 'kidney', 'lung', 'balls'].includes(part.id);
    const isMiss = part.mult === 0;
    const isCrit = !isMiss && (isOrganPart || part.mult >= 1.8 || score >= 10);
    const hitText = getHitText(part.id);

    monsterHP = Math.max(0, monsterHP - dmg);
    roundTotalDmg += dmg;
    processedArrowScores.push(score);

    events.push(createArrowEvent({
      arrowIndex: i, label: rawLabel, score, dmg, rawScore,
      isCrit, isOrgan: isOrganPart, isMiss, part,
      hitText,
    }));

    if (monsterHP <= 0) break;
  }

  // ── 怪物死亡 → 直接勝利 ──────────────────────────────────
  if (monsterHP <= 0) {
    events.push(createBattleWinEvent(`擊倒 ${ctx.monster.name}`));
    return {
      events,
      finalState: {
        ...ctx,
        monsterHP, archerHP, distance: curDist,
        unlockedParts: curUnlocked, skipCounter: skipCtr, skipBigRound,
        archerATKMod: curATKMod, revived, headHitCount: 0,
        totalDmgDealt: ctx.totalDmgDealt + roundTotalDmg,
        totalDmgRecvd: ctx.totalDmgRecvd + roundDmgRecvd,
      },
      processedArrowScores,
    };
  }

  // ── Phase 2：貓貓回合（在怪物反擊之前）──────────────────
  if (catCtx && catCtx.hasCat && monsterHP > 0 && catCtx.catCurrentHP > 0) {
    let catDmg = catCtx.calcCatRoundDamage(ctx.monster);

    const catSkill = catCtx.triggerCatSkill();
    let skillNote = '';
    if (catSkill.triggered && catSkill.skillGroup === 'atk') {
      const bonus = Math.round(catDmg * catSkill.extraMult);
      catDmg += bonus;
      skillNote = ` ✨特技爆發！傷害 ×${(1 + catSkill.extraMult).toFixed(1)}`;
    }

    monsterHP = Math.max(0, monsterHP - catDmg);
    events.push(createCatAttackEvent(catDmg, skillNote));

    if (monsterHP <= 0) {
      events.push(createBattleWinEvent(`擊倒 ${ctx.monster.name}`));
      return {
        events,
        finalState: {
          ...ctx,
          monsterHP, archerHP, distance: curDist,
          unlockedParts: curUnlocked, skipCounter: skipCtr, skipBigRound,
          archerATKMod: curATKMod, revived, headHitCount: 0,
          totalDmgDealt: ctx.totalDmgDealt + roundTotalDmg,
          totalDmgRecvd: ctx.totalDmgRecvd + roundDmgRecvd,
        },
        processedArrowScores,
      };
    }

    // 貓貓治療技能
    if (catSkill.triggered && catSkill.skillGroup === 'heal') {
      const maxHP = ctx.archerStats.hp || 200;
      const heal = Math.min(catSkill.healed, maxHP - archerHP);
      if (heal > 0) {
        archerHP = Math.min(maxHP, archerHP + heal);
        events.push(createCatHealEvent(heal));
      }
    }

    // 貓貓防禦技能（設定下次反擊盾）
    if (catSkill.triggered && catSkill.skillGroup === 'def') {
      events.push(createCatDefendEvent(catSkill.reduction, catSkill.blockFull));
    }
  }

  // ── Phase 3：怪物回合（反擊一次，累計 headHitCount）──────
  if (skipBigRound) {
    events.push({ type: EventType.COUNTER_SKIPPED, payload: { reason: '麻痺毒素' } });
    skipBigRound = false;
  } else if (!skipCtr) {
    const critChance = mode === 'veteran'
      ? veteranCounterCritChance(curDist)
      : mode === 'student'
      ? studentCounterCritChance(curDist)
      : 0;
    const isCrit = Math.random() < critChance;
    const headStunned = headHitCount > 0 && battleMode === 'zombie';
    const effectiveDef = Math.round((ctx.archerStats.def || 0) * (consumableBuffs.defMult || 1));
    let cdmg = calcStandardCounter(ctx.monster.atk, effectiveDef, headStunned, isCrit);
    if (ctx.counterReducePct) cdmg = Math.round(cdmg * (1 - ctx.counterReducePct / 100));

    // 貓貓防禦盾
    let finalCdmg = cdmg;
    let counterBlocked = false;
    let counterReduced = 0;
    if (catCtx && catCtx.catDefShield) {
      const shield = catCtx.catDefShield;
      catCtx.catDefShield = null; // 消耗盾
      if (shield.blockFull) {
        finalCdmg = 0;
        counterBlocked = true;
      } else {
        finalCdmg = Math.round(cdmg * (1 - shield.reduction));
        counterReduced = shield.reduction;
      }
    }

    if (counterBlocked) {
      events.push(createCounterEvent(0, false, false, 0, true));
    } else if (counterReduced > 0) {
      events.push(createCounterEvent(finalCdmg, isCrit, headStunned, counterReduced));
    } else if (headStunned) {
      events.push(createCounterEvent(finalCdmg, isCrit, true));
    } else {
      events.push(createCounterEvent(finalCdmg, isCrit));
    }

    const shieldAbsorb = Math.min(potionShield, finalCdmg);
    potionShield -= shieldAbsorb;
    finalCdmg -= shieldAbsorb;
    archerHP = Math.max(0, archerHP - finalCdmg);
    roundDmgRecvd += finalCdmg;

    // 復活檢查
    if (archerHP <= 0) {
      if (mode === 'novice') {
        archerHP = ctx.archerStats.hp || 100;
        events.push(createReviveEvent(archerHP, 'infinite'));
      } else if (mode === 'student' && !revived) {
        archerHP = Math.ceil((ctx.archerStats.hp || 100) * 0.3);
        events.push(createReviveEvent(archerHP, 'once'));
        revived = true;
      } else {
        events.push(createBattleLoseEvent(`被 ${ctx.monster.name} 擊倒`));
        return {
          events,
          finalState: {
            ...ctx,
            monsterHP, archerHP, distance: curDist,
            unlockedParts: curUnlocked, skipCounter: false, skipBigRound,
            archerATKMod: curATKMod, revived, headHitCount: 0,
            totalDmgDealt: ctx.totalDmgDealt + roundTotalDmg,
            totalDmgRecvd: ctx.totalDmgRecvd + roundDmgRecvd,
          },
          processedArrowScores,
        };
      }
    }

    // 貓貓受擊
    if (catCtx && catCtx.hasCat && catCtx.catCurrentHP > 0) {
      const catDmg = calcStandardCounter(ctx.monster.atk, catCtx.catBaseDEF);
      const newCatHP = Math.max(0, catCtx.catCurrentHP - catDmg);
      events.push(createCatHitEvent(catDmg, newCatHP <= 0));
      catCtx.catCurrentHP = newCatHP;
    }
  } else {
    events.push({ type: EventType.COUNTER_SKIPPED, payload: { reason: '被阻止' } });
    skipCtr = false;
  }

  // ⚠️ 注意：不要在此處重置 headHitCount！Phase 5 的殭屍推回需要讀取

  // ── Phase 5：動態距離更新 ──────────────────────────────
  if (distanceMode === 'dynamic') {
    if (mode === 'veteran' || mode === 'student') {
      const step = randomDistStep();
      const newDist = Math.max(1, curDist - step);
      if (newDist !== curDist) {
        const oldDist = curDist;
        curDist = newDist;
        events.push(createDistanceChangeEvent(oldDist, curDist));
      }
    }
    // 殭屍模式：頭部命中推回距離（僅老手模式）
    if (battleMode === 'zombie' && mode === 'veteran' && headHitCount > 0) {
      const pushBack = Math.min(3, headHitCount);
      const newDist = Math.min(selectedDistance || DISTANCE_START, curDist + pushBack);
      if (newDist !== curDist) {
        const oldDist = curDist;
        curDist = newDist;
        events.push(createDistanceChangeEvent(oldDist, curDist, `頭部命中距離延長 ${pushBack}米`));
      }
    }
  }

  // ── Phase 6：回合結算 ──────────────────────────────────
  const totalScore = processedArrowScores.reduce((s, v) => s + v, 0);
  events.push(createRoundResultEvent(ctx.round, totalScore, roundTotalDmg, monsterHP));

  // 本回合所有 headHitCount 用途結束，正式重置
  headHitCount = 0;

  if (consumableBuffs.regenPct && archerHP > 0) {
    archerHP = Math.min(ctx.archerStats.hp || archerHP, archerHP + Math.round((ctx.archerStats.hp || 0) * consumableBuffs.regenPct / 100));
  }

  return {
    events,
    finalState: {
      ...ctx,
      monsterHP, archerHP, distance: curDist,
      unlockedParts: curUnlocked, skipCounter: false, archerATKMod: 0, potionShield, poisonEffect,
      headHitCount: 0,
      totalDmgDealt: ctx.totalDmgDealt + roundTotalDmg,
      totalDmgRecvd: ctx.totalDmgRecvd + roundDmgRecvd,
    },
    processedArrowScores,
  };
}

// ── 爆擊率 helper（避免 circular dep）───────────────────────

function studentCounterCritChance(dist) {
  return Math.max(0, (DISTANCE_START - dist) / DISTANCE_START * 0.3);
}

function veteranCounterCritChance(dist) {
  return Math.max(0, (DISTANCE_START - dist) / DISTANCE_START * 0.5);
}
