// 執行方式：node init-admin-member.js
// 執行完後可以刪掉這個檔案

const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyAFCQeV757IXl4_UgN47Gr3Q_xSwJb2Asw",
  authDomain: "catgroup-8d0bb.firebaseapp.com",
  projectId: "catgroup-8d0bb",
  storageBucket: "catgroup-8d0bb.firebasestorage.app",
  messagingSenderId: "733358557637",
  appId: "1:733358557637:web:2ebe75b505d0c6bc5e63ac",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function init() {
  // 修改這裡的資料
  const members = [
    {
  uid: "dSNJDMwcJKg1g5OJ9K9tDsoUzMf1",
  name: "蘇靜琳",
  nickname: "小白",
  archerNo: "00109",
  archerNoDate: "",
  joinDate: "2025-01-01",
  phone: "",
  note: "",
  equipment: [],
  fatCat:      { gold: 0, silver: 0, bronze: 0 },
  score:       { gold: 0, silver: 0, bronze: 0 },
  achievement: { black: 0, gold: 0, silver: 0 },
  eventPoints: 0,
  scoreHistory: [],
  learnLog: [],
},
    // 第二個教練複製上面這段，換掉 uid 和資料
  ];

  for (const m of members) {
    const { uid, ...data } = m;
    await setDoc(doc(db, "members", uid), {
      ...data,
      createdAt:   new Date(),
      updatedAt:   new Date(),
      lastLoginAt: new Date(),
    });
    console.log(`✓ 已建立：${data.name} (${uid})`);
  }

  console.log("完成！");
  process.exit(0);
}

init().catch(e => { console.error(e); process.exit(1); });