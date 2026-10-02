import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "@/lib/growth/http/founder-request";
import { privateAuthHeaders } from "../auth/http";
import { resolvePortalOrigin } from "../auth/configuration";
import { fssStudioEnabled } from "../auth/release-flags";
import { requireFssAdmin } from "../auth/require-admin";
import { getPortalIdentity } from "../auth/server";
import type { FssAdminContext } from "../auth/staff-types";
import { getOperationsDb, operationsEnabled } from "../db/client";
import { getPortalDb } from "../db/portal-client";
import {
  AgreementBuilderDraftConflict,
  AgreementBuilderDraftValidationError,
  saveStaffAgreementBuilderDraft,
} from "../agreements/builder-draft-service";

type AgreementDraftRouteResult = Readonly<{
  content?: unknown;
  id: string;
  step?: string;
  version: number;
}>;

type DraftOperation = "save" | "finalise" | "publish" | "unknown";

function draftOperation(input: unknown): DraftOperation {
  if (input !== null && typeof input === "object" && "action" in input) {
    const action = input.action;
    if (action === "save" || action === "finalise" || action === "publish")
      return action;
  }
  return "unknown";
}

function safeErrorCode(error: unknown): string {
  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9]{5}$/.test(error.code)
  )
    return error.code;
  return "UNKNOWN";
}

export type StaffAgreementDraftRouteDependencies<TActor> = Readonly<{
  authorize: () => Promise<TActor>;
  createCorrelationId: () => string;
  enabled: boolean;
  execute: (
    actor: TActor,
    organisationId: string,
    input: unknown,
    correlationId: string,
  ) => Promise<AgreementDraftRouteResult>;
  origin: string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
    errorCode: string;
    operation: DraftOperation;
  }) => void;
}>;

export function createStaffAgreementDraftRouteHandler<TActor>(
  deps: StaffAgreementDraftRouteDependencies<TActor>,
): (request: Request, organisationId: string) => Promise<Response> {
  return async (request, organisationId) => {
    const correlationId = deps.createCorrelationId();
    const reply = (body: object, status: number) =>
      Response.json(body, {
        headers: privateAuthHeaders(correlationId),
        status,
      });
    const failure = (error: string, status: number) => reply({ error }, status);

    if (!deps.enabled) return failure("FSS Studio is unavailable.", 404);
    let actor: TActor;
    try {
      actor = await deps.authorize();
    } catch {
      return failure("FSS Studio authorization is required.", 403);
    }
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return failure("The request origin is not allowed.", 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    ) {
      return failure("Send a JSON request.", 415);
    }

    let operation: DraftOperation = "unknown";
    try {
      const input = await readJsonRequestBody(request, 64 * 1024);
      operation = draftOperation(input);
      const draft = await deps.execute(
        actor,
        z.uuid().parse(organisationId),
        input,
        correlationId,
      );
      return reply(draft, 200);
    } catch (error) {
      if (error instanceof AgreementBuilderDraftConflict)
        return failure(error.message, 409);
      if (error instanceof AgreementBuilderDraftValidationError)
        return failure(error.message, 400);
      if (error instanceof z.ZodError)
        return failure("Check the agreement draft and try again.", 400);
      if (error instanceof PayloadTooLargeError)
        return failure("The agreement draft is too large.", 413);
      if (error instanceof SyntaxError)
        return failure("The request must contain valid JSON.", 400);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      deps.reportUnexpectedError({
        correlationId,
        errorName: /^[A-Za-z]{1,80}$/.test(errorName)
          ? errorName
          : "UnknownError",
        errorCode: safeErrorCode(error),
        operation,
      });
      return failure(
        operation === "finalise"
          ? "We could not create this agreement. Your saved draft is still available. Please try again."
          : operation === "publish"
            ? "We could not publish this payment offer. Your saved draft is still available. Please try again."
            : "We could not save this agreement draft. Your edits are still here. Please try again.",
        503,
      );
    }
  };
}

export function createStaffAgreementDraftRouteDependencies(): StaffAgreementDraftRouteDependencies<FssAdminContext> {
  return {
    authorize: async () => {
      const identity = await getPortalIdentity();
      if (!identity) throw new Error("unauthorized");
      return requireFssAdmin(getPortalDb(), identity, randomUUID());
    },
    createCorrelationId: randomUUID,
    enabled: operationsEnabled() && fssStudioEnabled(),
    execute: (admin, organisationId, input, correlationId) =>
      saveStaffAgreementBuilderDraft(
        getOperationsDb(),
        admin,
        organisationId,
        input,
        correlationId,
      ),
    origin: resolvePortalOrigin(),
    reportUnexpectedError: (report) =>
      console.error("Staff agreement draft command failed.", report),
  };
}

export function staffAgreementDraftRoute(): (
  request: Request,
  organisationId: string,
) => Promise<Response> {
  return createStaffAgreementDraftRouteHandler(
    createStaffAgreementDraftRouteDependencies(),
  );
}
