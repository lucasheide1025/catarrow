// src/lib/monsterStatus.js
// ─────────────────────────────────────────────────────────────
// ☠️ 玩家對**怪物**施加的異常狀態（作者 2026-08-01 指定做真的）。
//
// ⚠️ 這是全新的方向：以前只有「怪物對玩家」單向施加狀態，
//    卡片上寫著「淬毒」其實只是 +1% 傷害。現在反過來也成立。
//
// ⚠️ **觸發綁在射得準上**（高品質命中才判定）。這是刻意的設計：
//    這是射箭遊戲，讓「射得好」直接換成戰術優勢，比讓它單純加傷害有意義得多。
//    純機率觸發會變成抽獎，跟射箭本身脫鉤。
//
// ⚠️ 每種狀態**同時只存在一份**，重複命中是「刷新回合數並取較強的強度」，
//    不是疊加。疊加會讓滿編卡片的玩家把怪物鎖死，那不是難度是消失。
// ─────────────────────────────────────────────────────────────

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * 狀態目錄。
 * kind：
 *   dot      每回合傷害
 *   statDown 壓低怪物數值
 *   control  阻止怪物行動（**最強的一類，所以持續最短、觸發最低**）
 */
export const MONSTER_STATUSES = Object.freeze({
  poison: {
    id: "poison", name: "中毒", icon: "☠️", color: "#84cc16", kind: "dot",
    unit: "maxHpPct", nonLethal: true, maxDuration: 3,
    desc: "每回合失去最大生命的一部分，但不會致命",
  },
  burn: {
    id: "burn", name: "灼燒", icon: "🔥", color: "#f97316", kind: "dot",
    unit: "atkPct", nonLethal: false, maxDuration: 2,
    desc: "每回合依你的攻擊力持續燃燒，可以造成最後一擊",
  },
  bleed: {
    id: "bleed", name: "流血", icon: "🩸", color: "#ef4444", kind: "dot",
    unit: "atkPct", nonLethal: false, maxDuration: 3, scalesWithHits: true,
    desc: "每回合流失生命，命中越多層數越高",
  },
  defBreak: {
    id: "defBreak", name: "破防", icon: "🔨", color: "#fbbf24", kind: "statDown",
    stat: "def", maxDuration: 2,
    desc: "怪物防禦下降，這段期間所有人打牠都比較痛",
  },
  weaken: {
    id: "weaken", name: "虛弱", icon: "😱", color: "#a78bfa", kind: "statDown",
    stat: "atk", maxDuration: 2,
    desc: "怪物攻擊下降，反擊變得比較不痛",
  },
  freeze: {
    id: "freeze", name: "冰凍", icon: "❄️", color: "#38bdf8", kind: "control",
    blocks: "skill", maxDuration: 1,
    desc: "怪物這回合放不出技能",
  },
  paralyze: {
    id: "paralyze", name: "麻痺", icon: "⚡", color: "#facc15", kind: "control",
    blocks: "counter", maxDuration: 1,
    desc: "怪物這回合有機率無法反擊",
  },
});

export const MONSTER_STATUS_LIST = Object.freeze(Object.values(MONSTER_STATUSES));

/**
 * 六族各自的招牌異常——讓卡片有族群識別度。
 * ⚠️ 這個對應要跟怪物的族性一致，玩家才記得住「打毒蟲要用什麼、毒蟲給我什麼」。
 */
export const FAMILY_STATUS = Object.freeze({
  insect: "poison",      // 毒蟲族 → 中毒
  temple: "burn",        // 西方怪物族 → 聖焰灼燒
  ghost: "weaken",       // 鬼怪族 → 恐懼虛弱
  workplace: "defBreak", // 職場族 → 破防（績效壓力）
  exam: "paralyze",      // 考試族 → 腦袋當機
  mountain: "bleed",     // 山林族 → 撕裂流血
  treasure: "freeze",    // 寶箱族 → 冰封
});

/** 幾環以上才判定觸發。⚠️ 跟 combatModifiers 的高品質同一條線。 */
export const PROC_MIN_SCORE = 9;

/** 控場類最強，所以觸發率與持續時間都要壓住 */
export const CONTROL_PROC_CAP = 12;   // 冰凍／麻痺的觸發率上限（%）
export const PROC_CAP = 35;           // 其他狀態的觸發率上限（%）

/** 這一箭夠不夠格判定觸發 */
export function isProcEligible(score) {
  if (score === "X" || score === "x") return true;
  return num(score) >= PROC_MIN_SCORE;
}

export function procCapFor(statusId) {
  return MONSTER_STATUSES[statusId]?.kind === "control" ? CONTROL_PROC_CAP : PROC_CAP;
}

/**
 * 判定這一箭有沒有施加狀態。
 * @param inflict { [statusId]: { chancePct, strength } }  來自卡片天賦彙總
 */
export function rollInflict({ score, inflict = {}, rand = Math.random } = {}) {
  if (!isProcEligible(score)) return [];
  const out = [];
  for (const [id, cfg] of Object.entries(inflict || {})) {
    const def = MONSTER_STATUSES[id];
    if (!def || !cfg) continue;
    const chance = Math.min(procCapFor(id), Math.max(0, num(cfg.chancePct)));
    if (chance <= 0) continue;
    if (rand() * 100 >= chance) continue;
    out.push({
      id, name: def.name, icon: def.icon, color: def.color, kind: def.kind,
      strength: Math.max(0, num(cfg.strength)),
      duration: Math.max(1, Math.min(def.maxDuration, num(cfg.duration, def.maxDuration))),
    });
  }
  return out;
}

/**
 * 併入既有狀態列表。
 * ⚠️ **同一種狀態不疊加**：刷新回合數、取較強的強度。
 *    疊加會讓滿編玩家把怪物鎖死，那不是難度是消失。
 */
export function mergeMonsterStatus(list = [], incoming = null) {
  if (!incoming?.id) return [...(list || [])];
  const rest = (list || []).filter(s => s.id !== incoming.id);
  const old = (list || []).find(s => s.id === incoming.id);
  if (!old) return [...rest, { ...incoming }];
  return [...rest, {
    ...incoming,
    strength: Math.max(num(old.strength), num(incoming.strength)),
    duration: Math.max(num(old.duration), num(incoming.duration)),
    // 流血特別：命中越多層數越高（唯一會累積的量）
    stacks: MONSTER_STATUSES[incoming.id]?.scalesWithHits
      ? Math.min(5, num(old.stacks, 1) + 1) : undefined,
  }];
}

/** 怪物現在被壓低多少數值 */
export function monsterStatMods(list = []) {
  const find = id => (list || []).find(s => s.id === id);
  return {
    defDownPct: Math.min(60, num(find("defBreak")?.strength)),
    atkDownPct: Math.min(60, num(find("weaken")?.strength)),
  };
}

/** 怪物這回合能不能放技能／反擊 */
export function monsterBlocked(list = [], rand = Math.random) {
  const frozen = (list || []).some(s => s.id === "freeze");
  const para = (list || []).find(s => s.id === "paralyze");
  return {
    skillBlocked: frozen,
    // ⚠️ 麻痺是**機率**擋反擊，不是必定——必定擋等於怪物完全不會動
    counterBlocked: !!para && rand() * 100 < Math.max(0, num(para.strength, 50)),
  };
}

/**
 * 回合末結算持續傷害並倒數。
 * @param playerAtk 灼燒／流血依玩家攻擊力計算
 */
export function tickMonsterStatuses({ list = [], monsterHp, monsterMaxHp, playerAtk = 0 } = {}) {
  let hp = num(monsterHp);
  const logs = [];
  const next = [];

  for (const s of list || []) {
    const def = MONSTER_STATUSES[s.id];
    if (!def) continue;
    let dealt = 0;
    if (def.kind === "dot") {
      const raw = def.unit === "maxHpPct"
        ? num(monsterMaxHp) * num(s.strength) / 100
        : num(playerAtk) * num(s.strength) / 100 * num(s.stacks, 1);
      dealt = Math.max(1, Math.round(raw));
      // ⚠️ 中毒不致死：留 1 滴血，最後一刀要玩家自己補
      hp = def.nonLethal ? Math.max(1, hp - dealt) : Math.max(0, hp - dealt);
      if (def.nonLethal && hp === 1) dealt = Math.max(0, num(monsterHp) - 1);
      logs.push({ id: s.id, name: def.name, icon: def.icon, damage: dealt });
    }
    const left = num(s.duration, 1) - 1;
    if (left > 0) next.push({ ...s, duration: left });
    else logs.push({ id: s.id, name: def.name, icon: def.icon, expired: true });
  }
  return { monsterHp: hp, statuses: next, logs, totalDamage: logs.reduce((a, l) => a + num(l.damage), 0) };
}

/** UI 用的一行字 */
export function describeMonsterStatuses(list = []) {
  return (list || []).map(s => {
    const def = MONSTER_STATUSES[s.id];
    if (!def) return null;
    const stacks = s.stacks > 1 ? ` ×${s.stacks}` : "";
    return {
      id: s.id, icon: def.icon, color: def.color,
      text: `${def.icon} ${def.name}${stacks}（${s.duration} 回合）`,
    };
  }).filter(Boolean);
}
