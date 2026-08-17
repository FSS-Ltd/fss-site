import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import { insertCandidateDetails } from "./candidate-details";
import type {
  ResearchIngestionRepository,
  ResearchIngestionTransaction,
} from "./repository-types";

export type {
  CandidateInspection,
  InsertedResearchCandidate,
  ResearchIngestionRepository,
  ResearchIngestionTransaction,
  ResearchRunRecord,
  ResearchVisualSelection,
} from "./repository-types";

function normaliseCompanyNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function candidateIdentityLockKeys(
  candidates: readonly {
    business: { companyNumber: string };
    contact: { email: string };
  }[],
): string[] {
  return [
    ...candidates.map(
      (candidate) =>
        `growth:business:${normaliseCompanyNumber(candidate.business.companyNumber)}`,
    ),
    ...candidates.map(
      (candidate) =>
        `growth:contact:${normaliseEmail(candidate.contact.email)}`,
    ),
  ].sort();
}

function createPostgresTransaction(
  tx: GrowthTransaction,
): ResearchIngestionTransaction {
  return {
    async lockExternalRun(externalRunId) {
      await tx`
        select pg_advisory_xact_lock(
          hashtextextended(${`growth:research-run:${externalRunId}`}, 0)
        )
      `;
    },

    async findRunResult(externalRunId) {
      const rows = await tx<
        Array<{
          runId: string;
          accepted: number;
          duplicates: number;
          rejected: number;
          acceptedProspects: Array<{
            candidateIndex: number;
            prospectId: string;
          }>;
        }>
      >`
        select
          rr.id as "runId",
          rr.accepted_count as accepted,
          rr.duplicate_count as duplicates,
          rr.rejected_count as rejected,
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'candidateIndex',
                (task.input_snapshot ->> 'candidateIndex')::integer,
                'prospectId',
                task.prospect_id
              )
              order by (task.input_snapshot ->> 'candidateIndex')::integer
            )
            from growth.agent_tasks task
            where task.research_run_id = rr.id
              and task.task_type = 'first_email_draft'
          ), '[]'::jsonb) as "acceptedProspects"
        from growth.research_runs rr
        where rr.external_run_id = ${externalRunId}
          and rr.status = 'completed'
        limit 1
      `;
      const row = rows[0];
      return row === undefined ? null : { ok: true, ...row };
    },

    async lockCandidateIdentities(candidates) {
      for (const lockKey of new Set(candidateIdentityLockKeys(candidates))) {
        await tx`
          select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `;
      }
    },

    async insertRun(input) {
      const rows = await tx<Array<{ id: string }>>`
        insert into growth.research_runs (
          external_run_id,
          run_date,
          timezone,
          status,
          target_count,
          rejected_count,
          prompt_version,
          started_at
        ) values (
          ${input.externalRunId},
          ${input.runDate},
          ${input.timezone},
          'processing',
          ${input.prospects.length + input.rejections.length},
          ${input.rejections.length},
          ${input.promptVersion},
          now()
        )
        returning id
      `;
      const row = rows[0];
      if (row === undefined) {
        throw new Error("Research run insert returned no ID.");
      }
      return row.id;
    },

    async inspectCandidate(candidate) {
      const companyNumber = normaliseCompanyNumber(
        candidate.business.companyNumber,
      );
      const email = normaliseEmail(candidate.contact.email);

      const suppressed = await tx<Array<{ suppressed: boolean }>>`
        select exists (
          select 1
          from growth.contacts c
          inner join growth.prospects p on p.primary_contact_id = c.id
          where c.normalised_email = ${email}
            and p.status = 'suppressed'
        ) as suppressed
      `;
      if (suppressed[0]?.suppressed === true) {
        return { kind: "suppressed_contact" };
      }

      const businesses = await tx<Array<{ exists: boolean }>>`
        select exists (
          select 1
          from growth.businesses b
          where upper(regexp_replace(b.company_number, '\s+', '', 'g')) = ${companyNumber}
        ) as exists
      `;
      if (businesses[0]?.exists === true) {
        return { kind: "duplicate_business" };
      }

      const contacts = await tx<Array<{ exists: boolean }>>`
        select exists (
          select 1
          from growth.contacts c
          where c.normalised_email = ${email}
        ) as exists
      `;
      return contacts[0]?.exists === true
        ? { kind: "duplicate_contact" }
        : { kind: "accept" };
    },

    async insertCandidateCore({ runId, candidate }) {
      const businessRows = await tx<Array<{ id: string }>>`
        insert into growth.businesses (
          legal_name,
          trading_name,
          company_number,
          corporate_type,
          corporate_status,
          sector,
          locality,
          county,
          website_url,
          google_place_id,
          google_maps_reference_url,
          first_party_source_url,
          verified_at
        ) values (
          ${candidate.business.legalName},
          ${candidate.business.tradingName},
          ${candidate.business.companyNumber},
          ${candidate.business.corporateType},
          ${candidate.business.corporateStatus},
          ${candidate.business.sector},
          ${candidate.business.locality},
          ${candidate.business.county},
          ${candidate.business.websiteUrl},
          ${candidate.business.googlePlaceId},
          ${candidate.business.googleMapsReferenceUrl},
          ${candidate.business.firstPartySourceUrl},
          ${candidate.business.verifiedAt}
        )
        returning id
      `;
      const businessId = businessRows[0]?.id;
      if (businessId === undefined) {
        throw new Error("Business insert returned no ID.");
      }

      const contactRows = await tx<Array<{ id: string }>>`
        insert into growth.contacts (
          business_id,
          first_name,
          last_name,
          role_title,
          email,
          email_source_url,
          email_verified_at,
          subscriber_type,
          lawful_basis
        ) values (
          ${businessId},
          ${candidate.contact.firstName},
          ${candidate.contact.lastName},
          ${candidate.contact.roleTitle},
          ${candidate.contact.email},
          ${candidate.contact.emailSourceUrl},
          ${candidate.contact.emailVerifiedAt},
          ${candidate.contact.subscriberType},
          ${candidate.contact.lawfulBasis}
        )
        returning id
      `;
      const contactId = contactRows[0]?.id;
      if (contactId === undefined) {
        throw new Error("Contact insert returned no ID.");
      }

      const prospectRows = await tx<Array<{ id: string }>>`
        insert into growth.prospects (
          business_id,
          primary_contact_id,
          research_run_id,
          status,
          fit_score,
          opportunity_summary,
          recommended_offer,
          estimated_one_off_min_pence,
          estimated_one_off_max_pence,
          estimated_monthly_pence,
          next_action,
          next_action_due_at,
          assigned_owner_email
        ) values (
          ${businessId},
          ${contactId},
          ${runId},
          'ready_for_email_review',
          ${candidate.prospect.fitScore},
          ${candidate.prospect.opportunitySummary},
          ${candidate.prospect.recommendedOffer},
          ${candidate.prospect.estimatedOneOffMinPence},
          ${candidate.prospect.estimatedOneOffMaxPence},
          ${candidate.prospect.estimatedMonthlyPence},
          ${candidate.prospect.nextAction},
          ${candidate.prospect.nextActionDueAt},
          'j.ntagengwa@faithfulsoftware.dev'
        )
        returning id
      `;
      const prospectId = prospectRows[0]?.id;
      if (prospectId === undefined) {
        throw new Error("Prospect insert returned no ID.");
      }

      return { businessId, contactId, prospectId };
    },

    insertCandidateDetails(input) {
      return insertCandidateDetails(tx, input);
    },

    async appendProspectAuditEvent({ externalRunId, prospectId, fitScore }) {
      await appendAuditEvent(tx, {
        correlationId: externalRunId,
        actorType: "agent",
        actorId: "weekday-agent-v1",
        action: "prospect.research_ingested",
        entityType: "prospect",
        entityId: prospectId,
        metadata: { fitScore },
      });
    },

    async completeRun(runId, counts) {
      await tx`
        update growth.research_runs
        set status = 'completed',
            accepted_count = ${counts.accepted},
            duplicate_count = ${counts.duplicates},
            rejected_count = ${counts.rejected},
            completed_at = now(),
            error_code = null,
            error_summary = null
        where id = ${runId}
      `;
    },

    async appendRunAuditEvent({ externalRunId, runId }) {
      await appendAuditEvent(tx, {
        correlationId: externalRunId,
        actorType: "agent",
        actorId: "weekday-agent-v1",
        action: "research_run.completed",
        entityType: "research_run",
        entityId: runId,
      });
    },

    async readRunResult(runId) {
      const rows = await tx<
        Array<{
          runId: string;
          accepted: number;
          duplicates: number;
          rejected: number;
          acceptedProspects: Array<{
            candidateIndex: number;
            prospectId: string;
          }>;
        }>
      >`
        select
          rr.id as "runId",
          rr.accepted_count as accepted,
          rr.duplicate_count as duplicates,
          rr.rejected_count as rejected,
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'candidateIndex',
                (task.input_snapshot ->> 'candidateIndex')::integer,
                'prospectId',
                task.prospect_id
              )
              order by (task.input_snapshot ->> 'candidateIndex')::integer
            )
            from growth.agent_tasks task
            where task.research_run_id = rr.id
              and task.task_type = 'first_email_draft'
          ), '[]'::jsonb) as "acceptedProspects"
        from growth.research_runs rr
        where rr.id = ${runId}
          and rr.status = 'completed'
      `;
      const row = rows[0];
      if (row === undefined) {
        throw new Error("Completed research run could not be read.");
      }
      return { ok: true, ...row };
    },
  };
}

export const postgresResearchIngestionRepository: ResearchIngestionRepository =
  {
    withTransaction(db, operation) {
      return withGrowthTransaction(db, (tx) =>
        operation(createPostgresTransaction(tx)),
      );
    },
  };
