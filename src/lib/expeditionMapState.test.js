import {
  getRestoredExpeditionPhase,
  isRestorableExpeditionMapState,
  stripExpeditionMapStateForSync,
} from "./expeditionMapState";

describe("expedition map recovery", () => {
  test("restores a solo floor-three branch without a grid", () => {
    const state = {
      phase: "branch", floorIndex: 2, gridFloor: null,
      branchFloor: { branches: { left: { rooms: [] } } },
      branchChoice: "left", branchStep: 2,
      pendingRoom: { id: "left-2", type: "elite_battle" },
    };
    expect(isRestorableExpeditionMapState(state, 2)).toBe(true);
    expect(getRestoredExpeditionPhase({ ...state, phase:"battle" }, 2)).toBe("battle");
    expect(getRestoredExpeditionPhase({ ...state, phase:"func_room" }, 2)).toBe("func_room");
    expect(getRestoredExpeditionPhase({ ...state, phase:"floor_intro" }, 2)).toBe("branch");
  });

  test("rejects an incomplete floor-three save", () => {
    expect(isRestorableExpeditionMapState({ floorIndex: 2, branchStep: 1 }, 2)).toBe(false);
  });

  test("team serialization strips nested grid but preserves branch progress", () => {
    const state = {
      phase: "branch", floorIndex: 2,
      gridFloor: null, branchFloor: { branches: {} },
      branchChoice: "right", branchStep: 3,
      pendingRoom: { id: "boss", type: "boss_battle" },
    };
    expect(stripExpeditionMapStateForSync(state)).toEqual(state);

    const grid = { floorIndex: 0, gridFloor: { grid: [["a"]], rooms: [{ id: "a" }] }, playerPos: { x: 0, y: 0 } };
    expect(stripExpeditionMapStateForSync(grid).gridFloor.grid).toBeUndefined();
    expect(isRestorableExpeditionMapState(stripExpeditionMapStateForSync(grid), 0)).toBe(true);
  });
});
