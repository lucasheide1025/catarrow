// src/lib/cardTalents.test.js — 卡片天賦與族系套裝
import { EXPANSION_MONSTERS } from "./monsterExpansionCatalog";
import { getCardTalent, calcFamilySetStatus, calcCardCombatEffects, calcInflictFromViews, FAMILY_SET_BONUSES, TALENT_CAPS } from "./cardTalents";

const view = monster => ({ monsterId: monster.id, family: monster.family, tier: monster.tier, tierIndex: monster.tierIndex, source: "monster" });

test("252 張卡全部有天賦（零手工映射）", () => {
  for (const monster of EXPANSION_MONSTERS) {
    const talent = getCardTalent(view(monster));
    expect({ id: monster.id, ok: !!(talent && talent.key && talent.value > 0 && talent.text) })
      .toEqual({ id: monster.id, ok: true });
  }
});

test("天賦映射抽查：穿甲怪→穿甲天賦;Tier 放大", () => {
  const pierce = EXPANSION_MONSTERS.find(m => m.id === "ghost_t1_mini_a"); // 導光突進:無視防禦10%
  expect(getCardTalent(view(pierce)).key).toBe("armorPiercePct");
  const t1 = getCardTalent(view(EXPANSION_MONSTERS.find(m => m.id === "ghost_t1_normal_a")));
  const sameKindT6 = EXPANSION_MONSTERS.filter(m => m.tierIndex === 6).map(m => getCardTalent(view(m)));
  expect(sameKindT6.every(t => t.value >= t1.value)).toBe(true); // T6 天賦數值 ≥ T1
});

test("族系套裝 2/4 張觸發與彙總", () => {
  const ghosts = EXPANSION_MONSTERS.filter(m => m.family === "ghost").slice(0, 4).map(view);
  const two = calcFamilySetStatus(ghosts.slice(0, 2));
  expect(two[0]).toMatchObject({ family: "ghost", tier2: true, tier4: false });
  const four = calcCardCombatEffects(ghosts);
  expect(four.statusDurationReduction).toBe(FAMILY_SET_BONUSES.ghost.t2.statusDurationReduction);
  expect(four.statusStrengthReductionPct).toBe(FAMILY_SET_BONUSES.ghost.t4.statusStrengthReductionPct);
});

test("天賦彙總有 cap;世界王卡不參與", () => {
  const pierceCards = EXPANSION_MONSTERS
    .filter(m => (m.signatureSummary || "").includes("無視防禦")).slice(0, 12).map(view);
  const total = calcCardCombatEffects(pierceCards);
  // ⚠️ 不要寫死數字：調上限時測試不該跟著壞（這條就是這樣壞過一次）
  expect(total.armorPiercePct).toBeLessThanOrEqual(TALENT_CAPS.armorPiercePct);
  expect(getCardTalent({ source: "wb", tier: "worldboss", monsterId: "wb:x" })).toBeNull();
});

// ── ☠️ 淬毒／族系異常（2026-08-01 新增）────────────────────
test("⚠️ 每張卡都替自己的族系狀態貢獻觸發率——族系識別度的來源", () => {
  const bugs = EXPANSION_MONSTERS.filter(m => m.family === "insect").slice(0, 6).map(view);
  const inflict = calcInflictFromViews(bugs);
  expect(inflict.poison).toBeTruthy();
  expect(inflict.poison.chancePct).toBeGreaterThan(0);
  expect(inflict.poison.strength).toBeGreaterThan(0);
});

test("混編就是各種狀態各一點", () => {
  const mixed = [
    ...EXPANSION_MONSTERS.filter(m => m.family === "insect").slice(0, 2),
    ...EXPANSION_MONSTERS.filter(m => m.family === "temple").slice(0, 2),
  ].map(view);
  const inflict = calcInflictFromViews(mixed);
  expect(Object.keys(inflict).sort()).toEqual(["burn", "poison"]);
});

test("⚠️ 控場狀態的觸發率被壓在較低的上限——它最強", () => {
  const chests = EXPANSION_MONSTERS.filter(m => m.family === "treasure").slice(0, 10).map(view);
  const inflict = calcInflictFromViews(chests, 30);
  expect(inflict.freeze.chancePct).toBeLessThanOrEqual(12);
});

test("淬毒天賦是全域加碼，會讓族系狀態更容易觸發", () => {
  const bugs = EXPANSION_MONSTERS.filter(m => m.family === "insect").slice(0, 3).map(view);
  const plain = calcInflictFromViews(bugs, 0).poison.chancePct;
  const venom = calcInflictFromViews(bugs, 10).poison.chancePct;
  expect(venom).toBeGreaterThan(plain);
});

test("⚠️ 強度不隨張數成長，只有觸發率會——不然滿編毒隊變成傷害不是控場", () => {
  const few = EXPANSION_MONSTERS.filter(m => m.family === "insect").slice(0, 2).map(view);
  const many = EXPANSION_MONSTERS.filter(m => m.family === "insect").slice(0, 8).map(view);
  const a = calcInflictFromViews(few).poison;
  const b = calcInflictFromViews(many).poison;
  expect(b.chancePct).toBeGreaterThan(a.chancePct);
  expect(b.strength).toBe(a.strength);
});

test("戰鬥彙總會帶出 inflict，戰鬥端拿去 rollInflict", () => {
  const bugs = EXPANSION_MONSTERS.filter(m => m.family === "insect").slice(0, 4).map(view);
  expect(calcCardCombatEffects(bugs).inflict.poison).toBeTruthy();
});

test("⚠️ 拆開後每條規則有自己的鍵——不再 4 條擠 damagePct", () => {
  const keys = new Set();
  for (const monster of EXPANSION_MONSTERS) keys.add(getCardTalent(view(monster)).key);
  expect(keys.size).toBeGreaterThanOrEqual(8);
  expect(keys.has("venomPct") || keys.has("firstStrikePct") || keys.has("finisherPct")).toBe(true);
});
