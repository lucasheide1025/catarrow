// 一次性腳本：把現有 active 掛賣補上賣家的 sellerCardIds 快照
// 用途：舊掛賣（在 listCardForSale 快照功能上線前建立的）沒有 sellerCardIds，
//       買家換卡時無法判斷「賣家是否缺這張」。本腳本從 members 讀賣家收藏補上。
//
// 用法：
//   node scripts/backfill-cardmarket-sellerCardIds.cjs            # dry-run（只列出）
//   node scripts/backfill-cardmarket-sellerCardIds.cjs --apply    # 實際寫入
const admin = require("firebase-admin");
const path = require("path");

const apply = process.argv.includes("--apply");
const keyPath = path.resolve(process.cwd(), "serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(keyPath),
});

const db = admin.firestore();

async function main() {
  const nowSec = Date.now() / 1000;

  // 1. 撈所有 active 掛賣
  const snap = await db
    .collection("cardMarket")
    .where("status", "==", "active")
    .get();

  const listings = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(l => !l.expiredAt || l.expiredAt.seconds > nowSec);

  console.log(`找到 ${listings.length} 筆 active 掛賣`);

  // 2. 依賣家分組，一次讀一位賣家的收藏（避免重複讀取）
  const sellerIds = [...new Set(listings.map(l => l.sellerId))];
  const sellerCards = new Map();
  for (const sid of sellerIds) {
    const mSnap = await db.collection("members").doc(sid).get();
    const cards = mSnap.exists ? (mSnap.data().catCards || {}) : {};
    sellerCards.set(sid, Object.keys(cards));
  }

  // 3. 比對與寫入
  let toUpdate = 0;
  let updated = 0;
  const batch = db.batch();
  let batchSize = 0;

  for (const l of listings) {
    const ids = sellerCards.get(l.sellerId) || [];
    const current = Array.isArray(l.sellerCardIds) ? l.sellerCardIds : null;

    // 已存在且內容一致 → 跳過
    const same =
      current &&
      current.length === ids.length &&
      current.every(id => ids.includes(id));
    if (same) continue;

    toUpdate += 1;
    console.log(
      `  ${l.id}  ${l.cardName}（賣家 ${l.sellerName || l.sellerId}）` +
        `：sellerCardIds ${current ? current.length + "→" : "無→"}${ids.length} 張`
    );

    if (apply) {
      batch.update(db.collection("cardMarket").doc(l.id), { sellerCardIds: ids });
      batchSize += 1;
      if (batchSize >= 400) {
        await batch.commit();
        updated += batchSize;
        batchSize = 0;
        console.log(`  ...已寫入 ${updated} 筆`);
      }
    }
  }

  if (apply && batchSize > 0) {
    await batch.commit();
    updated += batchSize;
  }

  console.log("\n==== 結果 ====");
  console.log(`需補快照：${toUpdate} 筆`);
  if (apply) {
    console.log(`已寫入：${updated} 筆`);
  } else {
    console.log("（dry-run：未寫入。加 --apply 才實際更新）");
  }
  await admin.app().delete();
}

main().catch(e => {
  console.error("錯誤：", e);
  process.exit(1);
});
