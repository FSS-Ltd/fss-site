import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { agreementDraft } from "@/lib/operations/agreements/fixtures";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import type { AgreementRecord } from "@/lib/operations/agreements/types";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { StaffAgreementDetail } = require("./staff-agreement-detail") as typeof import("./staff-agreement-detail");
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime") as typeof import("next/dist/shared/lib/app-router-context.shared-runtime");

const router: AppRouterInstance = {
  back: () => undefined,
  bfcacheId: "test-router",
  forward: () => undefined,
  prefetch: () => undefined,
  push: () => undefined,
  refresh: () => undefined,
  replace: () => undefined,
};

function renderDetail(children: React.ReactNode): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      {children}
    </AppRouterContext.Provider>,
  );
}

const record: AgreementRecord = {
  draft: agreementDraft(),
  engagementId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  evidence: null,
  evidenceProvenance: "authenticated_portal_electronic_signature",
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  revision: 2,
  services: [],
  status: "signed",
  version: 3,
};

const completedApproval: SigningApproval = {
  agreementId: record.id,
  agreementVersion: record.version,
  approvalHash: "b".repeat(64),
  approvedAt: "2026-09-15T10:00:00.000Z",
  completedAt: "2026-09-15T11:25:00.000Z",
  createdAt: "2026-09-15T09:00:00.000Z",
  draft: record.draft,
  expiresAt: "2026-10-15T10:00:00.000Z",
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  organisationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  organisationLegalName: "Northstar Studio Ltd",
  requiredSigners: ["client@example.test", "founder@example.test"],
  revision: record.revision,
  signatures: [
    {
      email: "client@example.test",
      signedAt: "2026-09-15T11:24:00.000Z",
      typedName: "Alex Morgan",
      userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    },
    {
      email: "founder@example.test",
      signedAt: "2026-09-15T11:25:00.000Z",
      typedName: "FSS authorised signer",
      userId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    },
  ],
  sourceHash: "c".repeat(64),
  status: "completed",
  title: record.draft.title,
};

test("shows retained electronic signer evidence only from the completed signing record", () => {
  const html = renderDetail(
    <StaffAgreementDetail
      organisationId={completedApproval.organisationId}
      record={record}
      signingApproval={completedApproval}
      signingDownloadBase="/api/portal/admin/clients/example/signing/example"
    />,
  );

  assert.match(html, /Both signatures are complete/);
  assert.match(html, /Alex Morgan/);
  assert.match(html, /FSS authorised signer/);
  assert.match(html, /Retained signed document/);
});

test("gives an unsigned Studio agreement the authenticated signing preparation command", () => {
  const html = renderDetail(
    <StaffAgreementDetail
      organisationId={completedApproval.organisationId}
      record={{ ...record, status: "draft", version: 2 }}
      signingCommandEndpoint="/api/portal/admin/clients/example/signing"
      signingSuccessRedirect="/portal/admin/clients/example/signing"
    />,
  );

  assert.match(html, /Prepare signing document/);
  assert.match(html, /Prepare a frozen PDF from this revision/);
  assert.doesNotMatch(html, /Both signatures are complete/);
});
