import assert from "node:assert/strict";
import type postgres from "postgres";
import type { GrowthDb, GrowthTransaction } from "../../../lib/growth/db/types";
import type { BoundReader } from "../../../lib/growth/campaigns/gmail-confirmation-observation";
import { createGmailConfirmation } from "../../../lib/growth/campaigns/gmail-confirmation";

export async function exerciseDirectProofRace(
  admin: GrowthDb,
  db: GrowthDb,
  resolveClient: () => Promise<BoundReader>,
  reservationId: string,
): Promise<void> {
  const [stored] = await admin<
    { evidence: postgres.JSONValue }[]
  >`select direct_submission_evidence as evidence from growth.outreach_reservations where id=${reservationId}`;
  assert.ok(stored?.evidence);
  let signalReached: (() => void) | undefined,
    releaseBarrier: (() => void) | undefined;
  const reached = new Promise<void>((resolve) => {
    signalReached = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    releaseBarrier = resolve;
  });
  const delayed = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "begin") return Reflect.get(target, property, receiver);
      return async (operation: (tx: GrowthTransaction) => Promise<unknown>) => {
        signalReached?.();
        await barrier;
        return target.begin(operation);
      };
    },
  });
  const pending = createGmailConfirmation(
    delayed,
    resolveClient,
  )(reservationId);
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        reached,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("proof race barrier not reached")),
            5000,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    await admin.begin(async (tx) => {
      await tx`alter table growth.outreach_reservations disable trigger protect_direct_submission_evidence`;
      await tx`update growth.outreach_reservations set direct_submission_evidence=null where id=${reservationId}`;
      await tx`alter table growth.outreach_reservations enable trigger protect_direct_submission_evidence`;
    });
    releaseBarrier?.();
    assert.deepEqual(await pending, {
      status: "held",
      reason: "direct_submission_unproven",
    });
    const [state] = await admin<
      { receipt: unknown }[]
    >`select confirmation_receipt as receipt from growth.outreach_reservations where id=${reservationId}`;
    assert.equal(state?.receipt, null);
  } finally {
    releaseBarrier?.();
    await Promise.allSettled([pending]);
    await admin.begin(async (tx) => {
      await tx`alter table growth.outreach_reservations disable trigger protect_direct_submission_evidence`;
      await tx`update growth.outreach_reservations set direct_submission_evidence=${tx.json(stored.evidence)} where id=${reservationId}`;
      await tx`alter table growth.outreach_reservations enable trigger protect_direct_submission_evidence`;
    });
  }
}
