import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const STAGING = path.join(ROOT, ".staging", "image-generation");
const CARD_TARGET = path.join(ROOT, "public", "cards", "monsters");
const BATTLE_TARGET = path.join(ROOT, "public", "monsters-battle");
const SLOTS = ["normal_a", "existing", "normal_b", "mini_a", "mini_b", "boss"];

function idFor(tier, slot) {
  return slot === "existing" ? `ghost_${tier}` : `ghost_t${tier}_${slot}`;
}

function sourcesFor(tier, slot) {
  const id = idFor(tier, slot);
  if (tier === 1) {
    const root = path.join(STAGING, "gpt-ghost-t1-v2");
    return {
      id,
      card: path.join(root, "cards", `${id}-card-v1.png`),
      battle: path.join(
        root,
        "battle-semiq-v2",
        "transparent",
        `${id}-battle-semiq-transparent-v2.png`,
      ),
    };
  }
  const root = path.join(STAGING, "gpt-ghost-t2-t6", `t${tier}`);
  return {
    id,
    card: path.join(root, "cards", `${id}-card-v1.png`),
    battle: path.join(root, "battle", "transparent", `${id}-battle-transparent-v1.png`),
  };
}

const ART = [];
for (let tier = 1; tier <= 6; tier += 1) {
  for (const slot of SLOTS) ART.push(sourcesFor(tier, slot));
}

async function assertSources() {
  const ids = new Set();
  for (const item of ART) {
    if (ids.has(item.id)) throw new Error(`Duplicate stable ID: ${item.id}`);
    ids.add(item.id);
    await fs.access(item.card);
    await fs.access(item.battle);
  }
  if (ids.size !== 36) throw new Error(`Expected 36 stable IDs, found ${ids.size}`);
}

async function writeCard(source, target) {
  await sharp(source)
    .rotate()
    .resize(1086, 1448, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(target);
}

async function writeBattle(source, target) {
  await sharp(source)
    .rotate()
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    .resize(476, 476, {
      fit: "contain",
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: 18,
      bottom: 18,
      left: 18,
      right: 18,
      extendWith: "background",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 92, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(target);
}

async function inspect(file, kind) {
  const image = sharp(file);
  const metadata = await image.metadata();
  const stats = await image.stats();
  const size = (await fs.stat(file)).size;
  const dimensionsValid = kind === "card"
    ? metadata.width === 1086 && metadata.height === 1448
    : metadata.width === 512 && metadata.height === 512;
  const alphaValid = kind === "card"
    || (metadata.hasAlpha && stats.channels[3]?.min === 0 && stats.channels[3]?.max === 255);
  return {
    file: path.relative(ROOT, file),
    dimensions: `${metadata.width}x${metadata.height}`,
    sizeKiB: Math.round(size / 1024),
    hasAlpha: Boolean(metadata.hasAlpha),
    valid: metadata.format === "webp" && dimensionsValid && alphaValid && size < 1_200_000,
  };
}

async function validate() {
  const results = [];
  for (const item of ART) {
    results.push(await inspect(path.join(CARD_TARGET, `${item.id}.webp`), "card"));
    results.push(await inspect(path.join(BATTLE_TARGET, `${item.id}.webp`), "battle"));
  }
  console.table(results);
  const invalid = results.filter((result) => !result.valid);
  if (invalid.length > 0) throw new Error(`${invalid.length} integrated asset(s) failed validation`);
  console.log(`Validated ${results.length} production assets for ${ART.length} stable IDs.`);
}

async function integrate() {
  await assertSources();
  await fs.mkdir(CARD_TARGET, { recursive: true });
  await fs.mkdir(BATTLE_TARGET, { recursive: true });
  for (const item of ART) {
    await writeCard(item.card, path.join(CARD_TARGET, `${item.id}.webp`));
    await writeBattle(item.battle, path.join(BATTLE_TARGET, `${item.id}.webp`));
    console.log(`Integrated ${item.id}`);
  }
}

if (process.argv.includes("--check")) {
  await validate();
} else {
  await integrate();
  await validate();
}
