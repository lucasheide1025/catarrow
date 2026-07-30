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
import { EXPANSION_MONSTERS, EXPANSION_MONSTER_BY_ID } from "../../lib/monsterExpansionCatalog";
import { toLegacyBattleMonster } from "../../lib/monsterExpansionAdapter";

export const DANGER = Object.freeze({ T1: 1, T2: 2, T3: 3, T4: 4, T5: 5, T6: 6 });
export const MAX_DANGER = 6;

// 危險度 1~6 ＝ 怪物階級 T1~T6。波數與每波隻數隨危險度增加。
// leader：最後一波的首領（miniBoss/boss）——結構感來自「最後一波有東西壓陣」。
export const DANGER_META = Object.freeze({
  1: { label: "例行", skulls: "☠️",         tier: "common", tierNo: 1, waves: 3, waveSize: [1, 2], initDist: [3, 10], leader: null },
  2: { label: "警戒", skulls: "☠️☠️",       tier: "rare",   tierNo: 2, waves: 3, waveSize: [2, 3], initDist: [3, 10], leader: null },
  3: { label: "危險", skulls: "☠️×3",       tier: "elite",  tierNo: 3, waves: 4, waveSize: [2, 4], initDist: [3, 10], leader: "miniBoss" },
  4: { label: "極危", skulls: "☠️×4",       tier: "fierce", tierNo: 4, waves: 4, waveSize: [3, 5], initDist: [3, 10], leader: "miniBoss" },
  5: { label: "討伐", skulls: "☠️×5",       tier: "boss",   tierNo: 5, waves: 5, waveSize: [3, 6], initDist: [3, 10], leader: "boss" },
  6: { label: "傳說", skulls: "☠️×6",       tier: "mythic", tierNo: 6, waves: 5, waveSize: [4, 6], initDist: [3, 10], leader: "boss" },
});

// 每張每日委託在生成時就鎖定首領結果；同一天重整不會換王。
// 所有階級都有極低至高機率碰到小王／大王，階級越高首領越常見。
export const LEADER_ODDS = Object.freeze({
  1: { normal: 0.91, miniBoss: 0.08, boss: 0.01 },
  2: { normal: 0.84, miniBoss: 0.14, boss: 0.02 },
  3: { normal: 0.67, miniBoss: 0.28, boss: 0.05 },
  4: { normal: 0.50, miniBoss: 0.40, boss: 0.10 },
  5: { normal: 0.25, miniBoss: 0.55, boss: 0.20 },
  6: { normal: 0.10, miniBoss: 0.50, boss: 0.40 },
});

export function rollLeaderEncounter(danger = 1, rand = Math.random) {
  const odds = LEADER_ODDS[normDanger(danger)] || LEADER_ODDS[1];
  const roll = Math.max(0, Math.min(0.999999999, Number(rand()) || 0));
  if (roll < odds.boss) return "boss";
  if (roll < odds.boss + odds.miniBoss) return "miniBoss";
  return null;
}

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

// 同時在場上限。三線 × 六深 = 18 格放得下，戰場定義 BATTLEFIELD.maxVisible 也是 8；
// 舊值 4 讓高危險度的 waveSize 上緣永遠被切掉（[2,4] 實際只有 2~4），每波幾乎一樣多。
// 2026-07-30 依作者決定放寬到 6：低危險度不受影響（範圍本來就在 4 以下）。
export const MAX_TARGETS = 6;

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
function toGuildMonster(raw, danger, instanceId, distance, combatRole) {
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
    signatureSkillId: raw.signatureSkillId,
    signatureName: raw.signatureName,
    commonSkillIds: [...(raw.commonSkillIds || [])],
    counterSummary: raw.counterSummary,
    maxHp: hp,
    hp,
    atk: Math.max(1, Math.round(m.atk * scale.atk)),
    def: m.def,             // DEF 不縮放（減傷已在傷害公式裡是 def*0.5）
    distance,
    // 有指定就用指定的；沒有時 guildCombatV2.roleForMonster 會用 monsterId hash 推
    ...(combatRole ? { combatRole } : {}),
  };
}

// ── 每波的角色組成 ────────────────────────────────────────────────────────
// 舊行為：combatRole 由 monsterId 的 hash 決定 → 同一隻怪永遠同一個角色，於是「抽到誰」
// 就決定了組成，同一份委託每次打起來幾乎一樣（使用者回報「每次數量／感覺都固定」）。
//
// 現在每波即時規劃組成：先保證近戰與遠程各至少一隻（有推進壓力，也有打不到的遠程），
// 3 隻以上再保證一個施法/支援（技能預告才有戲），其餘隨機。首領不套用——牠自己的
// 角色由圖鑑決定，不該被洗掉。
const MELEE_ROLES = ["pursuer", "heavy", "charger"];
const RANGED_ROLES = ["ranged", "caster"];
const SUPPORT_ROLES = ["caster", "support"];

export function planWaveRoles(size, rand = Math.random) {
  const n = Math.max(0, Math.floor(Number(size) || 0));
  if (n <= 0) return [];
  const pickFrom = arr => arr[Math.floor(rand() * arr.length)];
  const roles = [];
  if (n >= 1) roles.push(pickFrom(MELEE_ROLES));
  if (n >= 2) roles.push(pickFrom(RANGED_ROLES));
  if (n >= 3) roles.push(pickFrom(SUPPORT_ROLES));
  while (roles.length < n) roles.push(pickFrom([...MELEE_ROLES, ...RANGED_ROLES, ...SUPPORT_ROLES]));
  // 洗牌，避免站位永遠是「近戰在前、遠程在後」的固定順序
  for (let i = roles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles.slice(0, n);
}

// contract: { id?, danger:1~6, family?, families? }；opts.rand 可注入（測試用）
export function rollExpedition(contract = {}, opts = {}) {
  const rand = opts.rand || Math.random;
  const danger = normDanger(contract.danger);
  const meta = DANGER_META[danger];
  const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = arr => arr[Math.floor(rand() * arr.length)];

  if (Array.isArray(contract.fixedWaves)) {
    let inst = 0;
    const waves = contract.fixedWaves.map((ids, waveIndex) => ({
      waveIndex,
      monsters: ids.map(id => EXPANSION_MONSTER_BY_ID[id]).filter(Boolean)
        .map(raw => toGuildMonster(raw, danger, `g${inst++}`, ri(meta.initDist[0], meta.initDist[1]))),
    }));
    return {
      contractId: contract.id || null, danger, family: contract.family || null,
      families: contract.families || (contract.family ? [contract.family] : []),
      totalWaves: waves.length, waves, isPromotion: !!contract.isPromotion, targetRankId: contract.targetRankId || null,
    };
  }

  const pool = expeditionMonsterPool({ ...contract, danger });
  const lockedLeader = Object.prototype.hasOwnProperty.call(contract, "leader")
    ? contract.leader
    : rollLeaderEncounter(danger, rand);
  const leaderPool = lockedLeader ? expeditionMonsterPool({ ...contract, danger }, { encounter: lockedLeader }) : [];
  if (!pool.length) return { contractId: contract.id || null, danger, family: null, families: [], totalWaves: 0, waves: [] };

  let inst = 0;
  const waves = [];
  for (let w = 0; w < meta.waves; w++) {
    const isLast = w === meta.waves - 1;
    const size = Math.min(MAX_TARGETS, ri(meta.waveSize[0], meta.waveSize[1]));
    const monsters = [];
    // 最後一波：首領壓陣（佔一個名額）。首領不套組成規劃——角色由圖鑑決定，不該被洗掉。
    if (isLast && leaderPool.length) {
      monsters.push(toGuildMonster(pick(leaderPool), danger, `g${inst++}`, ri(meta.initDist[0], meta.initDist[1])));
    }
    const roles = planWaveRoles(size - monsters.length, rand);
    let roleIdx = 0;
    while (monsters.length < size) {
      monsters.push(toGuildMonster(pick(pool), danger, `g${inst++}`, ri(meta.initDist[0], meta.initDist[1]), roles[roleIdx++]));
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
