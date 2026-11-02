import assert from "node:assert/strict";
import test from "node:test";
import { extendStaffAgreementSigning } from "./signing-service";
import { AgreementConflict } from "./types";
import type { OperationsDb } from "../db/client";
import type { FssAdminContext } from "../auth/staff-types";

const org = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const approvalId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const correlation = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
// Commands are validated before any database access.
const db = {} as OperationsDb;
const admin = {} as FssAdminContext;

for (const days of [0, -7, 91, 21]) {
  test(`signing extension rejects a ${days}-day window`, async () => {
    await assert.rejects(
      extendStaffAgreementSigning(db, admin, org, { approvalId, days }, correlation),
      (error) =>
        error instanceof AgreementConflict &&
        /within 90 days/.test(error.message),
    );
  });
}

test("signing extension rejects malformed commands", async () => {
  for (const raw of [
    { approvalId: "not-a-uuid", days: 14 },
    { approvalId, days: 14.5 },
    { approvalId, expiresAt: "2026-12-01T00:00:00.000Z" },
  ])
    await assert.rejects(
      extendStaffAgreementSigning(db, admin, org, raw, correlation),
    );
});
