import { observeCostAlertLevel } from "./costAlertAudio";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("plays only when the observed cost level rises", () => {
  const storage = memoryStorage();
  expect(observeCostAlertLevel("normal", storage)).toBe(false);
  expect(observeCostAlertLevel("warning", storage)).toBe(true);
  expect(observeCostAlertLevel("warning", storage)).toBe(false);
  expect(observeCostAlertLevel("protect", storage)).toBe(true);
});

test("manual recovery allows a later escalation to alert again", () => {
  const storage = memoryStorage({ "costControl:v1:lastObservedAlertLevel": "protect" });
  expect(observeCostAlertLevel("warning", storage)).toBe(false);
  expect(observeCostAlertLevel("protect", storage)).toBe(true);
});

test("an initial non-normal snapshot and duplicate snapshots stay silent", () => {
  const storage = memoryStorage();
  expect(observeCostAlertLevel("emergency", storage)).toBe(false);
  expect(observeCostAlertLevel("emergency", storage)).toBe(false);
});

test("normal recovery is recorded for a later escalation", () => {
  const storage = memoryStorage({ "costControl:v1:lastObservedAlertLevel": "emergency" });
  expect(observeCostAlertLevel("normal", storage)).toBe(false);
  expect(observeCostAlertLevel("warning", storage)).toBe(true);
});

test("invalid levels do not replace the last valid observation", () => {
  const storage = memoryStorage();
  expect(observeCostAlertLevel("normal", storage)).toBe(false);
  expect(observeCostAlertLevel("unknown", storage)).toBe(false);
  expect(observeCostAlertLevel("warning", storage)).toBe(true);
});
