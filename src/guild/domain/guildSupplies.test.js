import {
  EXPEDITION_SUPPLY_LOAD,
  consumeExpeditionSupplies,
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

  test("攜帶量只能是 1 到 10 的整數", () => {
    const loaded = consumeExpeditionSupplies(stocked(20, 20), { food: 0, water: 12.8 });
    expect(loaded.supplies).toEqual({ food: 1, water: 10 });
    expect(loaded.profile.supplyStock).toEqual({ food: 19, water: 10 });
  });
});
