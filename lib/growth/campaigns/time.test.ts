import assert from "node:assert/strict";
import test from "node:test";
import { campaignMonthAnniversary, campaignSchedulingAnchor } from "./time";

test("only rounds sub-millisecond Resend observations forward", () => {
  const at = new Date("2026-03-29T00:59:59.999Z");
  assert.equal(
    campaignSchedulingAnchor(
      at,
      "resend_fss_delivery_observed",
      true,
    ).toISOString(),
    "2026-03-29T01:00:00.000Z",
  );
  assert.equal(
    campaignSchedulingAnchor(
      at,
      "resend_fss_delivery_observed",
      false,
    ).toISOString(),
    at.toISOString(),
  );
  assert.equal(
    campaignSchedulingAnchor(at, "gmail_fss_sent_observed", true).toISOString(),
    at.toISOString(),
  );
  assert.equal(
    campaignMonthAnniversary(
      campaignSchedulingAnchor(at, "resend_fss_delivery_observed", true),
    ).toISOString(),
    "2026-04-29T01:00:00.000Z",
  );
});

test("rounds at a London date boundary before computing its month anniversary", () => {
  const at = new Date("2026-01-31T23:59:59.999Z");
  assert.equal(
    campaignMonthAnniversary(
      campaignSchedulingAnchor(at, "resend_fss_delivery_observed", true),
    ).toISOString(),
    "2026-03-01T00:00:00.000Z",
  );
  assert.equal(
    campaignMonthAnniversary(
      campaignSchedulingAnchor(at, "gmail_fss_sent_observed", false),
    ).toISOString(),
    "2026-02-28T23:59:59.999Z",
  );
});
