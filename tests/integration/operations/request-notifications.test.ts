import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { requireOperationsTestDatabaseUrl } from "../../../scripts/require-operations-database-env";
import {
  activateRequestAgreement,
  newRequest,
  requestFixture,
  removeRequestFixture,
} from "./request-fixtures";
import { createPortalRequest } from "../../../lib/operations/requests/service";
import { dispatchRequestNotifications } from "../../../lib/operations/requests/notifications";
import { withPortalTransaction } from "../../../lib/operations/db/portal-client";

const url = requireOperationsTestDatabaseUrl(
  process.env.OPERATIONS_TEST_DATABASE_URL,
);

test("request outbox events fan out to members with owner email records, idempotently", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  try {
    const request = await createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      newRequest(f.projectId),
      f.correlationId,
    );
    const outbox = await admin<
      { id: string; kind: string; consumedAt: Date | null }[]
    >`select id, kind, consumed_at as "consumedAt" from operations.request_notification_outbox where request_id = ${request.id}`;
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].kind, "request_received");
    assert.equal(outbox[0].consumedAt, null);

    // First pass fans out and queues nothing for non-email kinds.
    const summary = await dispatchRequestNotifications(founder, {
      sender: async () => ({
        status: "succeeded",
        receipt: { providerId: "re_test", acceptedAt: new Date().toISOString() },
      }),
    });
    assert.equal(summary.fannedOut, 1);
    assert.equal(summary.emailsClaimed, 0);

    const [outboxAfter] = await admin<
      { consumedAt: Date | null }[]
    >`select consumed_at as "consumedAt" from operations.request_notification_outbox where id = ${outbox[0].id}`;
    assert.ok(outboxAfter.consumedAt);

    const notifications = await admin<
      { userId: string; kind: string; title: string }[]
    >`select user_id as "userId", kind, title from operations.request_notifications where request_id = ${request.id}`;
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].userId, f.identity.userId);
    assert.equal(notifications[0].kind, "request_received");
    assert.ok(notifications[0].title.length > 0);

    // A repeat pass must not duplicate anything.
    const repeat = await dispatchRequestNotifications(founder, {
      sender: async () => ({
        status: "succeeded",
        receipt: { providerId: "re_test", acceptedAt: new Date().toISOString() },
      }),
    });
    assert.equal(repeat.fannedOut, 0);
    assert.equal(repeat.emailsClaimed, 0);
    const notificationCount = await admin<
      { count: number }[]
    >`select count(*)::int as count from operations.request_notifications where request_id = ${request.id}`;
    assert.equal(notificationCount[0].count, 1);

    // Portal members read only their own notifications.
    const visible = await withPortalTransaction(
      portal,
      f.identity,
      f.organisationId,
      f.correlationId,
      async (tx) =>
        tx<{ id: string }[]>`select id from operations.request_notifications where user_id = ${f.identity.userId}`,
    );
    assert.equal(visible.length, 1);
  } finally {
    await removeRequestFixture(admin, f);
    await admin.end();
    await founder.end();
    await portal.end();
  }
});

test("request notifications exclude billing-only contacts", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  try {
    const request = await createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      newRequest(f.projectId),
      f.correlationId,
    );
    await admin`update operations.memberships set role = 'billing_contact'
      where organisation_id = ${f.organisationId} and user_id = ${f.identity.userId}`;

    const summary = await dispatchRequestNotifications(founder);
    assert.equal(summary.fannedOut, 1);
    const notifications = await admin<{ count: number }[]>`
      select count(*)::int as count from operations.request_notifications
      where request_id = ${request.id}`;
    assert.equal(notifications[0].count, 0);
    const visible = await withPortalTransaction(
      portal,
      f.identity,
      f.organisationId,
      f.correlationId,
      (tx) =>
        tx<{ id: string }[]>`
          select id from operations.request_notifications
          where request_id = ${request.id}`,
    );
    assert.equal(visible.length, 0);
  } finally {
    await removeRequestFixture(admin, f);
    await admin.end();
    await founder.end();
    await portal.end();
  }
});

test("review publication queues an owner email delivery and the dispatcher completes it", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  try {
    await activateRequestAgreement(founder, f);
    const request = await createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      newRequest(f.projectId),
      f.correlationId,
    );
    // Drive the request to ready_for_review through the founder engine.
    const { executeFounderRequestCommand } = await import(
      "../../../lib/operations/requests/service"
    );
    const run = (raw: Record<string, unknown>) =>
      executeFounderRequestCommand(
        founder,
        { actorId: "d".repeat(64) },
        f.organisationId,
        { requestId: request.id, ...raw },
        f.correlationId,
      );
    await run({
      action: "acknowledge",
      expectedVersion: request.version,
      ownerDisplay: "FSS",
      scope: "included",
      scopeReason: "",
    });
    await run({
      action: "plan",
      expectedVersion: request.version + 1,
      nextAction: "Prepare",
      targetDate: null,
      agreementId: null,
    });
    await run({
      action: "start",
      expectedVersion: request.version + 2,
      capacityOverrideReason: "",
    });
    await run({
      action: "review",
      expectedVersion: request.version + 3,
      deliverableVersion: "v1",
      reviewInstructions: "Check the document",
      publicSummary: "First deliverable",
      documentIds: [],
    });
    const review = await dispatchRequestNotifications(founder, {
      sender: async () => ({
        status: "succeeded",
        receipt: { providerId: "re_review", acceptedAt: new Date().toISOString() },
      }),
    });
    // Creation plus each acknowledged/plan/start transition also fans out.
    assert.ok(review.fannedOut >= 1);
    assert.equal(review.emailsClaimed, 1);
    assert.equal(review.emailsSent, 1);
    const [delivery] = await admin<
      { kind: string; status: string; providerId: string | null; recipient: string }[]
    >`select kind, status, provider_id as "providerId", recipient from operations.request_email_deliveries where request_id = ${request.id}`;
    assert.ok(delivery);
    assert.equal(delivery.kind, "review_requested");
    assert.equal(delivery.status, "succeeded");
    assert.equal(delivery.providerId, "re_review");
    assert.equal(delivery.recipient, f.identity.email);
  } finally {
    await removeRequestFixture(admin, f);
    await admin.end();
    await founder.end();
    await portal.end();
  }
});

test("FSS closure queues a distinct owner email delivery with its reason", async () => {
  const admin = postgres(url, { max: 1 });
  const founder = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_founder" },
  });
  const portal = postgres(url, {
    max: 4,
    connection: { options: "-c role=operations_portal" },
  });
  const f = await requestFixture(admin, founder);
  try {
    const request = await createPortalRequest(
      portal,
      f.identity,
      f.organisationId,
      newRequest(f.projectId),
      f.correlationId,
    );
    const { executeFounderRequestCommand } = await import(
      "../../../lib/operations/requests/service"
    );
    await executeFounderRequestCommand(
      founder,
      { actorId: "d".repeat(64) },
      f.organisationId,
      {
        action: "close",
        expectedVersion: request.version,
        reason: "The client cancelled the agreed work.",
        requestId: request.id,
      },
      f.correlationId,
    );

    const summary = await dispatchRequestNotifications(founder, {
      sender: async () => ({
        status: "succeeded",
        receipt: { providerId: "re_closed", acceptedAt: new Date().toISOString() },
      }),
    });
    assert.equal(summary.emailsClaimed, 1);
    assert.equal(summary.emailsSent, 1);

    const [delivery] = await admin<
      { kind: string; status: string }[]
    >`select kind, status from operations.request_email_deliveries where request_id = ${request.id}`;
    assert.ok(delivery);
    assert.equal(delivery.kind, "closed");
    assert.equal(delivery.status, "succeeded");
  } finally {
    await removeRequestFixture(admin, f);
    await admin.end();
    await founder.end();
    await portal.end();
  }
});
