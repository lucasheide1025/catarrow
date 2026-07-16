import {
  getSoundEnabled,
  getVibrationEnabled,
  setSoundEnabled,
  setVibrationEnabled,
} from "./fxSettings";

describe("independent feedback preferences", () => {
  beforeEach(() => localStorage.clear());

  test("sound and vibration default to enabled", () => {
    expect(getSoundEnabled()).toBe(true);
    expect(getVibrationEnabled()).toBe(true);
  });

  test("turning sound off does not disable vibration", () => {
    setSoundEnabled(false);
    expect(getSoundEnabled()).toBe(false);
    expect(getVibrationEnabled()).toBe(true);
  });

  test("turning vibration off does not disable sound", () => {
    setVibrationEnabled(false);
    expect(getVibrationEnabled()).toBe(false);
    expect(getSoundEnabled()).toBe(true);
  });
});
