import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { StaffSigningStatus } =
  require("./staff-signing-status") as typeof import("./staff-signing-status");

const preparedApproval: SigningApproval = {
  agreementId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  agreementVersion: 2,
  approvalHash: "b".repeat(64),
  approvedAt: "2026-09-15T10:00:00.000Z",
  completedAt: null,
  completionAttempts: 0,
  completionFailureCode: null,
  createdAt: "2026-09-15T09:00:00.000Z",
  draft: {
    assetsRequired: true,
    billingContact: "alex@northstar.example",
    currency: "GBP",
    documentHash: "c".repeat(64),
    documentReference: "private:signing/example/source.pdf",
    goals: "Create a reliable booking journey.",
    installments: [{ amountPence: "240000", dueDate: "2026-09-15" }],
    lines: [
      {
        description: "Website and booking experience",
        discountPence: "0",
        endDate: null,
        quantity: 1,
        recurrenceMonths: 0,
        serviceCode: "website",
        startDate: "2026-09-15",
        taxPence: "0",
        unitPence: "240000",
      },
    ],
    minimumTermMonths: 0,
    noticeDays: 30,
    requiredDepositPence: "120000",
    responsibilities: "Provide approved assets and one authorised reviewer.",
    scope:
      "Five content pages, booking workflow, confirmation email and handover.",
    signatories: ["alex@northstar.example", "fss@faithful.software"],
    support: "Defect support is included.",
    taxTreatment: "Tax follows the agreement.",
    terms: "The retained agreement is the governing version.",
    title: "Website & booking experience",
  },
  expiresAt: "2026-10-15T10:00:00.000Z",
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  organisationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  organisationLegalName: "Northstar Studio Ltd",
  requiredSigners: ["alex@northstar.example", "fss@faithful.software"],
  revision: 2,
  signatures: [],
  sourceHash: "f".repeat(64),
  status: "approved",
  title: "Website & booking experience",
};

test("shows approval and delivery as separate facts before any signature", () => {
  const html = renderToStaticMarkup(
    <StaffSigningStatus
      approval={preparedApproval}
      downloadBase="/api/portal/admin/clients/example/signing/example"
    />,
  );

  assert.match(html, /Ready for the named signers/);
  assert.match(html, /Signature pending/);
  assert.match(html, /Delivery unknown/);
  assert.match(html, /Approval is not signature/);
  assert.doesNotMatch(html, /Signed and recorded/);
});

test("keeps a founder-review request out of the open signing state", () => {
  const html = renderToStaticMarkup(
    <StaffSigningStatus
      approval={{ ...preparedApproval, approvedAt: null, status: "prepared" }}
      downloadBase="/api/portal/admin/clients/example/signing/example"
    />,
  );

  assert.match(html, /Awaiting FSS approval/);
  assert.match(html, /Not yet open/);
  assert.match(html, /Not started/);
  assert.doesNotMatch(html, /Ready for the named signers/);
});

test("does not describe a cancelled request as awaiting a signature", () => {
  const html = renderToStaticMarkup(
    <StaffSigningStatus
      approval={{ ...preparedApproval, status: "cancelled" }}
      downloadBase="/api/portal/admin/clients/example/signing/example"
    />,
  );

  assert.match(html, /Cancelled/);
  assert.match(html, /No signature retained/);
  assert.doesNotMatch(html, /Signature pending/);
});

test("shows document processing when all required signers have signed", () => {
  const html = renderToStaticMarkup(
    <StaffSigningStatus
      approval={{
        ...preparedApproval,
        requiredSigners: ["alex@northstar.example"],
        signatures: [
          {
            email: "alex@northstar.example",
            typedName: "Alex",
            userId: "user-1",
            signedAt: "2026-10-10T14:09:00.000Z",
          },
        ],
      }}
      downloadBase="/api/portal/admin/clients/example/signing/example"
    />,
  );
  assert.match(html, /Preparing signed copy/);
  assert.doesNotMatch(html, /Signature pending/);
});
