import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { ResearchIngestionError } from "./errors";
import { globalCandidateIdentityKeys } from "./global-identity";
import {
  globalResearchRunSchema,
  type GlobalResearchRun,
} from "./global-schema";
import {
  inspectGlobalCandidate,
  insertGlobalCandidate,
  insertGlobalCandidateDetails,
} from "./global-repository";
import { createPostgresResearchTransaction } from "./repository";
import type { ResearchRunIngestionResult } from "./types";

export async function ingestGlobalResearchRun(
  db: GrowthDb,
  input: GlobalResearchRun,
): Promise<ResearchRunIngestionResult> {
  const run = globalResearchRunSchema.parse(input);
  return withGrowthTransaction(db, async (tx) => {
    const common = createPostgresResearchTransaction(tx);
    await common.lockExternalRun(run.externalRunId);
    const existing = await common.findRunResult(run.externalRunId);
    if (existing) return existing;

    const keys = [
      ...new Set(run.prospects.flatMap(globalCandidateIdentityKeys)),
    ].sort();
    for (const key of keys) {
      await tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    }
    const runId = await common.insertRun(run);
    let accepted = 0;
    let duplicates = 0;
    for (const [candidateIndex, candidate] of run.prospects.entries()) {
      const inspection = await inspectGlobalCandidate(tx, candidate);
      if (inspection.kind === "suppressed_contact") {
        throw new ResearchIngestionError(
          "suppressed_contact",
          "The candidate address is suppressed.",
        );
      }
      if (inspection.kind !== "accept") {
        duplicates += 1;
        continue;
      }
      const inserted = await insertGlobalCandidate(tx, runId, candidate);
      await insertGlobalCandidateDetails(tx, {
        run,
        runId,
        candidateIndex,
        candidate,
        prospectId: inserted.prospectId,
      });
      await common.appendProspectAuditEvent({
        externalRunId: run.externalRunId,
        prospectId: inserted.prospectId,
        fitScore: candidate.prospect.fitScore,
      });
      accepted += 1;
    }
    await common.completeRun(runId, {
      accepted,
      duplicates,
      rejected: run.rejections.length,
    });
    await common.appendRunAuditEvent({
      externalRunId: run.externalRunId,
      runId,
    });
    return common.readRunResult(runId);
  });
}
