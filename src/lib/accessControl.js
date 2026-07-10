// src/lib/accessControl.js
// 學生分級與系統鎖定 — 純函式核心判斷邏輯
// 詳見 .trellis/tasks/07-04-student-tier-lock/design.md

// 內建預設值（systemConfig/tierPermissions 文件不存在時的 fallback）
export const DEFAULT_TIER_PERMISSIONS = {
  restricted: ["home", "training-hub", "practice", "profile"],
  autoLocked: ["home", "training-hub", "practice", "gacha", "profile", "achievements"],
  retired:    ["profile"],
};

// 全部可勾選的頁面清單（供權限設定頁生成打勾矩陣，分組顯示用）
export const PAGE_REGISTRY = [
  { group: "首頁", pages: [{ id: "home", label: "首頁（含報到）" }] },
  { group: "冒險", pages: [
    { id: "adventure-hub", label: "冒險大廳" }, { id: "monster", label: "打怪" },
    { id: "party", label: "組隊" }, { id: "party-quest", label: "組隊任務" },
    { id: "party-battle", label: "組隊戰鬥" }, { id: "duel", label: "決鬥大廳" },
    { id: "duel-room", label: "決鬥房" }, { id: "dungeon", label: "地下城" },
    { id: "dungeon-room", label: "地下城房間" }, { id: "worldboss", label: "世界王" },
    { id: "guild", label: "公會" }, { id: "monsterdex", label: "怪物圖鑑" },
  ]},
  { group: "練箭", pages: [
    { id: "training-hub", label: "練箭大廳" }, { id: "practice", label: "自主練習" },
    { id: "comps", label: "比賽列表" }, { id: "comp-detail", label: "比賽詳情" },
  ]},
  { group: "貓村", pages: [{ id: "gacha", label: "貓村" }] },
  { group: "預約", pages: [{ id: "booking", label: "線上約課（07-10-booking-system-student-pilot）" }] },
  { group: "背包", pages: [
    { id: "inventory-hub", label: "背包大廳" }, { id: "coinshop", label: "商店" },
    { id: "materials", label: "材料" }, { id: "cats", label: "貓咪" },
    { id: "catbook", label: "貓咪圖鑑" }, { id: "story", label: "故事書" },
    { id: "equipment", label: "裝備" }, { id: "cards", label: "怪物卡片" },
  ]},
  { group: "我的", pages: [
    { id: "profile", label: "個人資料" }, { id: "learn", label: "學習資源" },
    { id: "msgs", label: "公告訊息" }, { id: "history", label: "歷史紀錄" },
    { id: "external", label: "外部比賽" }, { id: "achievements", label: "成就" },
    { id: "certexam", label: "檢定考試" }, { id: "notifications", label: "通知" },
    { id: "dex", label: "成就圖鑑" }, { id: "guide", label: "使用說明" },
    { id: "leaderboard", label: "排行榜" }, { id: "bowsetting", label: "弓具設定" },
  ]},
];

// "YYYY-MM-DD" 兩個日期字串相減的天數（不做時區精算，14 天判斷粒度足夠寬鬆）
function daysBetween(dateStr, todayDateStr) {
  const a = new Date(`${dateStr}T00:00:00`);
  const b = new Date(`${todayDateStr}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 14 天未報到判斷（純函式，client-side 計算，無需 Cloud Functions）
export function isAutoLocked(member) {
  if (!member) return false;
  if (member.studentTier !== "official") return false;
  if (!member.lastCheckinDate) return false; // 遷移策略：新欄位剛上線者不誤鎖
  const days = daysBetween(member.lastCheckinDate, todayStr());
  return days > 14;
}

// tierPermissions：從 Firestore 訂閱取得的設定物件（缺項時逐一 fallback 到預設值）
// 回傳 null = 不限制（全開）；否則回傳允許頁面 id 陣列
export function getAllowedPages(member, role, tierPermissions) {
  if (role === "admin") return null;                    // 教練完全豁免
  if (!member) return null;                              // profile 尚未載入，暫不限制（避免載入中誤鎖）
  if (member.accountFrozen) return [];                   // 凍結：什麼都不行（連 home 都不行）
  const perms = tierPermissions || DEFAULT_TIER_PERMISSIONS;
  const tier = member.studentTier || "restricted";        // 缺欄位 → restricted
  if (tier === "retired")     return perms.retired    ?? DEFAULT_TIER_PERMISSIONS.retired;
  if (tier === "restricted")  return perms.restricted ?? DEFAULT_TIER_PERMISSIONS.restricted;
  if (isAutoLocked(member))   return perms.autoLocked ?? DEFAULT_TIER_PERMISSIONS.autoLocked;
  return null;                                            // official 且未鎖定：全開
}

export function isPageAllowed(member, role, pageId, tierPermissions) {
  const allowed = getAllowedPages(member, role, tierPermissions);
  return allowed === null || allowed.includes(pageId);
}
