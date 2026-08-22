const DB_NAME = "catarrow-local-battles";
const STORE_NAME = "multiMonsterSolo";
const DB_VERSION = 1;
const FALLBACK_PREFIX = "catarrow.multiMonsterSolo.v1:";

export const MULTI_MONSTER_LOCAL_SCHEMA_VERSION = 1;

function safePart(value) {
  return String(value ?? "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) || "anon";
}

export function hashMultiMonsterBattleSeed(value) {
  let hash = 2166136261;
  for (const char of String(value ?? "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createMultiMonsterLocalRandom(seed) {
  let state = Number.isFinite(Number(seed)) ? (Number(seed) >>> 0) : hashMultiMonsterBattleSeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMultiMonsterLocalBattleKey({ memberId, family, tier } = {}) {
  return `${safePart(memberId)}::${safePart(family)}::${Math.max(0, Number(tier) || 0)}`;
}

export function createMultiMonsterBattleIdentity({ memberId, family, tier, now = Date.now(), random = Math.random } = {}) {
  const timestamp = Math.max(0, Number(now) || Date.now());
  const nonce = Math.floor(Math.max(0, Math.min(0.999999999, Number(random()) || 0)) * 0xFFFFFFFF).toString(36);
  const battleId = `multi_${safePart(memberId)}_${timestamp.toString(36)}_${nonce}`;
  const encounterSeed = hashMultiMonsterBattleSeed(`${battleId}:${family}:${Number(tier) || 0}`);
  return { battleId, encounterSeed };
}

function localStorageKey(key) {
  return `${FALLBACK_PREFIX}${key}`;
}

function readFallback(key) {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(localStorageKey(key)) || "null");
    return parsed?.schemaVersion === MULTI_MONSTER_LOCAL_SCHEMA_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeFallback(snapshot) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(localStorageKey(snapshot.key), JSON.stringify(snapshot)); } catch { /* storage unavailable */ }
}

function clearFallback(key) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(localStorageKey(key)); } catch { /* storage unavailable */ }
}

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath:"key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => { try { db.close(); } catch {} };
    } catch {
      try { db.close(); } catch {}
      resolve(null);
    }
  });
}

async function idbPut(snapshot) {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(snapshot);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { try { db.close(); } catch {}; resolve(false); };
      tx.onabort = () => { try { db.close(); } catch {}; resolve(false); };
    } catch {
      try { db.close(); } catch {}
      resolve(false);
    }
  });
}

async function idbDelete(key) {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { try { db.close(); } catch {}; resolve(false); };
      tx.onabort = () => { try { db.close(); } catch {}; resolve(false); };
    } catch {
      try { db.close(); } catch {}
      resolve(false);
    }
  });
}

export async function loadMultiMonsterLocalBattle(identity = {}) {
  const key = identity.key || buildMultiMonsterLocalBattleKey(identity);
  const fromDb = await idbGet(key);
  if (fromDb?.schemaVersion === MULTI_MONSTER_LOCAL_SCHEMA_VERSION) return fromDb;
  return readFallback(key);
}

export async function saveMultiMonsterLocalBattle(input = {}) {
  const key = input.key || buildMultiMonsterLocalBattleKey(input);
  const snapshot = {
    ...input,
    key,
    schemaVersion:MULTI_MONSTER_LOCAL_SCHEMA_VERSION,
    updatedAt:Date.now(),
  };
  writeFallback(snapshot);
  await idbPut(snapshot);
  return snapshot;
}

export async function clearMultiMonsterLocalBattle(identity = {}) {
  const key = identity.key || buildMultiMonsterLocalBattleKey(identity);
  clearFallback(key);
  await idbDelete(key);
  return { ok:true, key };
}
