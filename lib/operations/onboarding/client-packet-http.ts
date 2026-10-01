import { randomUUID } from "node:crypto";
import { z } from "zod";
import { privateAuthHeaders, reportAuthError } from "../auth/http";
import { fssStudioEnabled } from "../auth/release-flags";
import { getPortalIdentity } from "../auth/server";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import { getPortalDb } from "../db/portal-client";
import {
  downloadClientWelcomePacket,
  type ClientPacketDownload,
} from "./client-packet";
import { onboardingEnabled } from "./worker-db";

type ClientPacketHttpDependencies = {
  enabled: boolean;
  createCorrelationId: () => string;
  authorize: () => Promise<VerifiedPortalIdentity | null>;
  download: (
    identity: VerifiedPortalIdentity,
    organisationId: string,
    approvalId: string,
    correlationId: string,
  ) => Promise<ClientPacketDownload | null>;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
};
export function createClientWelcomePacketDownloadHandler(
  deps: ClientPacketHttpDependencies,
): (organisationId: string, approvalId: string) => Promise<Response> {
  return async (organisationId, approvalId) => {
    const correlationId = deps.createCorrelationId();
    const headers = privateAuthHeaders(correlationId);
    const reply = (message: string, status: number) =>
      Response.json({ message }, { status, headers });
    if (!deps.enabled) return reply("This welcome packet is unavailable.", 404);
    try {
      const identity = await deps.authorize();
      if (!identity) return reply("Sign in to continue.", 401);
      z.uuid().parse(organisationId);
      z.uuid().parse(approvalId);
      const artifact = await deps.download(
        identity,
        organisationId,
        approvalId,
        correlationId,
      );
      if (!artifact) return reply("This welcome packet is unavailable.", 404);
      return new Response(new Uint8Array(artifact.pdf), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Length": String(artifact.pdf.length),
          "Content-Disposition":
            'attachment; filename="fss-welcome-packet.pdf"',
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    } catch (error) {
      if (
        error instanceof PortalAccessDenied ||
        error instanceof z.ZodError ||
        (error &&
          typeof error === "object" &&
          "code" in error &&
          String(error.code) === "42501")
      )
        return reply("This welcome packet is unavailable.", 404);
      reportAuthError(deps, correlationId, error);
      return reply("We could not retrieve this packet. Please try again.", 503);
    }
  };
}
export function portalWelcomePacketDownloadRoute(): ReturnType<
  typeof createClientWelcomePacketDownloadHandler
> {
  return createClientWelcomePacketDownloadHandler({
    enabled: onboardingEnabled() && fssStudioEnabled(),
    createCorrelationId: randomUUID,
    authorize: getPortalIdentity,
    download: (identity, organisationId, approvalId, correlationId) =>
      downloadClientWelcomePacket(
        getPortalDb(),
        identity,
        organisationId,
        approvalId,
        correlationId,
      ),
    reportUnexpectedError: (report) =>
      console.error("Portal welcome packet download failed.", report),
  });
}
