import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { facebookSourceCommand } from "./facebook-source-values";

const requestId = "c6f090d1-15d0-4018-a4f2-9716ff54ec9a";
function values() {
  const data = new FormData();
  data.set("sourceUrl", "https://www.facebook.com/example");
  data.set("businessName", "Example Business");
  data.set("countryCode", "GB");
  data.set("opportunity", "Website needs review");
  data.set("offer", "Website review");
  data.set("observedAt", "2026-11-20T10:00");
  return data;
}

test("Facebook capture records source and leaves unknown registration and contact null", () => {
  const command = facebookSourceCommand(values(), requestId);
  assert.equal(command.kind, "capture_source");
  assert.equal(command.sourceType, "facebook_page");
  assert.equal(command.sourceUrl, "https://www.facebook.com/example");
  assert.equal(command.businessName, "Example Business");
  assert.equal(command.registrationNumber, null);
  assert.equal(command.corporateType, null);
  assert.equal(command.email, null);
  assert.equal(command.opportunity, "Website needs review");
  assert.equal(command.offer, "Website review");
  assert.equal(
    command.observedAt.toISOString(),
    new Date("2026-11-20T10:00").toISOString(),
  );
});

test("Facebook capture rejects a non-Facebook source", () => {
  const data = values();
  data.set("sourceUrl", "https://example.com/page");
  assert.throws(
    () => facebookSourceCommand(data, requestId),
    (error: unknown) => {
      assert.ok(error instanceof z.ZodError);
      assert.equal(error.issues[0].path[0], "sourceUrl");
      return true;
    },
  );
});
