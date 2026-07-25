// src/guild/domain/settleExpedition.test.js
import { settleExpedition } from "./settleExpedition";
import { deriveGuildCombat } from "./guildStats";
import { evaluateJunk, GUILD_JUNK } from "../data/guildLootTable";
import { GRADES, GUILD_EQUIP_ARCHETYPES } from "../data/guildEquipCatalog";

const FIXED = { rand: () => 0.1 };
const baseStats = { hp: 100, atk: 50, agi: 0, def: 0, vit: 0, luk: 0 };

function wonState(danger) {
  return {
    status: "won",
    guildStats: baseStats,
    derived: deriveGuildCombat(baseStats),
    expedition: { danger, waves: [{ monsters: [{ family: "ghost", tier: "common" }, { family: "ghost", tier: "rare" }] }] },
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

  test("通用材料格式 family_t{n}（供打怪/貓村共用）", () => {
    const r = settleExpedition(wonState(1), FIXED);
    for (const m of r.materials) {
      expect(m.familyTier).toMatch(/^[a-z]+_t[1-6]$/);
      expect(m.qty).toBeGreaterThan(0);
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
