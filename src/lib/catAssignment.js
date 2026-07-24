// src/lib/catAssignment.js
// 一隻貓同時只能在一個地方工作：
//   equipped   戰鬥夥伴（members.equippedCat.catId）
//   dig        地下城挖掘陪練（members.dungeonExcavation.assignedCatId）
//   expedition 遠征隊（members.expeditions.{0,1,2}.catId，含舊 members.expedition）
//   worker     貓貓村建築工作（members.village.workers.{buildingId}）
// 統一由此判斷，各指派點都用它擋重複指派。

export const CAT_JOB_LABELS = {
  equipped: "戰鬥夥伴",
  dig: "地下城挖掘陪練",
  expedition: "遠征隊",
  worker: "貓貓村建築工作",
};

// 回傳這隻貓目前在哪工作 { job, building? } 或 null
export function getCatJob(data, catId) {
  if (!data || !catId) return null;
  if (data.equippedCat?.catId === catId) return { job: "equipped" };
  if (data.dungeonExcavation?.assignedCatId === catId) return { job: "dig" };
  const exps = data.expeditions || {};
  for (const e of Object.values(exps)) {
    if (e && e.catId === catId) return { job: "expedition" };
  }
  if (data.expedition?.catId === catId) return { job: "expedition" }; // 舊單一欄位向後相容
  const workers = data.village?.workers || {};
  for (const [bid, wc] of Object.entries(workers)) {
    if (wc === catId) return { job: "worker", building: bid };
  }
  return null;
}

// 若貓在「非 exceptJob」的地方工作 → 回傳該 job（用於擋重複指派）；否則 null。
export function catBusyElsewhere(data, catId, exceptJob) {
  const j = getCatJob(data, catId);
  return j && j.job !== exceptJob ? j : null;
}

export function catBusyReason(job) {
  return `這隻貓正在「${CAT_JOB_LABELS[job] || job}」，一隻貓同時只能在一個地方工作。`;
}

// 全部被佔用的 catId 集合（供 UI 過濾；可傳 exceptJob 保留自己那格）
export function busyCatIdSet(data, exceptJob) {
  const set = new Set();
  if (!data) return set;
  const add = (id, job) => { if (id && job !== exceptJob) set.add(id); };
  add(data.equippedCat?.catId, "equipped");
  add(data.dungeonExcavation?.assignedCatId, "dig");
  Object.values(data.expeditions || {}).forEach(e => add(e?.catId, "expedition"));
  add(data.expedition?.catId, "expedition");
  Object.values(data.village?.workers || {}).forEach(id => add(id, "worker"));
  return set;
}
