import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { loadStaffJourneyRecovery } from "./queries";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};

function recoveryDb(row: Record<string, unknown>): OperationsDb {
  const query = async (parts: TemplateStringsArray) => {
    const sql = parts.join("?");
    if (sql.includes("set_config") || sql.includes("assert_active")) return [];
    return [row];
  };
  return {
    begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
      run(query as unknown as OperationsTransaction),
  } as unknown as OperationsDb;
}

test("derives blocked checks from the saved server draft rather than browser state", async () => {
  const recovery = await loadStaffJourneyRecovery(
    recoveryDb({
      agreementStatus: "draft",
      agreementVersion: 3,
      contactAvailable: true,
      draftId: "44444444-4444-4444-8444-444444444444",
      existingJourney: false,
      expectedAgreementVersion: 2,
      organisationId: "55555555-5555-4555-8555-555555555555",
      organisationName: "Northstar Studio",
      recipientRole: "owner",
      templateVersionAvailable: true,
      updatedAt: "2026-09-21T10:00:00.000Z",
    }),
    admin,
    {
      billingConfigured: true,
      senderConfigured: false,
      signingConfigured: true,
    },
  );

  assert.equal(recovery?.canStart, false);
  assert.deepEqual(recovery?.checks.find((check) => check.id === "agreement"), {
    href: "/portal/admin/agreements",
    id: "agreement",
    reason: "Refresh the current agreement before starting this journey.",
    status: "needs_action",
  });
  assert.equal(recovery?.checks.find((check) => check.id === "sender")?.status, "needs_action");
});
