// 深度調查高嫌疑被重置玩家（葉浩生/施聖凱/楊皇偉/莊淑惠）
// 證據鏈：老玩家（箭數/資源/探險）+ shop.createdAt 晚 + stats 全 0
// 目的：確認是否真的被重置 + 收集復原所需的資訊
const admin = require("firebase-admin");
const path = require("path");

const keyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(keyPath) });
const db = admin.firestore();

const SUSPECTS = {
  "DQPs5FGOkrY2RjHCMbh1CUgiEbF3": "葉浩生",
  "": "",
};

async function main() {
  // 用名稱找（較可靠，避免記錯 id）
  const names = ["葉浩生", "施聖凱", "楊皇偉", "莊淑惠"];
  const snap = await db.collection("members").get();
  for (const docSnap of snap.docs) {
    const d = docSnap.data();
    if (!names.includes(d.name)) continue;
    console.log("==================================================");
    console.log(`▸ ${d.name} [${docSnap.id}]`);
    console.log("==================================================");
    console.log(`joinDate=${d.joinDate} totalArrows=${d.totalArrowsAllTime || d.totalArrows}`);
    console.log(`accountType=${d.accountType} coins=${d.coins}`);
    // 探險紀錄（可能顯示 slot 與獎勵）
    if (d.expeditions) {
      console.log("expeditions:", JSON.stringify(d.expeditions, (k, v) => v?.toDate ? v.toDate().toISOString() : v, 2).slice(0, 2000));
    }
    // 成就
    const ach = d.achievements || d.achievementDex || {};
    if (Object.keys(ach).length) {
      console.log("achievements keys:", Object.keys(ach).slice(0, 20));
      // 找 shop 相關成就
      const shopAch = Object.entries(ach).filter(([k]) => /shop|store/i.test(k));
      console.log("shop achievements:", JSON.stringify(shopAch));
    }
    // 完整 village
    console.log("village.resources:", JSON.stringify(d.village?.resources || {}).slice(0, 1200));
    // 完整 shop
    console.log("shop FULL:", JSON.stringify(d.village?.shop, (k, v) => v?.toDate ? v.toDate().toISOString() : v, 2).slice(0, 3000));
    console.log("");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
