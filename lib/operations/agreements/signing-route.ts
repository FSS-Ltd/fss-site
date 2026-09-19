import { randomUUID } from "node:crypto";
import { resolveSiteUrl } from "../../config/site-url";
import { requireFounder } from "../../growth/auth/require-founder";
import { getPortalIdentity } from "../auth/server";
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
    ...configuration(),
    authorize: authorizeStaff,
    execute: (admin, organisationId, command, correlationId) =>
      executeStaffSigningCommand(
        getOperationsDb(),
        admin,
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
export function staffSigningDownloadRoute() {
  return createSigningDownloadHandler({
    ...configuration(),
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
