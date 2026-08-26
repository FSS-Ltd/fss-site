import { randomBytes } from "node:crypto";

import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import { deriveHistoricalEmailNarrative } from "./content";
import {
  parseStoredProspectPreviewSnapshot,
  prospectPreviewAssessmentSectionSchema,
  type StoredProspectPreviewSnapshot,
} from "./types";

const TERMINAL_PROSPECT_STATUSES = new Set([
  "won",
  "lost",
  "rejected",
  "suppressed",
]);

export type BackfillProspectPreviewsResult = {
  scanned: number;
  created: number;
  skipped: number;
  invalid: number;
};

export type LockedProspectPreviewBackfillCandidate = {
  prospectId: string;
  prospectStatus: string;
  previewExists: boolean;
  assessmentStatus: string | null;
  businessName: string;
  sector: string;
  locality: string;
  businessGoal: string;
  primaryCta: string;
  homepageSections: unknown;
  conversionPlan: unknown;
  trustSignals: unknown;
  firstPartyEvidenceUrl: string | null;
};

export type InsertBackfillDraftPreviewInput = {
  prospectId: string;
  content: StoredProspectPreviewSnapshot;
};

export interface ProspectPreviewBackfillTransaction {
  lockCandidate(
    prospectId: string,
  ): Promise<LockedProspectPreviewBackfillCandidate | null>;
  insertDraftPreview(
    input: InsertBackfillDraftPreviewInput,
  ): Promise<boolean>;
  appendBackfillAudit(input: { prospectId: string }): Promise<void>;
}

export interface ProspectPreviewBackfillRepository {
  listProspectIds(db: GrowthDb): Promise<string[]>;
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: ProspectPreviewBackfillTransaction) => Promise<T>,
  ): Promise<T>;
}

function createPublicId(): string {
  return randomBytes(24).toString("base64url");
}

function isPublicIdUniqueKeyCollision(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as { code?: unknown; constraint_name?: unknown };
  return (
    candidate.code === "23505" &&
    candidate.constraint_name === "prospect_previews_public_id_key"
  );
}

function buildStoredSnapshot(
  candidate: LockedProspectPreviewBackfillCandidate,
): StoredProspectPreviewSnapshot | null {
  try {
    return parseStoredProspectPreviewSnapshot({
      schemaVersion: "1.0",
      businessName: candidate.businessName,
      sector: candidate.sector,
      locality: candidate.locality,
      businessGoal: candidate.businessGoal,
      primaryCta: candidate.primaryCta,
      homepageSections: candidate.homepageSections,
      conversionPlan: candidate.conversionPlan,
      trustSignals: candidate.trustSignals,
    });
  } catch {
    return null;
  }
}

function hasHistoricalNarrativeInputs(
  candidate: LockedProspectPreviewBackfillCandidate,
): boolean {
  const trustSignals = prospectPreviewAssessmentSectionSchema.safeParse(
    candidate.trustSignals,
  );
  const conversionPlan = prospectPreviewAssessmentSectionSchema.safeParse(
    candidate.conversionPlan,
  );
  if (
    !trustSignals.success ||
    !conversionPlan.success ||
    candidate.firstPartyEvidenceUrl === null
  ) {
    return false;
  }

  return (
    deriveHistoricalEmailNarrative({
      trustSignals: trustSignals.data,
      conversionPlan: conversionPlan.data,
      firstPartyEvidenceUrl: candidate.firstPartyEvidenceUrl,
    }) !== null
  );
}

export async function backfillProspectPreviews(
  db: GrowthDb,
  repository: ProspectPreviewBackfillRepository =
    postgresProspectPreviewBackfillRepository,
): Promise<BackfillProspectPreviewsResult> {
  const prospectIds = await repository.listProspectIds(db);
  const result: BackfillProspectPreviewsResult = {
    scanned: prospectIds.length,
    created: 0,
    skipped: 0,
    invalid: 0,
  };

  for (const prospectId of prospectIds) {
    const outcome = await repository.withTransaction(db, async (transaction) => {
      const candidate = await transaction.lockCandidate(prospectId);
      if (
        candidate === null ||
        candidate.previewExists ||
        candidate.assessmentStatus === null ||
        TERMINAL_PROSPECT_STATUSES.has(candidate.prospectStatus)
      ) {
        return "skipped" as const;
      }

      const content = buildStoredSnapshot(candidate);
      if (content === null || !hasHistoricalNarrativeInputs(candidate)) {
        return "invalid" as const;
      }

      const inserted = await transaction.insertDraftPreview({
        prospectId: candidate.prospectId,
        content,
      });
      if (!inserted) return "skipped" as const;

      await transaction.appendBackfillAudit({ prospectId: candidate.prospectId });
      return "created" as const;
    });

    result[outcome] += 1;
  }

  return result;
}

function createPostgresTransaction(
  transaction: GrowthTransaction,
): ProspectPreviewBackfillTransaction {
  return {
    async lockCandidate(prospectId) {
      const rows = await transaction<
        Array<LockedProspectPreviewBackfillCandidate>
      >`
        select
          p.id as "prospectId",
          p.status as "prospectStatus",
          pp.id is not null as "previewExists",
          wa.status as "assessmentStatus",
          coalesce(b.trading_name, b.legal_name) as "businessName",
          b.sector,
          b.locality,
          wa.business_goal as "businessGoal",
          wa.primary_cta as "primaryCta",
          wa.homepage_sections as "homepageSections",
          wa.conversion_plan as "conversionPlan",
          wa.trust_signals as "trustSignals",
          (
            select se.source_url
            from growth.source_evidence se
            where se.prospect_id = p.id
              and se.source_type = 'first_party'
            order by se.verified_at desc, se.created_at desc
            limit 1
          ) as "firstPartyEvidenceUrl"
        from growth.prospects p
        inner join growth.businesses b on b.id = p.business_id
        left join growth.website_assessments wa on wa.prospect_id = p.id
        left join growth.prospect_previews pp on pp.prospect_id = p.id
        where p.id = ${prospectId}
        for update of p
      `;
      return rows[0] ?? null;
    },

    async insertDraftPreview(input) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const rows = await transaction<Array<{ id: string }>>`
            insert into growth.prospect_previews (
              prospect_id,
              public_id,
              status,
              content_snapshot
            ) values (
              ${input.prospectId},
              ${createPublicId()},
              'draft',
              ${transaction.json(input.content)}
            )
            on conflict (prospect_id) do nothing
            returning id
          `;
          return rows.length === 1;
        } catch (error) {
          if (!isPublicIdUniqueKeyCollision(error) || attempt === 2) {
            throw error;
          }
        }
      }

      return false;
    },

    async appendBackfillAudit({ prospectId }) {
      await appendAuditEvent(transaction, {
        correlationId: "prospect-preview-backfill",
        actorType: "system",
        actorId: "prospect-preview-backfill",
        action: "prospect_preview.backfilled",
        entityType: "prospect",
        entityId: prospectId,
      });
    },
  };
}

export const postgresProspectPreviewBackfillRepository: ProspectPreviewBackfillRepository =
  {
    async listProspectIds(db) {
      const rows = await db<Array<{ prospectId: string }>>`
        select p.id as "prospectId"
        from growth.prospects p
        inner join growth.website_assessments wa on wa.prospect_id = p.id
        where p.status not in ('won', 'lost', 'rejected', 'suppressed')
        order by p.created_at asc, p.id asc
      `;
      return rows.map((row) => row.prospectId);
    },

    withTransaction(db, operation) {
      return withGrowthTransaction(db, (transaction) =>
        operation(createPostgresTransaction(transaction)),
      );
    },
  };
