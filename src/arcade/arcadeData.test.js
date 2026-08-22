import {
  ARCADE_CATS,
  DEFAULT_CAT_ID,
  arcadeCatById,
  validateNickname,
  makeVisitorId,
  buildNewProfile,
  isCompleteProfile,
} from "./arcadeData";

describe("arcadeData — 訪客冒險純資料層", () => {
  test("九隻同行貓齊全，id 唯一且都有本機立繪", () => {
    expect(ARCADE_CATS).toHaveLength(9);
    expect(new Set(ARCADE_CATS.map((c) => c.id)).size).toBe(9);
    for (const c of ARCADE_CATS) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.role).toBeTruthy();
      expect(c.image).toMatch(/^\/cats\//);
    }
  });

  test("arcadeCatById 找得到／找不到都正確", () => {
    expect(arcadeCatById("haji").name).toBe("哈吉");
    expect(arcadeCatById("nope")).toBeNull();
  });

  test("暱稱：去空白、限 10 字、可為空", () => {
    expect(validateNickname("  胖胖  ")).toBe("胖胖");
    expect(validateNickname("一二三四五六七八九十十一")).toBe("一二三四五六七八九十");
    expect(validateNickname("")).toBe("");
    expect(validateNickname(null)).toBe("");
  });

  test("匿名 Visitor ID 每次產生都不同", () => {
    expect(makeVisitorId()).toBeTruthy();
    expect(makeVisitorId()).not.toBe(makeVisitorId());
  });

  test("buildNewProfile 建立完整本機 profile", () => {
    const p = buildNewProfile({ nickname: "胖胖", catId: "baobao" });
    expect(isCompleteProfile(p)).toBe(true);
    expect(p.nickname).toBe("胖胖");
    expect(p.selectedCat).toBe("baobao");
    expect(p.cats.baobao).toEqual({ id: "baobao", level: 1, xp: 0, bond: 0 });
    expect(p.statistics).toEqual({ battles: 0, kills: 0, bestDamage: 0, bestFloor: 0, treasures: 0, xCount: 0 });
    expect(p.playerLevel).toBe(1);
    expect(p.playerXp).toBe(0);
    expect(p.equipment.weapon.itemId).toBe("starter_bow");
    expect(p.cards.equipped).toHaveLength(2);
    expect(p.coins).toBe(0);
    expect(p.createdAt).toBeGreaterThan(0);
  });

  test("未知貓咪退回預設同行貓；空暱稱用預設稱呼", () => {
    const p = buildNewProfile({ nickname: "", catId: "nope" });
    expect(p.selectedCat).toBe(DEFAULT_CAT_ID);
    expect(p.nickname).toBe("小勇者");
  });

  test("isCompleteProfile 拒絕殘缺資料（被重置/損毀時要重新 onboarding）", () => {
    expect(isCompleteProfile(null)).toBe(false);
    expect(isCompleteProfile({})).toBe(false);
    expect(isCompleteProfile({ visitorId: "x" })).toBe(false);
    expect(isCompleteProfile({ visitorId: "x", nickname: "a", selectedCat: "haji" })).toBe(true);
  });
});
