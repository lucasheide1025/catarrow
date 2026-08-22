// src/arcade/arcadeDb.js — 訪客冒險本機儲存（Local First）
// 資料只存在訪客手機，永不自動上雲。優先 IndexedDB；不可用時（隱私模式／測試環境）
// 降級 localStorage，最後是記憶體。99% 單人遊戲過程不需要任何雲端讀寫。

import { normalizeArcadeProfile } from "./arcadeProgression";

const DB_NAME = "cat-arcade";
const DB_VERSION = 1;
const STORE = "kv";
const PROFILE_KEY = "visitorProfile";
const SESSION_KEY = "adventureSession";
const CURRENT_TEAM_KEY = "currentTeamRoom";
const CURRENT_DUEL_KEY = "currentDuelRoom";
const LS_PREFIX = "cat-arcade:";
const PROFILE_SIGNAL_KEY = `${LS_PREFIX}profile-sync-signal`;
const PROFILE_LOCK_KEY = `${LS_PREFIX}profile-write-lock`;
const SYNC_CHANNEL = "cat-arcade-sync";
export const ADVENTURE_SESSION_STALE_MS = 30000;

function makeLocalId(prefix) {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
  } catch { /* fallback */ }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const TAB_ID = makeLocalId("tab");
let localMutationTail = Promise.resolve();

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
  return normalizeArcadeProfile(await arcadeStore.get(PROFILE_KEY));
}
export async function saveVisitorProfile(profile) {
  const current = normalizeArcadeProfile(await arcadeStore.get(PROFILE_KEY));
  const next = prepareProfileWrite(current, profile);
  await arcadeStore.put(PROFILE_KEY, next);
  notifyProfileChanged(next);
  return next;
}
export async function clearVisitorProfile() {
  await arcadeStore.remove(PROFILE_KEY);
  notifyProfileChanged(null);
}
export async function loadAdventureSession() {
  return arcadeStore.get(SESSION_KEY);
}
export async function saveAdventureSession(session) {
  await arcadeStore.put(SESSION_KEY, session);
}

export async function clearAdventureSession(runId = null) {
  const current = await loadAdventureSession();
  if (!current) return;
  if (runId && current.runId !== runId) return;
  await arcadeStore.remove(SESSION_KEY);
}

export function getArcadeTabId() {
  return TAB_ID;
}

export function decideAdventureSessionClaim(current, { mode, force = false, tabId = TAB_ID, now = Date.now() } = {}) {
  const fresh = current && now - (Number(current.heartbeatAt) || 0) < ADVENTURE_SESSION_STALE_MS;
  const active = !!(fresh && !current?.settled);
  if (active && current.ownerTabId !== tabId && !force) {
    return { kind: "conflict", session: current };
  }
  if (active && (force || (current.ownerTabId === tabId && current.mode === mode))) {
    return {
      kind: "resume",
      session: {
        ...current,
        ownerTabId: tabId,
        heartbeatAt: now,
        revision: (current.revision || 0) + 1,
      },
    };
  }
  return { kind: "new" };
}

export function prepareProfileWrite(current, candidate, now = Date.now()) {
  const base = normalizeArcadeProfile(candidate || current);
  return {
    ...base,
    revision: Math.max(0, Number(current?.revision) || 0) + 1,
    updatedAt: now,
    lastPlayedAt: Math.max(now, Number(base?.lastPlayedAt) || 0),
  };
}

function notifyProfileChanged(profile) {
  const message = { type: "profile-changed", source: TAB_ID, revision: profile?.revision || 0, at: Date.now() };
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.postMessage(message);
      channel.close();
    }
  } catch { /* fallback below */ }
  try {
    localStorage.setItem(PROFILE_SIGNAL_KEY, JSON.stringify(message));
  } catch { /* IndexedDB remains truth */ }
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withLocalStorageLease(name, fn) {
  const token = `${TAB_ID}:${makeLocalId(name)}`;
  const key = name === "profile" ? PROFILE_LOCK_KEY : `${LS_PREFIX}${name}-lock`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(key);
      const lock = raw ? JSON.parse(raw) : null;
      if (!lock || !lock.expiresAt || lock.expiresAt < now || lock.token === token) {
        localStorage.setItem(key, JSON.stringify({ token, expiresAt: now + 2500 }));
        const verify = JSON.parse(localStorage.getItem(key) || "null");
        if (verify?.token === token) {
          try { return await fn(); }
          finally {
            const latest = JSON.parse(localStorage.getItem(key) || "null");
            if (latest?.token === token) localStorage.removeItem(key);
          }
        }
      }
    } catch {
      // localStorage 不可用時退回目前分頁內 queue。
      return fn();
    }
    await delay(20 + attempt * 4);
  }
  throw new Error(`${name}_lock_timeout`);
}

async function withBrowserLock(name, fn) {
  try {
    if (typeof navigator !== "undefined" && navigator.locks?.request) {
      return navigator.locks.request(`cat-arcade-${name}`, { mode: "exclusive" }, fn);
    }
  } catch { /* fallback */ }
  const queued = localMutationTail.then(() => withLocalStorageLease(name, fn), () => withLocalStorageLease(name, fn));
  localMutationTail = queued.catch(() => undefined);
  return queued;
}

/**
 * 所有金幣/XP/裝備/戰績永久變更應走這裡：鎖住 → 讀最新 IndexedDB → 套 patch → revision+1 → 通知其他分頁。
 * mutator 必須是同步純函式，避免鎖內等待外部網路。
 */
export async function mutateVisitorProfile(mutator) {
  if (typeof mutator !== "function") throw new Error("profile_mutator_required");
  return withBrowserLock("profile", async () => {
    const current = normalizeArcadeProfile(await arcadeStore.get(PROFILE_KEY));
    if (!current) throw new Error("visitor_profile_missing");
    const candidate = mutator(current);
    if (candidate && typeof candidate.then === "function") throw new Error("profile_mutator_must_be_sync");
    const next = prepareProfileWrite(current, candidate || current);
    await arcadeStore.put(PROFILE_KEY, next);
    notifyProfileChanged(next);
    return next;
  });
}

export function subscribeVisitorProfileChanges(callback) {
  if (typeof callback !== "function") return () => {};
  let disposed = false;
  let channel = null;
  const reload = async (message) => {
    if (disposed || message?.source === TAB_ID) return;
    const latest = await loadVisitorProfile();
    if (!disposed && latest) callback(latest);
  };
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.onmessage = (event) => reload(event.data);
    }
  } catch { channel = null; }
  const onStorage = (event) => {
    if (event.key !== PROFILE_SIGNAL_KEY || !event.newValue) return;
    try { reload(JSON.parse(event.newValue)); } catch { reload(null); }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    disposed = true;
    if (channel) channel.close();
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export async function claimAdventureSession(mode, { force = false } = {}) {
  return withBrowserLock("adventure-session", async () => {
    const now = Date.now();
    const current = await loadAdventureSession();
    const decision = decideAdventureSessionClaim(current, { mode, force, tabId: TAB_ID, now });
    if (decision.kind === "conflict") {
      return { ok: false, conflict: true, session: decision.session };
    }
    if (decision.kind === "resume") {
      await saveAdventureSession(decision.session);
      return { ok: true, resumed: true, session: decision.session };
    }
    const session = {
      runId: makeLocalId("run"), ownerTabId: TAB_ID, mode,
      startedAt: now, heartbeatAt: now, revision: 1, settled: false,
    };
    await saveAdventureSession(session);
    return { ok: true, resumed: false, session };
  });
}

export async function updateAdventureSession(runId, updater) {
  if (!runId || typeof updater !== "function") return null;
  return withBrowserLock("adventure-session", async () => {
    const current = await loadAdventureSession();
    if (!current || current.runId !== runId) return null;
    const patch = updater(current);
    if (patch && typeof patch.then === "function") throw new Error("adventure_session_updater_must_be_sync");
    const next = {
      ...current,
      ...(patch || {}),
      runId: current.runId,
      heartbeatAt: Date.now(),
      revision: (current.revision || 0) + 1,
    };
    await saveAdventureSession(next);
    return next;
  });
}

export async function heartbeatAdventureSession(runId) {
  const current = await loadAdventureSession();
  if (!current || current.runId !== runId || current.ownerTabId !== TAB_ID) return false;
  await saveAdventureSession({ ...current, heartbeatAt: Date.now(), revision: (current.revision || 0) + 1 });
  return true;
}

export async function markAdventureSessionSettled(runId) {
  const current = await loadAdventureSession();
  if (!current || current.runId !== runId) return false;
  await saveAdventureSession({ ...current, settled: true, heartbeatAt: Date.now(), revision: (current.revision || 0) + 1 });
  return true;
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
