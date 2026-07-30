import { DUNGEON_UI_ASSETS, preloadDungeonUiAssets } from "./dungeonAssetCache";

describe("dungeon UI asset cache", () => {
  test("preloads the reusable rest and merchant sprite sheets once", () => {
    expect(DUNGEON_UI_ASSETS).toEqual(expect.arrayContaining([
      "/ui/dungeon/rest-options-sheet.webp",
      "/ui/dungeon/merchant-types-sheet.webp",
    ]));
    const first = preloadDungeonUiAssets();
    const second = preloadDungeonUiAssets();
    expect(first).toBeInstanceOf(Promise);
    expect(second).toBe(first);
  });
});
