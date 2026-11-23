import { createHash } from "node:crypto";
import { z } from "zod";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import { hasRequiredGmailScopes } from "../integrations/google-oauth";
import { readResendUsage } from "../integrations/resend/usage";
import { healthReviewSchema } from "./account-contracts";
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import {
  assessResendAccountReadiness,
  resendBindingSchema,
} from "./resend-account-readiness";
import type { ResendRuntimeConfiguration } from "./resend-account-control";

export async function loadResendAccountReadiness(
  tx: GrowthTransaction,
  connectionId: string,
  runtime: ResendRuntimeConfiguration,
  mode: "active" | "prerequisites" = "active",
): Promise<
  | { status: "ready"; expiresAt: Date; healthObservedFrom: Date; ramp: number }
  | { status: "held"; reason: string }
> {
  // Configuration locks the connection before its control. Usage writers also
  // lock the control. Hold both until this transaction ends for consistent reads.
  await tx`select id from growth.integration_connections where id=${connectionId} and provider='resend' for share`;
  await tx`select connection_id from growth.outreach_account_controls where connection_id=${connectionId} and provider='resend' for share`;
  const [row] = await tx<
    {
      state: string;
      ramp: number;
      binding: unknown;
      review: unknown;
      health: unknown;
      usage: unknown;
      generation: string | null;
      complete: boolean;
      sender: string;
    }[]
  >`
    select c.state,c.ramp,c.resend_binding as binding,r.evidence as review,h.evidence as health,u.resend_usage as usage,u.resend_usage_generation as generation,u.complete,ic.subject_email as sender
    from growth.outreach_account_controls c
    join growth.integration_connections ic on ic.id=c.connection_id and ic.provider='resend'
    left join growth.outreach_account_reviews r on r.id=c.resend_binding_review_id and r.connection_id=c.connection_id and r.kind='resend_configure' and r.actor_id=${createHash("sha256").update(CAMPAIGN_FOUNDER_EMAIL).digest("hex")}
    left join growth.outreach_account_reviews h on h.id=c.health_review_id and h.connection_id=c.connection_id and h.kind='record_health' and h.actor_id=${createHash("sha256").update(CAMPAIGN_FOUNDER_EMAIL).digest("hex")}
    left join growth.outreach_provider_usage u on u.connection_id=c.connection_id and u.account_id=c.connection_id::text
    where c.connection_id=${connectionId} and c.provider='resend'`;
  const binding = resendBindingSchema.safeParse(row?.binding);
  const review = z
    .object({ binding: resendBindingSchema })
    .safeParse(row?.review);
  const healthEnvelope = z
    .object({ evidence: healthReviewSchema })
    .safeParse(row?.health);
  if (
    !row ||
    !binding.success ||
    !review.success ||
    !healthEnvelope.success ||
    JSON.stringify(binding.data) !== JSON.stringify(review.data.binding) ||
    row.sender !== binding.data.sender ||
    !row.complete
  )
    return { status: "held", reason: "identity_or_usage_unknown" };
  const [gmail] = await tx<
    { status: string; subject: string | null; scopes: string[] }[]
  >`select status,google_subject as subject,granted_scopes as scopes from growth.integration_connections where provider='gmail' and subject_email=${binding.data.replyTo} for share`;
  const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
  if (!clock) return { status: "held", reason: "invalid_time" };
  const decision = assessResendAccountReadiness(
    {
      binding: binding.data,
      runtimeBinding: runtime.binding,
      state: row.state,
      health: healthEnvelope.data.evidence,
      usage: row.usage,
      usageGeneration: row.generation,
      sendCredential: runtime.sendCredential,
      usageCredential: runtime.usageCredential,
      monitoredMailbox:
        !!gmail &&
        gmail.status === "connected" &&
        !!gmail.subject &&
        hasRequiredGmailScopes(gmail.scopes),
    },
    clock.now,
    mode,
  );
  return decision.status === "held"
    ? decision
    : {
        ...decision,
        ramp: row.ramp,
        healthObservedFrom: healthEnvelope.data.evidence.observedFrom,
      };
}

export async function refreshResendAccountUsage(
  db: GrowthDb,
  connectionId: string,
  runtime: ResendRuntimeConfiguration,
  request?: (url: string, init?: RequestInit) => Promise<Response>,
): Promise<{ status: "complete" } | { status: "held"; reason: string }> {
  const runtimeBinding = resendBindingSchema.safeParse(runtime.binding);
  if (
    !runtimeBinding.success ||
    !runtime.sendCredential.trim() ||
    !runtime.usageCredential.trim()
  )
    return { status: "held", reason: "runtime_binding_unknown" };
  const started = await withGrowthTransaction(db, async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('growth:resend-account-control',0))`;
    const [control] = await tx<
      { binding: unknown }[]
    >`select resend_binding as binding from growth.outreach_account_controls where connection_id=${connectionId} and provider='resend' for update`;
    const current = resendBindingSchema.safeParse(control?.binding);
    if (
      !current.success ||
      JSON.stringify(current.data) !== JSON.stringify(runtimeBinding.data)
    )
      return null;
    const [usage] = await tx<
      { accountId: string; revision: number }[]
    >`select account_id as "accountId",observation_revision as revision from growth.outreach_provider_usage where connection_id=${connectionId} for update`;
    if (usage && usage.accountId !== connectionId) return null;
    if (usage) {
      await tx`update growth.outreach_provider_usage set complete=false,incomplete_reason='observation_in_progress',observation_revision=observation_revision+1 where account_id=${connectionId}`;
      return usage.revision + 1;
    }
    await tx`insert into growth.outreach_provider_usage(account_id,connection_id,complete,health,incomplete_reason,observation_revision) values (${connectionId},${connectionId},false,'unknown','observation_in_progress',1)`;
    return 1;
  });
  if (started === null)
    return { status: "held", reason: "runtime_binding_unknown" };
  const observation = await readResendUsage(runtime.usageCredential, {
    request,
  });
  return withGrowthTransaction(db, async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('growth:resend-account-control',0))`;
    const [control] = await tx<
      { binding: unknown }[]
    >`select resend_binding as binding from growth.outreach_account_controls where connection_id=${connectionId} and provider='resend' for update`;
    const [row] = await tx<
      { revision: number }[]
    >`select observation_revision as revision from growth.outreach_provider_usage where account_id=${connectionId} and connection_id=${connectionId} for update`;
    const current = resendBindingSchema.safeParse(control?.binding);
    if (
      !row ||
      row.revision !== started ||
      !current.success ||
      JSON.stringify(current.data) !== JSON.stringify(runtimeBinding.data)
    )
      return { status: "held", reason: "observation_superseded" };
    const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
    if (
      !clock ||
      observation.status === "held" ||
      new Date(observation.usage.observedAt) > clock.now ||
      new Date(observation.usage.validUntil) <= clock.now
    ) {
      await tx`update growth.outreach_provider_usage set complete=false,incomplete_reason='usage_unknown' where account_id=${connectionId}`;
      return { status: "held", reason: "usage_unknown" };
    }
    await tx`update growth.outreach_provider_usage set complete=true,incomplete_reason=null,captured_at=${observation.usage.observedAt},fresh_until=${observation.usage.validUntil},resend_usage=${tx.json(observation.usage)},resend_usage_generation=${runtimeBinding.data.usageGeneration} where account_id=${connectionId}`;
    return { status: "complete" };
  });
}
