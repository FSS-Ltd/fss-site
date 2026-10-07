import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { ClientSigningReview } =
  require("./client-signing-review") as typeof import("./client-signing-review");
const { AppRouterContext } =
  require("next/dist/shared/lib/app-router-context.shared-runtime") as typeof import("next/dist/shared/lib/app-router-context.shared-runtime");

const router: AppRouterInstance = {
  back: () => undefined,
  bfcacheId: "test-router",
  forward: () => undefined,
  prefetch: () => undefined,
  push: () => undefined,
  refresh: () => undefined,
  replace: () => undefined,
};

function renderReview(children: React.ReactNode): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      {children}
    </AppRouterContext.Provider>,
  );
}

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
    signatories: ["alex@northstar.example"],
    support: "Defect support is included.",
    taxTreatment: "Tax follows the agreement.",
    terms: "The retained agreement is the governing version.",
    title: "Website & booking experience",
  },
  expiresAt: "2026-10-15T10:00:00.000Z",
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  organisationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  organisationLegalName: "Northstar Studio Ltd",
  requiredSigners: ["alex@northstar.example"],
  revision: 2,
  signatures: [],
  sourceHash: "f".repeat(64),
  status: "approved",
  title: "Website & booking experience",
};

test("binds the signer to the exact approved revision", () => {
  const html = renderReview(
    <ClientSigningReview
      approval={approval}
      email="alex@northstar.example"
      organisationId={approval.organisationId}
      signerName="Alex Morgan"
    />,
  );

  assert.match(html, /Signing as Alex Morgan/);
  assert.match(html, /Agreement revision 2/);
  assert.match(html, /Full legal name/);
  assert.match(html, /Role \/ position/);
  assert.match(html, /Confirm your agreement/);
  assert.match(html, /Sign agreement/);
  assert.doesNotMatch(html, /Sign agreement[\s\S]*Revision 1/);
});

test("does not render an open signing form after the signer has signed", () => {
  const html = renderReview(
    <ClientSigningReview
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
      signerName="Alex Morgan"
    />,
  );

  assert.match(html, /Preparing your signed agreement/);
  assert.doesNotMatch(html, /<button[^>]*>Sign agreement/);
});
