// 精煉材料難度曲線改版（2026-07-19）
// 只調「材料需求」，加成公式維持不動 —— 見下方護欄測試。
import { PREVIEW_GRADES, previewGradeBonus } from "./equipGradeCurve";
import { EQUIP_GRADES, getEquipSlotBonus } from "./constants";
import { generateRandomMats, matKindsFor, matCountsFor } from "./equipData";
import { EXPANSION_MATERIALS } from "./monsterExpansionCatalog";

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

  test("擴充開啟時取用完整清冊：7 族 × 每階 3 種，不再只認舊的六族各 1 種", () => {
    const withExpansion = { expansionEnabled: true, expansionMaterials: EXPANSION_MATERIALS };
    const seen = new Set();
    // 隨機抽樣，跑夠多次把整池掃出來
    for (let i = 0; i < 400; i += 1) {
      OBTAINABLE.forEach(grade => {
        for (let plus = 0; plus <= 4; plus += 1) {
          generateRandomMats(grade, plus, withExpansion).materials
            .filter(m => m.tierRole !== "boss")
            .forEach(m => seen.add(m.id));
        }
      });
    }
    const allNormal = EXPANSION_MATERIALS.filter(m => m.kind === "normal").map(m => m.id);
    expect(allNormal).toHaveLength(126);
    // 126 種一般材料應該全部有機會被要求（含寶藏族，以及每族每階另外 2 種）
    allNormal.forEach(id => expect(seen.has(id)).toBe(true));
    // 第 7 族（寶藏族）舊寫法完全碰不到，這裡明確確認它有進來
    const familyOf = Object.fromEntries(EXPANSION_MATERIALS.map(m => [m.id, m.family]));
    expect([...seen].some(id => familyOf[id] === "treasure")).toBe(true);
  });

  test("王素材也涵蓋全部 7 族（舊寫法先鎖六族，寶藏族永遠抽不到）", () => {
    const withExpansion = { expansionEnabled: true, expansionMaterials: EXPANSION_MATERIALS };
    const bossFamilies = new Set();
    const metaById = Object.fromEntries(EXPANSION_MATERIALS.map(m => [m.id, m]));
    for (let i = 0; i < 400; i += 1) {
      ["epic", "legend", "mythic"].forEach(grade => {
        for (let plus = 0; plus <= 4; plus += 1) {
          generateRandomMats(grade, plus, withExpansion).materials
            .filter(m => m.tierRole === "boss")
            .forEach(m => bossFamilies.add(metaById[m.id].family));
        }
      });
    }
    expect(bossFamilies.size).toBe(7);
  });

  test("擴充關閉時退回舊的六族材料，不會產生玩家拿不到的 id", () => {
    const off = { expansionEnabled: false, expansionMaterials: EXPANSION_MATERIALS };
    OBTAINABLE.forEach(grade => {
      generateRandomMats(grade, 0, off).materials.forEach(m => {
        expect(m.id).toMatch(/^(ghost|mountain|insect|workplace|exam|temple)_m[1-6]$/);
      });
    });
  });

  test("保底：該階材料一定包含玩家持有最多的那一種", () => {
    const opts2 = { expansionEnabled: true, expansionMaterials: EXPANSION_MATERIALS };
    // T3 = 精英的該階。挑一個冷門材料塞滿庫存，看它是否每次都被要求
    const t3 = EXPANSION_MATERIALS.filter(m => m.kind === "normal" && m.tierIndex === 3);
    const hoarded = t3[t3.length - 1].id;
    const inventory = { [hoarded]: 999, [t3[0].id]: 5 };
    for (let i = 0; i < 60; i += 1) {
      const mats = generateRandomMats("elite", 0, { ...opts2, inventory });
      const current = mats.materials.filter(m => m.tierRole === "current");
      expect(current.some(m => m.id === hoarded)).toBe(true);
      expect(new Set(current.map(m => m.id)).size).toBe(current.length); // 保底不得造成重複
    }
  });

  test("保底只作用在該階，下一階仍維持隨機（否則難度會被玩家囤貨架空）", () => {
    const t4 = EXPANSION_MATERIALS.filter(m => m.kind === "normal" && m.tierIndex === 4);
    const hoarded = t4[t4.length - 1].id;
    const inventory = { [hoarded]: 999 };
    const seenNext = new Set();
    for (let i = 0; i < 60; i += 1) {
      generateRandomMats("elite", 0, { expansionEnabled: true, expansionMaterials: EXPANSION_MATERIALS, inventory })
        .materials.filter(m => m.tierRole === "next").forEach(m => seenNext.add(m.id));
    }
    expect(seenNext.size).toBeGreaterThan(3); // 有在變動，不是每次都固定那一種
  });

  test("庫存全空或沒傳 inventory 時退回純隨機，不會壞掉", () => {
    const base = { expansionEnabled: true, expansionMaterials: EXPANSION_MATERIALS };
    expect(generateRandomMats("elite", 0, base).materials).toHaveLength(8);
    expect(generateRandomMats("elite", 0, { ...base, inventory: {} }).materials).toHaveLength(8);
    // 庫存是負值（歷史髒資料）也不能被當成「持有最多」
    const dirty = { inventory: { ghost_m3: -5 }, ...base };
    expect(generateRandomMats("elite", 0, dirty).materials).toHaveLength(8);
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
