import assert from "node:assert/strict";
import test from "node:test";
import { hasCurrentWelcomePacket } from "./journey-draft-version";
import { createDesignedWelcomePack } from "./packet-editions";
import type { WelcomePack } from "./welcome-pack-contract";
import type { OnboardingWorkspaceJourneyDraft } from "./workspace-types";

const agreementId = "8921e3ee-c111-4ed6-85e7-a94dfc460dd1";
const versionId = "23c9f3cb-77f7-4c05-b859-f319c88b14a0";
const content = createDesignedWelcomePack("website_build");
const pack: WelcomePack = {
  id: "website_build",
  title: "Website Build",
  draftVersion: 2,
  publishedVersion: 2,
  content,
  versions: [
    {
      id: versionId,
      version: 2,
      content,
      publishedAt: "2026-10-10T10:00:00Z",
    },
  ],
};
const draft: OnboardingWorkspaceJourneyDraft = {
  id: "5e0e3f99-f2e1-41af-9a4c-ddb563a6a3f2",
  agreementId,
  contactId: "e94053c4-b1f1-4270-8c6b-4d9414e7b8a9",
  templateVersionId: "3021c49a-4eb9-430c-a80f-5d8434f071aa",
  stage: "content",
  expectedAgreementVersion: 3,
  recipientRole: "owner",
  version: 1,
  updatedAt: "2026-10-10T10:00:00Z",
  content: {
    composer: {
      packet: content,
      packVersionId: versionId,
      scopeSummary: "Booking website",
      responsibilitiesSummary: "Approved copy and reviewer",
      obligationKey: "installment:1",
      settingsRevision: 2,
    },
  },
};

test("a saved packet is restored only with its latest edition and agreement revision", () => {
  assert.equal(
    hasCurrentWelcomePacket(draft, [pack], [{ id: agreementId, version: 3 }]),
    true,
  );
  assert.equal(
    hasCurrentWelcomePacket(draft, [pack], [{ id: agreementId, version: 4 }]),
    false,
  );
  assert.equal(
    hasCurrentWelcomePacket(
      draft,
      [{ ...pack, versions: [] }],
      [{ id: agreementId, version: 3 }],
    ),
    false,
  );
});
