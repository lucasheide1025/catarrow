"use strict";

const LEVEL_RANK = Object.freeze({
  normal: 0,
  warning: 1,
  protect: 2,
  restricted: 3,
  emergency: 4,
});

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function budgetPercent(payload) {
  const cost = finiteNumber(payload.costAmount);
  const budget = finiteNumber(payload.budgetAmount);
  if (cost !== null && budget !== null && budget > 0) {
    return (cost / budget) * 100;
  }

  const threshold = finiteNumber(
    payload.alertThresholdExceeded ?? payload.forecastThresholdExceeded,
  );
  return threshold === null ? null : threshold * 100;
}

function billingLevel(percent) {
  if (percent >= 95) return "emergency";
  if (percent >= 90) return "restricted";
  if (percent >= 80) return "protect";
  if (percent >= 50) return "warning";
  return null;
}

function monitoringMetricText(payload) {
  const incident = payload.incident || payload;
  return [
    incident.metric?.type,
    incident.resource?.type,
    incident.condition_name,
    incident.policy_name,
    incident.summary,
    incident.documentation?.content,
    JSON.stringify(incident.metric?.labels || {}),
  ].filter(Boolean).join(" ").toLowerCase();
}

function parseCostSignal(payload) {
  if (!payload || typeof payload !== "object") return null;

  if (payload.budgetAmount !== undefined
      || payload.alertThresholdExceeded !== undefined
      || payload.forecastThresholdExceeded !== undefined) {
    const percent = budgetPercent(payload);
    const level = percent === null ? null : billingLevel(percent);
    if (!level) return null;
    return {
      level,
      observedPercent: percent,
      source: "cloud-billing-budget",
      reason: `Monthly budget reached ${percent.toFixed(1)}%`,
    };
  }

  const incident = payload.incident || payload;
  const state = String(incident.state || incident.status || "").toLowerCase();
  if (!["open", "firing", "active"].includes(state)) return null;

  const metricText = monitoringMetricText(payload);
  const isFirestoreOperation = /firestore/.test(metricText)
    && /(document[ _.-]?(read|write)|read_count|write_count|read_ops_count|write_ops_count|讀取|寫入)/.test(metricText);
  if (!isFirestoreOperation) return null;

  const operation = /(write|寫入)/.test(metricText) ? "write" : "read";
  return {
    level: "restricted",
    observedPercent: null,
    source: "cloud-monitoring",
    reason: `Firestore ${operation} rate alert opened`,
  };
}

function shouldRaise(currentLevel, requestedLevel) {
  return (LEVEL_RANK[requestedLevel] ?? -1) > (LEVEL_RANK[currentLevel] ?? 0);
}

module.exports = {
  LEVEL_RANK,
  billingLevel,
  budgetPercent,
  parseCostSignal,
  shouldRaise,
};
