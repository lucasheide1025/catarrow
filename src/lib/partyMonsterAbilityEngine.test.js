import { applyPartyStatusesForRound, buildPartyAbilityPreview, resolvePartyMonsterAbility, selectPartyAbilityTarget } from "./partyMonsterAbilityEngine";

const members = {
  z: { alive: true, role: "rear", ready: true, arrows: [{ score: 10 }] },
  b: { alive: true, role: "front", ready: true, arrows: [{ score: 6 }] },
  a: { alive: true, role: "front", ready: true, arrows: [{ score: 10 }] },
};

describe("party monster ability engine", () => {
  test("self-target common abilities resolve instead of silently doing nothing", () => {
    const result = resolvePartyMonsterAbility({
      roomId:"room-armor", round:4,
      monster:{ id:"armor", encounter:"normal", tierIndex:3, signatureSkillId:"unused", commonSkillIds:["common_armor"] },
      members:{ a:{ alive:true, role:"front", ready:true, arrows:[{ score:"M" }] } },
    });
    expect(result.reason).toBeUndefined();
    expect(result.resolved.selfReductionPct).toBeGreaterThan(0);
  });

  test("selects the first deterministic living front member", () => {
    expect(selectPartyAbilityTarget(members)).toBe("a");
  });

  test("builds a reconnect-safe preview with a locked target", () => {
    expect(buildPartyAbilityPreview({
      round:4,
      monster:{ id:"m", encounter:"normal", commonSkillIds:["common_poison"], signatureSkillId:"sig_m" },
      members,
    })).toMatchObject({ round:4, skillId:"common_poison", targetId:"a" });
  });

  test("single-target status uses only the selected member's break result", () => {
    const result = resolvePartyMonsterAbility({
      roomId: "room-1",
      round: 4,
      monster: { id: "m", encounter: "normal", tierIndex: 3, commonSkillIds: ["common_poison"], signatureSkillId: "sig_m" },
      members,
    });
    expect(result.targetId).toBe("a");
    expect(result.resolved.resolvedKey).toBe("party:room-1:4:m:common_poison");
    expect(result.resolved.outcome.level).toBe("full");
    expect(result.resolved.status).toBeNull();
  });

  test("targetFmt 貫通：field_16 滿環在原野靶為完全破解,誤用預設 full_110 則否", () => {
    const monster = { id: "m", encounter: "normal", tierIndex: 3, commonSkillIds: ["common_poison"], signatureSkillId: "sig_m" };
    const fieldMembers = { a: { alive: true, role: "front", ready: true, arrows: [{ score: 5 }, { score: 5 }, { score: "X" }] } };
    const withFmt = resolvePartyMonsterAbility({ roomId: "r", round: 4, monster, members: fieldMembers, targetFmt: "field_16" });
    expect(withFmt.resolved.outcome.level).toBe("full");
    expect(withFmt.resolved.status).toBeNull();
    const withoutFmt = resolvePartyMonsterAbility({ roomId: "r2", round: 4, monster, members: fieldMembers });
    expect(withoutFmt.resolved.outcome.level).not.toBe("full"); // 回歸保護:partyDb 接線必須帶 room.targetFormat
  });

  test("signature rounds are recorded without inventing an unstructured effect", () => {
    const result = resolvePartyMonsterAbility({
      roomId: "room-1", round: 2,
      monster: { id: "m", encounter: "normal", signatureSkillId: "sig_m", signatureName: "招牌" },
      members,
    });
    expect(result.scheduled).toMatchObject({ type: "signature", skillId: "sig_m" });
    expect(result.resolved).toBeNull();
  });

  test("applies persisted statuses once and keeps poison non-lethal", () => {
    expect(applyPartyStatusesForRound({ hp:5, maxHP:100, combatStatuses:[
      { id:"poison", strength:10, duration:1 },
      { id:"atkDown", strength:20, duration:2 },
    ] })).toMatchObject({ hp:1, atkMultiplier:0.8, defMultiplier:1,
      remainingStatuses:[{ id:"atkDown", strength:20, duration:1 }] });
  });
});
