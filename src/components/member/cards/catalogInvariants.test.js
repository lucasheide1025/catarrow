// src/components/member/cards/catalogInvariants.test.js
// C6：正式怪物擴充 catalog 的不變量測試（唯讀,不修改 production catalog）。
// 守護：數量、ID 唯一性、舊 60 ID 不變、252 卡/怪/素材交叉引用完整性。
// 資料源：src/lib/monsterExpansionCatalog（正式規格,非 C1-C3 研究草案）。

import {
  EXPANSION_MONSTERS, EXPANSION_MATERIALS, EXPANSION_CARDS,
  EXPANSION_MONSTER_BY_ID, validateMonsterExpansionCatalog,
} from "../../../lib/monsterExpansionCatalog";
import { CARD_CATALOG, CARD_CATALOG_BY_ID } from "./cardCatalog";

const uniq = arr => new Set(arr).size;

describe("C6 — 正式 catalog 內建驗證", () => {
  test("validateMonsterExpansionCatalog() 通過（無 errors）", () => {
    const r = validateMonsterExpansionCatalog();
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe("C6 — 數量", () => {
  test("252 隻 = 一般 126 + 小王 84 + 大王 42", () => {
    expect(EXPANSION_MONSTERS.length).toBe(252);
    const by = e => EXPANSION_MONSTERS.filter(m => m.encounter === e).length;
    expect(by("normal")).toBe(126);
    expect(by("miniBoss")).toBe(84);
    expect(by("boss")).toBe(42);
  });
  test("素材 252 + 卡片 252（與怪物 1:1）", () => {
    expect(EXPANSION_MATERIALS.length).toBe(252);
    expect(EXPANSION_CARDS.length).toBe(252);
  });
  test("encounter 只有 normal / miniBoss / boss", () => {
    expect([...new Set(EXPANSION_MONSTERS.map(m => m.encounter))].sort())
      .toEqual(["boss", "miniBoss", "normal"]);
  });
  test("族系 × Tier 恰 42 組、每組 6 隻", () => {
    const counts = {};
    EXPANSION_MONSTERS.forEach(m => { const k = `${m.family}:${m.tier}`; counts[k] = (counts[k] || 0) + 1; });
    expect(Object.keys(counts).length).toBe(42);
    expect(Object.values(counts).every(c => c === 6)).toBe(true);
  });
});

describe("C6 — ID 唯一性", () => {
  test("怪物 / 素材 / 卡片 / 招牌技能 ID 皆 252 唯一", () => {
    expect(uniq(EXPANSION_MONSTERS.map(m => m.id))).toBe(252);
    expect(uniq(EXPANSION_MATERIALS.map(m => m.id))).toBe(252);
    expect(uniq(EXPANSION_CARDS.map(c => c.id))).toBe(252);
    expect(uniq(EXPANSION_MONSTERS.map(m => m.signatureSkillId))).toBe(252);
  });
});

describe("C6 — 舊 60 ID 不變", () => {
  test("existing 標記恰 60 隻,且卡片 ID/artKey 未改名（=monsterId）", () => {
    const existing = EXPANSION_MONSTERS.filter(m => m.existing);
    expect(existing.length).toBe(60);
    existing.forEach(m => {
      expect(m.card.id).toBe(m.id);     // 卡片 ID 未改名
      expect(m.card.artKey).toBe(m.id); // 美術 key 未改名
    });
  });
  test("關鍵舊 ID 仍存在且標記 existing", () => {
    const legacy = [
      "ghost_1", "mountain_1", "insect_1", "workplace_1", "exam_1", "temple_1",
      "treasure_1", "treasure_1_real", "treasure_king_small_1", "treasure_king_big_1",
      "ghost_6", "treasure_king_big_6",
    ];
    for (const id of legacy) {
      const m = EXPANSION_MONSTER_BY_ID[id];
      expect(m).toBeTruthy();
      expect(m.existing).toBe(true);
    }
  });
});

describe("C6 — 卡/怪/素材 交叉引用完整性", () => {
  test("每隻怪物恰有一個素材與一張卡片,無孤兒", () => {
    const monsterIds = new Set(EXPANSION_MONSTERS.map(m => m.id));
    // 素材 → 怪物
    EXPANSION_MATERIALS.forEach(mat => expect(monsterIds.has(mat.monsterId)).toBe(true));
    // 卡片 → 怪物
    EXPANSION_CARDS.forEach(card => expect(monsterIds.has(card.monsterId)).toBe(true));
    // 反向：每隻怪物的 material.id / card.id 都能對回自己
    EXPANSION_MONSTERS.forEach(m => {
      expect(m.material && m.material.id).toBeTruthy();
      expect(m.card && m.card.id).toBe(m.id);
    });
    // 1:1（無重複 monsterId）
    expect(uniq(EXPANSION_MATERIALS.map(m => m.monsterId))).toBe(252);
    expect(uniq(EXPANSION_CARDS.map(c => c.monsterId))).toBe(252);
  });
  test("素材轉換邊界：僅一般素材可轉換;王素材不可轉換", () => {
    EXPANSION_MATERIALS.forEach(mat => {
      expect(mat.convertible).toBe(mat.kind === "normal");
    });
  });
  test("T6(tierIndex 6) 素材不可再向上升級（upgradesToTier === null）", () => {
    EXPANSION_MATERIALS.filter(m => m.tierIndex === 6)
      .forEach(m => expect(m.upgradesToTier).toBeNull());
  });
  test("每隻怪物皆有共用技能引用與招牌", () => {
    EXPANSION_MONSTERS.forEach(m => {
      expect(Array.isArray(m.commonSkillIds) && m.commonSkillIds.length).toBeTruthy();
      expect(m.signatureName).toBeTruthy();
      expect(m.counterSummary).toBeTruthy();
    });
  });
});

describe("C7 — 卡圖覆蓋不變量", () => {
  test("192 隻新增(existing:false)各需一張新卡圖", () => {
    expect(EXPANSION_MONSTERS.filter(m => !m.existing).length).toBe(192);
  });
  test("全部 252 artKey 唯一,且新卡 artKey 不與既有 60 ID 衝突（不覆蓋）", () => {
    expect(uniq(EXPANSION_MONSTERS.map(m => m.card.artKey))).toBe(252);
    const existingIds = new Set(EXPANSION_MONSTERS.filter(m => m.existing).map(m => m.id));
    EXPANSION_MONSTERS.filter(m => !m.existing).forEach(m => {
      expect(existingIds.has(m.card.artKey)).toBe(false);
    });
  });
});

describe("C6 — 衍生 cardCatalog 與正式 catalog 一致", () => {
  test("CARD_CATALOG 252 + existing 60 + 每項對得回正式 catalog", () => {
    expect(CARD_CATALOG.length).toBe(252);
    expect(CARD_CATALOG.filter(c => c.existing).length).toBe(60);
    CARD_CATALOG.forEach(c => {
      const m = EXPANSION_MONSTER_BY_ID[c.monsterId];
      expect(m).toBeTruthy();
      expect(c.encounter).toBe(m.encounter);
      expect(c.existing).toBe(!!m.existing);
      expect(CARD_CATALOG_BY_ID[c.monsterId]).toBe(c);
    });
  });
});
