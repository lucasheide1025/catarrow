import {
  assignDuelTeams, buildInitialDuelCombat, duelSubmissionDocId, focusFireMultiplier, maxHpForArrows,
  resolveDuelRound, spiritSupportAmount, summarizeDuelArrows, updateLocalDuelStats,
  validDuelPlayerCount,
} from "./arcadeDuelLogic";

const players = (...ids) => Object.fromEntries(ids.map((id, i) => [id, { visitorId:id, joinedAt:i+1, nickname:id }]));
const sub = (visitorId, targetId, arrows=[10,9,11]) => ({ visitorId, targetId, ...summarizeDuelArrows(arrows, arrows.length) });

test("3/6 arrows have different HP", () => {
  expect(maxHpForArrows(3)).toBe(80);
  expect(maxHpForArrows(6)).toBe(130);
});

test("duel HP locks to the 2..8 player start roster", () => {
  expect(maxHpForArrows(3, 2)).toBe(80);
  expect(maxHpForArrows(3, 5)).toBe(140);
  expect(maxHpForArrows(3, 99)).toBe(200);
  expect(maxHpForArrows(6, 2)).toBe(130);
  expect(maxHpForArrows(6, 5)).toBe(220);
  expect(maxHpForArrows(6, 0)).toBe(130);
  const combat = buildInitialDuelCombat(players("a", "b", "c", "d"), { mode: "ffa", arrowsPerRound: 6 });
  expect(combat.a).toMatchObject({ hp: 190, maxHp: 190 });
  expect(combat.d).toMatchObject({ hp: 190, maxHp: 190 });
});

test("player count validation", () => {
  expect(validDuelPlayerCount("duel",2)).toBe(true);
  expect(validDuelPlayerCount("duel",3)).toBe(false);
  expect(validDuelPlayerCount("ffa",8)).toBe(true);
  expect(validDuelPlayerCount("ffa",2)).toBe(false);
  expect(validDuelPlayerCount("team",4)).toBe(true);
  expect(validDuelPlayerCount("team",5)).toBe(false);
});

test("team assignment alternates by joinedAt", () => {
  expect(assignDuelTeams(Object.values(players("a","b","c","d")))).toEqual({a:"A",b:"B",c:"A",d:"B"});
});

test("10 and X use critical damage while score remains ten", () => {
  expect(summarizeDuelArrows([10,11,9],3)).toEqual({totalScore:29,baseDamage:44,tens:1,xCount:1,hits:3});
});

test("focus fire protection is deterministic", () => {
  expect(focusFireMultiplier(1)).toBe(1);
  expect(focusFireMultiplier(2)).toBe(.85);
  expect(focusFireMultiplier(3)).toBe(.7);
  expect(focusFireMultiplier(8)).toBe(.55);
});

test("simultaneous duel attacks can knock both into spirit", () => {
  const combat=buildInitialDuelCombat(players("a","b"),{mode:"duel",arrowsPerRound:3});
  combat.a.hp=20; combat.b.hp=20;
  const r=resolveDuelRound({mode:"duel",round:1,combat,submissions:[sub("a","b",[11,11,11]),sub("b","a",[11,11,11])]});
  expect(r.combat.a.state).toBe("spirit");
  expect(r.combat.b.state).toBe("spirit");
  expect(r.finished).toBe(true);
  expect(r.winnerId).toBe(null);
});

test("three attackers on one target all receive same 0.7 protection", () => {
  const combat=buildInitialDuelCombat(players("a","b","c","d"),{mode:"ffa",arrowsPerRound:3});
  const r=resolveDuelRound({mode:"ffa",round:1,combat,submissions:[sub("a","d"),sub("b","d"),sub("c","d"),sub("d","a",[0,0,0])]});
  const hits=r.attacks.filter(x=>x.targetId==="d");
  expect(hits).toHaveLength(3);
  expect(hits.every(x=>x.multiplier===.7)).toBe(true);
  expect(new Set(hits.map(x=>x.damage)).size).toBe(1);
});

test("FFA spirit automatically supports lowest HP living player", () => {
  const combat=buildInitialDuelCombat(players("a","b","c"),{mode:"ffa",arrowsPerRound:3});
  combat.a.state="spirit"; combat.a.hp=0; combat.b.hp=20; combat.c.hp=50;
  const s={visitorId:"a",targetId:"c",...summarizeDuelArrows([10,10,10],3)};
  const r=resolveDuelRound({mode:"ffa",round:2,combat,submissions:[s,sub("b","c",[0,0,0]),sub("c","b",[0,0,0])]});
  expect(r.supports[0].targetId).toBe("b");
  expect(r.combat.b.hp).toBeGreaterThan(20);
});

test("team spirit can support living teammate only", () => {
  const ps=players("a","b","c","d");
  const combat=buildInitialDuelCombat(ps,{mode:"team",arrowsPerRound:3});
  expect(combat.a.team).toBe("A"); expect(combat.c.team).toBe("A");
  combat.a.state="spirit"; combat.a.hp=0; combat.c.hp=30;
  const heal=spiritSupportAmount(summarizeDuelArrows([10,10,10],3));
  const r=resolveDuelRound({mode:"team",round:2,combat,submissions:[{visitorId:"a",targetId:"c",...summarizeDuelArrows([10,10,10],3)},sub("b","c",[0,0,0]),sub("c","b",[0,0,0]),sub("d","c",[0,0,0])]});
  expect(r.supports[0]).toMatchObject({fromId:"a",targetId:"c",heal});
  expect(r.combat.c.hp).toBe(30+heal);
});

test("missing submission is zero when force-resolved", () => {
  const combat=buildInitialDuelCombat(players("a","b","c"),{mode:"ffa",arrowsPerRound:3});
  const r=resolveDuelRound({mode:"ffa",round:1,combat,submissions:[sub("a","b"),sub("b","a")]});
  expect(r.missingIds).toEqual(["c"]);
  expect(r.combat.c.hp).toBe(100);
});

test("local duel stats accumulate without cloud semantics", () => {
  expect(updateLocalDuelStats({matches:2,wins:1,damage:30,xCount:1,bestScore:27},{won:true,damage:44,xCount:2,score:29}))
    .toEqual({matches:3,wins:2,damage:74,xCount:3,bestScore:29});
});


test("duel submission doc id stays top-level and encodes unsafe visitor ids", () => {
  const id = duelSubmissionDocId("12345", "session/a", "visitor/a b");
  expect(id).toBe("DUELSUB_12345_session%2Fa_visitor%2Fa%20b");
  expect(id).not.toContain("/");
});


test("different session keys never reuse the same submission doc", () => {
  const a = duelSubmissionDocId("12345", "session-a", "visitor-1");
  const b = duelSubmissionDocId("12345", "session-b", "visitor-1");
  expect(a).not.toBe(b);
  expect(duelSubmissionDocId("12345", "", "visitor-1")).toBe("DUELSUB_12345_visitor-1");
});
