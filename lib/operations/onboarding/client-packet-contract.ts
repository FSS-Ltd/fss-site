import type { WelcomePage } from "./types";
import type { WelcomePackId } from "./welcome-pack-contract";

export type ClientWelcomePacket = Readonly<{
  approvalId: string;
  approvedAt: string;
  title: string;
  organisationName: string;
  senderName: string;
  rendererVersion?: 2;
  edition?: WelcomePackId;
  pages: readonly WelcomePage[];
}>;
