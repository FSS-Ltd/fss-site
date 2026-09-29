import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { StudioOverview as StudioOverviewData } from "@/lib/operations/overview/studio-overview";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { StudioOverview } =
  require("./studio-overview") as typeof import("./studio-overview");

const overview: StudioOverviewData = {
  agreements: [
    {
      agreementCount: 1,
      draftCount: 1,
      organisationId: "e96ea1ca-5e3a-41ae-a3e7-097c09c45e98",
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
        id: "6b4bc3db-3a94-4c80-85ca-106b460fcf6e",
        nextAction: "Review the booking flow.",
        organisationId: "e96ea1ca-5e3a-41ae-a3e7-097c09c45e98",
        organisationName: "Northstar Studio",
        priority: "high",
        reviewReminderTarget: "2026-09-15T09:00:00Z",
        status: "ready_for_review",
        title: "Review booking flow",
      },
      {
        blocked: false,
        id: "c4562797-1eb2-47bf-98a8-0636a829ac0b",
        nextAction: "Continue implementation.",
        organisationId: "e96ea1ca-5e3a-41ae-a3e7-097c09c45e98",
        organisationName: "Northstar Studio",
        priority: "normal",
        reviewReminderTarget: null,
        status: "in_progress",
        title: "Build booking integration",
      },
    ],
    reviewCount: 1,
  },
  journeys: [
    {
      activeCount: 1,
      journeyCount: 1,
      organisationId: "5099a29e-835f-4df0-928d-603455fd33e4",
      organisationName: "Harbour Foundation",
      recoveryCount: 1,
    },
  ],
  signing: [
    {
      approvalId: "06b9d5fa-1f9d-4c53-b963-1edb5d134d9c",
      organisationId: "e96ea1ca-5e3a-41ae-a3e7-097c09c45e98",
      organisationName: "Northstar Studio",
      status: "prepared",
      title: "Website agreement",
    },
  ],
};

test("renders the Studio action queue without client navigation controls", () => {
  const html = renderToStaticMarkup(
    <StudioOverview
      asOf={new Date("2026-09-20T12:00:00Z")}
      overview={overview}
    />,
  );

  assert.match(html, /Needs your attention/);
  assert.match(html, /Overdue review: Review booking flow/);
  assert.match(html, /View queue/);
  assert.match(html, /Build booking integration/);
  assert.equal((html.match(/Review booking flow/g) ?? []).length, 1);
  assert.match(html, /href="\/admin\/delivery\?status=ready_for_review"/);
  assert.doesNotMatch(html, /Choose your workspace|Your Studio workspace/);
});
