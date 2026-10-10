import { z } from "zod";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import {
  withAgreementTransaction,
  loadAgreement,
} from "../agreements/repository";
import {
  JourneyConflict,
  type JourneyActor,
  type JourneyCommandResult,
  type JourneyBillingAccount,
} from "./command-types";
import { verifyPreview } from "./preview-token";
import { assertCurrentDesignedWelcomeVersion } from "./current-welcome-version";
import { journeyCommandSchema, type JourneyCommand } from "./command-schema";
import { lockJourney } from "./command-lock";
import { envelope } from "./preview-envelope";
import {
  prepareWelcomePreview,
  prepareProposalPreview,
  workspaceReadiness,
} from "./prepare-preview";
import { canStartOnboardingJourney } from "./readiness";
export interface JourneyCommandOptions {
  previewKey: Buffer;
  portalOrigin: string;
  now?: () => number;
  billing: JourneyBillingAccount | null;
}

async function executeJourneyOperation<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["P0001", "P0002", "23505"].includes(String(error.code))
    )
      throw new JourneyConflict(
        "approval_conflict",
        "This approval, delivery or access changed. Refresh and reconcile attempted effects before replacement.",
      );
    throw error;
  }
}

export async function runJourneyCommand(
  tx: OperationsTransaction,
  actor: JourneyActor,
  organisationId: string,
  command: JourneyCommand,
  options: JourneyCommandOptions,
): Promise<JourneyCommandResult> {
  const now = options.now?.() ?? Date.now();
  if (command.action === "preview_welcome")
    return prepareWelcomePreview(
      tx,
      actor,
      organisationId,
      command,
      options,
      now,
    );
  if (command.action === "start" || command.action === "approve_proposal") {
    const data = envelope(
      verifyPreview(command.token, options.previewKey),
      actor,
      organisationId,
      now,
    );
    if ((command.action === "start") !== (data.kind === "welcome"))
      throw new JourneyConflict(
        "stale_preview",
        "Approve the matching preview.",
      );
    if (data.kind === "proposal") await lockJourney(tx, organisationId, data);
    await tx`select id from operations.agreements where organisation_id=${organisationId} and id=${data.agreementId} for update`;
    const record = await loadAgreement(tx, organisationId, data.agreementId);
    if (!record || record.version !== data.expectedVersion)
      throw new JourneyConflict(
        "stale_preview",
        "The agreement changed after preview. Prepare and review it again.",
      );
    if (data.kind === "welcome") {
      if (data.workspace)
        await assertCurrentDesignedWelcomeVersion(
          tx,
          data.snapshot.content.welcomePackVersionId,
          data.snapshot.content.edition,
        );
      if (
        data.workspace &&
        !canStartOnboardingJourney(
          await workspaceReadiness(
            tx,
            organisationId,
            record,
            { workspace: data.workspace, recipient: data.snapshot.recipient },
            options,
            data.journeyId,
          ),
        )
      )
        throw new JourneyConflict(
          "stale_preview",
          "This welcome setup changed. Review the preflight checks and prepare it again.",
        );
      const snapshot = JSON.stringify(data.snapshot);
      const pdf = Buffer.from(data.pdfBase64 ?? "", "base64");
      await tx`select operations.start_onboarding(${data.approvalId},${data.journeyId},${organisationId},${data.agreementId},${snapshot}::text::jsonb,${pdf},encode(sha256(convert_to(${snapshot}::text::jsonb::text,'UTF8')||${pdf}),'hex'))`;
      if (data.workspace)
        await tx`select operations.bind_onboarding_journey_workspace_snapshot(
          ${data.journeyId},
          ${data.workspace.templateVersionId},
          ${data.workspace.draftId},
          ${data.workspace.expectedDraftVersion}
        )`;
    } else {
      await tx`select operations.approve_onboarding_proposal(${data.journeyId},${data.approvalId},${JSON.stringify(data.snapshot)}::text::jsonb)`;
    }
    return { journeyId: data.journeyId };
  }
  const journey = await lockJourney(tx, organisationId, command);
  if (command.action === "preview_proposal")
    return prepareProposalPreview(
      tx,
      actor,
      organisationId,
      command,
      options,
      now,
      journey,
    );
  if (command.action === "retry") {
    await tx`select operations.retry_onboarding_failure(${organisationId},${command.journeyId},${command.jobId},${command.reviewReference})`;
  } else if (command.action === "reconcile") {
    const [job] =
      await tx`select b.id from operations.onboarding_jobs b join operations.onboarding_effects e on e.job_id=b.id where b.id=${command.jobId} and b.organisation_id=${organisationId} and b.journey_id=${command.journeyId} and (e.unresolved_acceptance or e.status='unknown_outcome')`;
    if (!job)
      throw new JourneyConflict(
        "recovery_required",
        "Only an unresolved permanent attempt can be reconciled. Refresh its current status.",
      );
    await tx`select operations.reconcile_onboarding_acceptance(${command.jobId},${JSON.stringify({ providerId: command.providerId, acceptedAt: command.acceptedAt })}::text::jsonb,${command.reviewReference})`;
  } else {
    await tx`select operations.control_onboarding(${command.journeyId},${command.action})`;
  }
  return { journeyId: command.journeyId };
}

export async function executeJourneyCommand(
  db: OperationsDb,
  founder: OperationsFounder,
  organisationId: string,
  raw: unknown,
  options: JourneyCommandOptions,
): Promise<JourneyCommandResult> {
  z.uuid().parse(organisationId);
  const command = journeyCommandSchema.parse(raw);
  return executeJourneyOperation(() =>
    withAgreementTransaction(db, founder, (tx) =>
      runJourneyCommand(tx, founder, organisationId, command, options),
    ),
  );
}

export async function executeStaffJourneyCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  options: JourneyCommandOptions,
): Promise<JourneyCommandResult> {
  z.uuid().parse(organisationId);
  const command = journeyCommandSchema.parse(raw);
  return executeJourneyOperation(() =>
    withFssAdminTransaction(db, admin, (tx) =>
      runJourneyCommand(tx, admin, organisationId, command, options),
    ),
  );
}
