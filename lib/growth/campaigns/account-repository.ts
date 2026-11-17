import { z } from "zod";
import type { GrowthTransaction } from "../db/types";
import { hasRequiredGmailScopes } from "../integrations/google-oauth";
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import { healthReviewSchema, limitsReviewSchema } from "./account-contracts";
import { assessAccountReadiness } from "./account-readiness";
import { validUsageProvenance } from "./account-usage";

const normalizeScope = (scope: string) =>
  scope === "https://www.googleapis.com/auth/userinfo.email" ? "email" : scope;
export function sameAccountScopes(a: string[], b: string[]): boolean {
  return (
    [...new Set(a.map(normalizeScope))].sort().join("\n") ===
    [...new Set(b.map(normalizeScope))].sort().join("\n")
  );
}
type Decision = { status: "ready" } | { status: "held"; reason: string };

// This is a point-in-time assessment, not a reservation or permission to send.
export async function loadConfiguredAccountReadiness(
  tx: GrowthTransaction,
  connectionId: string,
  mode: "prerequisites" | "active",
  healthAfter?: Date,
): Promise<Decision> {
  const held = (reason: string): Decision => ({ status: "held", reason });
  const [connection] = await tx<
    {
      status: string;
      subject: string | null;
      version: number;
      scopes: string[];
    }[]
  >`
    select status,google_subject as subject,version,granted_scopes as scopes
    from growth.integration_connections where id=${connectionId} and provider='gmail' and subject_email=${CAMPAIGN_FOUNDER_EMAIL} for share`;
  if (!connection) return held("identity_or_grant_unknown");
  const [control] = await tx<
    {
      state: string;
      subject: string;
      grant: number;
      scopes: string[];
      limitsId: string | null;
      healthId: string | null;
    }[]
  >`
    select state,verified_subject as subject,verified_grant_epoch as grant,verified_scopes as scopes,limits_review_id as "limitsId",health_review_id as "healthId" from growth.outreach_account_controls where connection_id=${connectionId} for share`;
  if (
    !control ||
    connection.status !== "connected" ||
    !connection.subject ||
    connection.subject !== control.subject ||
    connection.version < control.grant ||
    !hasRequiredGmailScopes(connection.scopes) ||
    !sameAccountScopes(connection.scopes, control.scopes)
  )
    return held("identity_or_grant_unknown");
  if (mode === "active" && control.state !== "active")
    return held("account_not_active");
  const reviews = await tx<
    { id: string; evidence: unknown }[]
  >`select id,evidence from growth.outreach_account_reviews where connection_id=${connectionId} and id in (${control.limitsId},${control.healthId})`;
  const envelope = z.object({ evidence: z.unknown() });
  const limitsEnvelope = envelope.safeParse(
    reviews.find((r) => r.id === control.limitsId)?.evidence,
  );
  const healthEnvelope = envelope.safeParse(
    reviews.find((r) => r.id === control.healthId)?.evidence,
  );
  const limits = limitsReviewSchema.safeParse(
    limitsEnvelope.success ? limitsEnvelope.data.evidence : null,
  );
  const health = healthReviewSchema.safeParse(
    healthEnvelope.success ? healthEnvelope.data.evidence : null,
  );
  if (
    healthAfter &&
    (!health.success || health.data.observedFrom <= healthAfter)
  )
    return held("health_review_reused");
  const rows = await tx<
    {
      capturedAt: Date | null;
      expiresAt: Date | null;
      complete: boolean;
      grant: number | null;
      messages: number | null;
      recipients: number | null;
      windowStart: Date | null;
      historyStart: string | null;
      historyEnd: string | null;
      evidenceVersion: number | null;
      ids: unknown;
    }[]
  >`
    select captured_at as "capturedAt",fresh_until as "expiresAt",complete,grant_epoch as grant,rolling_messages as messages,rolling_recipients as recipients,window_start as "windowStart",history_start as "historyStart",history_end as "historyEnd",evidence_version as "evidenceVersion",provider_message_ids as ids from growth.outreach_provider_usage where connection_id=${connectionId} for share`;
  const usage = rows.length === 1 ? rows[0] : undefined;
  return assessAccountReadiness(
    {
      identity: {
        connected: true,
        subjectMatches: true,
        grantMatches: true,
        scopesValid: true,
      },
      limits: limits.success ? limits.data : null,
      health: health.success ? health.data : null,
      usage:
        usage?.capturedAt && usage.expiresAt
          ? {
              capturedAt: usage.capturedAt,
              expiresAt: usage.expiresAt,
              complete:
                usage.complete &&
                !!usage.windowStart &&
                usage.windowStart.getTime() <=
                  usage.capturedAt.getTime() - 24 * 60 * 60 * 1000 &&
                !!usage.historyStart?.trim() &&
                !!usage.historyEnd?.trim() &&
                !!usage.evidenceVersion &&
                validUsageProvenance(
                  usage.ids,
                  usage.messages,
                  usage.recipients,
                  usage.capturedAt,
                ),
              grantMatches: usage.grant === connection.version,
              messages: usage.messages,
              recipients: usage.recipients,
            }
          : null,
    },
    new Date(),
  );
}
