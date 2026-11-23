import { createHash, randomUUID } from "node:crypto";
import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import { withGrowthTransaction } from "../db/client";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import type { GrowthDb } from "../db/types";
import { hasRequiredGmailScopes } from "../integrations/google-oauth";
import { requireCampaignFounder } from "./authorization";
import {
  accountControlCommandSchema,
  type AccountControlCommand,
} from "./account-contracts";
import {
  loadConfiguredAccountReadiness,
  sameAccountScopes,
  normalizedAccountScopes,
} from "./account-repository";

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
    await lockGmailRouting(tx);
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
      !sameAccountScopes(control.scopes, connection.scopes)
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
    if (command.type === "record_limits" && command.evidence.visibility) {
      const visibility = command.evidence.visibility;
      if (
        visibility.reviewedAt > now ||
        visibility.expiresAt <= now ||
        visibility.reviewedAt >= visibility.expiresAt ||
        visibility.expiresAt > command.evidence.expiresAt
      )
        throw new Error("invalid_visibility_time");
    }
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
      if (command.type === "approve_ramp") {
        if (control.state === "halted" || !control.lastRampAt)
          throw new Error("account_not_activated");
        const next = new Map([
          [25, 50],
          [50, 100],
          [100, 150],
        ]).get(control.ramp);
        if (command.ramp !== next) throw new Error("invalid_ramp_step");
      }
      const decision = await loadConfiguredAccountReadiness(
        tx,
        connection.id,
        "prerequisites",
        command.type === "approve_ramp"
          ? (control.lastRampAt ?? undefined)
          : undefined,
      );
      if (decision.status === "held") throw new Error(decision.reason);
    }
    if (command.type === "revalidate_grant") {
      await tx`update growth.outreach_provider_usage set complete=false,incomplete_reason='grant_revalidated' where connection_id=${connection.id}`;
    }
    const reviewId = randomUUID();
    const version = control.version + 1;
    await tx`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${reviewId},${connection.id},${command.requestId},${hash},${founder.actorId},${command.type},${tx.json(JSON.parse(JSON.stringify({ ...command, ...(command.type === "record_limits" ? { googleSubject: connection.subject, googleScopes: normalizedAccountScopes(connection.scopes) } : {}), limitsReviewId: control.limitsId, healthReviewId: control.healthId, previousRamp: control.ramp, newRamp: command.type === "approve_ramp" || command.type === "reduce_ramp" ? command.ramp : control.ramp })))},${version})`;
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
            : control.state;
    const ramp =
      command.type === "approve_ramp" || command.type === "reduce_ramp"
        ? command.ramp
        : control.ramp;
    await tx`update growth.outreach_account_controls set state=${state},ramp=${ramp},version=${version},verified_grant_epoch=${command.type === "activate" || command.type === "revalidate_grant" ? connection.version : control.grant},verified_scopes=${command.type === "revalidate_grant" ? connection.scopes : control.scopes},limits_review_id=${command.type === "record_limits" ? reviewId : command.type === "revalidate_grant" && !sameAccountScopes(control.scopes, connection.scopes) ? null : control.limitsId},health_review_id=${command.type === "record_health" ? reviewId : control.healthId},last_ramp_at=${command.type === "approve_ramp" || (command.type === "activate" && !control.lastRampAt) ? now : control.lastRampAt},updated_at=${now} where connection_id=${connection.id}`;
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
