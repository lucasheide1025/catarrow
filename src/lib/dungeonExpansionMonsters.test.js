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
  test("不跨階：Tn 只出該階怪", () => {
    expect(getDungeonTierPool(1)).toEqual(["common"]);
    expect(getDungeonTierPool(2)).toEqual(["rare"]);
    expect(getDungeonTierPool(3)).toEqual(["elite"]);
    expect(getDungeonTierPool(4)).toEqual(["fierce"]);
    expect(getDungeonTierPool(5)).toEqual(["boss"]);
    expect(getDungeonTierPool(6)).toEqual(["mythic"]);
  });
  test("超界 clamp：0→普通、6→地獄", () => {
    expect(getDungeonTierPool(0)).toEqual(["common"]);
    expect(getDungeonTierPool(9)).toEqual(["mythic"]);
  });
});

describe("中途樓層擴充抽怪", () => {
  test("只抽同族 normal 怪，Tier 符合難度", () => {
    for (let round = 0; round < 30; round += 1) {
      const monster = drawExpansionDungeonMonster("normal", 1, { family: "ghost" });
      expect(monster.family).toBe("ghost");
      expect(monster.encounter).toBe("normal");
      expect(monster.tier).toBe("common");
      expect(monster.bossTagged).toBe(false);
    }
  });
  test("難度4=T4；舊 family 別名（forest→mountain）可用", () => {
    const monster = drawExpansionDungeonMonster("strong", 4, { family: "forest" });
    expect(monster.family).toBe("mountain");
    expect(monster.tier).toBe("fierce");
  });
  test("最高階 T6 也抽得到", () => {
    expect(drawExpansionDungeonMonster("strong", 6, { family: "ghost" }).tier).toBe("mythic");
  });
  test("treasure 族同規則", () => {
    const monster = drawExpansionDungeonMonster("weak", 2, { family: "treasure" });
    expect(monster.family).toBe("treasure");
    expect(monster.encounter).toBe("normal");
    expect(monster.tier).toBe("rare");
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
    // T3 地下城只出 T3 怪，樓層差異只表現在變體上
    expect(floor.monsters.every(monster => monster.variant === "normal" && monster.tier === "elite")).toBe(true);
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
    expect(floor.monsters.every(monster => monster.expansionVersion === 1 && monster.encounter === "normal" && monster.tier === "fierce")).toBe(true);
    expect(floor.elite.expansionVersion).toBe(1);
    expect(floor.elite.tier).toBe("fierce");
  });
  test("flag on 但第3層缺鎖定王 → 整層 fallback 舊路徑（王房不可空）", () => {
    window.localStorage.setItem("monsterExpansionV1", "on");
    const floor = drawDungeonFloorMonsters(2, 1, { family: "ghost" });
    expect(floor.boss).toBeTruthy();
  });
});

// 使用者回報「單人／組隊打怪會刷出小王大王」後補的護欄。
// 王怪只該從王房取得，任何一般抽怪路徑都不得產出 isKing 怪物。
describe("舊池不得刷出王怪", () => {
  const { MONSTERS, drawMixedMonsterPool, drawMatchedMonsters } = require("./monsterData");
  const kingIds = new Set(MONSTERS.filter(m => m.isKing).map(m => m.id));

  test("清單裡確實有王怪（否則這個測試等於沒測）", () => {
    expect(kingIds.size).toBeGreaterThan(0);
  });

  test("drawMixedMonsterPool 全階級都不會抽到王怪", () => {
    for (let tier = 1; tier <= 6; tier += 1) {
      for (let round = 0; round < 40; round += 1) {
        drawMixedMonsterPool(6, "normal", tier).filter(Boolean)
          .forEach(monster => expect(kingIds.has(monster.id)).toBe(false));
      }
    }
  });

  test("單人打怪清單不會出現王怪", () => {
    for (let power = 0; power < 400; power += 40) {
      drawMatchedMonsters(power).filter(Boolean)
        .forEach(monster => expect(kingIds.has(monster.id)).toBe(false));
    }
  });
});

describe("王房抽王（Tn 只出 Tn 的王 + 小王保底）", () => {
  const { drawDungeonBossEncounter, MINI_BOSS_PITY } = require("./dungeonExpansionMonsters");
  const { EXPANSION_MONSTER_BY_ID } = require("./monsterExpansionCatalog");
  const FAMS = ["ghost", "mountain", "insect", "workplace", "exam", "temple", "treasure"];
  const TIER_BY_DIFF = { 1: "common", 2: "rare", 3: "elite", 4: "fierce", 5: "boss", 6: "mythic" };

  test("王房一定是小王或大王，且階級等於地下城階級", () => {
    FAMS.forEach(family => {
      for (let d = 1; d <= 6; d += 1) {
        for (let r = 0; r < 20; r += 1) {
          const result = drawDungeonBossEncounter(d, family, { miniStreak: 0 });
          expect(result).not.toBeNull();
          const meta = EXPANSION_MONSTER_BY_ID[result.monster.id];
          expect(["miniBoss", "boss"]).toContain(meta.encounter);
          expect(meta.family).toBe(family);
          expect(meta.tier).toBe(TIER_BY_DIFF[d]);
        }
      }
    });
  });

  test("連續 2 次小王後，第 3 次必定是大王", () => {
    // random 固定回 0.9（>0.5 → 平常會選小王），保底仍必須強制出大王
    const forced = drawDungeonBossEncounter(1, "ghost", { miniStreak: MINI_BOSS_PITY - 1, random: () => 0.9 });
    expect(forced.kind).toBe("boss");
    expect(forced.miniStreak).toBe(0); // 出大王後計數歸零
  });

  test("抽到小王會累加計數，抽到大王歸零", () => {
    const mini = drawDungeonBossEncounter(1, "ghost", { miniStreak: 0, random: () => 0.9 });
    expect(mini.kind).toBe("miniBoss");
    expect(mini.miniStreak).toBe(1);
    const boss = drawDungeonBossEncounter(1, "ghost", { miniStreak: 1, random: () => 0.1 });
    expect(boss.kind).toBe("boss");
    expect(boss.miniStreak).toBe(0);
  });

  test("小王每族每階有 2 隻，會隨機出不同隻", () => {
    const seen = new Set();
    for (let r = 0; r < 60; r += 1) {
      const result = drawDungeonBossEncounter(1, "ghost", { miniStreak: 0 });
      if (result.kind === "miniBoss") seen.add(result.monster.id);
    }
    expect(seen.size).toBe(2);
  });

  test("forceKind 換難度重抽：保留大／小王身分，只換階級", () => {
    // 升降級用：T1 小王 → T3 也必須是小王，否則玩家反覆升降級就能刷出大王
    const mini = drawDungeonBossEncounter(3, "ghost", { forceKind: "miniBoss", random: () => 0.1 });
    expect(mini.kind).toBe("miniBoss");
    expect(EXPANSION_MONSTER_BY_ID[mini.monster.id].tier).toBe(TIER_BY_DIFF[3]);
    const boss = drawDungeonBossEncounter(3, "ghost", { forceKind: "boss", random: () => 0.9 });
    expect(boss.kind).toBe("boss");
    expect(EXPANSION_MONSTER_BY_ID[boss.monster.id].tier).toBe(TIER_BY_DIFF[3]);
  });

  test("連續跑 300 次都不會連 3 次小王", () => {
    let streak = 0;
    let maxStreak = 0;
    for (let r = 0; r < 300; r += 1) {
      const result = drawDungeonBossEncounter(3, "exam", { miniStreak: streak });
      streak = result.miniStreak;
      maxStreak = Math.max(maxStreak, streak);
    }
    expect(maxStreak).toBeLessThanOrEqual(MINI_BOSS_PITY - 1);
  });
});
