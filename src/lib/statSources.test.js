// 📊 三圍來源明細——「我的」頁要讓玩家看得到 ATK 是怎麼來的。
// ⚠️ 加成再大，看不到就等於沒有：改成無上限之後，3 金肥貓章多了 +36 ATK，
//    但畫面上沒有任何地方告訴玩家，他不會因此想去拿章。
import { calcArcherStats, describeStatSources, sumStatSources } from "./monsterData";

const member = (over = {}) => ({ joinDate: new Date().toISOString(), ...over });
const args = (over = {}, cert = null, lv = 1) => ({
  member: member(over), certification: cert, certRecords: [], dexStats: null, archerLevel: lv,
});

describe("明細要跟實際三圍對得起來", () => {
  test("⚠️ 各段相加 = calcArcherStats 的結果（不含等級那段）", () => {
    const a = args({ fatCat: { gold: 3 }, achievement: { black: 4 } }, { level: "gold" });
    const rows = describeStatSources(a).filter(r => r.key !== "level");
    const real = calcArcherStats(a);
    expect(sumStatSources(rows)).toEqual(real);
  });

  test("白板只有「基礎」一段", () => {
    expect(describeStatSources(args()).map(r => r.key)).toEqual(["base"]);
  });

  test("有章就多一段榮譽章", () => {
    const rows = describeStatSources(args({ fatCat: { gold: 3 } }));
    expect(rows.find(r => r.key === "honor").atk).toBe(36);
  });

  test("⚠️ 金證那段要包含「它把章也一起放大」的部分", () => {
    const withBadge = { fatCat: { gold: 5 } };
    const rows = describeStatSources(args(withBadge, { level: "gold" }));
    const cert = rows.find(r => r.key === "cert");
    // 純固定量是 +10；因為 5% 乘在含章的總量上，實際會超過 10
    expect(cert.atk).toBeGreaterThan(10);
  });

  test("等級那段照 archerLevelBonus", () => {
    const rows = describeStatSources(args({}, null, 117));
    expect(rows.find(r => r.key === "level")).toMatchObject({ hp: 580, atk: 23, def: 23 });
  });

  test("空資料不會炸", () => {
    expect(() => describeStatSources({ member: null })).not.toThrow();
    expect(sumStatSources()).toEqual({ hp: 0, atk: 0, def: 0 });
  });
});
