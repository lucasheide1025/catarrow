import {
  getDungeonTierPool,
  drawExpansionDungeonMonster,
  drawExpansionDungeonFloorMonsters,
  drawDungeonFloorMonsters,
} from "./dungeonExpansionMonsters";

function seq(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("地下城難度→Tier 對映", () => {
  test("連續對映：普通=T1-2、進階=T2-3、困難=T3-4、地獄=T4-5", () => {
    expect(getDungeonTierPool(1)).toEqual(["common", "rare"]);
    expect(getDungeonTierPool(2)).toEqual(["rare", "elite"]);
    expect(getDungeonTierPool(3)).toEqual(["elite", "fierce"]);
    expect(getDungeonTierPool(4)).toEqual(["fierce", "boss"]);
  });
  test("超界 clamp：0→普通、6→地獄", () => {
    expect(getDungeonTierPool(0)).toEqual(["common", "rare"]);
    expect(getDungeonTierPool(6)).toEqual(["fierce", "boss"]);
  });
});

describe("中途樓層擴充抽怪", () => {
  test("只抽同族 normal 怪，Tier 符合難度", () => {
    for (let round = 0; round < 30; round += 1) {
      const monster = drawExpansionDungeonMonster("normal", 1, { family: "ghost" });
      expect(monster.family).toBe("ghost");
      expect(monster.encounter).toBe("normal");
      expect(["common", "rare"]).toContain(monster.tier);
      expect(monster.bossTagged).toBe(false);
    }
  });
  test("地獄難度抽 T4-5；舊 family 別名（forest→mountain）可用", () => {
    const monster = drawExpansionDungeonMonster("strong", 4, { family: "forest" });
    expect(monster.family).toBe("mountain");
    expect(["fierce", "boss"]).toContain(monster.tier);
  });
  test("treasure 族同規則", () => {
    const monster = drawExpansionDungeonMonster("weak", 2, { family: "treasure" });
    expect(monster.family).toBe("treasure");
    expect(monster.encounter).toBe("normal");
    expect(["rare", "elite"]).toContain(monster.tier);
  });
  test("弱化/強悍變體實際改動三圍", () => {
    const weak = drawExpansionDungeonMonster("weak", 1, { family: "ghost", random: seq([0, 0.5]) });
    const strong = drawExpansionDungeonMonster("strong", 1, { family: "ghost", random: seq([0, 0.5]) });
    expect(weak.hp).toBeLessThan(strong.hp);
    expect(weak.variant).toBe("weak");
    expect(strong.variant).toBe("strong");
  });
});

describe("樓層組合", () => {
  test("第1層：2-3 隻弱化怪，無精英無王", () => {
    const floor = drawExpansionDungeonFloorMonsters(0, 1, { family: "ghost", random: seq([0.9, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]) });
    expect(floor.monsters.length).toBeGreaterThanOrEqual(2);
    expect(floor.monsters.length).toBeLessThanOrEqual(3);
    expect(floor.monsters.every(monster => monster.variant === "weak")).toBe(true);
    expect(floor.elite).toBeNull();
    expect(floor.boss).toBeNull();
  });
  test("第2層：普通怪＋強悍精英", () => {
    const floor = drawExpansionDungeonFloorMonsters(1, 3, { family: "exam" });
    // 難度 3（困難）= T3-T4
    expect(floor.monsters.every(monster => monster.variant === "normal" && ["elite", "fierce"].includes(monster.tier))).toBe(true);
    expect(floor.elite.variant).toBe("strong");
    expect(floor.boss).toBeNull();
  });
  test("第3層：鎖定王快照不再疊舊版 boss 倍率，只貼標籤", () => {
    const snapshot = { id: "ghost_t1_boss", name: "鎮界靈將・初陣", hp: 425, atk: 30, def: 22, expansionVersion: 1 };
    const floor = drawExpansionDungeonFloorMonsters(2, 1, { family: "ghost", fixedBoss: snapshot });
    expect(floor.boss.hp).toBe(425);
    expect(floor.boss.atk).toBe(30);
    expect(floor.boss.variant).toBe("boss");
  });
});

describe("flag 分流", () => {
  afterEach(() => window.localStorage.removeItem("monsterExpansionV1"));
  test("flag off 走舊表（不含擴充 id）", () => {
    window.localStorage.setItem("monsterExpansionV1", "off");
    const floor = drawDungeonFloorMonsters(0, 1, { family: "ghost" });
    expect(floor.monsters.every(monster => !/_t[1-6]_/.test(monster.id))).toBe(true);
  });
  test("flag on 中途樓層全為擴充 normal 怪（含保留舊 id 的既有怪）", () => {
    window.localStorage.setItem("monsterExpansionV1", "on");
    const floor = drawDungeonFloorMonsters(1, 4, { family: "insect" });
    expect(floor.monsters.every(monster => monster.expansionVersion === 1 && monster.encounter === "normal" && ["fierce", "boss"].includes(monster.tier))).toBe(true);
    expect(floor.elite.expansionVersion).toBe(1);
    expect(["fierce", "boss"]).toContain(floor.elite.tier);
  });
  test("flag on 但第3層缺鎖定王 → 整層 fallback 舊路徑（王房不可空）", () => {
    window.localStorage.setItem("monsterExpansionV1", "on");
    const floor = drawDungeonFloorMonsters(2, 1, { family: "ghost" });
    expect(floor.boss).toBeTruthy();
  });
});
