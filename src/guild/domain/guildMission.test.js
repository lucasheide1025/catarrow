import { createMissionEnvelope, normalizeSavedMission } from "./guildMission";

describe("公會任務 v3 envelope", () => {
  test("未知與舊存檔模式回退為連續進攻", () => {
    expect(normalizeSavedMission({ contract: { id: "old" } })).toMatchObject({
      version: 3, mode: "assault", contract: { mode: "assault" },
    });
    expect(normalizeSavedMission({ mode: "unknown", contract: {} }).mode).toBe("assault");
  });

  test("新任務保存模式與共用狀態", () => {
    expect(createMissionEnvelope({
      contract: { id: "d", mode: "defense" },
      combat: { status: "fighting", supplies: { food: 2, water: 3 } },
      modeState: { clock: 2 },
    })).toMatchObject({
      version: 3, mode: "defense", status: "fighting",
      supplies: { food: 2, water: 3 }, modeState: { clock: 2 },
    });
  });
});
