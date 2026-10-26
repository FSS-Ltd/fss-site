import assert from "node:assert/strict";
import test from "node:test";
import { sourcedContact } from "./contact-form-values";
import { crmValidationFeedback } from "../../../lib/growth/crm/validation-feedback";

test("invalid contact provenance highlights the contact source rather than the business source", () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    firstName: "Ada",
    lastName: "Demo",
    email: "ada@example.test",
    emailSource: "https://user:password@example.test",
    verifiedAt: "2026-10-25T12:00",
    lawfulBasis: "legitimate_interests",
  }))
    data.set(key, value);
  assert.throws(
    () => sourcedContact(data),
    (error: unknown) =>
      crmValidationFeedback(error).fieldErrors?.[0]?.name === "emailSource",
  );
});
