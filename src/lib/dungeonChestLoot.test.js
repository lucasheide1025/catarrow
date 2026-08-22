import { createOrdinaryChestChoices, createOrdinaryChestLoot } from "./dungeonChestLoot";

describe("ordinary dungeon chest loot", () => {
  test.each([
    [1, "common"],
    [2, "rare"],
    [3, "elite"],
    [4, "fierce"],
    [5, "boss"],
    [6, "mythic"],
  ])("difficulty T%s uses the matching material tier", (difficultyTier, tier) => {
    const loot = createOrdinaryChestLoot({ family: "ghost", difficultyTier, random: () => 0 });
    expect(loot.material.family).toBe("ghost");
    expect(loot.material.tier).toBe(tier);
    expect(loot.material.quantity).toBeGreaterThanOrEqual(difficultyTier);
  });

  test("three facedown cards use a mixed pool and their positions are shuffled", () => {
    const first = createOrdinaryChestChoices({
      family: "ghost",
      difficultyTier: 3,
      random: () => 0.1,
    });
    const second = createOrdinaryChestChoices({
      family: "ghost",
      difficultyTier: 3,
      random: () => 0.9,
    });

    expect(first).toHaveLength(3);
    expect(new Set(first.map(choice => choice.type)).size).toBeGreaterThan(1);
    expect(first.map(choice => choice.type)).not.toEqual(second.map(choice => choice.type));
  });

  test("treasure family chest uses current exact-tier canonical material", () => {
    const loot = createOrdinaryChestLoot({ family: "treasure", difficultyTier: 3, random: () => 0 });
    expect(loot.material).toBeTruthy();
    expect(loot.material.family).toBe("treasure");
    expect(loot.material.tierIndex).toBe(3);
    expect(loot.material.kind).toBe("normal");
    expect(loot.material.monsterId).toMatch(/^treasure_/);
  });
});

// ⚠️ 回歸測試（2026-08-16 組隊探險卡死事件）：EXPANSION_MATERIALS 的 material 沒有 icon 欄位，
//    createOrdinaryChestLoot 曾直接寫 material.icon（undefined）→ 巢狀 undefined 進 Firestore →
//    房主寫入 400 → SDK 無窮重試 → 全隊卡在寶箱房。所有 family / tier 都要保證零 undefined。
function collectUndefinedPaths(value, path = "$") {
  const found = [];
  if (value === undefined) { found.push(path); return found; }
  if (Array.isArray(value)) {
    value.forEach((v, i) => found.push(...collectUndefinedPaths(v, `${path}[${i}]`)));
    return found;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) found.push(...collectUndefinedPaths(v, `${path}.${k}`));
    return found;
  }
  return found;
}

const ALL_FAMILIES = ["ghost", "mountain", "insect", "beast", "dragon", "spirit", "undead", "scale", "mystic", "treasure"];

describe("chest loot is Firestore-safe (no nested undefined)", () => {
  test.each(ALL_FAMILIES)("all difficulty tiers of %s produce undefined-free loot", family => {
    for (let tier = 1; tier <= 6; tier++) {
      const loot = createOrdinaryChestLoot({ family, difficultyTier: tier, random: () => 0 });
      expect(collectUndefinedPaths(loot)).toEqual([]);
    }
  });

  test.each(ALL_FAMILIES)("chest choices of %s are undefined-free", family => {
    for (let tier = 1; tier <= 6; tier++) {
      const choices = createOrdinaryChestChoices({ family, difficultyTier: tier, random: () => 0 });
      expect(collectUndefinedPaths(choices)).toEqual([]);
    }
  });

  test("material icon falls back to a brick emoji", () => {
    const loot = createOrdinaryChestLoot({ family: "ghost", difficultyTier: 1, random: () => 0 });
    expect(loot.material.icon).toBe("🧱");
  });
});
