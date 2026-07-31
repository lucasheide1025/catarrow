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
  ultCast:      1100,   // 技能名橫幅掃過＋王的前搖
  ultHit:       420,    // 每一段命中
  statusApply:  700,
  ultEnd:       420,
  counterSwing: 340,
  counter:      700,
  catAssist:    620,
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
        ? `⚡ ${event.intent.name}：命中弱點 ${event.intent.interruptRequired} 次可打斷`
        : "牠在等你出手。";
    case "arrow": {
      if (event.overCap) return "這張靶已經滿了——這箭沒有效果";
      if (event.missed) return "脫靶";
      if (event.hit) return `${event.bullseye ? "🎯正中 " : ""}${event.spot?.icon || ""}${event.spot?.name || "弱點"}（算滿分）−${event.damage}`;
      return `上靶但沒中弱點 −${event.damage}`;
    }
    case "catAssist":
      return `🐾 ${event.cat?.name || "貓貓"} 協戰 −${event.damage}${event.skill ? "　✨特技！" : ""}`;
    case "breakthrough": return "💥 破防！全員增傷";
    case "interrupt":    return `💢 打斷「${event.intent?.name || ""}」——破綻！`;
    case "phaseShift":   return `${event.phase?.name || ""}：${event.phase?.flavor || ""}`;
    case "ultCast":
      return `${event.intent?.name || "強攻"} 發動！${event.hits > 1 ? `${event.hits} 連擊` : ""}${event.weakened ? "（已被削弱）" : ""}`;
    case "ultHit":
      return event.hits > 1
        ? `第 ${event.index + 1} 擊 −${event.damage}`
        : `命中 −${event.damage}`;
    case "statusApply":
      return `${event.status?.name || "異常"}：${event.status?.effect || ""}`;
    case "ultEnd":       return "";
    case "counterSwing": return "牠揮了過來——";
    case "counter":      return `牠反擊 −${event.damage}`;
    case "bossDown":     return "牠倒下了。";
    default:             return "";
  }
}
