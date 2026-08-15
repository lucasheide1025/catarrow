// src/lib/duelCombat.js — 決鬥 2.0 純邏輯（可單元測試）
// 卡片天賦＋裝備專精接進 PvP：統一透過 combatModifiers 管線計算傷害，
// 異常狀態（中毒/灼燒/流血/破防/虛弱/冰凍/麻痺）跨回合運作。
// ⚠️ 本檔不 import 任何 Firestore——所有亂數與事件都可注入，方便測試。
//
// 狀態生命週期：
//   round N 施加 → 存進 pending → round N+1 啟動為 status 並開始作用
//   → round 結束時扣 1 回合，扣完移除。
//   這樣 duration 1 的冰凍/麻痺剛好封鎖 N+1 一整回合。

import {
  buildCombatModifiers, effectiveDefense, applyOutgoing, applyIncoming,
  applyStatusResist, applyRoundEnd, reflectDamage, applyCompanion,
} from "./combatModifiers";
import { resolveHitPart, BODY_PARTS } from "./monsterData";
import { shouldTriggerEvent, drawRandomEvent } from "./randomEvents";

const ALL_PARTS = new Set(BODY_PARTS.map(p => p.id));

// ── 異常狀態在 PvP 的效果規則 ──────────────────────────────
// dot: 每回合開始扣血（calc(strength, member)）
// stat: 期間內降低 atk / def
// stun: 機率跳過本回合攻擊
export const PVP_STATUS_RULES = Object.freeze({
  poison:   { kind: "dot",  icon: "☠️", name: "中毒",
    dot: (s, m) => Math.max(1, Math.round((m.maxHP || 1) * s.strength / 100)), nonLethal: true },
  burn:     { kind: "dot",  icon: "🔥", name: "灼燒",
    dot: (s, m) => Math.max(1, Math.round((m.atk || 1) * s.strength / 100)), nonLethal: false },
  bleed:    { kind: "dot",  icon: "🩸", name: "流血",
    dot: (s, m) => Math.max(1, Math.round((m.atk || 1) * s.strength / 100)), nonLethal: false },
  defBreak: { kind: "stat", icon: "🔨", name: "破防", stat: "def" },
  weaken:   { kind: "stat", icon: "😱", name: "虛弱", stat: "atk" },
  freeze:   { kind: "stun", icon: "❄️", name: "冰凍", chance: 1 },
  paralyze: { kind: "stun", icon: "⚡", name: "麻痺", chance: 0.5 },
});

const STUN_ICON = { freeze: "❄️", paralyze: "⚡" };

/** 預設空 mods（機器人 / 訪客 / 舊資料沒有 mods 欄位時） */
export function defaultDuelMods() {
  return buildCombatModifiers();
}

/** 把成員正規化成決鬥運算要的形狀（mods/shield/status/pending 缺值補上） */
export function ensureDuelMember(m) {
  if (!m) return null;
  return {
    ...m,
    mods: m.mods && typeof m.mods === "object" ? m.mods : buildCombatModifiers(),
    shield: Number(m.shield) || 0,
    status: m.status || {},
    pending: m.pending || {},
  };
}

/** 單箭基礎傷害（沿用決鬥公式，可注入亂數） */
function arrowBase(label, score, atk, def, rand) {
  const part = resolveHitPart(score, ALL_PARTS, label === "X");
  const pMult = part?.mult ?? 1;
  if (!score || pMult === 0) return 0;
  const base = 2 + (atk || 20) * 0.5 + score * 0.4 - (def || 10) * 0.3;
  const mult = 0.85 + rand() * 0.3;
  return Math.max(1, Math.round(base * pMult * mult));
}

function pickTarget(pool, preferredId, rand) {
  if (!pool.length) return null;
  if (preferredId && pool.includes(preferredId) && rand() < 0.5) return preferredId;
  return pool[Math.floor(rand() * pool.length)];
}

/**
 * 單箭傷害管線（A1/B1 有來有回共用）。
 * 傳回 { label, dmg, isCrit, highQuality, shieldTake, reflect, statusHit }；
 * 副作用只動 target.shield（逐箭消耗），hp 扣減由呼叫端處理並判定死亡。
 */
function fireArrow({ attacker, target, arrow, round, rand }) {
  const label = arrow.label ?? (arrow.score === 0 ? "M" : String(arrow.score));
  const score = arrow.score ?? (label === "X" ? 10 : 0);
  const out = { label: "M", dmg: 0, isCrit: false, highQuality: false, shieldTake: 0, reflect: 0, statusHit: null };
  if (!score || score <= 0) return out;

  // 破防(目標 DEF↓) × 穿甲/破甲(無視防禦) —— 相乘
  const targetStatus = target.status || {};
  const statDefMult = targetStatus.defBreak
    ? Math.max(0, 1 - targetStatus.defBreak.strength / 100) : 1;
  const effTargetDef = effectiveDefense((target.def || 0) * statDefMult, attacker.mods);

  // 虛弱(自身 ATK↓)
  const active = attacker.status || {};
  const statAtkMult = active.weaken ? Math.max(0, 1 - active.weaken.strength / 100) : 1;
  const effAtk = Math.max(1, Math.round((attacker.atk || 20) * statAtkMult));

  const base = arrowBase(label, score, effAtk, effTargetDef, rand);
  if (base <= 0) return { ...out, label };
  const og = applyOutgoing({
    baseDamage: base, score, mods: attacker.mods, rand,
    round, monsterHpRatio: (target.hp || 0) / (target.maxHP || 1),
  });
  const inc = applyIncoming({ damage: og.damage, currentHp: target.hp, maxHp: target.maxHP, mods: target.mods });
  const shieldTake = Math.min(target.shield || 0, inc.damage);
  if (shieldTake > 0) target.shield -= shieldTake; // 護盾逐箭消耗
  const actual = inc.damage - shieldTake;
  out.label = arrow.lucky ? `✨${score}` : label;
  out.dmg = actual;
  out.isCrit = !!og.crit;
  out.highQuality = !!og.highQuality;
  out.shieldTake = shieldTake;
  // 荊棘/堅盾反彈（依對方 mods.reflectPct）——逐箭反彈（中途擊殺也會彈）
  if (inc.damage > 0 && target.mods?.reflectPct) {
    out.reflect = reflectDamage(inc.damage, target.mods);
  }
  // 異常施加：高品質命中（≥8 環）擲 inflict（卡片天賦帶的異常）
  if (og.highQuality && attacker.mods?.inflict) {
    for (const [sid, cfg] of Object.entries(attacker.mods.inflict)) {
      if (rand() < (cfg.chancePct || 0) / 100) {
        out.statusHit = applyStatusResist(
          { id: sid, strength: cfg.strength, duration: cfg.duration },
          target.mods,
        );
        break;
      }
    }
  }
  return out;
}

/** 把單箭結果包成 arrowBreakdown 一項 */
function arrowBreakdownOf(arrow, res) {
  return {
    label: res.label,
    partIcon: res.dmg > 0 ? "🎯" : "💨",
    partName: res.highQuality ? "高品質" : (res.dmg > 0 ? "命中" : "脫靶"),
    partMult: 1, dmg: res.dmg, isCrit: res.isCrit, highQuality: res.highQuality,
    shieldTake: res.shieldTake, lucky: !!arrow.lucky,
    ...(Number.isFinite(arrow.nx) && Number.isFinite(arrow.ny) ? { nx: arrow.nx, ny: arrow.ny } : {}),
  };
}

/**
 * 弓箭手一回合攻擊一位目標（整包 6 箭；保留給測試與相容）。
 * 不吃任何全域狀態——所有副作用（護盾/反彈/異常）由呼叫端套用。
 */
export function attackDuelArcher({ attacker, target, round, rand = Math.random }) {
  const out = {
    attackerId: attacker.id, attackerTeam: attacker.team,
    targetId: target.id, dmg: 0, crits: 0, shieldDmg: 0, reflect: 0,
    arrowBreakdown: [], luckyEvent: null, statusHit: null, stunned: null,
  };

  // 冰凍/麻痺：跳過本回合攻擊
  const active = attacker.status || {};
  if (active.freeze) out.stunned = "freeze";
  else if (active.paralyze && rand() < PVP_STATUS_RULES.paralyze.chance) out.stunned = "paralyze";
  if (out.stunned) return out;

  // 脫靶補救（3 支以上脫靶有機會救回 2 支）
  const arrows = attacker.arrows || [];
  const missCount = arrows.filter(a => !(a.score > 0)).length;
  let processed = arrows;
  if (missCount >= 3 && rand() < 0.40) {
    let saved = 0;
    processed = arrows.map(a => {
      if (!(a.score > 0) && saved < 2 && rand() < 0.60) {
        saved++;
        const s = 5 + Math.floor(rand() * 3);
        return { ...a, score: s, label: `✨${s}`, lucky: true };
      }
      return a;
    });
    if (saved > 0) {
      out.luckyEvent = { icon: "✨", title: "天外飛箭", desc: `${saved} 支脫靶的箭竟然擦中了目標！` };
    }
  }

  let inflicted = false;
  for (const arrow of processed) {
    const res = fireArrow({ attacker, target, arrow, round, rand });
    out.dmg += res.dmg;
    out.crits += res.isCrit ? 1 : 0;
    out.shieldDmg += res.shieldTake;
    out.reflect += res.reflect;
    if (res.statusHit && !inflicted) {
      inflicted = true;
      out.statusHit = res.statusHit;
    }
    out.arrowBreakdown.push(arrowBreakdownOf(arrow, res));
  }
  return out;
}
/**
 * 主回合計算（純函式）。
 * @returns {{
 *   eventData, attacks, hpDelta, statusEvents, members, result, logEntry
 * }}
 * members: { "A:<id>": memberObj, "B:<id>": memberObj } —— 整份取代，含 hp/shield/status/pending
 */
export function computeDuelRound({
  teamA = {}, teamB = {},
  round = 1,
  type = "",
  rand = Math.random,
  shouldTrigger = shouldTriggerEvent,
  drawEvent = () => drawRandomEvent("duel"),
} = {}) {
  // 1. 正規化成員
  const tA = {}, tB = {};
  for (const [id, m] of Object.entries(teamA)) tA[id] = ensureDuelMember({ ...m, id, team: "A" });
  for (const [id, m] of Object.entries(teamB)) tB[id] = ensureDuelMember({ ...m, id, team: "B" });
  const aliveOf = map => Object.entries(map).filter(([, m]) => m.alive).map(([id]) => id);
  let aliveA = aliveOf(tA);
  let aliveB = aliveOf(tB);

  const startHp = {};
  for (const [id, m] of Object.entries({ ...tA, ...tB })) startHp[id] = m.hp || 0;

  // 開場護盾（第一回合，卡片護體/專精營養線）
  if (round === 1) {
    for (const m of [...Object.values(tA), ...Object.values(tB)]) {
      const pct = Number(m.mods.openingShieldPct) || 0;
      if (pct > 0) {
        m.shield = Math.max(0, Math.round((m.maxHP || 1) * pct / 100));
      }
    }
  }

  const statusEvents = [];

  // 2. 隨機事件（決鬥專屬；可注入測試）
  const eventRaw = shouldTrigger() ? drawEvent() : null;
  let eventData = eventRaw
    ? { id: eventRaw.id, icon: eventRaw.icon, title: eventRaw.title, desc: eventRaw.desc, type: eventRaw.type }
    : null;
  const eff = eventRaw?.effect || {};

  // 3. 叛變：換隊先行（只換存活成員）
  let effA = tA, effB = tB;
  if (eventData?.id === "betrayal" && type !== "1v1" && aliveA.length > 0 && aliveB.length > 0) {
    const swapAId = aliveA[Math.floor(rand() * aliveA.length)];
    const swapBId = aliveB[Math.floor(rand() * aliveB.length)];
    eventData = { ...eventData, swapAId, swapAName: tA[swapAId]?.name || "?", swapBId, swapBName: tB[swapBId]?.name || "?" };
    effA = { ...tA, [swapBId]: tB[swapBId] };
    effB = { ...tB, [swapAId]: tA[swapAId] };
    delete effA[swapAId];
    delete effB[swapBId];
    aliveA = aliveA.filter(id => id !== swapAId).concat([swapBId]);
    aliveB = aliveB.filter(id => id !== swapBId).concat([swapAId]);
  } else if (eventData?.id === "betrayal") {
    eventData = null; // 1v1 或無存活，不觸發叛變
  }

  // 4. 回合開始：pending 啟動、DoT 跳傷
  const tickRoundStart = members => {
    for (const [id, m] of Object.entries(members)) {
      for (const [sid, st] of Object.entries(m.pending || {})) {
        if (!m.status[sid]) m.status[sid] = st;
      }
      m.pending = {};
      for (const [sid, st] of Object.entries(m.status)) {
        const rule = PVP_STATUS_RULES[sid];
        if (!rule || rule.kind !== "dot") continue;
        const dmg = rule.dot(st, m);
        if (dmg <= 0) continue;
        if (rule.nonLethal) m.hp = Math.max(1, (m.hp || 0) - dmg);
        else m.hp = Math.max(0, (m.hp || 0) - dmg);
        if ((m.hp || 0) <= 0) m.alive = false; // 立即判定死亡
        statusEvents.push({ memberId: id, icon: rule.icon, text: `${m.name} 受到 ${dmg} 點${rule.name}傷害`, phase: "start", value: dmg, kind: "dot" });
      }
    }
  };
  tickRoundStart(effA);
  tickRoundStart(effB);

  // 5. 雙隊輪流攻擊：A1箭 B1箭 有來有回（決鬥 2.1）
  // 先手每回合隨機；任一方全滅立刻結束回合——被擊殺的人剩餘的箭不會再射出。
  // ⚠️ 死亡在血量歸零的當下立即標記 alive=false，回合末自動回血無法復活。
  const attacks = [];
  const firstTeam = rand() < 0.5 ? "A" : "B";
  const order = firstTeam === "A" ? ["A", "B"] : ["B", "A"];
  const teamSrc = { A: effA, B: effB };
  const otherTeam = t => (t === "A" ? "B" : "A");
  const aliveNow = map => Object.entries(map)
    .filter(([, m]) => m.alive && (m.hp || 0) > 0)
    .map(([id]) => id);
  const teamDead = t => aliveNow(teamSrc[t]).length === 0;

  // 每成員每回合一次的暫存（不寫進成員物件，避免汙染 Firestore）
  const processedCache = {};   // memberId -> 脫靶補救後的箭陣列
  const inflictedSet = new Set(); // memberId -> 已施加過異常（每回合最多一次）
  const stunnedSet = new Set();   // memberId -> 本回合被凍結/麻痺

  const fireOneArrow = (team, memberId, arrowIdx) => {
    const src = teamSrc[team];
    const tgt = teamSrc[otherTeam(team)];
    const m = src[memberId];
    if (!m || !m.alive || (m.hp || 0) <= 0 || stunnedSet.has(memberId)) return;
    const tgtAlive = aliveNow(tgt);
    if (!tgtAlive.length) return;
    const targetId = pickTarget(tgtAlive, m.preferredTargetId, rand);
    if (!targetId) return;
    const target = tgt[targetId];

    const atk = {
      attackerId: memberId, attackerTeam: team, targetId,
      dmg: 0, crits: 0, shieldDmg: 0, reflect: 0,
      arrowBreakdown: [], luckyEvent: null, statusHit: null, stunned: null,
      arrowIndex: arrowIdx,
    };

    // 冰凍/麻痺：第一箭檢查，中招整回合不再射
    if (arrowIdx === 0) {
      const active = m.status || {};
      if (active.freeze) atk.stunned = "freeze";
      else if (active.paralyze && rand() < PVP_STATUS_RULES.paralyze.chance) atk.stunned = "paralyze";
      if (atk.stunned) {
        stunnedSet.add(memberId);
        attacks.push(atk);
        statusEvents.push({
          memberId, icon: STUN_ICON[atk.stunned] || "❄️",
          text: `${m.name} 被${PVP_STATUS_RULES[atk.stunned]?.name || atk.stunned}無法行動`,
          phase: "start", kind: "stun",
        });
        return;
      }
    }

    // 脫靶補救（每成員每回合只算一次）
    if (!processedCache[memberId]) {
      const arrows = m.arrows || [];
      const missCount = arrows.filter(a => !(a.score > 0)).length;
      let processed = arrows;
      if (missCount >= 3 && rand() < 0.40) {
        let saved = 0;
        processed = arrows.map(a => {
          if (!(a.score > 0) && saved < 2 && rand() < 0.60) {
            saved++;
            const s = 5 + Math.floor(rand() * 3);
            return { ...a, score: s, label: `✨${s}`, lucky: true };
          }
          return a;
        });
        if (saved > 0) atk.luckyEvent = { icon: "✨", title: "天外飛箭", desc: `${saved} 支脫靶的箭竟然擦中了目標！` };
      }
      processedCache[memberId] = processed;
    }
    const arrow = processedCache[memberId][arrowIdx];
    if (!arrow) return;

    const res = fireArrow({ attacker: m, target, arrow, round, rand });
    atk.dmg = res.dmg;
    atk.crits = res.isCrit ? 1 : 0;
    atk.shieldDmg = res.shieldTake;
    atk.reflect = res.reflect;
    atk.arrowBreakdown = [arrowBreakdownOf(arrow, res)];

    // 事件附加傷害（每箭平分，總量約等於舊制整回合一次）
    if (eff.extraDmg && !atk.stunned) {
      atk.dmg += Math.floor(eff.extraDmg / 6);
    }
    attacks.push(atk);

    // 護盾吸收
    if (atk.shieldDmg > 0) {
      statusEvents.push({ memberId: targetId, icon: "🛡️", text: `${target.name} 的護盾抵擋 ${atk.shieldDmg}`, phase: "arrow", value: atk.shieldDmg });
    }
    // 扣血 → 立即判定死亡（自動回血無法復活）
    if (atk.dmg > 0) {
      target.hp = Math.max(0, (target.hp || 0) - atk.dmg);
      if (target.hp <= 0) target.alive = false;
    }
    // 反彈回擊攻擊者
    if (atk.reflect > 0) {
      m.hp = Math.max(0, (m.hp || 0) - atk.reflect);
      if (m.hp <= 0) m.alive = false;
      statusEvents.push({ memberId, icon: "🌵", text: `${m.name} 被反彈 ${atk.reflect} 點傷害`, phase: "arrow", value: atk.reflect });
    }
    // 異常施加 → pending（下一回合啟動；每成員每回合最多一次）
    // ⚠️ atk.statusHit 只在真正施加時才寫，揭露動畫才能精準播報
    if (res.statusHit && !inflictedSet.has(memberId)) {
      inflictedSet.add(memberId);
      atk.statusHit = res.statusHit;
      target.pending[res.statusHit.id] = res.statusHit;
      const rule = PVP_STATUS_RULES[res.statusHit.id];
      statusEvents.push({
        memberId: targetId, icon: rule?.icon || "☠️",
        text: `${m.name} 使 ${target.name} 陷入${rule?.name || res.statusHit.id}（${res.statusHit.duration} 回合）`,
        phase: "arrow",
      });
    }
  };

  outer:
  for (let i = 0; i < 6; i++) {
    for (const team of order) {
      if (teamDead(otherTeam(team))) break outer;
      for (const memberId of aliveNow(teamSrc[team])) {
        if (teamDead(otherTeam(team))) break outer;
        fireOneArrow(team, memberId, i);
      }
    }
  }

  // 6. 貓貓攻擊（應援專精放大 catAtk）— 雙方都還有存活才出手
  const catPhase = (myTeam) => {
    const src = myTeam === "A" ? effA : effB;
    const tgt = myTeam === "A" ? effB : effA;
    const myAlive = aliveNow(src);
    const tgtAlive = aliveNow(tgt);
    if (!myAlive.length || !tgtAlive.length) return;
    for (const id of myAlive) {
      const m = src[id];
      if (!m || !m.alive || (m.hp || 0) <= 0 || !m.catAtk) continue;
      const targetId = pickTarget(tgtAlive, null, rand);
      if (!targetId) continue;
      const target = tgt[targetId];
      const boosted = applyCompanion({ attack: m.catAtk, mods: m.mods });
      let raw = 0;
      for (let i = 0; i < 6; i++) {
        raw += Math.max(1, Math.round((boosted.attack - (target.def || 0) * 0.5) * (0.5 + rand() * 1.5)));
      }
      const shieldTake = Math.min(target.shield || 0, raw);
      const actual = raw - shieldTake;
      if (shieldTake > 0) {
        target.shield = Math.max(0, (target.shield || 0) - shieldTake);
        statusEvents.push({ memberId: targetId, icon: "🛡️", text: `${target.name} 的護盾抵擋 ${shieldTake}`, phase: "arrow", value: shieldTake });
      }
      if (actual > 0) {
        target.hp = Math.max(0, (target.hp || 0) - actual);
        if (target.hp <= 0) target.alive = false;
      }
      attacks.push({ attackerId: id, attackerTeam: myTeam, targetId, dmg: actual, crits: 0,
        shieldDmg: shieldTake, reflect: 0, arrowBreakdown: [], isCat: true, catName: m.catName || "貓貓" });
    }
  };
  if (aliveNow(effA).length > 0 && aliveNow(effB).length > 0) {
    catPhase("A");
    catPhase("B");
  }

  // 7. 回合末回血（睡飽/汲取 專精＋卡片）— 已倒下的人不回血（不能復活）
  for (const m of [...Object.values(effA), ...Object.values(effB)]) {
    if (!m.alive || (m.hp || 0) <= 0) continue;
    const heal = applyRoundEnd({ currentHp: m.hp, maxHp: m.maxHP, mods: m.mods, alive: true });
    if (heal.healed > 0) {
      m.hp = heal.hp;
      statusEvents.push({ memberId: m.id, icon: "🌿", text: `${m.name} 回復 ${heal.healed} HP`, phase: "end", value: heal.healed, kind: "heal" });
    }
  }
  // 事件補血
  if (eff.healArcher) {
    for (const m of [...Object.values(effA), ...Object.values(effB)]) {
      if (!m.alive || (m.hp || 0) <= 0) continue;
      const before = m.hp || 0;
      const healed = Math.min(m.maxHP || 0, before + eff.healArcher) - before;
      if (healed > 0) {
        m.hp = before + healed;
        statusEvents.push({ memberId: m.id, icon: "✨", text: `${m.name} 回復 ${healed} HP`, phase: "end", value: healed, kind: "heal" });
      }
    }
  }

  // 8. 舊狀態到期（這回合運作過的扣 1 回合）
  const expire = members => {
    for (const [id, m] of Object.entries(members)) {
      const next = {};
      for (const [sid, st] of Object.entries(m.status)) {
        const dur = st.duration - 1;
        if (dur > 0) next[sid] = { ...st, duration: dur };
        else statusEvents.push({
          memberId: id, icon: PVP_STATUS_RULES[sid]?.icon || "",
          text: `${m.name} 的${PVP_STATUS_RULES[sid]?.name || sid}結束了`,
          phase: "end",
        });
      }
      m.status = next;
    }
  };
  expire(effA);
  expire(effB);

  // 9. 血量歸零 → 標記死亡（避免下回合卡在 alive 卻無法出手）
  for (const m of [...Object.values(effA), ...Object.values(effB)]) {
    if ((m.hp || 0) <= 0) m.alive = false;
  }

  // 10. 勝負判斷
  const aliveAAfter = Object.values(effA).filter(m => m.alive && (m.hp || 0) > 0);
  const aliveBAfter = Object.values(effB).filter(m => m.alive && (m.hp || 0) > 0);
  let result = null;
  if (aliveAAfter.length === 0 && aliveBAfter.length === 0) result = "draw";
  else if (aliveAAfter.length === 0) result = "teamB";
  else if (aliveBAfter.length === 0) result = "teamA";

  // 12. 淨 HP 變化（揭露動畫反推回合前 HP 用）
  const hpDelta = {};
  for (const [id, m] of Object.entries({ ...effA, ...effB })) {
    if (startHp[id] !== undefined) hpDelta[id] = (m.hp || 0) - startHp[id];
  }

  // 11. 整份取代的成員地圖（重置 ready/arrows，下回合才能重新提交）
  const members = {};
  const resetForNext = m => ({ ...m, arrows: [], ready: false, preferredTargetId: null });
  for (const [id, m] of Object.entries(effA)) members[`A:${id}`] = resetForNext(m);
  for (const [id, m] of Object.entries(effB)) members[`B:${id}`] = resetForNext(m);

  const logEntry = { round, event: eventData, attacks, hpDelta, statusEvents, format: "interleave", firstTeam };

  return { eventData, attacks, hpDelta, statusEvents, members, result, logEntry };
}

/** 給 UI 的負載摘要（描述玩家帶了哪些加成） */
export function summarizeDuelLoadout(loadout) {
  if (!loadout) return [];
  const out = [];
  if (loadout.cards > 0) out.push({ icon: "🃏", label: `卡片 ×${loadout.cards}` });
  for (const s of loadout.specLabels || []) {
    out.push({ icon: "⚒️", label: `${s.label} Lv.${s.level}` });
  }
  for (const row of loadout.rows || []) {
    out.push({ icon: row.icon, label: row.text.replace(/^[^：:]*：/, "") });
  }
  return out;
}
