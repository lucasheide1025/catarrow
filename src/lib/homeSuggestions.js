// src/lib/homeSuggestions.js
// ─────────────────────────────────────────────────────────────
// 🗺️ 首頁「進行中」的空狀態 → 改成「今天可以做什麼」。
//
// ⚠️ 首頁最怕的是**打開來沒事做**。舊版在沒有任何進行中的事情時
//    直接 `return null`，整張卡消失——那正是最需要給方向的時候。
//
// ⚠️ 純函式，**只吃首頁已經訂閱的資料**（報到、世界王、村目標、遠征槽），
//    不為了推薦而多讀任何一筆 Firestore。
// ─────────────────────────────────────────────────────────────

/** 遠征總槽位數（首頁 expSlots 只回「有貓的」那些） */
export const EXPEDITION_SLOTS = 3;

/**
 * @returns [{ key, icon, title, desc, page }] 依優先順序，最多 3 筆
 */
export function suggestNextActions({
  checkedIn = false, worldBossActive = false, worldBossCharging = false,
  villageGoal = null, expeditionCount = 0, certOpen = false,
  boardOpen = true,
} = {}) {
  const all = [];

  // ⚠️ 報到永遠排第一：沒報到的話今天射的箭很多都不列入計算
  if (!checkedIn) {
    all.push({ key: "checkin", icon: "📍", title: "先完成今日報到",
      desc: "報到後今天的箭數與獎勵才算得進去", page: "home" });
  }
  if (worldBossActive) {
    all.push({ key: "worldboss", icon: "👑", title: "世界王正在場上",
      desc: "今天還沒打的話，去補一刀", page: "worldboss" });
  } else if (worldBossCharging) {
    all.push({ key: "wbcharge", icon: "🌀", title: "推進世界王降臨進度",
      desc: "射箭、通關、擲骰都算——推滿就提早出現", page: "worldboss" });
  }
  if (certOpen) {
    all.push({ key: "cert", icon: "🎖️", title: "年度檢定開放中",
      desc: "考到越高級，三圍越強，現在就能報名", page: "comps" });
  }
  if (expeditionCount < EXPEDITION_SLOTS) {
    all.push({ key: "expedition", icon: "🐾",
      title: `派貓咪出遠征（還有 ${EXPEDITION_SLOTS - expeditionCount} 個空槽）`,
      desc: "掛著就會自己產出，別讓槽位空著", page: "gacha" });
  }
  if (villageGoal?.status === "active") {
    all.push({ key: "villagegoal", icon: "🏡", title: "村目標還在進行",
      desc: "有貢獻就拿得到獎勵，推越多拿越多", page: "gacha" });
  }
  if (boardOpen) {
    all.push({ key: "board", icon: "🎲", title: "貓貓村探索地圖",
      desc: "每日 15 顆骰子，擲骰冒險拿寶箱與素材", page: "board" });
  }
  // ⚠️ 保底：上面全都不成立時，也**一定要給一件事做**，不能是空的
  //    ⚠️ 打怪頁是 monster（battle 在 MemberApp 不是有效頁面）
  all.push({ key: "battle", icon: "⚔️", title: "去打怪練等",
      desc: "累積射手經驗與素材", page: "monster" });

  return all.slice(0, 3);
}
