import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repo = process.cwd();
const staging = path.join(repo, ".staging", "image-generation");
const root = path.join(staging, "gpt-ghost-t2-t6");
const slots = ["normal_a", "existing", "normal_b", "mini_a", "mini_b", "boss"];

function assetName(tier, slot, kind) {
  const id = slot === "existing" ? `ghost_${tier}` : `ghost_t${tier}_${slot}`;
  return kind === "card"
    ? `${id}-card-v1.png`
    : `${id}-battle-transparent-v1.png`;
}

function assetPath(tier, slot, kind) {
  return kind === "card"
    ? path.join(root, `t${tier}`, "cards", assetName(tier, slot, kind))
    : path.join(root, `t${tier}`, "battle", "transparent", assetName(tier, slot, kind));
}

async function contact(paths, output, width, height, columns, tileWidth, tileHeight) {
  const composites = [];
  for (let index = 0; index < paths.length; index += 1) {
    const buffer = await sharp(paths[index])
      .resize(tileWidth - 20, tileHeight - 20, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    composites.push({
      input: buffer,
      left: (index % columns) * tileWidth + 10,
      top: Math.floor(index / columns) * tileHeight + 10,
    });
  }
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 38, g: 49, b: 60, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(output);
}

for (let tier = 2; tier <= 6; tier += 1) {
  const cards = slots.map((slot) => assetPath(tier, slot, "card"));
  const battles = slots.map((slot) => assetPath(tier, slot, "battle"));
  await contact(cards, path.join(root, `t${tier}`, "cards", `ghost-t${tier}-card-contact-v1.png`), 1080, 960, 3, 360, 480);
  await contact(battles, path.join(root, `t${tier}`, "battle", "transparent", `ghost-t${tier}-battle-contact-v1.png`), 1080, 960, 3, 360, 480);
}

const t1Root = path.join(staging, "gpt-ghost-t1-v2");
const overviewDir = path.join(root, "overview");
await mkdir(overviewDir, { recursive: true });
const t1Cards = [
  "ghost_t1_normal_a-card-v1.png",
  "ghost_1-card-v1.png",
  "ghost_t1_normal_b-card-v1.png",
  "ghost_t1_mini_a-card-v1.png",
  "ghost_t1_mini_b-card-v1.png",
  "ghost_t1_boss-card-v1.png",
].map((name) => path.join(t1Root, "cards", name));
const t1Battles = [
  "ghost_t1_normal_a-battle-semiq-transparent-v2.png",
  "ghost_1-battle-semiq-transparent-v2.png",
  "ghost_t1_normal_b-battle-semiq-transparent-v2.png",
  "ghost_t1_mini_a-battle-semiq-transparent-v2.png",
  "ghost_t1_mini_b-battle-semiq-transparent-v2.png",
  "ghost_t1_boss-battle-semiq-transparent-v2.png",
].map((name) => path.join(t1Root, "battle-semiq-v2", "transparent", name));
const allCards = [...t1Cards];
const allBattles = [...t1Battles];
for (let tier = 2; tier <= 6; tier += 1) {
  allCards.push(...slots.map((slot) => assetPath(tier, slot, "card")));
  allBattles.push(...slots.map((slot) => assetPath(tier, slot, "battle")));
}
await contact(allCards, path.join(overviewDir, "ghost-t1-t6-card-overview-v1.png"), 1080, 1440, 6, 180, 240);
await contact(allBattles, path.join(overviewDir, "ghost-t1-t6-battle-overview-v1.png"), 1080, 1440, 6, 180, 240);

const assets = [];
for (let tier = 2; tier <= 6; tier += 1) {
  for (const slot of slots) {
    const id = slot === "existing" ? `ghost_${tier}` : `ghost_t${tier}_${slot}`;
    for (const kind of ["card", "battle"]) {
      const output = assetPath(tier, slot, kind);
      const bytes = await readFile(output);
      const info = await stat(output);
      assets.push({
        id: `${id}-${kind}`,
        profile: kind === "card" ? "monster-card-portrait-3x4" : "monster-battle-semiq-transparent",
        output: path.relative(root, output).replaceAll("\\", "/"),
        prompt: `Ghost family T${tier} ${slot} ${kind}; independent identity; Tier x Encounter hierarchy; ${kind === "battle" ? "3.5–4-head semi-chibi battle unit" : "painterly 3:4 card art"}.`,
        bytes: info.size,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
}
await writeFile(
  path.join(root, "manifest.json"),
  `${JSON.stringify({
    provider: "manual-codex-built-in-imagegen",
    execution: "interactive",
    scope: "ghost T2-T6 review staging only; no public integration",
    assets,
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Built 10 tier contacts, 2 overviews, and manifest for ${assets.length} assets.`);
