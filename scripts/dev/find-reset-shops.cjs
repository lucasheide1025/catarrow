// 一次性診斷腳本：掃描 members，找出「商店被重置歸零」的玩家。
// 特徵：village.shop 存在，但 level===1、tickets===0、stock 幾乎空、
//       stats 顯示曾經營過（totalTickets/totalSales/customersServed 高），
//       或 createdAt 遠晚於 lastAutoSaleAt / lastVisitedAt 的合理時間。
//
// 用法：
//   node scripts/dev/find-reset-shops.cjs            # dry-run 只列出
//   node scripts/dev/find-reset-shops.cjs --detail   # 列出每個可疑玩家的 shop 快照
const admin = require("firebase-admin");
const path = require("path");

const keyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(keyPath) });
const db = admin.firestore();

const DETAIL = process.argv.includes("--detail");
const LIMIT = Number(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] || 500);

async function main() {
  const snap = await db.collection("members").select(
    "name", "accountType", "village.shop",
    "village.shop.level", "village.shop.tickets", "village.shop.stock",
    "village.shop.createdAt", "village.shop.lastAutoSaleAt", "village.shop.lastVisitedAt",
    "village.shop.stats.totalTickets", "village.shop.stats.totalSales",
    "village.shop.stats.customersServed", "village.shop.stats.totalRevenue",
    "village.shop.furniture", "village.shop.exchange",
    "village.resources",
  ).limit(LIMIT).get();

  const suspicious = [];
  let total = 0;
  let withShop = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    total++;
    const shop = data.village?.shop;
    if (!shop) continue;
    withShop++;

    const stats = shop.stats || {};
    const level = Number(shop.level) || 1;
    const tickets = Number(shop.tickets) || 0;
    const stock = shop.stock || {};
    const stockTotal = Object.values(stock).reduce((s, v) => s + Number(v), 0);
    const served = Number(stats.customersServed) || 0;
    const totalTickets = Number(stats.totalTickets) || 0;
    const totalSales = Number(stats.totalSales) || 0;
    const totalRevenue = Number(stats.totalRevenue) || 0;

    const createdAtMs = shop.createdAt?.toMillis ? shop.createdAt.toMillis() : 0;
    const lastAutoMs = shop.lastAutoSaleAt?.toMillis ? shop.lastAutoSaleAt.toMillis() : 0;
    const lastVisitMs = shop.lastVisitedAt?.toMillis ? shop.lastVisitedAt.toMillis() : 0;

    // 判定「被重置」：曾經營過但現在歸零/低等
    const hadActivity = served > 0 || totalTickets > 0 || totalSales > 0 || totalRevenue > 0;
    const resetSignals = [];
    if (hadActivity && level === 1 && tickets === 0 && stockTotal === 0) {
      resetSignals.push(`level1+tickets0+stock0 但 stats 有活動(served=${served}, tickets=${totalTickets})`);
    }
    if (hadActivity && level === 1) {
      resetSignals.push(`曾經營(served=${served},revenue=${totalRevenue})但等級只有1`);
    }
    if (hadActivity && tickets === 0 && stockTotal === 0) {
      resetSignals.push(`票券/庫存全 0 但曾經營(served=${served},sales=${totalSales})`);
    }
    // createdAt 晚於 lastVisitedAt 很多 → 資料被重建過
    if (createdAtMs > 0 && lastVisitMs > createdAtMs + 86400000) {
      resetSignals.push(`createdAt 比 lastVisitedAt 新一天以上(可能被重建)`);
    }

    if (resetSignals.length) {
      suspicious.push({ id: docSnap.id, name: data.name, accountType: data.accountType,
        level, tickets, stockTotal, served, totalTickets, totalSales, totalRevenue,
        createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null,
        lastAutoSaleAt: lastAutoMs ? new Date(lastAutoMs).toISOString() : null,
        lastVisitedAt: lastVisitMs ? new Date(lastVisitMs).toISOString() : null,
        signals: resetSignals,
        stock, furniture: shop.furniture,
      });
    }
  }

  console.log(`掃描 ${total} 位會員，${withShop} 位有 shop`);
  console.log(`可疑（疑似被重置）: ${suspicious.length} 位\n`);

  for (const s of suspicious) {
    console.log(`▸ ${s.name || "(無名)"} [${s.id}] type=${s.accountType || "?"}`);
    console.log(`  level=${s.level} tickets=${s.tickets} stock=${s.stockTotal}`);
    console.log(`  stats: served=${s.served} totalTickets=${s.totalTickets} sales=${s.totalSales} revenue=${s.totalRevenue}`);
    console.log(`  createdAt=${s.createdAt} lastAutoSaleAt=${s.lastAutoSaleAt} lastVisitedAt=${s.lastVisitedAt}`);
    console.log(`  signals: ${s.signals.join(" | ")}`);
    if (DETAIL) {
      console.log(`  stock=${JSON.stringify(s.stock)}`);
      console.log(`  furniture=${JSON.stringify(s.furniture)}`);
    }
    console.log("");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
