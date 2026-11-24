import { createHash } from "node:crypto";
import type { FounderSession } from "../auth/require-founder";

export const CAMPAIGN_FOUNDER_EMAIL = "j.ntagengwa@faithfulsoftware.dev";

export function requireCampaignFounder(founder: FounderSession): void {
  if (
    founder.email !== CAMPAIGN_FOUNDER_EMAIL ||
    founder.actorId !== createHash("sha256").update(founder.email).digest("hex")
  )
    throw new Error("founder_authorization_required");
}
