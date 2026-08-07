import { EXPEDITION_SLOTS, suggestNextActions } from "./homeSuggestions";

describe("首頁空狀態的建議", () => {
  test("⚠️ 什麼都沒有時**一定要給事情做**，不能回空陣列", () => {
    const r = suggestNextActions({ checkedIn: true, expeditionCount: EXPEDITION_SLOTS });
    expect(r.length).toBeGreaterThan(0);
  });

  test("⚠️ 沒報到永遠排第一——今天的箭數要報到才算", () => {
    const r = suggestNextActions({ checkedIn: false, worldBossActive: true });
    expect(r[0].key).toBe("checkin");
  });

  test("報到了就不再提醒報到", () => {
    expect(suggestNextActions({ checkedIn: true }).some(a => a.key === "checkin")).toBe(false);
  });

  test("世界王在場上／蓄力中給不同的建議，不會同時出現", () => {
    const active = suggestNextActions({ checkedIn: true, worldBossActive: true });
    const charge = suggestNextActions({ checkedIn: true, worldBossCharging: true });
    expect(active.some(a => a.key === "worldboss")).toBe(true);
    expect(active.some(a => a.key === "wbcharge")).toBe(false);
    expect(charge.some(a => a.key === "wbcharge")).toBe(true);
  });

  test("遠征槽滿了就不提醒；沒滿會說還剩幾個", () => {
    expect(suggestNextActions({ checkedIn: true, expeditionCount: EXPEDITION_SLOTS })
      .some(a => a.key === "expedition")).toBe(false);
    const r = suggestNextActions({ checkedIn: true, expeditionCount: 1 });
    expect(r.find(a => a.key === "expedition").title).toContain("2");
  });

  test("年度檢定開放中要給提醒（考到越高級三圍越強）", () => {
    const r = suggestNextActions({ checkedIn: true, certOpen: true });
    expect(r.some(a => a.key === "cert" && a.page === "comps")).toBe(true);
    expect(suggestNextActions({ checkedIn: true }).some(a => a.key === "cert")).toBe(false);
  });

  test("⚠️ 打怪建議要跳 monster（battle 不是有效頁面，跳過去是空白）", () => {
    const r = suggestNextActions({ checkedIn: true });
    const b = r.find(a => a.key === "battle");
    expect(b).toBeTruthy();
    expect(b.page).toBe("monster");
  });

  test("村目標建議要跳 gacha（村目標在貓村，village 不是有效頁面）", () => {
    const r = suggestNextActions({ checkedIn: true, villageGoal: { status: "active" } });
    expect(r.find(a => a.key === "villagegoal")?.page).toBe("gacha");
  });

  test("貓貓村探索地圖建議要給（boardOpen 預設有骰子可玩）", () => {
    const r = suggestNextActions({ checkedIn: true });
    expect(r.some(a => a.key === "board" && a.page === "board")).toBe(true);
    expect(suggestNextActions({ checkedIn: true, boardOpen: false }).some(a => a.key === "board")).toBe(false);
  });

  test("最多只給 3 筆——首頁不能變成待辦清單", () => {
    const r = suggestNextActions({
      checkedIn: false, worldBossActive: true, expeditionCount: 0,
      villageGoal: { status: "active" },
    });
    expect(r).toHaveLength(3);
  });

  test("每一筆都要有可以跳過去的頁面", () => {
    for (const a of suggestNextActions({})) expect(typeof a.page).toBe("string");
  });

  test("空參數不會炸", () => {
    expect(() => suggestNextActions()).not.toThrow();
  });
});
