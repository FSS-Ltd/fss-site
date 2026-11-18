import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../db/types";
import { postgresFirstEmailApprovalRepository } from "./approval-repository";

test("locks the draft and prospect, creates the enrollment and message, and audits atomically", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    if (text.startsWith("select p.business_id"))
      return [{ businessId: "business-id", prospectId: "prospect-id" }];
    if (text.startsWith("select at.id")) {
      return [
        {
          id: "draft-id",
          prospectId: "prospect-id",
          status: "completed",
          outputSnapshot: { schemaVersion: "1.0" },
          completedAt: new Date("2026-08-17T06:00:00.000Z"),
          contactId: "contact-id",
          contactVersion: 1,
          businessId: "business-id",
          contactEmail: "contact@example.test",
          normalisedEmail: "contact@example.test",
          subscriberType: "corporate",
          corporateStatus: "active",
        },
      ];
    }
    if (text.startsWith("select exists")) return [{ exists: false }];
    if (text.startsWith("insert into growth.sequence_enrollments")) {
      return [{ id: "enrollment-id" }];
    }
    if (text.startsWith("insert into growth.email_messages")) {
      return [{ id: "message-id" }];
    }
    if (text.startsWith("update growth.agent_tasks")) {
      return [{ id: "draft-id" }];
    }
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;

  const result = await postgresFirstEmailApprovalRepository.withTransaction(
    db,
    async (tx) => {
      const draft = await tx.lockDraft("draft-id");
      const suppressed = await tx.isSuppressed("contact@example.test");
      const created = await tx.createEnrollmentAndFirstMessage({
        prospectId: "prospect-id",
        contactId: "contact-id",
        enrollmentStatus: "active",
        approvedRecipient: "contact@example.test",
        reviewedRecipient: {
          email: "contact@example.test",
          contactId: "contact-id",
          contactVersion: 1,
          prospectVersion: 1,
        },
        effectiveRecipient: {
          email: "contact@example.test",
          contactId: "contact-id",
          contactVersion: 1,
          prospectVersion: 1,
        },
        message: {
          id: "message-id",
          subjectSnapshot: "Subject",
          htmlSnapshot: "<p>Body</p>",
          textSnapshot: "Body",
          emailAssetId: null,
          rfcMessageId: "<growthos.message-id@faithfulsoftware.dev>",
          idempotencyKey: "first_email:draft-id",
          status: "queued",
          scheduledFor: new Date("2026-08-18T09:00:00.000Z"),
        },
      });
      await tx.markDraftReviewState("draft-id", {
        schemaVersion: "1.0",
        reviewState: "approved",
      });
      await tx.appendApprovalAudit({
        correlationId: "correlation-id",
        actorId: "founder-actor",
        draftTaskId: "draft-id",
      });
      return { draft, suppressed, created };
    },
  );

  assert.equal(result.draft?.id, "draft-id");
  assert.equal(result.suppressed, false);
  assert.equal(result.created.sequenceEnrollmentId, "enrollment-id");

  assert.match(queries.shift()?.text ?? "", /growth:gmail-routing/);
  assert.match(queries.shift()?.text ?? "", /select p.business_id/);
  assert.match(queries.shift()?.text ?? "", /pg_advisory_xact_lock/);
  assert.match(queries[0]?.text ?? "", /task_type = 'first_email_draft'/);
  assert.match(queries[0]?.text ?? "", /for update of at, p, c, b$/);
  assert.match(queries[1]?.text ?? "", /select exists/);
  assert.match(queries[2]?.text ?? "", /select exists/);
  assert.deepEqual(queries[2]?.values, ["contact@example.test"]);
  assert.match(
    queries[3]?.text ?? "",
    /insert into growth\.sequence_enrollments/,
  );
  assert.deepEqual(queries[3]?.values, [
    "prospect-id",
    "contact-id",
    "active",
    {
      approvedRecipient: "contact@example.test",
      reviewedRecipient: {
        email: "contact@example.test",
        contactId: "contact-id",
        contactVersion: 1,
        prospectVersion: 1,
      },
      effectiveRecipient: {
        email: "contact@example.test",
        contactId: "contact-id",
        contactVersion: 1,
        prospectVersion: 1,
      },
    },
  ]);
  assert.match(queries[4]?.text ?? "", /insert into growth\.email_messages/);
  assert.match(queries[5]?.text ?? "", /update growth\.sequence_enrollments/);
  assert.match(queries[5]?.text ?? "", /set first_message_id = \?/);
  assert.match(queries[6]?.text ?? "", /update growth\.agent_tasks/);
  assert.match(queries[7]?.text ?? "", /insert into growth\.audit_log/);
  assert.deepEqual(queries[7]?.values.slice(0, 6), [
    "correlation-id",
    "founder",
    "founder-actor",
    "first_email.approved",
    "agent_task",
    "draft-id",
  ]);
});

test("returns null for an unknown draft", async () => {
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    return text.startsWith("select at.id") ? [] : [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;

  await postgresFirstEmailApprovalRepository.withTransaction(db, async (tx) => {
    assert.equal(await tx.lockDraft("missing"), null);
  });
});

test("records a provider draft outside the approval transaction", async () => {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const db = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ text, values });
    return text.startsWith("update growth.email_messages")
      ? [{ id: "message-id" }]
      : [];
  }) as unknown as GrowthDb;
  Object.assign(db, {
    begin: async <T>(operation: (tx: GrowthDb) => Promise<T>) => operation(db),
  });

  await postgresFirstEmailApprovalRepository.recordProviderDraft(db, {
    messageId: "message-id",
    providerDraftId: "provider-draft-1",
    providerThreadId: "provider-thread-1",
  });

  assert.match(queries.shift()?.text ?? "", /growth:gmail-routing/);
  assert.match(queries[0]?.text ?? "", /update growth\.email_messages/);
  assert.match(queries[0]?.text ?? "", /status = 'provider_draft'/);
  assert.deepEqual(queries[0]?.values, [
    "provider-draft-1",
    "provider-thread-1",
    "message-id",
  ]);
});

test("fails closed when the message insert returns no row", async () => {
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    if (text.startsWith("insert into growth.sequence_enrollments")) {
      return [{ id: "enrollment-id" }];
    }
    if (text.startsWith("insert into growth.email_messages")) return [];
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;

  await postgresFirstEmailApprovalRepository.withTransaction(db, async (tx) => {
    await assert.rejects(
      tx.createEnrollmentAndFirstMessage({
        prospectId: "prospect-id",
        contactId: "contact-id",
        enrollmentStatus: "active",
        approvedRecipient: "contact@example.test",
        reviewedRecipient: {
          email: "contact@example.test",
          contactId: "contact-id",
          contactVersion: 1,
          prospectVersion: 1,
        },
        effectiveRecipient: {
          email: "contact@example.test",
          contactId: "contact-id",
          contactVersion: 1,
          prospectVersion: 1,
        },
        message: {
          id: "message-id",
          subjectSnapshot: "Subject",
          htmlSnapshot: "<p>Body</p>",
          textSnapshot: "Body",
          emailAssetId: null,
          rfcMessageId: "<growthos.message-id@faithfulsoftware.dev>",
          idempotencyKey: "first_email:draft-id",
          status: "queued",
          scheduledFor: null,
        },
      }),
      /could not be stored/i,
    );
  });
});

test("rejects crossed business identity after acquiring the business lock", async () => {
  const transaction = (async (strings: TemplateStringsArray) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    if (text.startsWith("select p.business_id"))
      return [{ businessId: "before", prospectId: "prospect" }];
    if (text.startsWith("select at.id"))
      return [{ businessId: "after", prospectId: "prospect" }];
    return [];
  }) as unknown as GrowthTransaction;
  const db = {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  } as unknown as GrowthDb;
  await assert.rejects(
    postgresFirstEmailApprovalRepository.withTransaction(db, (tx) =>
      tx.lockDraft("draft"),
    ),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "version_conflict",
  );
});
