import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repo = process.cwd();
const root = path.join(
  repo,
  ".staging",
  "image-generation",
  "gpt-mountain-t1-t6",
);
const slots = ["normal_a", "existing", "normal_b", "mini_a", "mini_b", "boss"];

function stableId(tier, slot) {
  return slot === "existing" ? `mountain_${tier}` : `mountain_t${tier}_${slot}`;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function contact(paths, output) {
  const composites = [];
  for (let index = 0; index < paths.length; index += 1) {
    const input = await sharp(paths[index])
      .resize(344, 344, { fit: "contain" })
      .png()
      .toBuffer();
    composites.push({
      input,
      left: (index % 3) * 360 + 8,
      top: Math.floor(index / 3) * 360 + 8,
    });
  }
  await sharp({
    create: {
      width: 1080,
      height: 720,
      channels: 4,
      background: { r: 35, g: 42, b: 47, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(output);
}

async function overview(paths, output) {
  const tile = 176;
  const gap = 4;
  const composites = [];
  for (let index = 0; index < paths.length; index += 1) {
    const input = await sharp(paths[index])
      .resize(tile, tile, { fit: "contain" })
      .png()
      .toBuffer();
    composites.push({
      input,
      left: (index % 6) * (tile + gap) + 2,
      top: Math.floor(index / 6) * (tile + gap) + 2,
    });
  }
  await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 4,
      background: { r: 35, g: 42, b: 47, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(output);
}

const overviewDir = path.join(root, "overview");
await mkdir(overviewDir, { recursive: true });
const assets = [];
const overviewPaths = [];

for (let tier = 1; tier <= 6; tier += 1) {
  const paths = slots.map((slot) =>
    path.join(
      root,
      "battle",
      `t${tier}`,
      "transparent",
      `${stableId(tier, slot)}-transparent-v1.png`,
    ),
  );
  if (!(await Promise.all(paths.map(exists))).every(Boolean)) continue;
  overviewPaths.push(...paths);
  await contact(
    paths,
    path.join(overviewDir, `mountain-t${tier}-battle-contact-v1.png`),
  );
  for (let index = 0; index < paths.length; index += 1) {
    const output = paths[index];
    const bytes = await readFile(output);
    const info = await stat(output);
    const metadata = await sharp(output).metadata();
    const stats = await sharp(output).stats();
    assets.push({
      id: stableId(tier, slots[index]),
      tier,
      slot: slots[index],
      output: path.relative(root, output).replaceAll("\\", "/"),
      width: metadata.width,
      height: metadata.height,
      hasAlpha: metadata.hasAlpha,
      alphaMin: stats.channels[3]?.min,
      alphaMax: stats.channels[3]?.max,
      bytes: info.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}

if (overviewPaths.length === 36) {
  await overview(
    overviewPaths,
    path.join(overviewDir, "mountain-t1-t6-battle-overview-v1.png"),
  );
}

await writeFile(
  path.join(root, "manifest-battle.json"),
  `${JSON.stringify(
    {
      provider: "codex-built-in-imagegen",
      scope: "mountain battle semi-chibi staging only",
      assets,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Built battle contacts and ${assets.length} manifest entries.`);
