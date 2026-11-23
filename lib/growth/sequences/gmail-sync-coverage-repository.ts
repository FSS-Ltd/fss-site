import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthQueryExecutor } from "../db/types";
import type { GmailGrantBinding } from "../integrations/gmail/live-client";
import {
  hasRequiredGmailScopes,
  sameAccountScopes,
} from "../integrations/google-oauth";
import {
  hasCompleteReplyCoverage,
  type ReplyCoverageInterval,
} from "./gmail-sync-coverage";

export type ReplyCoverageCommit = {
  binding: GmailGrantBinding;
  expectedCursor: string | null;
  expectedObservedUntil: Date | null;
  expectedCoverageId: string | null;
  historyStart: string | null;
  historyEnd: string;
  observedFrom: Date | null;
  observedUntil: Date;
  headRequestedAt: Date;
  headRespondedAt: Date;
  state: "complete" | "gap";
  reason: string | null;
  unknownObservations: Array<{ messageId: string; reason: string }>;
};

export async function commitReplyCoverage(
  db: GrowthDb,
  input: ReplyCoverageCommit,
): Promise<string> {
  const historyPattern = /^\d{1,32}$/;
  if (
    input.unknownObservations.length > 1000 ||
    input.unknownObservations.some(
      (item) =>
        !item.messageId.trim() ||
        item.messageId.length > 256 ||
        ![
          "unbound_draft_observation",
          "unknown_account_thread",
          "ambiguous_account_thread",
          "message_deleted",
        ].includes(item.reason),
    ) ||
    (input.state === "complete" && input.unknownObservations.length > 0)
  )
    throw new Error("Gmail unknown observation is invalid.");
  const unknownObservations = [...input.unknownObservations].sort(
    (a, b) =>
      a.messageId.localeCompare(b.messageId) ||
      a.reason.localeCompare(b.reason),
  );
  if (
    !historyPattern.test(input.historyEnd) ||
    (input.historyStart !== null &&
      (!historyPattern.test(input.historyStart) ||
        BigInt(input.historyEnd) < BigInt(input.historyStart)))
  )
    throw new Error("Gmail history boundary is invalid.");
  return withGrowthTransaction(db, async (tx) => {
    const [connection] = await tx<
      Array<{
        status: string;
        subject: string | null;
        version: number;
        scopes: string[];
        cursor: string | null;
      }>
    >`
      select status, google_subject as subject, version, granted_scopes as scopes, provider_cursor as cursor
      from growth.integration_connections where id=${input.binding.connectionId} and provider='gmail' for update
    `;
    if (
      !connection ||
      connection.status !== "connected" ||
      connection.subject !== input.binding.googleSubject ||
      connection.version !== input.binding.grantEpoch ||
      !hasRequiredGmailScopes(connection.scopes) ||
      !sameAccountScopes(connection.scopes, input.binding.grantedScopes)
    )
      throw new Error("Gmail grant changed.");
    const [latest] = await tx<
      Array<{ id: string; historyEnd: string; observedUntil: Date }>
    >`
      select id, history_end as "historyEnd", observed_until as "observedUntil" from growth.gmail_reply_coverage
      where connection_id=${input.binding.connectionId} and google_subject=${input.binding.googleSubject} and grant_epoch<=${input.binding.grantEpoch}
      order by observed_until desc, created_at desc, id desc limit 1
    `;
    const [existing] = await tx<
      Array<{
        id: string;
        reason: string | null;
        sameObservations: boolean;
        sameHead: boolean;
      }>
    >`
      select id, reason, unknown_observations = ${tx.json(unknownObservations)} as "sameObservations", (head_requested_at=${input.headRequestedAt} and head_responded_at=${input.headRespondedAt}) as "sameHead" from growth.gmail_reply_coverage
      where connection_id=${input.binding.connectionId} and google_subject=${input.binding.googleSubject} and grant_epoch=${input.binding.grantEpoch}
      and history_start is not distinct from ${input.historyStart} and history_end=${input.historyEnd} and state=${input.state}
      and observed_from is not distinct from ${input.observedFrom} and observed_until=${input.observedUntil}
    `;
    if (existing) {
      if (
        !existing.sameObservations ||
        !existing.sameHead ||
        existing.reason !== input.reason ||
        latest?.id !== existing.id ||
        connection.cursor !== input.historyEnd
      )
        throw new Error("Gmail coverage conflict.");
      return existing.id;
    }
    if (
      connection.cursor !== input.expectedCursor ||
      (latest?.id ?? null) !== input.expectedCoverageId ||
      latest?.observedUntil.getTime() !==
        input.expectedObservedUntil?.getTime() ||
      (input.expectedObservedUntil !== null &&
        (input.observedFrom?.getTime() !==
          input.expectedObservedUntil.getTime() ||
          input.historyStart !== latest?.historyEnd))
    ) {
      throw new Error("Gmail coverage conflict.");
    }
    const [inserted] = await tx<
      Array<{ id: string }>
    >`insert into growth.gmail_reply_coverage(connection_id,grant_epoch,google_subject,history_start,history_end,observed_from,observed_until,head_requested_at,head_responded_at,state,reason,unknown_observations)
      values (${input.binding.connectionId},${input.binding.grantEpoch},${input.binding.googleSubject},${input.historyStart},${input.historyEnd},${input.observedFrom},${input.observedUntil},${input.headRequestedAt},${input.headRespondedAt},${input.state},${input.reason},${tx.json(unknownObservations)}) returning id`;
    if (!inserted) throw new Error("Gmail coverage insert failed.");
    await tx`update growth.integration_connections set provider_cursor=${input.historyEnd}, last_synced_at=now(), updated_at=now() where id=${input.binding.connectionId}`;
    return inserted.id;
  });
}

export async function loadReplySyncState(
  db: GrowthDb,
  binding: GmailGrantBinding,
): Promise<{
  cursor: string | null;
  historyCursor: string | null;
  coverageId: string | null;
  observedUntil: Date | null;
}> {
  const [connection] = await db<
    Array<{
      status: string;
      subject: string | null;
      version: number;
      scopes: string[];
      cursor: string | null;
    }>
  >`
    select status, google_subject as subject, version, granted_scopes as scopes, provider_cursor as cursor
    from growth.integration_connections where id=${binding.connectionId} and provider='gmail'
  `;
  if (
    !connection ||
    connection.status !== "connected" ||
    connection.subject !== binding.googleSubject ||
    connection.version !== binding.grantEpoch ||
    !hasRequiredGmailScopes(connection.scopes) ||
    !sameAccountScopes(connection.scopes, binding.grantedScopes)
  )
    throw new Error("Gmail grant changed.");
  const [latest] = await db<
    Array<{
      id: string;
      grantEpoch: number;
      historyEnd: string;
      observedUntil: Date;
    }>
  >`
    select id, grant_epoch as "grantEpoch", history_end as "historyEnd", observed_until as "observedUntil" from growth.gmail_reply_coverage
    where connection_id=${binding.connectionId} and google_subject=${binding.googleSubject} and grant_epoch<=${binding.grantEpoch}
    order by observed_until desc, created_at desc, id desc limit 1
  `;
  if (
    latest &&
    ((latest.grantEpoch === binding.grantEpoch &&
      latest.historyEnd !== connection.cursor) ||
      (latest.grantEpoch !== binding.grantEpoch && connection.cursor !== null))
  )
    throw new Error("Gmail coverage conflict.");
  return {
    cursor: connection.cursor,
    historyCursor: latest?.historyEnd ?? null,
    coverageId: latest?.id ?? null,
    observedUntil: latest?.observedUntil ?? null,
  };
}

export async function loadReplyCoverage(
  db: GrowthQueryExecutor,
  connectionId: string,
  googleSubject: string,
  from: Date,
  until: Date,
): Promise<boolean> {
  const rows = await db<Array<ReplyCoverageInterval>>`
    select state, observed_from as "observedFrom", observed_until as "observedUntil", grant_epoch as "grantEpoch", google_subject as "googleSubject"
    from growth.gmail_reply_coverage where connection_id=${connectionId} and google_subject=${googleSubject}
      and observed_until > ${from} and (observed_from is null or observed_from < ${until})
  `;
  return hasCompleteReplyCoverage(rows, googleSubject, from, until);
}
