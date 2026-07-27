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
});
