import { createHash } from "node:crypto";
import { z } from "zod";
import type { GrowthTransaction } from "../db/types";
import { campaignSchema } from "./gmail-confirmation-campaign";
import { matchesDirectSubmissionEvidence } from "./direct-submission-evidence";
import { loadReplyCoverage } from "../sequences/gmail-sync-coverage-repository";

const receiptSchema = z.object({
  basis: z.literal("gmail_fss_sent_observed"),
  googleSubject: z.string().min(1),
  providerMessageId: z.string().min(1),
  providerThreadId: z.string().min(1),
  rfcMessageId: z.string().min(1),
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
  observedFrom: z.iso.datetime(),
  observedUntil: z.iso.datetime(),
  possibleInvocationFrom: z.iso.datetime(),
});

type AnchorRow = {
  reservationId: string;
  accountId: string;
  connectionId: string | null;
  grantEpoch: number | null;
  submittedAt: Date | null;
  observedAt: Date | null;
  providerId: string | null;
  threadId: string | null;
  rfc: string | null;
  hash: string | null;
  evidence: unknown;
  receipt: unknown;
  campaign: unknown;
  sameSnapshot: boolean;
  subject: string | null;
  html: string | null;
  text: string | null;
  sequenceThread: string | null;
  guardedClaim: boolean;
};

// The first receipt and committed issued snapshot are the only cohort anchor.
export async function loadFollowUpAnchor(
  tx: GrowthTransaction,
  input: { membershipId: string; connectionId: string; step: 1 | 2 },
): Promise<{
  campaign: z.infer<typeof campaignSchema>;
  submittedAt: Date;
  observedAt: Date;
  subject: string;
  threadId: string;
  googleSubject: string;
} | null> {
  const [row] = await tx<AnchorRow[]>`
    select r.id as "reservationId",r.account_id as "accountId",r.connection_id as "connectionId",r.grant_epoch as "grantEpoch",
      r.submitted_at as "submittedAt",r.confirmation_observed_at as "observedAt",r.provider_message_id as "providerId",r.provider_thread_id as "threadId",
      r.rfc_message_id as rfc,r.issued_snapshot_hash as hash,r.direct_submission_evidence as evidence,r.confirmation_receipt as receipt,
      r.issued_snapshot->'campaign' as campaign,(r.issued_snapshot->'campaign'=m.confirmed_snapshot) as "sameSnapshot",
      em.subject_snapshot as subject,em.html_snapshot as html,em.text_snapshot as text,se.gmail_thread_id as "sequenceThread",em.outreach_guarded_claim as "guardedClaim"
    from growth.campaign_memberships m
    join growth.sequence_enrollments se on se.id=m.sequence_id and se.prospect_id=m.prospect_id
    join growth.outreach_reservations r on r.id=m.first_confirmation_reservation_id and r.membership_id=m.id and r.sequence_id=se.id and r.campaign_id=m.campaign_id and r.policy_version=m.policy_version
    join growth.email_messages em on em.id=r.email_message_id and em.sequence_enrollment_id=se.id and em.step_number=0 and em.direction='outbound'
    where m.id=${input.membershipId} and r.status='accepted'`;
  const campaign = campaignSchema.safeParse(row?.campaign);
  const receipt = receiptSchema.safeParse(row?.receipt);
  if (
    !row ||
    !row.guardedClaim ||
    !campaign.success ||
    !receipt.success ||
    !row.sameSnapshot ||
    !row.submittedAt ||
    !row.observedAt ||
    !row.subject ||
    !row.html ||
    !row.text ||
    !row.hash ||
    !row.threadId ||
    !row.rfc ||
    row.connectionId !== input.connectionId ||
    row.sequenceThread !== row.threadId ||
    receipt.data.providerThreadId !== row.threadId ||
    receipt.data.providerMessageId !== row.providerId ||
    receipt.data.rfcMessageId !== row.rfc ||
    receipt.data.rawSha256 !== row.hash ||
    new Date(receipt.data.possibleInvocationFrom).getTime() !==
      row.submittedAt.getTime() ||
    new Date(receipt.data.observedUntil).getTime() !==
      row.observedAt.getTime() ||
    row.submittedAt > new Date(receipt.data.observedFrom) ||
    createHash("sha256")
      .update(JSON.stringify([row.subject, row.html, row.text]))
      .digest("hex") !== campaign.data.copySha256 ||
    campaign.data.membershipId !== input.membershipId
  )
    return null;
  if (
    !matchesDirectSubmissionEvidence(row.evidence, {
      version: 1,
      kind: "gmail_api_send_message_v1",
      reservationId: row.reservationId,
      accountId: row.accountId,
      connectionId: row.connectionId,
      googleSubject: receipt.data.googleSubject,
      grantEpoch: row.grantEpoch,
      rfcMessageId: row.rfc,
      rawSha256: row.hash,
      providerMessageId: row.providerId,
      providerThreadId: row.threadId,
    })
  )
    return null;
  if (input.step === 2) {
    const prior = await tx<
      Array<{
        id: string;
        accountId: string;
        grantEpoch: number;
        rfc: string;
        hash: string;
        providerId: string;
        threadId: string;
        evidence: unknown;
        campaign: unknown;
        subject: string;
        html: string;
        text: string;
      }>
    >`
      select r.id,r.account_id as "accountId",r.grant_epoch as "grantEpoch",r.rfc_message_id as rfc,
        r.issued_snapshot_hash as hash,r.provider_message_id as "providerId",r.provider_thread_id as "threadId",r.direct_submission_evidence as evidence,
        r.issued_snapshot->'campaign' as campaign,em.subject_snapshot as subject,em.html_snapshot as html,em.text_snapshot as text
      from growth.campaign_memberships m join growth.email_messages em on em.sequence_enrollment_id=m.sequence_id and em.step_number=1 and em.direction='outbound'
      join growth.outreach_reservations r on r.email_message_id=em.id and r.membership_id=m.id and r.sequence_id=m.sequence_id and r.campaign_id=m.campaign_id and r.policy_version=m.policy_version
      where m.id=${input.membershipId} and r.connection_id=${input.connectionId} and r.status='accepted' and r.confirmation_observed_at is not null
        and r.confirmation_receipt->>'basis'='gmail_fss_sent_observed' and r.confirmation_receipt->>'googleSubject'=${receipt.data.googleSubject}
        and r.confirmation_receipt->>'providerMessageId'=r.provider_message_id and r.confirmation_receipt->>'providerThreadId'=r.provider_thread_id
        and r.confirmation_receipt->>'rfcMessageId'=r.rfc_message_id and r.confirmation_receipt->>'rawSha256'=r.issued_snapshot_hash
        and r.provider_thread_id=${row.threadId} limit 2`;
    const p = prior[0];
    const priorCampaign = campaignSchema.safeParse(p?.campaign);
    if (
      prior.length !== 1 ||
      !p ||
      !priorCampaign.success ||
      !p.subject ||
      !p.html ||
      !p.text ||
      p.subject !== row.subject ||
      createHash("sha256")
        .update(JSON.stringify([p.subject, p.html, p.text]))
        .digest("hex") !== priorCampaign.data.copySha256 ||
      JSON.stringify({
        ...priorCampaign.data,
        copySha256: campaign.data.copySha256,
      }) !== JSON.stringify(campaign.data) ||
      !matchesDirectSubmissionEvidence(p.evidence, {
        version: 1,
        kind: "gmail_api_send_message_v1",
        reservationId: p.id,
        accountId: p.accountId,
        connectionId: input.connectionId,
        googleSubject: receipt.data.googleSubject,
        grantEpoch: p.grantEpoch,
        rfcMessageId: p.rfc,
        rawSha256: p.hash,
        providerMessageId: p.providerId,
        providerThreadId: p.threadId,
      })
    )
      return null;
  }
  return {
    campaign: campaign.data,
    submittedAt: row.submittedAt,
    observedAt: row.observedAt,
    subject: row.subject,
    threadId: row.threadId,
    googleSubject: receipt.data.googleSubject,
  };
}

// A caller may supply the exact committed sync ID, while the terminal reader
// independently verifies the latest current-grant coverage against the cursor.
export async function hasFollowUpReplyCoverage(
  tx: GrowthTransaction,
  input: {
    connectionId: string;
    googleSubject: string;
    submittedAt: Date;
    coverageId?: string;
  },
): Promise<boolean> {
  const [row] = await tx<{ id: string; observedUntil: Date }[]>`
    select coverage.id,coverage.observed_until as "observedUntil"
    from growth.integration_connections c
    join lateral (
      select id,grant_epoch,history_end,observed_until,state
      from growth.gmail_reply_coverage
      where connection_id=c.id and google_subject=c.google_subject and grant_epoch<=c.version
      order by observed_until desc,created_at desc,id desc limit 1
    ) coverage on true
    where c.id=${input.connectionId} and c.status='connected' and c.google_subject=${input.googleSubject}
      and coverage.grant_epoch=c.version and coverage.history_end=c.provider_cursor and coverage.state='complete'
      and coverage.observed_until<=clock_timestamp()
      and (${input.coverageId ?? null}::uuid is null or coverage.id=${input.coverageId ?? null}::uuid)`;
  if (!row || row.observedUntil <= input.submittedAt) return false;
  return loadReplyCoverage(
    tx,
    input.connectionId,
    input.googleSubject,
    input.submittedAt,
    row.observedUntil,
  );
}
