// scripts/fix-village-allocation-tiers.js
// 一次性遷移（2026-08-08）：修「建築 ≥9 級但產能分配缺新解鎖 tier」的舊帳號。
// 背景：getDefaultAllocation 舊邏輯只把產能分給「前 maxSlots 個 tier」——
//   stage3（Lv9~12）只有 2 槽 → T3 預設 0%；stage4（Lv13~16）3 槽 → T4 0%；
//   stage5（Lv17~20）3 槽 → T4/T5 0%。升級也不會遷移既有分配，
//   導致玩家建築到 9 級後 T3 永遠不生產（13 級 T4、17 級 T5 同理）。
// 本腳本掃描全部 members：當「建築已解鎖 tier 數 > 既有分配最高正 tier」時，
// 用與 upgradeVillageBuilding 相同的公式重分配（新 tier 取均分、舊 tier 等比縮放）。
//
// ⚠️ 預設為 DRY-RUN（只報告不寫入）；確認無誤後加 --apply 才真正寫入 Firestore。
//   執行：node scripts/fix-village-allocation-tiers.js [--apply]
// ⚠️ 觸發條件「最高正 tier < 已解鎖 tier」無法區分「舊 bug 造成的 0%」與「玩家刻意只產
//   低階」，兩者都會被重分配——一次性修復接受此風險；如需精準可改比對舊預設形狀。
// ⚠️ 舊格式分配鍵（t1/tier1）不會被正規化（與 app 的 normalizeBuildingAllocation 不同），
//   會被視為 0 而重分配；空物件 {} 也會被重分配（結果等同新預設，無害）。
const admin = require("firebase-admin");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const svc = require(path.join(ROOT, "serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(svc) });
const db = admin.firestore();

// 與 src/lib/villageData.js 的 getBuildingStage 相同（腳本不能直接 require ESM）
function stageOf(level) {
  if (level <= 4) return 1;
  if (level <= 8) return 2;
  if (level <= 12) return 3;
  if (level <= 16) return 4;
  return 5;
}

// 只有分層資源建築需要分配（煉金室箭露/扭蛋亭代幣不在此列）
const TIERED_BUILDINGS = ["mine", "farm", "harbor", "hunting", "market", "warehouse", "archery"];
const B_NAME = { mine: "礦山", farm: "農地", harbor: "海港", hunting: "獵場", market: "市集", warehouse: "倉庫", archery: "練箭場" };

// 讀出「最高有正比例」的 tier（先正規化：只認數字鍵、<=0 視為 0）
function highestPositiveTier(saved, maxTier) {
  let highest = 0;
  for (let t = 1; t <= maxTier; t++) {
    const v = Number(saved && saved[String(t)]);
    if (Number.isFinite(v) && v > 0) highest = t;
  }
  return highest;
}

// 與 src/lib/db.js upgradeVillageBuilding 相同的重分配公式
function rebalance(saved, maxTier) {
  const share = Math.round(100 / maxTier);
  const oldShare = 100 - share;
  const next = {};
  for (let t = 1; t <= maxTier; t++) {
    next[String(t)] = t === maxTier
      ? share
      : Math.round((Number(saved && saved[String(t)]) || 0) * oldShare / 100);
  }
  const sum = Object.values(next).reduce((a, b) => a + b, 0);
  if (sum !== 100) next["1"] = Math.max(0, (next["1"] || 0) + (100 - sum));
  return next;
}

(async () => {
  const APPLY = process.argv.includes("--apply");
  console.log(`專案：${svc.project_id}  模式：${APPLY ? "APPLY（會寫入！）" : "DRY-RUN（僅報告）"}`);

  let scanned = 0, changedMembers = 0, changedBuildings = 0, skippedNoAlloc = 0;
  const samples = [];
  const batch = db.batch();
  let batchOps = 0;   // 目前 batch 內尚未 commit 的 op 數
  let appliedTotal = 0; // --apply 實際寫入的建築分配數

  const stream = db.collection("members").stream();
  for await (const doc of stream) {
    scanned++;
    const village = doc.data().village;
    if (!village || !village.buildings) continue;
    const buildings = village.buildings;
    const allocations = village.allocations || {};

    const memberUpdates = [];
    for (const id of TIERED_BUILDINGS) {
      const lv = Number(buildings[id]) || 1;
      const maxTier = stageOf(lv);
      if (maxTier <= 2) continue;           // 只有 stage3+ 才受舊 bug 影響
      const saved = allocations[id];
      if (!saved) { skippedNoAlloc++; continue; }  // 無分配 → 新預設已含全部 tier，不需寫
      const highest = highestPositiveTier(saved, maxTier);
      if (highest >= maxTier) continue;      // 新 tier 已有正比例 → 不需動
      const next = rebalance(saved, maxTier);
      memberUpdates.push({ building: id, name: B_NAME[id] || id, lv, from: saved, to: next });
      if (APPLY) {
        batch.update(doc.ref, { [`village.allocations.${id}`]: next });
        batchOps++;
        appliedTotal++;
        if (batchOps >= 400) { await batch.commit(); batchOps = 0; }
      }
    }
    if (memberUpdates.length) {
      changedMembers++;
      changedBuildings += memberUpdates.length;
      if (samples.length < 8) samples.push({ memberId: doc.id, updates: memberUpdates });
    }
  }
  if (APPLY && batchOps > 0) { await batch.commit(); batchOps = 0; }

  console.log(`掃描 ${scanned} 位成員`);
  console.log(`受影響成員：${changedMembers} 位；受影響建築：${changedBuildings} 棟` +
    `（無分配欄位而跳過：${skippedNoAlloc}）`);
  for (const s of samples) {
    for (const u of s.updates) {
      console.log(`  ${s.memberId}  ${u.name} Lv${u.lv}: ${JSON.stringify(u.from)} → ${JSON.stringify(u.to)}`);
    }
  }
  if (APPLY) console.log(`\n✅ 已套用完成：共寫入 ${appliedTotal} 筆建築分配`);
  else console.log(`\n（DRY-RUN 未寫入；確認後請以 --apply 執行）`);
  process.exit(0);
})().catch((e) => { console.error("MIGRATE_ERR", e); process.exit(1); });
