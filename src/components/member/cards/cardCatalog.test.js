// src/components/member/cards/cardCatalog.test.js
import {
  CARD_CATALOG, CARD_CATALOG_BY_ID, getGroup, matchL1, mergeOwned, cardImageSrc, ownedArtSources,
  FAMILIES, TIERS,
} from "./cardCatalog";

describe("cardCatalog 衍生正確性", () => {
  test("全部正式怪物卡皆使用獨立卡面", () => {
    expect(CARD_CATALOG).toHaveLength(252);
    expect(CARD_CATALOG.every(card => card.availability === "existing")).toBe(true);
  });

  test("252 隻 + 遭遇分類 126/84/42", () => {
    expect(CARD_CATALOG.length).toBe(252);
    const by = enc => CARD_CATALOG.filter(c => c.encounter === enc).length;
    expect(by("normal")).toBe(126);
    expect(by("miniBoss")).toBe(84);
    expect(by("boss")).toBe(42); // 大王 = "boss"
  });

  test("舊 60 張 ID 保留且未改名（cardId=monsterId、artKey=monsterId）", () => {
    const existing = CARD_CATALOG.filter(c => c.existing);
    expect(existing.length).toBe(60);
    for (const id of ["ghost_1", "treasure_king_big_1", "treasure_1_real", "treasure_king_small_1"]) {
      const c = CARD_CATALOG_BY_ID[id];
      expect(c).toBeTruthy();
      expect(c.cardId).toBe(id);
      expect(c.artKey).toBe(id);
      expect(c.existing).toBe(true);
    }
  });

  test("每個 族系×Tier 分組剛好 6 張（≤6）", () => {
    for (const f of FAMILIES) for (const t of TIERS) {
      const g = getGroup(f.id, t.id);
      expect(g.length).toBeLessThanOrEqual(6);
      expect(g.length).toBe(6);
    }
  });

  test("未取得卡片不產生任何圖片 URL", () => {
    const entry = CARD_CATALOG[0];
    const view = mergeOwned(entry, { cards: {} }); // 未取得
    expect(view.owned).toBe(false);
    expect(ownedArtSources(view)).toEqual([]);
    expect(cardImageSrc(view)).toBeNull();
  });

  test("已取得卡片：有限 fallback 鏈（3 段,不無限重試）+ 主 URL", () => {
    const entry = CARD_CATALOG_BY_ID.ghost_1;
    const view = mergeOwned(entry, { cards: { ghost_1: { stars: 2, duplicates: 3 } } });
    expect(view.owned).toBe(true);
    expect(view.stars).toBe(2);
    expect(view.duplicates).toBe(3);
    const sources = ownedArtSources(view);
    expect(sources.length).toBe(3); // 有限 → onError 前進 3 次後轉 emoji,不會無限請求
    expect(cardImageSrc(view)).toBe("/cards/monsters/ghost_1.webp");
  });

  test("新怪優先讀取獨立卡圖，再退回戰鬥立繪", () => {
    const entry = CARD_CATALOG.find(card => !card.existing);
    const view = mergeOwned(entry, { cards:{ [entry.monsterId]:{ stars:1 } } });
    expect(ownedArtSources(view)).toEqual([
      `/cards/monsters/${entry.artKey}.webp`,
      `/monsters-battle/${entry.monsterId}.webp`,
      `/monsters/${entry.monsterId}.webp`,
    ]);
    expect(cardImageSrc(view)).toBe(`/cards/monsters/${entry.artKey}.webp`);
  });

  test("matchL1 篩選正確", () => {
    const normal = CARD_CATALOG.find(c => c.encounter === "normal");
    const mini = CARD_CATALOG.find(c => c.encounter === "miniBoss");
    const big = CARD_CATALOG.find(c => c.encounter === "boss");
    expect(matchL1(normal, "all")).toBe(true);
    expect(matchL1(normal, "normal")).toBe(true);
    expect(matchL1(normal, "miniBoss")).toBe(false);
    expect(matchL1(mini, "miniBoss")).toBe(true);
    expect(matchL1(big, "bigBoss")).toBe(true);
    expect(matchL1(big, "normal")).toBe(false);
    expect(matchL1(normal, "worldboss")).toBe(false); // 世界王卡不在此 catalog
  });
});
