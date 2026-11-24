import { z } from "zod";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import type {
  UsageResult,
  UsageObservation,
  UsageState,
} from "../integrations/gmail/usage";
import {
  currentVisibilityExpiry,
  sameAccountScopes,
} from "./account-repository";
import { hasRequiredGmailScopes } from "../integrations/google-oauth";
import {
  transitionUsageSchema,
  validTransitionUsageProvenance,
} from "./account-usage";

const DAY = 86_400_000;
const HISTORY = /^\d{1,32}$/;

export async function commitGmailUsage(
  db: GrowthDb,
  input: {
    binding: GmailGrantBinding;
    subjectEmail: string;
    expectedRevision: number | null;
    result: UsageResult;
  },
): Promise<{ status: "complete" } | { status: "held"; reason: string }> {
  return withGrowthTransaction(db, async (tx) => {
    await lockUsageConnection(tx, input.binding, input.subjectEmail);
    const { state } = input.result;
    if (
      state.binding.connectionId !== input.binding.connectionId ||
      state.binding.googleSubject !== input.binding.googleSubject ||
      state.binding.grantEpoch !== input.binding.grantEpoch ||
      !sameAccountScopes(
        state.binding.grantedScopes,
        input.binding.grantedScopes,
      )
    )
      throw new Error("Gmail usage grant changed.");
    const [control] = await tx<
      Array<{ subject: string; scopes: string[]; limitsId: string | null }>
    >`
      select verified_subject as subject, verified_scopes as scopes, limits_review_id as "limitsId"
      from growth.outreach_account_controls where connection_id=${input.binding.connectionId} for share
    `;
    const [review] = control?.limitsId
      ? await tx<
          Array<{ evidence: unknown }>
        >`select evidence from growth.outreach_account_reviews where id=${control.limitsId} and connection_id=${input.binding.connectionId}`
      : [];
    const oldRows = await tx<
      Array<{
        accountId: string;
        connectionId: string | null;
        revision: number;
        subject: string | null;
        capturedAt: Date | null;
        version: number | null;
        observations: unknown;
      }>
    >`
      select account_id as "accountId", connection_id as "connectionId", observation_revision as revision, observation_subject as subject,
        captured_at as "capturedAt", evidence_version as version, provider_message_ids as observations
      from growth.outreach_provider_usage where connection_id=${input.binding.connectionId} or account_id=${input.binding.connectionId} for update
    `;
    if (oldRows.length > 1) throw new Error("Gmail usage account conflict.");
    const old = oldRows[0];
    if ((old?.revision ?? null) !== input.expectedRevision)
      throw new Error("Gmail usage conflict.");
    if (
      old &&
      (old.accountId !== input.binding.connectionId ||
        (old.connectionId && old.connectionId !== input.binding.connectionId))
    )
      throw new Error("Gmail usage account conflict.");
    const [clock] = await tx<
      Array<{ now: Date }>
    >`select clock_timestamp() as now`;
    const recipients = state.observations.reduce(
      (sum, item) => sum + item.recipientCount,
      0,
    );
    if (
      !clock ||
      !Number.isFinite(state.baselineAt.getTime()) ||
      state.baselineAt > clock.now
    )
      throw new Error("Gmail usage time invalid.");
    if (
      !HISTORY.test(state.historyStart) ||
      !HISTORY.test(state.historyEnd) ||
      BigInt(state.historyStart) > BigInt(state.historyEnd)
    )
      throw new Error("Gmail usage history invalid.");
    if (
      !validTransitionUsageProvenance(
        state.observations,
        state.observations.length,
        recipients,
        state.capturedAt,
        clock.now,
      )
    )
      throw new Error("Gmail usage provenance invalid.");
    if (
      (input.result.status === "complete" &&
        state.capturedAt.getTime() < state.baselineAt.getTime() + DAY) ||
      (input.result.status === "held" &&
        !/^[a-z_]{1,64}$/.test(input.result.reason))
    )
      throw new Error("Gmail usage outcome invalid.");
    if (old?.subject && old.subject !== input.binding.googleSubject)
      throw new Error("Gmail usage subject changed.");
    if (
      old &&
      old.version !== 2 &&
      !(
        old.version === null &&
        old.capturedAt === null &&
        old.observations === null &&
        old.subject === input.binding.googleSubject
      ) &&
      (!old.capturedAt ||
        old.capturedAt.getTime() > state.capturedAt.getTime() - DAY)
    )
      throw new Error("Gmail legacy usage remains unknown.");
    if (old?.version === 2 && old.observations) {
      const parsed = z
        .array(transitionUsageSchema)
        .max(1000)
        .safeParse(old.observations);
      if (!parsed.success || !old.subject)
        throw new Error("Gmail prior usage evidence invalid.");
      const next = new Map(
        state.observations.map((entry) => [entry.transitionId, entry]),
      );
      for (const previous of parsed.data) {
        if (
          Date.parse(previous.observedUpperBound) <=
          state.capturedAt.getTime() - DAY
        )
          continue;
        const retained = next.get(previous.transitionId);
        if (
          !retained ||
          retained.id !== previous.id ||
          retained.internalDate !== previous.internalDate ||
          retained.observedUpperBound !== previous.observedUpperBound ||
          retained.recipientCount !== previous.recipientCount ||
          retained.recipientFingerprint !== previous.recipientFingerprint
        )
          throw new Error("Gmail prior usage evidence missing.");
      }
    }
    const visibility =
      control &&
      control.subject === input.binding.googleSubject &&
      sameAccountScopes(control.scopes, input.binding.grantedScopes) &&
      currentVisibilityExpiry(
        review?.evidence,
        input.binding.googleSubject,
        input.binding.grantedScopes,
        clock.now,
      );
    const reason =
      input.result.status === "held"
        ? input.result.reason
        : !visibility
          ? "visibility_unknown"
          : clock.now.getTime() > state.capturedAt.getTime() + 300000
            ? "usage_stale"
            : null;
    const complete = reason === null;
    const revision = (old?.revision ?? 0) + 1;
    if (!old) {
      await tx`insert into growth.outreach_provider_usage(account_id, connection_id, grant_epoch, complete, health, captured_at, window_start, history_start, history_end, fresh_until, incomplete_reason, evidence_version, provider_message_ids, rolling_messages, rolling_recipients, observation_subject, observation_scopes, observation_revision)
        values (${input.binding.connectionId},${input.binding.connectionId},${input.binding.grantEpoch},${complete},'unknown',${state.capturedAt},${state.baselineAt},${state.historyStart},${state.historyEnd},${new Date(state.capturedAt.getTime() + 300000)},${reason},2,${tx.json(state.observations)},${complete ? state.observations.length : null},${complete ? recipients : null},${input.binding.googleSubject},${input.binding.grantedScopes},${revision})`;
    } else {
      await tx`update growth.outreach_provider_usage set connection_id=${input.binding.connectionId},grant_epoch=${input.binding.grantEpoch},complete=${complete},captured_at=${state.capturedAt},window_start=${state.baselineAt},history_start=${state.historyStart},history_end=${state.historyEnd},fresh_until=${new Date(state.capturedAt.getTime() + 300000)},incomplete_reason=${reason},evidence_version=2,provider_message_ids=${tx.json(state.observations)},rolling_messages=${complete ? state.observations.length : null},rolling_recipients=${complete ? recipients : null},observation_subject=${input.binding.googleSubject},observation_scopes=${input.binding.grantedScopes},observation_revision=${revision} where account_id=${old.accountId}`;
    }
    return complete
      ? { status: "complete" as const }
      : { status: "held" as const, reason: reason ?? "usage_unknown" };
  });
}

type UsageConnection = {
  status: string;
  subject: string | null;
  version: number;
  scopes: string[];
  email: string;
};
async function lockUsageConnection(
  tx: GrowthTransaction,
  binding: GmailGrantBinding,
  email: string,
): Promise<void> {
  const [connection] = await tx<UsageConnection[]>`
    select status, google_subject as subject, version, granted_scopes as scopes, subject_email as email
    from growth.integration_connections where id=${binding.connectionId} and provider='gmail' for update
  `;
  if (
    !connection ||
    connection.status !== "connected" ||
    connection.subject !== binding.googleSubject ||
    connection.version !== binding.grantEpoch ||
    connection.email !== email.trim().toLowerCase() ||
    !hasRequiredGmailScopes(connection.scopes) ||
    !sameAccountScopes(connection.scopes, binding.grantedScopes)
  )
    throw new Error("Gmail usage grant changed.");
}

type StoredUsage = {
  accountId: string;
  connectionId: string | null;
  revision: number;
  subject: string | null;
  scopes: string[] | null;
  grant: number | null;
  capturedAt: Date | null;
  baselineAt: Date | null;
  historyStart: string | null;
  historyEnd: string | null;
  version: number | null;
  observations: unknown;
};
export type StartedGmailUsage = {
  revision: number;
  prior: UsageState | null;
  retained: UsageObservation[];
  legacyUnknown: boolean;
};
export async function startGmailUsageObservation(
  db: GrowthDb,
  binding: GmailGrantBinding,
  email: string,
): Promise<StartedGmailUsage> {
  return withGrowthTransaction(db, async (tx) => {
    await lockUsageConnection(tx, binding, email);
    const oldRows = await tx<StoredUsage[]>`
      select account_id as "accountId",connection_id as "connectionId",observation_revision as revision,observation_subject as subject,observation_scopes as scopes,
        grant_epoch as grant,captured_at as "capturedAt",window_start as "baselineAt",history_start as "historyStart",history_end as "historyEnd",
        evidence_version as version,provider_message_ids as observations
      from growth.outreach_provider_usage where connection_id=${binding.connectionId} or account_id=${binding.connectionId} for update
    `;
    if (oldRows.length > 1) throw new Error("Gmail usage account conflict.");
    const old = oldRows[0];
    if (!old) {
      await tx`insert into growth.outreach_provider_usage(account_id,connection_id,grant_epoch,complete,health,incomplete_reason,observation_subject,observation_scopes,observation_revision)
        values (${binding.connectionId},${binding.connectionId},${binding.grantEpoch},false,'unknown','observation_in_progress',${binding.googleSubject},${binding.grantedScopes},1)`;
      return { revision: 1, prior: null, retained: [], legacyUnknown: false };
    }
    if (
      old.accountId !== binding.connectionId ||
      (old.connectionId && old.connectionId !== binding.connectionId) ||
      (old.subject && old.subject !== binding.googleSubject)
    )
      throw new Error("Gmail usage identity changed.");
    const revision = old.revision + 1;
    await tx`update growth.outreach_provider_usage set complete=false,incomplete_reason='observation_in_progress',observation_revision=${revision} where account_id=${old.accountId}`;
    if (old.version !== 2) {
      const [clock] = await tx<
        { now: Date }[]
      >`select clock_timestamp() as now`;
      const placeholder =
        old.version === null &&
        old.capturedAt === null &&
        old.observations === null &&
        old.subject === binding.googleSubject;
      const legacyUnknown =
        !placeholder &&
        (!clock ||
          !old.capturedAt ||
          old.capturedAt.getTime() > clock.now.getTime() - DAY);
      return { revision, prior: null, retained: [], legacyUnknown };
    }
    const parsed = z
      .array(transitionUsageSchema)
      .max(1000)
      .safeParse(old.observations);
    if (
      !parsed.success ||
      !old.subject ||
      !old.scopes ||
      !old.grant ||
      !old.capturedAt ||
      !old.baselineAt ||
      !old.historyStart ||
      !old.historyEnd
    )
      throw new Error("Gmail prior usage evidence invalid.");
    const oldBinding = {
      connectionId: binding.connectionId,
      googleSubject: old.subject,
      grantEpoch: old.grant,
      grantedScopes: old.scopes,
    };
    const prior =
      old.grant === binding.grantEpoch &&
      sameAccountScopes(old.scopes, binding.grantedScopes)
        ? {
            binding: oldBinding,
            baselineAt: old.baselineAt,
            historyStart: old.historyStart,
            historyEnd: old.historyEnd,
            capturedAt: old.capturedAt,
            observations: parsed.data,
          }
        : null;
    return { revision, prior, retained: parsed.data, legacyUnknown: false };
  });
}
