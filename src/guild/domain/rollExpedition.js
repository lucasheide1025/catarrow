// src/guild/domain/rollExpedition.js
// ─────────────────────────────────────────────────────────────
// 委託 → 隨機「多場討伐遠征」：依危險度（1~6 對應 T1~T6）抽怪，生成 N 波、每波 ≤4 隻。
//
// 怪物來源＝**擴充怪物圖鑑 252 隻**（`monsterExpansionCatalog`，7 族 × 6 階 × 6 角色），
// 不是舊的 36 隻 MONSTERS。2026-07-25 作者抓到：公會原本只撈舊怪，新怪全沒用到。
// 用 `toLegacyBattleMonster` 轉成戰鬥用形狀（hp/atk/def/artKey）。
//
// ⚠️ 數值縮放（`GUILD_TIER_SCALE`）：擴充怪是為主線長期養成設計的（T6 normal 有 1700~3240 HP），
//   公會六維才剛起步、又刻意跟主線隔離，直接搬會完全打不動。縮放的依據是
//   「以該階級**預期會穿的公會裝**，一隻雜兵約 5 箭解決」→ 反推 HP 係數。
//   這是公會自己的數字，不影響主線平衡（隔離鐵律）。
//
// 每隻怪帶 `distance`（距離倒數）：每回合 −1，歸零發動攻擊（見 2.5D 戰鬥設計）。
// ─────────────────────────────────────────────────────────────
import { EXPANSION_MONSTERS } from "../../lib/monsterExpansionCatalog";
import { toLegacyBattleMonster } from "../../lib/monsterExpansionAdapter";

export const DANGER = Object.freeze({ T1: 1, T2: 2, T3: 3, T4: 4, T5: 5, T6: 6 });
export const MAX_DANGER = 6;

// 危險度 1~6 ＝ 怪物階級 T1~T6。波數與每波隻數隨危險度增加。
// leader：最後一波的首領（miniBoss/boss）——結構感來自「最後一波有東西壓陣」。
export const DANGER_META = Object.freeze({
  1: { label: "例行", skulls: "☠️",         tier: "common", tierNo: 1, waves: 3, waveSize: [1, 2], initDist: [3, 5], leader: null },
  2: { label: "警戒", skulls: "☠️☠️",       tier: "rare",   tierNo: 2, waves: 3, waveSize: [2, 3], initDist: [3, 5], leader: null },
  3: { label: "危險", skulls: "☠️×3",       tier: "elite",  tierNo: 3, waves: 4, waveSize: [2, 3], initDist: [3, 6], leader: "miniBoss" },
  4: { label: "極危", skulls: "☠️×4",       tier: "fierce", tierNo: 4, waves: 4, waveSize: [2, 4], initDist: [4, 6], leader: "miniBoss" },
  5: { label: "討伐", skulls: "☠️×5",       tier: "boss",   tierNo: 5, waves: 5, waveSize: [2, 4], initDist: [4, 6], leader: "boss" },
  6: { label: "傳說", skulls: "☠️×6",       tier: "mythic", tierNo: 6, waves: 5, waveSize: [3, 4], initDist: [4, 6], leader: "boss" },
});

// 公會版縮放：{ hp, atk } 乘在擴充怪原數值上。
// 高階降得更多，因為公會裝的成長幅度遠小於擴充怪的 HP 成長（等比 vs 等比但斜率不同）。
export const GUILD_TIER_SCALE = Object.freeze({
  1: { hp: 0.50, atk: 0.90 },
  2: { hp: 0.55, atk: 0.90 },
  3: { hp: 0.55, atk: 0.85 },
  4: { hp: 0.50, atk: 0.80 },
  5: { hp: 0.38, atk: 0.78 },
  6: { hp: 0.30, atk: 0.75 },
});

export const MAX_TARGETS = 4; // 畫面最多同時 4 個目標

const normDanger = d => (DANGER_META[d] ? d : 1);

// 委託可能遭遇的怪物池（畫面預覽與實際抽怪共用同一份規則，預覽才不會騙人）。
// contract.families = 多元種族；沒給就退回單一 family；都沒給＝不限族。
// opts.encounter：預設只出雜兵（"normal"）；要首領時傳 "miniBoss"/"boss"。
export function expeditionMonsterPool(contract = {}, opts = {}) {
  const danger = normDanger(contract.danger);
  const meta = DANGER_META[danger];
  const encounter = opts.encounter || "normal";
  const wanted = contract.families?.length ? contract.families : (contract.family ? [contract.family] : null);

  const base = EXPANSION_MONSTERS.filter(m =>
    m.tier === meta.tier && m.encounter === encounter && m.family !== "treasure");
  if (wanted) {
    const famPool = base.filter(m => wanted.includes(m.family));
    if (famPool.length) return famPool;
  }
  return base;
}

// 擴充怪 → 公會戰鬥單位（含公會縮放）
function toGuildMonster(raw, danger, instanceId, distance) {
  const m = toLegacyBattleMonster(raw);
  const scale = GUILD_TIER_SCALE[danger] || GUILD_TIER_SCALE[1];
  const hp = Math.max(1, Math.round(m.hp * scale.hp));
  return {
    instanceId,
    monsterId: m.id,
    name: m.name,
    icon: m.icon,
    family: m.family,
    tier: m.tier,
    tierIndex: m.tierIndex,
    encounter: m.encounter,
    artKey: m.artKey,
    maxHp: hp,
    hp,
    atk: Math.max(1, Math.round(m.atk * scale.atk)),
    def: m.def,             // DEF 不縮放（減傷已在傷害公式裡是 def*0.5）
    distance,
  };
}

// contract: { id?, danger:1~6, family?, families? }；opts.rand 可注入（測試用）
export function rollExpedition(contract = {}, opts = {}) {
  const rand = opts.rand || Math.random;
  const danger = normDanger(contract.danger);
  const meta = DANGER_META[danger];
  const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  const pool = expeditionMonsterPool({ ...contract, danger });
  const leaderPool = meta.leader ? expeditionMonsterPool({ ...contract, danger }, { encounter: meta.leader }) : [];
  if (!pool.length) return { contractId: contract.id || null, danger, family: null, families: [], totalWaves: 0, waves: [] };

  let inst = 0;
  const waves = [];
  for (let w = 0; w < meta.waves; w++) {
    const isLast = w === meta.waves - 1;
    const size = Math.min(MAX_TARGETS, ri(meta.waveSize[0], meta.waveSize[1]));
    const monsters = [];
    // 最後一波：首領壓陣（佔一個名額）
    if (isLast && leaderPool.length) {
      monsters.push(toGuildMonster(pick(leaderPool), danger, `g${inst++}`, ri(meta.initDist[0], meta.initDist[1])));
    }
    while (monsters.length < size) {
      monsters.push(toGuildMonster(pick(pool), danger, `g${inst++}`, ri(meta.initDist[0], meta.initDist[1])));
    }
    waves.push({ waveIndex: w, monsters });
  }

  return {
    contractId: contract.id || null,
    danger,
    family: contract.family || contract.families?.[0] || null,  // 戰場底圖用主族
    families: contract.families?.length ? [...contract.families] : (contract.family ? [contract.family] : []),
    totalWaves: meta.waves,
    waves,
  };
}
