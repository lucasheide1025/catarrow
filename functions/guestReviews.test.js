"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("./guestReviews");

test("Taipei next day is 10:00 even across UTC date boundary", () => {
  assert.equal(g.nextTaipeiTen(new Date("2026-08-02T15:30:00Z")).toISOString(), "2026-08-03T02:00:00.000Z");
});
test("token hashes are stable while raw token is not retained", () => {
  assert.equal(g.tokenHash("abc"), g.tokenHash("abc")); assert.notEqual(g.tokenHash("abc"), g.tokenHash("abcd"));
  assert.match(g.makeToken(), /^[A-Za-z0-9_-]{40,}$/);
});
test("review input enforces rating, copy and alias consent", () => {
  assert.deepEqual(g.normalizeReviewInput({rating:5,message:" 很棒 ",consentToPublish:false,publicAlias:"本名"}), {rating:5,message:"很棒",consentToPublish:false,publicAlias:""});
  assert.throws(() => g.normalizeReviewInput({rating:6,message:"好",consentToPublish:false}), /invalid_rating/);
  assert.throws(() => g.normalizeReviewInput({rating:5,message:"很好",consentToPublish:true,publicAlias:""}), /invalid_text_length/);
});
test("state machine rejects editing and reopening terminal reviews", () => {
  assert.equal(g.canTransition("pending", "approved"), true); assert.equal(g.canTransition("approved", "pending"), false);
  assert.equal(g.canTransition("pending", "publication_withdrawn"), true);
  assert.equal(g.canTransition("complaint_sending", "complaint_closed"), true);
});
test("five-star prompt URL must be safe Google https URL", () => {
  assert.ok(g.safeGoogleUrl("https://g.page/r/example/review")); assert.equal(g.safeGoogleUrl("javascript:alert(1)"), "");
  assert.equal(g.safeGoogleUrl("https://share.google/bqXYZDlWtwruWvV69"), "https://share.google/bqXYZDlWtwruWvV69");
  assert.equal(g.safeGoogleUrl("https://evil.example/google.com"), "");
});
test("mail IDs are deterministic and retries use a distinct sequence", () => {
  assert.equal(g.inviteMailId("m/1"), "guest-review-invite-m%2F1-auto-0"); assert.notEqual(g.inviteMailId("m", 1), g.inviteMailId("m", 2));
  assert.notEqual(g.inviteMailId("m", 1, "manual"), g.inviteMailId("m", 1, "auto"));
  assert.equal(g.complaintMailId("m", "req"), g.complaintMailId("m", "req"));
});
