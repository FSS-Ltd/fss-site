import assert from "node:assert/strict";
import test from "node:test";
import { getClientSetupChecklist } from "../../../lib/operations/onboarding/client-checklist";
import { onboardingFixture } from "./onboarding-fixtures";

test("client setup checklist exposes only evidence-derived state to the authorised workspace", async (t) => {
  const fixture = await onboardingFixture(t, 1);
  const checklist = await getClientSetupChecklist(
    fixture.portal,
    fixture.identities[0],
    fixture.organisationId,
    fixture.correlationId,
  );
  assert.deepEqual(checklist, {
    agreementSigned: false,
    billingReady: false,
    filesReady: false,
    serviceReady: false,
  });
  await assert.rejects(
    getClientSetupChecklist(
      fixture.portal,
      fixture.identities[0],
      "00000000-0000-4000-8000-000000000001",
      fixture.correlationId,
    ),
  );
});
