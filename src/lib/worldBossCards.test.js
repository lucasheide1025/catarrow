import { WB_CARD_KEYS, WB_CARDS, resolveWorldBossCardEffects } from "./worldBossCards";
import { calcEquippedBonus } from "./monsterCards";
import { WB_FAMILY_TO_DUNGEON_FAMILY } from "./worldBossData";

test("all 26 stable world boss keys expose v2 effects and player text", () => {
  expect(WB_CARD_KEYS).toHaveLength(26);
  for (const key of WB_CARD_KEYS) {
    expect(WB_CARDS[key].version).toBe(2);
    expect(WB_CARDS[key].effects.length).toBeGreaterThan(0);
    expect(WB_CARDS[key].effectText).toBeTruthy();
  }
});

test("coach effects resolve authoritative pierce and three-round burn", () => {
  const head = resolveWorldBossCardEffects({ equippedCardKeys:["head_coach"] });
  expect(head.modifiers.damagePct).toBeCloseTo(.12);
  expect(head.modifiers.armorPiercePct).toBe(15);
  const yumi = resolveWorldBossCardEffects({ equippedCardKeys:["yumi"] });
  expect(yumi.modifiers.burn).toEqual({ chancePct:100, strengthPct:20, duration:3 });
});

test("family and boss effects activate only for their declared target", () => {
  expect(resolveWorldBossCardEffects({ equippedCardKeys:["ghost_boss_small"], enemyFamily:"ghost" }).modifiers.damagePct).toBeCloseTo(.12);
  expect(resolveWorldBossCardEffects({ equippedCardKeys:["ghost_boss_small"], enemyFamily:"mountain" }).modifiers.damagePct).toBe(0);
  expect(resolveWorldBossCardEffects({ equippedCardKeys:["cat_niuniu"], enemyClass:"boss" }).modifiers.damagePct).toBeCloseTo(.10);
  expect(resolveWorldBossCardEffects({ equippedCardKeys:["cat_niuniu"], enemyClass:"monster" }).modifiers.damagePct).toBe(0);
});

test("duplicate equipped keys never stack the same card twice", () => {
  expect(resolveWorldBossCardEffects({ equippedCardKeys:["wife", "wife"] }).modifiers.damagePct).toBeCloseTo(.10);
});

test("v2 stacking caps and positive reduction semantics are enforced", () => {
  const coaches = resolveWorldBossCardEffects({ equippedCardKeys:["head_coach", "wife", "yumi"] }).modifiers;
  expect(coaches.damagePct).toBeCloseTo(.25);
  expect(resolveWorldBossCardEffects({ equippedCardKeys:["cat_baobao"] }).modifiers.damageReducePct).toBeCloseTo(.04);
  expect(resolveWorldBossCardEffects({ equippedCardKeys:["cat_daming", "cat_gege", "cat_meimei"] }).modifiers.healPct).toBeLessThanOrEqual(.30);
});

test("v2 world boss cards never grant legacy panel stats or 3% passives", () => {
  expect(calcEquippedBonus([{ tier:"worldboss", stat:"atk", stars:5 }])).toMatchObject({ hp:0, atk:0, def:0, dmgBonusPct:0, dmgReducePct:0, healBonusPct:0 });
  expect(Object.values(WB_CARDS).every(card => !card.statLine.includes("+25"))).toBe(true);
  expect(Object.values(WB_CARDS).every(card => card.stat == null && card.statMode === "passive")).toBe(true);
});

test("all seven world-boss families map to canonical PvE family ids", () => {
  const canonical = new Set(["ghost", "mountain", "insect", "workplace", "exam", "temple","treasure"]);
  expect(["ghost", "forest", "poison", "office", "exam", "western","treasure"].map(key => WB_FAMILY_TO_DUNGEON_FAMILY[key]).every(value => canonical.has(value))).toBe(true);
});

test("family card descriptions use player-facing Chinese family names", () => {
  expect(WB_CARDS.forest_boss_small.effectText).toContain("山林族");
  expect(WB_CARDS.poison_boss.effectText).toContain("昆蟲族");
  expect(WB_CARDS.western_boss.effectText).toContain("神殿族");
});
