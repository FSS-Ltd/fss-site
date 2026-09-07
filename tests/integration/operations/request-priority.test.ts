import { withAgreementTransaction } from "../../../lib/operations/agreements/repository";
import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import {
  createPortalRequest,
  executeFounderRequestCommand,
  executePortalRequestCommand,
} from "../../../lib/operations/requests/service";
import {
  getFounderRequest,
  getPortalRequest,
  listFounderRequests,
} from "../../../lib/operations/requests/repository";
import { withPortalTransaction } from "../../../lib/operations/db/portal-client";
import { RequestConflict } from "../../../lib/operations/requests/types";
import { deliveryFounder } from "./project-document-fixtures";
import {
  newRequest,
  requestFixture,
  removeRequestFixture,
} from "./request-fixtures";
const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);
test("only founder controls priority; edits are audited, versioned and do not notify clients", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 1,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  try {
    const a = await createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      newRequest(f.projectId),
      f.correlationId,
    );
    const b = await createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      newRequest(f.projectId),
      f.correlationId,
    );
    const read = () =>
      getFounderRequest(
        founder,
        deliveryFounder,
        f.organisationId,
        b.id,
        f.correlationId,
      );
    assert.equal((await read())?.priority, "normal");
    const command = {
      action: "set_priority",
      requestId: b.id,
      expectedVersion: 1,
      priority: "urgent",
    };
    await assert.rejects(() =>
      executePortalRequestCommand(
        portal,
        f.identity,
        f.organisationId,
        command,
        f.correlationId,
      ),
    );
    await assert.rejects(() =>
      withPortalTransaction(
        portal,
        f.identity,
        f.organisationId,
        f.correlationId,
        (tx) =>
          tx`update operations.requests set priority='urgent' where id=${a.id}`,
      ),
    );
    await assert.rejects(() =>
      withPortalTransaction(
        portal,
        f.identity,
        f.organisationId,
        f.correlationId,
        (tx) => tx`select priority from operations.requests where id=${a.id}`,
      ),
    );
    await executeFounderRequestCommand(
      founder,
      deliveryFounder,
      f.organisationId,
      command,
      f.correlationId,
    );
    await assert.rejects(
      () =>
        executeFounderRequestCommand(
          founder,
          deliveryFounder,
          f.organisationId,
          command,
          f.correlationId,
        ),
      RequestConflict,
    );
    assert.equal((await read())?.priority, "urgent");
    assert.equal((await read())?.version, 2);
    assert.equal(
      "priority" in
        ((await getPortalRequest(
          portal,
          f.identity,
          f.organisationId,
          b.id,
          f.correlationId,
        )) ?? {}),
      false,
    );
    assert.equal(
      (
        await listFounderRequests(
          founder,
          deliveryFounder,
          f.organisationId,
          f.correlationId,
        )
      )[0].id,
      b.id,
    );
    await withAgreementTransaction(founder, deliveryFounder, async (tx) => {
      await tx`select set_config('operations.correlation_id',${f.correlationId},true)`;
      await tx`update operations.requests set acknowledgement_target=now()-interval '1 hour',version=version+1 where id=${a.id} and organisation_id=${f.organisationId}`;
    });
    assert.equal(
      (
        await listFounderRequests(
          founder,
          deliveryFounder,
          f.organisationId,
          f.correlationId,
        )
      )[0].id,
      a.id,
    );
    const events =
      await admin`select kind from operations.request_notification_outbox where request_id=${b.id}`;
    assert.deepEqual(
      events.map((row) => row.kind),
      ["request_received"],
    );
    const audit =
      await admin`select action,reason from operations.request_history where request_id=${b.id} and action='set_priority'`;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].reason, "normal -> urgent");
  } finally {
    try {
      await removeRequestFixture(admin, f);
    } finally {
      await Promise.all([admin.end(), founder.end(), portal.end()]);
    }
  }
});
