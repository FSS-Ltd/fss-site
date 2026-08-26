import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb, GrowthTransaction } from "../db/types";
import {
  backfillProspectPreviews,
  postgresProspectPreviewBackfillRepository,
  type ProspectPreviewBackfillRepository,
} from "./backfill";

const PROSPECT_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
] as const;

function validCandidate(prospectId: string) {
  return {
    prospectId,
    prospectStatus: "ready_for_email_review",
    previewExists: false,
    assessmentStatus: "pending_review",
    businessName: "Example Services",
    sector: "Plumbing",
    locality: "Canterbury",
    businessGoal: "Turn urgent enquiries into qualified call-backs.",
    primaryCta: "Request a call-back",
    homepageSections: {
      schemaVersion: "1.0",
      summary: "A focused route from service need to contact.",
      items: ["Hero", "Services"],
    },
    conversionPlan: {
      schemaVersion: "1.0",
      summary: "Collect the details required for a useful call-back.",
      items: ["Problem selector", "Preferred contact time"],
    },
    trustSignals: {
      schemaVersion: "1.0",
      summary: "The services page explains the work the business provides.",
      items: ["Local service information"],
    },
    firstPartyEvidenceUrl: "https://example.test/services",
  };
}

function createRepository() {
  const candidates = new Map<string, ReturnType<typeof validCandidate>>([
    [PROSPECT_IDS[0], validCandidate(PROSPECT_IDS[0])],
    [
      PROSPECT_IDS[1],
      {
        ...validCandidate(PROSPECT_IDS[1]),
        previewExists: true,
      },
    ],
    [
      PROSPECT_IDS[2],
      {
        ...validCandidate(PROSPECT_IDS[2]),
        conversionPlan: {
          schemaVersion: "1.0",
          summary: "Collect the details required for a useful call-back.",
          items: ["Problem selector"],
        },
      },
    ],
  ]);
  const state = {
    created: 0,
    auditEvents: 0,
    emailWrites: 0,
    published: 0,
  };
  const repository: ProspectPreviewBackfillRepository = {
    async listProspectIds() {
      return [...PROSPECT_IDS];
    },
    async withTransaction(_db, operation) {
      return operation({
        async lockCandidate(prospectId) {
          return candidates.get(prospectId) ?? null;
        },
        async insertDraftPreview(input) {
          const candidate = candidates.get(input.prospectId);
          if (!candidate || candidate.previewExists) return false;
          candidate.previewExists = true;
          state.created += 1;
          return true;
        },
        async appendBackfillAudit() {
          state.auditEvents += 1;
        },
      });
    },
  };

  return { repository, state };
}

test("creates drafts only for eligible prospects without an existing preview", async () => {
  const fake = createRepository();

  const result = await backfillProspectPreviews(
    {} as GrowthDb,
    fake.repository,
  );

  assert.deepEqual(result, { scanned: 3, created: 1, skipped: 1, invalid: 1 });
  assert.equal(fake.state.created, 1);
  assert.equal(fake.state.auditEvents, 1);
  assert.equal(fake.state.published, 0);
  assert.equal(fake.state.emailWrites, 0);
});

test("does not duplicate drafts when it runs a second time", async () => {
  const fake = createRepository();

  await backfillProspectPreviews({} as GrowthDb, fake.repository);
  const repeated = await backfillProspectPreviews({} as GrowthDb, fake.repository);

  assert.equal(repeated.created, 0);
  assert.equal(fake.state.created, 1);
  assert.equal(fake.state.auditEvents, 1);
});

test("persists a draft and audit record without writing an email task", async () => {
  const queries: string[] = [];
  const queryValues: Array<readonly unknown[]> = [];
  const transaction = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push(text);
    queryValues.push(values);
    if (text.startsWith('select p.id as "prospectId", p.status')) {
      return [validCandidate(PROSPECT_IDS[0])];
    }
    if (text.startsWith("insert into growth.prospect_previews")) {
      return [{ id: "preview-id" }];
    }
    return [];
  }) as unknown as GrowthTransaction;
  Object.assign(transaction, { json: (value: unknown) => value });
  const db = (async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push(text);
    queryValues.push(values);
    return [{ prospectId: PROSPECT_IDS[0] }];
  }) as unknown as GrowthDb;
  Object.assign(db, {
    begin: async <T>(operation: (tx: GrowthTransaction) => Promise<T>) =>
      operation(transaction),
  });

  const result = await backfillProspectPreviews(
    db,
    postgresProspectPreviewBackfillRepository,
  );

  assert.deepEqual(result, { scanned: 1, created: 1, skipped: 0, invalid: 0 });
  assert.match(queries[0] ?? "", /growth\.website_assessments/);
  assert.match(queries[1] ?? "", /for update of p$/);
  assert.match(queries[2] ?? "", /insert into growth\.prospect_previews/);
  assert.equal(
    queryValues[3]?.includes("prospect_preview.backfilled"),
    true,
  );
  assert.equal(
    queries.some((query) => /update growth\.agent_tasks|output_snapshot/i.test(query)),
    false,
  );
});
