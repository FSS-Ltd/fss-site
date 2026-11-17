import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { hasRequiredGmailScopes } from "../integrations/google-oauth";
import { requireCampaignFounder } from "./authorization";
import {
  accountControlCommandSchema,
  healthReviewSchema,
  limitsReviewSchema,
  type AccountControlCommand,
} from "./account-contracts";
import { assessAccountReadiness } from "./account-readiness";

type Connection = {
  id: string;
  status: string;
  subject: string | null;
  version: number;
  scopes: string[];
};
type Control = {
  state: string;
  ramp: number;
  version: number;
  subject: string;
  grant: number;
  scopes: string[];
  limitsId: string | null;
  healthId: string | null;
  lastRampAt: Date | null;
};
const day = 24 * 60 * 60 * 1000;
const normalizeScope = (scope: string) =>
  scope === "https://www.googleapis.com/auth/userinfo.email" ? "email" : scope;
const sameScopes = (a: string[], b: string[]) =>
  [...new Set(a.map(normalizeScope))].sort().join("\n") ===
  [...new Set(b.map(normalizeScope))].sort().join("\n");
export async function executeAccountControlCommand(
  db: GrowthDb,
  raw: AccountControlCommand,
  founder: FounderSession,
  correlationId: string,
): Promise<{
  status: "ok";
  connectionId: string;
  version: number;
  reviewId: string;
  alreadyExisted: boolean;
}> {
  const command = accountControlCommandSchema.parse(raw);
  requireCampaignFounder(founder);
  if (!correlationId.trim()) throw new Error("invalid_correlation_id");
  const hash = createHash("sha256")
    .update(JSON.stringify(command))
    .digest("hex");
  return withGrowthTransaction(db, async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:account-command:${command.requestId}`},0))`;
    const [prior] = await tx<
      {
        connectionId: string;
        requestHash: string;
        actorId: string;
        version: number;
        id: string;
      }[]
    >`select connection_id as "connectionId",request_hash as "requestHash",actor_id as "actorId",resulting_version as version,id from growth.outreach_account_reviews where request_id=${command.requestId}`;
    if (prior) {
      if (prior.requestHash !== hash || prior.actorId !== founder.actorId)
        throw new Error("request_conflict");
      return {
        status: "ok" as const,
        connectionId: prior.connectionId,
        version: prior.version,
        reviewId: prior.id,
        alreadyExisted: true,
      };
    }
    const [connection] = await tx<
      Connection[]
    >`select id,status,google_subject as subject,version,granted_scopes as scopes from growth.integration_connections where provider='gmail' and subject_email=${founder.email} for update`;
    if (!connection) throw new Error("account_identity_unknown");
    const protective =
      command.type === "halt" || command.type === "reduce_ramp";
    const usable =
      connection.subject &&
      connection.status === "connected" &&
      hasRequiredGmailScopes(connection.scopes);
    if (!usable && !protective) throw new Error("account_identity_unknown");
    if (usable) {
      await tx`insert into growth.outreach_account_controls(connection_id,verified_subject,verified_grant_epoch,verified_scopes) values (${connection.id},${connection.subject},${connection.version},${connection.scopes}) on conflict do nothing`;
    }
    const [control] = await tx<
      Control[]
    >`select state,ramp,version,verified_subject as subject,verified_grant_epoch as grant,verified_scopes as scopes,limits_review_id as "limitsId",health_review_id as "healthId",last_ramp_at as "lastRampAt" from growth.outreach_account_controls where connection_id=${connection.id} for update`;
    if (!control || control.version !== command.expectedVersion)
      throw new Error("account_version_changed");
    if (!protective && control.subject !== connection.subject)
      throw new Error("account_authority_changed");
    if (
      !protective &&
      command.type !== "revalidate_grant" &&
      !sameScopes(control.scopes, connection.scopes)
    )
      throw new Error("account_authority_changed");
    if (
      command.type === "revalidate_grant" &&
      command.expectedGrantVersion !== connection.version
    )
      throw new Error("grant_version_changed");
    const now = new Date();
    if (
      command.type === "record_limits" &&
      (command.evidence.observedAt > now ||
        command.evidence.expiresAt <= now ||
        command.evidence.expiresAt.getTime() >
          command.evidence.observedAt.getTime() + 30 * day)
    )
      throw new Error("invalid_limits_time");
    if (
      command.type === "record_health" &&
      (command.evidence.observedFrom >= command.evidence.observedUntil ||
        command.evidence.observedUntil > now ||
        command.evidence.expiresAt <= command.evidence.observedUntil ||
        command.evidence.expiresAt.getTime() >
          command.evidence.observedUntil.getTime() + day)
    )
      throw new Error("invalid_health_time");
    if (command.type === "record_health") {
      const e = command.evidence;
      if (
        (e.sends !== null && e.attempts !== null && e.sends > e.attempts) ||
        (e.sends !== null &&
          e.hardBounces !== null &&
          e.hardBounces > e.sends) ||
        (e.sends !== null && e.complaints !== null && e.complaints > e.sends)
      )
        throw new Error("inconsistent_health_counts");
    }
    if (command.type === "reduce_ramp" && command.ramp >= control.ramp)
      throw new Error("invalid_ramp_reduction");
    if (command.type === "activate" || command.type === "approve_ramp") {
      const reviews = await tx<
        { id: string; evidence: unknown }[]
      >`select id,evidence from growth.outreach_account_reviews where connection_id=${connection.id} and id in (${control.limitsId},${control.healthId})`;
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
      const usageRows = await tx<
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
      >`select captured_at as "capturedAt",fresh_until as "expiresAt",complete,grant_epoch as grant,rolling_messages as messages,rolling_recipients as recipients,window_start as "windowStart",history_start as "historyStart",history_end as "historyEnd",evidence_version as "evidenceVersion",provider_message_ids as ids from growth.outreach_provider_usage where connection_id=${connection.id} for share`;
      const usage = usageRows.length === 1 ? usageRows[0] : undefined;
      const validIds =
        Array.isArray(usage?.ids) &&
        usage.ids.length <= 1000 &&
        usage.ids.length === usage.messages &&
        usage.ids.every(
          (id: unknown) =>
            typeof id === "string" && id.length > 0 && id.length <= 255,
        ) &&
        new Set(usage.ids).size === usage.ids.length;
      const decision = assessAccountReadiness(
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
                      usage.capturedAt.getTime() - day &&
                    !!usage.historyStart &&
                    !!usage.historyEnd &&
                    !!usage.evidenceVersion &&
                    validIds,
                  grantMatches: usage.grant === connection.version,
                  messages: usage.messages,
                  recipients: usage.recipients,
                }
              : null,
        },
        now,
      );
      if (decision.status === "held") throw new Error(decision.reason);
      if (command.type === "approve_ramp") {
        if (control.state === "halted" || !control.lastRampAt)
          throw new Error("account_not_activated");
        const next = new Map([
          [25, 50],
          [50, 100],
          [100, 150],
        ]).get(control.ramp);
        if (command.ramp !== next) throw new Error("invalid_ramp_step");
        if (
          !health.success ||
          (control.lastRampAt && health.data.observedFrom <= control.lastRampAt)
        )
          throw new Error("health_review_reused");
      }
    }
    const reviewId = randomUUID();
    const version = control.version + 1;
    await tx`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${reviewId},${connection.id},${command.requestId},${hash},${founder.actorId},${command.type},${tx.json(JSON.parse(JSON.stringify({ ...command, limitsReviewId: control.limitsId, healthReviewId: control.healthId, previousRamp: control.ramp, newRamp: command.type === "approve_ramp" || command.type === "reduce_ramp" ? command.ramp : control.ramp })))},${version})`;
    const adverseHealth =
      command.type === "record_health" &&
      [
        command.evidence.hardBounces,
        command.evidence.complaints,
        command.evidence.rateIncidents,
        command.evidence.authIncidents,
      ].some((n) => n !== null && n > 0);
    const state =
      command.type === "halt" || adverseHealth
        ? "halted"
        : command.type === "activate"
          ? "active"
          : command.type === "revalidate_grant"
            ? "paused"
            : control.grant !== connection.version ||
                command.type === "record_health"
              ? "paused"
              : control.state;
    const ramp =
      command.type === "approve_ramp" || command.type === "reduce_ramp"
        ? command.ramp
        : control.ramp;
    await tx`update growth.outreach_account_controls set state=${state},ramp=${ramp},version=${version},verified_grant_epoch=${command.type === "activate" || command.type === "revalidate_grant" ? connection.version : control.grant},verified_scopes=${command.type === "revalidate_grant" ? connection.scopes : control.scopes},limits_review_id=${command.type === "record_limits" ? reviewId : control.limitsId},health_review_id=${command.type === "record_health" ? reviewId : control.healthId},last_ramp_at=${command.type === "approve_ramp" || (command.type === "activate" && !control.lastRampAt) ? now : control.lastRampAt},updated_at=${now} where connection_id=${connection.id}`;
    await appendAuditEvent(tx, {
      correlationId,
      actorType: "founder",
      actorId: founder.actorId,
      action: `outreach_account.${command.type}`,
      entityType: "outreach_account",
      entityId: connection.id,
    });
    return {
      status: "ok" as const,
      connectionId: connection.id,
      version,
      reviewId,
      alreadyExisted: false,
    };
  });
}
