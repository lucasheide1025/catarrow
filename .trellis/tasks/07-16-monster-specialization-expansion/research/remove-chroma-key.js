const sharp = require('sharp');

const [, , inputPath, outputPath, keyName = 'magenta'] = process.argv;

if (!inputPath || !outputPath) {
  throw new Error('Usage: node remove-chroma-key.js <input> <output>');
}

const KEYS = {
  cyan: [0, 255, 255],
  green: [0, 255, 0],
  magenta: [255, 0, 255],
};
const KEY = KEYS[keyName];

if (!KEY) {
  throw new Error(`Unknown key color: ${keyName}`);
}
const TRANSPARENT_DISTANCE = 24;
const OPAQUE_DISTANCE = 105;

async function main() {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += 4) {
    const redDelta = data[offset] - KEY[0];
    const greenDelta = data[offset + 1] - KEY[1];
    const blueDelta = data[offset + 2] - KEY[2];
    const distance = Math.sqrt(
      redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta,
    );
    const alpha = Math.max(
      0,
      Math.min(
        255,
        Math.round(
          ((distance - TRANSPARENT_DISTANCE) /
            (OPAQUE_DISTANCE - TRANSPARENT_DISTANCE)) *
            255,
        ),
      ),
    );

    data[offset + 3] = Math.min(data[offset + 3], alpha);

    if (alpha > 0 && alpha < 255) {
      const spill = (255 - alpha) / 255;
      data[offset] = Math.max(0, Math.round(data[offset] * (1 - 0.25 * spill)));
      data[offset + 2] = Math.max(
        0,
        Math.round(data[offset + 2] * (1 - 0.25 * spill)),
      );
    }
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
