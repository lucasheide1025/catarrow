// src/worldboss/domain/raidTimeline.js
// log → 演出時間軸。**保留 log 原順序**（見 raidFlow 的鐵律）。
// 每種事件有自己的停留時間：重的事件停久一點，讓玩家看得到。

export const RAID_STEP_MS = Object.freeze({
  roundStart:   500,
  intent:       900,
  arrow:        520,
  gauge:        260,
  breakthrough: 1600,   // 全場最重的一個，要讓白閃＋慢動作跑完
  interrupt:    1300,
  phaseShift:   1500,
  ult:          1100,
  counter:      700,
  bossDown:     2200,
  roundEnd:     420,
});

export function buildRaidTimeline(log = [], stepMs = RAID_STEP_MS) {
  let at = 0;
  return log.map(event => {
    const dur = stepMs[event.type] ?? 400;
    const entry = { ...event, atMs: at, durationMs: dur };
    at += dur;
    return entry;
  });
}

export function timelineDuration(timeline = []) {
  if (!timeline.length) return 0;
  const last = timeline[timeline.length - 1];
  return last.atMs + last.durationMs;
}

// 一句話戰報（左上訊息列用）
export function describeEvent(event) {
  if (!event) return "";
  switch (event.type) {
    case "roundStart":
      return event.staggered ? "牠還沒站穩——全部位開放！" : `第 ${event.round} 回合`;
    case "intent":
      return event.intent?.charging
        ? `⚡ ${event.intent.name}：${event.intent.interruptRequired} 次腿部命中可打斷`
        : "牠在等你出手。";
    case "arrow": {
      if (event.missed) return "脫靶";
      if (event.blocked) return `${event.declared?.name || "該部位"}被護住了`;
      if (event.grazed) return `擦過——${event.declared?.name || ""}沒咬住`;
      if (event.hit) return `${event.part?.icon || ""}${event.part?.name || ""} 命中 −${event.damage}`;
      return `命中 −${event.damage}`;
    }
    case "breakthrough": return "💥 破防！全員增傷";
    case "interrupt":    return `🦵 打斷「${event.intent?.name || ""}」——破綻！`;
    case "phaseShift":   return `${event.phase?.name || ""}：${event.phase?.flavor || ""}`;
    case "ult":          return `${event.intent?.name || "強攻"} 命中 −${event.damage}${event.weakened ? "（已削弱）" : ""}`;
    case "counter":      return `牠反擊 −${event.damage}`;
    case "bossDown":     return "牠倒下了。";
    default:             return "";
  }
}
