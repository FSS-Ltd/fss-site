import assert from "node:assert/strict";
import test from "node:test";
import {
  organisationOnboardingSchema,
  pendingPortalInvitationSchema,
} from "./pending-invitations";

test("pending client invitations normalize email and reject organisation input", () => {
  assert.deepEqual(
    pendingPortalInvitationSchema.parse({
      name: " Client Owner ",
      email: " OWNER@EXAMPLE.TEST ",
      role: "owner",
      reviewReference: " approved by founder ",
    }),
    {
      name: "Client Owner",
      email: "owner@example.test",
      role: "owner",
      reviewReference: "approved by founder",
    },
  );
  assert.equal(
    pendingPortalInvitationSchema.safeParse({
      organisationId: "8aa24c0b-3665-4fd4-8694-500675c943c3",
      name: "Client Owner",
      email: "owner@example.test",
      role: "owner",
      reviewReference: "approved",
    }).success,
    false,
  );
});

test("organisation onboarding requires bounded names and a timezone", () => {
  assert.deepEqual(
    organisationOnboardingSchema.parse({
      legalName: " Client Limited ",
      displayName: " Client ",
      timezone: " Europe/London ",
    }),
    {
      legalName: "Client Limited",
      displayName: "Client",
      timezone: "Europe/London",
    },
  );
  assert.equal(
    organisationOnboardingSchema.safeParse({
      legalName: "",
      displayName: "Client",
      timezone: "Europe/London",
    }).success,
    false,
  );
});
