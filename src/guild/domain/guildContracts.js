// src/guild/domain/guildContracts.js
// ─────────────────────────────────────────────────────────────
// 每日委託板：同一天、同一個人 → 永遠抽到同一批委託（seed = 日期 + memberId）。
// 為什麼要 deterministic：重整不能換一批（不然玩家會一直重整刷到想要的委託），
// 但每個人的委託不同才有「這是我的委託板」的感覺。
// 純函數；沒有 Firestore、沒有 Date.now()（日期字串由呼叫端給，測試才好固定）。
// ─────────────────────────────────────────────────────────────
import { FAMILIES, TIER_LABEL, TIER_ORDER } from "../../lib/monsterData";
import { LOOT_BY_DANGER } from "../data/guildLootTable";
import { DANGER_META, MAX_DANGER, expeditionMonsterPool } from "./rollExpedition";
import { CONTRACT_CLIENTS, CONTRACT_STORIES, DANGER_TONE, CONTRACTS_PER_DANGER } from "../data/guildContractPool";
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

// 委託分佈：**每個危險度各 3 張**（1~6 共 18 張／天，作者拍板 2026-07-25）。
// 低階玩家永遠有三張能接，高階的也永遠看得到（鎖著的照樣顯示＝目標感，同商店貨架手法）。
const DANGER_SLOTS = Array.from({ length: MAX_DANGER }, (_, i) => i + 1)
  .flatMap(d => Array.from({ length: CONTRACTS_PER_DANGER }, () => d));

// 多元種族：危險度越高，混進來的族越多。
// 混族是玩法差異不是難度差異——同 tier 的怪，只是陣容更雜、預覽更有看頭。
const FAMILY_COUNT = { 1: [1, 1], 2: [1, 2], 3: [1, 2], 4: [2, 3], 5: [2, 3], 6: [2, 4] };

export function rollDailyContracts({ dateKey = todayKey(), memberId = "guest" } = {}) {
  const rand = makeRand(hashSeed(`${dateKey}|${memberId}`));
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const out = [];
  for (let i = 0; i < DANGER_SLOTS.length; i++) {
    const danger = DANGER_SLOTS[i] || 1;
    const family = pick(FAMILY_IDS);                       // 主族：決定故事與戰場底圖
    const [fMin, fMax] = FAMILY_COUNT[danger] || [1, 1];
    const famCount = fMin + Math.floor(rand() * (fMax - fMin + 1));
    const families = [family];
    while (families.length < famCount) {                   // 補混族（不重複）
      const extra = pick(FAMILY_IDS);
      if (!families.includes(extra)) families.push(extra);
    }
    const story = pick(CONTRACT_STORIES[family]);
    const client = pick(CONTRACT_CLIENTS);
    out.push({
      id: `${dateKey}-${i}`,
      danger,
      family,
      families,
      familyLabel: FAMILIES[family]?.label || family,
      familyIcon: FAMILIES[family]?.icon || "❓",
      // 多元種族的顯示用（主族排第一）
      familyTags: families.map(f => ({ id: f, label: FAMILIES[f]?.label || f, icon: FAMILIES[f]?.icon || "❓", color: FAMILIES[f]?.color })),
      // 這張委託會出現的怪物階級（T幾）——玩家最在意的資訊。危險度 1~6 ＝ T1~T6，單一階。
      tiers: [{
        key: DANGER_META[danger].tier,
        tierNo: DANGER_META[danger].tierNo,
        label: TIER_LABEL[DANGER_META[danger].tier]?.label || DANGER_META[danger].tier,
        color: TIER_LABEL[DANGER_META[danger].tier]?.color || "#94a3b8",
      }],
      leader: DANGER_META[danger].leader,   // miniBoss/boss：最後一波的壓陣首領
      waveSize: DANGER_META[danger].waveSize,
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

// 委託詳情用「可能遭遇的怪物」清單：跟實際抽怪走同一份規則（`expeditionMonsterPool`），
// 預覽才不會騙人。回傳按階級排序、標好 T 幾，UI 直接畫。
export function contractMonsterPreview(contract, opts = {}) {
  return expeditionMonsterPool(contract, opts)
    .map(m => ({
      id: m.id, name: m.name, icon: m.icon, family: m.family,
      familyLabel: FAMILIES[m.family]?.label || m.family,
      tier: m.tier,
      tierNo: TIER_ORDER.indexOf(m.tier) + 1,
      tierLabel: TIER_LABEL[m.tier]?.label || m.tier,
      tierColor: TIER_LABEL[m.tier]?.color || "#94a3b8",
      hp: m.hp, atk: m.atk, def: m.def,
    }))
    .sort((a, b) => a.tierNo - b.tierNo || a.family.localeCompare(b.family));
}

// 委託單上的獎勵預覽（只講級距，不透露實際 roll——保留開箱感）
export function contractRewardPreview(contract) {
  const cfg = LOOT_BY_DANGER[contract?.danger] || LOOT_BY_DANGER[1];
  return {
    coins: cfg.coinBase,
    catCoins: cfg.catCoinBase,
    equipChancePct: Math.round(cfg.equipChance * 100),
    // 多元種族時要講清楚材料會混（玩家會拿來湊自己缺的族）
    materialLabel: (contract?.families?.length || 1) > 1
      ? `${contract.familyLabel}等 ${contract.families.length} 族材料`
      : `${contract?.familyLabel || "族系"}材料`,
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
