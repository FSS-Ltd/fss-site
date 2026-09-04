import assert from "node:assert/strict";
import test from "node:test";
import { createAnalyticsConsent } from "./consent";
import { contactEvent } from "./contact-events";

test("contact analytics are suppressed without current affirmative consent", () => {
  assert.equal(contactEvent(null), null);
  assert.equal(
    contactEvent(JSON.stringify(createAnalyticsConsent("rejected"))),
    null,
  );
  assert.equal(
    contactEvent(JSON.stringify(createAnalyticsConsent("accepted", 0))),
    null,
  );
});

test("consented contact analytics contain only the event and route context", () => {
  assert.deepEqual(
    contactEvent(JSON.stringify(createAnalyticsConsent("accepted"))),
    {
      name: "generate_lead",
      parameters: {
        source_context: "contact-page-v2",
        source_path: "/contact",
      },
    },
  );
});
