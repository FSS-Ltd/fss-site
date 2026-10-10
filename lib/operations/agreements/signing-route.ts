import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { resolveSiteUrl } from "../../config/site-url";
import { requireFounder } from "../../growth/auth/require-founder";
import { getPortalIdentity } from "../auth/server";
import { resolvePortalOrigin } from "../auth/configuration";
import { requireFssAdmin } from "../auth/require-admin";
import { getOperationsDb } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import { consumeRequestRateLimit } from "../requests/rate-limit";
import {
  createSigningCommandHandler,
  createSigningDownloadHandler,
} from "./signing-http";
import {
  executeFounderSigningCommand,
  executeStaffSigningCommand,
  executePortalSigningCommand,
  signingEnabled,
} from "./signing-commands";
import {
  downloadFounderSigningArtifact,
  downloadPortalSigningArtifact,
  downloadStaffSigningArtifact,
} from "./signing-service";
import { fssStudioEnabled } from "../auth/release-flags";
import {
  completeAgreementSigning,
  getSigningWorkerDb,
  recordSigningCompletionFailure,
} from "./signing-worker";

function configuration(origin: string) {
  return {
    enabled: signingEnabled(),
    origin,
    createCorrelationId: randomUUID,
    reportUnexpectedError: (report: {
      correlationId: string;
      errorName: string;
    }) => console.error("Operations signing request failed.", report),
  };
}
async function authorizeFounder() {
  try {
    return await requireFounder();
  } catch {
    return null;
  }
}
export function founderSigningRoute() {
  return createSigningCommandHandler({
    ...configuration(new URL(resolveSiteUrl()).origin),
    authorize: authorizeFounder,
    execute: (identity, organisationId, command, correlationId) =>
      executeFounderSigningCommand(
        getOperationsDb(),
        identity,
        organisationId,
        command,
        correlationId,
      ),
  });
}
export function portalSigningRoute() {
  return createSigningCommandHandler({
    ...configuration(resolvePortalOrigin()),
    authorize: getPortalIdentity,
    consumeRateLimit: (identity, organisationId, correlationId) =>
      consumeRequestRateLimit(
        getPortalDb(),
        identity,
        organisationId,
        correlationId,
      ),
    execute: async (identity, organisationId, command, correlationId) => {
      const approval = await executePortalSigningCommand(
        getPortalDb(),
        identity,
        organisationId,
        command,
        correlationId,
      );
      if (
        typeof command === "object" &&
        command !== null &&
        "action" in command &&
        command.action === "sign" &&
        approval.status === "approved" &&
        approval.requiredSigners.length > 0 &&
        approval.requiredSigners.every((email) =>
          approval.signatures.some((signature) => signature.email === email),
        )
      ) {
        after(async () => {
          try {
            await completeAgreementSigning(
              getSigningWorkerDb(),
              approval.id,
              correlationId,
            );
          } catch (error) {
            console.error(
              "Agreement completion will be retried by the signing worker.",
              {
                correlationId,
                errorName: error instanceof Error ? error.name : "UnknownError",
              },
            );
            try {
              await recordSigningCompletionFailure(
                getSigningWorkerDb(),
                approval.id,
              );
            } catch (recordError) {
              console.error(
                "Agreement completion failure could not be recorded.",
                {
                  correlationId,
                  errorName:
                    recordError instanceof Error
                      ? recordError.name
                      : "UnknownError",
                },
              );
            }
          }
        });
      }
      return approval;
    },
  });
}
async function authorizeStaff() {
  const identity = await getPortalIdentity();
  if (!identity) return null;
  try {
    return await requireFssAdmin(getPortalDb(), identity, randomUUID());
  } catch {
    return null;
  }
}
export function staffSigningRoute() {
  return createSigningCommandHandler({
    ...configuration(resolvePortalOrigin()),
    enabled: signingEnabled() && fssStudioEnabled(),
    authorize: authorizeStaff,
    execute: async (admin, organisationId, command, correlationId) => {
      const approval = await executeStaffSigningCommand(
        getOperationsDb(),
        admin,
        organisationId,
        command,
        correlationId,
      );
      if (
        typeof command === "object" &&
        command !== null &&
        "action" in command &&
        command.action === "retry"
      ) {
        after(async () => {
          try {
            await completeAgreementSigning(
              getSigningWorkerDb(),
              approval.id,
              correlationId,
            );
          } catch (error) {
            console.error("Agreement completion retry failed.", {
              correlationId,
              errorName: error instanceof Error ? error.name : "UnknownError",
            });
            try {
              await recordSigningCompletionFailure(
                getSigningWorkerDb(),
                approval.id,
              );
            } catch (recordError) {
              console.error(
                "Agreement completion failure could not be recorded.",
                {
                  correlationId,
                  errorName:
                    recordError instanceof Error
                      ? recordError.name
                      : "UnknownError",
                },
              );
            }
          }
        });
      }
      return approval;
    },
  });
}
export function founderSigningDownloadRoute() {
  return createSigningDownloadHandler({
    ...configuration(new URL(resolveSiteUrl()).origin),
    authorize: authorizeFounder,
    download: (identity, organisationId, approvalId, kind, correlationId) =>
      downloadFounderSigningArtifact(
        getOperationsDb(),
        identity,
        organisationId,
        approvalId,
        kind,
        correlationId,
      ),
  });
}
export function portalSigningDownloadRoute() {
  return createSigningDownloadHandler({
    ...configuration(resolvePortalOrigin()),
    authorize: getPortalIdentity,
    download: (identity, organisationId, approvalId, kind, correlationId) =>
      downloadPortalSigningArtifact(
        getPortalDb(),
        identity,
        organisationId,
        approvalId,
        kind,
        correlationId,
      ),
  });
}
export function staffSigningDownloadRoute() {
  return createSigningDownloadHandler({
    ...configuration(resolvePortalOrigin()),
    enabled: signingEnabled() && fssStudioEnabled(),
    authorize: authorizeStaff,
    download: (admin, organisationId, approvalId, kind, correlationId) =>
      downloadStaffSigningArtifact(
        getOperationsDb(),
        admin,
        organisationId,
        approvalId,
        kind,
        correlationId,
      ),
  });
}
