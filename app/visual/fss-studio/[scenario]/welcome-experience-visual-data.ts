import type { AgreementRecord } from "@/lib/operations/agreements/types";
import {
  createDesignedWelcomePack,
  packetEditions,
} from "@/lib/operations/onboarding/packet-editions";
import { resolveWelcomePack } from "@/lib/operations/onboarding/welcome-personalisation";
import type { WelcomePack } from "@/lib/operations/onboarding/welcome-pack-contract";
import type { OnboardingWorkspaceJourneyDraft } from "@/lib/operations/onboarding/workspace-types";
export const welcomeVisualSettings = {
  revision: 3,
  displayName: "Jean-Fidele",
  replyTo: "hello@faithfulsoftwaresolutions.co.uk",
  timezone: "Europe/London",
  responseExpectationHours: 48,
  deliveryCapacity: "standard" as const,
};
export const welcomeVisualContacts = [
  {
    id: "5a4c051b-88ec-4d00-a634-ea16da5d6c17",
    email: "alex@northstar.example.test",
    name: "Alex Morgan",
  },
  {
    id: "6264c4cf-0341-408f-9159-24953d64742f",
    email: "sam@northstar.example.test",
    name: "Sam Carter",
  },
];
export const welcomeVisualPacks: readonly WelcomePack[] = packetEditions.map(
  (edition, index) => {
    const content = createDesignedWelcomePack(edition.id);
    return {
      id: edition.id,
      title: edition.title,
      draftVersion: 2,
      publishedVersion: 1,
      content,
      versions: [
        {
          id: `88000000-0000-4000-8000-00000000000${index + 1}`,
          version: 1,
          publishedAt: "2026-09-20T09:00:00Z",
          content,
        },
      ],
    };
  },
);
export const welcomeVisualAgreement: AgreementRecord = {
  archivedAt: null,
  id: "fbb253c0-1632-43c1-bc5a-d5998df765cc",
  engagementId: "1bbc8d1c-fae7-423b-b95e-833cd373bc39",
  version: 3,
  revision: 1,
  status: "draft",
  evidence: null,
  services: [],
  draft: {
    title: "Website & booking experience",
    goals: "Make booking clear and simple.",
    scope:
      "Five content pages, booking workflow, confirmation email and handover.",
    responsibilities:
      "Provide approved copy, brand assets and an authorised reviewer.",
    support:
      "Defect support is included. Additional scope needs a separate quote.",
    terms: "The retained agreement governs the proposed work.",
    billingContact: welcomeVisualContacts[0].email,
    signatories: [welcomeVisualContacts[0].email],
    documentHash: "a".repeat(64),
    documentReference: "private:signing/fixture/source.pdf",
    currency: "GBP",
    taxTreatment: "Tax follows the agreement.",
    noticeDays: 30,
    minimumTermMonths: 0,
    requiredDepositPence: "120000",
    assetsRequired: true,
    lines: [
      {
        serviceCode: "website",
        description: "Website & booking experience",
        quantity: 1,
        unitPence: "240000",
        discountPence: "0",
        taxPence: "0",
        recurrenceMonths: 0,
        startDate: "2026-10-15",
        endDate: null,
      },
    ],
    installments: [
      { amountPence: "120000", dueDate: "2026-10-15" },
      { amountPence: "120000", dueDate: "2026-11-15" },
    ],
  },
};
export const personalisedVisualPacket = resolveWelcomePack(
  welcomeVisualPacks[0].content,
  {
    client_name: "Northstar Studio",
    contact_first_name: "Alex",
    agreement_goal: welcomeVisualAgreement.draft.goals,
    agreement_scope: welcomeVisualAgreement.draft.scope,
    sender_name: welcomeVisualSettings.displayName,
  },
  48,
);
const savedBase = {
  agreementId: welcomeVisualAgreement.id,
  contactId: welcomeVisualContacts[0].id,
  templateVersionId: "0e5d47c9-44b3-413c-9a4d-76ed2ee543b5",
  expectedAgreementVersion: 3,
  recipientRole: "owner" as const,
  updatedAt: "2026-10-01T09:00:00Z",
};
export const welcomeVisualDrafts: readonly OnboardingWorkspaceJourneyDraft[] = [
  {
    ...savedBase,
    id: "a112e4b4-6f45-47ae-a84b-54ba3fb0f81d",
    version: 1,
    stage: "setup",
  },
  {
    ...savedBase,
    id: "2be0dab8-ab42-4b5c-94cf-e65c7b6794e7",
    version: 2,
    stage: "content",
    content: {
      composer: {
        packet: {
          ...personalisedVisualPacket,
          emailSubject: "Restored welcome for Northstar",
        },
        packVersionId: welcomeVisualPacks[0].versions[0].id,
        obligationKey: "installment:1",
        settingsRevision: 3,
      },
    },
  },
];
