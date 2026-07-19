// 精煉材料難度曲線改版（2026-07-19）
// 只調「材料需求」，加成公式維持不動 —— 見下方護欄測試。
import { PREVIEW_GRADES, previewGradeBonus } from "./equipGradeCurve";
import { EQUIP_GRADES, getEquipSlotBonus } from "./constants";
import { generateRandomMats, matKindsFor, matCountsFor } from "./equipData";

const OBTAINABLE = ["common", "rare", "elite", "epic", "legend", "mythic"];

describe("護欄：品級加成公式不得變動", () => {
  test("維持 (品級index × 5 + 1) + plusLevel，HP ×5", () => {
    OBTAINABLE.forEach((grade, gradeIdx) => {
      for (let plus = 0; plus <= 4; plus += 1) {
        const expected = gradeIdx * 5 + 1 + plus;
        expect(getEquipSlotBonus("atk", { grade, plusLevel: plus })).toBe(expected);
        expect(getEquipSlotBonus("hp",  { grade, plusLevel: plus })).toBe(expected * 5);
      }
    });
  });

  test("神話+4 仍是 30，不得因精煉改版而膨脹（怪物防禦上限只有 200 出頭）", () => {
    expect(getEquipSlotBonus("atk", { grade: "mythic", plusLevel: 4 })).toBe(30);
    // ATK 四格合計上限
    expect(getEquipSlotBonus("atk", { grade: "mythic", plusLevel: 4 }) * 4).toBe(120);
  });

  test("未知品級回 0，不會讓面板炸掉", () => {
    expect(getEquipSlotBonus("atk", { grade: "nope", plusLevel: 2 })).toBe(0);
  });
});

describe("T7~T9 只顯示不實裝", () => {
  test("上古/天啟/永恆 不在可取得品級內，玩家升不上去", () => {
    PREVIEW_GRADES.forEach(g => {
      expect(EQUIP_GRADES.some(x => x.id === g.id)).toBe(false);
    });
    expect(EQUIP_GRADES[EQUIP_GRADES.length - 1].id).toBe("mythic");
  });

  test("預覽數值沿用同一條直線，接在神話後面不會斷層", () => {
    expect(previewGradeBonus("ancient", 0)).toBe(31);   // 神話+4 = 30
    expect(previewGradeBonus("eternal", 4)).toBe(45);
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
