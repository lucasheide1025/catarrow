import fs from "fs";
import path from "path";

const rules = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf8");

test("member update rules allow cat card star progress", () => {
  const memberBlock = rules.slice(rules.indexOf("match /members/{memberId}"), rules.indexOf("match /competitions/"));
  expect((memberBlock.match(/"catCardStars"/g) || [])).toHaveLength(2);
});

test("cat subcollection accepts the same email ownership fallback as member profiles", () => {
  const start = rules.indexOf("match /members/{memberId}/cats/{catId}");
  const catBlock = rules.slice(start, rules.indexOf("match /guildQuests/", start));
  expect(catBlock).toContain("request.auth.token.email != null");
  expect(catBlock).toContain(".data.email == request.auth.token.email");
});
