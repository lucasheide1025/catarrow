// 村目標獎勵：守的是理念，不是某組數字。
// 跟 worldBossRewards.test.js 是**同一套不變式**——兩個系統規則一致，
// 玩家只要學一次；哪天有人只改其中一邊，這裡會擋下來。
import {
  VILLAGE_GOAL_CONSOLATION, VILLAGE_GOAL_PARTICIPATION,
  calcVillageGoalRewards, contributionWeight, describeGoalSpread, isContributor,
  MATERIAL_FAMILIES, buildCelebrationChests, celebrationChestCount,
  villageGoalCelebration, villageGoalConsolation, villageGoalParticipation,
} from "./villageGoalRewards";
import { EXPANSION_MATERIALS } from "./monsterExpansionCatalog";

const group = (values) => Object.fromEntries(values.map((v, i) => [`p${i}`, { contributed: v }]));
const dew = (r, id) => r[id].total.arrowdew;

describe("理念 ①：有貢獻就有不錯的獎勵", () => {
  test("⚠️ 只推了一點的人也拿得到完整的出席保底", () => {
    const r = calcVillageGoalRewards({ tiny: { contributed: 1 }, main: { contributed: 99999 } }, { tier: 1 });
    expect(r.tiny.participation).toEqual(VILLAGE_GOAL_PARTICIPATION[1]);
    expect(r.main.participation).toEqual(VILLAGE_GOAL_PARTICIPATION[1]);
  });

  test("⚠️ 主力跟幫忙的差距壓在 3 倍以內", () => {
    const spread = describeGoalSpread(1, { players: 10 });
    expect(spread.ratio).toBeLessThan(3);
    expect(spread.ratio).toBeGreaterThan(1.3);   // 但也不能沒差距
  });

  test("沒貢獻就不算參與", () => {
    expect(isContributor({ contributed: 0 })).toBe(false);
    expect(isContributor({ contributed: 1 })).toBe(true);
    expect(isContributor(null)).toBe(false);
  });
});

describe("理念 ②：努力的人拿更多", () => {
  test("貢獻越多拿越多，單調遞增", () => {
    const r = calcVillageGoalRewards(group([100, 800, 3000, 12000]), { tier: 1 });
    const vals = ["p0", "p1", "p2", "p3"].map(id => dew(r, id));
    for (let i = 1; i < vals.length; i += 1) expect(vals[i]).toBeGreaterThan(vals[i - 1]);
  });

  test("⚠️ 用 √ 壓縮：貢獻 4 倍，權重只有 2 倍（跟世界王同一種數學）", () => {
    expect(contributionWeight({ contributed: 4000 }) / contributionWeight({ contributed: 1000 }))
      .toBeCloseTo(2, 5);
  });
});

describe("理念 ③：人多是把鍋變大", () => {
  test("⚠️ 人數 5 → 30，每個人拿的不能變少", () => {
    const five = calcVillageGoalRewards(group(Array(5).fill(1000)), { tier: 1 });
    const thirty = calcVillageGoalRewards(group(Array(30).fill(1000)), { tier: 1 });
    expect(dew(thirty, "p0")).toBeGreaterThanOrEqual(dew(five, "p0"));
  });

  test("貢獻一樣的人拿一樣多", () => {
    const r = calcVillageGoalRewards(group([500, 500, 500]), { tier: 1 });
    expect(dew(r, "p0")).toBe(dew(r, "p2"));
  });
});

describe("份量要撐得起「一個月」", () => {
  test("⚠️ 舊版一個月只給 100~800 金幣，比世界王打一場的保底(350)還少", () => {
    // 現在光是出席保底就要超過舊版完成獎勵的金幣
    expect(villageGoalParticipation(0).coins).toBeGreaterThanOrEqual(200);
    expect(villageGoalParticipation(3).coins).toBeGreaterThanOrEqual(800);
  });

  test("⚠️ 安慰獎不能寒酸——舊版推一個月沒完成只給 30 箭露", () => {
    for (let tier = 0; tier <= 3; tier += 1) {
      expect(villageGoalConsolation(tier).arrowdew).toBeGreaterThan(30);
      // 大約是出席保底的三成
      expect(villageGoalConsolation(tier).arrowdew / villageGoalParticipation(tier).arrowdew)
        .toBeGreaterThan(0.2);
    }
  });

  test("四個階級的獎勵都是遞增的", () => {
    for (const table of [VILLAGE_GOAL_PARTICIPATION, VILLAGE_GOAL_CONSOLATION]) {
      for (let i = 1; i < table.length; i += 1) {
        expect(table[i].arrowdew).toBeGreaterThan(table[i - 1].arrowdew);
        expect(table[i].gachaToken).toBeGreaterThanOrEqual(table[i - 1].gachaToken);
      }
    }
  });

  test("⚠️ 慶功只給咪咪箱，不給貓貓箱（作者指定，兩者很容易搞混）", () => {
    // 咪咪箱 mimi_box = 隨機一隻貓咪夥伴；貓貓箱 cat_box = 章碎片
    for (let tier = 0; tier <= 3; tier += 1) {
      expect(villageGoalCelebration(tier).catBoxes).toBeUndefined();
      expect(villageGoalCelebration(tier).mimiBoxes).toBeGreaterThan(0);
    }
  });

  test("階級越高咪咪箱越多", () => {
    expect(villageGoalCelebration(3).mimiBoxes).toBeGreaterThan(villageGoalCelebration(0).mimiBoxes);
  });
});

describe("各族材料箱（完成才有，全員一樣）", () => {
  test("⚠️ **七族**都要給（含寶箱族），不能隨機挑一族", () => {
    // 村莊建築需要指定族的材料，隨機的話玩家永遠缺那一族。
    // ⚠️ 是七族不是六族——專案裡同時有兩組清單，地下城那組刻意排除寶箱族。
    const families = new Set(buildCelebrationChests(1).map(c => c.family));
    expect([...families].sort()).toEqual([...MATERIAL_FAMILIES].sort());
    expect(MATERIAL_FAMILIES).toHaveLength(7);
    expect(MATERIAL_FAMILIES).toContain("treasure");
  });

  test("⚠️ 必須用 family_mat（族系素材箱）——通用材料箱會忽略 family 欄位", () => {
    // wood/iron/gold/epic/mythic 是「通用材料寶箱」：固定開六族該階材料、
    // 完全不讀 chest.family，而且明文排除寶箱族。拿它做「每族一箱」等於白做。
    for (const c of buildCelebrationChests(2)) {
      expect(c.chestType).toBe("family_mat");
      expect(["wood", "iron", "gold", "epic", "mythic"]).not.toContain(c.chestType);
    }
  });

  test("七族的素材在 EXPANSION_MATERIALS 裡都真的存在", () => {
    for (const family of MATERIAL_FAMILIES) {
      expect(EXPANSION_MATERIALS.some(m => m.family === family && m.kind === "normal")).toBe(true);
    }
  });

  test("數量夠「大量」，而且階級越高越多", () => {
    const counts = [0, 1, 2, 3].map(celebrationChestCount);
    expect(counts[0]).toBeGreaterThanOrEqual(14);   // 七族 × 2
    expect(counts[3]).toBeGreaterThanOrEqual(35);   // 七族 × 5
    for (let i = 1; i < counts.length; i += 1) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    expect(buildCelebrationChests(3, () => 0)).toHaveLength(counts[3]);
  });

  test("⚠️ 箱子階級要落在該階級的範圍內，不能開出超規格的箱子", () => {
    for (const t of [0, 1, 2, 3]) {
      const [min, max] = villageGoalCelebration(t).chestTierRange;
      for (const c of buildCelebrationChests(t, () => 0)) expect(c.tierIndex).toBe(min);
      for (const c of buildCelebrationChests(t, () => 0.999)) expect(c.tierIndex).toBe(max);
    }
  });
});

describe("邊界", () => {
  test("教練手動建立的目標，自己填的獎勵就是保底層，不被階級表蓋掉", () => {
    const custom = { arrowdew: 42, coins: 7, gachaToken: 1 };
    const r = calcVillageGoalRewards(group([100]), { tier: 3, participation: custom });
    expect(r.p0.participation).toEqual(custom);
  });

  test("沒有人參與回空物件", () => {
    expect(calcVillageGoalRewards({}, { tier: 1 })).toEqual({});
    expect(calcVillageGoalRewards(null)).toEqual({});
  });

  test("階級超出範圍會被夾住", () => {
    expect(villageGoalParticipation(99)).toEqual(VILLAGE_GOAL_PARTICIPATION[3]);
    expect(villageGoalParticipation(-1)).toEqual(VILLAGE_GOAL_PARTICIPATION[0]);
  });

  test("貢獻是壞值也不會算出 NaN", () => {
    const r = calcVillageGoalRewards({ a: { contributed: "壞掉" }, b: { contributed: 500 } }, { tier: 1 });
    expect(r.a).toBeUndefined();
    for (const v of Object.values(r.b.total)) expect(Number.isFinite(v)).toBe(true);
  });
});
