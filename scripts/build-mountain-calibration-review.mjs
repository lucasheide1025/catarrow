import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repo = process.cwd();
const root = path.join(
  repo,
  ".staging",
  "image-generation",
  "gpt-mountain-t1-t6",
);
const tiers = [1, 2, 3, 4, 5, 6];
const slots = ["normal_a", "existing", "normal_b", "mini_a", "mini_b", "boss"];

function stableId(tier, slot) {
  return slot === "existing" ? `mountain_${tier}` : `mountain_t${tier}_${slot}`;
}

function cardPath(tier, slot) {
  const version = tier === 6 && slot === "normal_b" ? "v2" : "v1";
  return path.join(
    root,
    "cards",
    `t${tier}`,
    `${stableId(tier, slot)}-${version}.png`,
  );
}

async function contact(paths, output, columns, tileWidth, tileHeight) {
  const rows = Math.ceil(paths.length / columns);
  const composites = [];
  for (let index = 0; index < paths.length; index += 1) {
    const input = await sharp(paths[index])
      .resize(tileWidth - 16, tileHeight - 16, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    composites.push({
      input,
      left: (index % columns) * tileWidth + 8,
      top: Math.floor(index / columns) * tileHeight + 8,
    });
  }
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 4,
      background: { r: 27, g: 34, b: 39, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(output);
}

const overviewDir = path.join(root, "overview");
await mkdir(overviewDir, { recursive: true });

const allCards = [];
const assets = [];
for (const tier of tiers) {
  const cards = slots.map((slot) => cardPath(tier, slot));
  allCards.push(...cards);
  await contact(
    cards,
    path.join(overviewDir, `mountain-t${tier}-card-contact-v1.png`),
    3,
    360,
    480,
  );
  for (let index = 0; index < cards.length; index += 1) {
    const output = cards[index];
    const bytes = await readFile(output);
    const info = await stat(output);
    const metadata = await sharp(output).metadata();
    assets.push({
      id: stableId(tier, slots[index]),
      tier,
      slot: slots[index],
      output: path.relative(root, output).replaceAll("\\", "/"),
      width: metadata.width,
      height: metadata.height,
      bytes: info.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}

await contact(
  allCards,
  path.join(overviewDir, "mountain-t1-t6-card-overview-v1.png"),
  6,
  180,
  240,
);

await writeFile(
  path.join(root, "manifest-calibration.json"),
  `${JSON.stringify(
    {
      provider: "codex-built-in-imagegen",
      scope: "mountain T1-T6 card review staging only",
      assets,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Built 6 tier contacts, 1 overview, and ${assets.length} manifest entries.`);
