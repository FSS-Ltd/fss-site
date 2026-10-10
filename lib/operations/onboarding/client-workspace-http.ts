import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import { resolvePortalOrigin } from "../auth/configuration";
import { privateAuthHeaders, reportAuthError } from "../auth/http";
import { fssStudioEnabled } from "../auth/release-flags";
import { getPortalIdentity } from "../auth/server";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import { getPortalDb } from "../db/portal-client";
import {
  ClientOnboardingConflict,
  clientOnboardingTaskCommandSchema,
  executeClientOnboardingTaskCommand,
  type ClientOnboardingTaskCommand,
  type ClientOnboardingTaskResult,
} from "./client-workspace";
import { onboardingEnabled } from "./worker-db";

type ClientOnboardingTaskHttpDependencies = {
  enabled: boolean;
  origin: string;
  createCorrelationId: () => string;
  authorize: () => Promise<VerifiedPortalIdentity | null>;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
  execute: (
    identity: VerifiedPortalIdentity,
    organisationId: string,
    command: ClientOnboardingTaskCommand,
    correlationId: string,
  ) => Promise<ClientOnboardingTaskResult>;
};

export function createClientOnboardingTaskHandler(
  deps: ClientOnboardingTaskHttpDependencies,
): (
  request: Request,
  organisationId: string,
  expectedTaskId?: string,
) => Promise<Response> {
  return async (request, organisationId, expectedTaskId) => {
    const correlationId = deps.createCorrelationId();
    const headers = privateAuthHeaders(correlationId);
    const reply = (message: string, status: number) =>
      Response.json({ message }, { status, headers });
    if (!deps.enabled) return reply("Onboarding tasks are unavailable.", 404);
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return reply("The request origin is not allowed.", 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return reply("Send a JSON request.", 415);
    try {
      const identity = await deps.authorize();
      if (!identity) return reply("Sign in to continue.", 401);
      z.uuid().parse(organisationId);
      if (expectedTaskId) z.uuid().parse(expectedTaskId);
      const command = clientOnboardingTaskCommandSchema.parse(
        await readJsonRequestBody(request, 16 * 1024),
      );
      if (expectedTaskId && command.taskId !== expectedTaskId)
        return reply("This onboarding task is unavailable.", 404);
      return Response.json(
        await deps.execute(identity, organisationId, command, correlationId),
        { headers },
      );
    } catch (error) {
      if (error instanceof PortalAccessDenied)
        return reply("This onboarding task is unavailable.", 404);
      if (error instanceof ClientOnboardingConflict)
        return reply(error.message, 409);
      if (error instanceof z.ZodError)
        return reply("Check the task details and try again.", 422);
      if (error instanceof PayloadTooLargeError)
        return reply("The request is too large.", 413);
      if (error instanceof SyntaxError) return reply("Send valid JSON.", 400);
      reportAuthError(deps, correlationId, error);
      return reply(
        "We could not confirm this task. Refresh the checklist before trying again.",
        503,
      );
    }
  };
}

export function portalOnboardingTaskRoute() {
  return createClientOnboardingTaskHandler({
    enabled: onboardingEnabled() && fssStudioEnabled(),
    origin: resolvePortalOrigin(),
    createCorrelationId: randomUUID,
    authorize: getPortalIdentity,
    reportUnexpectedError: (report) =>
      console.error("Portal onboarding task request failed.", report),
    execute: (identity, organisationId, command, correlationId) =>
      executeClientOnboardingTaskCommand(
        getPortalDb(),
        identity,
        organisationId,
        command,
        correlationId,
      ),
  });
}
