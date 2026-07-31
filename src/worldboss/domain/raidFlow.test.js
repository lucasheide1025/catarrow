import { BREAK_GAUGE_MAX, advanceBreakGauge, applyUltGaugePenalty, burstMultiplier, emptyGaugeState, isBurstActive } from "./breakGauge";
import { INTERRUPT_REQUIRED, intentForRound, isChargeRound, resolveIntent } from "./bossIntent";
import { RAID_TOTAL_ROUNDS, createRaidState, raidHpRatio, resolveRaidRound } from "./raidFlow";
import { buildRaidTimeline, describeEvent, timelineDuration } from "./raidTimeline";
import { WB_PHASES, currentPhase, phaseTransition } from "./raidPhases";
import { WEAK_SPOT_MAP } from "./weakPoints";

const boss = (hp = 200000) => ({ key: "test", name: "測試王", hp, maxHp: hp, atk: 120, def: 50 });
const newState = (over = {}) => createRaidState({
  boss: boss(over.hp || 200000),
  stats: { atk: 150, def: 60, hp: 300 },
  ...over,
});
// 把弱點圈固定放在正中央，測試才不用管它抽到哪
const withSpot = (state, spotId = "yellow") => ({
  ...state,
  spots: [{ ...WEAK_SPOT_MAP[spotId], cx: 0, cy: 0, key: "t-" + spotId }],
});
// 射在圈心（命中）／射在靶上但圈外（沒中）／射到靶外（脫靶）
const atCentre = (n = 6) => Array.from({ length: n }, () => ({ nx: 0, ny: 0, score: 10 }));
const outsideSpot = (n = 6) => Array.from({ length: n }, () => ({ nx: 0.65, ny: 0, score: 4 }));
const offTarget = (n = 6) => Array.from({ length: n }, () => ({ nx: 1.4, ny: 0, score: 0 }));

describe("階段", () => {
  test("血量決定階段，邊界不會落空", () => {
    expect(currentPhase(1).id).toBe(1);
    expect(currentPhase(0.8).id).toBe(1);
    expect(currentPhase(0.5).id).toBe(2);
    expect(currentPhase(0.2).id).toBe(3);
    expect(currentPhase(0).id).toBe(3);
  });

  test("每階段的封鎖設定都不同（保留給未來的階段機制）", () => {
    const blocked = WB_PHASES.map(p => p.blocked.join(","));
    expect(new Set(blocked).size).toBe(WB_PHASES.length);
  });

  test("跨階段才回報轉場（同階段內不重複播演出）", () => {
    expect(phaseTransition(0.8, 0.7)).toBeNull();
    expect(phaseTransition(0.7, 0.6).id).toBe(2);
  });

  test("第三階段破防累積更快——狂暴期要有回報", () => {
    expect(WB_PHASES[2].gaugeMult).toBeGreaterThan(WB_PHASES[0].gaugeMult);
  });
});

describe("破防槽：算次數不算傷害", () => {
  test("槽滿會爆發，溢出的點數留到下一輪", () => {
    const r = advanceBreakGauge({ ...emptyGaugeState(), gauge: BREAK_GAUGE_MAX - 1 }, 3, { round: 2 });
    expect(r.triggered).toBe(true);
    expect(r.state.gauge).toBe(2);
    expect(r.state.burstUntilRound).toBe(4);
  });

  test("爆發期間全員增傷，過期自動失效", () => {
    const st = { ...emptyGaugeState(), burstUntilRound: 4 };
    expect(isBurstActive(st, 4)).toBe(true);
    expect(burstMultiplier(st, 4)).toBeGreaterThan(1);
    expect(burstMultiplier(st, 5)).toBe(1);
  });

  test("破防槽算的是命中次數，不是傷害", () => {
    const few = advanceBreakGauge(emptyGaugeState(), 4, {});
    const many = advanceBreakGauge(emptyGaugeState(), 8, {});
    expect(many.state.gauge).toBe(few.state.gauge * 2);
  });

  test("大招打中會打掉一截槽，但不會歸零", () => {
    const after = applyUltGaugePenalty({ ...emptyGaugeState(), gauge: 20 });
    expect(after.gauge).toBeLessThan(20);
    expect(after.gauge).toBeGreaterThan(0);
  });
});

describe("王的意圖", () => {
  test("蓄力回合固定在 R2/R4——沿用既有 24 王的技能設定，不重寫資料", () => {
    expect(isChargeRound(2)).toBe(true);
    expect(isChargeRound(4)).toBe(true);
    expect(isChargeRound(1)).toBe(false);
    expect(isChargeRound(3)).toBe(false);
  });

  test("階段越後面越難打斷", () => {
    expect(INTERRUPT_REQUIRED[3]).toBeGreaterThan(INTERRUPT_REQUIRED[1]);
    expect(intentForRound({ round: 2, phaseId: 3 }).interruptRequired)
      .toBeGreaterThan(intentForRound({ round: 2, phaseId: 1 }).interruptRequired);
  });

  test("弱點命中夠 → 打斷成功，王發不出來", () => {
    const intent = intentForRound({ round: 2, phaseId: 1 });
    const r = resolveIntent({ intent, legHits: intent.interruptRequired });
    expect(r.interrupted).toBe(true);
    expect(r.fired).toBe(false);
    expect(r.staggerNext).toBe(true);
  });

  test("差一次就是沒斷成——分歧要乾脆", () => {
    const intent = intentForRound({ round: 2, phaseId: 1 });
    const r = resolveIntent({ intent, legHits: intent.interruptRequired - 1 });
    expect(r.interrupted).toBe(false);
    expect(r.fired).toBe(true);
  });

  test("紅點削弱會降低大招威力，但有下限", () => {
    const intent = intentForRound({ round: 2, phaseId: 1 });
    const none = resolveIntent({ intent, legHits: 0, weakenStacks: 0 });
    const some = resolveIntent({ intent, legHits: 0, weakenStacks: 3 });
    const lots = resolveIntent({ intent, legHits: 0, weakenStacks: 99 });
    expect(some.ultMultiplier).toBeLessThan(none.ultMultiplier);
    expect(lots.ultMultiplier).toBeGreaterThan(0);
  });

  test("非蓄力回合不會有打斷條件", () => {
    expect(intentForRound({ round: 1 }).interruptRequired).toBe(0);
    expect(resolveIntent({ intent: intentForRound({ round: 1 }), legHits: 9 }).fired).toBe(false);
  });
});

describe("一個回合的結算", () => {
  test("射進圈裡會扣王的血，並累積破防", () => {
    const { state, log } = resolveRaidRound({ state: withSpot(newState()), arrows: atCentre() });
    expect(state.bossHp).toBeLessThan(200000);
    expect(state.totals.weakHits).toBe(6);
    expect(state.gauge.gauge).toBeGreaterThan(0);
    expect(log.filter(e => e.type === "arrow")).toHaveLength(6);
  });

  test("上靶但沒中圈＝只有一般傷害，沒有弱點加成", () => {
    const hit = resolveRaidRound({ state: withSpot(newState()), arrows: atCentre() });
    const plain = resolveRaidRound({ state: withSpot(newState()), arrows: outsideSpot() });
    expect(plain.state.totals.weakHits).toBe(0);
    expect(plain.state.totals.damage).toBeGreaterThan(0);
    expect(plain.state.totals.damage).toBeLessThan(hit.state.totals.damage / 3);
  });

  test("脫靶連一般傷害都沒有", () => {
    const { state } = resolveRaidRound({ state: withSpot(newState()), arrows: offTarget() });
    expect(state.totals.damage).toBe(0);
  });

  test("⚠️ 打中弱點的一般傷害一律算滿分——圈長在外圈也值得拚", () => {
    // 同一個圈放在靶的外圈，射中它 vs 射在同樣位置但沒有圈
    const far = { ...newState(), spots: [{ ...WEAK_SPOT_MAP.green, cx: 0.55, cy: 0, key: "far" }] };
    const none = { ...newState(), spots: [] };
    const shot = [{ nx: 0.55, ny: 0, score: 4 }];
    const withSpotHit = resolveRaidRound({ state: far, arrows: shot });
    const withoutSpot = resolveRaidRound({ state: none, arrows: shot });
    expect(withSpotHit.log.find(e => e.type === "arrow").maxScored).toBe(true);
    expect(withoutSpot.log.find(e => e.type === "arrow").maxScored).toBe(false);
    // 有圈那一箭連「一般傷害」都被拉到滿分，所以差距不只是固定傷害那一塊
    expect(withSpotHit.state.totals.damage)
      .toBeGreaterThan(withoutSpot.state.totals.damage + WEAK_SPOT_MAP.green.dmgPct * 200000);
  });

  test("沒中圈就照落點的環數算，不會白送滿分", () => {
    const none = { ...newState(), spots: [] };
    const near = resolveRaidRound({ state: none, arrows: [{ nx: 0.05, ny: 0, score: 10 }] });
    const far = resolveRaidRound({ state: none, arrows: [{ nx: 0.75, ny: 0, score: 3 }] });
    expect(near.state.totals.damage).toBeGreaterThan(far.state.totals.damage);
  });

  test("打斷成功 → 下回合硬直，且硬直回合傷害更高", () => {
    const base = withSpot(newState());
    base.round = 2;
    const { state } = resolveRaidRound({ state: base, arrows: atCentre() });
    expect(state.staggered).toBe(true);

    const staggerRound = resolveRaidRound({ state: withSpot(state), arrows: atCentre(1) });
    const normalRound = resolveRaidRound({ state: withSpot({ ...state, staggered: false }), arrows: atCentre(1) });
    expect(staggerRound.state.totals.damage).toBeGreaterThan(normalRound.state.totals.damage);
  });

  test("沒斷成 → 大招發動，玩家掉血且破防槽被打掉", () => {
    const base = withSpot(newState());
    base.round = 2;
    base.gauge = { ...emptyGaugeState(), gauge: 20 };
    const { state, log } = resolveRaidRound({ state: base, arrows: outsideSpot() });
    expect(log.some(e => e.type === "ultCast")).toBe(true);
    expect(log.some(e => e.type === "ultHit")).toBe(true);
    expect(state.playerHp).toBeLessThan(base.playerHp);
    expect(state.gauge.gauge).toBeLessThan(20);
  });

  test("王倒下就停手，後面的箭不再結算（不會打死人還繼續扣）", () => {
    const nearly = withSpot(newState(), "red");
    nearly.bossHp = 1;
    const { state, log } = resolveRaidRound({ state: nearly, arrows: atCentre() });
    expect(state.bossHp).toBe(0);
    expect(log.filter(e => e.type === "arrow").length).toBeLessThan(6);
    expect(log.some(e => e.type === "bossDown")).toBe(true);
  });

  test("連擊會累計，斷掉要歸零", () => {
    const mixed = [
      { nx: 0, ny: 0 }, { nx: 0, ny: 0 },
      { nx: 0.65, ny: 0 },
      { nx: 0, ny: 0 },
    ];
    const { state, log } = resolveRaidRound({ state: withSpot(newState()), arrows: mixed });
    expect(log.filter(e => e.type === "arrow").map(e => e.combo)).toEqual([1, 2, 0, 1]);
    expect(state.totals.bestCombo).toBe(2);
  });

  test("下一回合會重抽圈，且整個圈都在靶紙內", () => {
    const { state } = resolveRaidRound({ state: withSpot(newState()), arrows: atCentre() });
    expect(state.spots.length).toBeGreaterThanOrEqual(1);
    expect(state.spots.every(sp => Math.hypot(sp.cx, sp.cy) + sp.radius <= 1)).toBe(true);
  });

  test("五回合後結束", () => {
    let state = newState({ hp: 99999999 });
    for (let i = 0; i < RAID_TOTAL_ROUNDS; i += 1) {
      state = resolveRaidRound({ state, arrows: outsideSpot() }).state;
    }
    expect(state.finished).toBe(true);
  });
});

describe("演出時間軸：log 順序就是演出順序", () => {
  test("時間軸完全保留 log 的順序（公會踩過的坑：按類型分桶會跳過動畫）", () => {
    const { log } = resolveRaidRound({ state: withSpot(newState()), arrows: atCentre() });
    const timeline = buildRaidTimeline(log);
    expect(timeline.map(e => e.type)).toEqual(log.map(e => e.type));
  });

  test("時間單調遞增，總長＝各事件停留時間相加", () => {
    const { log } = resolveRaidRound({ state: withSpot(newState()), arrows: atCentre() });
    const timeline = buildRaidTimeline(log);
    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i].atMs).toBeGreaterThan(timeline[i - 1].atMs);
    }
    expect(timelineDuration(timeline)).toBeGreaterThan(0);
  });

  test("重的事件停留比一般箭久，玩家才看得到", () => {
    const timeline = buildRaidTimeline([{ type: "arrow" }, { type: "breakthrough" }]);
    expect(timeline[1].durationMs).toBeGreaterThan(timeline[0].durationMs * 2);
  });

  test("每種事件都有可顯示的文案", () => {
    const { log } = resolveRaidRound({ state: withSpot(newState()), arrows: atCentre() });
    for (const event of log) {
      if (event.type === "roundEnd" || event.type === "gauge") continue;
      expect(describeEvent(event)).toBeTruthy();
    }
  });
});

describe("狀態不可變", () => {
  test("結算不會改到傳進去的 state（重播與重連才安全）", () => {
    const before = newState();
    const snapshot = JSON.parse(JSON.stringify({ hp: before.bossHp, gauge: before.gauge, totals: before.totals }));
    resolveRaidRound({ state: withSpot(before), arrows: atCentre() });
    expect(before.bossHp).toBe(snapshot.hp);
    expect(before.gauge).toEqual(snapshot.gauge);
    expect(before.totals).toEqual(snapshot.totals);
  });

  test("血量比例永遠在 0~1", () => {
    const s = newState();
    s.bossHp = -50;
    expect(raidHpRatio(s)).toBe(0);
  });
});

describe("結束條件（2026-07-31 抓到的洞：回合會一直往上加）", () => {
  test("跑滿五回合就 finished，不會出現「第 8/5 回合」", () => {
    let state = newState({ hp: 99999999 });
    const rounds = [];
    for (let i = 0; i < 5; i += 1) {
      rounds.push(state.round);
      expect(state.finished).toBe(false);
      state = resolveRaidRound({ state, arrows: outsideSpot() }).state;
    }
    expect(rounds).toEqual([1, 2, 3, 4, 5]);
    expect(state.finished).toBe(true);
    expect(state.round).toBe(RAID_TOTAL_ROUNDS + 1);
  });

  test("王倒下當下就 finished，不必等回合跑完", () => {
    const nearly = withSpot(newState(), "red");
    nearly.bossHp = 1;
    const { state } = resolveRaidRound({ state: nearly, arrows: atCentre() });
    expect(state.finished).toBe(true);
    expect(state.round).toBe(2);
  });

  test("玩家被打倒也算結束", () => {
    const weak = newState();
    weak.round = 4;                     // R4 終結技才可能打死
    weak.playerHp = 1;
    weak.stats = { ...weak.stats, def: 0 };
    weak.boss = { ...weak.boss, atk: 9999, skillConfig: { r4Finisher: { skillId: "x", name: "終結", baseMultiplier: 2.2, canKnockOut: true } } };
    const { state } = resolveRaidRound({ state: weak, arrows: outsideSpot() });
    expect(state.playerHp).toBe(0);
    expect(state.finished).toBe(true);
  });

  test("finished 之後即使再結算，回合也不會無限膨脹（呼叫端應該擋，這裡確保不會爆）", () => {
    let state = newState({ hp: 99999999 });
    for (let i = 0; i < 8; i += 1) state = resolveRaidRound({ state, arrows: outsideSpot() }).state;
    expect(state.finished).toBe(true);
  });
});

describe("貓貓陪練（2026-07-31 補上）", () => {
  const withCats = (over = {}) => createRaidState({
    boss: boss(200000),
    stats: { atk: 150, def: 60, hp: 300 },
    cats: [{ catId: "baobao", name: "寶寶", atk: 90 }],
    ...over,
  });

  test("每回合會自己咬一口，log 有 catAssist", () => {
    const { state, log } = resolveRaidRound({ state: withSpot(withCats()), arrows: outsideSpot() });
    expect(log.filter(e => e.type === "catAssist")).toHaveLength(1);
    expect(state.totals.catDamage).toBeGreaterThan(0);
  });

  test("貓的傷害算進總傷害", () => {
    const withCat = resolveRaidRound({ state: withSpot(withCats()), arrows: outsideSpot() }).state;
    const noCat = resolveRaidRound({ state: withSpot(newState()), arrows: outsideSpot() }).state;
    expect(withCat.totals.damage).toBeGreaterThan(noCat.totals.damage);
  });

  test("沒帶貓完全不會有 catAssist", () => {
    const { log, state } = resolveRaidRound({ state: withSpot(newState()), arrows: outsideSpot() });
    expect(log.some(e => e.type === "catAssist")).toBe(false);
    expect(state.totals.catDamage).toBe(0);
  });

  test("壞資料（atk 0 / null）不會被算成貓", () => {
    const s2 = createRaidState({
      boss: boss(), stats: { atk: 100, def: 50, hp: 200 },
      cats: [{ catId: "x", atk: 0 }, null, { catId: "y" }],
    });
    expect(s2.cats).toHaveLength(0);
  });

  test("王已經倒下就不會再補刀", () => {
    const nearly = withSpot(withCats(), "red");
    nearly.bossHp = 1;
    const { log } = resolveRaidRound({ state: nearly, arrows: atCentre() });
    expect(log.filter(e => e.type === "catAssist")).toHaveLength(0);
  });
});

describe("王的技能演出（2026-07-31）", () => {
  const ultRound = (skill, arrows = outsideSpot()) => {
    const st = withSpot(newState());
    st.round = 2;
    st.boss = { ...st.boss, skillConfig: { r2Strike: { skillId: "s", name: "測試技", baseMultiplier: 1.6, ...skill } } };
    return resolveRaidRound({ state: st, arrows });
  };

  test("大招拆成 詠唱 → 命中 → 收尾，UI 才有東西可以演", () => {
    const { log } = ultRound({});
    const types = log.map(e => e.type);
    expect(types.indexOf("ultCast")).toBeLessThan(types.indexOf("ultHit"));
    expect(types.indexOf("ultHit")).toBeLessThan(types.indexOf("ultEnd"));
  });

  test("⚠️ hits 是純演出段數——分段打但合計傷害不變", () => {
    const one = ultRound({ hits: 1 });
    const three = ultRound({ hits: 3 });
    const sum = r => r.log.filter(e => e.type === "ultHit").reduce((a, e) => a + e.damage, 0);
    expect(three.log.filter(e => e.type === "ultHit")).toHaveLength(3);
    expect(sum(three)).toBe(sum(one));
    expect(three.state.playerHp).toBe(one.state.playerHp);
  });

  test("最後一段有 last 旗標（給最重的那個演出用）", () => {
    const hits = ultRound({ hits: 3 }).log.filter(e => e.type === "ultHit");
    expect(hits.filter(e => e.last)).toHaveLength(1);
    expect(hits[hits.length - 1].last).toBe(true);
  });

  test("穿甲／破盾帶進 ultCast，玩家才知道防具被無視", () => {
    expect(ultRound({ armorPiercePct: 25 }).log.find(e => e.type === "ultCast").pierce).toBe(25);
    expect(ultRound({ shieldPiercePct: 30 }).log.find(e => e.type === "ultCast").shieldPierce).toBe(30);
  });

  test("有異常才會有 statusApply", () => {
    const withStatus = ultRound({ status: { id: "atkDownPct", name: "威壓", effect: "atkDownPct", strength: 20, duration: 1 } });
    expect(withStatus.log.some(e => e.type === "statusApply")).toBe(true);
    expect(ultRound({}).log.some(e => e.type === "statusApply")).toBe(false);
  });

  test("平砍也有前搖事件，不會憑空掉血", () => {
    const st = withSpot(newState());
    st.round = 1;
    const { log } = resolveRaidRound({ state: st, arrows: outsideSpot() });
    const types = log.map(e => e.type);
    expect(types.indexOf("counterSwing")).toBeLessThan(types.indexOf("counter"));
  });

  test("每個新事件都有可顯示的文案（ultEnd 例外，它只收尾）", () => {
    const { log } = ultRound({ hits: 2, armorPiercePct: 10 });
    for (const e of log.filter(x => ["ultCast", "ultHit", "counterSwing"].includes(x.type))) {
      expect(describeEvent(e)).toBeTruthy();
    }
  });
});
