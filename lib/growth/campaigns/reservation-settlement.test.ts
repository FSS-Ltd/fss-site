import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";
import { reconcileOutreachAttempt } from "./reservation-settlement";

test("holds campaign receipt reconciliation until its atomic writer is available", async () => {
  const db = (async () => [
    {
      connectionId: "account",
      grantEpoch: 1,
      rfc: "<message@example.test>",
      status: "uncertain",
      campaignId: "campaign",
    },
  ]) as unknown as GrowthDb;
  const gmailClient = {
    getProfile: async () => {
      throw new Error("unexpected provider call");
    },
    findByRfcMessageId: async () => null,
  };

  assert.deepEqual(
    await reconcileOutreachAttempt(db, {
      reservationId: "11111111-1111-4111-8111-111111111111",
      gmailClient,
    }),
    { status: "held", reason: "campaign_receipt_pending" },
  );
});

test("holds a legacy receipt without promoting message creation time to send time", async () => {
  const db = (async () => [
    {
      connectionId: "account",
      grantEpoch: 1,
      rfc: "<message@example.test>",
      status: "uncertain",
      campaignId: null,
    },
  ]) as unknown as GrowthDb;
  assert.deepEqual(
    await reconcileOutreachAttempt(db, {
      reservationId: "11111111-1111-4111-8111-111111111111",
      gmailClient: {
        getProfile: async () => {
          throw new Error("unexpected provider call");
        },
        findByRfcMessageId: async () => null,
      },
    }),
    { status: "held", reason: "actual_send_time_unproven" },
  );
});
