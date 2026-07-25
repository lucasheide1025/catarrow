// src/guild/domain/guildContracts.js
// ─────────────────────────────────────────────────────────────
// 每日委託板：同一天、同一個人 → 永遠抽到同一批委託（seed = 日期 + memberId）。
// 為什麼要 deterministic：重整不能換一批（不然玩家會一直重整刷到想要的委託），
// 但每個人的委託不同才有「這是我的委託板」的感覺。
// 純函數；沒有 Firestore、沒有 Date.now()（日期字串由呼叫端給，測試才好固定）。
// ─────────────────────────────────────────────────────────────
import { FAMILIES } from "../../lib/monsterData";
import { LOOT_BY_DANGER } from "../data/guildLootTable";
import { DANGER_META } from "./rollExpedition";
import { CONTRACT_CLIENTS, CONTRACT_STORIES, DANGER_TONE, CONTRACTS_PER_DAY } from "../data/guildContractPool";
import { normalizeGuildProfile } from "./guildRewards";

const FAMILY_IDS = Object.keys(CONTRACT_STORIES); // 六族（不含寶箱族）

// 字串 → 32bit seed（同輸入必同輸出）
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32：小而穩的 seeded PRNG
function makeRand(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 一天的日期字串（呼叫端可自己給；預設本地日期，不用 UTC 免得半夜換板）
export function todayKey(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 危險度分佈：一天固定 2 張例行、2 張警戒、1 張緊急 —— 讓低階玩家永遠有事做，
// 也永遠看得到自己還接不了的那張（目標感，和商店鎖住的貨架同一個手法）。
const DANGER_SLOTS = [1, 1, 2, 2, 3];

export function rollDailyContracts({ dateKey = todayKey(), memberId = "guest" } = {}) {
  const rand = makeRand(hashSeed(`${dateKey}|${memberId}`));
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const out = [];
  for (let i = 0; i < CONTRACTS_PER_DAY; i++) {
    const danger = DANGER_SLOTS[i] || 1;
    const family = pick(FAMILY_IDS);
    const story = pick(CONTRACT_STORIES[family]);
    const client = pick(CONTRACT_CLIENTS);
    out.push({
      id: `${dateKey}-${i}`,
      danger,
      family,
      familyLabel: FAMILIES[family]?.label || family,
      familyIcon: FAMILIES[family]?.icon || "❓",
      client,
      title: story.title,
      story: story.story,
      tag: DANGER_TONE[danger].tag,
      hint: DANGER_TONE[danger].hint,
      waves: DANGER_META[danger].waves,
      skulls: DANGER_META[danger].skulls,
    });
  }
  return out;
}

// 委託單上的獎勵預覽（只講級距，不透露實際 roll——保留開箱感）
export function contractRewardPreview(contract) {
  const cfg = LOOT_BY_DANGER[contract?.danger] || LOOT_BY_DANGER[1];
  return {
    coins: cfg.coinBase,
    catCoins: cfg.catCoinBase,
    equipChancePct: Math.round(cfg.equipChance * 100),
    materialLabel: `${contract?.familyLabel || "族系"}材料`,
    junkMax: cfg.junkMax,
  };
}

// ── 已完成紀錄（存 profile.contracts，跨日自動換板）──
export function contractsStateFor(profile, dateKey = todayKey()) {
  const p = normalizeGuildProfile(profile);
  return p.contracts?.dateKey === dateKey ? p.contracts : { dateKey, done: [] };
}

export function isContractDone(profile, contractId, dateKey = todayKey()) {
  return contractsStateFor(profile, dateKey).done.includes(contractId);
}

// 完成一張委託 → 記進存檔（同一張當天不能重複刷）
export function markContractDone(profile, contractId, dateKey = todayKey()) {
  const p = normalizeGuildProfile(profile);
  const cur = contractsStateFor(p, dateKey);
  if (!contractId || cur.done.includes(contractId)) return { ...p, contracts: cur };
  return { ...p, contracts: { dateKey, done: [...cur.done, contractId] } };
}
