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

// 2026-07-19：DLC 全面安裝，flag 已移除（恆為 on）。
// 原本的「flag off 走舊表」測試連同開關一起刪掉——現在關不掉就是規格。
describe("擴充池分流", () => {
  afterEach(() => window.localStorage.removeItem("monsterExpansionV1"));
  test("殘留的 localStorage off 不再能把中途樓層打回舊表", () => {
    window.localStorage.setItem("monsterExpansionV1", "off");
    const floor = drawDungeonFloorMonsters(1, 4, { family: "insect" });
    expect(floor.monsters.every(monster => monster.expansionVersion === 1)).toBe(true);
  });
  // 實測 bug：T2 神廟第 3 層因為 fixedBoss 為 null，整層被打回舊 drawFloorMonsters，
  // 跑出爛主管（職場）＋虎頭蜂（昆蟲）＋魔神仔（幽冥）三族混雜。
  test("第3層即使缺王也只補王，不得把整層打回跨族舊表", () => {
    for (let index = 0; index < 20; index += 1) {
      const floor = drawDungeonFloorMonsters(2, 2, { family:"temple", fixedBoss:null });
      const all = [...floor.monsters, floor.elite, floor.boss].filter(Boolean);
      expect(all.length).toBeGreaterThan(0);
      all.forEach(monster => {
        expect(monster.family).toBe("temple");
        expect(monster.tier).toBe("rare");
      });
    }
  });

  test("中途樓層全為擴充 normal 怪（含保留舊 id 的既有怪）", () => {
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
