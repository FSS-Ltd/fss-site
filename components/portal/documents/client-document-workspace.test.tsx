import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ClientProject } from "@/lib/operations/projects/types";
import type { ClientDocumentDetail } from "@/lib/operations/documents/types";
import type { PortalWorkspaceDocument } from "@/lib/operations/workspaces/types";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { ClientDocumentWorkspace } =
  require("./client-document-workspace") as typeof import("./client-document-workspace");
const { ClientDocumentDetail } =
  require("./client-document-detail") as typeof import("./client-document-detail");
const { ClientProjectList } =
  require("../projects/client-project-list") as typeof import("../projects/client-project-list");
const { ClientProjectDetail } =
  require("../projects/client-project-detail") as typeof import("../projects/client-project-detail");

const organisationId = "f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55";

const activeProject: ClientProject = {
  agreementId: "34f0b2d6-ae1d-4f3a-b714-b3003e417488",
  deliverables: ["Booking flow"],
  id: "584a707c-7072-4f5a-92d0-5b1447f05db5",
  outcome: "A simpler route from enquiry to booking.",
  ownerDisplay: "Jean-Fidele",
  scheduleDependencies: [],
  scheduleEvidence: null,
  status: "active",
  summary: "Design is ready for your review.",
  targetDate: "2026-09-24",
  title: "Website & booking experience",
};

const completedProject: ClientProject = {
  ...activeProject,
  id: "103c1298-2491-4604-94f0-dd64f07a1bcf",
  status: "completed",
  title: "Brand landing page",
};

const document: PortalWorkspaceDocument = {
  filename: "booking-flow-v3.pdf",
  id: "ef6d8da1-2921-4e25-a213-23b20af2bb6c",
  kind: "file",
  mimeType: "application/pdf",
  projectId: activeProject.id,
  projectTitle: activeProject.title,
  sizeBytes: 2048,
  title: "Booking flow · v3",
};

const documentDetail: ClientDocumentDetail = {
  ...document,
  createdAt: "2026-09-15T10:00:00.000Z",
  expiresAt: null,
  projectTitle: activeProject.title,
  version: 3,
};

test("separates current project work from completed handovers", () => {
  const html = renderToStaticMarkup(
    <ClientProjectList
      organisationId={organisationId}
      projects={[activeProject, completedProject]}
    />,
  );

  assert.match(html, /Active work/);
  assert.match(html, /Completed work/);
  assert.match(html, /Website &amp; booking experience/);
  assert.match(html, /Brand landing page/);
});

test("keeps document upload unavailable until scanning is configured", () => {
  const html = renderToStaticMarkup(
    <ClientDocumentWorkspace
      documents={[document]}
      organisationId={organisationId}
      uploadConfiguration={{
        enabled: false,
        reason:
          "Uploads are unavailable until an approved malware scanner is configured.",
      }}
    />,
  );

  assert.match(
    html,
    /Uploads are unavailable until an approved malware scanner is configured/,
  );
  assert.match(html, /Your documents/);
  assert.doesNotMatch(html, /type="file"/);
});

test("gives setup a single project recovery state until FSS shares work", () => {
  const html = renderToStaticMarkup(
    <ClientProjectList organisationId={organisationId} projects={[]} />,
  );

  assert.match(html, /No projects are shared with your workspace yet/);
  assert.doesNotMatch(html, /Completed work/);
});

test("keeps the project workspace scoped to its outcome, milestones and next actions", () => {
  const html = renderToStaticMarkup(
    <ClientProjectDetail
      documents={[document]}
      organisationId={organisationId}
      project={{
        ...activeProject,
        milestones: [
          {
            evidence: null,
            id: "ff6b1d0f-2d90-4a11-b01d-6b1a16f1bd39",
            ownerDisplay: "Jean-Fidele",
            status: "waiting_for_you",
            summary: "Booking flow ready for your review.",
            targetDate: "2026-09-24",
            title: "Design",
          },
        ],
      }}
    />,
  );

  assert.match(html, /A simpler route from enquiry to booking/);
  assert.match(html, /Booking flow ready for your review/);
  assert.match(html, /New request/);
});

test("presents only safe document metadata and an authenticated action", () => {
  const html = renderToStaticMarkup(
    <ClientDocumentDetail
      document={documentDetail}
      organisationId={organisationId}
    />,
  );

  assert.match(html, /Version 3/);
  assert.match(html, /15 Sept 2026/);
  assert.match(html, /Download file/);
  assert.doesNotMatch(
    html,
    /objectKey|contentHash|scanEvidence|reviewReference/,
  );
});
