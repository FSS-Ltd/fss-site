import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import { withGrowthTransaction } from "../db/client";
import { lockGmailRouting } from "../sequences/gmail-thread-association";
import type { GrowthDb } from "../db/types";
import { healthReviewSchema } from "./account-contracts";
import { requireCampaignFounder } from "./authorization";
import {
  resendBindingSchema,
  type ResendBinding,
} from "./resend-account-readiness";
import { loadResendAccountReadiness } from "./resend-account-repository";

const commandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("resend_configure"),
    requestId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    binding: resendBindingSchema,
  }),
  z.strictObject({
    type: z.literal("record_health"),
    requestId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    connectionId: z.uuid(),
    evidence: healthReviewSchema,
  }),
  z.strictObject({
    type: z.literal("activate"),
    requestId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    connectionId: z.uuid(),
  }),
  z.strictObject({
    type: z.literal("halt"),
    requestId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    connectionId: z.uuid(),
    reason: z.string().trim().min(1).max(500),
  }),
  z.strictObject({
    type: z.literal("reduce_ramp"),
    requestId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    connectionId: z.uuid(),
    ramp: z.union([
      z.literal(25),
      z.literal(50),
      z.literal(100),
      z.literal(150),
    ]),
  }),
  z.strictObject({
    type: z.literal("approve_ramp"),
    requestId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    connectionId: z.uuid(),
    ramp: z.union([
      z.literal(25),
      z.literal(50),
      z.literal(100),
      z.literal(150),
    ]),
  }),
]);
export type ResendAccountCommand = z.input<typeof commandSchema>;
export type ResendRuntimeConfiguration = {
  binding: ResendBinding;
  sendCredential: string;
  usageCredential: string;
  webhookSecret?: string;
};

export async function executeResendAccountCommand(
  db: GrowthDb,
  raw: ResendAccountCommand,
  founder: FounderSession,
  correlationId: string,
  runtime: ResendRuntimeConfiguration,
): Promise<{
  status: "ok";
  connectionId: string;
  version: number;
  reviewId: string;
  alreadyExisted: boolean;
}> {
  const command = commandSchema.parse(raw);
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
        status: "ok",
        connectionId: prior.connectionId,
        version: prior.version,
        reviewId: prior.id,
        alreadyExisted: true,
      };
    }
    await tx`select pg_advisory_xact_lock(hashtextextended('growth:resend-account-control',0))`;
    let connectionId: string;
    let createdControl = false;
    if (command.type === "resend_configure") {
      const runtimeBinding = resendBindingSchema.parse(runtime.binding);
      if (
        JSON.stringify(runtimeBinding) !== JSON.stringify(command.binding) ||
        !runtime.sendCredential.trim() ||
        !runtime.usageCredential.trim() ||
        (runtimeBinding.webhookGeneration !== undefined &&
          !runtime.webhookSecret?.trim())
      )
        throw new Error("runtime_binding_unknown");
      const [existing] = await tx<
        { id: string }[]
      >`select id from growth.integration_connections where provider='resend' and subject_email=${command.binding.sender} for update`;
      if (existing) connectionId = existing.id;
      else {
        connectionId = randomUUID();
        await tx`insert into growth.integration_connections(id,provider,subject_email) values (${connectionId},'resend',${command.binding.sender})`;
      }
      const inserted =
        await tx`insert into growth.outreach_account_controls(connection_id,provider,verified_subject,verified_grant_epoch,verified_scopes,resend_team,resend_environment,resend_binding) values (${connectionId},'resend',null,null,null,${command.binding.team},${command.binding.environment},${tx.json(command.binding)}) on conflict do nothing returning connection_id`;
      createdControl = inserted.length === 1;
    } else connectionId = command.connectionId;
    const [control] = await tx<
      {
        version: number;
        state: string;
        ramp: number;
        lastRampAt: Date | null;
        team: string;
        environment: string;
      }[]
    >`select version,state,ramp,last_ramp_at as "lastRampAt",resend_team as team,resend_environment as environment from growth.outreach_account_controls where connection_id=${connectionId} and provider='resend' for update`;
    if (
      !control ||
      (createdControl
        ? command.expectedVersion !== 0
        : control.version !== command.expectedVersion)
    )
      throw new Error("account_version_changed");
    if (
      command.type === "resend_configure" &&
      (control.team !== command.binding.team ||
        control.environment !== command.binding.environment)
    )
      throw new Error("account_identity_changed");
    const now = new Date();
    if (command.type === "record_health") {
      const h = command.evidence;
      if (
        h.observedFrom >= h.observedUntil ||
        h.observedUntil > now ||
        h.expiresAt <= h.observedUntil ||
        h.expiresAt.getTime() > h.observedUntil.getTime() + 86400000 ||
        (h.sends !== null && h.attempts !== null && h.sends > h.attempts) ||
        (h.sends !== null &&
          h.hardBounces !== null &&
          h.hardBounces > h.sends) ||
        (h.sends !== null && h.complaints !== null && h.complaints > h.sends)
      )
        throw new Error("invalid_health_review");
    }
    if (command.type === "reduce_ramp" && command.ramp >= control.ramp)
      throw new Error("invalid_ramp_reduction");
    if (command.type === "activate" || command.type === "approve_ramp") {
      if (
        command.type === "approve_ramp" &&
        (control.state !== "active" ||
          !control.lastRampAt ||
          new Map([
            [25, 50],
            [50, 100],
            [100, 150],
          ]).get(control.ramp) !== command.ramp)
      )
        throw new Error("invalid_ramp_step");
      const decision = await loadResendAccountReadiness(
        tx,
        connectionId,
        runtime,
        "prerequisites",
      );
      if (decision.status === "held") throw new Error(decision.reason);
      if (
        command.type === "approve_ramp" &&
        (!control.lastRampAt ||
          decision.healthObservedFrom <= control.lastRampAt)
      )
        throw new Error("health_review_reused");
    }
    const reviewId = randomUUID();
    const version = control.version + 1;
    await tx`insert into growth.outreach_account_reviews(id,connection_id,request_id,request_hash,actor_id,kind,evidence,resulting_version) values (${reviewId},${connectionId},${command.requestId},${hash},${founder.actorId},${command.type},${tx.json(JSON.parse(JSON.stringify(command)))},${version})`;
    const adverseHealth =
      command.type === "record_health" &&
      [
        command.evidence.hardBounces,
        command.evidence.complaints,
        command.evidence.rateIncidents,
        command.evidence.authIncidents,
      ].some((count) => count !== null && count > 0);
    const state =
      command.type === "activate"
        ? "active"
        : command.type === "halt" || adverseHealth
          ? "halted"
          : command.type === "resend_configure" ||
              command.type === "record_health"
            ? "paused"
            : control.state;
    await tx`update growth.outreach_account_controls set state=${state},ramp=${command.type === "approve_ramp" || command.type === "reduce_ramp" ? command.ramp : control.ramp},version=${version},resend_binding=${command.type === "resend_configure" ? tx.json(command.binding) : tx`resend_binding`},resend_binding_review_id=${command.type === "resend_configure" ? reviewId : tx`resend_binding_review_id`},health_review_id=${command.type === "record_health" ? reviewId : command.type === "resend_configure" ? null : tx`health_review_id`},last_ramp_at=${command.type === "approve_ramp" || (command.type === "activate" && !control.lastRampAt) ? now : control.lastRampAt},updated_at=${now} where connection_id=${connectionId}`;
    if (command.type === "resend_configure")
      await tx`update growth.outreach_provider_usage set complete=false,incomplete_reason='resend_binding_changed',observation_revision=observation_revision+1 where connection_id=${connectionId}`;
    await appendAuditEvent(tx, {
      correlationId,
      actorType: "founder",
      actorId: founder.actorId,
      action: `outreach_account.${command.type}`,
      entityType: "outreach_account",
      entityId: connectionId,
    });
    return {
      status: "ok",
      connectionId,
      version,
      reviewId,
      alreadyExisted: false,
    };
  });
}
