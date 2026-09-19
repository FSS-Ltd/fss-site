import { invoiceChoices } from "./display";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { OperationsTransaction } from "../db/client";
import { loadAgreement } from "../agreements/repository";
import { prepareWelcome, prepareProposal } from "./approval";
import {
  JourneyConflict,
  type JourneyActor,
  type JourneyCommandResult,
} from "./command-types";
import { signPreview } from "./preview-token";
import type { PreviewEnvelope } from "./preview-envelope";
import type {
  ProposalApprovalSnapshot,
  WelcomeApprovalSnapshot,
} from "./types";
import type { JourneyCommand } from "./command-schema";
import type { JourneyCommandOptions } from "./commands";
export async function prepareWelcomePreview(
  tx: OperationsTransaction,
  actor: JourneyActor,
  organisationId: string,
  command: Extract<JourneyCommand, { action: "preview_welcome" }>,
  options: JourneyCommandOptions,
  now: number,
): Promise<JourneyCommandResult> {
  const record = await loadAgreement(tx, organisationId, command.agreementId);
  if (!record || record.version !== command.expectedVersion)
    throw new JourneyConflict(
      "stale_preview",
      "The agreement changed. Refresh and prepare a new welcome preview.",
    );
  const [contact] =
    await tx`select id from operations.contacts where organisation_id=${organisationId} and email=${command.welcome.recipient}`;
  if (!contact)
    throw new JourneyConflict(
      "approval_conflict",
      "Select an existing contact for this organisation.",
    );
  if (!options.billing)
    throw new JourneyConflict(
      "configuration",
      "Billing must be configured before preparing a welcome journey.",
    );
  if (
    command.welcome.invoice.accountId !== options.billing.accountId ||
    command.welcome.invoice.livemode !== options.billing.livemode
  )
    throw new JourneyConflict(
      "configuration",
      "The billing account changed. Refresh before preparing this welcome.",
    );
  if (
    !invoiceChoices(record.draft).some(
      (choice) => choice.value === command.welcome.invoice.obligationKey,
    )
  )
    throw new JourneyConflict(
      "approval_conflict",
      "Choose an obligation from the current agreement.",
    );
  let prepared;
  try {
    prepared = await prepareWelcome(command.welcome);
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    throw new JourneyConflict(
      "approval_conflict",
      "The welcome PDF could not be prepared. Use supported Western European text and shorten pages that exceed their readable limit.",
    );
  }
  const data: PreviewEnvelope = {
    kind: "welcome",
    actorId: actor.actorId,
    organisationId,
    agreementId: record.id,
    expectedVersion: record.version,
    expiresAt: now + 30 * 60 * 1000,
    journeyId: randomUUID(),
    approvalId: randomUUID(),
    snapshot: prepared.snapshot,
    pdfBase64: prepared.pdf.toString("base64"),
  };
  return {
    preview: {
      kind: "welcome",
      token: signPreview(data, options.previewKey),
      agreementId: record.id,
      snapshot: prepared.snapshot,
      pdfBase64: data.pdfBase64,
    },
  };
}
export async function prepareProposalPreview(
  tx: OperationsTransaction,
  actor: JourneyActor,
  organisationId: string,
  command: Extract<JourneyCommand, { action: "preview_proposal" }>,
  options: JourneyCommandOptions,
  now: number,
  journey: { agreementId: string; welcome: WelcomeApprovalSnapshot },
): Promise<JourneyCommandResult> {
  const [approval] = await tx<
    { approvalHash: string; revision: number; signers: string[] }[]
  >`select s.approval_hash as "approvalHash",s.revision,s.snapshot->'signatories' as signers from operations.signing_approvals s join operations.agreements a on a.id=s.agreement_id where s.organisation_id=${organisationId} and s.agreement_id=${journey.agreementId} and s.id=${command.signingApprovalId} and s.status='approved' and s.expires_at>clock_timestamp() and a.current_revision=s.revision`;
  if (!approval)
    throw new JourneyConflict(
      "approval_conflict",
      "Approve the current signing document before previewing its proposal notice.",
    );
  const record = await loadAgreement(tx, organisationId, journey.agreementId);
  if (!record)
    throw new JourneyConflict("unavailable", "The agreement is unavailable.");
  const contacts = await tx<
    { email: string }[]
  >`select email from operations.contacts where organisation_id=${organisationId} and email in ${tx(command.access.map((a) => a.email.toLowerCase()))}`;
  if (
    command.access.some(
      (a) => !contacts.some((c) => c.email === a.email.toLowerCase()),
    )
  )
    throw new JourneyConflict(
      "approval_conflict",
      "Every access recipient must be an existing contact for this organisation.",
    );
  let snapshot: ProposalApprovalSnapshot;
  try {
    snapshot = prepareProposal(
      {
        signingApprovalId: command.signingApprovalId,
        ...approval,
        access: command.access,
        scopeSummary: command.scopeSummary,
        portalUrl: new URL("/agreements", options.portalOrigin).href,
      },
      journey.welcome,
    );
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    throw new JourneyConflict(
      "approval_conflict",
      "Approve unique recipients, each signer’s role, and owner or billing access for the invoice recipient.",
    );
  }
  const data: PreviewEnvelope = {
    kind: "proposal",
    actorId: actor.actorId,
    organisationId,
    agreementId: journey.agreementId,
    expectedVersion: record.version,
    expiresAt: now + 30 * 60 * 1000,
    journeyId: command.journeyId,
    approvalId: randomUUID(),
    snapshot,
    expectedGeneration: command.expectedGeneration,
    expectedProposalApprovalId: command.expectedProposalApprovalId,
  };
  return {
    preview: {
      kind: "proposal",
      token: signPreview(data, options.previewKey),
      journeyId: command.journeyId,
      snapshot,
    },
  };
}
