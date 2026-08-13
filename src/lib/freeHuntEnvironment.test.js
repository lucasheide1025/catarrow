import { FREE_HUNT_FACES, FREE_HUNT_DISTANCES, freeHuntBowMultiplier, getFreeHuntEnvironment, getPartyMemberFreeHuntEnvironment, applyFreeHuntFaceCap } from "./freeHuntEnvironment";
import { RAID_FACES, faceMultiplier, maxArrowsPerFace } from "../worldboss/domain/raidFaces";
import { RAID_DISTANCES, distanceMultiplier, rangeMultiplier } from "../worldboss/domain/raidRange";

describe("free hunt environment", () => {
  test("reuses the World Boss face and distance sources", () => {
    expect(FREE_HUNT_FACES).toBe(RAID_FACES);
    expect(FREE_HUNT_DISTANCES).toBe(RAID_DISTANCES);
  });

  test("matches World Boss multipliers for every selectable environment", () => {
    for (const face of RAID_FACES) {
      for (const distanceM of RAID_DISTANCES) {
        const env = getFreeHuntEnvironment({ distanceM, targetFmt: face.id });
        expect(env.faceMult).toBe(faceMultiplier(face.id));
        expect(env.faceCap).toBe(maxArrowsPerFace(face.id));
        expect(env.distanceMult).toBe(distanceMultiplier(distanceM));
        expect(env.multiplier).toBe(rangeMultiplier({ distanceM, targetFmt: face.id }));
      }
    }
  });

  test("uses the requested bow multipliers and defaults unknown bows to x1", () => {
    expect(freeHuntBowMultiplier("recurve_bare")).toBe(1);
    expect(freeHuntBowMultiplier("compound")).toBe(1);
    expect(freeHuntBowMultiplier("traditional")).toBe(2);
    expect(freeHuntBowMultiplier("unknown")).toBe(1);
    expect(freeHuntBowMultiplier()).toBe(1);
  });

  test("traditional bow doubles the final free-hunt multiplier", () => {
    const base = getFreeHuntEnvironment({ distanceM:10, targetFmt:"full_110", bowType:"recurve_bare" });
    const traditional = getFreeHuntEnvironment({ distanceM:10, targetFmt:"full_110", bowType:"traditional" });
    expect(base.bowMult).toBe(1);
    expect(traditional.bowMult).toBe(2);
    expect(traditional.environmentMult).toBe(base.environmentMult);
    expect(traditional.multiplier).toBe(base.multiplier * 2);
  });

  test("inherits the World Boss triple-face two-arrow cap", () => {
    expect(getFreeHuntEnvironment({ distanceM:10, targetFmt:"triple" }).faceCap).toBe(2);
    expect(getFreeHuntEnvironment({ distanceM:10, targetFmt:"half_17" }).faceCap).toBeNull();
  });

  test("applies the triple-face two-arrow cap per face for authority checks", () => {
    const arrows = [0,0,0,1,1,1,2,2,2].map((faceIndex, index) => ({ score:10-index, faceIndex }));
    const capped = applyFreeHuntFaceCap(arrows, 2);
    expect(capped.filter(arrow => !arrow.overFaceCap)).toHaveLength(6);
    for (const faceIndex of [0,1,2]) {
      expect(capped.filter(arrow => arrow.faceIndex === faceIndex && !arrow.overFaceCap)).toHaveLength(2);
      expect(capped.filter(arrow => arrow.faceIndex === faceIndex && arrow.overFaceCap)).toHaveLength(1);
    }
  });

  test("leaves every arrow damage-eligible when the face has no cap", () => {
    const arrows = [{ score:10, faceIndex:0 }, { score:9, faceIndex:0 }, { score:8, faceIndex:0 }];
    expect(applyFreeHuntFaceCap(arrows, null).every(arrow => arrow.overFaceCap === false)).toBe(true);
  });

  test("party member distance, target and bow override room fallbacks", () => {
    const room = { huntDistanceM:5, huntTargetFmt:"half_17" };
    const member = { huntDistanceM:30, huntTargetFmt:"triple", bowType:"traditional" };
    const env = getPartyMemberFreeHuntEnvironment(member, room);
    expect(env.distanceM).toBe(30);
    expect(env.targetFmt).toBe("triple");
    expect(env.bowType).toBe("traditional");
    expect(env.faceCap).toBe(2);
    expect(env.bowMult).toBe(2);
  });

  test("party member environment falls back to legacy room values", () => {
    const env = getPartyMemberFreeHuntEnvironment({}, { huntDistanceM:20, huntTargetFmt:"full_110" });
    expect(env.distanceM).toBe(20);
    expect(env.targetFmt).toBe("full_110");
    expect(env.bowType).toBe("recurve_bare");
  });

  test("different teammates keep independent hunt environments", () => {
    const room = { huntDistanceM:5, huntTargetFmt:"half_17" };
    const a = getPartyMemberFreeHuntEnvironment({ huntDistanceM:10, huntTargetFmt:"full_110", bowType:"recurve_bare" }, room);
    const b = getPartyMemberFreeHuntEnvironment({ huntDistanceM:30, huntTargetFmt:"triple", bowType:"traditional" }, room);
    expect(a.distanceM).toBe(10);
    expect(b.distanceM).toBe(30);
    expect(a.targetFmt).toBe("full_110");
    expect(b.targetFmt).toBe("triple");
    expect(a.multiplier).not.toBe(b.multiplier);
  });

  test("party member face cap follows that member's selected target", () => {
    const room = { huntDistanceM:10, huntTargetFmt:"half_17" };
    const triple = getPartyMemberFreeHuntEnvironment({ huntTargetFmt:"triple" }, room);
    const half = getPartyMemberFreeHuntEnvironment({ huntTargetFmt:"half_17" }, room);
    expect(triple.faceCap).toBe(2);
    expect(half.faceCap).toBeNull();
  });
});
