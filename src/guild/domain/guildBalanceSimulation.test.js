import { simulateMissionBalance, simulationMatrix } from "./guildBalanceSimulation";

describe("公會任務平衡模擬", () => {
  test("涵蓋三模式、三危險度、三種 VIT 與兩種箭數", () => {
    expect(simulationMatrix()).toHaveLength(3 * 3 * 3 * 2);
  });

  test("VIT 越高補給消耗越低", () => {
    const low = simulateMissionBalance({ mode: "defense", danger: 6, vit: 0 });
    const high = simulateMissionBalance({ mode: "defense", danger: 6, vit: 50 });
    expect(high.supplyPerResource).toBeLessThan(low.supplyPerResource);
  });

  test("六箭清場較快，但每回合消耗加倍，不能成為無代價選項", () => {
    const three = simulateMissionBalance({ mode: "assault", danger: 3, arrowsPerRound: 3 });
    const six = simulateMissionBalance({ mode: "assault", danger: 3, arrowsPerRound: 6 });
    expect(six.combatRounds).toBeLessThanOrEqual(three.combatRounds);
    expect(six.supplyPerResource).toBeGreaterThanOrEqual(three.supplyPerResource);
  });
});
