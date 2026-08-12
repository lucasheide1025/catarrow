// Small client boundary for the server-authoritative world-boss lifecycle.
// Keep this module independent from db.js so generic member writers can report
// progress without loading or depending on the full worldBossDb reward domain.
import { getFunctions, httpsCallable } from "firebase/functions";
import app from "./firebase";

const functions = getFunctions(app, "asia-east1");

async function callLifecycle(name, payload = {}) {
  try {
    const result = await httpsCallable(functions, name)(payload);
    return result.data;
  } catch (error) {
    return { ok: false, reason: error?.message || String(error) };
  }
}

export function contributeWorldBossSpawnProgress({ memberId, type, amount = 1, operationId }) {
  memberId = String(memberId || "");
  if (!memberId || !operationId || !["arrows", "dungeonClears", "monsterKills", "villageDice"].includes(type)) {
    return Promise.resolve({ ok: false, reason: "invalid_spawn_contribution" });
  }
  return callLifecycle("contributeWorldBossSpawnProgress", { memberId, type, amount, operationId });
}

export function ensureWorldBossLifecycle() {
  return callLifecycle("ensureWorldBossLifecycle");
}

export function forceSpawnWorldBossFromCycle() {
  return callLifecycle("forceSpawnWorldBossFromCycle");
}
