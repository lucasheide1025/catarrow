// 診斷：列出全部有 shop 的會員的創建時間分布 + 完整 shop 狀態
// 目的：找出「商店被重置歸零」的玩家（createdAt 異常新 / 等級票券庫存全歸零）
const admin = require("firebase-admin");
const path = require("path");

const keyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(keyPath) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection("members").get();
  const rows = [];
  let withShop = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const shop = data.village?.shop;
    if (!shop) continue;
    withShop++;
    const stats = shop.stats || {};
    const createdAtMs = shop.createdAt?.toMillis ? shop.createdAt.toMillis() : (typeof shop.createdAt === "number" ? shop.createdAt : 0);
    const lastVisitMs = shop.lastVisitedAt?.toMillis ? shop.lastVisitedAt.toMillis() : (typeof shop.lastVisitedAt === "number" ? shop.lastVisitedAt : 0);
    const lastAutoMs = shop.lastAutoSaleAt?.toMillis ? shop.lastAutoSaleAt.toMillis() : (typeof shop.lastAutoSaleAt === "number" ? shop.lastAutoSaleAt : 0);
    const stock = shop.stock || {};
    const stockTotal = Object.values(stock).reduce((s, v) => s + Number(v), 0);
    rows.push({
      id: docSnap.id,
      name: data.name || "(無名)",
      createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null,
      lastVisitedAt: lastVisitMs ? new Date(lastVisitMs).toISOString() : null,
      lastAutoSaleAt: lastAutoMs ? new Date(lastAutoMs).toISOString() : null,
      level: Number(shop.level) || 1,
      tickets: Number(shop.tickets) || 0,
      stockTotal,
      served: Number(stats.customersServed) || 0,
      totalTickets: Number(stats.totalTickets) || 0,
      totalSales: Number(stats.totalSales) || 0,
      totalRevenue: Number(stats.totalRevenue) || 0,
      discovered: (stats.discoveredCustomers || []).length,
      furniture: shop.furniture || {},
      stock,
    });
  }

  rows.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  console.log(`總會員 ${snap.size}，有 shop ${withShop}\n`);
  console.log("=== 全部有 shop 的會員（依 createdAt 排序）===");
  for (const r of rows) {
    const flag = [];
    if (r.createdAt && r.createdAt >= "2026-08-13") flag.push("!!!createdAt很新(可能被重建)");
    if (r.served > 0 && r.level === 1 && r.tickets === 0 && r.stockTotal === 0) flag.push("!!!曾營業但全歸零");
    if (r.createdAt && r.lastVisitedAt && r.createdAt > r.lastVisitedAt) flag.push("!!!createdAt晚於lastVisitedAt");
    console.log(
      `${r.createdAt || "???"} | ${(r.name || "").padEnd(6)} | lv=${String(r.level).padStart(2)} | ` +
      `票=${String(r.tickets).padStart(6)} | 庫存=${String(r.stockTotal).padStart(5)} | ` +
      `served=${String(r.served).padStart(5)} | rev=${String(r.totalRevenue).padStart(6)} | ` +
      `${flag.join(" ")}`
    );
  }

  console.log("\n=== 最近建立的（可能被重置）===");
  const recent = rows.filter(r => r.createdAt && r.createdAt >= "2026-08-13");
  for (const r of recent) {
    console.log(`\n▸ ${r.name} [${r.id}]`);
    console.log(JSON.stringify({ ...r, furniture: undefined, stock: undefined }, null, 2));
    console.log(`  furniture=${JSON.stringify(r.furniture)}`);
    console.log(`  stock=${JSON.stringify(r.stock)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
