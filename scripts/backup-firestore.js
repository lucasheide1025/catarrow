// scripts/backup-firestore.js
// 線上 Firestore 完整備份 → backups/firestore-<時間>/<collection>.json
// 唯讀操作，不寫入。使用專案根的 serviceAccountKey.json。
//   執行：node scripts/backup-firestore.js
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const svc = require(path.join(ROOT, "serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(svc) });
const db = admin.firestore();

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(ROOT, "backups", `firestore-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

let totalDocs = 0;

// 遞迴匯出一個 collection（含子集合）
async function exportCollection(colRef) {
  const snap = await colRef.get();
  const out = {};
  for (const doc of snap.docs) {
    totalDocs++;
    const entry = { data: doc.data() };
    const subs = await doc.ref.listCollections();
    if (subs.length) {
      entry.subcollections = {};
      for (const s of subs) entry.subcollections[s.id] = await exportCollection(s);
    }
    out[doc.id] = entry;
  }
  return out;
}

(async () => {
  console.log(`專案：${svc.project_id}`);
  const roots = await db.listCollections();
  const summary = [];
  for (const col of roots) {
    const data = await exportCollection(col);
    const count = Object.keys(data).length;
    fs.writeFileSync(path.join(outDir, `${col.id}.json`), JSON.stringify(data, null, 2));
    summary.push({ collection: col.id, docs: count });
    console.log(`✓ ${col.id}: ${count} docs`);
  }
  fs.writeFileSync(
    path.join(outDir, "_summary.json"),
    JSON.stringify({ project: svc.project_id, stamp, totalDocs, collections: summary }, null, 2)
  );
  console.log(`\nDONE → ${outDir}  （共 ${totalDocs} 筆文件）`);
  process.exit(0);
})().catch((e) => { console.error("BACKUP_ERR", e); process.exit(1); });
