const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

test("legacy party rooms without combatVersion remain writable", () => {
  const rules = fs.readFileSync(path.join(__dirname, "..", "..", "firestore.rules"), "utf8");
  const partyBlock = rules.match(/match \/partyRooms\/\{docId\} \{([\s\S]*?)\n    \}/)?.[1] || "";

  assert.match(partyBlock, /resource\.data\.get\("combatVersion", 1\) != 2/);
  assert.match(partyBlock, /request\.resource\.data\.get\("combatVersion", 1\) != 2/);
  assert.doesNotMatch(partyBlock, /resource\.data\.combatVersion/);
  assert.doesNotMatch(partyBlock, /request\.resource\.data\.combatVersion/);
});
