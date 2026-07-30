import {
  advanceExpeditionJourney,
  completeExpeditionJourneyBattle,
  createExpeditionJourney,
  generateExpeditionMapNodes,
  resolveTier,
} from "./expeditionGridEvents";

describe("guild expedition route briefing", () => {
  test("uses numeric danger even when the contract also has display skulls", () => {
    expect(resolveTier({ danger: 4, skulls: "★★★★" })).toBe(4);
  });

  test("falls back to counting display markers and clamps to guild tiers", () => {
    expect(resolveTier({ skulls: "★★★" })).toBe(3);
    expect(resolveTier({ danger: 99 })).toBe(6);
  });

  test("builds one landmark and one combat node per expedition wave", () => {
    const nodes = generateExpeditionMapNodes({ waves: [{}, {}, {}] });

    expect(nodes).toHaveLength(7);
    expect(nodes[0]).toMatchObject({ type: "start" });
    expect(nodes.at(-1)).toMatchObject({ type: "boss", waveIndex: 2 });
    expect(nodes.filter(node => node.type === "battle")).toHaveLength(2);
  });

  test("starts at guild, advances through an event, then enters wave one combat", () => {
    const journey = createExpeditionJourney({ waves: [{}, {}] });

    expect(journey).toMatchObject({ nodeIndex: 0, phase: "map", waveIndex: null });

    const eventStep = advanceExpeditionJourney(journey);
    expect(eventStep).toMatchObject({
      nodeIndex: 1,
      phase: "event",
      waveIndex: 0,
    });

    const battleStep = advanceExpeditionJourney(eventStep);
    expect(battleStep).toMatchObject({
      nodeIndex: 2,
      phase: "battle",
      waveIndex: 0,
    });
  });

  test("finishing a non-final wave returns to the map before the next battle", () => {
    const beforeBattle = advanceExpeditionJourney(
      advanceExpeditionJourney(createExpeditionJourney({ waves: [{}, {}] })),
    );

    const afterWaveOne = completeExpeditionJourneyBattle(beforeBattle);
    expect(afterWaveOne).toMatchObject({
      nodeIndex: 2,
      phase: "map",
      waveIndex: 0,
    });

    expect(advanceExpeditionJourney(afterWaveOne)).toMatchObject({
      nodeIndex: 3,
      phase: "event",
      waveIndex: 1,
    });
  });
});
