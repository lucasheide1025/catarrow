"use strict";

const crypto = require("node:crypto");

const DEFAULT_CONFIG = Object.freeze({
  enabled: false,
  hourlyLimit: 20,
  dailyLimit: 100,
  trackingEnabled: true,
});

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || email.length > 254) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

function normalizeMarketingAccountType(value) {
  if (value === "guest") return "guest";
  if (value === "kid") return "kid";
  // Legacy enrolled students may predate accountType. Elsewhere in the app
  // a missing account type falls back to official, so campaigns do the same.
  return "official";
}

function hashEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return "";
  return crypto.createHash("sha256").update(email).digest("hex");
}

function makeToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToHtml(value) {
  return `<div style="white-space:pre-wrap;font-family:Arial,'Noto Sans TC',sans-serif;line-height:1.7">${escapeHtml(value)}</div>`;
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeConfig(raw = {}) {
  const hourlyLimit = clampInt(raw.hourlyLimit, DEFAULT_CONFIG.hourlyLimit, 1, 100);
  const dailyLimit = Math.max(
    hourlyLimit,
    clampInt(raw.dailyLimit, DEFAULT_CONFIG.dailyLimit, 1, 1000),
  );
  return {
    enabled: raw.enabled === true,
    hourlyLimit,
    dailyLimit,
    trackingEnabled: raw.trackingEnabled !== false,
  };
}

function validateCampaignInput(raw = {}) {
  const name = String(raw.name || "").trim();
  const audience = String(raw.audience || "all");
  const subject = String(raw.subject || "").trim();
  const text = String(raw.text || "");
  const html = String(raw.html || "");
  if (!name || name.length > 120) throw new Error("campaign_name_invalid");
  if (!["official", "guest", "all"].includes(audience)) throw new Error("campaign_audience_invalid");
  if (!subject || subject.length > 200) throw new Error("campaign_subject_invalid");
  if (text.length > 20000 || html.length > 50000 || (!text.trim() && !html.trim())) {
    throw new Error("campaign_content_invalid");
  }
  return {
    name,
    audience,
    subject,
    text,
    html,
    trackingEnabled: raw.trackingEnabled !== false,
  };
}

function queueId(campaignId, emailHash) {
  return `${String(campaignId).replace(/[^A-Za-z0-9_-]/g, "_")}_${String(emailHash)}`;
}

function mailId(id, attempt) {
  return `marketing-${String(id).replace(/[^A-Za-z0-9_-]/g, "_")}-a${Number(attempt) || 1}`;
}

function publicFunctionUrl(name) {
  const explicit = String(process.env.MARKETING_EMAIL_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  if (explicit) return `${explicit}/${name}`;
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error("marketing_email_public_base_url_missing");
  return `https://asia-east1-${project}.cloudfunctions.net/${name}`;
}

const transparentGif = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64",
);

module.exports = {
  DEFAULT_CONFIG,
  normalizeEmail,
  normalizeMarketingAccountType,
  hashEmail,
  makeToken,
  escapeHtml,
  textToHtml,
  normalizeConfig,
  validateCampaignInput,
  queueId,
  mailId,
  publicFunctionUrl,
  transparentGif,
};
