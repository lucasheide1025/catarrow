import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = process.cwd();
const CARD_DIR = path.join(ROOT, ".staging/image-generation/gpt-t1-cards");
const BATTLE_DIR = path.join(ROOT, ".staging/image-generation/gpt-t1-battle");
const LEADER_DIR = path.join(ROOT, ".staging/image-generation/gpt-t1-leaders");
const CARD_TARGET_DIR = path.join(ROOT, "public/cards/monsters");
const BATTLE_TARGET_DIR = path.join(ROOT, "public/monsters-battle");

const ART = [
  {
    role: "normalA",
    target: "ghost_t6_normal_a.webp",
    card: path.join(CARD_DIR, "ghost-t1-male-card-gpt-v1.png"),
    battle: path.join(BATTLE_DIR, "ghost-t1-male-battle-gpt-v1.png"),
  },
  {
    role: "normalExisting",
    target: "ghost_6.webp",
    card: path.join(CARD_DIR, "ghost-t1-female-card-gpt-v1.png"),
    battle: path.join(BATTLE_DIR, "ghost-t1-female-battle-gpt-v1.png"),
  },
  {
    role: "normalB",
    target: "ghost_t6_normal_b.webp",
    card: path.join(CARD_DIR, "ghost-t1-beast-card-gpt-v1.png"),
    battle: path.join(BATTLE_DIR, "ghost-t1-beast-battle-gpt-v1.png"),
  },
  {
    role: "miniA",
    target: "ghost_t6_mini_a.webp",
    card: path.join(LEADER_DIR, "ghost-t1-boss-card-gpt-v1.png"),
    battle: path.join(LEADER_DIR, "ghost-t1-boss-battle-gpt-v1.png"),
  },
  {
    role: "miniB",
    target: "ghost_t6_mini_b.webp",
    card: path.join(LEADER_DIR, "ghost-t1-mini-a-card-gpt-v1.png"),
    battle: path.join(LEADER_DIR, "ghost-t1-mini-a-battle-gpt-v1.png"),
  },
  {
    role: "boss",
    target: "ghost_t6_boss.webp",
    card: path.join(LEADER_DIR, "ghost-t1-mini-b-card-gpt-v1.png"),
    battle: path.join(LEADER_DIR, "ghost-t1-mini-b-battle-gpt-v1.png"),
  },
];

const clampByte = value => Math.max(0, Math.min(255, Math.round(value)));
const smoothstep = (edge0, edge1, value) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

async function ensureSources() {
  const targets = new Set();
  for (const item of ART) {
    if (targets.has(item.target)) throw new Error(`Duplicate target: ${item.target}`);
    targets.add(item.target);
    await fs.access(item.card);
    await fs.access(item.battle);
  }
}

async function writeCard(source, target) {
  await sharp(source)
    .rotate()
    .resize(1086, 1448, { fit: "fill" })
    .webp({ quality: 90, effort: 6, smartSubsample: true })
    .toFile(target);
}

async function chromaKeyBattle(source, target) {
  const { data, info } = await sharp(source)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = Buffer.alloc(info.width * info.height * 4);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const sourceOffset = (y * info.width + x) * 3;
      const targetOffset = (y * info.width + x) * 4;
      const r = data[sourceOffset];
      const g = data[sourceOffset + 1];
      const b = data[sourceOffset + 2];

      const otherMax = Math.max(r, b);
      const greenExcess = g - otherMax;
      const greenStrength = smoothstep(60, 165, g);
      const greenDominance = smoothstep(12, 82, greenExcess);
      const backgroundAmount = greenStrength * greenDominance;
      const alpha = clampByte(255 * (1 - backgroundAmount));

      // Remove reflected chroma green from feathered pixels while preserving
      // intentional cyan/blue/purple effects whose blue channel dominates.
      const decontaminatedGreen = g > otherMax
        ? Math.min(g, (r + b) / 2 + 3)
        : g;

      rgba[targetOffset] = r;
      rgba[targetOffset + 1] = clampByte(decontaminatedGreen);
      rgba[targetOffset + 2] = b;
      rgba[targetOffset + 3] = alpha;

      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`Chroma key removed the entire image: ${source}`);
  }

  const padding = Math.max(12, Math.round(Math.max(info.width, info.height) * 0.018));
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(info.width - 1, maxX + padding);
  const bottom = Math.min(info.height - 1, maxY + padding);

  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(476, 476, {
      fit: "contain",
      withoutEnlargement: false,
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

async function inspectTarget(file, type) {
  const image = sharp(file);
  const metadata = await image.metadata();
  const stats = await image.stats();
  const size = (await fs.stat(file)).size;
  const expected = type === "card"
    ? metadata.width === 1086 && metadata.height === 1448
    : metadata.width === 512 && metadata.height === 512 && metadata.hasAlpha;
  const corners = await image
    .ensureAlpha()
    .extract({ left: 0, top: 0, width: metadata.width, height: metadata.height })
    .raw()
    .toBuffer();
  const cornerOffsets = [
    3,
    (metadata.width - 1) * 4 + 3,
    (metadata.height - 1) * metadata.width * 4 + 3,
    (metadata.width * metadata.height - 1) * 4 + 3,
  ];
  const transparentCorners = type === "card"
    || cornerOffsets.every(offset => corners[offset] <= 8);
  const alphaMin = stats.channels[3]?.min ?? 255;

  return {
    file: path.relative(ROOT, file),
    dimensions: `${metadata.width}x${metadata.height}`,
    sizeKiB: Math.round(size / 1024),
    hasAlpha: Boolean(metadata.hasAlpha),
    alphaMin,
    transparentCorners,
    valid: metadata.format === "webp" && expected && transparentCorners && size < 1_200_000,
  };
}

async function validate() {
  const results = [];
  for (const item of ART) {
    results.push(await inspectTarget(path.join(CARD_TARGET_DIR, item.target), "card"));
    results.push(await inspectTarget(path.join(BATTLE_TARGET_DIR, item.target), "battle"));
  }
  console.table(results);
  if (results.some(result => !result.valid)) process.exitCode = 1;
}

async function generate() {
  await ensureSources();
  await fs.mkdir(CARD_TARGET_DIR, { recursive: true });
  await fs.mkdir(BATTLE_TARGET_DIR, { recursive: true });

  for (const item of ART) {
    await writeCard(item.card, path.join(CARD_TARGET_DIR, item.target));
    await chromaKeyBattle(item.battle, path.join(BATTLE_TARGET_DIR, item.target));
    console.log(`Integrated ${item.role} -> ${item.target}`);
  }
}

if (process.argv.includes("--check")) {
  await validate();
} else {
  await generate();
  await validate();
}
