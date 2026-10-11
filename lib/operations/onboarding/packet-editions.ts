import type {
  WelcomePackContent,
  WelcomePackId,
} from "./welcome-pack-contract";
import type { PacketImageId } from "./packet-metadata";
import { designedPacketGuide } from "./packet-copy";
export {
  packetAssets,
  packetSectionIds,
  packetLayouts,
  packetImageIds,
} from "./packet-metadata";
export type {
  PacketImageId,
  PacketLayout,
  PacketSectionId,
} from "./packet-metadata";

export interface PacketEdition {
  id: WelcomePackId;
  title: string;
  description: string;
  coverImageId: PacketImageId;
  pageCount: 10;
}
export const packetEditions: readonly PacketEdition[] = [
  {
    id: "website_build",
    title: "Website Build",
    description: "A clear plan from content and design through launch.",
    coverImageId: "human_craft",
    pageCount: 10,
  },
  {
    id: "website_seo",
    title: "Website + SEO",
    description: "Website delivery with an agreed search and reporting plan.",
    coverImageId: "workflow",
    pageCount: 10,
  },
  {
    id: "systems_portal",
    title: "Systems Portal",
    description: "Roles, data and review stages for a connected workspace.",
    coverImageId: "mission_systems",
    pageCount: 10,
  },
];
export function getPacketEdition(packId: WelcomePackId): PacketEdition {
  const edition = packetEditions.find((item) => item.id === packId);
  if (!edition) throw new Error("Unsupported welcome packet edition.");
  return edition;
}
export function createDesignedWelcomePack(
  packId: WelcomePackId,
): WelcomePackContent {
  const edition = getPacketEdition(packId);
  const prefix = {
    website_build: "10000000",
    website_seo: "20000000",
    systems_portal: "30000000",
  }[packId];
  const taskId = (number: number): string =>
    `${prefix}-0000-4000-8000-00000000000${number}`;
  return {
    journeyPhase: "post_signature",
    rendererVersion: 2,
    emailArtworkVersion: 1,
    edition: packId,
    emailSubject: `${edition.title}: next steps for {{client_name}}`,
    emailBody: `Hello {{contact_first_name}},\n\nWelcome to your ${edition.title.toLowerCase()} project. Your signed agreement sets out the scope, responsibilities, fees and terms. This packet explains how we will approach {{agreement_goal}} and the decisions we will make together.\n\nRead the attached packet, check the priorities, and prepare the inputs described in your checklist. We will confirm kickoff and milestone dates after the agreed prerequisites are ready.\n\nReply if a priority needs changing so we can review the plan together.\n\n{{sender_name}}\nFaithful Software Solutions`,
    guide: designedPacketGuide(packId),
    thankYou: {
      subject: `${edition.title}: your next step`,
      intro: "Thank you for confirming the agreed work for {{client_name}}.",
      nextStep:
        "to confirm kickoff and review dates after the agreed prerequisites are complete",
      requiredAction:
        "Please prepare the materials and authorised access listed in your agreement and checklist.",
    },
    tasks: [
      {
        id: taskId(1),
        title: "Confirm your project contact",
        instructions:
          "Check your workspace contact details and confirm who will review the work.",
        kind: "profile",
        ownerRole: "owner",
        required: true,
        dependsOnTaskId: null,
        dueRule: "activation",
        evidenceRule: "profile_saved",
        bookingUrl: null,
      },
      {
        id: taskId(2),
        title: "Review scope and responsibilities",
        instructions:
          "Review the signed agreement's scope, responsibilities and acceptance criteria.",
        kind: "acknowledgement",
        ownerRole: "owner",
        required: true,
        dependsOnTaskId: taskId(1),
        dueRule: "signature",
        evidenceRule: "acknowledged",
        bookingUrl: null,
      },
      {
        id: taskId(3),
        title:
          packId === "systems_portal"
            ? "Prepare agreed system inputs"
            : "Prepare approved content and access",
        instructions:
          packId === "systems_portal"
            ? "Identify stakeholders and prepare authorised access or sample data listed in your agreement. Share them through the secure route confirmed by FSS."
            : "Gather approved copy, brand assets and authorised access listed in your agreement. Share them through the secure route confirmed by FSS.",
        kind: "custom",
        ownerRole: "owner",
        required: true,
        dependsOnTaskId: taskId(2),
        dueRule: "previous_task",
        evidenceRule: "staff_confirmed",
        bookingUrl: null,
      },
    ],
  };
}
