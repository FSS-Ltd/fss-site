import assert from "node:assert/strict";
import test from "node:test";
import { createStaffAgreementDraftRouteHandler } from "./staff-agreement-draft-route";

const origin = "https://portal.example.test";
const organisationId = "44444444-4444-4444-8444-444444444444";

test("staff agreement draft route binds a save to the organisation selected by the URL", async () => {
  let executedOrganisationId: string | null = null;
  const handler = createStaffAgreementDraftRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async (_admin, selectedOrganisationId, input) => {
      executedOrganisationId = selectedOrganisationId;
      return {
        content: input,
        id: "55555555-5555-4555-8555-555555555555",
        step: "link" as const,
        version: 1,
      };
    },
    origin,
    reportUnexpectedError: () => undefined,
  });

  const response = await handler(
    new Request(
      `https://portal.example.test/api/portal/admin/clients/${organisationId}/agreement-drafts`,
      {
        body: JSON.stringify({
          action: "save",
          content: {},
          draftId: "55555555-5555-4555-8555-555555555555",
          expectedVersion: 0,
          step: "link",
        }),
        headers: { "content-type": "application/json", origin },
        method: "POST",
      },
    ),
    organisationId,
  );

  assert.equal(response.status, 200);
  assert.equal(executedOrganisationId, organisationId);
  assert.deepEqual(await response.json(), {
    content: {
      action: "save",
      content: {},
      draftId: "55555555-5555-4555-8555-555555555555",
      expectedVersion: 0,
      step: "link",
    },
    id: "55555555-5555-4555-8555-555555555555",
    step: "link",
    version: 1,
  });
});
