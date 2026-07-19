import {
  applyAccessorySpecialization,
  applyArmorSpecialization,
  applyWeaponSpecialization,
  getSpecializationEffect,
} from "./equipmentSpecializationEngine";

describe("equipment specialization effects", () => {
  test("precision and boss hunter only trigger on eligible arrows", () => {
    expect(applyWeaponSpecialization({ damage: 100, monsterDefense: 40, trackId: "precision", level: 10, highQuality: true }).damage).toBe(120);
    expect(applyWeaponSpecialization({ damage: 100, monsterDefense: 40, trackId: "precision", level: 10, highQuality: false }).damage).toBe(100);
    expect(applyWeaponSpecialization({ damage: 100, trackId: "bossHunter", level: 10, bossTagged: true }).damage).toBe(120);
  });

  test("armor break reduces effective defense before later defense calculations", () => {
    expect(applyWeaponSpecialization({ damage: 100, monsterDefense: 200, trackId: "armorBreak", level: 10 }).effectiveDefense).toBe(170);
  });

  test("guard checks hp before the hit and immunity keeps one status round", () => {
    expect(applyArmorSpecialization({ incomingDamage: 100, currentHp: 35, maxHp: 100, trackId: "guard", level: 10 }).damage).toBe(80);
    expect(applyArmorSpecialization({ incomingDamage: 100, currentHp: 36, maxHp: 100, trackId: "guard", level: 10 }).damage).toBe(100);
    expect(applyArmorSpecialization({ incomingDamage: 10, currentHp: 50, maxHp: 100, trackId: "immunity", level: 10, status: { strength: 20, duration: 2 } }).status).toEqual({ strength: 14, duration: 1 });
  });

  test("accessory effects cannot revive and support only scales owned companion values", () => {
    expect(applyAccessorySpecialization({ currentHp: 0, maxHp: 100, trackId: "wellRested", level: 10, alive: false }).currentHp).toBe(0);
    expect(applyAccessorySpecialization({ currentHp: 80, maxHp: 100, trackId: "nutrition", level: 10 })).toMatchObject({ currentHp: 110, maxHp: 130 });
    expect(applyAccessorySpecialization({ currentHp: 80, maxHp: 100, trackId: "support", level: 10, companionAttack: 20, companionHealing: 10 })).toMatchObject({ companionAttack: 26, companionHealing: 13 });
  });

  test("caps levels at ten", () => {
    expect(getSpecializationEffect("precision", 99)).toEqual({ highQualityDamagePct: 20 });
  });
});
