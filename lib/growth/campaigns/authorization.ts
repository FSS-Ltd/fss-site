import { createHash } from "node:crypto";
import type { FounderSession } from "../auth/require-founder";

export function requireCampaignFounder(founder: FounderSession): void {
  if (
    founder.email !== "j.ntagengwa@faithfulsoftware.dev" ||
    founder.actorId !== createHash("sha256").update(founder.email).digest("hex")
  )
    throw new Error("founder_authorization_required");
}
