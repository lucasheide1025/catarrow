import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "functions", "data");
fs.mkdirSync(outputDir, { recursive:true });
fs.copyFileSync(path.join(root, "src", "data", "monsterExpansionCatalog.json"), path.join(outputDir, "monsterExpansionCatalog.json"));

const collectibleSource = fs.readFileSync(path.join(root, "src", "lib", "dungeonCollectibles.js"), "utf8");
const match = collectibleSource.match(/export const FAMILY_COLLECTIBLES = (\{[\s\S]*?\n\});/);
if (!match) throw new Error("FAMILY_COLLECTIBLES_not_found");
const familyCollectibles = vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout:1000 });
const ids = Object.fromEntries(Object.entries(familyCollectibles).map(([family, pools]) => [family,
  Object.fromEntries(["common", "rare", "boss"].map(rarity => [rarity, (pools[rarity] || []).map(item => item.id)])),
]));
fs.writeFileSync(path.join(outputDir, "dungeonCollectibleIds.json"), `${JSON.stringify(ids, null, 2)}\n`);
