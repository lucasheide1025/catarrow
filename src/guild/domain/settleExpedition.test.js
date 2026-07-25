// src/guild/domain/settleExpedition.test.js
import { settleExpedition } from "./settleExpedition";
import { deriveGuildCombat } from "./guildStats";
import { evaluateJunk, GUILD_JUNK, JUNK_BY_ID } from "../data/guildJunkCatalog";
import { EXPANSION_MATERIALS } from "../../lib/monsterExpansionCatalog";
import { LOOT_BY_DANGER } from "../data/guildLootTable";
import { GRADES, GUILD_EQUIP_ARCHETYPES } from "../data/guildEquipCatalog";

const FIXED = { rand: () => 0.1 };
const baseStats = { hp: 100, atk: 50, agi: 0, def: 0, vit: 0, luk: 0 };

function wonState(danger) {
  return {
    status: "won",
    guildStats: baseStats,
    derived: deriveGuildCombat(baseStats),
    expedition: { danger, families: ["ghost"], waves: [{ monsters: [
      { family: "ghost", tier: "common", tierIndex: 1, encounter: "normal" },
      { family: "ghost", tier: "common", tierIndex: 1, encounter: "normal" },
    ] }] },
  };
}

describe("settleExpedition — 凱旋結算", () => {
  test("非勝利 → 空獎勵", () => {
    expect(settleExpedition({ status: "lost" }).won).toBe(false);
    expect(settleExpedition({ status: "lost" }).coins).toBe(0);
    expect(settleExpedition(null).catCoins).toBe(0);
  });

  test("勝利 → 至少給基礎金幣與 CAT幣", () => {
    const r = settleExpedition(wonState(1), FIXED);
    expect(r.won).toBe(true);
    expect(r.coins).toBeGreaterThanOrEqual(60);
    expect(r.catCoins).toBeGreaterThanOrEqual(5);
  });

  test("材料掉的是**擴充材料**（跟主線打怪同一份），每隻怪 2~3 個", () => {
    const r = settleExpedition(wonState(1), FIXED);
    const ids = new Set(EXPANSION_MATERIALS.map(m => m.id));
    let total = 0;
    for (const m of r.materials) {
      expect(ids.has(m.id)).toBe(true);            // 是擴充材料 id（mat_*）
      expect(m.qty).toBeGreaterThan(0);
      expect(m.kind).toBe("normal");               // 雜兵掉 normal
      total += m.qty;
    }
    // 兩隻怪 × 2~3 個
    expect(total).toBeGreaterThanOrEqual(4);
    expect(total).toBeLessThanOrEqual(6);
  });

  test("首領掉對應 kind 的王素材（高危險委託才拿得到）", () => {
    const state = {
      status: "won", guildStats: baseStats, derived: deriveGuildCombat(baseStats),
      expedition: { danger: 6, families: ["ghost"], waves: [{ monsters: [
        { family: "ghost", tier: "mythic", tierIndex: 6, encounter: "boss" },
      ] }] },
    };
    const r = settleExpedition(state, FIXED);
    expect(r.materials.length).toBeGreaterThan(0);
    for (const m of r.materials) expect(m.kind).toBe("boss");
  });

  test("舊六族材料鏈仍保底給（舊系統不斷線）", () => {
    const r = settleExpedition(wonState(1), FIXED);
    for (const m of r.legacyMaterials) {
      expect(m.familyTier).toMatch(/^[a-z]+_t[1-6]$/);
      expect(m.qty).toBeGreaterThan(0);
    }
  });

  test("雜貨**不再自動換成錢**：只回傳撈到什麼，錢等賣出才算", () => {
    const r = settleExpedition(wonState(3), FIXED);
    // 基礎報酬 = 委託酬金（LOOT_BY_DANGER），不含雜貨價值
    expect(r.coins).toBe(LOOT_BY_DANGER[3].coinBase);
    expect(r.catCoins).toBe(LOOT_BY_DANGER[3].catCoinBase);
    for (const j of r.junk) {
      expect(JUNK_BY_ID[j.id]).toBeTruthy();
      expect(j.rarity).toBeTruthy();
    }
  });

  test("雜貨圖鑑很豐富，且族群雜貨只在該族委託出現", () => {
    expect(GUILD_JUNK.length).toBeGreaterThanOrEqual(60);
    const r = settleExpedition(wonState(2), FIXED);
    for (const j of r.junk) {
      const fam = JUNK_BY_ID[j.id].family;
      if (fam) expect(fam).toBe("ghost");     // 這趟只打鬼怪族
    }
  });

  test("危險度 3 有機會掉公會裝，品級/基礎裝合法", () => {
    const r = settleExpedition(wonState(3), FIXED);
    expect(r.equipDrops.length).toBeGreaterThan(0);
    for (const e of r.equipDrops) {
      expect(GRADES).toContain(e.grade);
      expect(GUILD_EQUIP_ARCHETYPES[e.archetypeId]).toBeTruthy();
    }
  });

  test("evaluateJunk：LUK 價值倍率越高，金幣越多", () => {
    const low = evaluateJunk(GUILD_JUNK[5], 1);
    const high = evaluateJunk(GUILD_JUNK[5], 1.5);
    expect(high.coins).toBeGreaterThan(low.coins);
  });
});
