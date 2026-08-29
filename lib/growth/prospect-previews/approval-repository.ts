import type postgres from "postgres";

import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthTransaction } from "../db/types";
import type {
  ProspectPreviewApprovalRepository,
  ProspectPreviewApprovalTransaction,
} from "./approval";

export class ProspectPreviewApprovalPersistenceError extends Error {
  constructor() {
    super("The prospect preview approval could not be stored.");
    this.name = "ProspectPreviewApprovalPersistenceError";
  }
}

function toJsonValue(value: unknown): postgres.JSONValue {
  return JSON.parse(JSON.stringify(value)) as postgres.JSONValue;
}

function createTransaction(
  transaction: GrowthTransaction,
): ProspectPreviewApprovalTransaction {
  return {
    async lockApprovalState(prospectId) {
      const rows = await transaction<
        Array<{
          businessName: string;
          prospectId: string;
          prospectStatus: string;
          prospectVersion: number;
          previewId: string;
          publicId: string;
          slug: string | null;
          compositionDigest: string | null;
          generationStatus: string;
          previewStatus: string;
          previewVersion: number;
          assessmentStatus: string;
          trustSignals: unknown;
          conversionPlan: unknown;
          firstPartyEvidenceUrl: string | null;
          draftId: string;
          draftStatus: string;
          outputSnapshot: unknown;
          completedAt: Date | null;
        }>
      >`
        select
          p.id as "prospectId",
          coalesce(b.trading_name, b.legal_name) as "businessName",
          p.status as "prospectStatus",
          p.version as "prospectVersion",
          pp.id as "previewId",
          pp.public_id as "publicId",
          pp.slug,
          pp.composition_digest as "compositionDigest",
          pp.generation_status as "generationStatus",
          pp.status as "previewStatus",
          pp.version as "previewVersion",
          wa.status as "assessmentStatus",
          wa.trust_signals as "trustSignals",
          wa.conversion_plan as "conversionPlan",
          (
            select se.source_url
            from growth.source_evidence se
            where se.prospect_id = p.id
              and se.source_type = 'first_party'
            order by se.verified_at desc, se.created_at desc
            limit 1
          ) as "firstPartyEvidenceUrl",
          at.id as "draftId",
          at.status as "draftStatus",
          at.output_snapshot as "outputSnapshot",
          at.completed_at as "completedAt"
        from growth.prospects p
        inner join growth.businesses b on b.id = p.business_id
        inner join growth.prospect_previews pp on pp.prospect_id = p.id
        inner join growth.website_assessments wa on wa.prospect_id = p.id
        inner join growth.agent_tasks at on (
          at.prospect_id = p.id
          and at.task_type = 'first_email_draft'
        )
        where p.id = ${prospectId}
        order by at.completed_at desc nulls last, at.created_at desc
        limit 1
        for update of p, pp, wa, at
      `;
      const row = rows[0];
      if (!row) return null;

      const enrollmentRows = await transaction<Array<{ exists: boolean }>>`
        select exists (
          select 1
          from growth.sequence_enrollments se
          where se.prospect_id = ${row.prospectId}
        ) as exists
      `;

      return {
        prospect: {
          businessName: row.businessName,
          id: row.prospectId,
          status: row.prospectStatus,
          version: row.prospectVersion,
        },
        preview: {
          id: row.previewId,
          publicId: row.publicId,
          slug: row.slug,
          compositionDigest: row.compositionDigest,
          generationStatus: row.generationStatus,
          status: row.previewStatus,
          version: row.previewVersion,
        },
        assessment: {
          status: row.assessmentStatus,
          trustSignals: row.trustSignals,
          conversionPlan: row.conversionPlan,
          firstPartyEvidenceUrl: row.firstPartyEvidenceUrl,
        },
        draft: {
          id: row.draftId,
          prospectId: row.prospectId,
          status: row.draftStatus,
          outputSnapshot: row.outputSnapshot,
          completedAt: row.completedAt,
          hasEnrollment: enrollmentRows[0]?.exists === true,
        },
      };
    },

    async publishPreviewAndSaveEmail(input) {
      const prospectRows = await transaction<Array<{ id: string }>>`
        update growth.prospects
        set version = version + 1,
            updated_at = now()
        where id = ${input.prospectId}
          and version = ${input.expectedProspectVersion}
        returning id
      `;
      if (!prospectRows[0]) {
        throw new ProspectPreviewApprovalPersistenceError();
      }

      const previewRows = await transaction<Array<{ id: string }>>`
        update growth.prospect_previews
        set status = 'published',
            generation_status = ${input.publishedPreviewGenerationStatus},
            slug = ${input.previewSlug},
            approved_at = ${input.approvedAt},
            approved_by = ${input.approvedBy},
            withdrawn_at = null,
            version = version + 1,
            updated_at = now()
        where id = ${input.previewId}
          and status = 'draft'
          and generation_status = ${input.expectedPreviewGenerationStatus}
          and version = ${input.expectedPreviewVersion}
        returning id
      `;
      if (!previewRows[0]) {
        throw new ProspectPreviewApprovalPersistenceError();
      }

      const draftRows = await transaction<Array<{ id: string }>>`
        update growth.agent_tasks
        set output_snapshot = ${transaction.json(
          toJsonValue(input.outputSnapshot),
        )},
            updated_at = now()
        where id = ${input.draftTaskId}
          and task_type = 'first_email_draft'
          and status = 'completed'
        returning id
      `;
      if (!draftRows[0]) {
        throw new ProspectPreviewApprovalPersistenceError();
      }
    },

    appendApprovalAudit(input) {
      return appendAuditEvent(transaction, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.actorId,
        action: "prospect_preview.approved",
        entityType: "prospect_preview",
        entityId: input.previewId,
        metadata: { approved: true },
      });
    },
  };
}

export const postgresProspectPreviewApprovalRepository: ProspectPreviewApprovalRepository =
  {
    withTransaction(db, operation) {
      return withGrowthTransaction(db, (transaction) =>
        operation(createTransaction(transaction)),
      );
    },
  };
