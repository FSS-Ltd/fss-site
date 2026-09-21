import {
  createWelcomeDownloadHandler,
  loadStaffWelcomePdf,
  loadWelcomePdf,
} from "./download";
import { randomUUID } from "node:crypto";
import { requireFounder } from "../../growth/auth/require-founder";
import { resolveSiteUrl } from "../../config/site-url";
import { getPortalIdentity } from "../auth/server";
import { requireFssAdmin } from "../auth/require-admin";
import { getOperationsDb } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import { onboardingEnabled } from "./worker-db";
import { journeyCommandOptions } from "./command-configuration";
import { createJourneyCommandHandler } from "./http";
import { executeJourneyCommand, executeStaffJourneyCommand } from "./commands";
import {
  executeStaffOnboardingWorkspaceCommand,
  type OnboardingWorkspaceCommandResult,
} from "./workspace-commands";
import type { JourneyCommandResult } from "./command-types";
import type { FssAdminContext } from "../auth/staff-types";
import { fssStudioEnabled } from "../auth/release-flags";
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

async function authorizeStaff(): Promise<FssAdminContext | null> {
  const identity = await getPortalIdentity();
  if (!identity) return null;
  try {
    return await requireFssAdmin(getPortalDb(), identity, randomUUID());
  } catch {
    return null;
  }
}

export function staffJourneyRoute() {
  return createJourneyCommandHandler({
    enabled: onboardingEnabled() && fssStudioEnabled(),
    origin: new URL(resolveSiteUrl()).origin,
    createCorrelationId: randomUUID,
    authorize: authorizeStaff,
    reportUnexpectedError: (report) =>
      console.error("Staff journey request failed.", report),
    execute: (admin, organisationId, raw) =>
      executeStaffJourneyCommand(
        getOperationsDb(),
        admin,
        organisationId,
        raw,
        journeyCommandOptions(),
      ),
  });
}

const workspaceActions = new Set([
  "save_template_draft",
  "publish_template",
  "save_journey_draft",
  "discard_journey_draft",
  "confirm_booking",
]);

function isWorkspaceAction(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "action" in raw &&
    typeof raw.action === "string" &&
    workspaceActions.has(raw.action)
  );
}

export function staffOnboardingRoute() {
  return createJourneyCommandHandler<
    FssAdminContext,
    JourneyCommandResult | OnboardingWorkspaceCommandResult
  >({
    enabled: onboardingEnabled() && fssStudioEnabled(),
    origin: new URL(resolveSiteUrl()).origin,
    createCorrelationId: randomUUID,
    authorize: authorizeStaff,
    reportUnexpectedError: (report) =>
      console.error("Staff onboarding request failed.", report),
    execute: (admin, organisationId, raw) =>
      isWorkspaceAction(raw)
        ? executeStaffOnboardingWorkspaceCommand(
            getOperationsDb(),
            admin,
            organisationId,
            raw,
            journeyCommandOptions(),
          )
        : executeStaffJourneyCommand(
            getOperationsDb(),
            admin,
            organisationId,
            raw,
            journeyCommandOptions(),
          ),
  });
}

export function staffOnboardingWorkspaceRoute() {
  return createJourneyCommandHandler<
    FssAdminContext,
    OnboardingWorkspaceCommandResult
  >({
    enabled: onboardingEnabled() && fssStudioEnabled(),
    origin: new URL(resolveSiteUrl()).origin,
    createCorrelationId: randomUUID,
    authorize: authorizeStaff,
    reportUnexpectedError: (report) =>
      console.error("Staff onboarding workspace request failed.", report),
    execute: (admin, organisationId, raw) =>
      executeStaffOnboardingWorkspaceCommand(
        getOperationsDb(),
        admin,
        organisationId,
        raw,
        journeyCommandOptions(),
      ),
  });
}

export function staffWelcomeDownloadRoute() {
  return createWelcomeDownloadHandler({
    enabled: onboardingEnabled() && fssStudioEnabled(),
    createCorrelationId: randomUUID,
    authorize: authorizeStaff,
    reportUnexpectedError: (report) =>
      console.error("Staff welcome download failed.", report),
    download: (admin, organisationId, journeyId) =>
      loadStaffWelcomePdf(getOperationsDb(), admin, organisationId, journeyId),
  });
}
