import type { OperationsTransaction } from "../db/client";
import type { WelcomeApprovalSnapshot } from "./types";
import { JourneyConflict } from "./command-types";
export async function lockJourney(
  tx: OperationsTransaction,
  organisationId: string,
  command: {
    journeyId: string;
    expectedGeneration: number;
    expectedProposalApprovalId: string | null;
  },
) {
  try {
    await tx`select operations.lock_onboarding_founder(${organisationId},${command.journeyId},${command.expectedGeneration},${command.expectedProposalApprovalId})`;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P0001"
    )
      throw new JourneyConflict(
        "stale_journey",
        "The journey changed or is unavailable. Refresh before trying again.",
      );
    throw error;
  }
  const [row] = await tx<
    { agreementId: string; welcome: WelcomeApprovalSnapshot }[]
  >`select j.agreement_id as "agreementId",a.snapshot as welcome from operations.onboarding_journeys j join operations.onboarding_approvals a on a.id=j.approval_id where j.id=${command.journeyId} and j.organisation_id=${organisationId} and j.generation=${command.expectedGeneration} and j.proposal_approval_id is not distinct from ${command.expectedProposalApprovalId}::uuid`;
  if (!row)
    throw new JourneyConflict(
      "stale_journey",
      "The journey changed or is unavailable. Refresh before trying again.",
    );
  return row;
}
