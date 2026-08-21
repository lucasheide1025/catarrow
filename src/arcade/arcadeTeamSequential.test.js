import { resolveTeamRound, resolveTeamBossRound, assignPersonalGoals } from "./arcadeTeamLogic";

describe("組隊 A→B→C presentation 資料契約", () => {
  test("普通怪維持 roster 順序，個人傷害加總精確等於實際總傷害", () => {
    const room = { monster: { name: "測試怪", hp: 500, def: 7, atk: 12 }, monsterHp: 500, atkBuff: 1 };
    const roster = [
      { visitorId: "A", nickname: "阿A", hp: 100, alive: true, roundScore: 40, roundHits: 4 },
      { visitorId: "B", nickname: "阿B", hp: 30, alive: true, roundScore: 25, roundHits: 3 },
      { visitorId: "C", nickname: "阿C", hp: 8, alive: true, roundScore: 10, roundHits: 1 },
    ];
    const r = resolveTeamRound(room, roster);
    expect(r.perPlayer.map((x) => x.visitorId)).toEqual(["A", "B", "C"]);
    expect(r.perPlayer.reduce((s, x) => s + x.dmg, 0)).toBe(r.dmg);
    expect(r.perPlayer[0].dmg).toBeGreaterThan(r.perPlayer[1].dmg);
    expect(r.perPlayer[1].dmg).toBeGreaterThan(r.perPlayer[2].dmg);
    expect(r.partyDamage).toEqual([
      { visitorId: "A", amount: 12, hpBefore: 100, hpAfter: 88, alive: true },
      { visitorId: "B", amount: 12, hpBefore: 30, hpAfter: 18, alive: true },
      { visitorId: "C", amount: 8, hpBefore: 8, hpAfter: 0, alive: false },
    ]);
  });

  test("BOSS perPlayer 同樣保留 roster 順序與顯示資料", () => {
    const goals = assignPersonalGoals(2);
    const room = {
      monster: { name: "王", hp: 500, def: 1 }, monsterHp: 500, spirit: 100,
      teamGoals: { teamMin: 50, atkBuff: 1, personal: goals },
    };
    const roster = [
      { visitorId: "A", nickname: "阿A", catName: "哈吉", catImage: "/a.webp", roundScore: 30, roundHits: 4, personalGoalId: goals[0].id, roundArrows: [] },
      { visitorId: "B", nickname: "阿B", catName: "寶寶", catImage: "/b.webp", roundScore: 30, roundHits: 4, personalGoalId: goals[1].id, roundArrows: [] },
    ];
    const r = resolveTeamBossRound(room, roster);
    expect(r.perPlayer.map((x) => x.visitorId)).toEqual(["A", "B"]);
    expect(r.perPlayer[0]).toMatchObject({ nickname: "阿A", catName: "哈吉", score: 30, hits: 4 });
  });
});
