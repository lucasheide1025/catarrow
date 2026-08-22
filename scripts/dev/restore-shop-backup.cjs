// 復原被重置的商店資料（從 Firestore 每日備份）
// 用法：
//   node scripts/dev/restore-shop-backup.cjs --dry-run   # 只顯示將寫入的內容
//   node scripts/dev/restore-shop-backup.cjs --apply      # 實際寫入 Firestore
//
// 受害者與復原來源：
//   葉浩生 [DQPs5FGOkrY2RjHCMbh1CUgiEbF3] ← firestore-2026-08-14T15-00-04（8/15 03:30 重置）
//   施聖凱 [Z4bmpDKnAJbD3Q2cexxo1yAguGC3] ← firestore-2026-08-14T15-00-04（8/15 06:53 重置）
//   楊皇偉 [8X9eL7pnzGVZ2eYdqaqh7GBmGXq2] ← firestore-2026-08-15T15-00-04（8/15 17:36 重置）
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const keyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(keyPath) });
const db = admin.firestore();

const DRY = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");
if (!DRY && !APPLY) {
  console.error("用法: node scripts/dev/restore-shop-backup.cjs [--dry-run|--apply]");
  process.exit(1);
}

const BACKUP_ROOT = "D:\\射箭系統備份\\firebase\\";
const RESTORES = [
  {
    mid: "DQPs5FGOkrY2RjHCMbh1CUgiEbF3",
    name: "葉浩生",
    backup: "firestore-2026-08-14T15-00-04",
  },
  {
    mid: "Z4bmpDKnAJbD3Q2cexxo1yAguGC3",
    name: "施聖凱",
    backup: "firestore-2026-08-14T15-00-04",
  },
  {
    mid: "8X9eL7pnzGVZ2eYdqaqh7GBmGXq2",
    name: "楊皇偉",
    backup: "firestore-2026-08-15T15-00-04",
  },
];

// 備份 JSON：{ docId: { data: {...} } }；Timestamp 為 {_seconds, _nanoseconds}
function loadBackup(backupName) {
  const p = path.join(BACKUP_ROOT, backupName, "members.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// 遞迴轉換 {_seconds,_nanoseconds} → firestore Timestamp
function revive(obj) {
  if (Array.isArray(obj)) return obj.map(revive);
  if (obj && typeof obj === "object") {
    if (typeof obj._seconds === "number" && typeof obj._nanoseconds === "number") {
      return new admin.firestore.Timestamp(obj._seconds, obj._nanoseconds);
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = revive(v);
    return out;
  }
  return obj;
}

async function main() {
  const backups = {};
  for (const r of RESTORES) {
    if (!backups[r.backup]) backups[r.backup] = loadBackup(r.backup);
    const m = backups[r.backup][r.mid];
    if (!m || !m.data?.village?.shop) {
      console.error(`✗ ${r.name}: 備份 ${r.backup} 找不到 shop`);
      continue;
    }
    const backupShop = m.data.village.shop;

    // 目前線上狀態（對照用）
    const liveSnap = await db.doc(`members/${r.mid}`).get();
    const liveShop = liveSnap.data()?.village?.shop || null;

    console.log(`\n===== ${r.name} [${r.mid}] ← ${r.backup} =====`);
    console.log(`備份: level=${backupShop.level} tickets=${backupShop.tickets} revenue=${backupShop.stats?.totalRevenue} served=${backupShop.stats?.customersServed} furniture=${JSON.stringify(backupShop.furniture)}`);
    console.log(`目前: level=${liveShop?.level ?? "-"} tickets=${liveShop?.tickets ?? "-"} revenue=${liveShop?.stats?.totalRevenue ?? "-"} served=${liveShop?.stats?.customersServed ?? "-"} furniture=${JSON.stringify(liveShop?.furniture ?? {})}`);
    console.log(`備份 stock(nonzero)=${JSON.stringify(Object.fromEntries(Object.entries(backupShop.stock || {}).filter(([, v]) => v)))}`);
    console.log(`目前 stock(nonzero)=${JSON.stringify(Object.fromEntries(Object.entries(liveShop?.stock || {}).filter(([, v]) => v)))}`);

    if (!APPLY) continue;

    // 復原：完整覆寫 village.shop（保留重置後新增的庫存——合併備份 + 目前）
    const mergedStock = { ...(backupShop.stock || {}) };
    for (const [goodId, count] of Object.entries(liveShop?.stock || {})) {
      mergedStock[goodId] = Math.max(Number(mergedStock[goodId]) || 0, Number(count) || 0);
    }
    const restored = revive({
      ...backupShop,
      stock: mergedStock,
      // 時間欄位維持備份值（lastVisitedAt 回到重置前 → 下次開店重新累積顧客）
    });

    await db.doc(`members/${r.mid}`).update({ "village.shop": restored });
    console.log(`✓ 已復原 ${r.name}（village.shop 完整覆寫，stock 已合併目前庫存）`);
  }

  if (DRY) {
    console.log("\n[dry-run] 以上為將寫入內容；加 --apply 實際寫入。");
  } else if (APPLY) {
    console.log("\n全部復原完成。");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
