import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("every top-level member field written by a gacha draw is allowed by member rules", async () => {
  const [dbSource, rules] = await Promise.all([
    readFile("src/lib/db.js", "utf8"),
    readFile("firestore.rules", "utf8"),
  ]);

  const drawStart = dbSource.indexOf("export async function drawGachaCards");
  const drawEnd = dbSource.indexOf("export async function upgradeCatCard", drawStart);
  const drawSource = dbSource.slice(drawStart, drawEnd);
  const requiredFields = ["gachaCoins", "catCards", "villageCardAlbums", "updatedAt"];

  for (const field of requiredFields) {
    assert.match(drawSource, new RegExp(field), `drawGachaCards should still write ${field}`);
    const memberRules = rules.slice(
      rules.indexOf("match /members/{memberId}"),
      rules.indexOf("// seasons：", rules.indexOf("match /members/{memberId}")),
    );
    const allowCount = [...memberRules.matchAll(new RegExp(`["']${field}["']`, "g"))].length;
    assert.ok(
      allowCount >= 2,
      `both official and guest member update rules must allow gacha field ${field}`,
    );
  }
});
