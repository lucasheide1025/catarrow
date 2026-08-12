import fs from "fs";
import path from "path";

const read = relative => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

test("team journey persists authoritative host dice when the room becomes active", () => {
  const source = read("src/lib/villageBoardTeamDb.js");
  const startRoom = source.slice(source.indexOf("export async function startBoardRoom"), source.indexOf("function landingPatch"));

  expect(startRoom).toMatch(/hostDiceLeft\s*:\s*norm\.dice/);
});

test("re-entered host uses the room dice snapshot instead of a zero-valued local bootstrap", () => {
  const source = read("src/components/member/CatVillageBoardTeam.jsx");

  expect(source).toMatch(/const effectiveHostDice\s*=\s*resolveTeamHostDice/);
  expect(source).not.toMatch(/if \(!isHost \|\| rolling \|\| hostDice <= 0\) return/);
  expect(source).not.toMatch(/const canRoll = isHost && !rolling && hostDice > 0/);
});
