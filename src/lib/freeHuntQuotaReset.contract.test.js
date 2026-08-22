import fs from "fs";
import path from "path";

const read = relativePath => fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");

test("admin quota reset API updates members.freeHuntUsage and preserves mode scope", () => {
  const source = read("db.js");
  expect(source).toContain("export async function resetFreeHuntQuota");
  expect(source).toContain("export async function resetAllFreeHuntQuotas");
  expect(source).toContain("freeHuntUsage:resetFreeHuntUsage");
  expect(source).toContain("scope !== FREE_HUNT_RESET_SCOPE.MULTI");
});

test("reset center exposes separate single, multi, and all actions", () => {
  const source = read("../components/admin/AdminResetCenter.jsx");
  expect(source).toContain("全員指定單怪重置");
  expect(source).toContain("全員複數怪重置");
  expect(source).toContain("全員狩獵全部重置");
  expect(source).toContain("handleResetMonsterOne(m.id, m.name || m.nickname, scope)");
});
