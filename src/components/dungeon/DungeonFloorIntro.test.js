import { shouldUseShortDungeonIntro } from "./DungeonFloorIntro";

test("persisted expedition state selects the reconnect transition",()=>{
  expect(shouldUseShortDungeonIntro(true,false)).toBe(true);
  expect(shouldUseShortDungeonIntro(false,"1")).toBe(true);
  expect(shouldUseShortDungeonIntro(false,false)).toBe(false);
});

test("component keeps an explicit reduced-motion fallback contract",()=>{
  const source=require("fs").readFileSync(require.resolve("./DungeonFloorIntro"),"utf8");
  expect(source).toContain("prefers-reduced-motion:reduce");
  expect(source).toContain("animation-duration:.01ms");
});
