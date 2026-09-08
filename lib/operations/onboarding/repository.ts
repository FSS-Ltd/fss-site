import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { withAgreementTransaction } from "../agreements/repository";
import { validatePreparedWelcome, type PreparedWelcome } from "./approval";
import type { EffectReceipt, ProposalApprovalSnapshot } from "./types";
export async function startApprovedJourney(
  db: OperationsDb,
  founder: OperationsFounder | null,
  input: {
    organisationId: string;
    agreementId: string;
    approvalId: string;
    journeyId: string;
    prepared: PreparedWelcome;
  },
): Promise<string> {
  for (const id of [
    input.organisationId,
    input.agreementId,
    input.approvalId,
    input.journeyId,
  ])
    z.uuid().parse(id);
  validatePreparedWelcome(input.prepared);
  return withAgreementTransaction(db, founder, async (tx) => {
    const snapshot = JSON.stringify(input.prepared.snapshot);
    const [row] = await tx<
      { id: string }[]
    >`select operations.start_onboarding(${input.approvalId},${input.journeyId},${input.organisationId},${input.agreementId},${snapshot}::text::jsonb,${input.prepared.pdf},encode(sha256(convert_to(${snapshot}::text::jsonb::text,'UTF8')||${input.prepared.pdf}),'hex')) as id`;
    return row.id;
  });
}
export async function approveJourneyProposal(
  db: OperationsDb,
  founder: OperationsFounder | null,
  journeyId: string,
  snapshot: ProposalApprovalSnapshot,
  approvalId = randomUUID(),
): Promise<void> {
  z.uuid().parse(journeyId);
  z.uuid().parse(approvalId);
  await withAgreementTransaction(db, founder, async (tx) => {
    await tx`select operations.approve_onboarding_proposal(${journeyId},${approvalId},${JSON.stringify(snapshot)}::text::jsonb)`;
  });
}
export async function controlJourney(
  db: OperationsDb,
  founder: OperationsFounder | null,
  journeyId: string,
  command: "pause" | "resume" | "cancel",
): Promise<void> {
  z.uuid().parse(journeyId);
  await withAgreementTransaction(db, founder, async (tx) => {
    await tx`select operations.control_onboarding(${journeyId},${command})`;
  });
}
export async function recordOnboardingDeliveryFailure(
  db: OperationsDb,
  event: {
    accountScope: string;
    eventId: string;
    jobId: string;
    kind: "bounced" | "complained";
  },
): Promise<boolean> {
  z.uuid().parse(event.jobId);
  const [row] = await db<
    { changed: boolean }[]
  >`select operations.halt_onboarding_delivery('resend',${event.accountScope},${event.eventId},${event.jobId},${event.kind}) as changed`;
  return row.changed;
}

export async function reconcileJourneyAcceptance(
  db: OperationsDb,
  founder: OperationsFounder | null,
  jobId: string,
  receipt: EffectReceipt,
  reviewReference: string,
): Promise<void> {
  z.uuid().parse(jobId);
  z.string().trim().min(1).max(500).parse(reviewReference);
  z.object({
    providerId: z.string().min(1).max(300),
    acceptedAt: z.iso.datetime({ offset: true }),
    url: z.url().optional(),
  })
    .strict()
    .parse(receipt);
  await withAgreementTransaction(db, founder, async (tx) => {
    await tx`select operations.reconcile_onboarding_acceptance(${jobId},${JSON.stringify(receipt)}::text::jsonb,${reviewReference})`;
  });
}
