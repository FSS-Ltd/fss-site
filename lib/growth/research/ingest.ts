import type { GrowthDb } from "../db/types";
import {
  EMAIL_ASSET_FALLBACKS,
  type EmailAssetFallbackKey,
} from "../email/assets/fallbacks";
import {
  postgresResearchIngestionRepository,
  type ResearchIngestionRepository,
  type ResearchVisualSelection,
} from "./repository";
import type {
  ResearchProspectCandidate,
  ResearchRunIngestion,
  ResearchRunIngestionResult,
} from "./types";

export class ResearchIngestionError extends Error {
  constructor(
    public readonly code: "invalid_asset_reference" | "suppressed_contact",
    message: string,
  ) {
    super(message);
    this.name = "ResearchIngestionError";
  }
}

function isFallbackKey(value: string): value is EmailAssetFallbackKey {
  return Object.hasOwn(EMAIL_ASSET_FALLBACKS, value);
}

function selectVisual(
  candidate: ResearchProspectCandidate,
): ResearchVisualSelection {
  const { visual } = candidate;
  if (visual.assetId !== null) {
    throw new ResearchIngestionError(
      "invalid_asset_reference",
      "Custom assets must be uploaded after the research run creates its prospect IDs.",
    );
  }

  if (!isFallbackKey(visual.fallbackAssetKey)) {
    throw new ResearchIngestionError(
      "invalid_asset_reference",
      "The selected email fallback asset is not available.",
    );
  }

  const fallback = EMAIL_ASSET_FALLBACKS[visual.fallbackAssetKey];
  return {
    kind: "fallback",
    fallbackAssetKey: fallback.key,
    pathname: fallback.pathname,
    sha256: fallback.sha256,
    altText: fallback.altText,
    conceptDisclaimer: visual.conceptDisclaimer,
  };
}

export function createResearchRunIngester(
  repository: ResearchIngestionRepository,
): (
  db: GrowthDb,
  input: ResearchRunIngestion,
) => Promise<ResearchRunIngestionResult> {
  return async (db, input) => {
    const visuals = input.prospects.map(selectVisual);

    return repository.withTransaction(db, async (transaction) => {
      await transaction.lockExternalRun(input.externalRunId);
      const existing = await transaction.findRunResult(input.externalRunId);
      if (existing !== null) {
        return existing;
      }

      await transaction.lockCandidateIdentities(input.prospects);
      const runId = await transaction.insertRun(input);
      let accepted = 0;
      let duplicates = 0;

      for (const [candidateIndex, candidate] of input.prospects.entries()) {
        const inspection = await transaction.inspectCandidate(candidate);
        if (inspection.kind === "suppressed_contact") {
          throw new ResearchIngestionError(
            "suppressed_contact",
            "The candidate address is suppressed.",
          );
        }
        if (
          inspection.kind === "duplicate_business" ||
          inspection.kind === "duplicate_contact"
        ) {
          duplicates += 1;
          continue;
        }

        const inserted = await transaction.insertCandidateCore({
          runId,
          candidate,
        });
        const visual = visuals[candidateIndex]!;
        await transaction.insertCandidateDetails({
          runId,
          candidateIndex,
          candidate,
          inserted,
          visual,
          externalRunId: input.externalRunId,
          promptVersion: input.promptVersion,
        });
        await transaction.appendProspectAuditEvent({
          externalRunId: input.externalRunId,
          prospectId: inserted.prospectId,
          fitScore: candidate.prospect.fitScore,
        });
        accepted += 1;
      }

      await transaction.completeRun(runId, {
        accepted,
        duplicates,
        rejected: input.rejections.length,
      });
      await transaction.appendRunAuditEvent({
        externalRunId: input.externalRunId,
        runId,
      });
      return transaction.readRunResult(runId);
    });
  };
}

export const ingestResearchRun = createResearchRunIngester(
  postgresResearchIngestionRepository,
);
