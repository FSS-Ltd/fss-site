import assert from "node:assert/strict";
import test from "node:test";
import {
  selectStudioAttention,
  type StudioOverview,
} from "./studio-overview";

const overview: StudioOverview = {
  agreements: [
    {
      agreementCount: 1,
      draftCount: 1,
      organisationId: "a8e2f019-6ab1-49b2-a396-23bec152c465",
      organisationName: "Northstar Studio",
      signedCount: 0,
    },
  ],
  billing: null,
  delivery: {
    blockedCount: 0,
    items: [
      {
        blocked: false,
        id: "ee01a3ba-fa99-448e-9fd2-47893814a06b",
        nextAction: "Review the booking flow.",
        organisationId: "a8e2f019-6ab1-49b2-a396-23bec152c465",
        organisationName: "Northstar Studio",
        priority: "high",
        reviewReminderTarget: "2026-09-15T09:00:00Z",
        status: "ready_for_review",
        title: "Review booking flow",
      },
    ],
    reviewCount: 1,
  },
  journeys: [
    {
      activeCount: 1,
      journeyCount: 1,
      organisationId: "d5ce45af-aac4-4068-9167-94f0e8aa11da",
      organisationName: "Harbour Foundation",
      recoveryCount: 1,
    },
  ],
  signing: [
    {
      approvalId: "a7c728b9-6525-4463-a190-f821a7a9d467",
      organisationId: "a8e2f019-6ab1-49b2-a396-23bec152c465",
      organisationName: "Northstar Studio",
      status: "prepared",
      title: "Website agreement",
    },
  ],
};

test("orders founder actions without manufacturing queue counts", () => {
  assert.deepEqual(
    selectStudioAttention(overview, new Date("2026-09-20T12:00:00Z")).map(
      (item) => item.kind,
    ),
    ["review", "journey", "signing"],
  );
  assert.match(
    selectStudioAttention(overview, new Date("2026-09-20T12:00:00Z"))[0]
      .title,
    /Overdue review/,
  );
  assert.deepEqual(
    selectStudioAttention(
      {
        agreements: [],
        billing: null,
        delivery: { blockedCount: 0, items: [], reviewCount: 0 },
        journeys: null,
        signing: null,
      },
      new Date("2026-09-20T12:00:00Z"),
    ),
    [],
  );
});
