import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import {
  completePortalOnboarding,
  organisationOnboardingSchema,
} from "@/lib/operations/auth/pending-invitations";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import {
  PortalAccessDenied,
  type VerifiedPortalIdentity,
} from "@/lib/operations/auth/types";
import type { OperationsDb } from "@/lib/operations/db/client";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { resolvePortalOrigin } from "@/lib/operations/auth/configuration";

export const runtime = "nodejs";

type Dependencies = {
  configured: () => boolean;
  origin: () => string;
  identity: () => Promise<VerifiedPortalIdentity | null>;
  db: () => OperationsDb;
  complete: typeof completePortalOnboarding;
};

const defaultDependencies: Dependencies = {
  configured: portalAuthConfigured,
  origin: resolvePortalOrigin,
  identity: getPortalIdentity,
  db: getPortalDb,
  complete: completePortalOnboarding,
};

export function createPortalOnboardingHandler(deps: Dependencies) {
  return async function post(request: Request): Promise<Response> {
    if (!deps.configured())
      return Response.json({ message: "Unavailable." }, { status: 404 });
    if (!requestHasRegisteredOrigin(request, new URL(deps.origin()).origin))
      return Response.json(
        { message: "Request origin is not allowed." },
        { status: 403 },
      );
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return Response.json(
        { message: "Send a JSON request." },
        { status: 415 },
      );
    try {
      const input = organisationOnboardingSchema.parse(
        await readJsonRequestBody(request, 8 * 1024),
      );
      const result = await deps.complete(
        deps.db(),
        await deps.identity(),
        input,
        randomUUID(),
      );
      return Response.json(result);
    } catch (error) {
      const status =
        error instanceof PayloadTooLargeError
          ? 413
          : error instanceof z.ZodError
            ? 422
            : error instanceof PortalAccessDenied
              ? 403
              : 500;
      return Response.json(
        {
          message:
            status === 500
              ? "Organisation setup could not be completed."
              : "Check the organisation details and try again.",
        },
        { status },
      );
    }
  };
}

export const POST = createPortalOnboardingHandler(defaultDependencies);
