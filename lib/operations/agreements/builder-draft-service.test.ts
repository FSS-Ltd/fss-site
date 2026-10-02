import assert from "node:assert/strict";
import test from "node:test";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import {
  AgreementBuilderDraftValidationError,
  loadStaffAgreementBuilderDraft,
  saveStaffAgreementBuilderDraft,
  type AgreementBuilderDraft,
} from "./builder-draft-service";
import { agreementDraft } from "./fixtures";

const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  realm: "staff",
  role: "admin",
  userId: "33333333-3333-4333-8333-333333333333",
};

const organisationId = "44444444-4444-4444-8444-444444444444";
const draftId = "55555555-5555-4555-8555-555555555555";
const engagementId = "66666666-6666-4666-8666-666666666666";
const correlationId = "77777777-7777-4777-8777-777777777777";

function savedDraft(version = 1): AgreementBuilderDraft {
  return {
    content: {
      agreement: { title: "Website & booking" },
      engagementId,
    },
    createdAt: "2026-09-21T10:00:00.000Z",
    engagementId,
    id: draftId,
    organisationId,
    step: "scope",
    updatedAt: "2026-09-21T10:00:00.000Z",
    version,
  };
}

function completeDraft(): AgreementBuilderDraft {
  const { documentHash, documentReference, ...agreement } = agreementDraft();
  assert.match(documentHash, /^[a-f0-9]{64}$/);
  assert.match(documentReference, /^private:/);

  return {
    ...savedDraft(),
    content: {
      agreement,
      engagementId,
    },
  };
}

function recordingDb(stored: AgreementBuilderDraft | null = null): {
  calls: Array<{ sql: string; values: unknown[] }>;
  db: OperationsDb;
} {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const query = Object.assign(
    async (parts: TemplateStringsArray, ...values: unknown[]) => {
      const sql = parts.join("?");
      calls.push({ sql, values });
      if (sql.includes("set_config") || sql.includes("assert_active"))
        return [];
      if (sql.includes("save_agreement_builder_draft")) return [savedDraft()];
      if (sql.includes("load_agreement_builder_draft"))
        return stored ? [stored] : [];
      return [];
    },
    { json: <T>(value: T) => value },
  );

  return {
    calls,
    db: {
      begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
        run(query as unknown as OperationsTransaction),
    } as unknown as OperationsDb,
  };
}

test("staff builder drafts retain partial agreement data without creating an agreement", async () => {
  const { calls, db } = recordingDb();

  const saved = await saveStaffAgreementBuilderDraft(
    db,
    admin,
    organisationId,
    {
      action: "save",
      content: {
        agreement: { title: "Website & booking" },
        engagementId,
      },
      draftId,
      expectedVersion: 0,
      step: "scope",
    },
    correlationId,
  );

  assert.equal(saved.version, 1);
  assert.equal(saved.content.agreement?.title, "Website & booking");
  assert.match(
    calls.map(({ sql }) => sql).join("\n"),
    /operations\.save_agreement_builder_draft/,
  );
  assert.equal(
    calls.some(({ sql }) => sql.includes("insert into operations.agreements")),
    false,
  );
});

test("finalising an incomplete builder draft never creates an agreement", async () => {
  const { calls, db } = recordingDb(savedDraft());

  await assert.rejects(
    saveStaffAgreementBuilderDraft(
      db,
      admin,
      organisationId,
      { action: "finalise", draftId, expectedVersion: 1 },
      correlationId,
    ),
    /Scope: Complete the client outcome/,
  );

  assert.match(
    calls.map(({ sql }) => sql).join("\n"),
    /operations\.load_agreement_builder_draft/,
  );
  assert.equal(
    calls.some(({ sql }) => sql.includes("insert into operations.agreements")),
    false,
  );
});

test("staff can only load a builder draft through its organisation scope", async () => {
  const { calls, db } = recordingDb(savedDraft());

  const loaded = await loadStaffAgreementBuilderDraft(
    db,
    admin,
    organisationId,
    draftId,
  );

  assert.equal(loaded?.id, draftId);
  const load = calls.find(({ sql }) =>
    sql.includes("operations.load_agreement_builder_draft"),
  );
  assert.deepEqual(load?.values.slice(0, 2), [draftId, organisationId]);
});

test("finalising checks that the saved engagement is still linked to the organisation", async () => {
  const { calls, db } = recordingDb(completeDraft());

  await assert.rejects(
    saveStaffAgreementBuilderDraft(
      db,
      admin,
      organisationId,
      { action: "finalise", draftId, expectedVersion: 1 },
      correlationId,
    ),
    /reviewed engagement is no longer available/i,
  );

  assert.match(
    calls.map(({ sql }) => sql).join("\n"),
    /from operations\.engagement_links/,
  );
});

test("publishing client-proposed cash without recurring work explains how to finish", async () => {
  const stored = completeDraft();
  const { db, calls } = recordingDb({
    ...stored,
    content: {
      ...stored.content,
      commercialOffer: {
        spec: { cash: { mode: "client_proposed" }, revenueShare: null },
        expiresAt: "2026-11-01T00:00:00.000Z",
      },
    },
  });
  await assert.rejects(
    saveStaffAgreementBuilderDraft(
      db,
      admin,
      organisationId,
      { action: "publish", draftId, expectedVersion: 1 },
      correlationId,
    ),
    (error: unknown) =>
      error instanceof AgreementBuilderDraftValidationError &&
      error.message ===
        "Fees: Client-proposed amounts apply to recurring services. Add a recurring service or choose fixed payment.",
  );
  assert.equal(
    calls.some(({ sql }) =>
      sql.includes("insert into operations.commercial_offers"),
    ),
    false,
  );
});
