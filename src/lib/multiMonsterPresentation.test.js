import { describePartyPresentationEvent, getMultiMonsterPresentationPolicy, groupPartyPresentationBeats, groupSoloPresentationBeats, partyPresentationEvents, presentationDelay, shouldRevealTerminal } from "./multiMonsterPresentation";

test("all four multi-monster modes explicitly enable synchronized cat and status damage", () => {
  const policies = ["free_hunt_solo","free_hunt_party","dungeon_solo","dungeon_team"].map(getMultiMonsterPresentationPolicy);
  expect(policies.every(policy => policy.combineCatDamage && policy.statusDamageFloat && policy.skipHiddenStatusWait)).toBe(true);
  expect(policies.find(policy => policy.id === "dungeon_solo")?.preservePlayerArrows).toBe(true);
  expect(policies.filter(policy => policy.id !== "dungeon_solo").every(policy => !policy.preservePlayerArrows)).toBe(true);
});

test("cat damage and cat action become one synchronized beat without duplicate damage", () => {
  const beats = groupPartyPresentationBeats(partyPresentationEvents({
    resolutionId:"cat-round", round:1, outcome:"continue", targetHpBefore:{ m1:20 },
    events:[
      { id:"cat-hit", type:"target_damage", source:"cat", memberId:"a", targetId:"m1", damage:9, remainingHp:11 },
      { id:"cat-action", type:"cat_action", memberId:"a", targetId:"m1", amount:9, heal:2, shield:3 },
    ],
  }), { dungeonSolo:true });
  expect(beats[0]).toEqual(expect.objectContaining({ type:"cat_action", damage:9, remainingHp:11, heal:2, shield:3 }));
  expect(beats.filter(event => event.type === "target_damage")).toHaveLength(0);
});

test("status damage becomes a short colored monster-float beat without status text", () => {
  const beats = groupPartyPresentationBeats([
    { id:"dot", type:"target_damage", source:"status", statusId:"burn", targetId:"m1", damage:6, remainingHp:14 },
  ], { dungeonSolo:true });
  expect(beats).toEqual([expect.objectContaining({ type:"status_damage", targetId:"m1", damage:6, remainingHp:14, color:"#f97316", overlay:false })]);
});

test("ordinary multiplayer explicitly opts into synchronized cat and status damage beats", () => {
  const events = [
    { id:"cat-hit", type:"target_damage", source:"cat", memberId:"a", targetId:"m1", damage:9, remainingHp:11 },
    { id:"cat-action", type:"cat_action", memberId:"a", targetId:"m1", amount:9 },
    { id:"dot", type:"target_damage", source:"status", statusId:"burn", targetId:"m1", damage:3, remainingHp:8 },
  ];
  expect(groupPartyPresentationBeats(events, getMultiMonsterPresentationPolicy("free_hunt_party")).map(event => event.type)).toEqual([
    "cat_action", "status_damage",
  ]);
});

test("dungeon-solo pacing skips invisible status waits and keeps arrows readable", () => {
  expect(presentationDelay("status_applied", { dungeonSolo:true, overlay:false })).toBeLessThanOrEqual(60);
  expect(presentationDelay("player_attack", { dungeonSolo:true })).toBeLessThan(presentationDelay("player_attack"));
  expect(presentationDelay("target_damage_batch", { dungeonSolo:true })).toBeGreaterThanOrEqual(250);
});

test("party all-target damage becomes one simultaneous target beat and status has no overlay", () => {
  const beats = groupPartyPresentationBeats([
    { type:"player_attack", memberId:"a" },
    { type:"target_damage", source:"player", memberId:"a", targetId:"m1", damage:8, remainingHp:22 },
    { type:"target_damage", source:"player", memberId:"a", targetId:"m2", damage:7, remainingHp:23 },
    { type:"status_applied", memberId:"a", targetId:"m1", statusId:"burn" },
  ]);
  expect(beats).toEqual([
    expect.objectContaining({ type:"player_attack" }),
    expect.objectContaining({ type:"target_damage_batch", hits:[
      expect.objectContaining({ targetId:"m1", damage:8 }),
      expect.objectContaining({ targetId:"m2", damage:7 }),
    ] }),
    expect.objectContaining({ type:"status_applied", overlay:false }),
  ]);
});

test("dungeon solo party resolution preserves one simultaneous damage group per arrow", () => {
  const events = partyPresentationEvents({
    resolutionId:"solo:1", round:1, outcome:"continue", targetHpBefore:{ m1:50, m2:50 },
    events:[
      { id:"e0", type:"target_damage", source:"player", memberId:"solo", arrowIndex:0, targetId:"m1", damage:5, remainingHp:45 },
      { id:"e1", type:"target_damage", source:"player", memberId:"solo", arrowIndex:0, targetId:"m2", damage:4, remainingHp:46 },
      { id:"e2", type:"target_damage", source:"player", memberId:"solo", arrowIndex:1, targetId:"m1", damage:7, remainingHp:38 },
    ],
  }, { preservePlayerArrows:true });
  const beats = groupPartyPresentationBeats(events);
  expect(beats.filter(event => event.type === "player_attack")).toHaveLength(2);
  expect(beats.filter(event => event.type === "target_damage_batch").map(event => event.hits.map(hit => hit.targetId))).toEqual([["m1","m2"],["m1"]]);
});

test("solo all-target arrows aggregate into one simultaneous beat per target", () => {
  const beats = groupSoloPresentationBeats([
    { phase:"player", type:"multi_arrow_hit", payload:{ arrowIndex:0, targetIndex:0, damage:4, remainingHp:26 } },
    { phase:"player", type:"multi_arrow_hit", payload:{ arrowIndex:0, targetIndex:1, damage:3, remainingHp:27 } },
    { phase:"player", type:"multi_arrow_crit", payload:{ arrowIndex:1, targetIndex:0, damage:6, remainingHp:20 } },
    { phase:"player", type:"multi_status_applied", payload:{ targetIndex:0, statuses:[{ id:"burn" }] } },
    { phase:"cat", type:"multi_phase", payload:{ phase:"cat" } },
  ]);
  expect(beats[0]).toEqual(expect.objectContaining({ type:"multi_target_damage_batch", hits:[
    expect.objectContaining({ targetIndex:0, damage:10, remainingHp:20, isCrit:true }),
    expect.objectContaining({ targetIndex:1, damage:3, remainingHp:27 }),
  ] }));
  expect(beats[1]).toEqual(expect.objectContaining({ type:"multi_status_applied", overlay:false }));
  expect(beats[2]).toEqual(expect.objectContaining({ phase:"cat" }));
});

test("party status and round-heal events explain the actual battle effect", () => {
  const context = {
    targets: { monster_0: { name: "毒菇怪" } },
    members: { archer_1: { name: "小弓手" } },
  };

  expect(describePartyPresentationEvent({
    type: "status_applied",
    targetId: "monster_0",
    memberId: "archer_1",
    statusId: "poison",
  }, context)).toBe("小弓手 對毒菇怪附加 ☠️ 中毒");

  expect(describePartyPresentationEvent({
    type: "round_heal",
    memberId: "archer_1",
    amount: 12,
  }, context)).toBe("小弓手 回合結束恢復 12 HP");
});

test("one-shot resolution keeps damage, death, round-end and victory in order", () => {
  const events = partyPresentationEvents({
    resolutionId:"battle:1", round:1, result:"win",
    events:[
      { id:"battle:1:0", type:"player_attack" },
      { id:"battle:1:1", type:"target_damage", remainingHp:0 },
      { id:"battle:1:2", type:"monster_killed" },
    ],
  });
  expect(events.map(event => event.type)).toEqual([
    "player_attack", "target_damage", "monster_killed", "round_end", "battle_win",
  ]);
  expect(new Set(events.map(event => event.id)).size).toBe(events.length);
});

test("server outcome appends the terminal presentation after the full event queue", () => {
  const events = partyPresentationEvents({
    resolutionId:"battle:2", round:3, outcome:"win",
    events:[
      { id:"battle:2:0", type:"target_damage", remainingHp:0 },
      { id:"battle:2:1", type:"monster_killed" },
    ],
  });
  expect(events.map(event => event.type)).toEqual([
    "target_damage", "monster_killed", "round_end", "battle_win",
  ]);
});

test("terminal result stays gated until its resolution finishes", () => {
  expect(shouldRevealTerminal("victory", "battle:1", new Set())).toBe(false);
  expect(shouldRevealTerminal("victory", "battle:1", new Set(["battle:1"]))).toBe(true);
  expect(shouldRevealTerminal("active", "battle:1", new Set(["battle:1"]))).toBe(false);
});

test("v2 party arrows present one summed attack per member with real HP damage", () => {
  const events = partyPresentationEvents({
    resolutionId:"party:4", round:2, outcome:"continue",
    targetHpBefore:{ monster_0:100 },
    events:[
      { id:"party:4:0", type:"target_damage", memberId:"a", targetId:"monster_0", amount:3, source:"player", arrowIndex:0 },
      { id:"party:4:1", type:"target_damage", memberId:"a", targetId:"monster_0", amount:4, source:"player", arrowIndex:1 },
      { id:"party:4:2", type:"target_damage", memberId:"b", targetId:"monster_0", amount:5, source:"player", arrowIndex:0 },
    ],
  });
  expect(events.slice(0, 4)).toEqual(expect.arrayContaining([
    expect.objectContaining({ type:"player_attack", memberId:"a" }),
    expect.objectContaining({ type:"target_damage", memberId:"a", damage:7, remainingHp:93 }),
    expect.objectContaining({ type:"player_attack", memberId:"b" }),
    expect.objectContaining({ type:"target_damage", memberId:"b", damage:5, remainingHp:88 }),
  ]));
  expect(events.filter(event => event.type === "target_damage")).toHaveLength(2);
});

test("all server and compatibility event descriptions are localized without internal IDs", () => {
  const context = {
    targets: { monster_internal_0: { name: "岩甲獸" } },
    members: { member_internal_0: { name: "小明", catName: "麻糬" } },
  };
  const fixtures = [
    { type:"player_attack", memberId:"member_internal_0" },
    { type:"arrow_miss", memberId:"member_internal_0" },
    { type:"target_damage", targetId:"monster_internal_0", amount:9, source:"player" },
    { type:"target_damage", targetId:"monster_internal_0", amount:3, source:"status" },
    { type:"target_damage", targetId:"monster_internal_0", amount:4, source:"reflect" },
    { type:"target_damage", targetId:"monster_internal_0", amount:5, source:"cat" },
    { type:"status_applied", memberId:"member_internal_0", targetId:"monster_internal_0", statusId:"poison" },
    { type:"cat_action", memberId:"member_internal_0", targetId:"monster_internal_0", amount:6, heal:2, shield:3 },
    { type:"monster_counter", memberId:"member_internal_0", targetId:"monster_internal_0", amount:7, absorbed:2 },
    { type:"round_heal", memberId:"member_internal_0", amount:8 },
    { type:"monster_killed", targetId:"monster_internal_0" },
    { type:"rune_heal", targetId:"monster_internal_0", amount:10 },
    { type:"member_down", memberId:"member_internal_0" },
    { type:"round_end" },
    { type:"battle_win" },
    { type:"battle_lose" },
  ];

  for (const event of fixtures) {
    const description = describePartyPresentationEvent(event, context);
    expect(description).not.toMatch(/monster_internal_0|member_internal_0/);
    expect(description).not.toBe("戰鬥狀態更新");
    expect(description).toMatch(/[\u3400-\u9fff]/);
  }
});
