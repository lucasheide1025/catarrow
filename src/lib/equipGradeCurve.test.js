// 裝備品級曲線改版（2026-07-19）
import { GRADE_CURVE, PREVIEW_GRADES, gradeCurveBonus, breakthroughGain } from "./equipGradeCurve";
import { EQUIP_GRADES, getEquipSlotBonus } from "./constants";
import { generateRandomMats, matKindsFor, matCountsFor } from "./equipData";

const OBTAINABLE = ["common", "rare", "elite", "epic", "legend", "mythic"];

describe("加成曲線", () => {
  test("每個品級的 +0→+4 數值符合設計表", () => {
    const table = OBTAINABLE.map(g => [gradeCurveBonus(g, 0), gradeCurveBonus(g, 4)]);
    expect(table).toEqual([[1, 5], [7, 11], [13, 17], [21, 29], [33, 41], [47, 59]]);
  });

  test("沒有任何玩家被削弱：逐格都 ≥ 舊公式 (品級index×5+1)+plusLevel", () => {
    OBTAINABLE.forEach((grade, gradeIdx) => {
      for (let plus = 0; plus <= 4; plus += 1) {
        expect(gradeCurveBonus(grade, plus)).toBeGreaterThanOrEqual(gradeIdx * 5 + 1 + plus);
      }
    });
  });

  test("品級突破的跳幅 = 新品級的 2 個步長，且越高階跳越大", () => {
    const gains = [];
    for (let i = 0; i < OBTAINABLE.length - 1; i += 1) {
      const from = OBTAINABLE[i], to = OBTAINABLE[i + 1];
      expect(breakthroughGain(from, to)).toBe(GRADE_CURVE[to].step * 2);
      gains.push(breakthroughGain(from, to));
    }
    expect(gains).toEqual([...gains].sort((a, b) => a - b)); // 單調遞增
  });

  test("突破的獲益大於品級內單升一級，玩家才有理由突破", () => {
    expect(breakthroughGain("mythic", "ancient")).toBeGreaterThan(GRADE_CURVE.mythic.step);
  });

  test("HP 欄位 ×5，ATK/DEF 不變", () => {
    const equip = { grade: "mythic", plusLevel: 4 };
    expect(getEquipSlotBonus("atk", equip)).toBe(59);
    expect(getEquipSlotBonus("hp", equip)).toBe(59 * 5);
  });

  test("未知品級回 0，不會讓面板炸掉", () => {
    expect(getEquipSlotBonus("atk", { grade: "nope", plusLevel: 2 })).toBe(0);
    expect(gradeCurveBonus(undefined)).toBe(0);
  });
});

describe("T7~T9 只顯示不實裝", () => {
  test("上古/天啟/永恆 有數值但不在可取得品級內", () => {
    PREVIEW_GRADES.forEach(g => {
      expect(GRADE_CURVE[g.id]).toBeDefined();
      expect(EQUIP_GRADES.some(x => x.id === g.id)).toBe(false);
    });
  });

  test("神話仍是可升級的最高品級，不會意外升進上古", () => {
    expect(EQUIP_GRADES[EQUIP_GRADES.length - 1].id).toBe("mythic");
  });
});

describe("材料需求依品級分級", () => {
  const opts = { expansionEnabled: false, expansionMaterials: [] };
  const kindCount = (mats, role) => mats.materials.filter(m => m.tierRole === role).length;

  test("普通只吃 2 種該階材料，沒有下一階", () => {
    const mats = generateRandomMats("common", 0, opts);
    expect(kindCount(mats, "current")).toBe(2);
    expect(kindCount(mats, "next")).toBe(0);
  });

  test("稀有 3+2，再下一階要 +3 才出現", () => {
    expect(matKindsFor("rare", 0)).toEqual({ current: 3, next: 2, next2: 0 });
    expect(matKindsFor("rare", 3)).toEqual({ current: 3, next: 2, next2: 1 });
    expect(kindCount(generateRandomMats("rare", 3, opts), "next2")).toBe(1);
  });

  test("精英/史詩 = 4+3+1，八種材料不會因為只有六族而短少", () => {
    ["elite", "epic"].forEach(grade => {
      const mats = generateRandomMats(grade, 0, opts);
      expect(kindCount(mats, "current")).toBe(4);
      expect(kindCount(mats, "next")).toBe(3);
      expect(kindCount(mats, "next2")).toBe(1);
      expect(new Set(mats.materials.map(m => m.id)).size).toBe(8); // id 不重複
    });
  });

  test("神話沒有更高階材料，改吃滿六族該階", () => {
    const mats = generateRandomMats("mythic", 0, opts);
    expect(kindCount(mats, "current")).toBe(6);
    expect(kindCount(mats, "next")).toBe(0);
  });

  test("不會產生 T7 以上的材料 id（那些 tier 未實裝、玩家拿不到）", () => {
    OBTAINABLE.forEach(grade => {
      for (let plus = 0; plus <= 4; plus += 1) {
        generateRandomMats(grade, plus, opts).materials.forEach(m => {
          expect(m.id).not.toMatch(/_m[789]$/);
        });
      }
    });
  });

  test("整個品級的材料總量：普通最輕、神話最重", () => {
    const totalFor = grade => {
      let sum = 0;
      for (let plus = 0; plus <= 4; plus += 1) {
        const kinds = matKindsFor(grade, plus);
        const counts = matCountsFor(plus);
        sum += kinds.current * counts.current + kinds.next * counts.next + kinds.next2 * counts.next2;
      }
      return sum;
    };
    expect(totalFor("common")).toBe(122);
    expect(totalFor("rare")).toBe(228);
    expect(totalFor("elite")).toBe(313);
    expect(totalFor("epic")).toBe(313);
    expect(totalFor("legend")).toBe(304);
    expect(totalFor("mythic")).toBe(366);
    // 普通比舊版的 284 輕很多 —— 新學生不會一開始就卡死
    expect(totalFor("common")).toBeLessThan(284);
  });
});
