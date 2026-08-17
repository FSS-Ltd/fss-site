import assert from "node:assert/strict";
import test from "node:test";

import { createValidResearchRunFixture } from "./ingestion-schema.test-fixture";
import { createResearchRunIngester, ResearchIngestionError } from "./ingest";
import type {
  CandidateInspection,
  ResearchIngestionRepository,
  ResearchIngestionTransaction,
  ResearchRunRecord,
} from "./repository";
import { candidateIdentityLockKeys } from "./repository";
import type {
  ResearchProspectCandidate,
  ResearchRunIngestion,
  ResearchRunIngestionResult,
} from "./types";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const BUSINESS_ID = "22222222-2222-4222-8222-222222222222";
const CONTACT_ID = "33333333-3333-4333-8333-333333333333";
const PROSPECT_ID = "44444444-4444-4444-8444-444444444444";

type FakeOptions = {
  existingResult?: ResearchRunIngestionResult;
  inspection?: CandidateInspection;
  failDetails?: boolean;
};

type FakeState = {
  events: string[];
  run: ResearchRunRecord | null;
  acceptedProspects: Array<{ candidateIndex: number; prospectId: string }>;
  visualAltTexts: string[];
};

function cloneState(state: FakeState): FakeState {
  return {
    events: [...state.events],
    run: state.run === null ? null : { ...state.run },
    acceptedProspects: [...state.acceptedProspects],
    visualAltTexts: [...state.visualAltTexts],
  };
}

function createFakeRepository(options: FakeOptions = {}): {
  repository: ResearchIngestionRepository;
  state: FakeState;
} {
  const state: FakeState = {
    events: [],
    run: null,
    acceptedProspects: [],
    visualAltTexts: [],
  };

  const repository: ResearchIngestionRepository = {
    async withTransaction(_db, operation) {
      const pending = cloneState(state);
      const transaction: ResearchIngestionTransaction = {
        async lockExternalRun() {
          pending.events.push("lock-run");
        },
        async findRunResult() {
          pending.events.push("find-run");
          return options.existingResult ?? null;
        },
        async lockCandidateIdentities() {
          pending.events.push("lock-candidates");
        },
        async insertRun(input) {
          pending.events.push("insert-run");
          pending.run = {
            id: RUN_ID,
            externalRunId: input.externalRunId,
            accepted: 0,
            duplicates: 0,
            rejected: input.rejections.length,
          };
          return RUN_ID;
        },
        async inspectCandidate() {
          pending.events.push("inspect-candidate");
          return options.inspection ?? { kind: "accept" };
        },
        async insertCandidateCore() {
          pending.events.push("insert-business");
          pending.events.push("insert-contact");
          pending.events.push("insert-prospect");
          return {
            businessId: BUSINESS_ID,
            contactId: CONTACT_ID,
            prospectId: PROSPECT_ID,
          };
        },
        async insertCandidateDetails(input) {
          pending.events.push("insert-evidence");
          if (options.failDetails) {
            throw new Error("invalid evidence record");
          }
          pending.events.push("insert-assessment");
          pending.events.push("insert-task-draft");
          pending.acceptedProspects.push({
            candidateIndex: input.candidateIndex,
            prospectId: input.inserted.prospectId,
          });
          pending.visualAltTexts.push(input.visual.altText);
        },
        async appendProspectAuditEvent() {
          pending.events.push("audit-prospect");
        },
        async completeRun(_runId, counts) {
          pending.events.push("complete-run");
          assert.ok(pending.run);
          pending.run.accepted = counts.accepted;
          pending.run.duplicates = counts.duplicates;
          pending.run.rejected = counts.rejected;
        },
        async appendRunAuditEvent() {
          pending.events.push("audit-run");
        },
        async readRunResult() {
          pending.events.push("read-result");
          assert.ok(pending.run);
          return {
            ok: true,
            runId: pending.run.id,
            accepted: pending.run.accepted,
            duplicates: pending.run.duplicates,
            rejected: pending.run.rejected,
            acceptedProspects: [...pending.acceptedProspects],
          };
        },
      };

      const result = await operation(transaction);
      state.events = pending.events;
      state.run = pending.run;
      state.acceptedProspects = pending.acceptedProspects;
      state.visualAltTexts = pending.visualAltTexts;
      return result;
    },
  };

  return { repository, state };
}

function fixture(): ResearchRunIngestion {
  return createValidResearchRunFixture();
}

async function expectIngestionCode(
  promise: Promise<unknown>,
  code: ResearchIngestionError["code"],
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ResearchIngestionError);
    assert.equal(error.code, code);
    return true;
  });
}

test("ingests a complete candidate and draft in one transaction", async () => {
  const { repository, state } = createFakeRepository();
  const ingest = createResearchRunIngester(repository);

  const result = await ingest({} as never, fixture());

  assert.deepEqual(result, {
    ok: true,
    runId: RUN_ID,
    accepted: 1,
    duplicates: 0,
    rejected: 0,
    acceptedProspects: [{ candidateIndex: 0, prospectId: PROSPECT_ID }],
  });
  assert.deepEqual(state.events, [
    "lock-run",
    "find-run",
    "lock-candidates",
    "insert-run",
    "inspect-candidate",
    "insert-business",
    "insert-contact",
    "insert-prospect",
    "insert-evidence",
    "insert-assessment",
    "insert-task-draft",
    "audit-prospect",
    "complete-run",
    "audit-run",
    "read-result",
  ]);
  assert.deepEqual(state.visualAltTexts, [
    "Concept illustration of a home, service calendar and connected digital enquiry workflow.",
  ]);
});

test("orders every candidate identity lock globally", () => {
  const input = fixture();
  const second = structuredClone(
    input.prospects[0],
  ) as ResearchProspectCandidate;
  input.prospects[0]!.business.companyNumber = "ZZ 99";
  input.prospects[0]!.contact.email = "ZED@EXAMPLE.TEST";
  second.business.companyNumber = "AA 11";
  second.contact.email = "alpha@example.test";

  assert.deepEqual(candidateIdentityLockKeys([input.prospects[0]!, second]), [
    "growth:business:AA11",
    "growth:business:ZZ99",
    "growth:contact:alpha@example.test",
    "growth:contact:zed@example.test",
  ]);
});

test("returns the persisted result for a duplicate external run ID", async () => {
  const existingResult: ResearchRunIngestionResult = {
    ok: true,
    runId: RUN_ID,
    accepted: 1,
    duplicates: 0,
    rejected: 0,
    acceptedProspects: [{ candidateIndex: 0, prospectId: PROSPECT_ID }],
  };
  const { repository, state } = createFakeRepository({ existingResult });
  const ingest = createResearchRunIngester(repository);

  const result = await ingest({} as never, fixture());

  assert.deepEqual(result, existingResult);
  assert.deepEqual(state.events, ["lock-run", "find-run"]);
  assert.equal(state.run, null);
});

test("counts a duplicate company without inserting a second business", async () => {
  const { repository, state } = createFakeRepository({
    inspection: { kind: "duplicate_business" },
  });
  const ingest = createResearchRunIngester(repository);

  const result = await ingest({} as never, fixture());

  assert.equal(result.accepted, 0);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(result.acceptedProspects, []);
  assert.ok(!state.events.includes("insert-business"));
});

test("rejects an address used by an existing suppressed prospect", async () => {
  const { repository, state } = createFakeRepository({
    inspection: { kind: "suppressed_contact" },
  });
  const ingest = createResearchRunIngester(repository);

  await expectIngestionCode(
    ingest({} as never, fixture()),
    "suppressed_contact",
  );

  assert.deepEqual(state.events, []);
  assert.equal(state.run, null);
});

test("rejects an unknown fallback asset before inserting a candidate", async () => {
  const { repository, state } = createFakeRepository();
  const ingest = createResearchRunIngester(repository);
  const input = fixture();
  input.prospects[0]!.visual.fallbackAssetKey = "unknown-asset";

  await expectIngestionCode(
    ingest({} as never, input),
    "invalid_asset_reference",
  );

  assert.deepEqual(state.events, []);
});

test("rejects a pre-attached custom asset before creating the run", async () => {
  const { repository, state } = createFakeRepository();
  const ingest = createResearchRunIngester(repository);
  const input = fixture();
  const untrustedVisual = input.prospects[0]!.visual as {
    assetId: string | null;
  };
  untrustedVisual.assetId = "55555555-5555-4555-8555-555555555555";

  await expectIngestionCode(
    ingest({} as never, input),
    "invalid_asset_reference",
  );

  assert.deepEqual(state.events, []);
  assert.equal(state.run, null);
});

test("rolls back the whole run when any candidate detail is invalid", async () => {
  const { repository, state } = createFakeRepository({ failDetails: true });
  const ingest = createResearchRunIngester(repository);
  const input = fixture();
  input.prospects.push(
    structuredClone(input.prospects[0]) as ResearchProspectCandidate,
  );
  input.prospects[1]!.business.companyNumber = "87654321";
  input.prospects[1]!.contact.email = "second@example.test";

  await assert.rejects(ingest({} as never, input), /invalid evidence record/);

  assert.deepEqual(state.events, []);
  assert.equal(state.run, null);
  assert.deepEqual(state.acceptedProspects, []);
});
