// src/lib/catAssignment.js
// 一隻貓同時只能在一個地方工作：
//   equipped   戰鬥夥伴（members.equippedCat.catId）
//   dig        地下城挖掘陪練（members.dungeonExcavation.assignedCatId）
//   expedition 遠征隊（members.expeditions.{0,1,2}.catId，含舊 members.expedition）
//   worker     貓貓村建築工作（members.village.workers.{buildingId}）
// 統一由此判斷，各指派點都用它擋重複指派。
//
// ⚠️ except 一定要「精確到欄位」（{ job, key }），不能只用整個工作類別：
//    遠征有多個欄位、建築有多棟，若只排除整個 job，同一隻貓就能同時佔
//    slot0+slot1 或 建築A+建築B（真・重複出場）。key = 遠征 slot / 建築 id。

export const CAT_JOB_LABELS = {
  equipped: "戰鬥夥伴",
  dig: "地下城挖掘陪練",
  expedition: "遠征隊",
  worker: "貓貓村建築工作",
};

// 回傳這隻貓目前在哪工作 { job, key } 或 null（key：遠征 slot / 建築 id，其餘為 null）
export function getCatJob(data, catId) {
  if (!data || !catId) return null;
  if (data.equippedCat?.catId === catId) return { job: "equipped", key: null };
  if (data.dungeonExcavation?.assignedCatId === catId) return { job: "dig", key: null };
  for (const [slot, e] of Object.entries(data.expeditions || {})) {
    if (e && e.catId === catId) return { job: "expedition", key: String(slot) };
  }
  if (data.expedition?.catId === catId) return { job: "expedition", key: "legacy" }; // 舊單一欄位向後相容
  for (const [bid, wc] of Object.entries(data.village?.workers || {})) {
    if (wc === catId) return { job: "worker", key: bid };
  }
  return null;
}

// job（{job,key}）是否就是 except 指定的那一格（＝允許重寫自己那格，不算 busy）
function isSameSlot(job, except) {
  if (!except) return false;
  const ex = typeof except === "string" ? { job: except, key: null } : except;
  if (job.job !== ex.job) return false;
  return ex.key == null ? true : job.key === ex.key; // key 未指定＝整個類別（向後相容）
}

// 若貓在「非 except 那一格」的地方工作 → 回傳該 job（用於擋重複指派）；否則 null。
// except：字串（整個類別）或 { job, key }（精確到欄位，建議用這個）。
export function catBusyElsewhere(data, catId, except) {
  const j = getCatJob(data, catId);
  if (!j) return null;
  return isSameSlot(j, except) ? null : j;
}

export function catBusyReason(job) {
  return `這隻貓正在「${CAT_JOB_LABELS[job] || job}」，一隻貓同時只能在一個地方工作。`;
}

// 全部被佔用的 catId 集合（供 UI 過濾／反灰；except 保留自己那一格）
export function busyCatIdSet(data, except) {
  const set = new Set();
  if (!data) return set;
  const add = (id, job, key) => { if (id && !isSameSlot({ job, key }, except)) set.add(id); };
  add(data.equippedCat?.catId, "equipped", null);
  add(data.dungeonExcavation?.assignedCatId, "dig", null);
  Object.entries(data.expeditions || {}).forEach(([slot, e]) => add(e?.catId, "expedition", String(slot)));
  add(data.expedition?.catId, "expedition", "legacy");
  Object.entries(data.village?.workers || {}).forEach(([bid, id]) => add(id, "worker", bid));
  return set;
}
