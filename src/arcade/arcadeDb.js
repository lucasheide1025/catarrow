// src/arcade/arcadeDb.js — 訪客冒險本機儲存（Local First）
// 資料只存在訪客手機，永不自動上雲。優先 IndexedDB；不可用時（隱私模式／測試環境）
// 降級 localStorage，最後是記憶體。99% 單人遊戲過程不需要任何雲端讀寫。

const DB_NAME = "cat-arcade";
const DB_VERSION = 1;
const STORE = "kv";
const PROFILE_KEY = "visitorProfile";
const SESSION_KEY = "adventureSession";
const CURRENT_TEAM_KEY = "currentTeamRoom";
const CURRENT_DUEL_KEY = "currentDuelRoom";
const LS_PREFIX = "cat-arcade:";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no-indexeddb"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb-open-failed"));
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 最後一道防線：IndexedDB 與 localStorage 都不可用時的記憶體暫存
const mem = new Map();

async function memGet(key) {
  return mem.has(key) ? mem.get(key) : null;
}

export const arcadeStore = {
  async get(key) {
    try {
      const db = await openDb();
      try {
        const v = await idbGet(db, key);
        if (v !== null) return v;
      } finally {
        db.close();
      }
    } catch { /* 降級 */ }
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      if (raw) return JSON.parse(raw);
    } catch { /* 降級 */ }
    return memGet(key);
  },
  async put(key, value) {
    mem.set(key, value);
    try {
      const db = await openDb();
      try {
        await idbPut(db, key, value);
        return;
      } finally {
        db.close();
      }
    } catch { /* 降級 */ }
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch { /* 只剩記憶體 */ }
  },
  async remove(key) {
    mem.delete(key);
    try {
      const db = await openDb();
      try {
        await idbDelete(db, key);
        return;
      } finally {
        db.close();
      }
    } catch { /* 降級 */ }
    try {
      localStorage.removeItem(LS_PREFIX + key);
    } catch { /* ignore */ }
  },
};

export async function loadVisitorProfile() {
  return arcadeStore.get(PROFILE_KEY);
}
export async function saveVisitorProfile(profile) {
  await arcadeStore.put(PROFILE_KEY, profile);
}
export async function clearVisitorProfile() {
  await arcadeStore.remove(PROFILE_KEY);
}
export async function loadAdventureSession() {
  return arcadeStore.get(SESSION_KEY);
}
export async function saveAdventureSession(session) {
  await arcadeStore.put(SESSION_KEY, session);
}

// ── 目前組隊房間（防斷線：重整/回鍋自動回到原房間）────────────
// { roomCode, round, arrows }——round+arrows 用於斷線後恢復輸入中的箭數。
export async function loadCurrentTeamRoom() {
  return arcadeStore.get(CURRENT_TEAM_KEY);
}
export async function saveCurrentTeamRoom(info) {
  await arcadeStore.put(CURRENT_TEAM_KEY, info);
}
export async function clearCurrentTeamRoom() {
  await arcadeStore.remove(CURRENT_TEAM_KEY);
}

// ── 射手競技場本機斷線恢復 ────────────────────────────────
// 僅保存在玩家自己的瀏覽器，不進 Firestore。
// { roomCode, round, arrows, targetId, savedAt }
export async function loadCurrentDuelRoom() {
  return arcadeStore.get(CURRENT_DUEL_KEY);
}
export async function saveCurrentDuelRoom(info) {
  await arcadeStore.put(CURRENT_DUEL_KEY, info);
}
export async function clearCurrentDuelRoom() {
  await arcadeStore.remove(CURRENT_DUEL_KEY);
}

// ── M1：雲端保存（arcadeProfiles/{visitorId}）─────────────────
// 本機為主、雲端備份：載入時合併、存檔時推、離線後自動補傳。
// 合併策略：lastPlayedAt 新者勝，各欄位取較高值（coins/xCount/bestCombo…）
const CLOUD_COLLECTION = "arcadeProfiles";
let _pendingSync = null; // 節流推送排隊

/** 合併純函式（可測試）：本地 + 雲端 → merged。取各欄位較大值。 */
export function mergeRemoteProfile(local, remote) {
  if (!remote || !local) return local || remote || null;
  if (!local.lastPlayedAt || !remote.lastPlayedAt) return local;
  // lastPlayedAt 新者勝；若有新版本比舊版本新，以新為主，合併舊的互補欄位
  const newer = remote.lastPlayedAt > local.lastPlayedAt ? remote : local;
  const older = remote.lastPlayedAt > local.lastPlayedAt ? local : remote;
  // 數值欄位取最大值（金幣、經驗、XP 累計），避免換裝置洗掉
  const maxNum = (a, b) => Math.max(a || 0, b || 0);
  // statistics 欄位：逐欄 max（避免離線打了新成績被雲端舊版覆蓋）
  const mergeStats = (l, r) => {
    if (!l && !r) return {};
    if (!l) return r;
    if (!r) return l;
    const out = { ...l };
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "number") out[k] = maxNum(out[k], v);
    }
    return out;
  };
  // teamStats：取兩邊的 max
  const mergeTeamStats = (l, r) => {
    if (!l && !r) return {};
    const out = { ...(l || {}) };
    for (const [mode, rStats] of Object.entries(r || {})) {
      const lStats = out[mode] || {};
      out[mode] = {
        wins: maxNum(lStats.wins, rStats.wins),
        bestCombo: maxNum(lStats.bestCombo, rStats.bestCombo),
        bestTimeMs: lStats.bestTimeMs > 0 && rStats.bestTimeMs > 0
          ? Math.min(lStats.bestTimeMs, rStats.bestTimeMs)
          : maxNum(lStats.bestTimeMs, rStats.bestTimeMs),
      };
    }
    return out;
  };
  // inventory：合併兩邊（同物品取 max，避免換裝置清空）
  const mergeInv = (l, r) => {
    if (!l && !r) return {};
    const out = { ...(l || {}) };
    for (const [k, v] of Object.entries(r || {})) {
      out[k] = maxNum(out[k], v);
    }
    return out;
  };
  // achievements：併集（不重複）
  const mergeAch = (l, r) => {
    const s = new Set([...(l || []), ...(r || [])]);
    return [...s];
  };
  return {
    ...older,
    ...newer,
    // 數值欄位取 max
    coins: maxNum(newer.coins, older.coins),
    catLevel: maxNum(newer.catLevel, older.catLevel),
    // xp 跟隨等級較高的一方（等級相同取較大進度），避免高級帳號被低級帳號的進度覆蓋
    xp: (newer.catLevel || 1) > (older.catLevel || 1)
      ? newer.xp || 0
      : (older.catLevel || 1) > (newer.catLevel || 1)
        ? older.xp || 0
        : maxNum(newer.xp, older.xp),
    // 結構欄位合併
    statistics: mergeStats(newer.statistics, older.statistics),
    teamStats: mergeTeamStats(newer.teamStats, older.teamStats),
    // PvP 生涯統計本體仍只存在本機；這裡只防止之後其他功能做雲端合併時把它洗掉。
    duelStats: mergeStats(newer.duelStats, older.duelStats),
    inventory: mergeInv(newer.inventory, older.inventory),
    achievements: mergeAch(newer.achievements, older.achievements),
    // 保留 newer 的 identity 欄位（nickname、selectedCat、cats 以 newer 為主）
    lastPlayedAt: Math.max(newer.lastPlayedAt || 0, older.lastPlayedAt || 0),
  };
}

/** PvP 生涯統計是 local-only：任何 arcadeProfiles 上傳都先經過這個純函式。 */
export function profileForCloud(profile) {
  if (!profile) return profile;
  const cloudProfile = { ...profile };
  delete cloudProfile.duelStats;
  return cloudProfile;
}

/** 寫入雲端（fire-and-forget，失敗不影響本機進度） */
export async function syncProfileToCloud(profile) {
  if (!profile?.visitorId) return;
  try {
    const [{ doc, setDoc }, { db: firestoreDb }] = await Promise.all([
      import("firebase/firestore"),
      import("../lib/firebase"),
    ]);
    // PvP 生涯資料刻意不進 arcadeProfiles；它只留在玩家自己的 IndexedDB。
    await setDoc(doc(firestoreDb, "arcadeProfiles", profile.visitorId), profileForCloud(profile));
  } catch { /* 離線或網路失敗 → 下次補傳 */ }
}

/** 從雲端拉取（失敗回傳 null） */
export async function loadProfileFromCloud(visitorId) {
  if (!visitorId) return null;
  try {
    const [{ doc, getDoc }, { db: firestoreDb }] = await Promise.all([
      import("firebase/firestore"),
      import("../lib/firebase"),
    ]);
    const snap = await getDoc(doc(firestoreDb, "arcadeProfiles", visitorId));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

/**
 * 載入時同步本機與雲端：
 *   1. 讀本機 profile → 2. 拉雲端 → 3. 合併 → 4. 存回本機+雲端 → 5. 回傳。
 *   若本機無 profile 但雲端有 → 用雲端版本初始化本機（新裝置還原）。
 */
export async function syncProfileOnLoad() {
  const local = await loadVisitorProfile();
  const remote = await loadProfileFromCloud(local?.visitorId);
  if (!local && !remote) return null;
  if (local && !remote) {
    // 本機有、雲端沒有 → 推雲端（首次上傳）
    syncProfileToCloud(local); // fire-and-forget
    return local;
  }
  if (!local && remote) {
    // 本機沒有、雲端有 → 雲端版本寫回本機（新裝置還原）
    await saveVisitorProfile(remote);
    return remote;
  }
  // 兩邊都有 → 合併（取較新+較大）
  const merged = mergeRemoteProfile(local, remote);
  if (merged && merged !== local) {
    await saveVisitorProfile(merged);
    syncProfileToCloud(merged); // fire-and-forget
  }
  return merged || local;
}

/**
 * 存檔後推雲端（節流15秒避免過度寫入 Firestore）。
 * 呼叫端把 saveVisitorProfile 換成這個即可：本機寫完 + 背景推雲端。
 */
let _cloudTimer = null;
export function saveVisitorProfileWithCloud(profile) {
  // 立刻寫本機（不等雲端）
  saveVisitorProfile(profile);
  // 節流推雲端：15秒內多次呼叫只推最後一次
  _pendingSync = profile;
  if (_cloudTimer) return;
  _cloudTimer = setTimeout(() => {
    _cloudTimer = null;
    if (_pendingSync) syncProfileToCloud(_pendingSync);
    _pendingSync = null;
  }, 15000);
}

/**
 * 離線→上線偵測：網路恢復時把排隊中的 profile 推雲端。
 * 在 ArcadeApp 掛載時呼叫一次即可。
 */
export function setupCloudSyncListener() {
  const go = async () => {
    if (_pendingSync) {
      await syncProfileToCloud(_pendingSync);
      _pendingSync = null;
    } else {
      const p = await loadVisitorProfile();
      if (p) await syncProfileToCloud(p);
    }
  };
  window.addEventListener("online", go);
  return () => window.removeEventListener("online", go);
}
