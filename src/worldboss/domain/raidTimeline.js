// src/worldboss/domain/raidTimeline.js
// log → 演出時間軸。**保留 log 原順序**（見 raidFlow 的鐵律）。
// 每種事件有自己的停留時間：重的事件停久一點，讓玩家看得到。

// ⚠️ 組隊時逐箭播太長：8 人 × 6 箭 = 48 箭，一箭 520ms 就要 25 秒。
//    **三箭一組**（作者 2026-07-31）——一個人的 6 箭變成兩次演出，時間砍一半。
//    ⚠️ 分組是**演出層**的事，domain 的 log 仍然逐箭記錄（紀錄與結算都要精確）。
export const VOLLEY_SIZE = 3;

export const RAID_STEP_MS = Object.freeze({
  roundStart:   500,
  intent:       900,
  arrow:        520,
  volley:       480,    // 三箭一組（比單箭久一點，但遠比 3×520 短）
  catVolley:    520,
  gauge:        150,
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

/**
 * 把連續的同一人箭矢併成「齊射」，貓貓協戰也一樣。
 * 只動演出，不動結算——log 進來是逐箭的，出去才是分組的。
 */
export function groupRaidVolleys(log = [], size = VOLLEY_SIZE) {
  const n = Math.max(1, Math.floor(size) || 1);
  const out = [];
  let buf = [];
  let bufType = null;
  // ⚠️ 破防槽的 tick 也要併：箭合併了槽沒合併，48 箭就有 48 個 gauge 事件，
  //    光是這一項就佔 12 秒——實測整場演出砍不下來的真正原因。
  let gaugeBuf = null;

  const flushGauge = () => {
    if (!gaugeBuf) return;
    out.push(gaugeBuf);
    gaugeBuf = null;
  };

  const flush = () => {
    // ⚠️ buffer 空的時候什麼都不做（連 gauge 也不吐）：
    //    否則每組會吐兩次 gauge——最後一支箭的 gauge 會被單獨吐出來。
    if (!buf.length) return;
    const items = buf;
    buf = [];
    if (items.length === 1) { out.push(items[0]); flushGauge(); return; }   // 只有一支就不用併
    const last = items[items.length - 1];
    if (bufType === "arrow") {
      out.push({
        type: "volley", round: last.round,
        memberId: last.memberId, shooterName: last.shooterName,
        arrows: items,
        damage: items.reduce((a, e) => a + (e.damage || 0), 0),
        hits: items.filter(e => e.hit).length,
        bullseyes: items.filter(e => e.bullseye).length,
        combo: last.combo,
        bossHp: last.bossHp, bossHpRatio: last.bossHpRatio,
      });
    } else {
      out.push({
        type: "catVolley", round: last.round,
        cats: items,
        damage: items.reduce((a, e) => a + (e.damage || 0), 0),
        skills: items.filter(e => e.skill).length,
        bossHp: last.bossHp, bossHpRatio: last.bossHpRatio,
      });
    }
    flushGauge();               // 這一組箭累積的破防，合成一次演出
  };

  for (const event of log) {
    // 連續的 gauge 併成一個（只保留最後的槽值與加總的增量）
    if (event.type === "gauge") {
      gaugeBuf = gaugeBuf
        ? { ...event, gained: (gaugeBuf.gained || 0) + (event.gained || 0) }
        : { ...event };
      continue;                 // ⚠️ 不能在這裡 flush：gauge 是**夾在箭之間**的，
                                  //    立刻吐出來等於完全沒合併（第一版的 bug）
    }
    const groupable = event.type === "arrow" || event.type === "catAssist";
    // 同一人的箭才併；換人就先收尾（不然傷害會記到別人頭上）
    const sameGroup = groupable && bufType === event.type
      && (event.type !== "arrow" || buf[0]?.memberId === event.memberId);
    if (!groupable || !sameGroup || buf.length >= n) {
      flush();
      bufType = groupable ? event.type : null;
    }
    if (groupable) {
      buf.push(event);
      if (buf.length >= n) flush();
    } else {
      // 破防／階段轉換／大招這類事件之前，先把累積的槽吐出來：
      // 「槽先填滿、才爆發」的順序不能顛倒
      flushGauge();
      out.push(event);
    }
  }
  flush();
  flushGauge();
  return out;
}

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
    case "volley": {
      const who = event.shooterName ? `${event.shooterName}　` : "";
      if (!event.hits) return `${who}${event.arrows.length} 箭上靶 −${event.damage}`;
      return `${who}${event.hits}/${event.arrows.length} 命中弱點 −${event.damage}${event.bullseyes ? "　🎯正中" : ""}`;
    }
    case "catVolley":
      return `🐾 貓貓協戰 ×${event.cats.length} −${event.damage}${event.skills ? "　✨特技" : ""}`;
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
    case "bossDown":
      return event.style
        ? `${event.style.icon} ${event.killerName || "有人"}：${event.style.name}——牠倒下了。`
        : "牠倒下了。";
    default:             return "";
  }
}
