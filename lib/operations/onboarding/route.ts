import { createWelcomeDownloadHandler, loadWelcomePdf } from "./download";
import { randomUUID } from "node:crypto";
import { requireFounder } from "../../growth/auth/require-founder";
import { resolveSiteUrl } from "../../config/site-url";
import { getOperationsDb } from "../db/client";
import { onboardingEnabled } from "./worker-db";
import { journeyCommandOptions } from "./command-configuration";
import { createJourneyCommandHandler } from "./http";
import { executeJourneyCommand } from "./commands";
export function founderJourneyRoute() {
  return createJourneyCommandHandler({
    enabled: onboardingEnabled(),
    origin: new URL(resolveSiteUrl()).origin,
    createCorrelationId: randomUUID,
    authorize: async () => {
      try {
        return await requireFounder();
      } catch {
        return null;
      }
    },
    reportUnexpectedError: (report) =>
      console.error("Operations journey request failed.", report),
    execute: (founder, organisationId, raw) =>
      executeJourneyCommand(
        getOperationsDb(),
        founder,
        organisationId,
        raw,
        journeyCommandOptions(),
      ),
  });
}

export function founderWelcomeDownloadRoute() {
  return createWelcomeDownloadHandler({
    enabled: onboardingEnabled(),
    createCorrelationId: randomUUID,
    authorize: async () => {
      try {
        return await requireFounder();
      } catch {
        return null;
      }
    },
    reportUnexpectedError: (report) =>
      console.error("Operations welcome download failed.", report),
    download: (founder, organisationId, journeyId) =>
      loadWelcomePdf(getOperationsDb(), founder, organisationId, journeyId),
  });
}
