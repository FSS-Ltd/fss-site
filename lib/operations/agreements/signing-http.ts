import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import { privateAuthHeaders, reportAuthError } from "../auth/http";
import { PortalAccessDenied } from "../auth/types";
import { SIGNING_TEXT_ERROR } from "./signing-text";
import { AgreementConflict } from "./types";
import type { SigningApproval, SigningArtifact } from "./signing-types";

type SigningHttpDependencies<Identity> = {
  enabled: boolean;
  origin: string;
  authorize: () => Promise<Identity | null>;
  createCorrelationId: () => string;
  reportUnexpectedError: (report: {
    correlationId: string;
    errorName: string;
  }) => void;
};
type SigningCommandDependencies<Identity> =
  SigningHttpDependencies<Identity> & {
    execute: (
      identity: Identity,
      organisationId: string,
      command: unknown,
      correlationId: string,
    ) => Promise<SigningApproval>;
    consumeRateLimit?: (
      identity: Identity,
      organisationId: string,
      correlationId: string,
    ) => Promise<boolean>;
  };
export function createSigningCommandHandler<Identity>(
  deps: SigningCommandDependencies<Identity>,
) {
  return async (
    request: Request,
    organisationId: string,
  ): Promise<Response> => {
    const correlationId = deps.createCorrelationId();
    const reply = (message: string, status: number) =>
      Response.json(
        { message },
        { status, headers: privateAuthHeaders(correlationId) },
      );
    if (!deps.enabled) return reply("Signing is unavailable.", 404);
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
      const command = await readJsonRequestBody(request, 16 * 1024);
      if (
        deps.consumeRateLimit &&
        !(await deps.consumeRateLimit(identity, organisationId, correlationId))
      )
        return reply("Too many requests. Wait a minute and try again.", 429);
      const approval = await deps.execute(
        identity,
        organisationId,
        command,
        correlationId,
      );
      return Response.json(
        { approval },
        { headers: privateAuthHeaders(correlationId) },
      );
    } catch (error) {
      if (error instanceof PortalAccessDenied)
        return reply("This agreement is unavailable to your account.", 404);
      if (error instanceof AgreementConflict) return reply(error.message, 409);
      if (error instanceof z.ZodError)
        return reply(
          error.issues.some((issue) => issue.message === SIGNING_TEXT_ERROR)
            ? SIGNING_TEXT_ERROR
            : "Check the signing details and required confirmations.",
          422,
        );
      if (error instanceof PayloadTooLargeError)
        return reply("The request is too large.", 413);
      if (error instanceof SyntaxError) return reply("Send valid JSON.", 400);
      reportAuthError(deps, correlationId, error);
      return reply(
        "We could not confirm the result. Refresh the agreement before trying again.",
        503,
      );
    }
  };
}
export function createSigningDownloadHandler<Identity>(
  deps: SigningHttpDependencies<Identity> & {
    download: (
      identity: Identity,
      organisationId: string,
      approvalId: string,
      kind: "source" | "signed" | "audit",
      correlationId: string,
    ) => Promise<SigningArtifact | null>;
  },
) {
  return async (
    _request: Request,
    organisationId: string,
    approvalId: string,
    rawKind: string,
  ): Promise<Response> => {
    const correlationId = deps.createCorrelationId();
    const reply = (status: number) =>
      Response.json(
        { message: "The document is unavailable." },
        { status, headers: privateAuthHeaders(correlationId) },
      );
    if (!deps.enabled) return reply(404);
    try {
      const identity = await deps.authorize();
      if (!identity) return reply(401);
      z.uuid().parse(organisationId);
      z.uuid().parse(approvalId);
      const kind = z.enum(["source", "signed", "audit"]).parse(rawKind);
      const artifact = await deps.download(
        identity,
        organisationId,
        approvalId,
        kind,
        correlationId,
      );
      if (!artifact) return reply(404);
      return new Response(new Uint8Array(artifact.bytes), {
        headers: {
          ...privateAuthHeaders(correlationId),
          "Content-Type": artifact.contentType,
          "Content-Disposition": `attachment; filename="agreement-${kind}.${kind === "audit" ? "json" : "pdf"}"`,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    } catch (error) {
      if (
        error instanceof PortalAccessDenied ||
        error instanceof z.ZodError ||
        error instanceof AgreementConflict
      )
        return reply(404);
      reportAuthError(deps, correlationId, error);
      return reply(503);
    }
  };
}
