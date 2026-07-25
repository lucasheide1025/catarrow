// src/guild/domain/guildRewards.test.js
import {
  guildMaterialId, expandLootMaterials, emptyGuildProfile, normalizeGuildProfile,
  applyLootToProfile, equipFromStash, unequipSlot, GUILD_STASH_LIMIT, REP_PER_DANGER,
} from "./guildRewards";
import { sellJunkFromStock, junkStockView, allJunkSellMap } from "./guildRewards";
import { GUILD_EQUIP_ARCHETYPES, GUILD_SLOTS, salvageValue } from "../data/guildEquipCatalog";
import { shouldAutoSalvage, DEFAULT_AUTO_SALVAGE } from "./guildRewards";
import { JUNK_BY_ID, evaluateJunk } from "../data/guildJunkCatalog";

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
    expect(profile.stash).toEqual([{ uid: "u0", archetypeId: "iron_bow", grade: "elite", plus: 0, affixes: [], at: 1 }]);
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

describe("雜貨倉庫（不自動賣，玩家決定何時賣）", () => {
  const loot = { won: true, coins: 100, catCoins: 8, materials: [], legacyMaterials: [],
    junk: [{ id: "rusty_gear" }, { id: "rusty_gear" }, { id: "gemstone_shard" }], equipDrops: [] };

  test("撈到的雜貨進倉庫，不會變成錢", () => {
    const { profile } = applyLootToProfile(emptyGuildProfile(), loot, { danger: 1, uidFn });
    expect(profile.junkStock).toEqual({ rusty_gear: 2, gemstone_shard: 1 });
    expect(profile.catCoins).toBe(8);          // 只有委託酬金，沒有雜貨的錢
    expect(profile.junkSeen.rusty_gear).toBe(2); // 圖鑑照樣記
  });

  test("賣出：扣庫存、CAT幣入袋、金幣回傳給 db 寫主線", () => {
    const { profile: p0 } = applyLootToProfile(emptyGuildProfile(), loot, { danger: 1, uidFn });
    const res = sellJunkFromStock(p0, { rusty_gear: 1 }, 1);
    expect(res.profile.junkStock.rusty_gear).toBe(1);
    const unit = evaluateJunk("rusty_gear", 1);
    expect(res.coins).toBe(unit.coins);
    expect(res.profile.catCoins).toBe(8 + unit.catCoins);
    expect(res.sold).toEqual([{ id: "rusty_gear", name: JUNK_BY_ID.rusty_gear.name, qty: 1 }]);
  });

  test("賣光某項就從倉庫消失；賣超過持有量只賣到持有量", () => {
    const { profile: p0 } = applyLootToProfile(emptyGuildProfile(), loot, { danger: 1, uidFn });
    const res = sellJunkFromStock(p0, { rusty_gear: 99 }, 1);
    expect(res.profile.junkStock.rusty_gear).toBeUndefined();
    expect(res.sold[0].qty).toBe(2);
  });

  test("LUK 評估加成是賣出當下才算（先囤再賣更值錢）", () => {
    const { profile: p0 } = applyLootToProfile(emptyGuildProfile(), loot, { danger: 1, uidFn });
    const poor = sellJunkFromStock(p0, { gemstone_shard: 1 }, 1);
    const rich = sellJunkFromStock(p0, { gemstone_shard: 1 }, 1.5);
    expect(rich.coins).toBeGreaterThan(poor.coins);
  });

  test("沒有的雜貨/髒 id 不會賣出東西", () => {
    const res = sellJunkFromStock(emptyGuildProfile(), { nope: 5, rusty_gear: 3 }, 1);
    expect(res.sold).toEqual([]);
    expect(res.coins).toBe(0);
  });

  test("倉庫檢視：稀有度高的排前面、單價/總價正確", () => {
    const { profile } = applyLootToProfile(emptyGuildProfile(), loot, { danger: 1, uidFn });
    const view = junkStockView(profile, 1);
    expect(view[0].id).toBe("gemstone_shard");     // prize > common
    const gear = view.find(v => v.id === "rusty_gear");
    expect(gear.totalCoins).toBe(gear.unitCoins * 2);
    expect(allJunkSellMap(profile)).toEqual({ rusty_gear: 2, gemstone_shard: 1 });
  });

  test("存檔正規化：不存在的雜貨 id 與非正數量會被丟掉", () => {
    const p = normalizeGuildProfile({ junkStock: { rusty_gear: 3, ghost_of_nothing: 2, bad: 0, neg: -1 } });
    expect(p.junkStock).toEqual({ rusty_gear: 3 });
  });
});

describe("裝備圖鑑要夠豐富", () => {
  test("每個槽位都有多種基礎裝（作者要求非常豐富）", () => {
    for (const slot of GUILD_SLOTS) {
      const n = Object.values(GUILD_EQUIP_ARCHETYPES).filter(a => a.slot === slot).length;
      expect(n).toBeGreaterThanOrEqual(6);
    }
    expect(Object.keys(GUILD_EQUIP_ARCHETYPES).length).toBeGreaterThanOrEqual(35);
  });

  test("起手裝與商店設定用到的 id 都還存在（擴充不能弄壞舊存檔）", () => {
    for (const id of ["wood_bow", "wood_arrow", "cloth_armor", "hunter_bow", "leather_armor", "potion_pouch_l", "ranger_quiver", "long_bow", "scout_armor", "heavy_arrow", "sharp_arrow", "small_quiver", "iron_bow", "potion_pouch_s"]) {
      expect(GUILD_EQUIP_ARCHETYPES[id]).toBeTruthy();
    }
  });
});

describe("換裝", () => {
  test("倉庫件裝上對應槽位，原本那件退回倉庫（不消失）", () => {
    const p0 = { ...emptyGuildProfile(), stash: [{ uid: "a", archetypeId: "iron_bow", grade: "boss" }] };
    const p1 = equipFromStash(p0, "a");
    expect(p1.equipped.bow).toEqual({ archetypeId: "iron_bow", grade: "boss", plus: 0, affixes: [] });
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

describe("撿取過濾器 / 倉庫溢出（掉落調高之後的必要配套）", () => {
  const drop = (grade, affixes = []) => ({ archetypeId: "iron_bow", grade, affixes });
  const lootOf = (...drops) => ({ won: true, coins: 0, catCoins: 0, materials: [], legacyMaterials: [], junk: [], equipDrops: drops });
  const rule = extra => ({ ...DEFAULT_AUTO_SALVAGE, enabled: true, ...extra });

  test("預設關閉（不會突然幫玩家拆東西）", () => {
    expect(DEFAULT_AUTO_SALVAGE.enabled).toBe(false);
    expect(shouldAutoSalvage({ grade: "common", affixes: [] }, DEFAULT_AUTO_SALVAGE)).toBe(false);
  });

  test("開啟後：低品級自動拆、高品級保留", () => {
    const r = rule({ maxGrade: "rare" });
    expect(shouldAutoSalvage({ grade: "common", affixes: [] }, r)).toBe(true);
    expect(shouldAutoSalvage({ grade: "rare", affixes: [] }, r)).toBe(true);
    expect(shouldAutoSalvage({ grade: "elite", affixes: [] }, r)).toBe(false);
  });

  test("詞綴夠多、或已強化過的一律保留（怕誤拆好東西）", () => {
    const r = rule({ maxGrade: "rare", keepAffixes: 2 });
    expect(shouldAutoSalvage({ grade: "common", affixes: ["sharp", "lucky"] }, r)).toBe(false);
    expect(shouldAutoSalvage({ grade: "common", affixes: ["sharp"], plus: 1 }, r)).toBe(false);
  });

  test("入庫時自動分解 → 換成碎片而不是進倉庫", () => {
    const p0 = { ...emptyGuildProfile(), autoSalvage: rule({ maxGrade: "common" }) };
    const res = applyLootToProfile(p0, lootOf(drop("common"), drop("elite")), { danger: 1, uidFn });
    expect(res.autoSalvaged).toBe(1);
    expect(res.profile.stash).toHaveLength(1);              // 只留 elite
    expect(res.profile.stash[0].grade).toBe("elite");
    expect(res.profile.shards).toBe(salvageValue({ grade: "common", plus: 0 }));
    expect(res.profile.salvagedCount).toBe(1);
  });

  test("倉庫滿：不再白掉，多的一樣轉碎片", () => {
    const full = {
      ...emptyGuildProfile(),
      stash: Array.from({ length: GUILD_STASH_LIMIT }, (_, i) => ({ uid: `s${i}`, archetypeId: "wood_bow", grade: "common", plus: 0, affixes: [] })),
    };
    const res = applyLootToProfile(full, lootOf(drop("boss", ["sharp"])), { danger: 6, uidFn });
    expect(res.stashFull).toBe(true);
    expect(res.overflowSalvaged).toBe(1);
    expect(res.shardsGained).toBeGreaterThan(0);
    expect(res.profile.stash).toHaveLength(GUILD_STASH_LIMIT);
  });

  test("倉庫上限提高到 120（掉落調高後 60 太快爆）", () => {
    expect(GUILD_STASH_LIMIT).toBe(120);
  });
});
