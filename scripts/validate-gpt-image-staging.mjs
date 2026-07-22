import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const stagingRoot = path.resolve(repoRoot, ".staging", "image-generation");
const manifestArg = process.argv[2];

if (!manifestArg) {
  console.error("Usage: node scripts/validate-gpt-image-staging.mjs <manifest.json>");
  process.exit(2);
}

const manifestPath = path.resolve(repoRoot, manifestArg);
if (path.extname(manifestPath).toLowerCase() !== ".json") {
  throw new Error("Manifest must be a JSON file");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.provider !== "manual-codex-built-in-imagegen" || manifest.execution !== "interactive") {
  throw new Error("Manifest must declare the manual interactive provider boundary");
}
if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  throw new Error("Manifest must contain at least one asset");
}

const failures = [];
for (const asset of manifest.assets) {
  if (!asset.id || !asset.profile || !asset.output || !asset.prompt) {
    failures.push(`${asset.id || "<unknown>"}: missing id/profile/output/prompt`);
    continue;
  }
  const outputPath = path.resolve(path.dirname(manifestPath), asset.output);
  const relative = path.relative(stagingRoot, outputPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    failures.push(`${asset.id}: output escapes .staging/image-generation`);
    continue;
  }
  try {
    const bytes = await readFile(outputPath);
    const info = await stat(outputPath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (asset.bytes !== info.size) failures.push(`${asset.id}: byte count mismatch`);
    if (asset.sha256 !== sha256) failures.push(`${asset.id}: SHA-256 mismatch`);
  } catch (error) {
    failures.push(`${asset.id}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Validated ${manifest.assets.length} staged GPT asset(s); no runtime provider was invoked.`);
