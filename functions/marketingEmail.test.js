"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const marketing = require("./marketingEmail");

test("normalizeEmail validates and lowercases", () => {
  assert.equal(marketing.normalizeEmail("  USER@Example.COM "), "user@example.com");
  assert.equal(marketing.normalizeEmail("not-an-email"), "");
});

test("legacy enrolled records without accountType normalize to official", () => {
  assert.equal(marketing.normalizeMarketingAccountType(undefined), "official");
  assert.equal(marketing.normalizeMarketingAccountType("official"), "official");
  assert.equal(marketing.normalizeMarketingAccountType("guest"), "guest");
  assert.equal(marketing.normalizeMarketingAccountType("kid"), "kid");
});

test("hashEmail is deterministic and does not expose the address", () => {
  const a = marketing.hashEmail("user@example.com");
  const b = marketing.hashEmail("USER@example.com");
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.equal(a.includes("user"), false);
});

test("normalizeConfig clamps limits and keeps daily >= hourly", () => {
  assert.deepEqual(marketing.normalizeConfig({}), {
    enabled: false,
    hourlyLimit: 20,
    dailyLimit: 100,
    trackingEnabled: true,
  });
  assert.deepEqual(marketing.normalizeConfig({ enabled:true, hourlyLimit:999, dailyLimit:2, trackingEnabled:false }), {
    enabled: true,
    hourlyLimit: 100,
    dailyLimit: 100,
    trackingEnabled: false,
  });
});

test("campaign validation and text html escaping", () => {
  const result = marketing.validateCampaignInput({ name:"比賽通知", audience:"all", subject:"測試", text:"<b>hello</b>" });
  assert.equal(result.audience, "all");
  assert.match(marketing.textToHtml(result.text), /&lt;b&gt;hello&lt;\/b&gt;/);
  assert.throws(() => marketing.validateCampaignInput({ name:"x", audience:"kid", subject:"x", text:"x" }));
});

test("tokens are opaque and random", () => {
  const a = marketing.makeToken();
  const b = marketing.makeToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{40,}$/);
});
