// src/lib/boardCardGacha.test.js
// 探索地圖「抽卡房」格子（08-08）：池選取、抽卡、卡片格式、計價。
import {
  CARD_GACHA_PAID_PRICE, cardGachaPool, rollCardGachaOne, rollCardGachaN,
  cardToMonsterCard, cardToView,
} from "./boardCardGacha";

test("抽卡池：只含該 T 階級的普通怪（排除小王/大王/世界王）", () => {
  for (const t of [1, 2, 3, 4, 5, 6]) {
    const pool = cardGachaPool(t);
    expect(pool.length).toBeGreaterThan(0);
    pool.forEach(c => {
      expect(c.tierIndex).toBe(t);
      expect(c.encounter).toBe("normal");   // 小王/大王不進池
    });
  }
  // 階級越界防呆
  expect(cardGachaPool(0).every(c => c.tierIndex === 1)).toBe(true);
  expect(cardGachaPool(99).every(c => c.tierIndex === 6)).toBe(true);
});

test("每階池大小＝7 族 × 3 隻普通怪", () => {
  for (const t of [1, 2, 3, 4, 5, 6]) {
    expect(cardGachaPool(t).length).toBe(21);
  }
});

test("抽 1 張：回傳池內卡片；mock 隨機鎖定首張", () => {
  const pool = cardGachaPool(3);
  const first = rollCardGachaOne(3, () => 0);
  expect(first.monsterId).toBe(pool[0].monsterId);
  const last = rollCardGachaOne(3, () => 0.999999);
  expect(last.monsterId).toBe(pool[pool.length - 1].monsterId);
});

test("抽 N 張：數量正確且都在池內", () => {
  const drawn = rollCardGachaN(4, 3, () => 0.5);
  expect(drawn).toHaveLength(3);
  drawn.forEach(c => expect(c.tierIndex).toBe(4));
});

test("cardToMonsterCard：addMonsterCard 所需欄位齊全", () => {
  const entry = cardGachaPool(1)[0];
  const card = cardToMonsterCard(entry);
  expect(card.monsterId).toBe(entry.monsterId);
  expect(card.name).toBe(entry.name);
  expect(card.tier).toBe(entry.tier);
  expect(card.family).toBe(entry.family);
  expect(card.icon).toBeTruthy();
});

test("cardToView：卡面顯示欄位齊全", () => {
  const entry = cardGachaPool(2)[0];
  const view = cardToView(entry, true);
  expect(view.monsterId).toBe(entry.monsterId);
  expect(view.artKey).toBe(entry.artKey);
  expect(view.owned).toBe(true);
});

test("付費價格為正數", () => {
  expect(CARD_GACHA_PAID_PRICE).toBeGreaterThan(0);
});
