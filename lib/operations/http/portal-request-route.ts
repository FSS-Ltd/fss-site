import { randomUUID } from "node:crypto";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { getPortalIdentity } from "../auth/server";
import { portalAuthConfigured } from "../auth/configuration";
import { operationsEnabled } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import { consumeRequestRateLimit } from "../requests/rate-limit";
import {
  createPortalRequest,
  executePortalRequestCommand,
} from "../requests/service";
import { createPortalRequestHandler } from "./request-handler";

export function portalRequestRoute(
  action: "create" | "update",
): (request: Request, requestId?: string) => Promise<Response> {
  return createPortalRequestHandler({
    enabled: operationsEnabled(),
    configured: portalAuthConfigured(),
    origin: new URL(resolveSiteUrl()).origin,
    createCorrelationId: randomUUID,
    getIdentity: getPortalIdentity,
    consumeRateLimit: (_request, identity, organisationId, correlationId) =>
      consumeRequestRateLimit(
        getPortalDb(),
        identity,
        organisationId,
        correlationId,
      ),
    execute: (identity, organisationId, command, correlationId) => {
      const execute =
        action === "create" ? createPortalRequest : executePortalRequestCommand;
      return execute(
        getPortalDb(),
        identity,
        organisationId,
        command,
        correlationId,
      );
    },
    reportUnexpectedError: (report) =>
      console.error("Portal request action failed.", report),
  });
}
