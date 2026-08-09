"use strict";

const crypto = require("node:crypto");

const DAY_MS = 86400000;
const TOKEN_DAYS = 14;
const REVIEW_STATES = new Set(["pending", "private_unread", "private_read", "approved", "complaint_open", "complaint_sending", "complaint_send_failed", "complaint_closed", "approval_revoked", "publication_withdrawn"]);

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : "";
}

function cleanText(value, { min = 0, max = 1000 } = {}) {
  const text = String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (text.length < min || text.length > max) throw new Error("invalid_text_length");
  return text;
}

function normalizeReviewInput(input) {
  const rating = Number(input?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("invalid_rating");
  const consentToPublish = input?.consentToPublish === true;
  const message = cleanText(input?.message, { min: 2, max: 1500 });
  const publicAlias = cleanText(input?.publicAlias, { min: consentToPublish ? 1 : 0, max: 40 });
  return { rating, message, consentToPublish, publicAlias: consentToPublish ? publicAlias : "" };
}

function nextTaipeiTen(now = new Date()) {
  const taipei = new Date(now.getTime() + 8 * 3600000);
  const utc = Date.UTC(taipei.getUTCFullYear(), taipei.getUTCMonth(), taipei.getUTCDate() + 1, 2, 0, 0, 0);
  return new Date(utc);
}

function tokenHash(token) { return crypto.createHash("sha256").update(String(token)).digest("hex"); }
function makeToken() { return crypto.randomBytes(32).toString("base64url"); }
function inviteMailId(memberId, sequence = 0, kind = "auto") { return `guest-review-invite-${encodeURIComponent(memberId)}-${kind}-${sequence}`; }
function complaintMailId(memberId, requestId) { return `guest-review-complaint-${encodeURIComponent(memberId)}-${tokenHash(requestId).slice(0, 20)}`; }
function tokenExpiresAt(now = new Date()) { return new Date(now.getTime() + TOKEN_DAYS * DAY_MS); }

function canTransition(from, to) {
  const allowed = {
    pending: ["approved", "complaint_open", "publication_withdrawn"], private_unread: ["private_read", "complaint_open"],
    private_read: ["complaint_open"], approved: ["approval_revoked", "publication_withdrawn"],
    complaint_open: ["complaint_sending"], complaint_send_failed: ["complaint_sending"],
    complaint_sending: ["complaint_closed", "complaint_send_failed"],
  };
  return REVIEW_STATES.has(from) && REVIEW_STATES.has(to) && (allowed[from] || []).includes(to);
}

function safeGoogleUrl(value) {
  try { const url = new URL(String(value || "")); return url.protocol === "https:" && (/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/.test(url.hostname) || url.hostname === "g.page" || url.hostname === "share.google") ? url.toString() : ""; }
  catch { return ""; }
}

function defaultConfig(data = {}) {
  return {
    enabled: data.enabled !== false,
    googlePromptEnabled: data.googlePromptEnabled !== false,
    googleReviewUrl: safeGoogleUrl(data.googleReviewUrl || "https://share.google/bqXYZDlWtwruWvV69"),
    inviteSubject: cleanText(data.inviteSubject || "邀請您分享這次射箭體驗", { min: 1, max: 120 }),
    inviteText: cleanText(data.inviteText || "謝謝您來到貓小隊！歡迎留下這次體驗的感想。", { min: 1, max: 3000 }),
    complaintSubject: cleanText(data.complaintSubject || "貓小隊回覆您的體驗意見", { min: 1, max: 120 }),
  };
}

module.exports = { DAY_MS, TOKEN_DAYS, normalizeEmail, cleanText, normalizeReviewInput, nextTaipeiTen, tokenHash, makeToken, inviteMailId, complaintMailId, tokenExpiresAt, canTransition, safeGoogleUrl, defaultConfig };
