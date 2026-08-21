import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb, GrowthQueryExecutor } from "../db/types";
import { stopSequence as defaultStopSequence } from "../sequences/stop";

export type PauseAllActiveAutomationsInput = {
  founder: FounderSession;
  correlationId: string;
};

export type PauseAllActiveAutomationsResult = {
  pausedSequenceCount: number;
};

export async function listActiveSequenceIds(
  db: GrowthQueryExecutor,
): Promise<readonly string[]> {
  const rows = await db<{ id: string }[]>`
    select id from growth.sequence_enrollments where status = 'active'
  `;
  return rows.map((row) => row.id);
}

type PauseAllActiveAutomationsDependencies = {
  listActiveSequenceIds: typeof listActiveSequenceIds;
  stopSequence: typeof defaultStopSequence;
};

/** Pauses every currently active outreach sequence, one at a time through the
 * same `stopSequence(reason: "pause")` path a founder uses to pause a single
 * sequence, so the effect (cancelled pending messages, resumable "paused"
 * state, "sequence.stopped.pause" audit event) is identical either way. This
 * cannot touch `GROWTH_OS_AUTOMATIONS_ENABLED` — that is a Vercel
 * environment variable, not a database row. */
export function createAutomationPauser({
  listActiveSequenceIds,
  stopSequence,
}: PauseAllActiveAutomationsDependencies) {
  return async function pauseAllActiveAutomations(
    db: GrowthDb,
    input: PauseAllActiveAutomationsInput,
  ): Promise<PauseAllActiveAutomationsResult> {
    const sequenceIds = await listActiveSequenceIds(db);
    let pausedSequenceCount = 0;

    for (const sequenceId of sequenceIds) {
      const result = await stopSequence(db, {
        sequenceId,
        reason: "pause",
        actor: input.founder,
        correlationId: input.correlationId,
      });
      if (!result.alreadyApplied) pausedSequenceCount += 1;
    }

    return { pausedSequenceCount };
  };
}

export const pauseAllActiveAutomations = createAutomationPauser({
  listActiveSequenceIds,
  stopSequence: defaultStopSequence,
});
