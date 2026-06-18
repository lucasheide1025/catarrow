// scripts/remove-bg.mjs
// 用法: node scripts/remove-bg.mjs
// 自動偵測四角背景色，從邊界做 flood-fill，移除背景變透明

import sharp from "sharp";
import { readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TARGETS = [
  { dir: "public/cats/archers", files: null },   // 全部 webp
  { dir: "public/ui",           files: ["score-btn.webp", "party-bar.webp"] },
];

const TOLERANCE = 55;   // 與背景色的色差容許值（0~441），越大去越多
const FEATHER   = 20;   // 邊緣羽化範圍（像素色差）

async function removeBg(filePath) {
  const fileBuffer = await readFile(filePath);  // 先完整讀入記憶體
  const img = sharp(fileBuffer).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const buf = Buffer.from(data); // RGBA

  // 採樣四角 5×5 區域取平均背景色
  function sampleRect(cx, cy) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) {
      const x = Math.max(0, Math.min(width - 1, cx + dx));
      const y = Math.max(0, Math.min(height - 1, cy + dy));
      const p = (y * width + x) * 4;
      r += buf[p]; g += buf[p+1]; b += buf[p+2]; n++;
    }
    return [r/n, g/n, b/n];
  }
  const corners = [
    sampleRect(0, 0), sampleRect(width-5, 0),
    sampleRect(0, height-5), sampleRect(width-5, height-5),
  ];
  const bgR = corners.reduce((s,c)=>s+c[0],0)/4;
  const bgG = corners.reduce((s,c)=>s+c[1],0)/4;
  const bgB = corners.reduce((s,c)=>s+c[2],0)/4;

  const dist = (r,g,b) => Math.sqrt((r-bgR)**2+(g-bgG)**2+(b-bgB)**2);

  // Flood-fill 從所有邊界像素出發，標記背景區域
  const visited = new Uint8Array(width * height);
  const queue = [];

  function enqueue(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    const p = i * 4;
    if (dist(buf[p], buf[p+1], buf[p+2]) > TOLERANCE) return;
    visited[i] = 1;
    queue.push(i);
  }

  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height-1); }
  for (let y = 1; y < height-1; y++) { enqueue(0, y); enqueue(width-1, y); }

  let qi = 0;
  while (qi < queue.length) {
    const i = queue[qi++];
    const x = i % width, y = Math.floor(i / width);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) enqueue(x+dx, y+dy);
  }

  // 將 flood-fill 標記區域設為透明（含羽化）
  for (let i = 0; i < width * height; i++) {
    if (!visited[i]) continue;
    const p = i * 4;
    const d = dist(buf[p], buf[p+1], buf[p+2]);
    if (d <= TOLERANCE - FEATHER) {
      buf[p+3] = 0;
    } else {
      buf[p+3] = Math.round(((d - (TOLERANCE - FEATHER)) / FEATHER) * 255);
    }
  }

  const outBuffer = await sharp(buf, { raw: { width, height, channels: 4 } })
    .webp({ quality: 95, lossless: false })
    .toBuffer();
  await writeFile(filePath, outBuffer);

  console.log(`  ✓ ${path.relative(ROOT, filePath)}  (bg≈rgb(${Math.round(bgR)},${Math.round(bgG)},${Math.round(bgB)}))`);
}

// 主程式
(async () => {
  console.log("🐱 開始去背...\n");
  for (const target of TARGETS) {
    const dir = path.join(ROOT, target.dir);
    let files = target.files;
    if (!files) {
      const all = await readdir(dir);
      files = all.filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));
    }
    for (const f of files) {
      await removeBg(path.join(dir, f));
    }
  }
  console.log("\n✅ 完成！");
})();
