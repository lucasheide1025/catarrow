// src/guild/domain/guildEnhance.test.js
import { enhanceCost, enhanceTotalCost, enhanceInfo, enhanceEquip, salvageCost, salvageEquip, salvageMany, salvageValue } from "./guildEnhance";
import { emptyGuildProfile, normalizeGuildProfile, equipFromStash, unequipSlot } from "./guildRewards";
import { resolveEquipStats, equipDisplayName, plusCapOf, GUILD_AFFIXES } from "../data/guildEquipCatalog";

const withStash = (extra = {}, items = []) => ({
  ...emptyGuildProfile(), shards: 500, catCoins: 500, ...extra,
  stash: items,
});
const item = (uid, grade = "elite", plus = 0, affixes = []) => ({ uid, archetypeId: "iron_bow", grade, plus, affixes });

describe("詞綴與強化的六維計算", () => {
  test("詞綴會加成（銳利提升攻擊）", () => {
    const plain = resolveEquipStats("iron_bow", "elite");
    const sharp = resolveEquipStats("iron_bow", "elite", { affixes: ["sharp"] });
    expect(sharp.atk).toBeGreaterThan(plain.atk);
    expect(GUILD_AFFIXES.sharp.pct.atk).toBeGreaterThan(0);
  });

  test("強化每級加 8%，且被品級上限夾住", () => {
    const p0 = resolveEquipStats("iron_bow", "common", { plus: 0 });
    const p3 = resolveEquipStats("iron_bow", "common", { plus: 3 });
    const p99 = resolveEquipStats("iron_bow", "common", { plus: 99 });
    expect(p3.atk).toBeGreaterThan(p0.atk);
    expect(p99).toEqual(p3);                      // common 上限 +3
    expect(plusCapOf("common")).toBe(3);
    expect(plusCapOf("mythic")).toBe(10);
  });

  test("顯示名帶詞綴與 +N", () => {
    expect(equipDisplayName("iron_bow", "elite", { plus: 3, affixes: ["sharp"] })).toContain("+3");
    expect(equipDisplayName("iron_bow", "elite", { plus: 3, affixes: ["sharp"] })).toContain("銳利");
    expect(equipDisplayName("iron_bow", "elite", {})).not.toContain("+");
  });
});

describe("強化", () => {
  test("成功：+1、扣碎片與 CAT幣", () => {
    const p = withStash({}, [item("a")]);
    const cost = enhanceCost("elite", 0);
    const res = enhanceEquip(p, { where: "stash", uid: "a" });
    expect(res.ok).toBe(true);
    expect(res.profile.stash[0].plus).toBe(1);
    expect(res.profile.shards).toBe(500 - cost.shards);
    expect(res.profile.catCoins).toBe(500 - cost.catCoins);
    expect(res.coinsSpent).toBe(cost.coins);
  });

  test("強化金幣不足時不會改動裝備", () => {
    const p = withStash({}, [item("a")]);
    const res = enhanceEquip(p, { where: "stash", uid: "a" }, { coins: 0 });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/金幣不足/);
    expect(res.profile.stash[0].plus).toBe(0);
  });

  test("裝備中的也能強化（不必先卸下）", () => {
    const p = { ...withStash(), equipped: { bow: { archetypeId: "iron_bow", grade: "boss", plus: 0, affixes: [] } } };
    const res = enhanceEquip(p, { where: "equipped", slot: "bow" });
    expect(res.ok).toBe(true);
    expect(res.profile.equipped.bow.plus).toBe(1);
  });

  test("達品級上限 → 擋下", () => {
    const p = withStash({}, [item("a", "common", 3)]);
    const res = enhanceEquip(p, { where: "stash", uid: "a" });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/上限/);
    expect(enhanceInfo(item("a", "common", 3)).maxed).toBe(true);
  });

  test("資源不足 → 擋下且不扣款", () => {
    const poor = { ...withStash({ shards: 0, catCoins: 0 }, [item("a")]) };
    const res = enhanceEquip(poor, { where: "stash", uid: "a" });
    expect(res.ok).toBe(false);
    expect(res.profile.shards).toBe(0);
  });

  test("成本隨等級與品級遞增", () => {
    expect(enhanceCost("elite", 1).shards).toBeGreaterThan(enhanceCost("elite", 0).shards);
    expect(enhanceCost("mythic", 0).shards).toBeGreaterThan(enhanceCost("common", 0).shards);
    expect(enhanceTotalCost("elite", 3).shards).toBe(
      enhanceCost("elite", 0).shards + enhanceCost("elite", 1).shards + enhanceCost("elite", 2).shards,
    );
  });

  test("純函數：不修改傳入的存檔", () => {
    const before = withStash({}, [item("a")]);
    enhanceEquip(before, { where: "stash", uid: "a" });
    expect(before.shards).toBe(500);
    expect(before.stash[0].plus).toBe(0);
  });
});

describe("分解（重複裝備的出口）", () => {
  test("分解得碎片、該件從倉庫消失", () => {
    const p = withStash({ shards: 0 }, [item("a", "boss")]);
    const res = salvageEquip(p, "a");
    expect(res.ok).toBe(true);
    expect(res.profile.stash).toHaveLength(0);
    expect(res.profile.shards).toBe(salvageValue(item("a", "boss")));
    expect(res.coinsSpent).toBe(salvageCost(item("a", "boss")));
  });

  test("分解也需要金幣，餘額不足不能拆掉裝備", () => {
    const p = withStash({ shards: 0 }, [item("a", "boss")]);
    const res = salvageEquip(p, "a", { coins: salvageCost(item("a", "boss")) - 1 });
    expect(res.ok).toBe(false);
    expect(res.profile.stash).toHaveLength(1);
  });

  test("品級越高回收越多；強化過的回收 8 成投入", () => {
    expect(salvageValue(item("a", "mythic"))).toBeGreaterThan(salvageValue(item("a", "common")));
    expect(salvageValue(item("a", "elite", 3))).toBeGreaterThan(salvageValue(item("a", "elite", 0)));
  });

  test("批次分解：清倉一次拆多件", () => {
    const p = withStash({ shards: 0 }, [item("a"), item("b"), item("c")]);
    const res = salvageMany(p, ["a", "c", "nope"]);
    expect(res.count).toBe(2);
    expect(res.profile.stash.map(i => i.uid)).toEqual(["b"]);
    expect(res.gained).toBeGreaterThan(0);
  });

  test("找不到 uid → 不動存檔", () => {
    const p = withStash({}, [item("a")]);
    expect(salvageEquip(p, "zzz").ok).toBe(false);
  });
});

describe("換裝不能弄丟強化與詞綴（回歸測試）", () => {
  test("裝上／卸下都要保留 plus 與 affixes", () => {
    const p = withStash({}, [item("a", "boss", 4, ["sharp", "lucky"])]);
    const equipped = equipFromStash(p, "a");
    expect(equipped.equipped.bow.plus).toBe(4);
    expect(equipped.equipped.bow.affixes).toEqual(["sharp", "lucky"]);
    const off = unequipSlot(equipped, "bow");
    const back = off.stash.find(i => i.archetypeId === "iron_bow");
    expect(back.plus).toBe(4);
    expect(back.affixes).toEqual(["sharp", "lucky"]);
  });

  test("舊存檔（沒有 plus/affixes）正規化後補 0/[]", () => {
    const p = normalizeGuildProfile({ stash: [{ uid: "x", archetypeId: "iron_bow", grade: "rare" }], shards: -5 });
    expect(p.stash[0]).toEqual({ uid: "x", at: 0, archetypeId: "iron_bow", grade: "rare", plus: 0, affixes: [] });
    expect(p.shards).toBe(0);
  });

  test("髒詞綴 id 會被過濾", () => {
    const p = normalizeGuildProfile({ stash: [{ uid: "x", archetypeId: "iron_bow", grade: "rare", affixes: ["sharp", "nope"] }] });
    expect(p.stash[0].affixes).toEqual(["sharp"]);
  });
});
