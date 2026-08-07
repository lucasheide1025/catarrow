// 驗證探索地圖 2.5D 格子資產完整性：7 族 × 20 種 + 20 共用 fallback
// 檢查：檔案存在、WebP 魔數、大小下限、背景底圖。缺圖印出 fallback 覆蓋狀況。
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const DIR = "public/assets/board";
const FAMILIES = ["mine","farm","harbor","hunting","market","warehouse","archery"];
const TYPES = ["start","material","mining","monster","arrowdew","coins","gacha","potion","chest",
  "catbond","fate","opp","camp","empower","catmate","trap","shortcut","market","scenery","fork","boss"];
const isWebp = b => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46; // RIFF

let ok = 0, missing = [];
for (const fam of FAMILIES) {
  for (const t of TYPES) {
    const f = `tile_${fam}_${t}.webp`;
    const p = join(DIR, f);
    if (!statSync(p, { throwIfNoEntry: false })) { missing.push(`族專屬缺: ${f}`); continue; }
    const b = readFileSync(p);
    if (!isWebp(b)) { missing.push(`非 WebP: ${f}`); continue; }
    if (b.length < 8000) missing.push(`太小(<8KB): ${f} (${b.length}B)`);
    else ok++;
  }
}
// 共用 fallback 檢查
const sharedMissing = [];
for (const t of TYPES) {
  const f = `tile_${t}.webp`;
  if (!statSync(join(DIR, f), { throwIfNoEntry: false })) sharedMissing.push(f);
}
const bg = statSync(join(DIR, "board_bg.webp"), { throwIfNoEntry: false });
const bgOk = bg && bg.size > 10000;

console.log(`\n== 旅程格子資產驗證 ==`);
console.log(`族專屬: ${ok}/147 完整${missing.length ? `，${missing.length} 筆問題` : ""}`);
if (missing.length) console.log(missing.join("\n"));
console.log(`共用 fallback: ${21 - sharedMissing.length}/21（缺: ${sharedMissing.join(",") || "無"}）`);
console.log(`背景 board_bg.webp: ${bgOk ? "OK" : "缺!"}`);
console.log(`總計: ${ok + 21 - sharedMissing.length + (bgOk ? 1 : 0)}/${147 + 21 + 1}`);
process.exit(missing.length ? 1 : 0);
