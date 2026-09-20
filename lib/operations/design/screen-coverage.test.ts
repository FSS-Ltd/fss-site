import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCoverageCsv,
  type ScreenCoverageRow,
  validateScreenCoverage,
} from "./screen-coverage";

const manifest = [
  {
    id: "C01",
    role: "Client",
    nav: "Home",
    title: "Client overview",
    primary: "New request",
    route: "/portal",
  },
  {
    id: "F01",
    role: "Founder",
    nav: "Overview",
    title: "Studio overview",
    primary: "Review queue",
    route: "/portal/admin",
  },
] as const;

const completeRows: readonly ScreenCoverageRow[] = [
  {
    screen_id: "C01",
    role: "client",
    surface: "client-overview",
    reference: "docs/design/fss-studio-experience/wireframes/C01.svg",
    route: "/portal",
    scenario: "authorised owner with review ready",
    component: "ClientOverview",
    read_model: "loadClientOverview",
    command_or_event: "create request",
    permission: "portal.request.create",
    desktop_visual: "client overview desktop matches C01",
    mobile_visual: "client overview mobile matches M01",
    functional_test: "components/portal/overview/client-overview.test.tsx",
    phase: "1",
    status: "planned",
  },
  {
    screen_id: "F01",
    role: "founder",
    surface: "studio-overview",
    reference: "docs/design/fss-studio-experience/wireframes/F01.svg",
    route: "/portal/admin",
    scenario: "authorised FSS admin with open delivery queue",
    component: "StudioOverview",
    read_model: "loadStudioOverview",
    command_or_event: "open review queue",
    permission: "requireFssAdmin",
    desktop_visual: "Studio overview desktop matches F01",
    mobile_visual: "Studio overview mobile matches M07",
    functional_test: "components/portal/overview/studio-overview.test.tsx",
    phase: "1",
    status: "planned",
  },
];

test("accepts a complete coverage row for every manifest screen", () => {
  assert.deepEqual(validateScreenCoverage(manifest, completeRows), []);
});

test("reports duplicate IDs and missing required coverage evidence", () => {
  const duplicateRows = [...completeRows, completeRows[0]];
  const missingEvidenceRows = completeRows.map((row) =>
    row.screen_id === "F01" ? { ...row, mobile_visual: "" } : row,
  );

  assert.match(
    validateScreenCoverage(manifest, duplicateRows).join("\n"),
    /C01.*duplicate/,
  );
  assert.match(
    validateScreenCoverage(manifest, missingEvidenceRows).join("\n"),
    /F01.*mobile_visual/,
  );
});

test("rejects CSV rows that do not use the fixed coverage header", () => {
  assert.throws(
    () => parseCoverageCsv("screen_id,role\nC01,client"),
    /fixed header/,
  );
});
