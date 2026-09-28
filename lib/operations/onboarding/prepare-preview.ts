import { invoiceChoices } from "./display";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { OperationsTransaction } from "../db/client";
import { loadAgreement } from "../agreements/repository";
import { portalUrl } from "../auth/portal-url";
import { prepareWelcome, prepareProposal } from "./approval";
import {
  JourneyConflict,
  type JourneyActor,
  type JourneyCommandResult,
} from "./command-types";
import { signPreview } from "./preview-token";
import type { PreviewEnvelope } from "./preview-envelope";
import { parseOnboardingWorkspace } from "./queries";
import {
  buildOnboardingReadiness,
  type OnboardingReadinessInput,
} from "./readiness";
import type {
  ProposalApprovalSnapshot,
  WelcomeApprovalSnapshot,
} from "./types";
import type { JourneyCommand } from "./command-schema";
import type { JourneyCommandOptions } from "./commands";
import type { OnboardingReadinessCheck } from "./workspace-types";

type WorkspaceReadinessContext = Readonly<{
  workspace?: Extract<
    JourneyCommand,
    { action: "preview_welcome" }
  >["workspace"];
  recipient: string;
}>;

export async function workspaceReadiness(
  tx: OperationsTransaction,
  organisationId: string,
  agreement: { id: string; version: number; status: string },
  command: WorkspaceReadinessContext,
  options: JourneyCommandOptions,
  expectedJourneyId?: string,
): Promise<readonly OnboardingReadinessCheck[]> {
  if (!command.workspace)
    return buildOnboardingReadiness({
      senderConfigured: true,
      currentAgreement: true,
      noActiveJourney: true,
      contactAvailable: true,
      templateVersionAvailable: true,
      recipientRoleAllowed: true,
      billingConfigured: options.billing !== null,
      signingReady: agreement.status === "draft",
    });
  const [row] = await tx<Array<{ workspace: unknown }>>`
    select operations.read_onboarding_workspace(${organisationId}) as workspace
  `;
  const workspace = row ? parseOnboardingWorkspace(row.workspace) : null;
  const draft = workspace?.journeyDrafts.find(
    (candidate) => candidate.id === command.workspace!.draftId,
  );
  const [contact] = await tx<Array<{ email: string }>>`
    select email from operations.contacts
    where organisation_id = ${organisationId} and id = ${command.workspace.contactId}
  `;
  const [existing] = await tx<Array<{ id: string }>>`
    select id from operations.onboarding_journeys
    where organisation_id = ${organisationId} and agreement_id = ${agreement.id}
  `;
  const input: OnboardingReadinessInput = {
    senderConfigured: true,
    currentAgreement:
      draft?.agreementId === agreement.id &&
      draft.expectedAgreementVersion === agreement.version &&
      draft.version === command.workspace.expectedDraftVersion,
    noActiveJourney: !existing || existing.id === expectedJourneyId,
    contactAvailable:
      draft?.contactId === command.workspace.contactId &&
      contact?.email.toLowerCase() === command.recipient,
    templateVersionAvailable:
      draft?.templateVersionId === command.workspace.templateVersionId &&
      workspace?.templates.some(
        (template) => template.id === command.workspace!.templateVersionId,
      ) === true,
    recipientRoleAllowed:
      draft?.recipientRole === command.workspace.recipientRole,
    billingConfigured: options.billing !== null,
    signingReady: agreement.status === "draft",
  };
  return buildOnboardingReadiness(input);
}
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
  const welcomePackVersionId = command.welcome.content.welcomePackVersionId;
  if (welcomePackVersionId) {
    if (!command.workspace)
      throw new JourneyConflict(
        "approval_conflict",
        "Apply the selected welcome pack to this client and save its checklist before preparing the welcome.",
      );
    const [packVersion] = await tx<Array<{ id: string }>>`
      select id from operations.welcome_pack_versions
      where id = ${welcomePackVersionId}
    `;
    const [checklistVersion] = await tx<Array<{ id: string }>>`
      select id from operations.onboarding_template_versions
      where organisation_id = ${organisationId}
        and id = ${command.workspace.templateVersionId}
        and source_welcome_pack_version_id = ${welcomePackVersionId}
    `;
    if (!packVersion || !checklistVersion)
      throw new JourneyConflict(
        "approval_conflict",
        "The selected pack or its client checklist has changed. Apply the current published pack and prepare a new welcome preview.",
      );
    const [reviewedContent] = await tx<Array<{ matches: boolean }>>`
      select content -> 'reviewedWelcome' = ${tx.json(command.welcome)}::jsonb as matches
      from operations.onboarding_journey_drafts
      where id = ${command.workspace.draftId}
        and organisation_id = ${organisationId}
        and agreement_id = ${command.agreementId}
        and contact_id = ${command.workspace.contactId}
        and template_version_id = ${command.workspace.templateVersionId}
    `;
    if (!reviewedContent?.matches)
      throw new JourneyConflict(
        "approval_conflict",
        "The reviewed client welcome changed. Save the current welcome content to the journey draft and prepare a new preview.",
      );
  }
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
    workspace: command.workspace,
  };
  const readiness = await workspaceReadiness(
    tx,
    organisationId,
    record,
    { workspace: command.workspace, recipient: command.welcome.recipient },
    options,
  );
  return {
    preview: {
      kind: "welcome",
      token: signPreview(data, options.previewKey),
      agreementId: record.id,
      snapshot: prepared.snapshot,
      pdfBase64: data.pdfBase64,
      readiness,
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
        portalUrl: portalUrl("/agreements", options.portalOrigin).href,
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
