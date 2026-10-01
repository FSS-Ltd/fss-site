import { currencySchema } from "../money";
import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import {
  privateAuthHeaders,
  reportAuthError,
  type PortalAuthHandlerDependencies,
} from "../auth/http";

const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("manage"),
    organisationId: z.uuid(),
    currency: currencySchema.optional(),
  }),
  z.strictObject({
    action: z.literal("invoice"),
    organisationId: z.uuid(),
    invoiceId: z.uuid(),
  }),
]);
export type PortalBillingCommand = z.infer<typeof commandSchema>;
export type PortalBillingDependencies = PortalAuthHandlerDependencies & {
  getIdentity: () => Promise<VerifiedPortalIdentity | null>;
  consumeRateLimit: (
    identity: VerifiedPortalIdentity,
    organisationId: string,
    correlationId: string,
  ) => Promise<boolean>;
  execute: (
    identity: VerifiedPortalIdentity,
    command: PortalBillingCommand,
    correlationId: string,
  ) => Promise<string>;
};

export function createPortalBillingHandler(
  deps: PortalBillingDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = deps.createCorrelationId();
    const reply = (body: object, status: number) =>
      Response.json(body, {
        status,
        headers: privateAuthHeaders(correlationId),
      });
    const failure = (error: string, status: number) => reply({ error }, status);
    if (!deps.enabled) return failure("Billing is unavailable.", 404);
    if (!deps.configured)
      return failure(
        "Billing is temporarily unavailable. Please try again.",
        503,
      );
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return failure("The request origin is not allowed.", 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return failure("Send a JSON request.", 415);
    try {
      const identity = await deps.getIdentity();
      if (!identity) return failure("Sign in to continue.", 401);
      const command = commandSchema.parse(
        await readJsonRequestBody(request, 1024),
      );
      if (
        !(await deps.consumeRateLimit(
          identity,
          command.organisationId,
          correlationId,
        ))
      )
        return failure("Too many requests. Wait a minute and try again.", 429);
      const url = await deps.execute(identity, command, correlationId);
      return reply({ url }, 200);
    } catch (error) {
      if (error instanceof PortalAccessDenied)
        return failure("Billing is not available to your account.", 404);
      if (error instanceof PayloadTooLargeError)
        return failure("The request is too large.", 413);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return failure(
          "Choose an invoice or payment management from this page.",
          400,
        );
      reportAuthError(deps, correlationId, error);
      return failure("We couldn’t open billing. Please try again.", 503);
    }
  };
}
