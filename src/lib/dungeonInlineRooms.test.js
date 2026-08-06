import {
  INLINE_ROOM_TYPES,
  INLINE_ROOM_WEIGHTS,
  SCOUT_REVEAL_RADIUS,
  formatInlineBadges,
  isInlineRoom,
  miniChestMaterialQuantity,
  miniChestMaterialTier,
  normalizeInlineRoomType,
  pickInlineRoomType,
  resolveInlineRoom,
  rollMiniChestMaterial,
} from "./dungeonInlineRooms";
import { GENERAL_EVENTS } from "./dungeonEventPool";
import { MATERIALS } from "./monsterMaterials";

// 七族（含第 7 族寶箱族 treasure）——
// 與 dungeonExpansionMonsters.js::FAMILY_ALIASES、monsterExpansionAdapter.js::SOLO_HUNT_FAMILIES 同一組
const DUNGEON_FAMILIES = ["ghost", "mountain", "insect", "workplace", "exam", "temple", "treasure"];

// 固定序列的假亂數：讓「抽到哪一則事件」可預期
function sequence(values) {
  let index = 0;
  return () => values[Math.min(values.length - 1, index++)];
}

describe("輕量房型別判定", () => {
  it("五種輕量房都認得", () => {
    expect(INLINE_ROOM_TYPES).toEqual(["quick_event", "empty", "coin_pouch", "mini_chest", "scout"]);
    INLINE_ROOM_TYPES.forEach(type => expect(isInlineRoom(type)).toBe(true));
  });

  it("重量房一律不是輕量房", () => {
    ["battle", "elite_battle", "boss_battle", "trap", "event", "chest", "shop", "rest", "stairs", "entrance"]
      .forEach(type => expect(isInlineRoom(type)).toBe(false));
  });

  // 舊存檔（接線前的 activeExpedition / expeditionMapState）還有 general_event 房。
  // 這條若壞掉，玩家讀舊檔會踩到 UI 的 default 分支 → 空白畫面卡死。
  it("舊存檔的 general_event 視同 quick_event", () => {
    expect(normalizeInlineRoomType("general_event")).toBe("quick_event");
    expect(isInlineRoom("general_event")).toBe(true);
    expect(resolveInlineRoom({ type: "general_event" }, { random: sequence([0]) }).roomType).toBe("quick_event");
  });
});

describe("權重抽取", () => {
  it("權重加總 110，五種都抽得到", () => {
    expect(INLINE_ROOM_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0)).toBe(110);
    const seen = new Set();
    for (let i = 0; i < 4000; i += 1) seen.add(pickInlineRoomType());
    expect(seen.size).toBe(INLINE_ROOM_TYPES.length);
  });

  it("quick_event 是最常見的（權重 40）", () => {
    const counts = {};
    for (let i = 0; i < 6000; i += 1) {
      const type = pickInlineRoomType();
      counts[type] = (counts[type] || 0) + 1;
    }
    expect(counts.quick_event).toBeGreaterThan(counts.empty);
    expect(counts.empty).toBeGreaterThan(counts.mini_chest);
    expect(counts.scout).toBeGreaterThan(0);
  });

  it("邊界：random 回 0 與趨近 1 都要回合法型別", () => {
    expect(INLINE_ROOM_TYPES).toContain(pickInlineRoomType(() => 0));
    expect(INLINE_ROOM_TYPES).toContain(pickInlineRoomType(() => 0.999999));
  });
});

describe("resolveInlineRoom", () => {
  it("quick_event 的 effect 與 GENERAL_EVENTS 同構，且一定有數值", () => {
    const allowed = new Set(["hp", "atk", "def", "dmg", "gold", "item", "monsterHp", "monsterAtk"]);
    for (let i = 0; i < 300; i += 1) {
      const { effect, toast } = resolveInlineRoom({ type: "quick_event" });
      expect(Object.keys(effect).length).toBeGreaterThan(0);
      Object.keys(effect).forEach(key => expect(allowed.has(key)).toBe(true));
      expect(toast.title).toBeTruthy();
      expect(toast.badges.length).toBeGreaterThan(0);
    }
  });

  it("quick_event 只抽有效果的一般事件，不會抽到純劇情那 11 則", () => {
    const flavourTitles = new Set(
      GENERAL_EVENTS.filter(e => !e.effect || Object.keys(e.effect).length === 0).map(e => e.title),
    );
    expect(flavourTitles.size).toBe(11);
    for (let i = 0; i < 300; i += 1) {
      expect(flavourTitles.has(resolveInlineRoom({ type: "quick_event" }).toast.title)).toBe(false);
    }
  });

  it("empty 沒有任何效果，但有台詞", () => {
    for (let i = 0; i < 100; i += 1) {
      const result = resolveInlineRoom({ type: "empty" });
      expect(result.effect).toEqual({});
      expect(result.revealRadius).toBe(0);
      expect(result.toast.badges).toEqual([]);
      expect(result.toast.desc).toBeTruthy();
    }
  });

  it("coin_pouch 金幣落在 20~60", () => {
    for (let i = 0; i < 300; i += 1) {
      const { effect } = resolveInlineRoom({ type: "coin_pouch" });
      expect(effect.gold).toBeGreaterThanOrEqual(20);
      expect(effect.gold).toBeLessThanOrEqual(60);
    }
    expect(resolveInlineRoom({ type: "coin_pouch" }, { random: () => 0 }).effect.gold).toBe(20);
    expect(resolveInlineRoom({ type: "coin_pouch" }, { random: () => 0.999999 }).effect.gold).toBe(60);
  });

  it("mini_chest 三種內容都抽得到（素材／藥水／箭露）", () => {
    const ctx = { family: "insect", difficultyTier: 3 };
    // roll < 0.5 → 素材
    expect(resolveInlineRoom({ type: "mini_chest" }, { ...ctx, random: sequence([0, 0]) }).effect.material)
      .toBeTruthy();
    // 0.5 ≤ roll < 0.75 → 藥水
    expect(resolveInlineRoom({ type: "mini_chest" }, { ...ctx, random: () => 0.6 }).effect)
      .toEqual({ item: "carry_heal_basic" });
    // roll ≥ 0.75 → 箭露
    expect(resolveInlineRoom({ type: "mini_chest" }, { ...ctx, random: sequence([0.9, 0]) }).effect.arrowDew).toBe(8);
    expect(resolveInlineRoom({ type: "mini_chest" }, { ...ctx, random: sequence([0.9, 0.999999]) }).effect.arrowDew).toBe(20);
  });

  it("mini_chest 抽不到素材時退回藥水／箭露，不會開到空箱", () => {
    const result = resolveInlineRoom(
      { type: "mini_chest" },
      { family: "不存在的族", difficultyTier: 3, random: () => 0 },
    );
    expect(result.effect.material).toBeUndefined();
    expect(Object.keys(result.effect).length).toBeGreaterThan(0);
  });

  it("scout 不給數值，只給揭霧半徑", () => {
    const result = resolveInlineRoom({ type: "scout" });
    expect(result.effect).toEqual({});
    expect(result.revealRadius).toBe(SCOUT_REVEAL_RADIUS);
  });

  it("未知型別退回 empty，不丟例外", () => {
    const result = resolveInlineRoom({ type: "nonsense_room" });
    expect(result.roomType).toBe("empty");
    expect(result.effect).toEqual({});
  });

  it("room 為 null 也不會炸", () => {
    expect(() => resolveInlineRoom(null)).not.toThrow();
    expect(resolveInlineRoom(null).roomType).toBe("empty");
  });

  it("每種輕量房都回得出 toast", () => {
    INLINE_ROOM_TYPES.forEach(type => {
      const { toast } = resolveInlineRoom({ type });
      expect(toast.icon).toBeTruthy();
      expect(toast.title).toBeTruthy();
      expect(Array.isArray(toast.badges)).toBe(true);
    });
  });
});

// 這組是迷你寶箱的價值保護規則：寶箱房（重量房）給同階素材，是唯一的同階來源；
// 迷你寶箱一律低一階。這條若鬆掉，寶箱房就沒有存在意義了。
describe("迷你寶箱素材降一階", () => {
  it("階級永遠比地下城低一階，T1 則維持 T1", () => {
    expect(miniChestMaterialTier(1)).toBe("common"); // T1 → T1（已最低）
    expect(miniChestMaterialTier(2)).toBe("common"); // T2 → T1
    expect(miniChestMaterialTier(3)).toBe("rare");   // T3 → T2
    expect(miniChestMaterialTier(4)).toBe("elite");  // T4 → T3
    expect(miniChestMaterialTier(5)).toBe("fierce"); // T5 → T4
    expect(miniChestMaterialTier(6)).toBe("boss");   // T6 → T5
  });

  it("難度值髒掉（0／負數／undefined／超過 6）也不會掉出合法階級", () => {
    ["common"].forEach(expected => {
      expect(miniChestMaterialTier(0)).toBe(expected);
      expect(miniChestMaterialTier(-3)).toBe(expected);
      expect(miniChestMaterialTier(undefined)).toBe(expected);
    });
    expect(miniChestMaterialTier(99)).toBe("boss");
  });

  it("永遠不會發到 mythic（T6 素材只能從 T6 寶箱房拿）", () => {
    for (let tier = 0; tier <= 10; tier += 1) {
      expect(miniChestMaterialTier(tier)).not.toBe("mythic");
    }
  });

  it("數量是 tier+1（低一階但給得多，對照寶箱房的同階 × tier 數量）", () => {
    expect(miniChestMaterialQuantity(1)).toBe(2);
    expect(miniChestMaterialQuantity(3)).toBe(4);
    expect(miniChestMaterialQuantity(6)).toBe(7);
  });

  it("抽出來的素材確實是低一階、且屬於該族", () => {
    const material = rollMiniChestMaterial("insect", 3, () => 0);
    expect(material.family).toBe("insect");
    expect(material.tier).toBe("rare");
    expect(material.quantity).toBe(4);
    expect(material.id).toBeTruthy();
    expect(material.name).toBeTruthy();
  });

  it("素材 id 必須存在於 MATERIALS（發出打造系統不認得的 id 會變死素材）", () => {
    const known = new Set(MATERIALS.map(material => material.id));
    DUNGEON_FAMILIES.forEach(family => {
      for (let tier = 1; tier <= 6; tier += 1) {
        const material = rollMiniChestMaterial(family, tier, () => 0.5);
        if (material) expect(known.has(material.id)).toBe(true);
      }
    });
  });

  it("六個一般族系每一階都抽得到素材", () => {
    DUNGEON_FAMILIES.filter(family => family !== "treasure").forEach(family => {
      for (let tier = 1; tier <= 6; tier += 1) {
        expect(rollMiniChestMaterial(family, tier, () => 0.5)).not.toBeNull();
      }
    });
  });

  // 第 7 族。隱藏地下城 100% 是寶箱族，而 monsterMaterials.js::MATERIALS 裡
  // **沒有** treasure 素材鏈 —— 這是既有設計不是缺漏：寶箱房（dungeonChestLoot.js）
  // 用的是同一份 MATERIALS，所以它在隱藏地下城本來就發不出素材，改由
  // calculateExpeditionRewards 依 family==="treasure" 給 ×3 金幣／箭露補償。
  // 迷你寶箱退回藥水／箭露，與寶箱房行為一致。
  it("寶箱族（第7族）沒有素材鏈，迷你寶箱退回藥水／箭露而不是空箱", () => {
    expect(MATERIALS.some(material => material.family === "treasure")).toBe(false);
    for (let tier = 1; tier <= 6; tier += 1) {
      expect(rollMiniChestMaterial("treasure", tier, () => 0.5)).toBeNull();
      const { effect } = resolveInlineRoom(
        { type: "mini_chest" },
        { family: "treasure", difficultyTier: tier, random: () => 0 },
      );
      expect(effect.material).toBeUndefined();
      expect(effect.item || effect.arrowDew).toBeTruthy();
    }
  });

  it("族系不存在時回 null，交給呼叫端 fallback", () => {
    expect(rollMiniChestMaterial("不存在的族", 3)).toBeNull();
  });
});

describe("formatInlineBadges", () => {
  it("百分比帶正負號", () => {
    expect(formatInlineBadges({ atk: 0.1 })).toEqual(["ATK +10%"]);
    expect(formatInlineBadges({ def: -0.1 })).toEqual(["DEF -10%"]);
  });

  it("金幣、箭露、道具各自成句", () => {
    expect(formatInlineBadges({ gold: 30 })).toEqual(["+30 🪙"]);
    expect(formatInlineBadges({ arrowDew: 12 })).toEqual(["+12 箭露"]);
    expect(formatInlineBadges({ item: "carry_heal_basic" })).toEqual(["獲得 回復藥"]);
    expect(formatInlineBadges({ material: { name: "幻霧髮帶", quantity: 4 } })).toEqual(["幻霧髮帶 ×4"]);
  });

  it("空 effect 回空陣列（空房間不該冒出多餘的字）", () => {
    expect(formatInlineBadges({})).toEqual([]);
    expect(formatInlineBadges()).toEqual([]);
  });

  it("多個效果照 HP→ATK→DEF 順序排", () => {
    expect(formatInlineBadges({ def: 0.05, atk: 0.05, hp: 0.1 }))
      .toEqual(["HP +10%", "ATK +5%", "DEF +5%"]);
  });
});
