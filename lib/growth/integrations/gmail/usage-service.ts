import type { GrowthDb } from "../../db/types";
import {
  commitGmailUsage,
  startGmailUsageObservation,
} from "../../campaigns/usage-repository";
import type { GmailGrantBinding } from "./live-client";
import { observeGmailUsage, type UsageResult } from "./usage";
import type { GmailClient } from "./types";

const DAY = 86_400_000;

export async function refreshGmailUsage(
  db: GrowthDb,
  input: {
    binding: GmailGrantBinding;
    subjectEmail: string;
    client: Pick<
      GmailClient,
      "getProfile" | "listSentMessages" | "listHistory" | "getMessageMetadata"
    >;
    now?: () => Date;
  },
): Promise<{ status: "complete" } | { status: "held"; reason: string }> {
  const started = await startGmailUsageObservation(
    db,
    input.binding,
    input.subjectEmail,
  );
  if (started.legacyUnknown)
    return { status: "held", reason: "legacy_usage_unreconciled" };
  const now = input.now ?? (() => new Date());
  let result: UsageResult;
  try {
    result = await observeGmailUsage({
      client: input.client,
      binding: input.binding,
      subjectEmail: input.subjectEmail,
      prior: started.prior,
      now,
    });
  } catch {
    return { status: "held", reason: "provider_incomplete" };
  }
  if (!started.prior && started.retained.length) {
    const retained = started.retained.filter(
      (entry) =>
        Date.parse(entry.observedUpperBound) >
        result.state.capturedAt.getTime() - DAY,
    );
    const combined = new Map(
      retained.map((entry) => [entry.transitionId, entry]),
    );
    let ambiguous = false;
    for (const entry of result.state.observations) {
      if (combined.has(entry.transitionId)) {
        ambiguous = true;
        continue;
      }
      combined.set(entry.transitionId, entry);
    }
    if (ambiguous || combined.size > 1000) {
      const end = now();
      if (!Number.isFinite(end.getTime()) || end < result.state.baselineAt)
        return { status: "held", reason: "provider_incomplete" };
      result = {
        status: "held",
        reason: "transition_limit",
        state: { ...result.state, baselineAt: end, observations: retained },
      };
    } else {
      result.state.observations = [...combined.values()];
    }
  }
  return commitGmailUsage(db, {
    binding: input.binding,
    subjectEmail: input.subjectEmail,
    expectedRevision: started.revision,
    result,
  });
}
