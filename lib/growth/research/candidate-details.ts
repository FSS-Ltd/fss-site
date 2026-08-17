import type { GrowthTransaction } from "../db/types";
import type { InsertCandidateDetailsInput } from "./repository-types";

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
