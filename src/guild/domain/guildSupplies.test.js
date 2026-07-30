import {
  EXPEDITION_SUPPLY_LOAD,
  EXPEDITION_SUPPLY_MAX,
  EXPEDITION_SUPPLY_MIN,
  autoFillSupplyLoad,
  consumeExpeditionSupplies,
  supplyLoadCap,
  hasExpeditionSupplies,
  refundExpeditionSupplies,
  supplyShortage,
} from "./guildSupplies";
import { emptyGuildProfile } from "./guildRewards";

const stocked = (food, water) => ({ ...emptyGuildProfile(), supplyStock: { food, water } });

describe("公會遠征補給倉庫", () => {
  test("標準遠征自動裝入食物與飲水各 6 份", () => {
    expect(EXPEDITION_SUPPLY_LOAD).toEqual({ food: 6, water: 6 });
    expect(hasExpeditionSupplies(stocked(6, 6))).toBe(true);
  });

  test("庫存不足時回報各自缺少數量且不扣庫存", () => {
    const before = stocked(4, 2);
    const res = consumeExpeditionSupplies(before);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual({ food: 2, water: 4 });
    expect(res.profile.supplyStock).toEqual({ food: 4, water: 2 });
    expect(supplyShortage(before)).toEqual({ food: 2, water: 4 });
  });

  test("庫存足夠才一次扣除，取消組隊準備可完整退回", () => {
    const before = stocked(10, 8);
    const res = consumeExpeditionSupplies(before);
    expect(res.ok).toBe(true);
    expect(res.supplies).toEqual({ food: 6, water: 6 });
    expect(res.profile.supplyStock).toEqual({ food: 4, water: 2 });
    expect(refundExpeditionSupplies(res.profile).supplyStock).toEqual({ food: 10, water: 8 });
    expect(before.supplyStock).toEqual({ food: 10, water: 8 });
  });

  test("玩家可分別指定攜帶量，剩餘補給依實際數量返還", () => {
    const before = stocked(10, 10);
    const loaded = consumeExpeditionSupplies(before, { food: 4, water: 7 });

    expect(loaded.ok).toBe(true);
    expect(loaded.supplies).toEqual({ food: 4, water: 7 });
    expect(loaded.profile.supplyStock).toEqual({ food: 6, water: 3 });

    const returned = refundExpeditionSupplies(loaded.profile, { food: 1.5, water: 2 });
    expect(returned.supplyStock).toEqual({ food: 7.5, water: 5 });
  });

  test("攜帶量會夾在合法範圍內並取整（絕對上限只是防呆，真正的限制是負重）", () => {
    const loaded = consumeExpeditionSupplies(stocked(99, 99), { food: 0, water: 12.8 });
    expect(loaded.supplies).toEqual({ food: EXPEDITION_SUPPLY_MIN, water: 12 });
    const overMax = consumeExpeditionSupplies(stocked(99, 99), { food: 1, water: 9999 });
    expect(overMax.supplies.water).toBe(EXPEDITION_SUPPLY_MAX);
  });
});

describe("負重決定補給上限（2026-07-31：解除硬鎖 10）", () => {
  const cap = (capacity, gearWeight) => supplyLoadCap({ capacity, gearWeight, supplyWeight: 1 });

  test("上限＝剩餘負重平分給食物與水", () => {
    expect(cap(26, 6)).toBe(10);   // 剩 20kg → 各 10
    expect(cap(40, 6)).toBe(17);   // 剩 34kg → 各 17（VIT 練起來就背得更多）
  });

  test("VIT 越高、上限越高——這是 VIT 的回饋，不能被固定值蓋掉", () => {
    expect(cap(50, 8)).toBeGreaterThan(cap(26, 8));
  });

  test("裝備越重、能帶的糧越少（負重取捨還在）", () => {
    expect(cap(30, 20)).toBeLessThan(cap(30, 4));
  });

  test("再怎麼超重也至少能帶 1 份，且不超過絕對上限", () => {
    expect(cap(10, 999)).toBe(EXPEDITION_SUPPLY_MIN);
    expect(cap(99999, 0)).toBe(EXPEDITION_SUPPLY_MAX);
  });
});

describe("自動補滿", () => {
  const fill = (food, water, capacity = 26, gearWeight = 6) =>
    autoFillSupplyLoad({ profile: stocked(food, water), capacity, gearWeight, supplyWeight: 1 });

  test("庫存夠 → 直接帶到負重上限，玩家不必每趟手動點高", () => {
    expect(fill(99, 99)).toEqual({ food: 10, water: 10 });
  });

  test("庫存不夠 → 帶得出多少算多少（缺口交給 UI 提醒）", () => {
    expect(fill(3, 99)).toEqual({ food: 3, water: 10 });
  });

  test("庫存見底也至少帶 1，讓「補給不足」的提示跑得出來", () => {
    expect(fill(0, 0)).toEqual({ food: EXPEDITION_SUPPLY_MIN, water: EXPEDITION_SUPPLY_MIN });
  });

  test("補滿後不會超重（出發鈕不該被自己填的數字擋住）", () => {
    const capacity = 32, gearWeight = 9;
    const load = autoFillSupplyLoad({ profile: stocked(99, 99), capacity, gearWeight, supplyWeight: 1 });
    expect(gearWeight + load.food + load.water).toBeLessThanOrEqual(capacity);
  });
});
