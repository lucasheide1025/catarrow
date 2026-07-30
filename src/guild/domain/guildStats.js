// src/guild/domain/guildStats.js
// ─────────────────────────────────────────────────────────────
// 冒險者公會「六維戰力」計算（獨立於主線 RPG）。
// 六維：HP / ATK / AGI / DEF / VIT / LUK。
// 來源 = 六維基底 + 射手等級加成(HP/ATK/DEF) + 公會專屬裝備(六維)。
//   （貓貓以獨立戰鬥單位參戰，見 domain/guildBattle；此檔算「玩家本體」六維。）
// ⚠️ 隔離鐵律：本檔只 import `archerLevel`(允許) 與公會裝目錄；
//   **絕不** import 怪物卡/主線裝備/constants.calcArcherStats。
//   本檔亦不得被主線戰鬥（MonsterBattle/dungeon/party/worldBoss）引用。
// ─────────────────────────────────────────────────────────────
import { archerLevelFromXP, archerLevelBonus } from "../../lib/archerLevel";
import { GUILD_SLOTS } from "../data/guildEquipCatalog";
import { resolveEquipmentV2 } from "./guildEquipmentV2";

// 六維基底（提案值，實作可調）
// 2026-07-30：基礎 ATK 10 → 16。白板新手每箭最多只有 10*1.409≈14 傷，而 T1 雜兵 125 HP，
// 就算完全不減傷也要 9 箭；比例減傷救得了「被 DEF 扣光」，救不了基礎值太低。
// 對老手影響很小（他們的 ATK 大多來自等級與裝備）。
export const GUILD_BASE_STATS = Object.freeze({ hp: 100, atk: 16, agi: 10, def: 5, vit: 10, luk: 5 });
const STAT_KEYS = ["hp", "atk", "agi", "def", "vit", "luk"];

// guildEquip 形狀：{ bow:{archetypeId,grade}, arrow:{...}, armor, quiver, potionPouch }
export function sumGuildEquipStats(guildEquip = {}) {
  const total = { hp: 0, atk: 0, agi: 0, def: 0, vit: 0, luk: 0 };
  for (const slot of GUILD_SLOTS) {
    const it = guildEquip[slot];
    if (!it || !it.archetypeId) continue;
    const s = resolveEquipmentV2(it.archetypeId, it.grade, it).stats;
    for (const k of STAT_KEYS) total[k] += s[k] || 0;
  }
  return total;
}

// 公會遠征六維 = 基底 + 射手等級(hp/atk/def) + 公會裝(六維)
export function calcGuildExpeditionStats(member = {}, guildEquip = {}) {
  const lv = archerLevelFromXP(member.archerXP || 0);
  const lb = archerLevelBonus(lv); // { hp, atk, def }
  const eq = sumGuildEquipStats(guildEquip);
  const stats = {
    hp:  Math.max(1, GUILD_BASE_STATS.hp  + lb.hp  + eq.hp),
    atk: Math.max(1, GUILD_BASE_STATS.atk + lb.atk + eq.atk),
    agi: Math.max(0, GUILD_BASE_STATS.agi           + eq.agi),
    def: Math.max(0, GUILD_BASE_STATS.def + lb.def + eq.def),
    vit: Math.max(0, GUILD_BASE_STATS.vit           + eq.vit),
    luk: Math.max(0, GUILD_BASE_STATS.luk           + eq.luk),
    _archerLevel: lv,
  };
  return stats;
}

// 六維 → 衍生戰鬥/生存數值（提案公式，實作可調）
export function deriveGuildCombat(stats = {}) {
  const s = { hp: 0, atk: 0, agi: 0, def: 0, vit: 0, luk: 0, ...stats };
  return {
    maxHP:            s.hp,                              // HP：生命上限
    arrowAtk:         s.atk,                             // ATK：箭矢傷害基數
    dmgReducePct:     Math.min(60, s.def * 0.4),         // DEF：承受減傷 %（上限 60）
    extraArrowChance: Math.min(0.5, s.agi * 0.01),       // AGI：額外箭矢機率
    dodgeChance:      Math.min(0.3, s.agi * 0.005),      // AGI：閃避怪物攻擊
    supplySavePct:    Math.min(0.5, s.vit * 0.01),       // VIT：補給消耗減緩 %
    carryBonus:       Math.round(s.vit * 0.2 * 10) / 10, // VIT：背包負重上限加成
    dropBonusPct:     s.luk * 0.01,                      // LUK：掉寶率加成
    // LUK 爆擊 0.008 → 0.015：白板 LUK 5 只有 4% 爆擊＝25 箭才爆一次，玩家完全感受不到
    critChance:       Math.min(0.5, s.luk * 0.015),      // LUK：爆擊機率
    valuationBonusPct:s.luk * 0.015,                     // LUK：雜貨評估價值加成
  };
}

// 六維顯示用（UI 依此列六條）
export const STAT_META = Object.freeze({
  hp:  { name: "生命", short: "HP",  icon: "❤️", desc: "生命上限" },
  atk: { name: "攻擊", short: "ATK", icon: "⚔️", desc: "箭矢傷害" },
  agi: { name: "敏捷", short: "AGI", icon: "💨", desc: "額外箭矢／閃避" },
  def: { name: "防禦", short: "DEF", icon: "🛡️", desc: "承受減傷" },
  vit: { name: "體力", short: "VIT", icon: "🍖", desc: "補給消耗／負重" },
  luk: { name: "幸運", short: "LUK", icon: "🍀", desc: "掉寶／爆擊／雜貨價值" },
});

// ── 背包負重（單人備包與組隊等待室共用同一組數字）─────────────
// 放在 domain 而不是某個 UI 檔：它是**平衡數值**，兩邊各自寫一份遲早會不一致。
export const BASE_CAPACITY = 20;      // 基礎可負重（kg）
export const SUPPLY_WEIGHT = 1;       // 每 1 份食物/水 = 1kg

// 目前負重狀況：capacity = 基礎 + STR/VIT 給的 carryBonus
export function carryStatus({ derived, gearWeight = 0, food = 0, water = 0 }) {
  const capacity = Math.round((BASE_CAPACITY + (derived?.carryBonus || 0)) * 10) / 10;
  const supplyWeight = (food + water) * SUPPLY_WEIGHT;
  const used = Math.round((gearWeight + supplyWeight) * 10) / 10;
  return { capacity, supplyWeight, used, over: used > capacity, pct: Math.min(100, (used / Math.max(1, capacity)) * 100) };
}
