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

const { ClientAgreementList } = require("./client-agreement-list") as typeof import("./client-agreement-list");
const { ClientAgreementDetail } = require("./client-agreement-detail") as typeof import("./client-agreement-detail");

const approval: SigningApproval = {
  agreementId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  agreementVersion: 2,
  approvalHash: "b".repeat(64),
  approvedAt: "2026-09-15T10:00:00.000Z",
  completedAt: null,
  createdAt: "2026-09-15T09:00:00.000Z",
  draft: {
    assetsRequired: true,
    billingContact: "alex@northstar.example",
    currency: "GBP",
    documentHash: "c".repeat(64),
    documentReference: "private:signing/example/source.pdf",
    goals: "Create a reliable booking journey.",
    installments: [
      { amountPence: "120000", dueDate: "2026-09-15" },
      { amountPence: "120000", dueDate: "2026-10-15" },
    ],
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
    scope: "Five content pages, booking workflow, confirmation email and handover.",
    signatories: ["alex@northstar.example", "fss@faithful.software"],
    support: "Defect support is included. Additional scope needs a separate quote.",
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

test("separates agreements needing a signature from signed records", () => {
  const html = renderToStaticMarkup(
    <ClientAgreementList
      approvals={[approval]}
      organisationId={approval.organisationId}
    />,
  );

  assert.match(html, /Action needed/);
  assert.match(html, /Signed agreements/);
  assert.match(html, /Review agreement/);
});

test("renders the exact agreement summary and routes the signer to its revision", () => {
  const html = renderToStaticMarkup(
    <ClientAgreementDetail
      approval={approval}
      email="alex@northstar.example"
      organisationId={approval.organisationId}
    />,
  );

  assert.match(html, /Revision 2/);
  assert.match(html, /What we will deliver/);
  assert.match(html, /Continue to signing/);
  assert.match(html, /Download agreement PDF/);
  assert.doesNotMatch(html, /All required parties have signed this agreement/);
});

test("does not show an all-parties-signed result for a partial signature", () => {
  const html = renderToStaticMarkup(
    <ClientAgreementDetail
      approval={{
        ...approval,
        signatures: [
          {
            email: "alex@northstar.example",
            signedAt: "2026-09-15T11:24:00.000Z",
            typedName: "Alex Morgan",
            userId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          },
        ],
      }}
      email="alex@northstar.example"
      organisationId={approval.organisationId}
    />,
  );

  assert.match(html, /Your signature is recorded, awaiting the remaining signers/);
  assert.doesNotMatch(html, /All required parties have signed this agreement/);
});

test("shows the signed result only after every required signature is retained", () => {
  const html = renderToStaticMarkup(
    <ClientAgreementDetail
      approval={{
        ...approval,
        completedAt: "2026-09-15T11:25:00.000Z",
        signatures: [
          {
            email: "alex@northstar.example",
            signedAt: "2026-09-15T11:24:00.000Z",
            typedName: "Alex Morgan",
            userId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          },
          {
            email: "fss@faithful.software",
            signedAt: "2026-09-15T11:25:00.000Z",
            typedName: "FSS authorised signer",
            userId: "11111111-1111-4111-8111-111111111111",
          },
        ],
        status: "completed",
      }}
      email="alex@northstar.example"
      organisationId={approval.organisationId}
    />,
  );

  assert.match(html, /Your signed agreement is ready/);
  assert.match(html, /All required parties have signed this agreement/);
  assert.match(html, /Download signed agreement/);
  assert.match(html, /Your record/);
  assert.match(html, /Alex Morgan/);
  assert.match(html, /FSS authorised signer/);
  assert.match(html, /Retained copy/);
});
