import assert from "node:assert/strict";
import test from "node:test";
import { assessReservationBudget } from "./reservation-budget";

test("deduplicates accepted provider IDs while retaining uncertain and reserved capacity", () => {
  const input = {
    globalUsed: 2,
    accountUsed: 2,
    campaignUsed: 1,
    accountRamp: 25,
    campaignCeiling: 150,
    messages: 10,
    recipients: 10,
    messageLimit: 100,
    recipientLimits: [100, 100, 100, 100] as [number, number, number, number],
    perMessage: 10,
    messageReserve: 50,
    recipientReserve: 5,
    providerIds: ["observed"],
    outstanding: [
      { state: "accepted" as const, providerId: "observed", recipientCount: 1 },
      { state: "uncertain" as const, providerId: null, recipientCount: 1 },
      { state: "reserved" as const, providerId: null, recipientCount: 1 },
    ],
    recipientCount: 1,
  };
  assert.equal(assessReservationBudget(input), "ready");
  assert.equal(
    assessReservationBudget({ ...input, messageLimit: 63 }),
    "ready",
  );
  assert.equal(
    assessReservationBudget({
      ...input,
      messageLimit: 62,
      outstanding: [
        { state: "uncertain", providerId: "observed", recipientCount: 1 },
        { state: "reserved", providerId: null, recipientCount: 1 },
      ],
    }),
    "provider_limit",
  );
  assert.equal(
    assessReservationBudget({ ...input, messageLimit: 62 }),
    "provider_limit",
  );
  assert.equal(
    assessReservationBudget({ ...input, accountUsed: 25 }),
    "account_limit",
  );
  assert.equal(
    assessReservationBudget({ ...input, globalUsed: 150 }),
    "global_limit",
  );
  assert.equal(
    assessReservationBudget({ ...input, campaignUsed: 150 }),
    "campaign_limit",
  );
  assert.equal(
    assessReservationBudget({ ...input, recipientCount: 11 }),
    "recipient_limit",
  );
});
