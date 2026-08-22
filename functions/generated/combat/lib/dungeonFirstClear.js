"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DUNGEON_DIFFICULTY_TIERS = void 0;
exports.buildDungeonFirstClearKey = buildDungeonFirstClearKey;
exports.getDungeonFirstClearState = getDungeonFirstClearState;
exports.normalizeDungeonDifficultyTier = normalizeDungeonDifficultyTier;
exports.normalizeWorldFirstClearInput = normalizeWorldFirstClearInput;
const VALID_FAMILIES = new Set(["ghost", "mountain", "insect", "workplace", "exam", "temple"]);

// 地下城地圖的難度是字串（dungeonData.js 的 DUNGEON_MAPS：normal／advanced／hard／hell），
// 遠征的難度則是 1～6 的數字（EXCAVATION_DIFFICULTIES）。兩條路徑共用同一組首次通關鍵，
// 所以字串必須對映到固定數字。這組數字沿用 DungeonBattleRoom 原本寫入時內嵌的對映，
// 不能改動，否則已寫進 members.dungeonFirstClears 的紀錄會全部對不上。
const DUNGEON_DIFFICULTY_TIERS = exports.DUNGEON_DIFFICULTY_TIERS = {
  normal: 1,
  advanced: 3,
  hard: 4,
  hell: 5
};
function normalizeDungeonDifficultyTier(value) {
  if (typeof value === "string") {
    const mapped = DUNGEON_DIFFICULTY_TIERS[value.trim().toLowerCase()];
    // 純數字字串（例如 "3"）仍照數字處理；無法辨識的字串才退回 1
    if (mapped) return mapped;
  }
  const tier = Math.floor(Number(value) || 0);
  return Math.min(6, Math.max(1, tier));
}
function buildDungeonFirstClearKey(family, difficultyTier) {
  const normalizedFamily = String(family || "").trim().toLowerCase();
  if (!VALID_FAMILIES.has(normalizedFamily)) return null;
  return `${normalizedFamily}_t${normalizeDungeonDifficultyTier(difficultyTier)}`;
}
function getDungeonFirstClearState(profile, dungeon) {
  const key = buildDungeonFirstClearKey(dungeon?.family, dungeon?.difficulty);
  if (!key) return {
    key: null,
    eligible: false,
    completed: false,
    known: true,
    reason: "此地下城不列入六族首次通關"
  };
  // 只有「profile 還沒載入」才算未知。原本判斷 profile.dungeonFirstClears == null，
  // 但從沒通關過的射手根本不會有這個欄位，於是永遠卡在「首次通關資料讀取中」，
  // 首次通關獎勵狀態一直顯示不出來。欄位不存在＝已載入且尚無任何首次通關紀錄。
  if (!profile) return {
    key,
    eligible: true,
    completed: false,
    known: false,
    reason: "首次通關資料讀取中"
  };
  const records = profile.dungeonFirstClears || {};
  const record = records[key] || null;
  return {
    key,
    eligible: true,
    completed: !!record,
    known: true,
    record,
    reason: record ? "已完成首次通關" : "首次通關獎勵尚未取得"
  };
}
function normalizeWorldFirstClearInput({
  family,
  difficultyTier,
  hostId,
  hostName,
  teamMemberIds = [],
  teamNames = [],
  runId
}) {
  const key = buildDungeonFirstClearKey(family, difficultyTier);
  if (!key || !hostId || !runId) return null;
  return {
    key,
    family: String(family).toLowerCase(),
    difficultyTier: normalizeDungeonDifficultyTier(difficultyTier),
    ownerId: hostId,
    ownerName: hostName || "射手",
    teamMemberIds: [...new Set([hostId, ...teamMemberIds].filter(Boolean))],
    teamNames: [...new Set([hostName, ...teamNames].filter(Boolean))],
    runId
  };
}
