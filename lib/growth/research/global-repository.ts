import type { GrowthTransaction } from "../db/types";
import type {
  CandidateInspection,
  InsertedResearchCandidate,
} from "./repository-types";
import type {
  GlobalResearchCandidate,
  GlobalResearchRun,
} from "./global-schema";
import { businessWebsiteHost, normalizeRegistration } from "./global-identity";

export async function inspectGlobalCandidate(
  tx: GrowthTransaction,
  candidate: GlobalResearchCandidate,
): Promise<CandidateInspection> {
  const email = candidate.contact.email.trim().toLowerCase();
  const registration = normalizeRegistration(candidate.business.companyNumber);
  const host = businessWebsiteHost(
    candidate.business.websiteUrl ?? candidate.business.firstPartySourceUrl,
  );
  const rows = await tx<
    Array<{
      suppressed: boolean;
      businessExists: boolean;
      contactExists: boolean;
    }>
  >`
    select
      (exists (select 1 from growth.suppressions where normalised_email = ${email})
        or exists (select 1 from growth.contacts c
          join growth.prospects p on p.primary_contact_id = c.id
          where c.normalised_email = ${email} and p.status = 'suppressed')) as suppressed,
      exists (select 1 from growth.businesses b where
        (${registration}::text is not null and b.country_code = ${candidate.business.countryCode}
          and upper(regexp_replace(b.company_number, '[[:space:]]+', '', 'g')) = ${registration})
        or (${candidate.business.googlePlaceId}::text is not null and b.google_place_id = ${candidate.business.googlePlaceId})
        or (${host}::text is not null and substring(lower(coalesce(b.website_url, b.first_party_source_url)) from '^https?://(?:www[.])?([^/:?#]+)') = ${host})
      ) as "businessExists",
      exists (select 1 from growth.contacts where normalised_email = ${email}) as "contactExists"
  `;
  const row = rows[0];
  if (!row) throw new Error("Candidate inspection returned no result.");
  if (row.suppressed) return { kind: "suppressed_contact" };
  if (row.businessExists) return { kind: "duplicate_business" };
  return { kind: row.contactExists ? "duplicate_contact" : "accept" };
}

export async function insertGlobalCandidate(
  tx: GrowthTransaction,
  runId: string,
  candidate: GlobalResearchCandidate,
): Promise<InsertedResearchCandidate> {
  const { business, contact, prospect } = candidate;
  const rows = await tx<Array<InsertedResearchCandidate>>`
    with business as (
      insert into growth.businesses (
        legal_name, trading_name, company_number, country_code, corporate_type,
        corporate_status, sector, locality, county, website_url, google_place_id,
        google_maps_reference_url, first_party_source_url, verified_at
      ) values (
        ${business.legalName}, ${business.tradingName}, ${normalizeRegistration(business.companyNumber)},
        ${business.countryCode}, ${business.corporateType}, ${business.corporateStatus},
        ${business.sector}, ${business.locality}, ${business.county}, ${business.websiteUrl},
        ${business.googlePlaceId}, ${business.googleMapsReferenceUrl}, ${business.firstPartySourceUrl}, ${business.verifiedAt}
      ) returning id
    ), contact as (
      insert into growth.contacts (
        business_id, first_name, last_name, role_title, email, email_source_url,
        email_verified_at, subscriber_type, lawful_basis
      ) select id, ${contact.firstName}, ${contact.lastName}, ${contact.roleTitle},
        ${contact.email}, ${contact.emailSourceUrl}, ${contact.emailVerifiedAt}, ${contact.subscriberType}, 'research_only'
      from business returning id, business_id
    ), prospect as (
      insert into growth.prospects (
        business_id, primary_contact_id, research_run_id, status, fit_score,
        opportunity_summary, recommended_offer, estimated_one_off_min_pence,
        estimated_one_off_max_pence, estimated_monthly_pence, next_action,
        next_action_due_at, assigned_owner_email
      ) select business_id, id, ${runId}, 'ready_for_email_review', ${prospect.fitScore},
        ${prospect.opportunitySummary}, ${prospect.recommendedOffer}, ${prospect.estimatedOneOffMinPence},
        ${prospect.estimatedOneOffMaxPence}, ${prospect.estimatedMonthlyPence},
        ${prospect.nextAction}, ${prospect.nextActionDueAt}, 'j.ntagengwa@faithfulsoftware.dev'
      from contact returning id, business_id, primary_contact_id
    ) select id as "prospectId", business_id as "businessId", primary_contact_id as "contactId" from prospect
  `;
  const row = rows[0];
  if (!row) throw new Error("Global candidate insert returned no result.");
  return row;
}

export async function insertGlobalCandidateDetails(
  tx: GrowthTransaction,
  input: {
    run: GlobalResearchRun;
    runId: string;
    candidateIndex: number;
    candidate: GlobalResearchCandidate;
    prospectId: string;
  },
): Promise<void> {
  const { run, runId, candidateIndex, candidate, prospectId } = input;
  for (const evidence of candidate.evidence) {
    await tx`
      insert into growth.source_evidence (
        prospect_id, research_run_id, source_type, source_url, external_reference,
        claim_type, claim_summary, observed_at, verified_at, retention_class
      ) values (
        ${prospectId}, ${runId}, ${evidence.sourceType}, ${evidence.sourceUrl},
        ${evidence.externalReference}, ${evidence.claimType}, ${evidence.claimSummary},
        ${evidence.observedAt}, ${evidence.verifiedAt}, ${evidence.retentionClass}
      )
    `;
  }
  await tx`
    insert into growth.agent_tasks (
      research_run_id, prospect_id, task_type, status, input_snapshot,
      output_snapshot, attempt_count, completed_at, idempotency_key
    ) values (
      ${runId}, ${prospectId}, 'first_email_draft', 'completed',
      ${tx.json({ schemaVersion: "2.0", promptVersion: run.promptVersion, candidateIndex, evidenceCount: candidate.evidence.length })},
      ${tx.json({ schemaVersion: "2.0", reviewState: "research_only", email: candidate.firstEmail })},
      1, now(), ${`${run.externalRunId}:candidate:${candidateIndex}:first-email-draft`}
    )
  `;
}
