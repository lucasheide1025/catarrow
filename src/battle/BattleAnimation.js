// src/battle/BattleAnimation.js
// 戰鬥動畫派遣器 — 將 EventType 事件轉換為動畫/音效/視覺效果
// 使用方式：
//   1. const dispatch = createDispatch(animSetters, sfx, vis, log);
//   2. 在事件迴圈中：await playArrowHit(dispatch, payload);
//
// 設計原則：
//   - 每個 playXxx 函數只處理**展示層**（動畫、音效、log）
//   - 狀態更新（setTotalDmgDealt 等）留在元件的事件迴圈中
//   - 有內部 await delay 的函數會自行處理計時

import { EventType } from './BattleEvents';

// ── Dispatch 工廠 ──────────────────────────────────────────

/**
 * 建立動畫派遣物件
 * @param {object} anim  — animation setter functions
 * @param {function} sfx — 音效函數（直接傳入 sfxModule）
 * @param {object} vis   — 視覺效果函數
 * @param {function} log — addLog({ type, text })
 * @param {function} delay — delay(ms) promise
 * @returns {object} dispatch
 */
export function createDispatch(anim, sfx, vis, log, delay) {
  return { anim, sfx, vis, log, delay };
}

// ── 事件動畫函數 ───────────────────────────────────────────
// 每個函數接受 (dispatch, payload, context?)
// context = { monster, catName, bSt, catCtx } 等元件端資料

/** ▸ 普通命中箭 */
export async function playArrowHit(d, p) {
  d.anim.shoot();
  d.sfx.arrowHit();
  d.vis.floatDmg(p.dmg, false, false);
  d.log('hit', `${p.arrowIndex+1}箭 ${p.label}分　${p.part.icon} ${p.hitText}　傷害 ${p.dmg}`);
  d.anim.hit();
}

/** ▸ 爆擊箭 */
export async function playArrowCrit(d, p) {
  d.anim.shoot();
  d.sfx.critBoom();
  d.vis.floatDmg(p.dmg, true, false);
  d.log('hit_crit', `${p.arrowIndex+1}箭 ${p.label}分　${p.part.icon} ${p.hitText}　傷害 ${p.dmg}💥`);
  d.anim.hit(true);
  d.anim.crit();
}

/** ▸ 器官命中箭 */
export async function playArrowOrganHit(d, p) {
  d.anim.shoot();
  d.sfx.organHit();
  d.vis.floatDmg(p.dmg, true, true);
  d.log('hit_organ', `${p.arrowIndex+1}箭 ${p.label}分　${p.part.icon} ${p.hitText}　傷害 ${p.dmg}！`);
  d.anim.hit(true);
  d.anim.crit();
}

/** ▸ 脫靶 */
export async function playArrowMiss(d, p) {
  d.anim.shoot();
  d.sfx.softFail();
  d.vis.floatDmg(0, false, false);
  d.log('miss', `${p.arrowIndex+1}箭　${p.hitText}　(${p.label})`);
  d.anim.miss();
  d.vis.archerEffect('MISS', '#94a3b8');
}

/** ▸ 投擲道具 (副作用：monAtkPct/monDefPct 由元件處理) */
export async function playThrowPotion(d, p) {
  d.anim.shoot();
  d.anim.hit();
  d.vis.floatDmg(p.dmg, false, false);
  d.log('hit', `${p.arrowIndex+1}箭 🎯 ${p.potion.icon} ${p.potion.name}：${p.effectText}`);
}

/** ▸ 反擊 — 爆擊 */
export async function playCounterCrit(d, p, ctx) {
  d.anim.monsterAttack(true);
  d.sfx.counterCrit();
  d.vis.vibrate([0, 60, 80, 60]);
  d.anim.counterCrit();
  await d.delay(480);
  d.anim.archerHit();
  d.vis.archerEffect(`💥 -${p.dmg}`, '#f43f5e');
  d.log('counter', `${ctx.monster.icon} 爆擊！${ctx.monster.name} 猛烈反擊！受到 ${p.dmg} 傷害`);
  await d.delay(500);
  d.anim.monsterAttackReset();
}

/** ▸ 反擊 — 打暈 */
export async function playCounterHeadStunned(d, p, ctx) {
  d.anim.monsterAttack();
  d.sfx.counter();
  d.vis.vibrate([0, 30, 50]);
  await d.delay(480);
  d.anim.archerHit();
  d.vis.archerEffect(`-${p.dmg}`, '#fca5a5');
  d.log('counter', `${ctx.monster.icon} 被打暈，反擊減半，受到 ${p.dmg} 傷害`);
  await d.delay(500);
  d.anim.monsterAttackReset();
}

/** ▸ 反擊 — 一般 */
export async function playCounter(d, p, ctx) {
  d.anim.monsterAttack();
  d.sfx.counter();
  d.vis.vibrate([0, 30, 50]);
  await d.delay(480);
  d.anim.archerHit();
  d.vis.archerEffect(`-${p.dmg}`, '#fca5a5');
  d.log('counter', `${ctx.monster.icon} ${ctx.monster.name} 反擊！受到 ${p.dmg} 傷害`);
  await d.delay(500);
  d.anim.monsterAttackReset();
}

/** ▸ 反擊 — 被格擋 */
export async function playCounterBlocked(d, p, ctx) {
  d.log('event_good', `🐱 ${ctx.catName} 飛撲而上，完全擋下了反擊！✨`);
}

/** ▸ 反擊 — 被減傷 */
export async function playCounterReduced(d, p, ctx) {
  d.anim.monsterAttack();
  d.sfx.counter();
  d.vis.vibrate([0, 30, 50]);
  await d.delay(350);
  d.log('event_good', `🐱 ${ctx.catName} 護住了你！減傷 ${Math.round(p.reducedBy*100)}%`);
  d.anim.archerHit();
  d.vis.archerEffect(`-${p.dmg}`, '#fca5a5');
  await d.delay(500);
  d.anim.monsterAttackReset();
}

/** ▸ 反擊 — 被跳過 */
export async function playCounterSkipped(d, p) {
  const txt = p.reason === '麻痺毒素'
    ? '🕸️ 麻痺毒素！怪物本回合完全無法反擊！'
    : '🛡️ 怪物反擊被阻止！';
  d.log('system', txt);
}

/** ▸ 隨機事件 */
export async function playRandomEvent(d, p) {
  d.log(p.event.type === 'buff' ? 'event_good' : 'event_bad', `✨【${p.event.title}】${p.event.desc}`);
  if (p.event.type === 'buff') d.sfx.buff();
  else if (p.event.type === 'debuff') d.sfx.debuff();
  else d.sfx.cast();
  await d.delay(2600);
}

/** ▸ 復活 */
export async function playRevive(d, p) {
  const msg = p.reviveMode === 'infinite'
    ? '💚 新手守護！完全恢復！教練說：「繼續加油！」'
    : `💖 教練施展【完全治癒術】！恢復 ${Math.round((p.revivedHP))} HP，最後一條命！`;
  d.log('revive', msg);
  d.sfx.revive();
  await d.delay(1500);
}

/** ▸ 距離變更 */
export async function playDistanceChange(d, p) {
  d.log('event_bad', `📍 怪物逼近！距離縮短 ${Math.abs(p.step)}米 → 現在距離 ${p.newDist}米`);
  await d.delay(600);
}

/** ▸ 回合結算 */
export async function playRoundResult(d, p, ctx) {
  const hpPct = Math.round(p.monsterHPAfter / ctx.monster.hp * 100);
  const hpTag = hpPct <= 10 ? '⚠️ 殘血！' : hpPct <= 30 ? '🩸 危險！' : '';
  d.sfx.roundEnd();
  d.log('total', `回合 ${p.round} 結算：${p.totalScore}分　${ctx.monster.icon} ${ctx.monster.name} 剩 HP：${p.monsterHPAfter} ${hpTag}`);
  await d.delay(900);
}

/** ▸ 貓貓攻擊 */
export async function playCatAttack(d, p, ctx) {
  d.log('hit_organ', `🐱 ${ctx.catName} 出擊！6箭齊射，合計傷害 ${p.dmg} 💥${p.skillNote}`);
  d.sfx.arrowHit();
  d.anim.hit();
  await d.delay(900);
}

/** ▸ 貓貓治療 */
export async function playCatHeal(d, p, ctx) {
  d.log('event_good', `🐱 ${ctx.catName} 舔了你的傷口！回復 ${p.healedHP} HP 💚`);
  await d.delay(600);
}

/** ▸ 貓貓防禦 */
export async function playCatDefend(d, p, ctx) {
  const desc = p.blockFull
    ? `🐱 ${ctx.catName} 擺好了防禦姿勢！下次反擊將被完全格擋 🛡️`
    : `🐱 ${ctx.catName} 豎起護毛！下次反擊減傷 ${Math.round(p.reduction * 100)}% 🛡️`;
  d.log('event_good', desc);
  await d.delay(600);
}

/** ▸ 貓貓受擊 */
export async function playCatHit(d, p, ctx) {
  d.log('counter', `🐱 ${ctx.catName} 也受到 ${p.dmg} 傷害${p.isDead ? '！已無法繼續戰鬥…' : ''}`);
}

/** ▸ 戰鬥勝利（擊殺動畫：怪物閃白 + 音效 + 2s 等待，讓玩家看到擊殺瞬間再跳結算） */
export async function playBattleWin(d, p) {
  d.anim.hit(true);           // 怪物閃白（crit 等級）
  d.sfx.critBoom();           // 爆擊音效
  d.log('win', `💥 擊倒！`);
  await d.delay(2000);        // 停 2 秒讓玩家看到死亡畫面
}

// ── 事件調度表 ─────────────────────────────────────────────

/**
 * 事件型別到 play 函數的映射
 * 元件端在 for 迴圈中直接呼叫：await EVENT_DISPATCH[evt.type](d, evt.payload, ctx);
 */
export const EVENT_DISPATCH = {
  [EventType.ARROW_HIT]:              playArrowHit,
  [EventType.ARROW_CRIT]:             playArrowCrit,
  [EventType.ARROW_ORGAN_HIT]:        playArrowOrganHit,
  [EventType.ARROW_MISS]:             playArrowMiss,
  [EventType.ARROW_THROW_POTION]:     playThrowPotion,
  [EventType.COUNTER]:                playCounter,
  [EventType.COUNTER_CRIT]:           playCounterCrit,
  [EventType.COUNTER_HEAD_STUNNED]:   playCounterHeadStunned,
  [EventType.COUNTER_BLOCKED]:        playCounterBlocked,
  [EventType.COUNTER_REDUCED]:        playCounterReduced,
  [EventType.COUNTER_SKIPPED]:        playCounterSkipped,
  [EventType.RANDOM_EVENT]:           playRandomEvent,
  [EventType.REVIVE]:                 playRevive,
  [EventType.DISTANCE_CHANGE]:        playDistanceChange,
  [EventType.ROUND_RESULT]:           playRoundResult,
  [EventType.CAT_ATTACK]:             playCatAttack,
  [EventType.CAT_HEAL]:               playCatHeal,
  [EventType.CAT_DEFEND]:             playCatDefend,
  [EventType.CAT_HIT]:                playCatHit,
  [EventType.BATTLE_WIN]:             playBattleWin,
};
