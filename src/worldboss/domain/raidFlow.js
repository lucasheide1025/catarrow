// src/worldboss/domain/raidFlow.js
// ─────────────────────────────────────────────────────────────
// 一場出擊的狀態機。**只算，不演。**
//
// ⚠️ 鐵律：domain 產生 log，UI 照 log 的**原順序**重播。
//    公會改版時最大的一個 bug 就是演出按事件類型分桶，導致「怪物全滅前系統已結算，
//    直接跳過戰鬥動畫」。這裡從第一天就用 log 順序，所有聲光效果掛在事件上，
//    不散在 setState 裡——想加特效就是加一種事件，畫面不會再跟結果對不上。
// ─────────────────────────────────────────────────────────────

import { calcWorldBossArrowDmg, calcWorldBossCounter } from "../../lib/damage";
import { advanceBreakGauge, applyUltGaugePenalty, burstMultiplier, emptyGaugeState } from "./breakGauge";
import { intentForRound, resolveIntent } from "./bossIntent";
import { currentPhase, phaseTransition } from "./raidPhases";
import { resolveWeakPointHit, rollWeakSpots } from "./weakPoints";
import { rangeMultiplier } from "./raidRange";
import { rookieMultiplier } from "./raidRookie";
import { faceCountOf, maxArrowsPerFace } from "./raidFaces";
import { teamGaugeMax, teamInterruptRequired, teamSizeOf, teamStatBonus } from "./raidTeam";
import { hasWorldBossCard, worldBossCardCount } from "./raidCards";
import { detectKillStyle } from "./raidKill";
import { supportLabel, teamSupport } from "./raidSupport";

export const RAID_TOTAL_ROUNDS = 5;

// 世界王的「一般傷害」（ATK 公式）佔一半，另一半來自弱點固定傷害。
// 這個配重決定了「射得準」與「練得久」各佔多少——世界王要的是前者多一點。
export const RAID_NORMAL_DAMAGE_SCALE = 0.5;
export const RAID_ARROWS_PER_ROUND = 6;

// 打中弱點時，一般傷害用這個分數去算（＝滿分）
export const MAX_ARROW_SCORE = 10;

// 貓貓陪練：每回合出手一次，有機率發動特技
export const CAT_SKILL_CHANCE = 0.22;
export const CAT_SKILL_MULT = 1.6;

export function createRaidState({
  boss,                       // { key, name, hp, maxHp, atk, def, skillConfig }
  stats,                      // { atk, def, hp } ← 由 raidLoadout 從既有存檔轉進來
  participantBonus = 1,
  dmgBonusPct = 0,
  dmgReducePct = 0,
  gauge = null,               // 進場快照（全場共享；戰鬥中只用本地樂觀值）
  distanceM = 10,             // 射程（5~18 米）
  targetFmt = "half_17",      // 決定靶紙倍率、張數、每張上限
  archerLevel = 1,            // 射手等級 → 新手扶助（50 級以下，見 raidRookie.js）
  cats = [],                  // 貓貓陪練 [{ catId, name, atk, skillGroup }]
  // 組隊：2~4 人同一場。**單人就是一人的隊伍**——刻意只留一條程式路徑，
  // 兩套流程各長各的遲早會漂移（公會就吃過這個虧）。
  members = null,             // [{ memberId, name, stats, archerLevel, cats }]
  rand = Math.random,
} = {}) {
  const maxHp = Math.max(1, Number(boss?.maxHp || boss?.hp) || 1);

  const rawRoster = (Array.isArray(members) && members.length ? members : [{
    memberId: "me", name: "我", stats, archerLevel, cats,
  }]);
  // 組隊三維加成：人越多全隊越強（單人時倍率全是 1）
  const buff = teamStatBonus(rawRoster.length);

  const roster = rawRoster.map((m, i) => {
    const base = { atk: Number(m.stats?.atk) || 0, def: Number(m.stats?.def) || 0, hp: Number(m.stats?.hp) || 100 };
    const st = {
      atk: Math.round(base.atk * buff.atk),
      def: Math.round(base.def * buff.def),
      hp: Math.round(base.hp * buff.hp),
    };
    // ⚠️ 靶紙與射程是**每個人自己的**（作者 2026-07-31）：
    //    現場有人射 5 米有人射 18 米，靶紙也不一定一樣——
    //    綁成全隊統一，等於逼所有人配合最短的那個人。
    const myFmt = m.targetFmt || targetFmt;
    const myDist = Number(m.distanceM) || distanceM;
    return {
      memberId: m.memberId || `m${i}`,
      name: m.name || `隊員${i + 1}`,
      baseStats: base,
      stats: st,
      targetFmt: myFmt,
      distanceM: myDist,
      rangeMult: rangeMultiplier({ distanceM: myDist, targetFmt: myFmt }),
      faceCap: maxArrowsPerFace(myFmt),
      faceCount: faceCountOf(myFmt),
      archerLevel: Number(m.archerLevel) || 1,
      rookieMult: rookieMultiplier(Number(m.archerLevel) || 1),
      cats: (m.cats || []).filter(c => c && Number(c.atk) > 0),
      // 世界王卡：判定沿用既有的 source === "wb"，UI 據此畫金邊與皇冠
      wbCard: m.wbCard != null ? !!m.wbCard : hasWorldBossCard(m.equipped),
      wbCardCount: m.wbCardCount != null ? m.wbCardCount : worldBossCardCount(m.equipped),
      hp: st.hp,
      maxHp: st.hp,
      damage: 0,
      breakPoints: 0,
    };
  });

  // 隊上出現幾種「張數」的靶：單張靶（半靶/全靶/原野靶）與三連靶的圈不能共用
  const faceCounts = [...new Set(roster.map(m => m.faceCount))];
  const spotsByFace = Object.fromEntries(faceCounts.map(fc => [
    fc, rollWeakSpots({ rand, round: 1, phaseId: 1, faceCount: fc }),
  ]));

  return {
    boss: {
      key: boss?.key || "boss", name: boss?.name || "世界王",
      atk: Number(boss?.atk) || 100, def: Number(boss?.def) || 0,
      maxHp, skillConfig: boss?.skillConfig || null,
    },
    bossHp: Math.max(0, Math.min(maxHp, Number(boss?.hp ?? maxHp))),
    members: roster,
    teamBuff: buff,
    stats: roster[0].stats,
    participantBonus, dmgBonusPct, dmgReducePct,
    // 以下三個是「我」的鏡像——畫面畫的就是我自己那張靶
    distanceM: roster[0].distanceM,
    rangeMult: roster[0].rangeMult,
    archerLevel: roster[0].archerLevel,
    cats: roster[0].cats,
    // 補償在戰鬥模型「外面」：一個乘在最後的倍率，跟弱點數值完全分離
    rookieMult: roster[0].rookieMult,
    // playerHp / playerMaxHp 是「我」的鏡像，單人畫面直接用它
    playerHp: roster[0].hp,
    playerMaxHp: roster[0].maxHp,
    round: 1,
    gauge: { ...emptyGaugeState(), ...(gauge || {}) },
    staggered: false,          // 上回合打斷成功 → 這回合王硬直
    // ⚠️ 弱點圈必須在**射之前**就抽好並放進 state——UI 要先把圈畫在靶面上，
    //    玩家才知道要往哪射。射完才抽等於叫人閉著眼睛射。
    targetFmt: roster[0].targetFmt,
    spots: spotsByFace[roster[0].faceCount],
    // ⚠️ 弱點圈是**王身上的**，同一種靶紙就看到同一組圈。
    //    只有「隊上真的有人用不同張數的靶」（三連靶 vs 單張）時才需要分組，
    //    否則這個欄位是 null，state.spots 就是唯一的一組——
    //    這樣既有的測試與存檔都不用改。
    spotsByFace: faceCounts.length > 1 ? spotsByFace : null,
    weakenStacks: 0,
    totals: { damage: 0, breakPoints: 0, weakHits: 0, grazes: 0, bestCombo: 0, interrupts: 0, bullseyes: 0, catDamage: 0 },
    finished: false,
  };
}

export function raidHpRatio(state) {
  return Math.max(0, Math.min(1, state.bossHp / state.boss.maxHp));
}

/**
 * 結算一個回合。
 * arrows: [{ score, label, declaredId, nx, ny }]
 * 回傳 { state, log }——log 順序就是演出順序。
 */
export function resolveRaidRound({ state, arrows = [], rand = Math.random } = {}) {
  const s = {
    ...state,
    gauge: { ...state.gauge },
    totals: { ...state.totals },
  };
  const log = [];
  const round = s.round;
  const phase = currentPhase(raidHpRatio(s));
  const intent = intentForRound({ config: s.boss.skillConfig, round, phaseId: phase.id });
  // 組隊時打斷需求次線性放大——不然四個人每回合都能斷，等於免費
  if (intent.charging) intent.interruptRequired = teamInterruptRequired(phase.id, teamSizeOf(state));
  const staggered = !!s.staggered;

  const spots = state.spots || [];
  s.members = (state.members || []).map(m => ({ ...m }));
  const teamSize = teamSizeOf(s);
  const byId = Object.fromEntries(s.members.map(m => [m.memberId, m]));
  const shooterOf = arrow => byId[arrow?.memberId] || s.members[0];
  // ⚠️ 倒地的人轉後衛助戰（不是出局）：加攻擊力、每回合補血。
  //    先算好，這一回合的箭就吃得到加成。
  const support = teamSupport(s.members);

  log.push({ type: "roundStart", round, phase, staggered, spots });
  if (support.supporters.length) {
    log.push({ type: "support", round, support, text: supportLabel(support) });
  }
  log.push({ type: "intent", round, intent, staggered });

  let spotHits = 0;
  // 三連靶：每張靶最多吃 2 箭的傷害，六箭必須 2/2/2 分完。
  // ⚠️ 上限是**每個人自己那張靶**的——所以 key 要帶 memberId，
  //    不然四個人射同一個 faceIndex 會互相吃掉額度。
  const arrowsOnFace = {};
  let combo = 0;
  let roundDamage = 0;
  let roundBreak = 0;

  arrows.forEach((arrow, index) => {
    if (s.bossHp <= 0) return;
    // 倒地的人這回合是後衛，他的箭不算（正式版 UI 也不會讓他射）
    if ((byId[arrow?.memberId]?.hp ?? 1) <= 0) return;
    const ratioBefore = raidHpRatio(s);
    const hpBeforeArrow = s.bossHp;
    const phaseNow = currentPhase(ratioBefore);

    const shooterEarly = shooterOf(arrow);
    const hit = resolveWeakPointHit({
      spots: s.spotsByFace?.[shooterEarly.faceCount] || spots,
      bossMaxHp: s.boss.maxHp,
      charging: intent.charging,
      staggered,
      nx: arrow?.nx, ny: arrow?.ny, faceIndex: arrow?.faceIndex || 0,
    });

    // ⚠️ 打中弱點圈 → 一般傷害**一律以最高分計算**（作者 2026-07-31）。
    //    圈可能長在 6 環甚至更外圈的位置；如果還照落點的環數算，
    //    玩家就沒有動力去拚邊緣的圈了。打中就是打中，給滿。
    const effectiveScore = hit.hit
      ? MAX_ARROW_SCORE
      : (arrow?.label === "X" ? MAX_ARROW_SCORE : Number(arrow?.score) || 0);
    const shooter = shooterEarly;
    const normal = calcWorldBossArrowDmg(
      effectiveScore,
      Math.round(shooter.stats.atk * support.atkMult), s.boss.def, s.participantBonus, s.dmgBonusPct,
    ) * hit.normalMult * RAID_NORMAL_DAMAGE_SCALE;

    // 這張靶滿了嗎（只有三連靶會有上限）
    const faceIdx = arrow?.faceIndex || 0;
    const faceCap = shooter.faceCap !== undefined ? shooter.faceCap : maxArrowsPerFace(s.targetFmt);
    const faceKey = `${shooter.memberId}:${faceIdx}`;
    arrowsOnFace[faceKey] = (arrowsOnFace[faceKey] || 0) + 1;
    const overCap = faceCap != null && arrowsOnFace[faceKey] > faceCap;

    const flat = overCap ? 0 : hit.flatDamage;
    const breakGain = overCap ? 0 : hit.breakPoints;

    const burst = burstMultiplier(s.gauge, round);
    // 射程倍率乘在整箭上：距離是這一場的設定，對新手老手一視同仁，不影響貢獻比
    // 新手扶助是**射手自己的**——組隊時各算各的，不會因為隊友是老手就被拉低
    const damage = overCap ? 0 : Math.max(0, Math.round(
      (normal + flat) * burst * (shooter.rangeMult || s.rangeMult || 1) * (shooter.rookieMult || 1),
    ));

    s.bossHp = Math.max(0, s.bossHp - damage);
    roundDamage += damage;
    s.totals.damage += damage;
    shooter.damage += damage;

    if (hit.hit && !overCap) {
      combo += 1;
      s.totals.weakHits += 1;
      s.totals.bestCombo = Math.max(s.totals.bestCombo, combo);
      if (hit.bullseye) s.totals.bullseyes += 1;
      // 打斷不再綁在某個部位上：任何弱點命中都推進度，紅點推兩格
      spotHits += hit.spot?.id === "red" ? 2 : 1;
      if (hit.weakensUlt) s.weakenStacks += 1;
    } else {
      combo = 0;
      if (!hit.missed) s.totals.grazes += 1;   // 上靶但沒中圈
    }

    log.push({
      type: "arrow", round, index,
      label: arrow?.label ?? String(arrow?.score ?? ""),
      spot: hit.spot, hit: hit.hit && !overCap, missed: hit.missed, bullseye: hit.bullseye && !overCap,
      maxScored: hit.hit && !overCap, overCap, faceIndex: faceIdx,
      memberId: shooter.memberId, shooterName: shooter.name,
      grazed: !hit.hit && !hit.missed,
      nx: arrow?.nx, ny: arrow?.ny,
      bonuses: hit.bonuses, burst: burst > 1,
      damage, flatDamage: flat, combo,
      bossHp: s.bossHp, bossHpRatio: raidHpRatio(s),
    });

    if (breakGain > 0) {
      // 「破防更快」是靠門檻成長比人數慢做到的（見 raidTeam.TEAM_GAUGE_SCALE），
      // 不是靠加乘每次命中的點數——那樣會被取整吃掉。
      shooter.breakPoints += breakGain;
      const adv = advanceBreakGauge(s.gauge, breakGain, {
        phaseGaugeMult: phaseNow.gaugeMult, round, gaugeMax: teamGaugeMax(teamSize),
      });
      s.gauge = adv.state;
      roundBreak += adv.gained;
      s.totals.breakPoints += adv.gained;
      log.push({ type: "gauge", round, gained: adv.gained, gauge: { ...s.gauge } });
      if (adv.triggered) {
        log.push({ type: "breakthrough", round, gauge: { ...s.gauge }, untilRound: s.gauge.burstUntilRound });
      }
    }

    const shifted = phaseTransition(ratioBefore, raidHpRatio(s));
    if (shifted) log.push({ type: "phaseShift", round, phase: shifted });

    if (s.bossHp <= 0) {
      // ⚠️ bossDown 要帶**補刀當下的完整脈絡**，不然事後拼湊不出「怎麼打倒的」
      const style = detectKillStyle({
        bySpot: hit.spot?.id || null, bullseye: hit.bullseye,
        burst: burst > 1, staggered, byCat: false,
        combo, damage, hpBefore: hpBeforeArrow, teamSize,
      });
      log.push({
        type: "bossDown", round, index,
        killerId: shooter.memberId, killerName: shooter.name,
        byCat: false, style,
        finishingArrow: { label: arrow?.label ?? null, spot: hit.spot?.id || null, bullseye: hit.bullseye },
      });
    }
  });

  // ── 貓貓陪練：每回合幫忙咬一口（在王行動之前，牠們比較急）──
  if (s.bossHp > 0) {
    for (const member of s.members) {
    for (const cat of member.cats) {
      if (s.bossHp <= 0) break;
      // 貓不吃射程/靶紙/新手扶助那些「射手環境」倍率——牠又沒有在射箭
      const base = calcWorldBossArrowDmg(8, cat.atk, s.boss.def, s.participantBonus, s.dmgBonusPct);
      const crit = Math.random() < CAT_SKILL_CHANCE;
      const dealt = Math.max(1, Math.round(base * (crit ? CAT_SKILL_MULT : 1)));
      s.bossHp = Math.max(0, s.bossHp - dealt);
      roundDamage += dealt;
      s.totals.damage += dealt;
      s.totals.catDamage += dealt;
      member.damage += dealt;
      log.push({
        type: "catAssist", round, cat, damage: dealt, skill: crit,
        memberId: member.memberId, shooterName: member.name,
        bossHp: s.bossHp, bossHpRatio: raidHpRatio(s),
      });
      if (s.bossHp <= 0) {
        log.push({
          type: "bossDown", round,
          killerId: member.memberId, killerName: member.name,
          byCat: true, catName: cat.name,
          style: detectKillStyle({ byCat: true, teamSize, damage: dealt, hpBefore: dealt }),
        });
      }
    }
    }
  }

  // ── 回合結束：分歧 ──
  let nextStagger = false;
  if (s.bossHp > 0) {
    const outcome = resolveIntent({ intent, legHits: spotHits, weakenStacks: s.weakenStacks });
    if (intent.charging && outcome.interrupted) {
      nextStagger = true;
      s.totals.interrupts += 1;
      log.push({ type: "interrupt", round, intent, legHits: spotHits });
    } else if (outcome.fired) {
      const base = calcWorldBossCounter(s.boss.atk, s.stats.def, s.dmgReducePct);
      const mult = (intent.skill?.baseMultiplier || 1) * outcome.ultMultiplier;
      const dealt = Math.max(1, Math.round(base * mult));
      // R2 保 1 血、R4 才可能打死（沿用既有 canKnockOut 設定）
      const floor = intent.skill?.canKnockOut ? 0 : 1;
      // ⚠️ skill.hits 是**純演出段數**（資料層註解寫得很清楚：合計傷害不變）。
      //    拆成一段一段打，玩家才看得出「三連射」跟「一記重擊」的差別。
      const hits = Math.max(1, Math.floor(Number(intent.skill?.hits) || 1));
      log.push({
        type: "ultCast", round, intent,
        hits, weakened: outcome.ultMultiplier < 1,
        pierce: intent.skill?.armorPiercePct || 0,
        shieldPierce: intent.skill?.shieldPiercePct || 0,
      });

      let left = dealt;
      for (let i = 0; i < hits; i += 1) {
        const portion = i === hits - 1 ? left : Math.max(1, Math.round(dealt / hits));
        left -= portion;
        // 王的大招打**全隊**——有人快死了，其他人就得決定要不要分箭去打斷
        for (const m of s.members) m.hp = Math.max(floor, m.hp - portion);
        s.playerHp = s.members[0].hp;
        log.push({
          type: "ultHit", round, intent, index: i, hits,
          damage: portion, playerHp: s.playerHp,
          members: s.members.map(m => ({ memberId: m.memberId, hp: m.hp })),
          knockedOut: s.members.every(m => m.hp <= 0) && intent.skill?.canKnockOut,
          last: i === hits - 1,
        });
        if (s.members.every(m => m.hp <= floor) && floor > 0) break;
      }

      if (intent.skill?.status) {
        log.push({ type: "statusApply", round, status: intent.skill.status, intent });
      }

      s.gauge = applyUltGaugePenalty(s.gauge);
      s.weakenStacks = 0;
      log.push({
        type: "ultEnd", round, intent, damage: dealt,
        weakened: outcome.ultMultiplier < 1, playerHp: s.playerHp,
        knockedOut: s.playerHp <= 0, gauge: { ...s.gauge },
      });
    } else {
      log.push({ type: "counterSwing", round });
      // 平砍也是打全隊，但每個人吃自己的防禦
      let shown = 0;
      for (const m of s.members) {
        const base = calcWorldBossCounter(s.boss.atk, m.stats.def, s.dmgReducePct);
        m.hp = Math.max(1, m.hp - base);
        if (m === s.members[0]) shown = base;
      }
      s.playerHp = s.members[0].hp;
      log.push({
        type: "counter", round, damage: shown, playerHp: s.playerHp,
        members: s.members.map(m => ({ memberId: m.memberId, hp: m.hp })),
      });
    }
  }

  // 後衛補血：回合結束時幫還站著的人回一點（依表現，最多 15% 最大生命）
  if (support.healPct > 0 && s.bossHp > 0) {
    const healed = [];
    for (const m of s.members) {
      if (m.hp <= 0 || m.hp >= m.maxHp) continue;
      const amount = Math.max(1, Math.round(m.maxHp * support.healPct));
      m.hp = Math.min(m.maxHp, m.hp + amount);
      healed.push({ memberId: m.memberId, name: m.name, amount, hp: m.hp });
    }
    if (healed.length) {
      s.playerHp = s.members[0].hp;
      log.push({ type: "supportHeal", round, healed, healPct: support.healPct });
    }
  }

  s.staggered = nextStagger;
  s.round = round + 1;
  // 下一回合的圈：位置每回合都變，玩家不能靠肌肉記憶一直射同一點
  const nextPhaseId = currentPhase(raidHpRatio(s)).id;
  const nextFaceCounts = [...new Set(s.members.map(m => m.faceCount || faceCountOf(s.targetFmt)))];
  const nextByFace = Object.fromEntries(nextFaceCounts.map(fc => [
    fc, rollWeakSpots({ rand, round: s.round, phaseId: nextPhaseId, faceCount: fc }),
  ]));
  s.spotsByFace = nextFaceCounts.length > 1 ? nextByFace : null;
  s.spots = nextByFace[s.members[0].faceCount || faceCountOf(s.targetFmt)];
  // 結束條件：王倒下／回合用完／**全員陣亡**。
  // ⚠️ 單人被打倒就是全員陣亡＝直接結束（沒有後衛可以撐）；
  //    組隊時還有人站著就繼續打，倒下的人轉後衛（見 raidSupport）。
  s.finished = s.bossHp <= 0 || s.round > RAID_TOTAL_ROUNDS || s.members.every(m => m.hp <= 0);

  log.push({
    type: "roundEnd", round,
    damage: roundDamage, breakPoints: roundBreak,
    bossHp: s.bossHp, bossHpRatio: raidHpRatio(s),
    finished: s.finished, staggerNext: nextStagger, nextSpots: s.spots,
  });

  return { state: s, log };
}
