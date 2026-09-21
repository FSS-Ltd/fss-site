import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { readPortalProfile } from "../../../lib/operations/auth/user-profile";
import { createPortalSupportRequest } from "../../../lib/operations/support/client-support";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import {
  createDeliveryFixture,
  removeDeliveryFixture,
} from "./project-document-fixtures";

const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);

test("portal support is idempotent, tenant-scoped, and independent from billing", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const first = await createDeliveryFixture(admin, founder);
  const second = await createDeliveryFixture(admin, founder);
  const command = {
    category: "project_question",
    idempotencyKey: randomUUID(),
    message: "Please confirm the next review date.",
    subject: "Review date",
  } as const;

  try {
    const receipt = await createPortalSupportRequest(
      portal,
      first.identity,
      first.organisationId,
      first.correlationId,
      command,
    );
    assert.match(receipt.reference, /^FSS-SUP-[A-F0-9]{32}$/);
    assert.deepEqual(
      await createPortalSupportRequest(
        portal,
        first.identity,
        first.organisationId,
        first.correlationId,
        command,
      ),
      receipt,
    );
    await assert.rejects(
      createPortalSupportRequest(
        portal,
        first.identity,
        second.organisationId,
        first.correlationId,
        { ...command, idempotencyKey: randomUUID() },
      ),
    );
    await assert.rejects(
      readPortalProfile(
        portal,
        first.identity,
        second.organisationId,
        first.correlationId,
      ),
    );
    const profile = await readPortalProfile(
      portal,
      first.identity,
      first.organisationId,
      first.correlationId,
    );
    assert.equal(profile.email, first.identity.email);
    assert.equal(profile.organisationName, "Delivery Test");
    const [counts] = await admin<
      { billingCommands: number; supportRequests: number }[]
    >`
      select
        (select count(*)::integer from operations.portal_support_requests where id = ${receipt.id}) as "supportRequests",
        (select count(*)::integer from operations.billing_commands where organisation_id = ${first.organisationId}) as "billingCommands"
    `;
    assert.deepEqual(counts, { billingCommands: 0, supportRequests: 1 });
  } finally {
    await admin`delete from operations.portal_support_requests where organisation_id in (${first.organisationId}, ${second.organisationId})`;
    await removeDeliveryFixture(admin, first);
    await removeDeliveryFixture(admin, second);
    await Promise.all([admin.end(), founder.end(), portal.end()]);
  }
});
