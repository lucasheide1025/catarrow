import { isMonsterExpansionEnabled, MONSTER_EXPANSION_FLAG_KEY } from "./monsterExpansionFeature";

test("monster expansion stays disabled unless the build explicitly enables it", () => {
  expect(process.env.REACT_APP_MONSTER_EXPANSION_V1).not.toBe("true");
  expect(isMonsterExpansionEnabled()).toBe(false);
  expect(MONSTER_EXPANSION_FLAG_KEY).toBe("monsterExpansionV1");
});
