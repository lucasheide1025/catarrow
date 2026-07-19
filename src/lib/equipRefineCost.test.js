// 高階精煉的王素材門檻（economy-loot-catalog §6，2026-07-19）
import { EQUIP_UPGRADE_COST, bossMatRequirementFor, generateRandomMats } from "./equipData";
import { EXPANSION_MATERIALS } from "./monsterExpansionCatalog";

const withExpansion = { expansionEnabled: true, expansionMaterials: EXPANSION_MATERIALS };

describe("精煉金幣成本", () => {
  test("傳說 12000、神話 30000", () => {
    expect(EQUIP_UPGRADE_COST.legend.gold).toBe(12000);
    expect(EQUIP_UPGRADE_COST.mythic.gold).toBe(30000);
  });
});

describe("王素材門檻對照表", () => {
  test("史詩只有 +4 突破需要小王×1", () => {
    expect(bossMatRequirementFor("epic", 0)).toBeNull();
    expect(bossMatRequirementFor("epic", 3)).toBeNull();
    expect(bossMatRequirementFor("epic", 4)).toEqual({ kind: "miniBoss", count: 1 });
  });
  test("傳說 0→1/1→2/2→3/3→4 為小王 1/1/2/2，+4 突破改大王×1", () => {
    expect([0, 1, 2, 3].map(l => bossMatRequirementFor("legend", l).count)).toEqual([1, 1, 2, 2]);
    expect([0, 1, 2, 3].every(l => bossMatRequirementFor("legend", l).kind === "miniBoss")).toBe(true);
    expect(bossMatRequirementFor("legend", 4)).toEqual({ kind: "boss", count: 1 });
  });
  test("神話 0→1/1→2/2→3/3→4 為大王 1/1/2/2，+4 已是頂點", () => {
    expect([0, 1, 2, 3].map(l => bossMatRequirementFor("mythic", l).count)).toEqual([1, 1, 2, 2]);
    expect([0, 1, 2, 3].every(l => bossMatRequirementFor("mythic", l).kind === "boss")).toBe(true);
    expect(bossMatRequirementFor("mythic", 4)).toBeNull();
  });
  test("史詩以下不需要王素材", () => {
    for (const grade of ["common", "rare", "elite"]) {
      expect([0, 1, 2, 3, 4].every(l => bossMatRequirementFor(grade, l) === null)).toBe(true);
    }
  });
});

describe("generateRandomMats 產生的需求", () => {
  test("擴充開啟時，傳說會多帶一項小王素材", () => {
    const mats = generateRandomMats("legend", 2, withExpansion);
    const bossEntry = mats.materials.find(m => m.note === "小王素材");
    expect(bossEntry).toBeTruthy();
    expect(bossEntry.count).toBe(2);
    expect(EXPANSION_MATERIALS.find(m => m.id === bossEntry.id).kind).toBe("miniBoss");
  });
  test("神話帶大王素材，且 Tier 為 T6", () => {
    const bossEntry = generateRandomMats("mythic", 0, withExpansion).materials.find(m => m.note === "大王素材");
    const meta = EXPANSION_MATERIALS.find(m => m.id === bossEntry.id);
    expect(meta.kind).toBe("boss");
    expect(meta.tierIndex).toBe(6);
  });
  test("關鍵防呆：擴充關閉時完全不要求王素材（否則正式環境拿不到素材會卡死精煉）", () => {
    const bossNotes = ["小王素材", "大王素材"];
    for (const grade of ["epic", "legend", "mythic"]) {
      for (const level of [0, 1, 2, 3, 4]) {
        const mats = generateRandomMats(grade, level, { expansionEnabled: false, expansionMaterials: EXPANSION_MATERIALS });
        expect(mats.materials.some(m => bossNotes.includes(m.note))).toBe(false);
        expect(mats.materials.length).toBe(6); // 該階 4 種 + 下一階 2 種
      }
    }
  });
  test("需求組成為該階 4 種 + 下一階 2 種（王素材另計）", () => {
    const mats = generateRandomMats("legend", 0, withExpansion);
    const current = mats.materials.filter(m => m.tierRole === "current");
    const next = mats.materials.filter(m => m.tierRole === "next");
    expect(current).toHaveLength(4);
    expect(next).toHaveLength(2);
    expect(new Set(mats.materials.map(m => m.id)).size).toBe(mats.materials.length); // 不重複
    expect(current.every(m => m.count > 0) && next.every(m => m.count > 0)).toBe(true);
    expect(mats.keyItem).toBeNull(); // keyItem 已停用，下一階素材併入 materials
  });
});
