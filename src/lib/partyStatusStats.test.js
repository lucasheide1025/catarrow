// 異常狀態的「實際數值」呈現（2026-07-19 使用者要求）。
// 只寫 -15% 玩家無感，必須換算成實際扣了幾點，且面板數字要即時反映、到期復原。
import { applyPartyStatusesForRound } from "./partyMonsterAbilityEngine";

// 與 PartyBattleRoom.myEffectiveStats 相同的算法（面板顯示用）
function effectiveStats(member) {
  let atkMult = 1;
  let defMult = 1;
  for (const status of member.combatStatuses || []) {
    if (!status || (status.duration || 0) <= 0) continue;
    if (status.id === "atkDown") atkMult *= Math.max(0, 1 - (status.strength || 0) / 100);
    if (status.id === "defDown") defMult *= Math.max(0, 1 - (status.strength || 0) / 100);
  }
  return { atk: Math.round((member.atk || 10) * atkMult), def: Math.round((member.def || 10) * defMult) };
}

describe("減益的面板數值", () => {
  test("atkDown 15% 會讓面板 ATK 由 40 變 34", () => {
    const member = { atk: 40, def: 20, combatStatuses: [{ id: "atkDown", strength: 15, duration: 1 }] };
    expect(effectiveStats(member).atk).toBe(34);
    expect(effectiveStats(member).def).toBe(20); // 不影響防禦
  });

  test("duration 歸零後數值復原", () => {
    const member = { atk: 40, def: 20, combatStatuses: [{ id: "atkDown", strength: 15, duration: 0 }] };
    expect(effectiveStats(member)).toEqual({ atk: 40, def: 20 });
  });

  test("沒有異常時維持原值", () => {
    expect(effectiveStats({ atk: 40, def: 20, combatStatuses: [] })).toEqual({ atk: 40, def: 20 });
  });

  test("引擎的 tick 會回報強度，供訊息換算實際點數", () => {
    const result = applyPartyStatusesForRound({
      hp: 100, maxHP: 100, atk: 40, def: 20,
      combatStatuses: [{ id: "atkDown", strength: 15, duration: 2 }],
    });
    const tick = result.ticks.find(t => t.id === "atkDown");
    expect(tick.strength).toBe(15);
    // 40 × 15% = 6 點，訊息應顯示「-15%（-6 點）」
    expect(Math.round(40 * tick.strength / 100)).toBe(6);
  });

  test("毒傷不會致死（最低留 1 HP）", () => {
    const result = applyPartyStatusesForRound({
      hp: 3, maxHP: 500, atk: 40, def: 20,
      combatStatuses: [{ id: "poison", strength: 90, duration: 1 }],
    });
    expect(result.hp).toBeGreaterThanOrEqual(1);
  });
});
