import type { GrowthTransaction } from "../db/types";
import type { InsertCandidateDetailsInput } from "./repository-types";

const previewEvidenceKindByCandidateKind = {
  logo: "logo",
  "brand-colours": "brand_colours",
  "service-language": "service_language",
  "on-site-image": "on_site_image",
} as const;

export async function insertCandidateDetails(
  tx: GrowthTransaction,
  input: InsertCandidateDetailsInput,
): Promise<void> {
  const {
    runId,
    candidateIndex,
    candidate,
    inserted,
    visual,
    externalRunId,
    promptVersion,
  } = input;

  for (const evidence of candidate.evidence) {
    await tx`
      insert into growth.source_evidence (
        prospect_id,
        research_run_id,
        source_type,
        source_url,
        external_reference,
        claim_type,
        claim_summary,
        observed_at,
        verified_at,
        retention_class
      ) values (
        ${inserted.prospectId},
        ${runId},
        ${evidence.sourceType},
        ${evidence.sourceUrl},
        ${evidence.externalReference},
        ${evidence.claimType},
        ${evidence.claimSummary},
        ${evidence.observedAt},
        ${evidence.verifiedAt},
        ${evidence.retentionClass}
      )
    `;
  }

  for (const evidence of candidate.brandEvidence ?? []) {
    await tx`
      insert into growth.prospect_preview_evidence (
        id,
        prospect_id,
        research_run_id,
        evidence_kind,
        source_url,
        evidence_text,
        observed_at
      ) values (
        ${evidence.id},
        ${inserted.prospectId},
        ${runId},
        ${previewEvidenceKindByCandidateKind[evidence.kind]},
        ${evidence.sourceUrl},
        ${evidence.evidenceText},
        ${evidence.observedAt}
      )
    `;
  }

  const assessment = candidate.assessment;
  await tx`
    insert into growth.website_assessments (
      prospect_id,
      business_goal,
      primary_cta,
      sitemap,
      homepage_sections,
      conversion_plan,
      local_seo_plan,
      trust_signals,
      technology_plan,
      future_opportunities,
      hero_concept,
      mobile_fallback,
      performance_budget,
      experience_brief,
      status
    ) values (
      ${inserted.prospectId},
      ${assessment.businessGoal},
      ${assessment.primaryCta},
      ${tx.json(assessment.sitemap)},
      ${tx.json(assessment.homepageSections)},
      ${tx.json(assessment.conversionPlan)},
      ${tx.json(assessment.localSeoPlan)},
      ${tx.json(assessment.trustSignals)},
      ${tx.json(assessment.technologyPlan)},
      ${tx.json(assessment.futureOpportunities)},
      ${tx.json(assessment.heroConcept)},
      ${tx.json(assessment.mobileFallback)},
      ${tx.json(assessment.performanceBudget)},
      ${
        assessment.experienceBrief === undefined
          ? null
          : tx.json(assessment.experienceBrief)
      },
      'pending_review'
    )
  `;

  const inputSnapshot = {
    schemaVersion: "1.0",
    promptVersion,
    candidateIndex,
    evidenceCount: candidate.evidence.length,
  };
  const outputSnapshot = {
    schemaVersion: "1.0",
    email: candidate.firstEmail,
    emailNarrative: candidate.emailNarrative,
    visual,
  };
  await tx`
    insert into growth.agent_tasks (
      research_run_id,
      prospect_id,
      task_type,
      status,
      input_snapshot,
      output_snapshot,
      attempt_count,
      completed_at,
      idempotency_key
    ) values (
      ${runId},
      ${inserted.prospectId},
      'first_email_draft',
      'completed',
      ${tx.json(inputSnapshot)},
      ${tx.json(outputSnapshot)},
      1,
      now(),
      ${`${externalRunId}:candidate:${candidateIndex}:first-email-draft`}
    )
  `;
}
