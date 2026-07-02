// src/battle/BattleEvents.js
// 標準化戰鬥事件型別 — 所有戰鬥模式共用相同的事件格式

export const EventType = {
  /** 一般命中箭 */
  ARROW_HIT: 'arrow_hit',
  /** 爆擊箭（score≥10 或 partMult≥1.8） */
  ARROW_CRIT: 'arrow_crit',
  /** 器官命中（heart/kidney/lung/balls） */
  ARROW_ORGAN_HIT: 'arrow_organ_hit',
  /** 脫靶（M 或 partMult=0） */
  ARROW_MISS: 'arrow_miss',
  /** 投擲道具 */
  ARROW_THROW_POTION: 'arrow_throw_potion',
  /** 分數藥水加成 */
  ARROW_SCORE_POTION: 'arrow_score_potion',

  /** 怪物反擊（一般） */
  COUNTER: 'counter',
  /** 怪物爆擊反擊 */
  COUNTER_CRIT: 'counter_crit',
  /** 反擊被完全格擋 */
  COUNTER_BLOCKED: 'counter_blocked',
  /** 反擊被減傷 */
  COUNTER_REDUCED: 'counter_reduced',
  /** 反擊被跳過（麻痺/事件） */
  COUNTER_SKIPPED: 'counter_skipped',
  /** 打暈反擊減半 */
  COUNTER_HEAD_STUNNED: 'counter_head_stunned',

  /** 隨機事件（buff/debuff） */
  RANDOM_EVENT: 'random_event',

  /** 死亡復活 */
  REVIVE: 'revive',

  /** 動態距離變更 */
  DISTANCE_CHANGE: 'distance_change',

  /** 回合結算摘要 */
  ROUND_RESULT: 'round_result',

  /** 貓貓攻擊 */
  CAT_ATTACK: 'cat_attack',
  /** 貓貓治療 */
  CAT_HEAL: 'cat_heal',
  /** 貓貓防禦 */
  CAT_DEFEND: 'cat_defend',
  /** 貓貓受擊 */
  CAT_HIT: 'cat_hit',

  /** 戰鬥勝利 */
  BATTLE_WIN: 'battle_win',
  /** 戰鬥敗北 */
  BATTLE_LOSE: 'battle_lose',
};

// ── Event builders ──────────────────────────────────────────

/**
 * 建立箭矢事件
 * @param {object} opts
 * @param {number} opts.arrowIndex - 第幾箭 (0-based)
 * @param {string} opts.label - 原始標籤 (X/10/9/.../M)
 * @param {number} opts.score - 轉換後分數
 * @param {number} opts.dmg - 造成的傷害
 * @param {number} opts.rawScore - 藥水加成前的原始分數
 * @param {boolean} opts.isCrit - 是否爆擊
 * @param {boolean} opts.isOrgan - 是否器官命中
 * @param {boolean} opts.isMiss - 是否脫靶
 * @param {object} opts.part - 命中部位 { id, name, icon, mult }
 * @param {string} opts.hitText - 部位命中台詞
 */
export function createArrowEvent(opts) {
  const {
    arrowIndex, label, score, dmg, rawScore = score,
    isCrit = false, isOrgan = false, isMiss = false,
    part = null, hitText = '',
  } = opts;
  return {
    type: isOrgan  ? EventType.ARROW_ORGAN_HIT
        : isMiss   ? EventType.ARROW_MISS
        : isCrit   ? EventType.ARROW_CRIT
                   : EventType.ARROW_HIT,
    payload: { arrowIndex, label, score, dmg, rawScore, isCrit, isOrgan, isMiss, part, hitText },
  };
}

/**
 * 建立投擲道具事件
 */
export function createThrowPotionEvent(arrowIndex, potion, dmg, effectText, extraEffects = {}) {
  return {
    type: EventType.ARROW_THROW_POTION,
    payload: { arrowIndex, potion, dmg, effectText, extraEffects },
  };
}

/**
 * 建立怪物反擊事件
 */
export function createCounterEvent(dmg, isCrit = false, headStunned = false, reducedBy = 0, blocked = false) {
  let type = EventType.COUNTER;
  if (blocked)          type = EventType.COUNTER_BLOCKED;
  else if (reducedBy > 0) type = EventType.COUNTER_REDUCED;
  else if (headStunned) type = EventType.COUNTER_HEAD_STUNNED;
  else if (isCrit)      type = EventType.COUNTER_CRIT;
  return { type, payload: { dmg, isCrit, headStunned, reducedBy, blocked } };
}

/**
 * 建立隨機事件
 */
export function createRandomEvent(ev) {
  return { type: EventType.RANDOM_EVENT, payload: { event: ev } };
}

/**
 * 建立復活事件
 */
export function createReviveEvent(revivedHP, reviveMode) {
  return { type: EventType.REVIVE, payload: { revivedHP, reviveMode } };
}

/**
 * 建立距離變更事件
 */
export function createDistanceChangeEvent(oldDist, newDist) {
  return { type: EventType.DISTANCE_CHANGE, payload: { oldDist, newDist, step: oldDist - newDist } };
}

/**
 * 建立回合結算事件
 */
export function createRoundResultEvent(round, totalScore, totalDmg, monsterHPAfter) {
  return { type: EventType.ROUND_RESULT, payload: { round, totalScore, totalDmg, monsterHPAfter } };
}

/**
 * 建立貓貓攻擊事件
 */
export function createCatAttackEvent(dmg, skillNote = '') {
  return { type: EventType.CAT_ATTACK, payload: { dmg, skillNote } };
}

/**
 * 建立貓貓治療事件
 */
export function createCatHealEvent(healedHP) {
  return { type: EventType.CAT_HEAL, payload: { healedHP } };
}

/**
 * 建立貓貓防禦事件
 */
export function createCatDefendEvent(reduction, blockFull) {
  return { type: EventType.CAT_DEFEND, payload: { reduction, blockFull } };
}

/**
 * 建立貓貓受擊事件
 */
export function createCatHitEvent(dmg, isDead) {
  return { type: EventType.CAT_HIT, payload: { dmg, isDead } };
}

/**
 * 建立戰鬥勝利事件
 */
export function createBattleWinEvent(reason = '') {
  return { type: EventType.BATTLE_WIN, payload: { reason } };
}

/**
 * 建立戰鬥敗北事件
 */
export function createBattleLoseEvent(reason = '') {
  return { type: EventType.BATTLE_LOSE, payload: { reason } };
}
