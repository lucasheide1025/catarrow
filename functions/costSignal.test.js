"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  billingLevel,
  budgetPercent,
  parseCostSignal,
  shouldRaise,
} = require("./costSignal");

test("billing thresholds notify at 50 and start protection at 80 percent", () => {
  assert.equal(billingLevel(49.99), null);
  assert.equal(billingLevel(50), "warning");
  assert.equal(billingLevel(79.99), "warning");
  assert.equal(billingLevel(80), "protect");
  assert.equal(billingLevel(90), "restricted");
  assert.equal(billingLevel(95), "emergency");
});

test("budget percentage prefers actual cost and budget amounts", () => {
  assert.equal(budgetPercent({ costAmount: 8, budgetAmount: 10, alertThresholdExceeded: 0.5 }), 80);
  assert.equal(budgetPercent({ alertThresholdExceeded: 0.9 }), 90);
});

test("billing events map to an automatic escalation", () => {
  assert.equal(parseCostSignal({ alertThresholdExceeded: 0.5 }).level, "warning");
  assert.deepEqual(parseCostSignal({ costAmount: 8, budgetAmount: 10 }), {
    level: "protect",
    observedPercent: 80,
    source: "cloud-billing-budget",
    reason: "Monthly budget reached 80.0%",
  });
  assert.equal(parseCostSignal({ costAmount: 4.99, budgetAmount: 10 }), null);
});

test("open Firestore read and write incidents map to restricted", () => {
  assert.equal(parseCostSignal({
    incident: { state: "open", condition_name: "Firestore 5 minute document reads" },
  }).level, "restricted");
  assert.equal(parseCostSignal({
    incident: { state: "open", metric: { type: "firestore.googleapis.com/document/write_count" } },
  }).level, "restricted");
  assert.equal(parseCostSignal({
    incident: { state: "open", policy_name: "Firestore 5分鐘寫入超過1000" },
  }).reason, "Firestore write rate alert opened");
  assert.equal(parseCostSignal({
    incident: { state: "closed", condition_name: "Firestore document writes" },
  }), null);
  assert.equal(parseCostSignal({
    incident: { condition_name: "Firestore document writes" },
  }), null);
});

test("automatic transitions are upward only and therefore replay-safe", () => {
  assert.equal(shouldRaise("normal", "restricted"), true);
  assert.equal(shouldRaise("restricted", "restricted"), false);
  assert.equal(shouldRaise("emergency", "protect"), false);
});
