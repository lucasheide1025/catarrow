import { buildAdventurerCombatStats } from "./adventurerCombatStats";
import { archerLevelBonus, archerLevelFromXP } from "./archerLevel";
import { calcArcherStats } from "./monsterData";
import { calcEquippedBonus, resolveEquippedCards } from "./monsterCards";

test("multi hunt entry stats equal the character-sheet formula", () => {
  const member = { hp:120, maxHp:120, atk:17, def:12, archerXP:250, rpgEquip:{} };
  const cardData = { cards:{ c1:{ family:"workplace", tier:"rare", stars:2, chosenStat:"atk" } }, equipped:["c1"] };
  const sharedData = { cardData, certRecords:[], dexConfig:{}, dexGrants:[] };
  const actual = buildAdventurerCombatStats({ member, sharedData });
  const base = calcArcherStats({ member, certification:null, certRecords:[], dexStats:actual.dexStats });
  const level = archerLevelBonus(archerLevelFromXP(member.archerXP));
  const card = calcEquippedBonus(resolveEquippedCards(cardData));
  expect(actual).toMatchObject({ hp:base.hp + level.hp + card.hp, atk:base.atk + level.atk + card.atk, def:base.def + level.def + card.def });
  expect(actual.cards.effectVersion).toBe(2);
});
