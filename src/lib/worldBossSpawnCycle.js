// src/lib/worldBossSpawnCycle.js
// ─────────────────────────────────────────────────────────────
// 🌌 世界王重生週期 —— **唯讀顯示層**（2026-08-03 整併）
//
// ⚠️ **權威在雲端**：`functions/worldBossLifecycle.js` 的
//    `ensureCycle` / `trySpawn` / `contribute` 才是真正在跑的那套。
//    它由三個地方觸發：大廳載入、後台強制生成、以及**排程**。
//
// ⚠️ 這支以前有一份**平行的客戶端實作**（buildWorldBossSpawnCycle /
//    applyWorldBossSpawnContribution，加上 worldBossDb 的
//    startWorldBossSpawnCycle / trySpawnWorldBossFromCycle）。
//    兩套寫同一份文件、各有一套預設值——作者 2026-08-03 回報
//    「重生機制似乎是兩套卡在一起」，就是這個。
//    那些寫入端已經**全部刪除**；這裡只留「看得懂現在是什麼狀態」用的純函式。
//    **不要再在客戶端寫生成邏輯**，否則會出現雙重生成。
//
// ⚠️ 下面的預設值是**雲端拿不到設定時的鏡像**，必須跟
//    `functions/worldBossLifecycle.js` 的 DEFAULTS 一致。
//    有測試（worldBossSpawnCycle.test.js）直接讀那個檔案比對，漂掉會被擋下來。
// ─────────────────────────────────────────────────────────────

export const WORLD_BOSS_SPAWN_DEFAULTS = Object.freeze({
  restHours: 8,
  deadlineHours: 48,
  targets: Object.freeze({ arrows: 10000, dungeonClears: 30, monsterKills: 500, villageDice: 300 }),
});

/** 蓄力進度的四種來源 */
export const SPAWN_PROGRESS_TYPES = Object.freeze(Object.keys(WORLD_BOSS_SPAWN_DEFAULTS.targets));

/** 每一種進度的中文說明（大廳顯示用） */
export const SPAWN_PROGRESS_LABEL = Object.freeze({
  arrows: "射箭數", dungeonClears: "地下城通關", monsterKills: "擊敗怪物", villageDice: "貓貓村擲骰",
});

/**
 * 這一輪抽中的條件。
 *
 * ⚠️ 作者 2026-08-03 改成**四選一隨機**（原本是「任一達標」＝四條路同時開，
 *    每一輪長得一樣）。抽籤在**雲端開週期時**做一次並存進文件，
 *    這裡只是讀出來——**不要在客戶端抽**，不同人會看到不同答案。
 * ⚠️ 舊的週期文件沒有 requiredType，回 null＝退回舊行為（任一達標），
 *    不然那些週期會永遠卡住開不出王。
 */
export function requiredSpawnType(cycle) {
  const type = cycle?.requiredType;
  return SPAWN_PROGRESS_TYPES.includes(type) ? type : null;
}

/** 這一輪要看的進度種類（抽中的那一種；舊文件則是全部） */
export function activeSpawnTypes(cycle) {
  const required = requiredSpawnType(cycle);
  return required ? [required] : [...SPAWN_PROGRESS_TYPES];
}

/**
 * 現在這個週期是什麼狀態。**唯讀**——不會、也不該觸發任何生成。
 *
 * 三個階段：休息中 resting → 蓄力中 charging → 可生成 ready
 * 可生成的兩種原因：任一項進度達標（reason = 該項目），或到了 deadline。
 */
export function evaluateWorldBossSpawnCycle(cycle, nowMs = Date.now()) {
  if (!cycle || ["spawning", "spawned"].includes(cycle.status)) {
    return { ready: false, reason: cycle?.status || "missing" };
  }
  if (nowMs < cycle.restEndsAtMs) {
    return { ready: false, reason: "resting", remainingMs: cycle.restEndsAtMs - nowMs };
  }
  // ⚠️ 只認抽中的那一種——其他三種推再多也不會開門
  const reached = activeSpawnTypes(cycle).find(
    key => (cycle.progress?.[key] || 0) >= (cycle.targets?.[key] || Infinity));
  if (reached) return { ready: true, reason: reached };
  if (nowMs >= cycle.deadlineAtMs) return { ready: true, reason: "deadline" };
  return { ready: false, reason: "charging", remainingMs: cycle.deadlineAtMs - nowMs };
}

/** 進度百分比（0~1，超過算滿）。大廳的進度條用。 */
export function spawnProgressRatio(cycle, type) {
  const value = Number(cycle?.progress?.[type]) || 0;
  const target = Number(cycle?.targets?.[type]) || Number(WORLD_BOSS_SPAWN_DEFAULTS.targets[type]) || 1;
  return Math.max(0, Math.min(1, value / target));
}

/** 一句話說明現在在等什麼——大廳直接印這個，不要各自寫 if */
export function describeSpawnCycle(cycle, nowMs = Date.now()) {
  const ev = evaluateWorldBossSpawnCycle(cycle, nowMs);
  if (ev.reason === "missing") return "還沒有下一隻王的消息";
  if (ev.reason === "resting") return "🌌 異界正在沉寂——世界王剛被擊倒，還在休息";
  if (ev.reason === "spawning" || ev.reason === "spawned") return "🌀 新的世界王正在降臨…";
  if (ev.ready) {
    return ev.reason === "deadline" ? "🌀 時間到了，世界王即將降臨" : "🌀 進度已達標，世界王即將降臨";
  }
  const required = requiredSpawnType(cycle);
  if (required) return `🌀 這一輪的門檻是【${SPAWN_PROGRESS_LABEL[required]}】——推滿它就會提早降臨`;
  return "🌀 世界王降臨進度——大家一起推進度就會提早出現";
}
