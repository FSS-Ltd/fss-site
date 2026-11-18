import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import type { SignedResearchPrincipal } from "./route-handler";
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
  principal?: SignedResearchPrincipal,
): Promise<ResearchRunIngestionResult> {
  const run = globalResearchRunSchema.parse(input);
  if (!principal && run.prospects.some((candidate) => candidate.proof))
    throw new ResearchIngestionError(
      "signed_research_required",
      "Signed research is required for proof.",
    );
  if (
    principal &&
    (!principal.keyId.trim() ||
      principal.keyId.length > 200 ||
      !/^[a-f0-9]{64}$/.test(principal.bodySha256))
  )
    throw new ResearchIngestionError(
      "signed_research_required",
      "Signed research identity is invalid.",
    );
  return withGrowthTransaction(db, async (tx) => {
    const common = createPostgresResearchTransaction(tx, principal);
    await common.lockExternalRun(run.externalRunId);
    const existing = await common.findRunResult(run.externalRunId);
    if (existing) return existing;

    for (const candidate of run.prospects) {
      if (!candidate.proof) continue;
      const contactEvidence =
        candidate.evidence[candidate.proof.contactEmail.evidenceIndex];
      const observationEvidence =
        candidate.evidence[candidate.proof.businessObservation.evidenceIndex];
      if (!contactEvidence || !observationEvidence)
        throw new ResearchIngestionError(
          "invalid_proof",
          "Proof evidence is missing.",
        );
      const dates = [
        candidate.business.verifiedAt,
        candidate.contact.emailVerifiedAt,
        contactEvidence.observedAt,
        contactEvidence.verifiedAt,
        observationEvidence.observedAt,
        observationEvidence.verifiedAt,
      ];
      const now = Date.now();
      if (
        dates.some((date) => {
          const age = now - new Date(date).getTime();
          return age < 0 || age > 30 * 86400000;
        })
      )
        throw new ResearchIngestionError(
          "invalid_proof",
          "Proof dates must be current and nonfuture.",
        );
    }

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
      const evidenceIds = await insertGlobalCandidateDetails(tx, {
        run,
        runId,
        candidateIndex,
        candidate,
        prospectId: inserted.prospectId,
      });
      if (candidate.proof) {
        const contactEvidenceId =
          evidenceIds[candidate.proof.contactEmail.evidenceIndex];
        const observationEvidenceId =
          evidenceIds[candidate.proof.businessObservation.evidenceIndex];
        if (!contactEvidenceId || !observationEvidenceId)
          throw new Error("Proof evidence missing.");
        const [binding] = await tx<
          { id: string }[]
        >`insert into growth.research_source_proof_bindings (research_run_id, prospect_id, business_id, contact_id, prospect_version, contact_version, contact_evidence_id, observation_evidence_id)
          select ${runId}, p.id, p.business_id, c.id, p.version, c.version, ${contactEvidenceId}, ${observationEvidenceId}
          from growth.prospects p join growth.contacts c on c.id=p.primary_contact_id and c.business_id=p.business_id
          where p.id=${inserted.prospectId} and c.id=${inserted.contactId} returning id`;
        if (!binding) throw new Error("Proof binding insert returned no ID.");
      }
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
