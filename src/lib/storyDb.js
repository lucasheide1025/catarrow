// src/lib/storyDb.js — 故事本章節設定 Firestore 操作

import { collection, doc, getDocs, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { AUTO_ACHIEVEMENTS } from "./achievementDex";
import { getCertRecords, getCertification, getDexGrants } from "./db";

const COL = "storyChapterConfig";

// 讀取所有章節設定
export async function getStoryChapterConfigs() {
  try {
    const snap = await getDocs(collection(db, COL));
    const configs = {};
    snap.docs.forEach(d => { configs[d.id] = d.data(); });
    return configs;
  } catch { return {}; }
}

// 即時訂閱（admin 用）
export function subscribeStoryChapterConfigs(cb) {
  return onSnapshot(collection(db, COL), snap => {
    const configs = {};
    snap.docs.forEach(d => { configs[d.id] = d.data(); });
    cb(configs);
  });
}

// 儲存單一章節設定
export async function saveStoryChapterConfig(chapterKey, data) {
  try {
    await setDoc(doc(db, COL, chapterKey), data, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// 預先抓取成就判斷所需的額外資料（certRecords / certification / dexGrants）
export async function buildAchievementContext(profile) {
  if (!profile?.id) return { certRecords: [], certification: null, granted: [] };
  const [certRecords, certification, granted] = await Promise.all([
    getCertRecords(profile.id).catch(() => []),
    getCertification(profile.id).catch(() => null),
    getDexGrants(profile.id).catch(() => []),
  ]);
  return { certRecords, certification, granted };
}

// 判斷章節是否解鎖（前端用）
// config: { unlockType: "open"|"locked"|"achievement", requiredAchievements: [], hintText: "" }
// profile: member profile document
// achCtx: 由 buildAchievementContext() 回傳的額外資料
export function isChapterUnlocked(chapterKey, config, profile, achCtx = {}) {
  if (chapterKey === "ch0") return true; // 序章永遠開放

  if (!config) return false; // 無設定 = 鎖定

  if (config.unlockType === "open")   return true;
  if (config.unlockType === "locked") return false;

  if (config.unlockType === "achievement") {
    const ids = config.requiredAchievements || [];
    if (ids.length === 0) return true;
    return ids.every(achId => checkAchievement(achId, profile, achCtx));
  }

  return false;
}

// 成就檢查（對照 AUTO_ACHIEVEMENTS）
function checkAchievement(achievementId, profile, achCtx = {}) {
  const ach = AUTO_ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!ach) return false;
  try {
    return ach.check({
      member:        profile,
      certRecords:   achCtx.certRecords   || [],
      checkinCount:  profile?.dailyQuestCount || 0,
      certification: achCtx.certification || null,
      granted:       achCtx.granted       || [],
      dexStats:      null,
    });
  } catch { return false; }
}
