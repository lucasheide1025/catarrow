// backup.js — 備份 Firestore 所有 collection 到 JSON 檔
// 執行方式：node backup.js
// 需求：serviceAccount.json 放在同目錄（從 Firebase Console 下載）

const admin = require("firebase-admin");
const fs    = require("fs");
const path  = require("path");

const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(SA_PATH)) {
  console.error("❌ 找不到 serviceAccountKey.json，請先從 Firebase Console 下載並放在專案根目錄");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)) });
const db = admin.firestore();

const COLLECTIONS = [
  "members", "admins", "competitions", "results",
  "registrations", "messages", "learnLogs", "practiceLogs",
  "badgeLogs", "certRecords", "achievements", "externalComps",
  "auditLogs", "monthlyCardRequests", "monthlyCardLogs", "monthlyCardConfig",
  "checkins", "dailyQuestConfig",
  "monsterConfig", "monsterSessions", "monsterLogs", "monsterDex", "craftStats",
  "duelRooms", "duelStats", "partyRooms", "partyConfig",
];

function toJSON(val) {
  if (val === null || val === undefined) return val;
  if (val && typeof val.toDate === "function") return val.toDate().toISOString();
  if (val && val._seconds !== undefined) return new Date(val._seconds * 1000).toISOString();
  if (Array.isArray(val)) return val.map(toJSON);
  if (typeof val === "object") {
    const out = {};
    for (const k of Object.keys(val)) out[k] = toJSON(val[k]);
    return out;
  }
  return val;
}

async function backup() {
  const result = {};
  let totalDocs = 0;

  for (const col of COLLECTIONS) {
    try {
      const snap = await db.collection(col).get();
      result[col] = {};
      snap.forEach(doc => {
        result[col][doc.id] = toJSON(doc.data());
        totalDocs++;
      });
      console.log("  ok " + col + " (" + snap.size + " 筆)");
    } catch (e) {
      console.warn("  skip " + col + ": " + e.message);
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = "backup_" + ts + ".json";
  fs.writeFileSync(filename, JSON.stringify(result, null, 2), "utf8");
  console.log("\n備份完成：" + filename + "（共 " + totalDocs + " 筆文件）");
}

backup().catch(function(err) { console.error("備份失敗：", err.message); process.exit(1); });
