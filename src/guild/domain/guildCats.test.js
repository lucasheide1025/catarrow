// src/guild/domain/guildCats.test.js
import { toGuildCat, buildCatRoster, pickPartyCats, togglePartyCat, MAX_PARTY_CATS } from "./guildCats";
import { normalizeGuildProfile, emptyGuildProfile } from "./guildRewards";
import { CATS } from "../../lib/catData";

const catIds = Object.keys(CATS);
const [c1, c2, c3, c4] = catIds;

// 模擬 members/{id}/cats/{catId} 文件
const catDoc = (catId, catXP = 0, bond = 0) => ({ catId, catXP, bond, equip: {} });

describe("真貓 → 公會戰鬥單位", () => {
  test("帶出戰鬥需要的欄位（沿用主線 calcCatCombatStats）", () => {
    const g = toGuildCat(catDoc(c1, 5000, 20));
    expect(g.id).toBe(c1);
    expect(g.name).toBe(CATS[c1].name);
    expect(g.icon).toBeTruthy();
    expect(g.atk).toBeGreaterThan(0);
    expect(g.def).toBeGreaterThan(0);
    expect(g.hp).toBeGreaterThan(0);
    expect(g.level).toBeGreaterThanOrEqual(1);
  });

  test("養越多（XP/羈絆）遠征越強 —— 這是貓村×打怪的融合點", () => {
    const weak = toGuildCat(catDoc(c1, 0, 0));
    const strong = toGuildCat(catDoc(c1, 50000, 40));
    expect(strong.atk).toBeGreaterThan(weak.atk);
    expect(strong.level).toBeGreaterThan(weak.level);
  });

  test("名冊依攻擊排序（強的排前面）、忽略髒資料", () => {
    const roster = buildCatRoster({
      [c1]: catDoc(c1, 0, 0),
      [c2]: catDoc(c2, 60000, 40),
      bad: null,
    });
    expect(roster).toHaveLength(2);
    expect(roster[0].atk).toBeGreaterThanOrEqual(roster[1].atk);
  });
});

describe("出戰名單", () => {
  const roster = buildCatRoster({
    [c1]: catDoc(c1, 40000, 30), [c2]: catDoc(c2, 30000, 20),
    [c3]: catDoc(c3, 20000, 10), [c4]: catDoc(c4, 0, 0),
  });

  test("沒設定過（null）→ 自動帶最強的前 N 隻", () => {
    const party = pickPartyCats(roster, null);
    expect(party).toHaveLength(MAX_PARTY_CATS);
    expect(party[0].atk).toBeGreaterThanOrEqual(party[1].atk);
  });

  test("刻意全部取消（[]）→ 真的不帶貓，不會被自動補回去", () => {
    expect(pickPartyCats(roster, [])).toHaveLength(0);
  });

  test("選過 → 照選的；不存在的貓被忽略；超過上限截斷", () => {
    expect(pickPartyCats(roster, [c2, "ghost_cat"]).map(c => c.id)).toEqual([c2]);
    expect(pickPartyCats(roster, catIds)).toHaveLength(MAX_PARTY_CATS);
  });

  test("勾選/取消；滿了就擋下（不會偷偷換掉別隻）", () => {
    expect(togglePartyCat([], c1)).toEqual([c1]);
    expect(togglePartyCat([c1, c2], c1)).toEqual([c2]);
    const full = [c1, c2, c3];
    expect(togglePartyCat(full, c4)).toEqual(full);
  });

  test("存檔：新玩家 partyCats = null（未設定），存過空陣列則保留為空", () => {
    expect(emptyGuildProfile().partyCats).toBeNull();
    expect(normalizeGuildProfile({ partyCats: [] }).partyCats).toEqual([]);
    expect(normalizeGuildProfile({ partyCats: [c1, 5] }).partyCats).toEqual([c1]);
    expect(normalizeGuildProfile({}).partyCats).toBeNull();
  });
});
