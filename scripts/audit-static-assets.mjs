#!/usr/bin/env node
/**
 * Read-only inventory of tracked deployment snapshots and public assets.
 * It never changes source assets. JSON is written only when --output is given.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const outputIndex = process.argv.indexOf("--output");
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
const imageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function trackedDeployFiles() {
  const raw = execFileSync("git", ["ls-files", "-z", "--", ".deploy-*"], { encoding: "utf8" });
  return raw.split("\0").filter(Boolean);
}

function topDirectory(file) {
  return file.split("/")[0];
}

async function sourceCorpus() {
  const roots = ["src", "scripts", "functions", "public/index.html", "package.json", "vercel.json", "firebase.json"];
  const files = [];
  for (const item of roots) {
    const absolute = path.join(root, item);
    try {
      const info = await stat(absolute);
      if (info.isDirectory()) files.push(...await walk(absolute));
      else files.push(absolute);
    } catch {}
  }
  const textExtensions = new Set([".css", ".html", ".js", ".jsx", ".json", ".mjs", ".ts", ".tsx"]);
  const documents = [];
  for (const file of files) {
    if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
    documents.push({ file: relative(file), text: await readFile(file, "utf8") });
  }
  return documents;
}

function generatorEvidence(assetPath) {
  if (assetPath.startsWith("public/assets/dungeon/")) return { status: "confirmed", source: "scripts/gen-dungeon-tiles.py or scripts/process-tile.py" };
  if (assetPath.startsWith("public/assets/zombie/map/")) return { status: "confirmed", source: "scripts/gen-zombie-map-tiles.py" };
  if (assetPath.startsWith("public/assets/zombie/")) return { status: "confirmed", source: "scripts/gen-zombie-images.py" };
  if (/^public\/village\/[^/]+\/stage-[1-3]\.png$/.test(assetPath)) return { status: "candidate", source: "scripts/generateVillageImages.js (Gemini filename contract; provenance not embedded)" };
  return { status: "unknown", source: null };
}

const deploy = [];
for (const file of trackedDeployFiles()) {
  const info = await stat(path.join(root, file));
  deploy.push({ path: file, bytes: info.size });
}

const corpus = await sourceCorpus();
const publicFiles = await walk(path.join(root, "public"));
const assets = [];
for (const absolute of publicFiles) {
  const assetPath = relative(absolute);
  const extension = path.extname(assetPath).toLowerCase();
  if (!imageExtensions.has(extension)) continue;
  const buffer = await readFile(absolute);
  let metadata = {};
  try {
    const result = await sharp(buffer, { animated: true }).metadata();
    metadata = { width: result.width ?? null, height: result.height ?? null, format: result.format ?? extension.slice(1), pages: result.pages ?? 1, hasAlpha: result.hasAlpha ?? null };
  } catch {
    metadata = { width: null, height: null, format: extension.slice(1), pages: null, hasAlpha: null };
  }
  const publicUrl = `/${assetPath.slice("public/".length)}`;
  const basename = path.basename(assetPath);
  const exact = corpus.filter(({ text }) => text.includes(publicUrl) || text.includes(assetPath.slice("public/".length))).map(({ file }) => file);
  const basenameMatches = exact.length ? [] : corpus.filter(({ text }) => text.includes(basename)).map(({ file }) => file);
  const reference = exact.length
    ? { status: "confirmed", evidence: exact.slice(0, 20) }
    : basenameMatches.length
      ? { status: "candidate", evidence: basenameMatches.slice(0, 20) }
      : { status: "unknown", evidence: [] };
  assets.push({ path: assetPath, bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex"), ...metadata, reference, generation: generatorEvidence(assetPath) });
}

const deployGroups = Object.values(deploy.reduce((groups, item) => {
  const key = topDirectory(item.path);
  groups[key] ??= { path: key, files: 0, bytes: 0 };
  groups[key].files += 1;
  groups[key].bytes += item.bytes;
  return groups;
}, {})).sort((a, b) => b.bytes - a.bytes);
const duplicateGroups = Object.values(assets.reduce((groups, item) => {
  groups[item.sha256] ??= [];
  groups[item.sha256].push(item.path);
  return groups;
}, {})).filter((paths) => paths.length > 1).sort((a, b) => b.length - a.length);
const formats = Object.values(assets.reduce((groups, item) => {
  groups[item.format] ??= { format: item.format, files: 0, bytes: 0 };
  groups[item.format].files += 1;
  groups[item.format].bytes += item.bytes;
  return groups;
}, {})).sort((a, b) => b.bytes - a.bytes);
const topFolders = Object.values(assets.reduce((groups, item) => {
  const segments = item.path.split("/");
  const key = segments.slice(0, Math.min(3, segments.length - 1)).join("/");
  groups[key] ??= { path: key, files: 0, bytes: 0 };
  groups[key].files += 1;
  groups[key].bytes += item.bytes;
  return groups;
}, {})).sort((a, b) => b.bytes - a.bytes);

const report = {
  generatedAt: new Date().toISOString(),
  method: {
    deploy: "git ls-files -- .deploy-* plus filesystem byte sizes",
    assets: "SHA-256 and sharp metadata for image files under public/",
    references: "literal public URL/path match is confirmed; basename-only is candidate; absence is unknown, not unused",
    provenance: "confirmed only for path contracts written by current ComfyUI/rembg scripts; Gemini village matches remain candidates"
  },
  summary: {
    trackedDeployFiles: deploy.length,
    trackedDeployBytes: deploy.reduce((sum, item) => sum + item.bytes, 0),
    publicImageFiles: assets.length,
    publicImageBytes: assets.reduce((sum, item) => sum + item.bytes, 0),
    duplicateGroups: duplicateGroups.length,
    duplicateFiles: duplicateGroups.reduce((sum, paths) => sum + paths.length, 0),
    confirmedReferences: assets.filter((item) => item.reference.status === "confirmed").length,
    candidateReferences: assets.filter((item) => item.reference.status === "candidate").length,
    unknownReferences: assets.filter((item) => item.reference.status === "unknown").length
  },
  deployGroups,
  formats,
  topFolders,
  duplicateGroups,
  assets
};

const serialized = JSON.stringify(report, null, 2);
if (output) await writeFile(path.resolve(root, output), `${serialized}\n`, "utf8");
else process.stdout.write(`${serialized}\n`);
