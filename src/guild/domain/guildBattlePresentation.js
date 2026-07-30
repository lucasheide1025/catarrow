export const GUILD_VICTORY_CONFIRM_MS = 1600;

export function guildBattleFinalizeDelay(status, baseDelay = 0) {
  return Math.max(0, baseDelay) + (status === "won" ? GUILD_VICTORY_CONFIRM_MS : 0);
}

export function retargetPendingShots(shots = [], targetInstanceId) {
  return shots.map(shot => ({ ...shot, targetInstanceId }));
}

// ── 回合演出時間軸 ───────────────────────────────────────────────────────────
// processRound 是瞬間算完的純函數，UI 要照著 log 把過程播出來。
//
// ⚠️ 這裡刻意「照 log 原始順序」排程，不可以再按 type 分桶。
// 舊版把 log 過濾成 arrow/cat/dodge/monsterAttack/skill 各一桶、一桶一桶播，結果：
//   - domain 本來把技能反制與結算「夾在對應的那一箭之後」（expeditionFlow 244~269），
//     分桶後全部被推到最後才播，玩家看到的因果完全對不上。
//   - 閃避與怪物攻擊在 log 裡是逐隻交錯的，分桶後變成「先閃一排、再挨一排打」。
// 使用者回報的「怪物攻擊、施放技能不順暢也不正常」就是這個。
const DEFAULT_STEP_MS = {
  arrow: 430,
  monsterMove: 520,   // 怪物推進：要看得到牠們逼近，不能瞬間跳位
  catAttack: 360,
  dodge: 300,
  monsterAttack: 560,
  starve: 520,
  travelEvent: 700,
  villagerAssist: 1200,
  skillIntent: 750,
  skillResolve: 650,
  counterSuccess: 650,
  effectApply: 480,
  effectReplace: 480,
  effectRemove: 480,
  waveClear: 600,
  defenseSpawn: 420,
};

// 沒有列在上表的 log（例如 travelSupply）不佔時間軸，但仍會依序回傳，
// 呼叫端可以選擇忽略——不要在這裡偷偷丟掉，否則之後新增 log 型別會靜默消失。
export const GUILD_LOG_STEP_MS = Object.freeze({ ...DEFAULT_STEP_MS });

export function buildBattleTimeline(log = [], stepMs = GUILD_LOG_STEP_MS) {
  const entries = Array.isArray(log) ? log : [];
  let at = 0;
  const timeline = entries.map((entry, index) => {
    const startAt = at;
    at += Math.max(0, Number(stepMs?.[entry?.type]) || 0);
    return { entry, index, at: startAt };
  });
  return { timeline, totalMs: at };
}

// 一段動畫要不要把怪物從場上移除。舊版整場動畫都用開打前的 aliveTargets(state) 畫怪，
// 被打死的怪會一直站到回合結束才整批消失，於是「已確認全部敵人陣亡」的橫幅會在
// 怪物還在畫面上時就先跳出來（使用者回報的「怪物全滅前系統已經確定結算」）。
// 呼叫端在播到 killed 的那一刻把 instanceId 丟進來，畫面就會即時少一隻。
export function collectDownedIds(log = []) {
  const downed = [];
  for (const entry of Array.isArray(log) ? log : []) {
    if (entry?.killed && entry.target && !downed.includes(entry.target)) downed.push(entry.target);
  }
  return downed;
}
