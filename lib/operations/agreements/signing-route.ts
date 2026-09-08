import { randomUUID } from "node:crypto";
import { resolveSiteUrl } from "../../config/site-url";
import { requireFounder } from "../../growth/auth/require-founder";
import { getPortalIdentity } from "../auth/server";
import { getOperationsDb } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import { consumeRequestRateLimit } from "../requests/rate-limit";
import {
  createSigningCommandHandler,
  createSigningDownloadHandler,
} from "./signing-http";
import {
  executeFounderSigningCommand,
  executePortalSigningCommand,
  signingEnabled,
} from "./signing-commands";
import {
  downloadFounderSigningArtifact,
  downloadPortalSigningArtifact,
} from "./signing-service";

function configuration() {
  return {
    enabled: signingEnabled(),
    origin: new URL(resolveSiteUrl()).origin,
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
    ...configuration(),
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
    ...configuration(),
    authorize: getPortalIdentity,
    consumeRateLimit: (identity, organisationId, correlationId) =>
      consumeRequestRateLimit(
        getPortalDb(),
        identity,
        organisationId,
        correlationId,
      ),
    execute: (identity, organisationId, command, correlationId) =>
      executePortalSigningCommand(
        getPortalDb(),
        identity,
        organisationId,
        command,
        correlationId,
      ),
  });
}
export function founderSigningDownloadRoute() {
  return createSigningDownloadHandler({
    ...configuration(),
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
    ...configuration(),
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
