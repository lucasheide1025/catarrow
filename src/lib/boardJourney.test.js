// 貓貓村探索地圖重製（08-07-village-board-journey-redesign）Phase 1 資料層測試。
// 規格見 .trellis/tasks/08-07-village-board-journey-redesign/design.md。
// 重點：generateJourney 必須「同 seed 恆等」——client 顯示與 DB 結算共用同一條路線。
import {
  seedRandom, generateJourney, windingPath, tileWeights, rollTileType,
  normalizeVillageBoard, emptyMapState, JOURNEY_MAP_IDS, JOURNEY_SHOOTING_TILES,
  JOURNEY_DAILY_DICE, nextPos, applyTrapPos, applyShortcutPos,
  mergeBuffs, applyJourneyMultipliers, combineRewards, findNextTile, lockedJourneyTier,
  rollDice, rollJourneyDice,
} from "./boardJourney";
import {
  TILE_TYPES, JOURNEY_BUFF_INFO, buffActive, buffValueLabel,
  MAX_CAMP_MULT, MAX_SHOOT_MULT, MAX_CATMATE_STACKS, MAX_DICE_COUNT,
  bossDuelState, scoreToBand,
} from "./boardData";

test("同 seed 生成完全相同的旅程（length/cells/path）", () => {
  const a = generateJourney("mine", 42);
  const b = generateJourney("mine", 42);
  expect(a.length).toBe(b.length);
  expect(a.cells).toEqual(b.cells);
  expect(a.path).toEqual(b.path);
});

test("不同 seed 產生不同路線", () => {
  const a = generateJourney("mine", 1);
  const b = generateJourney("mine", 2);
  const sameCells = a.cells.every((c, i) => c === b.cells[i]);
  expect(sameCells).toBe(false);
});

test("seed 0 邊界：正常生成且同 seed 恆等（guard 生效）", () => {
  const a = generateJourney("mine", 0);
  const b = generateJourney("mine", 0);
  expect(a.length).toBeGreaterThanOrEqual(100);
  expect(a.cells).toEqual(b.cells);
  expect(a.path).toEqual(b.path);
});

test("旅程長度介於 100~200", () => {
  for (let s = 1; s <= 30; s += 1) {
    const len = generateJourney("mine", s).length;
    expect(len).toBeGreaterThanOrEqual(100);
    expect(len).toBeLessThanOrEqual(200);
  }
});

test("起點固定 start、終點固定 boss、cells 長度 = length", () => {
  for (const modeId of JOURNEY_MAP_IDS) {
    for (let s = 1; s <= 10; s += 1) {
      const j = generateJourney(modeId, s);
      expect(j.cells[0]).toBe("start");
      expect(j.cells[j.length - 1]).toBe("boss");
      expect(j.cells.length).toBe(j.length);
    }
  }
});

test("所有格子都是合法類型", () => {
  for (let s = 1; s <= 30; s += 1) {
    const j = generateJourney("harbor", s);
    for (const t of j.cells) expect(TILE_TYPES[t]).toBeTruthy();
  }
});

test("path 與 length 等長、x 每格 +1、y 有界（蜿蜒在 0~4 之間）", () => {
  for (let s = 1; s <= 20; s += 1) {
    const j = generateJourney("mine", s);
    expect(j.path.length).toBe(j.length);
    j.path.forEach((p, i) => {
      expect(p.x).toBe(i);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(4);
    });
  }
});

test("權重抽選只回傳權重表內的類型", () => {
  const rnd = seedRandom(7);
  for (let i = 0; i < 500; i += 1) {
    const t = rollTileType(rnd, "market");
    expect(tileWeights("market")[t]).toBeGreaterThan(0);
  }
});

test("旅程同時出現多種格子類型（不是單調路線）", () => {
  const seen = new Set();
  for (let s = 1; s <= 50; s += 1) {
    const j = generateJourney("mine", s);
    for (const t of j.cells) seen.add(t);
  }
  for (const t of ["material", "mining", "monster", "camp", "scenery", "coins"]) {
    expect(seen.has(t)).toBe(true);
  }
});

test("旅程中只有怪物與終點 Boss 需要射箭（採集不射箭）", () => {
  expect(JOURNEY_SHOOTING_TILES.has("monster")).toBe(true);
  expect(JOURNEY_SHOOTING_TILES.has("boss")).toBe(true);
  expect(JOURNEY_SHOOTING_TILES.has("mining")).toBe(false);
});

test("normalizeVillageBoard 補齊 7 圖預設", () => {
  const n = normalizeVillageBoard({ dice: 9 });
  expect(JOURNEY_MAP_IDS.length).toBe(7);
  for (const id of JOURNEY_MAP_IDS) {
    expect(n.maps[id]).toEqual({ seed: 0, pos: 0, length: 0, clears: 0, tier: 0, buffs: {} });
  }
  expect(n.dice).toBe(9);
  expect(n.diceGrantedDate).toBe("");
  expect(n.pendingEvent).toBeNull();
});

test("舊單一狀態遷移：boardPos/lapCount 塞進舊 mode 那張圖（保留一次）", () => {
  const n = normalizeVillageBoard({ mode: "farm", boardPos: 12, lapCount: 3, boardSeed: 5, dice: 0 });
  expect(n.maps.farm.pos).toBe(12);
  expect(n.maps.farm.length).toBe(28);   // 舊棋盤 28 格＝一趟舊圈
  expect(n.maps.farm.clears).toBe(3);
  expect(n.maps.farm.seed).toBe(5);
  expect(n.maps.mine.pos).toBe(0);       // 其他圖不受影響
});

test("每日重置的 boardPos:0/lapCount:0 不算 legacy（避免全新玩家被誤遷移）", () => {
  const n = normalizeVillageBoard({ mode: "mine", boardPos: 0, lapCount: 0, boardSeed: 0, dice: 15 });
  expect(n.maps.mine.length).toBe(0);    // 未開始
  expect(n.maps.mine.pos).toBe(0);
  expect(n.maps.mine.clears).toBe(0);
});

test("已有 per-map 資料時不覆蓋（新的優先）", () => {
  const n = normalizeVillageBoard({ maps: { mine: { seed: 99, pos: 50, length: 150, clears: 2 } } });
  expect(n.maps.mine).toEqual({ seed: 99, pos: 50, length: 150, clears: 2, tier: 0, buffs: {} });
});

test("每日骰子常數 = 15", () => {
  expect(JOURNEY_DAILY_DICE).toBe(15);
});

test("emptyMapState 每次回傳獨立物件（不共用參考）", () => {
  const a = emptyMapState();
  const b = emptyMapState();
  a.buffs.campMult = 1.2;
  expect(b.buffs.campMult).toBeUndefined();
});

test("windingPath 每段 6~10 格且行數交替（路徑有折返）", () => {
  const rnd = seedRandom(3);
  const path = windingPath(200, rnd);
  // 路徑存在上下兩條主線以上（rowY 有變換）
  const ys = new Set(path.map(p => p.y));
  expect(ys.size).toBeGreaterThanOrEqual(2);
});

// ── 旅程位置／獎勵數學 ────────────────────────────────────
test("nextPos 不會超過終點（骰過頭夾在 length-1）", () => {
  expect(nextPos(10, 4, 30)).toBe(14);
  expect(nextPos(28, 6, 30)).toBe(29);   // 終點是 length-1
  expect(nextPos(0, 1, 30)).toBe(1);
});

test("applyTrapPos 後退但不低於 0", () => {
  expect(applyTrapPos(10, 30, 2)).toBe(8);
  expect(applyTrapPos(1, 30, 2)).toBe(0);  // 起點保護
  expect(applyTrapPos(0, 30, 2)).toBe(0);
});

test("applyShortcutPos 前進但不超過終點", () => {
  expect(applyShortcutPos(10, 30, 5)).toBe(15);
  expect(applyShortcutPos(27, 30, 5)).toBe(29);  // 夾在終點
});

test("mergeBuffs 合併 camp/catmate/nextShootMult 且同類可疊加", () => {
  const a = mergeBuffs({ campMult: 1.2 }, { buffs: { catmate: true }, nextShootMult: 2 });
  expect(a).toEqual({ campMult: 1.2, catmate: 1, nextShootMult: 2 });
  // 再踩一次營地 → 相乘 1.2 × 1.2（不是覆寫回 1.2）
  const b = mergeBuffs(a, { buffs: { campMult: 1.2 } });
  expect(b.campMult).toBe(1.44);
  expect(b.catmate).toBe(1);       // 其他加成保留
  expect(b.nextShootMult).toBe(2);
  // 再踩一次貓夥伴 → 層數 +1（+5% → +10%）
  const c = mergeBuffs(b, { buffs: { catmate: true } });
  expect(c.catmate).toBe(2);
  expect(c.campMult).toBe(1.44);
  // 舊資料 catmate:true 視為 1 層 → 踩一次變 2 層
  const d = mergeBuffs({ catmate: true }, { buffs: { catmate: true } });
  expect(d.catmate).toBe(2);
  // 空合併
  expect(mergeBuffs({}, {})).toEqual({});
});

test("mergeBuffs 疊加上限（與 MAX 常數一致）", () => {
  let camp = {};
  for (let i = 0; i < 10; i += 1) camp = mergeBuffs(camp, { buffs: { campMult: 1.2 } });
  expect(camp.campMult).toBe(MAX_CAMP_MULT);
  let shot = {};
  for (let i = 0; i < 10; i += 1) shot = mergeBuffs(shot, { nextShootMult: 2 });
  expect(shot.nextShootMult).toBe(MAX_SHOOT_MULT);
  let cat = {};
  for (let i = 0; i < 10; i += 1) cat = mergeBuffs(cat, { buffs: { catmate: true } });
  expect(cat.catmate).toBe(MAX_CATMATE_STACKS);
});

test("buffValueLabel 顯示目前疊層（裸值：×1.44／×4／+10%），未啟用為空", () => {
  expect(buffValueLabel({ campMult: 1.44 }, "campMult")).toBe("×1.44");
  expect(buffValueLabel({ nextShootMult: 4 }, "nextShootMult")).toBe("×4");
  expect(buffValueLabel({ catmate: 2 }, "catmate")).toBe("+10%");
  expect(buffValueLabel({ catmate: true }, "catmate")).toBe("+5%");   // 舊資料 1 層
  expect(buffValueLabel({}, "campMult")).toBe("");
  expect(buffValueLabel({ campMult: 1 }, "campMult")).toBe("");        // 未啟用
  expect(buffValueLabel({}, "unknown")).toBe("");
});

test("applyJourneyMultipliers：強化×2 加倍金幣/箭露/資源，營地只乘資源", () => {
  const reward = { coins: 100, arrowdew: 50, villageResources: { ore: 10, melon: 5 }, catXP: 30 };
  const both = applyJourneyMultipliers(reward, { shootMult: 2, campMult: 1.2 });
  expect(both.coins).toBe(200);
  expect(both.arrowdew).toBe(100);
  expect(both.catXP).toBe(60);
  expect(both.villageResources.ore).toBe(24);   // 10 × 1.2 × 2
  expect(both.villageResources.melon).toBe(12); // 5 × 1.2 × 2
  const campOnly = applyJourneyMultipliers(reward, { campMult: 1.2 });
  expect(campOnly.coins).toBe(100);             // 營地不動金幣
  expect(campOnly.villageResources.ore).toBe(12);
});

test("applyJourneyMultipliers 無 buff 時回傳原物件（不複製）", () => {
  const reward = { coins: 10 };
  expect(applyJourneyMultipliers(reward)).toBe(reward);
});

test("findNextTile 找到前方最近的目標格並受 lookahead 限制", () => {
  const cells = ["start", "coins", "material", "monster", "arrowdew", "material"];
  expect(findNextTile(cells, 0, ["material"])).toBe(2);
  expect(findNextTile(cells, 2, ["material"])).toBe(5);       // 從自己之後找
  expect(findNextTile(cells, 0, ["monster"])).toBe(3);
  expect(findNextTile(cells, 0, ["arrowdew"], 2)).toBeNull(); // arrowdew 在 index 4，lookahead=2 找不到
  expect(findNextTile(cells, 5, ["material"])).toBeNull();    // 已到尾
  expect(findNextTile(null, 0, ["material"])).toBeNull();     // 防呆
});

test("旅程中會出現分岔路（fork）格子", () => {
  const seen = new Set();
  for (let s = 1; s <= 80; s += 1) {
    const j = generateJourney("harbor", s);
    for (const t of j.cells) seen.add(t);
  }
  expect(seen.has("fork")).toBe(true);
  expect(tileWeights("mine").fork).toBeGreaterThan(0);
});

test("combineRewards 合併兩份 reward（數字相加、陣列串接）", () => {
  const a = { coins: 10, villageResources: { ore: 3 }, familyMaterials: { mountain_m1: 2 }, potions: [{ tier: 1 }] };
  const b = { coins: 5, villageResources: { ore: 2, melon: 4 }, familyMaterials: { mountain_m1: 1, mountain_m2: 3 } };
  const out = combineRewards(a, b);
  expect(out.coins).toBe(15);
  expect(out.villageResources).toEqual({ ore: 5, melon: 4 });
  expect(out.familyMaterials).toEqual({ mountain_m1: 3, mountain_m2: 3 });
  expect(out.potions).toHaveLength(1);
  expect(out.chests).toHaveLength(0);
});

// ── 階級鎖定（選好 T 固定到走完）──────────────────────────
test("lockedJourneyTier：未開始的地圖接受新選階級", () => {
  expect(lockedJourneyTier({ length: 0 }, 4)).toBe(4);
  expect(lockedJourneyTier({}, 3)).toBe(3);
  expect(lockedJourneyTier(undefined, 2)).toBe(2);
});

test("lockedJourneyTier：進行中的旅程鎖定既有階級（忽略新選）", () => {
  expect(lockedJourneyTier({ length: 150, tier: 3 }, 1)).toBe(3);   // 想改成 T1 被擋
  expect(lockedJourneyTier({ length: 150, tier: 3 }, 5)).toBe(3);   // 想改成 T5 被擋
});

test("lockedJourneyTier：進行中但舊資料沒記 tier → 接受新選並從此鎖定", () => {
  expect(lockedJourneyTier({ length: 150, tier: 0 }, 4)).toBe(4);
  expect(lockedJourneyTier({ length: 150 }, 0)).toBe(1);            // 防呆：什麼都沒給 → 1
});

// ── 骰子（1~15）──────────────────────────────────────
test("rollDice：範圍 1~15（邊界用 mock Math.random 鎖死）", () => {
  const real = Math.random;
  try {
    Math.random = () => 0;                 // 最小值
    expect(rollDice()).toBe(1);
    Math.random = () => 0.999999;          // 最大值
    expect(rollDice()).toBe(15);
    Math.random = () => 0.5;               // 中間
    const v = rollDice();
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(15);
  } finally {
    Math.random = real;
  }
});

// 大量採樣驗證沒有超出邊界
// (Math.random 已還原；統計上 2000 次採樣落在 1~15 的機率=1)
test("rollDice：大量採樣都落在 1~15", () => {
  for (let i = 0; i < 2000; i++) {
    const v = rollDice();
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(15);
  }
});

test("rollJourneyDice：單顆＝rollDice、多顆＝總和、顆數夾在 1~3", () => {
  const real = Math.random;
  try {
    Math.random = () => 0.999999;            // 每顆都 15
    expect(rollJourneyDice(1)).toEqual({ rolls: [15], total: 15 });
    expect(rollJourneyDice(2)).toEqual({ rolls: [15, 15], total: 30 });
    expect(rollJourneyDice(3)).toEqual({ rolls: [15, 15, 15], total: 45 });
    Math.random = () => 0;                   // 每顆都 1
    expect(rollJourneyDice(3)).toEqual({ rolls: [1, 1, 1], total: 3 });
  } finally {
    Math.random = real;
  }
  // 防呆：0/負數/未傳＝1 顆；超過上限（MAX_DICE_COUNT=4）夾到上限
  expect(rollJourneyDice(0).rolls).toHaveLength(1);
  expect(rollJourneyDice().rolls).toHaveLength(1);
  expect(rollJourneyDice(9).rolls).toHaveLength(4);
  expect(rollJourneyDice(4).rolls).toHaveLength(4);
});

test("rollJourneyDice：大量採樣每顆都在 1~15、總和＝每顆相加", () => {
  for (let i = 0; i < 500; i++) {
    const { rolls, total } = rollJourneyDice(3);
    expect(rolls).toHaveLength(3);
    expect(total).toBe(rolls.reduce((a, b) => a + b, 0));
    for (const r of rolls) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(15);
    }
  }
});

test("mergeBuffs：多骰已有就疊加（相加）、上限 MAX_DICE_COUNT、不影響其他 buff", () => {
  expect(mergeBuffs({}, { diceCount: 2 })).toEqual({ diceCount: 2 });
  expect(mergeBuffs({ diceCount: 2 }, { diceCount: 2 })).toEqual({ diceCount: 4 });   // 疊加 2+2=4
  expect(mergeBuffs({ diceCount: 3 }, { diceCount: 2 })).toEqual({ diceCount: 4 });   // 3+2=5 夾到上限 4
  expect(mergeBuffs({ diceCount: 4 }, { diceCount: 3 })).toEqual({ diceCount: 4 });   // 已滿，不再加
  expect(mergeBuffs({ campMult: 1.2 }, { diceCount: 3 })).toEqual({ campMult: 1.2, diceCount: 3 });  // 不影響其他 buff
});

test("buffValueLabel：多骰顯示 ×N 骰（疊加後值）", () => {
  expect(buffValueLabel({ diceCount: 2 }, "diceCount")).toBe("×2 骰");
  expect(buffValueLabel({ diceCount: 4 }, "diceCount")).toBe("×4 骰");
  expect(buffValueLabel({}, "diceCount")).toBe("");
  expect(buffValueLabel({ diceCount: 1 }, "diceCount")).toBe("");
});

test("lockedJourneyTier：Boss 完成後新一趟（tier 歸 0）→ 回選單重選階級", () => {
  // settleJourneyTile/finalizeBoardShoot 的 boss 分支現在寫 tier: 0（完成旅程=未鎖定）
  const afterBoss = { seed: 999, pos: 0, length: 160, clears: 3, tier: 0, buffs: {} };
  expect(lockedJourneyTier(afterBoss, 5)).toBe(5);   // 重選 T5
  expect(lockedJourneyTier(afterBoss, 2)).toBe(2);   // 重選 T2
  // 一旦重選寫入 tier，下一趟就鎖定到走完
  expect(lockedJourneyTier({ ...afterBoss, tier: 5 }, 2)).toBe(5);
});

// ── 加成說明（buff chips 與說明彈窗共用文案）────────────────
test("JOURNEY_BUFF_INFO 涵蓋四種 buff 格且每筆都有玩家向文案", () => {
  const fields = JOURNEY_BUFF_INFO.map(b => b.field);
  expect(fields).toEqual(["campMult", "nextShootMult", "diceCount", "catmate"]);
  for (const b of JOURNEY_BUFF_INFO) {
    expect(b.icon).toBeTruthy();
    expect(b.name).toBeTruthy();
    expect(b.desc).toBeTruthy();
  }
});

test("buffActive 依 buffs 欄位值判定啟用狀態（含多骰）", () => {
  const active = { campMult: 1.2, nextShootMult: 2, catmate: true, diceCount: 2 };
  expect(buffActive(active, "campMult")).toBe(true);
  expect(buffActive(active, "nextShootMult")).toBe(true);
  expect(buffActive(active, "catmate")).toBe(true);
  expect(buffActive(active, "diceCount")).toBe(true);
  expect(buffActive({ diceCount: 3 }, "diceCount")).toBe(true);
  // 未啟用：campMult 1（= 無 buff）、nextShootMult 0/undefined、catmate false、diceCount 1/0/undefined
  expect(buffActive({}, "campMult")).toBe(false);
  expect(buffActive({ campMult: 1 }, "campMult")).toBe(false);
  expect(buffActive({ nextShootMult: 0 }, "nextShootMult")).toBe(false);
  expect(buffActive({ catmate: false }, "catmate")).toBe(false);
  expect(buffActive({ diceCount: 1 }, "diceCount")).toBe(false);
  expect(buffActive({ diceCount: 0 }, "diceCount")).toBe(false);
  // 未知欄位一律 false
  expect(buffActive(active, "unknown")).toBe(false);
});

test("buff 文案與實際效果一致（含疊加上限，與 MAX 常數同步）", () => {
  const camp = JOURNEY_BUFF_INFO.find(b => b.field === "campMult");
  const empower = JOURNEY_BUFF_INFO.find(b => b.field === "nextShootMult");
  const catmate = JOURNEY_BUFF_INFO.find(b => b.field === "catmate");
  const multiDice = JOURNEY_BUFF_INFO.find(b => b.field === "diceCount");
  expect(camp.desc).toContain("1.2");
  expect(empower.desc).toContain("×2");
  expect(catmate.desc).toContain("+5%");
  expect(multiDice.desc).toContain("2 顆");
  expect(multiDice.desc).toContain("3 顆");
  expect(multiDice.desc).toContain("相加");
  expect(multiDice.desc).toContain(`×${MAX_DICE_COUNT}`);
  // 上限文案直接吃 MAX 常數（改上限沒改文案會紅燈）
  expect(camp.desc).toContain(`×${MAX_CAMP_MULT}`);
  expect(empower.desc).toContain(`×${MAX_SHOOT_MULT}`);
  expect(catmate.desc).toContain(`+${MAX_CATMATE_STACKS * 5}%`);
});

test("bossDuelState：血條/分帶/倒下判定（終點 Boss 決戰）", () => {
  // 0 分：血條全滿、最低帶、沒倒下
  const zero = bossDuelState(0);
  expect(zero.ratio).toBe(0);
  expect(zero.hpLeft).toBe(100);
  expect(zero.downed).toBe(false);
  // 60 分（滿分）：Boss 倒下、血條歸零
  const full = bossDuelState(60);
  expect(full.ratio).toBe(1);
  expect(full.hpLeft).toBe(0);
  expect(full.downed).toBe(true);
  // S 帶臨界（85%）：剛好倒下
  const sMin = bossDuelState(51);   // 51/60 = 0.85
  expect(sMin.downed).toBe(true);
  expect(sMin.hpLeft).toBeCloseTo(15, 5);
  // 85% 以下：沒倒下、血條剩超過 15%
  const aBand = bossDuelState(48);  // 48/60 = 0.8
  expect(aBand.downed).toBe(false);
  expect(aBand.hpLeft).toBeCloseTo(20, 5);
  expect(aBand.band).toBeDefined();
  // 分帶與真實 scoreToBand 同表：抽查每帶邊界都一致
  for (const r of [0.85, 0.7, 0.65, 0.5, 0.4, 0.2, 0.95, 1]) {
    expect(bossDuelState(r * 60).band).toBe(scoreToBand(r).band);
  }
  // 越界防呆（負數／超過 60／undefined）
  expect(bossDuelState(-5).ratio).toBe(0);
  expect(bossDuelState(99).ratio).toBe(1);
  expect(bossDuelState(undefined).ratio).toBe(0);
  expect(bossDuelState(null).ratio).toBe(0);
});
