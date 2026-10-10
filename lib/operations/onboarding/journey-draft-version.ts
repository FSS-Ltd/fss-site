import type { WelcomePack } from "./welcome-pack-contract";
import type { OnboardingWorkspaceJourneyDraft } from "./workspace-types";

export function hasCurrentWelcomePacket(
  draft: OnboardingWorkspaceJourneyDraft | undefined,
  packs: readonly WelcomePack[],
  agreements: readonly { id: string; version: number }[],
): boolean {
  const versionId = draft?.content?.composer?.packVersionId;
  return Boolean(
    versionId &&
    packs.some(
      (pack) =>
        pack.versions[0]?.id === versionId &&
        pack.versions[0]?.content.rendererVersion === 2,
    ) &&
    agreements.some(
      (agreement) =>
        agreement.id === draft?.agreementId &&
        agreement.version === draft.expectedAgreementVersion,
    ),
  );
}
