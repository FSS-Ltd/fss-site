import assert from "node:assert/strict";
import test from "node:test";

import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import {
  createEngagementTransitioner,
  TransitionEngagementError,
  type AppendTransitionAuditInput,
  type ApplyCommercialTransitionInput,
  type ApplyDeliveryTransitionInput,
  type CreateClientThankYouInput,
  type EngagementTransitionRepository,
  type EngagementTransitionTransaction,
  type InsertStageEventInput,
  type LockedEngagement,
  type StopActiveOutreachResult,
  type WonRecipientForThankYou,
} from "./transition-engagement";

const founder: FounderSession = {
  email: "founder@example.test",
  actorId: "a".repeat(64),
};
const engagementId = "11111111-1111-4111-8111-111111111111";
const prospectId = "22222222-2222-4222-8222-222222222222";
const db = {} as GrowthDb;
const fixedNow = new Date("2026-08-22T10:00:00.000Z");

function lockedEngagement(
  overrides: Partial<LockedEngagement> = {},
): LockedEngagement {
  return {
    id: engagementId,
    prospectId,
    version: 3,
    stage: "new",
    deliveryStatus: "not_started",
    ...overrides,
  };
}

type FakeState = {
  engagement: LockedEngagement | null;
  commercialApplications: ApplyCommercialTransitionInput[];
  deliveryApplications: ApplyDeliveryTransitionInput[];
  events: InsertStageEventInput[];
  stopOutreachCalls: string[];
  stopOutreachResult: StopActiveOutreachResult;
  audits: AppendTransitionAuditInput[];
  existingClientThankYou: boolean;
  wonRecipient: WonRecipientForThankYou | null;
  createdClientThankYou: CreateClientThankYouInput[];
};

function wonRecipient(
  overrides: Partial<WonRecipientForThankYou> = {},
): WonRecipientForThankYou {
  return {
    contactId: "33333333-3333-4333-8333-333333333333",
    firstName: "Ada",
    engagementName: "The enquiry portal build",
    alreadySubscribed: false,
    ...overrides,
  };
}

function createFakeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    engagement: lockedEngagement(),
    commercialApplications: [],
    deliveryApplications: [],
    events: [],
    stopOutreachCalls: [],
    stopOutreachResult: { stoppedCount: 1 },
    audits: [],
    existingClientThankYou: false,
    wonRecipient: wonRecipient(),
    createdClientThankYou: [],
    ...overrides,
  };
}

function createFakeRepository(state: FakeState): EngagementTransitionRepository {
  return {
    async withTransaction<T>(
      _db: GrowthDb,
      operation: (transaction: EngagementTransitionTransaction) => Promise<T>,
    ) {
      const transaction: EngagementTransitionTransaction = {
        async lockEngagement(id) {
          if (!state.engagement || state.engagement.id !== id) return null;
          return state.engagement;
        },
        async applyCommercialTransition(input) {
          state.commercialApplications.push(input);
          if (state.engagement) {
            state.engagement.stage = input.toStage;
            state.engagement.version += 1;
          }
        },
        async applyDeliveryTransition(input) {
          state.deliveryApplications.push(input);
          if (state.engagement) {
            state.engagement.deliveryStatus = input.toStatus;
            state.engagement.version += 1;
          }
        },
        async insertStageEvent(input) {
          state.events.push(input);
        },
        async stopActiveOutreachForProspect(id) {
          state.stopOutreachCalls.push(id);
          return state.stopOutreachResult;
        },
        async appendTransitionAudit(input) {
          state.audits.push(input);
        },
        async hasClientThankYou() {
          return state.existingClientThankYou;
        },
        async getWonRecipientForThankYou() {
          return state.wonRecipient;
        },
        async createClientThankYou(input) {
          state.createdClientThankYou.push(input);
        },
      };
      return operation(transaction);
    },
  };
}

function createTransitioner(state: FakeState) {
  return createEngagementTransitioner({
    repository: createFakeRepository(state),
    now: () => fixedNow,
  });
}

test("moves a commercial stage forward and records the event", async () => {
  const state = createFakeState();
  const transition = createTransitioner(state);

  const result = await transition(
    db,
    {
      dimension: "commercial",
      engagementId,
      expectedVersion: 3,
      toStage: "qualified",
    },
    { founder, correlationId: "correlation-1" },
  );

  assert.equal(result.stage, "qualified");
  assert.equal(result.alreadyApplied, false);
  assert.equal(state.commercialApplications.length, 1);
  assert.equal(state.commercialApplications[0]?.toStage, "qualified");
  assert.equal(state.commercialApplications[0]?.wonAt, null);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0]?.fromState, "new");
  assert.equal(state.events[0]?.toState, "qualified");
  assert.equal(state.audits.length, 1);
});

test("leaving new for qualified stops active outreach", async () => {
  const state = createFakeState();
  const transition = createTransitioner(state);

  await transition(
    db,
    { dimension: "commercial", engagementId, expectedVersion: 3, toStage: "qualified" },
    { founder, correlationId: "c" },
  );

  assert.deepEqual(state.stopOutreachCalls, [prospectId]);
});

test("a delivery transition never stops outreach", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({
      stage: "won",
      deliveryStatus: "not_started",
      version: 5,
    }),
  });
  const transition = createTransitioner(state);

  await transition(
    db,
    { dimension: "delivery", engagementId, expectedVersion: 5, toStatus: "discovery" },
    { founder, correlationId: "c" },
  );

  assert.deepEqual(state.stopOutreachCalls, []);
  assert.equal(state.deliveryApplications.length, 1);
});

test("won requires a value and sets won_at", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "negotiation", version: 4 }),
  });
  const transition = createTransitioner(state);

  const result = await transition(
    db,
    {
      dimension: "commercial",
      engagementId,
      expectedVersion: 4,
      toStage: "won",
      oneOffValuePence: 500000,
    },
    { founder, correlationId: "c" },
  );

  assert.equal(result.stage, "won");
  assert.equal(state.commercialApplications[0]?.wonAt?.getTime(), fixedNow.getTime());
  assert.equal(state.commercialApplications[0]?.oneOffValuePence, 500000);
});

test("won without any value is rejected before touching the transaction", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "negotiation", version: 4 }),
  });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "commercial", engagementId, expectedVersion: 4, toStage: "won" },
      { founder, correlationId: "c" },
    ),
  );
  assert.equal(state.commercialApplications.length, 0);
});

test("lost requires a reason and stores it as the loss reason", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "proposal", version: 2 }),
  });
  const transition = createTransitioner(state);

  await transition(
    db,
    {
      dimension: "commercial",
      engagementId,
      expectedVersion: 2,
      toStage: "lost",
      reasonCode: "budget",
    },
    { founder, correlationId: "c" },
  );

  assert.equal(state.commercialApplications[0]?.lossReason, "budget");
  assert.equal(state.commercialApplications[0]?.lostAt?.getTime(), fixedNow.getTime());
});

test("lost without a reason is rejected", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "proposal", version: 2 }),
  });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "commercial", engagementId, expectedVersion: 2, toStage: "lost" },
      { founder, correlationId: "c" },
    ),
  );
});

test("cancelled delivery without a reason is rejected", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "won", deliveryStatus: "discovery", version: 6 }),
  });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "delivery", engagementId, expectedVersion: 6, toStatus: "cancelled" },
      { founder, correlationId: "c" },
    ),
  );
});

test("cancelled delivery with a reason is recorded on the event, not the engagement row", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "won", deliveryStatus: "discovery", version: 6 }),
  });
  const transition = createTransitioner(state);

  await transition(
    db,
    {
      dimension: "delivery",
      engagementId,
      expectedVersion: 6,
      toStatus: "cancelled",
      reasonCode: "client_paused",
    },
    { founder, correlationId: "c" },
  );

  assert.equal(state.events[0]?.reasonCode, "client_paused");
});

test("delivery cannot start before the commercial stage is won", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "negotiation", deliveryStatus: "not_started", version: 4 }),
  });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "delivery", engagementId, expectedVersion: 4, toStatus: "discovery" },
      { founder, correlationId: "c" },
    ),
    (error: unknown) =>
      error instanceof TransitionEngagementError &&
      error.code === "delivery_requires_won",
  );
});

test("an invalid commercial jump is rejected", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "new", version: 1 }),
  });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "commercial", engagementId, expectedVersion: 1, toStage: "negotiation" },
      { founder, correlationId: "c" },
    ),
    (error: unknown) =>
      error instanceof TransitionEngagementError &&
      error.code === "invalid_transition",
  );
});

test("a terminal commercial stage cannot be reopened", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "lost", version: 4 }),
  });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "commercial", engagementId, expectedVersion: 4, toStage: "qualified" },
      { founder, correlationId: "c" },
    ),
    (error: unknown) =>
      error instanceof TransitionEngagementError &&
      error.code === "invalid_transition",
  );
});

test("repeating the same commercial transition is idempotent and does not require a fresh version", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "qualified", version: 9 }),
  });
  const transition = createTransitioner(state);

  const result = await transition(
    db,
    { dimension: "commercial", engagementId, expectedVersion: 1, toStage: "qualified" },
    { founder, correlationId: "c" },
  );

  assert.equal(result.alreadyApplied, true);
  assert.equal(state.commercialApplications.length, 0);
  assert.equal(state.audits.length, 0);
});

test("rejects a stale version with a conflict error", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "qualified", version: 5 }),
  });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "commercial", engagementId, expectedVersion: 3, toStage: "proposal" },
      { founder, correlationId: "c" },
    ),
    (error: unknown) =>
      error instanceof TransitionEngagementError &&
      error.code === "version_conflict",
  );
  assert.equal(state.commercialApplications.length, 0);
});

test("rejects an unknown engagement", async () => {
  const state = createFakeState({ engagement: null });
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "commercial", engagementId, expectedVersion: 1, toStage: "qualified" },
      { founder, correlationId: "c" },
    ),
    (error: unknown) =>
      error instanceof TransitionEngagementError && error.code === "not_found",
  );
});

test("rejects malformed request input", async () => {
  const state = createFakeState();
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "commercial", engagementId: "not-a-uuid", expectedVersion: 1, toStage: "qualified" },
      { founder, correlationId: "c" },
    ),
  );
  await assert.rejects(
    transition(
      db,
      { dimension: "commercial", engagementId, expectedVersion: 0, toStage: "qualified" },
      { founder, correlationId: "c" },
    ),
  );
});

test("the first transition to complete creates a pending client thank-you", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "won", deliveryStatus: "review", version: 7 }),
  });
  const transition = createTransitioner(state);

  await transition(
    db,
    {
      dimension: "delivery",
      engagementId,
      expectedVersion: 7,
      toStatus: "complete",
      includeNewsletterInvite: true,
    },
    { founder, correlationId: "c" },
  );

  assert.equal(state.createdClientThankYou.length, 1);
  const created = state.createdClientThankYou[0];
  assert.equal(created?.engagementId, engagementId);
  assert.equal(created?.includedNewsletterInvite, true);
  assert.match(created?.subjectSnapshot ?? "", /The enquiry portal build/);
  assert.match(created?.htmlSnapshot ?? "", /<html/i);
});

test("a repeated transition to complete does not create a second thank-you", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "won", deliveryStatus: "review", version: 7 }),
    existingClientThankYou: true,
  });
  const transition = createTransitioner(state);

  await transition(
    db,
    { dimension: "delivery", engagementId, expectedVersion: 7, toStatus: "complete" },
    { founder, correlationId: "c" },
  );

  assert.equal(state.createdClientThankYou.length, 0);
});

test("an already-subscribed client never gets the newsletter invite, even if requested", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "won", deliveryStatus: "review", version: 7 }),
    wonRecipient: wonRecipient({ alreadySubscribed: true }),
  });
  const transition = createTransitioner(state);

  await transition(
    db,
    {
      dimension: "delivery",
      engagementId,
      expectedVersion: 7,
      toStatus: "complete",
      includeNewsletterInvite: true,
    },
    { founder, correlationId: "c" },
  );

  assert.equal(state.createdClientThankYou[0]?.includedNewsletterInvite, false);
});

test("no thank-you is created when there is no resolvable recipient", async () => {
  const state = createFakeState({
    engagement: lockedEngagement({ stage: "won", deliveryStatus: "review", version: 7 }),
    wonRecipient: null,
  });
  const transition = createTransitioner(state);

  await transition(
    db,
    { dimension: "delivery", engagementId, expectedVersion: 7, toStatus: "complete" },
    { founder, correlationId: "c" },
  );

  assert.equal(state.createdClientThankYou.length, 0);
});

test("rejects an invalid founder context even with valid input", async () => {
  const state = createFakeState();
  const transition = createTransitioner(state);

  await assert.rejects(
    transition(
      db,
      { dimension: "commercial", engagementId, expectedVersion: 3, toStage: "qualified" },
      { founder: { email: "founder@example.test", actorId: "not-hex" }, correlationId: "c" },
    ),
    TypeError,
  );
});
