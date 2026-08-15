import fs from "fs";
import path from "path";

test("team dungeon status rail has fixed height and never wraps the map downward", () => {
  const source = fs.readFileSync(path.join(__dirname, "DungeonStages.jsx"), "utf8");
  expect(source).toContain('data-dungeon-party-status-rail="true"');
  expect(source).toContain('height:48');
  expect(source).toContain('overflowX:"auto"');
  expect(source).not.toContain('gridTemplateColumns:"repeat(auto-fit,minmax(118px,1fr))"');
});
