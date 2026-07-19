import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const taskDir = path.join(root, ".trellis/tasks/07-16-monster-specialization-expansion");
const rosterDraft = JSON.parse(fs.readFileSync(path.join(taskDir, "research/monster-roster-draft.json"), "utf8"));
const catalogText = fs.readFileSync(path.join(taskDir, "monster-catalog.md"), "utf8");
const skillText = fs.readFileSync(path.join(taskDir, "signature-skill-mappings.md"), "utf8");

const tierKeys = ["common", "rare", "elite", "fierce", "boss", "mythic"];
const roleByLabel = {
  "一般 0.8": "normalA",
  "一般 1.0": "normalExisting",
  "一般 1.2": "normalB",
  "小王 A": "miniA",
  "小王 B": "miniB",
  "大王": "boss",
};

function parseRows(text, matcher) {
  return text.split(/\r?\n/).map(matcher).filter(Boolean);
}

const monsterRows = parseRows(catalogText, line => {
  const match = line.match(/^\| T([1-6]) \| ([^|]+?) \| `([^`]+)` \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$/);
  if (!match) return null;
  const [, tierIndex, type, id, rawName, materialName, signatureName] = match;
  const role = roleByLabel[type.trim()];
  if (!role) throw new Error(`Unknown role label: ${type}`);
  return {
    tierIndex: Number(tierIndex),
    tier: tierKeys[Number(tierIndex) - 1],
    type: type.trim(),
    role,
    id,
    name: rawName.replace(/（[^）]+）$/, "").trim(),
    title: rawName.includes("（") ? rawName.match(/（([^）]+)）/)?.[1] || null : null,
    materialName: materialName.trim(),
    signatureName: signatureName.trim(),
  };
});

const skillRows = new Map(parseRows(skillText, line => {
  const match = line.match(/^\| `([^`]+)` \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$/);
  if (!match) return null;
  const [, monsterId, commonCell, effect, counter] = match;
  return [monsterId, {
    commonSkillIds: [...commonCell.matchAll(/`([^`]+)`/g)].map(item => item[1]),
    signatureSummary: effect.trim(),
    counterSummary: counter.trim(),
  }];
}));

if (monsterRows.length !== 252 || rosterDraft.length !== 252) {
  throw new Error(`Expected 252 rows, got catalog=${monsterRows.length}, draft=${rosterDraft.length}`);
}

const oldMaterialId = (family, tierIndex) => `${family}_m${tierIndex}`;
const output = monsterRows.map((row, index) => {
  const draft = rosterDraft[index];
  if (draft.family !== row.id.split("_")[0] || draft.tierIndex !== row.tierIndex) {
    throw new Error(`Draft order mismatch at ${index}: ${draft.id} vs ${row.id}`);
  }
  const skills = skillRows.get(row.id);
  if (!skills) throw new Error(`Missing skill mapping: ${row.id}`);
  const existingMaterial = row.role === "normalExisting" && row.id !== `treasure_${row.tierIndex}`;
  const materialId = existingMaterial
    ? oldMaterialId(draft.family, row.tierIndex)
    : `mat_${row.id}`;
  const encounter = row.role.startsWith("normal") ? "normal" : row.role.startsWith("mini") ? "miniBoss" : "boss";
  return {
    id: row.id,
    family: draft.family,
    tier: row.tier,
    tierIndex: row.tierIndex,
    encounter,
    role: row.role,
    name: row.name,
    title: row.title,
    hp: draft.hp,
    atk: draft.atk,
    def: draft.def,
    passive: row.id.endsWith("_real"),
    existing: draft.existing,
    signatureSkillId: `sig_${row.id}`,
    signatureName: row.signatureName,
    ...skills,
    material: {
      id: materialId,
      name: row.materialName,
      kind: encounter,
      convertible: encounter === "normal",
      upgradeCount: encounter === "normal" && row.tierIndex < 6 ? 5 : 0,
      upgradesToTier: encounter === "normal" && row.tierIndex < 6 ? row.tierIndex + 1 : null,
    },
    card: { id: row.id, artKey: row.id },
    artKey: row.id,
  };
});

const ids = output.map(item => item.id);
if (new Set(ids).size !== 252) throw new Error("Monster IDs are not unique");
if (new Set(output.map(item => item.material.id)).size !== 252) throw new Error("Material IDs are not unique");
if (new Set(output.map(item => item.signatureSkillId)).size !== 252) throw new Error("Signature IDs are not unique");
if (output.filter(item => item.encounter === "normal").length !== 126) throw new Error("Normal count mismatch");
if (output.filter(item => item.encounter === "miniBoss").length !== 84) throw new Error("Mini-boss count mismatch");
if (output.filter(item => item.encounter === "boss").length !== 42) throw new Error("Boss count mismatch");

const destination = path.join(root, "src/data/monsterExpansionCatalog.json");
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, `${JSON.stringify({ version: 1, monsters: output }, null, 2)}\n`, "utf8");
console.log(`Generated ${output.length} monsters -> ${path.relative(root, destination)}`);
