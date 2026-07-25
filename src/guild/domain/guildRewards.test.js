// src/guild/domain/guildRewards.test.js
import {
  guildMaterialId, expandLootMaterials, emptyGuildProfile, normalizeGuildProfile,
  applyLootToProfile, equipFromStash, unequipSlot, GUILD_STASH_LIMIT, REP_PER_DANGER,
} from "./guildRewards";
import { GUILD_EQUIP_ARCHETYPES } from "../data/guildEquipCatalog";

let seq = 0;
const uidFn = () => `u${seq++}`;
beforeEach(() => { seq = 0; });

const wonLoot = {
  won: true, coins: 100, catCoins: 8,
  materials: [{ familyTier: "ghost_t1", qty: 2 }, { familyTier: "exam_t3", qty: 1 }],
  junk: [{ id: "rusty_gear", name: "生鏽齒輪", icon: "⚙️", baseValue: 20 }],
  equipDrops: [{ archetypeId: "iron_bow", grade: "elite" }],
};

describe("材料對應", () => {
  test("公會 familyTier → 主線材料 id", () => {
    expect(guildMaterialId("ghost_t3")).toBe("ghost_m3");
    expect(guildMaterialId("temple_t6")).toBe("temple_m6");
  });
  test("不存在的族／格式錯誤 → null（不會寫髒資料進背包）", () => {
    expect(guildMaterialId("treasure_t1")).toBeNull();
    expect(guildMaterialId("ghost_t9")).toBeNull();
    expect(guildMaterialId("")).toBeNull();
    expect(guildMaterialId(undefined)).toBeNull();
  });
  test("依 qty 展開成 addMaterials 需要的陣列", () => {
    const list = expandLootMaterials(wonLoot.materials);
    expect(list).toHaveLength(3);
    expect(list.filter(m => m.id === "ghost_m1")).toHaveLength(2);
    expect(list[0].name).toBeTruthy();
  });
});

describe("normalizeGuildProfile — 舊/壞資料一律補成完整形狀", () => {
  test("空值 → 起手存檔（有起手裝）", () => {
    const p = normalizeGuildProfile(null);
    expect(p.catCoins).toBe(0);
    expect(p.rep).toBe(0);
    expect(p.equipped.bow.archetypeId).toBe("wood_bow");
    expect(p.stash).toEqual([]);
  });
  test("過濾不存在的裝備 id", () => {
    const p = normalizeGuildProfile({ equipped: { bow: { archetypeId: "ghost_bow", grade: "mythic" } }, stash: [{ uid: "x", archetypeId: "nope" }] });
    expect(p.stash).toHaveLength(0);
    expect(p.equipped.bow.archetypeId).toBe("wood_bow"); // 回退起手裝
  });
});

describe("applyLootToProfile", () => {
  test("勝利：CAT幣/聲望/裝備入庫/雜貨圖鑑/場次都累加", () => {
    const before = emptyGuildProfile();
    const { profile, repGained, coinsGained } = applyLootToProfile(before, wonLoot, { danger: 2, uidFn, now: 1 });
    expect(profile.catCoins).toBe(8);
    expect(repGained).toBe(2 * REP_PER_DANGER);
    expect(profile.rep).toBe(2 * REP_PER_DANGER);
    expect(coinsGained).toBe(100); // 金幣不進公會存檔，交給 members.coins
    expect(profile.catCoins).not.toBe(before.catCoins);
    expect(profile.stash).toEqual([{ uid: "u0", archetypeId: "iron_bow", grade: "elite", at: 1 }]);
    expect(profile.junkSeen.rusty_gear).toBe(1);
    expect(profile.expeditions).toEqual({ total: 1, won: 1, byDanger: { 1: 0, 2: 1, 3: 0 } });
  });

  test("純函數：不修改傳入的存檔", () => {
    const before = emptyGuildProfile();
    applyLootToProfile(before, wonLoot, { danger: 1, uidFn });
    expect(before.catCoins).toBe(0);
    expect(before.stash).toHaveLength(0);
  });

  test("失敗：只記場次，不給任何獎勵與聲望", () => {
    const { profile, repGained } = applyLootToProfile(emptyGuildProfile(), { won: false }, { danger: 3 });
    expect(repGained).toBe(0);
    expect(profile.catCoins).toBe(0);
    expect(profile.rep).toBe(0);
    expect(profile.expeditions).toEqual({ total: 1, won: 0, byDanger: { 1: 0, 2: 0, 3: 0 } });
  });

  test("倉庫滿：不再收，回報 stashFull", () => {
    const full = { ...emptyGuildProfile(), stash: Array.from({ length: GUILD_STASH_LIMIT }, (_, i) => ({ uid: `s${i}`, archetypeId: "wood_bow", grade: "common" })) };
    const { profile, stashFull } = applyLootToProfile(full, wonLoot, { danger: 1, uidFn });
    expect(stashFull).toBe(true);
    expect(profile.stash).toHaveLength(GUILD_STASH_LIMIT);
  });
});

describe("換裝", () => {
  test("倉庫件裝上對應槽位，原本那件退回倉庫（不消失）", () => {
    const p0 = { ...emptyGuildProfile(), stash: [{ uid: "a", archetypeId: "iron_bow", grade: "boss" }] };
    const p1 = equipFromStash(p0, "a");
    expect(p1.equipped.bow).toEqual({ archetypeId: "iron_bow", grade: "boss" });
    expect(p1.stash).toHaveLength(1);
    expect(p1.stash[0].archetypeId).toBe("wood_bow"); // 舊弓退回
    expect(GUILD_EQUIP_ARCHETYPES.iron_bow.slot).toBe("bow");
  });
  test("找不到 uid → 原樣返回", () => {
    const p = equipFromStash(emptyGuildProfile(), "nope");
    expect(p.equipped.bow.archetypeId).toBe("wood_bow");
  });
  test("卸下 → 回倉庫、槽位清空", () => {
    const p = unequipSlot(emptyGuildProfile(), "bow");
    expect(p.equipped.bow).toBeUndefined();
    expect(p.stash.map(i => i.archetypeId)).toContain("wood_bow");
  });
  test("卸下空槽 → 不產生幽靈裝備", () => {
    const p = unequipSlot(emptyGuildProfile(), "quiver");
    expect(p.stash).toHaveLength(0);
  });
});
