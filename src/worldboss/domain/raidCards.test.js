import { WB_FRAME, hasWorldBossCard, wbFrameStyle, worldBossCardCount } from "./raidCards";
import { createRaidState } from "./raidFlow";

describe("世界王卡判定", () => {
  test("⚠️ 判定沿用既有的 source === 'wb'，不要另外發明一套", () => {
    expect(hasWorldBossCard([{ source: "wb" }])).toBe(true);
    expect(hasWorldBossCard([{ source: "monster" }])).toBe(false);
  });

  test("舊格式（字串陣列）一律不是世界王卡", () => {
    expect(hasWorldBossCard(["ghost_1", "forest_2"])).toBe(false);
  });

  test("壞資料不會炸", () => {
    expect(hasWorldBossCard(null)).toBe(false);
    expect(hasWorldBossCard(undefined)).toBe(false);
    expect(hasWorldBossCard([null, undefined, {}])).toBe(false);
    expect(worldBossCardCount(null)).toBe(0);
  });

  test("數得出張數（上限 3 張，UI 會顯示 ×N）", () => {
    expect(worldBossCardCount([{ source: "wb" }, { source: "wb" }, { source: "monster" }])).toBe(2);
  });

  test("沒有卡就沒有外框樣式（呼叫端直接展開 null）", () => {
    expect(wbFrameStyle(false)).toBeNull();
    expect(wbFrameStyle(true).boxShadow).toContain(WB_FRAME.color);
  });

  test("顏色沿用戰鬥畫面的金邊", () => {
    expect(WB_FRAME.color).toBe("#f5b942");
    expect(WB_FRAME.icon).toBe("👑");
  });
});

describe("戰鬥狀態帶上世界王卡旗標", () => {
  const mk = members => createRaidState({
    boss: { key: "t", hp: 1000, maxHp: 1000, atk: 10, def: 5 }, members,
  });

  test("從 equipped 自動判定", () => {
    const st = mk([
      { memberId: "a", stats: { atk: 1, def: 1, hp: 10 }, equipped: [{ source: "wb" }] },
      { memberId: "b", stats: { atk: 1, def: 1, hp: 10 }, equipped: [{ source: "monster" }] },
    ]);
    expect(st.members[0].wbCard).toBe(true);
    expect(st.members[1].wbCard).toBe(false);
  });

  test("也可以直接給旗標（房間文件存的是布林，不用搬整份裝備）", () => {
    const st = mk([{ memberId: "a", stats: { atk: 1, def: 1, hp: 10 }, wbCard: true }]);
    expect(st.members[0].wbCard).toBe(true);
  });

  test("沒給就是沒有——不會誤判成有卡", () => {
    expect(mk([{ memberId: "a", stats: { atk: 1, def: 1, hp: 10 } }]).members[0].wbCard).toBe(false);
  });

  test("⚠️ 純視覺：世界王卡不影響任何戰鬥數值", () => {
    const withCard = mk([{ memberId: "a", stats: { atk: 100, def: 50, hp: 200 }, wbCard: true }]);
    const without = mk([{ memberId: "a", stats: { atk: 100, def: 50, hp: 200 } }]);
    expect(withCard.members[0].stats).toEqual(without.members[0].stats);
    expect(withCard.members[0].maxHp).toBe(without.members[0].maxHp);
  });
});
