// 深度診斷：找出「shop 被重置歸零」的玩家。
// 判定法：shop.createdAt 異常新（>= 8/13，晚於商店上線初期），
//         但玩家其他活動證據（探險紀錄、村資源、總箭數、入會時間）顯示是老玩家。
// 被重置的機制：collectExpedition 帶 shopGoods 時呼叫 initVillageShopIfNeeded(memberId, null)，
//               若該函式誤把既有 shop 覆寫成 Lv.1 預設，玩家的 level/tickets/furniture/stats 全歸零。
const admin = require("firebase-admin");
const path = require("path");

const keyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(keyPath) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection("members").get();
  const rows = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const shop = data.village?.shop;
    if (!shop) continue;
    const createdAtMs = shop.createdAt?.toMillis ? shop.createdAt.toMillis() : 0;
    const lastVisitMs = shop.lastVisitedAt?.toMillis ? shop.lastVisitedAt.toMillis() : 0;
    const createdAt = createdAtMs ? new Date(createdAtMs).toISOString() : null;
    const stats = shop.stats || {};
    const stock = shop.stock || {};
    const stockTotal = Object.values(stock).reduce((s, v) => s + Number(v), 0);
    rows.push({
      id: docSnap.id,
      name: data.name || "(無名)",
      createdAt,
      level: Number(shop.level) || 1,
      tickets: Number(shop.tickets) || 0,
      stockTotal,
      served: Number(stats.customersServed) || 0,
      totalTickets: Number(stats.totalTickets) || 0,
      totalSales: Number(stats.totalSales) || 0,
      totalRevenue: Number(stats.totalRevenue) || 0,
      // 老玩家證據
      totalArrows: Number(data.totalArrowsAllTime) || 0,
      joinDate: data.joinDate ? String(data.joinDate) : null,
      expeditions: data.expeditions ? Object.keys(data.expeditions).length : 0,
      resources: data.village?.resources ? Object.keys(data.village.resources).length : 0,
      shop,
    });
  }

  // 商店上線 8/8，正常玩家創建集中在 8/8~8/12。8/13 之後的 createdAt 高度可疑。
  console.log("=== 全部 shop 玩家（含老玩家證據）===");
  rows.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  for (const r of rows) {
    const suspicious = r.createdAt && r.createdAt >= "2026-08-13" ? "*** 可疑：createdAt 晚於商店上線初期" : "";
    console.log(
      `${r.createdAt || "????-??-??"} | ${(r.name || "").padEnd(6)} | lv=${String(r.level).padStart(2)} | ` +
      `票=${String(r.tickets).padStart(6)} | served=${String(r.served).padStart(4)} | rev=${String(r.totalRevenue).padStart(6)} | ` +
      `箭=${String(r.totalArrows).padStart(5)} | 探險=${r.expeditions} | 資源=${r.resources} ${suspicious}`
    );
  }

  // 重點：老玩家（有箭數/探險/資源）但 shop.createdAt 很新 → 被重置
  console.log("\n=== 老玩家但 shop 重建（高嫌疑）===");
  const suspects = rows.filter(r =>
    r.createdAt && r.createdAt >= "2026-08-13" &&
    (r.totalArrows > 100 || r.expeditions > 0 || r.resources > 5)
  );
  for (const r of suspects) {
    console.log(`\n▸ ${r.name} [${r.id}]`);
    console.log(`  createdAt=${r.createdAt} level=${r.level} tickets=${r.tickets} stock=${r.stockTotal}`);
    console.log(`  served=${r.served} totalTickets=${r.totalTickets} sales=${r.totalSales} revenue=${r.totalRevenue}`);
    console.log(`  totalArrows=${r.totalArrows} joinDate=${r.joinDate} expeditions=${r.expeditions} resources=${r.resources}`);
    console.log(`  shop=${JSON.stringify(r.shop).slice(0, 800)}`);
    console.log("");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
