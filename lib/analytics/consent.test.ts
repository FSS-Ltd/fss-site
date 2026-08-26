import assert from "node:assert/strict";
import test from "node:test";

import {
  ANALYTICS_CONSENT_DURATION_MS,
  ANALYTICS_CONSENT_COOKIE_NAME,
  ANALYTICS_CONSENT_VERSION,
  createAnalyticsConsentCookie,
  createAnalyticsConsent,
  getAnalyticsCookieDomains,
  getAnalyticsCookieNames,
  parseAnalyticsConsent,
  resolveAnalyticsConsentValue,
  resolveSessionAnalyticsConsent,
  shouldDisableAnalytics,
  shouldLoadAnalytics,
} from "./consent";

const NOW = Date.UTC(2026, 7, 26, 6);

test("creates a versioned analytics preference that expires after one year", () => {
  assert.deepEqual(createAnalyticsConsent("accepted", NOW), {
    version: ANALYTICS_CONSENT_VERSION,
    choice: "accepted",
    decidedAt: NOW,
    expiresAt: NOW + ANALYTICS_CONSENT_DURATION_MS,
  });
});

test("parses unexpired accepted and rejected preferences", () => {
  for (const choice of ["accepted", "rejected"] as const) {
    const preference = createAnalyticsConsent(choice, NOW);

    assert.deepEqual(
      parseAnalyticsConsent(JSON.stringify(preference), NOW + 1),
      preference,
    );
  }
});

test("rejects malformed, expired, and obsolete preferences", () => {
  const expired = createAnalyticsConsent("accepted", NOW);
  const obsolete = { ...expired, version: "obsolete" };

  assert.equal(parseAnalyticsConsent(null, NOW), null);
  assert.equal(parseAnalyticsConsent("not-json", NOW), null);
  assert.equal(
    parseAnalyticsConsent(JSON.stringify(expired), expired.expiresAt),
    null,
  );
  assert.equal(parseAnalyticsConsent(JSON.stringify(obsolete), NOW + 1), null);
});

test("loads analytics only after an explicit accepted preference", () => {
  assert.equal(shouldLoadAnalytics(null), false);
  assert.equal(
    shouldLoadAnalytics(createAnalyticsConsent("rejected", NOW)),
    false,
  );
  assert.equal(
    shouldLoadAnalytics(createAnalyticsConsent("accepted", NOW)),
    true,
  );
});

test("does not pin successfully persisted consent in the current tab", () => {
  const accepted = createAnalyticsConsent("accepted", NOW);

  assert.equal(resolveSessionAnalyticsConsent(accepted, true), null);
  assert.equal(resolveSessionAnalyticsConsent(accepted, false), accepted);
});

test("keeps the Google disable flag active until consent is accepted", () => {
  assert.equal(shouldDisableAnalytics(null), true);
  assert.equal(
    shouldDisableAnalytics(createAnalyticsConsent("rejected", NOW)),
    true,
  );
  assert.equal(
    shouldDisableAnalytics(createAnalyticsConsent("accepted", NOW)),
    false,
  );
});

test("selects Google Analytics cookies without touching unrelated cookies", () => {
  assert.deepEqual(
    getAnalyticsCookieNames(
      "session=abc; _ga=GA1.1.1; _ga_ABC=GS1; theme=dark",
    ),
    ["_ga", "_ga_ABC"],
  );
});

test("uses the consent cookie as a durable fallback before local storage", () => {
  const rejected = JSON.stringify(createAnalyticsConsent("rejected", NOW));
  const accepted = JSON.stringify(createAnalyticsConsent("accepted", NOW));
  const cookie = createAnalyticsConsentCookie(rejected, true);

  assert.match(cookie, new RegExp(`^${ANALYTICS_CONSENT_COOKIE_NAME}=`));
  assert.match(cookie, /Max-Age=31536000/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Secure/);
  assert.equal(resolveAnalyticsConsentValue(cookie, accepted), rejected);
  assert.equal(resolveAnalyticsConsentValue("session=abc", accepted), accepted);
});

test("covers host-only, current-domain, and canonical parent-domain GA cookies", () => {
  assert.deepEqual(getAnalyticsCookieDomains("localhost"), [null]);
  assert.deepEqual(getAnalyticsCookieDomains("faithfulsoftware.dev"), [
    null,
    ".faithfulsoftware.dev",
  ]);
  assert.deepEqual(getAnalyticsCookieDomains("www.faithfulsoftware.dev"), [
    null,
    ".www.faithfulsoftware.dev",
    ".faithfulsoftware.dev",
  ]);
});
