import { GRID_SIZE, generateGridFloor, generateBranchFloor, isAdjacent, posKey } from "./expeditionGrid";
import { STAGE_ROOM_QUOTA } from "./dungeonData";
import { isInlineRoom } from "./dungeonInlineRooms";

const STAGE_TYPES = ["battle", "elite_battle", "event", "trap", "shop", "chest", "rest"];

function countByType(floor) {
  return floor.rooms.reduce((acc, room) => {
    acc[room.type] = (acc[room.type] || 0) + 1;
    return acc;
  }, {});
}

function quotaTotal(floorIndex) {
  return Object.values(STAGE_ROOM_QUOTA[floorIndex]).reduce((sum, count) => sum + count, 0);
}

// 走訪連通區域，回傳入口到每一格的步數
function bfsDistances(floor) {
  const byPos = new Map(floor.rooms.map(room => [posKey(room.pos.x, room.pos.y), room]));
  const dist = new Map([[posKey(floor.startPos.x, floor.startPos.y), 0]]);
  const queue = [floor.startPos];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(posKey(cur.x, cur.y));
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const next = { x: cur.x + dx, y: cur.y + dy };
      const key = posKey(next.x, next.y);
      if (byPos.has(key) && !dist.has(key)) {
        dist.set(key, d + 1);
        queue.push(next);
      }
    });
  }
  return dist;
}

describe("地圖尺寸擴大為兩倍", () => {
  it("格子邊長是 7（原本 5）", () => {
    expect(GRID_SIZE).toBe(7);
  });

  it("每層 40~46 格，且全部落在 7×7 範圍內", () => {
    for (let i = 0; i < 60; i += 1) {
      const floor = generateGridFloor(i % 2, 3);
      expect(floor.rooms.length).toBeGreaterThanOrEqual(40);
      expect(floor.rooms.length).toBeLessThanOrEqual(46);
      floor.rooms.forEach(room => {
        expect(room.pos.x).toBeGreaterThanOrEqual(0);
        expect(room.pos.x).toBeLessThan(GRID_SIZE);
        expect(room.pos.y).toBeGreaterThanOrEqual(0);
        expect(room.pos.y).toBeLessThan(GRID_SIZE);
      });
    }
  });

  it("沒有兩間房佔同一格", () => {
    for (let i = 0; i < 40; i += 1) {
      const floor = generateGridFloor(i % 2, 3);
      const keys = floor.rooms.map(room => posKey(room.pos.x, room.pos.y));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("所有房間從入口都走得到（生成樹擴張要保證連通）", () => {
    for (let i = 0; i < 40; i += 1) {
      const floor = generateGridFloor(i % 2, 3);
      expect(bfsDistances(floor).size).toBe(floor.rooms.length);
    }
  });
});

// 這組是整個地圖重製的核心不變式：
// 地圖大一倍，但「要開全螢幕舞台的房間」數量**不准跟著變多** ——
// 否則就不是探索感變濃，而是一趟變長變累。
describe("配額式生成：重量房數量固定，不隨地圖大小浮動", () => {
  it("第 1 層恰好 13 間重量房", () => {
    expect(quotaTotal(0)).toBe(13);
    for (let i = 0; i < 60; i += 1) {
      const counts = countByType(generateGridFloor(0, 3));
      const stageTotal = STAGE_TYPES.reduce((sum, type) => sum + (counts[type] || 0), 0);
      expect(stageTotal).toBe(13);
    }
  });

  it("第 2 層恰好 14 間重量房", () => {
    expect(quotaTotal(1)).toBe(14);
    for (let i = 0; i < 60; i += 1) {
      const counts = countByType(generateGridFloor(1, 3));
      const stageTotal = STAGE_TYPES.reduce((sum, type) => sum + (counts[type] || 0), 0);
      expect(stageTotal).toBe(14);
    }
  });

  it("各房型數量完全等於配額表（改節奏只要動那張表）", () => {
    [0, 1].forEach(floorIndex => {
      for (let i = 0; i < 30; i += 1) {
        const counts = countByType(generateGridFloor(floorIndex, 3));
        Object.entries(STAGE_ROOM_QUOTA[floorIndex]).forEach(([type, expected]) => {
          expect(counts[type] || 0).toBe(expected);
        });
      }
    });
  });

  it("第 2 層保底 1 隻精英，第 1 層則完全沒有", () => {
    for (let i = 0; i < 40; i += 1) {
      expect(countByType(generateGridFloor(1, 3)).elite_battle).toBe(1);
      expect(countByType(generateGridFloor(0, 3)).elite_battle).toBeUndefined();
    }
  });

  it("其餘格子全是輕量房（地圖擴大的空間都由它們消化）", () => {
    for (let i = 0; i < 40; i += 1) {
      const floorIndex = i % 2;
      const floor = generateGridFloor(floorIndex, 3);
      const inline = floor.rooms.filter(room => isInlineRoom(room.type));
      // 總數 = 入口 + 樓梯 + 重量房 + 輕量房
      expect(inline.length).toBe(floor.rooms.length - 2 - quotaTotal(floorIndex));
      expect(inline.length).toBeGreaterThan(20);
    }
  });

  it("每間房都有 label（地圖底部資訊列會讀）", () => {
    for (let i = 0; i < 20; i += 1) {
      generateGridFloor(i % 2, 3).rooms.forEach(room => {
        expect(typeof room.label).toBe("string");
        expect(room.label.length).toBeGreaterThan(0);
      });
    }
  });
});

// general_event 已廢除（併進 quick_event）。若生成端還吐得出來，
// UI 分流會掉進 default 分支 → 玩家踩到就是空白畫面。
describe("general_event 房型已完全廢除", () => {
  it("生成產物不含 general_event", () => {
    for (let i = 0; i < 80; i += 1) {
      generateGridFloor(i % 2, 3).rooms.forEach(room => {
        expect(room.type).not.toBe("general_event");
      });
    }
  });
});

describe("樓梯位置", () => {
  it("入口與樓梯各恰好一間，且入口預設已清除", () => {
    for (let i = 0; i < 40; i += 1) {
      const floor = generateGridFloor(i % 2, 3);
      const counts = countByType(floor);
      expect(counts.entrance).toBe(1);
      expect(counts.stairs).toBe(1);
      expect(floor.rooms.find(room => room.type === "entrance").cleared).toBe(true);
      expect(floor.rooms.find(room => room.type === "stairs").cleared).toBe(false);
    }
  });

  // 原本用 bfsFarthest 取最遠點，在幾乎滿版的方形上最遠點**必然是角落** ——
  // 那不是隨機性不足，是幾何必然（作者回報「樓梯太固定在周圍」）。
  it("樓梯不再每次都落在角落", () => {
    const corners = new Set(["0,0", `0,${GRID_SIZE - 1}`, `${GRID_SIZE - 1},0`, `${GRID_SIZE - 1},${GRID_SIZE - 1}`]);
    let cornerHits = 0;
    const runs = 120;
    for (let i = 0; i < runs; i += 1) {
      const floor = generateGridFloor(i % 2, 3);
      if (corners.has(posKey(floor.stairsPos.x, floor.stairsPos.y))) cornerHits += 1;
    }
    expect(cornerHits).toBeLessThan(runs * 0.5);
  });

  it("樓梯仍然要走一段路才到（不會一開門就是樓梯）", () => {
    for (let i = 0; i < 60; i += 1) {
      const floor = generateGridFloor(i % 2, 3);
      const dist = bfsDistances(floor);
      const steps = dist.get(posKey(floor.stairsPos.x, floor.stairsPos.y));
      expect(steps).toBeGreaterThanOrEqual(3);
    }
  });

  it("樓梯位置每趟都會變（不是固定值）", () => {
    const seen = new Set();
    for (let i = 0; i < 60; i += 1) {
      const floor = generateGridFloor(0, 3);
      seen.add(posKey(floor.stairsPos.x, floor.stairsPos.y));
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe("戰鬥房不相鄰（既有規則，擴大後仍要成立）", () => {
  it("相鄰的兩間戰鬥房應該很罕見", () => {
    let adjacentPairs = 0;
    const runs = 40;
    for (let i = 0; i < runs; i += 1) {
      const floor = generateGridFloor(1, 3);
      const battles = floor.rooms.filter(room => room.type === "battle" || room.type === "elite_battle");
      for (let a = 0; a < battles.length; a += 1) {
        for (let b = a + 1; b < battles.length; b += 1) {
          if (isAdjacent(battles[a].pos, battles[b].pos)) adjacentPairs += 1;
        }
      }
    }
    expect(adjacentPairs / runs).toBeLessThan(1);
  });
});

describe("第 3 層分支王關維持原結構（刻意不動）", () => {
  it("三條支線各 5 間房，外加入口／王／寶藏", () => {
    const branchFloor = generateBranchFloor();
    expect(Object.keys(branchFloor.branches)).toEqual(["A", "B", "C"]);
    Object.values(branchFloor.branches).forEach(branch => {
      expect(branch.rooms.length).toBe(5);
      expect(branch.rooms.filter(room => room.type === "rest").length).toBe(1);
      expect(branch.rooms.filter(room => room.type === "shop").length).toBe(1);
    });
    expect(branchFloor.boss.type).toBe("boss_battle");
    expect(branchFloor.treasure.type).toBe("treasure");
  });

  it("分支房不含輕量房（第 3 層濃度要拉滿）", () => {
    for (let i = 0; i < 20; i += 1) {
      Object.values(generateBranchFloor().branches).forEach(branch => {
        branch.rooms.forEach(room => expect(isInlineRoom(room.type)).toBe(false));
      });
    }
  });
});
