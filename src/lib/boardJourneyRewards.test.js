// 探索地圖重製新增格子的獎勵計算（純函式 rollTileReward 擴充）。
// 規格見 .trellis/tasks/08-07-village-board-journey-redesign/design.md。
import { BOARD_MODES, rollTileReward, MONSTER_BAND_TABLE, miningBandFor, bossDuelState, rollTrapEvent, trapEffectOf, TRAP_EVENTS } from "./boardData";

const mode = BOARD_MODES[0]; // mine（山岳族）

test("營地格設定 campMult buff（本趟後續獎勵 ×1.2）", () => {
  const r = rollTileReward("camp", { mode, tierCap: 3, tier: 2 });
  expect(r.buffs.campMult).toBe(1.2);
});

test("強化格效果池：50% 給 nextShootMult=2、50% 給多骰（mock Math.random 鎖定）", () => {
  const real = Math.random;
  try {
    let calls = 0;
    Math.random = () => (calls++ === 0 ? 0.2 : 0.5);   // r2<0.5 → 下箭 ×2
    const r = rollTileReward("empower", { mode, tierCap: 3, tier: 2 });
    expect(r.nextShootMult).toBe(2);
  } finally {
    Math.random = real;
  }
});

test("貓夥伴格設定 catmate buff", () => {
  const r = rollTileReward("catmate", { mode, tierCap: 3, tier: 2 });
  expect(r.buffs.catmate).toBe(true);
});

test("陷阱格是多種事件：一定帶 type/icon/label 與 back，且至少一種懲罰", () => {
  const seen = new Set();
  for (let i = 0; i < 80; i += 1) {
    const r = rollTileReward("trap", { mode, tierCap: 3, tier: 3 });
    expect(r.trapType).toBeTruthy();
    expect(TRAP_EVENTS.some(e => e.type === r.trapType)).toBe(true);
    expect(r.icon).toBeTruthy();
    expect(r.label).toBeTruthy();
    expect(r.back).toBeGreaterThanOrEqual(1);
    expect(r.back).toBeLessThanOrEqual(3);
    // 至少一種懲罰：金幣 / 箭露 / 骰子
    expect(r.loseCoins > 0 || r.loseArrowdew > 0 || r.loseDice > 0).toBe(true);
    seen.add(r.trapType);
  }
  // 隨機性：抽 80 次要能見到至少 4 種不同事件（不是永遠同一種）
  expect(seen.size).toBeGreaterThanOrEqual(4);
});

test("trapEffectOf 依型別回傳一致懲罰（back 固定、金額隨 tier 放大）", () => {
  const snake = trapEffectOf("snake", 1);
  expect(snake.type).toBe("snake");
  expect(snake.back).toBe(1);
  expect(snake.loseCoins).toBeGreaterThan(0);
  expect(snake.loseArrowdew).toBeFalsy();
  const quicksand = trapEffectOf("quicksand", 3);
  expect(quicksand.back).toBe(3);
  expect(quicksand.loseArrowdew).toBeGreaterThan(0);
  const diceEv = trapEffectOf("dice", 2);
  expect(diceEv.loseDice).toBe(1);
  // tier 越高金額越高（同型別比較）
  expect(trapEffectOf("thief", 3).loseCoins).toBeGreaterThan(trapEffectOf("thief", 1).loseCoins);
});

test("rollTrapEvent 回傳合法事件", () => {
  const ev = rollTrapEvent(2);
  expect(TRAP_EVENTS.some(e => e.type === ev.type)).toBe(true);
  expect(ev.back).toBeGreaterThanOrEqual(1);
});

test("捷徑格前進 3~5 格", () => {
  const jumps = new Set();
  for (let i = 0; i < 60; i += 1) {
    const r = rollTileReward("shortcut", { mode, tierCap: 3, tier: 2 });
    expect(r.jumpAhead).toBeGreaterThanOrEqual(3);
    expect(r.jumpAhead).toBeLessThanOrEqual(5);
    jumps.add(r.jumpAhead);
  }
  expect([...jumps].sort()).toEqual([3, 4, 5]);
});

test("市集格第一期佔位：整修中標記＋小機率金幣", () => {
  let gotCoins = false;
  for (let i = 0; i < 60; i += 1) {
    const r = rollTileReward("market", { mode, tierCap: 3, tier: 2 });
    expect(r.marketPlaceholder).toBe(true);
    expect(r.coins).toBeGreaterThanOrEqual(0);
    if (r.coins > 0) gotCoins = true;
  }
  expect(gotCoins).toBe(true);
});

test("風景格純 flavor＋微獎勵 1~5 金幣", () => {
  for (let i = 0; i < 40; i += 1) {
    const r = rollTileReward("scenery", { mode, tierCap: 3, tier: 2 });
    expect(r.scenery).toBe(true);
    expect(r.coins).toBeGreaterThanOrEqual(1);
    expect(r.coins).toBeLessThanOrEqual(5);
  }
});

test("終點 Boss：按完成度分帶給獎，S 級獎勵最大且有額外寶箱", () => {
  const s = rollTileReward("boss", { mode, tierCap: 3, tier: 3, scoreRatio: 0.9 });
  const c = rollTileReward("boss", { mode, tierCap: 3, tier: 3, scoreRatio: 0.1 });
  expect(s.band).toBe("S");
  expect(c.band).toBe("C");
  expect(s.boss).toBe(true);
  expect(s.coins).toBeGreaterThan(c.coins);
  expect(s.arrowdew).toBeGreaterThan(c.arrowdew);
  expect(s.chests.length).toBeGreaterThan(c.chests.length);
});

test("終點 Boss：S 級多送一個通用寶箱，其他分帶只有族系箱", () => {
  for (const ratio of [0.9, 0.7, 0.5, 0.2]) {
    const r = rollTileReward("boss", { mode, tierCap: 3, tier: 3, scoreRatio: ratio });
    expect(r.chests[0].kind).toBe("family");
    if (r.band === "S") expect(r.chests[1]?.kind).toBe("universal");
    else expect(r.chests.length).toBe(1);
  }
});

// ── 統一獎勵分層（2026-08-07 重新規劃）──────────────────
// 怪物格不再「過/不過」二階，改 S/A/B/C 四階；分帶表必須單調遞減。

test("MONSTER_BAND_TABLE 分層單調遞減（S > A > B > C）", () => {
  const order = ["S", "A", "B", "C"];
  for (let i = 1; i < order.length; i += 1) {
    const hi = MONSTER_BAND_TABLE[order[i - 1]];
    const lo = MONSTER_BAND_TABLE[order[i]];
    expect(hi.mult).toBeGreaterThan(lo.mult);
    expect(hi.mats).toBeGreaterThan(lo.mats);
    expect(hi.chest).toBeGreaterThan(lo.chest);
  }
});

test("怪物格：分帶標籤與素材數逐階遞減（S4/A3/B2/C1）", () => {
  const mode = { family: "spirit", resource: "fish" };
  const bands = [["S", 0.9, 4], ["A", 0.7, 3], ["B", 0.5, 2], ["C", 0.2, 1]];
  for (const [band, ratio, mats] of bands) {
    const r = rollTileReward("monster", { mode, tierCap: 3, tier: 3, scoreRatio: ratio });
    expect(r.band).toBe(band);
    const total = Object.values(r.familyMaterials).reduce((s, n) => s + n, 0);
    expect(total).toBe(mats);
    expect(r.passed).toBe(band !== "C");
  }
});

test("怪物格：高階分帶資源期望值 >= 低階（重複擲取平均驗證）", () => {
  const mode = { family: "beast", resource: "meat" };
  const avg = ratio => {
    let sum = 0;
    for (let i = 0; i < 400; i += 1) {
      sum += rollTileReward("monster", { mode, tierCap: 2, tier: 2, scoreRatio: ratio }).villageResources.meat || 0;
    }
    return sum / 400;
  };
  const sAvg = avg(0.9), cAvg = avg(0.2);
  expect(sAvg).toBeGreaterThan(cAvg);
});

test("採集分層：進度越高倍率越高且標籤正確", () => {
  expect(miningBandFor(180).label).toBe("大豐收");
  expect(miningBandFor(140).label).toBe("豐收");
  expect(miningBandFor(100).label).toBe("完成");
  expect(miningBandFor(70).label).toBe("半成品");
  expect(miningBandFor(30).label).toBe("安慰獎");
  expect(miningBandFor(200).mult).toBeGreaterThanOrEqual(miningBandFor(90).mult);
  expect(miningBandFor(90).mult).toBeGreaterThan(miningBandFor(10).mult);
});

test("強化格效果池：50% 下箭×2、25% 2 骰、25% 3 骰（mock Math.random 鎖定）", () => {
  const mode = BOARD_MODES.find(m => m.id === "mine");
  const real = Math.random;
  try {
    // 效果池用第一個 random 呼叫（r2），後續 random 不影響 diceCount 判定
    let calls = 0;
    Math.random = () => (calls++ === 0 ? 0.2 : 0.5);   // r2=0.2 → 下箭 ×2
    const a = rollTileReward("empower", { mode, tierCap: 3, tier: 3 });
    expect(a.nextShootMult).toBe(2);
    expect(a.diceCount).toBeUndefined();

    calls = 0;
    Math.random = () => (calls++ === 0 ? 0.6 : 0.5);   // r2=0.6 → 2 骰
    const b = rollTileReward("empower", { mode, tierCap: 3, tier: 3 });
    expect(b.diceCount).toBe(2);
    expect(b.nextShootMult).toBeUndefined();

    calls = 0;
    Math.random = () => (calls++ === 0 ? 0.9 : 0.5);   // r2=0.9 → 3 骰
    const c = rollTileReward("empower", { mode, tierCap: 3, tier: 3 });
    expect(c.diceCount).toBe(3);
    expect(c.nextShootMult).toBeUndefined();
  } finally {
    Math.random = real;
  }
});

test("bossDuelState：血條 = 100−完成度%、S 帶倒下、與 scoreToBand 同一張分帶表", () => {
  expect(bossDuelState(60)).toEqual({ ratio: 1, band: "S", hpLeft: 0, downed: true });       // 全 X：Boss 倒下
  expect(bossDuelState(51)).toMatchObject({ band: "S", downed: true, hpLeft: 15 });          // 51/60=85% → S
  expect(bossDuelState(42)).toMatchObject({ band: "A", downed: false });                     // 70% → A
  expect(bossDuelState(30)).toMatchObject({ band: "B" });                                    // 50% → B
  expect(bossDuelState(12)).toMatchObject({ band: "C", hpLeft: 80 });                        // 20% → C，血條剩 80
  expect(bossDuelState(0)).toEqual({ ratio: 0, band: "C", hpLeft: 100, downed: false });
  // 防呆：超界夾在 0~1
  expect(bossDuelState(999)).toMatchObject({ ratio: 1, hpLeft: 0 });
  expect(bossDuelState(-5)).toMatchObject({ ratio: 0, hpLeft: 100 });
});
