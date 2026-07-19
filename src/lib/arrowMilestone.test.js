import {
  ALL_MILESTONES, getMilestonesReached, getRewardsForMilestone, FINAL_MILESTONE_ARROWS,
} from "./arrowMilestone";
import { openVillagePack, openVillagePacks, getVillagePack } from "./villagePack";

describe("練箭里程碑（2026-07-19 改版：每 30 箭一階，共 16 階）", () => {
  test("門檻是 30 的倍數、30~480、共 16 階且遞增", () => {
    expect(ALL_MILESTONES).toHaveLength(16);
    expect(ALL_MILESTONES[0].arrows).toBe(30);
    expect(ALL_MILESTONES.at(-1).arrows).toBe(FINAL_MILESTONE_ARROWS);
    ALL_MILESTONES.forEach((ms, index) => {
      expect(ms.arrows).toBe((index + 1) * 30);
    });
  });

  test("每一階都給扭蛋幣 1 與箭露 30", () => {
    ALL_MILESTONES.forEach(ms => {
      const r = getRewardsForMilestone(ms);
      expect(r.gachaCoins).toBe(1);
      expect(r.arrowdew).toBe(30);
    });
  });

  test("寶箱階級依段落遞進：木→鐵→黃金→神話", () => {
    const typeAt = arrows => getRewardsForMilestone(
      ALL_MILESTONES.find(ms => ms.arrows === arrows),
    ).chestType;
    [30, 60, 90, 120].forEach(a => expect(typeAt(a)).toBe("wood"));
    [150, 180, 210, 240].forEach(a => expect(typeAt(a)).toBe("iron"));
    [270, 300, 330, 360].forEach(a => expect(typeAt(a)).toBe("gold"));
    [390, 420, 450, 480].forEach(a => expect(typeAt(a)).toBe("mythic"));
  });

  test("每段第 4 階是大關：各項 ×5、附咪咪箱", () => {
    [120, 240, 360, 480].forEach(arrows => {
      const r = getRewardsForMilestone(ALL_MILESTONES.find(ms => ms.arrows === arrows));
      expect(r.chestCount).toBe(5);
      expect(r.coinChestCount).toBe(5);
      expect(r.packCount).toBe(5);
      expect(r.mimiBoxes).toBe(1);
    });
  });

  // 舊版所有里程碑都沒有 type 欄位，導致 BigMilestonePopup 從來沒被觸發過
  test("只有四個大關標記 type:big（走全螢幕慶祝）", () => {
    const bigOnes = ALL_MILESTONES.filter(ms => ms.type === "big").map(ms => ms.arrows);
    expect(bigOnes).toEqual([120, 240, 360, 480]);
  });

  test("貓貓箱從 240 起才有，120 沒有（使用者規格）", () => {
    const catAt = arrows => getRewardsForMilestone(
      ALL_MILESTONES.find(ms => ms.arrows === arrows),
    ).catBoxes;
    expect(catAt(120)).toBe(0);
    [240, 360, 480].forEach(a => expect(catAt(a)).toBe(1));
  });

  test("建築包階級跟著寶箱段落走 T1~T4", () => {
    const packAt = arrows => getRewardsForMilestone(
      ALL_MILESTONES.find(ms => ms.arrows === arrows),
    ).packTier;
    expect(packAt(90)).toBe(1);
    expect(packAt(210)).toBe(2);
    expect(packAt(330)).toBe(3);
    expect(packAt(450)).toBe(4);
  });

  test("跨越多個門檻時一次回傳全部，且不重複觸發", () => {
    expect(getMilestonesReached(0, 95).map(ms => ms.arrows)).toEqual([30, 60, 90]);
    expect(getMilestonesReached(90, 95)).toHaveLength(0);
    expect(getMilestonesReached(100, 100)).toHaveLength(0);
  });
});

describe("貓貓村建築包", () => {
  test("T1 只給基礎材料，不會出現貓貓射手", () => {
    for (let index = 0; index < 40; index += 1) {
      const rolled = openVillagePack(1);
      expect(Object.keys(rolled).length).toBeGreaterThan(0);
      expect(rolled.archer).toBeUndefined();
      Object.keys(rolled).forEach(key => {
        expect(["ore", "melon", "fish", "meat"]).toContain(key);
      });
    }
  });

  // archer 是練箭場產物、最稀缺，刻意只在最後一段的 T4 出現
  test("只有 T4 會開出貓貓射手", () => {
    [1, 2, 3].forEach(tier => {
      for (let index = 0; index < 30; index += 1) {
        expect(openVillagePack(tier).archer).toBeUndefined();
      }
    });
    expect(openVillagePack(4).archer).toBeGreaterThan(0);
  });

  test("階級越高總量越大（T1 < T2 < T3 < T4）", () => {
    const avgTotal = tier => {
      let sum = 0;
      for (let index = 0; index < 200; index += 1) {
        sum += Object.values(openVillagePack(tier)).reduce((a, b) => a + b, 0);
      }
      return sum / 200;
    };
    const totals = [1, 2, 3, 4].map(avgTotal);
    expect(totals[0]).toBeLessThan(totals[1]);
    expect(totals[1]).toBeLessThan(totals[2]);
    expect(totals[2]).toBeLessThan(totals[3]);
  });

  test("開多包會累加，不是只算一包", () => {
    const one = Object.values(openVillagePacks(2, 1)).reduce((a, b) => a + b, 0);
    const five = Object.values(openVillagePacks(2, 5)).reduce((a, b) => a + b, 0);
    expect(five).toBeGreaterThan(one * 2);
  });

  test("階級超出範圍時夾在 1~4 不會炸", () => {
    expect(getVillagePack(0).tier).toBe(1);
    expect(getVillagePack(9).tier).toBe(4);
    expect(Object.keys(openVillagePack(99)).length).toBeGreaterThan(0);
  });
});
