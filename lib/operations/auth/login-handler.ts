import { z } from "zod";
import {
  PayloadTooLargeError,
  readJsonRequestBody,
  requestHasRegisteredOrigin,
} from "../../growth/http/founder-request";
import {
  privateAuthHeaders,
  reportAuthError,
  type PortalAuthHandlerDependencies,
} from "./http";

export type PortalLoginDependencies = PortalAuthHandlerDependencies & {
  consumeRateLimit: (request: Request, email: string) => Promise<boolean>;
  startLogin: (email: string) => Promise<void>;
  setPendingInvite: (token: string | null) => Promise<void>;
};
const payload = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  inviteToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
});
const successMessage =
  "If this email has portal access, a sign-in link will arrive shortly. Open it in this browser.";

export function createPortalLoginHandler(
  deps: PortalLoginDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = deps.createCorrelationId();
    const reply = (message: string, status: number) =>
      Response.json(
        { message },
        { status, headers: privateAuthHeaders(correlationId) },
      );
    if (!deps.enabled) return reply("The portal is unavailable.", 404);
    if (!deps.configured)
      return reply(
        "The portal is temporarily unavailable. Please try again later.",
        503,
      );
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return reply("The request origin is not allowed.", 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return reply("Send a JSON request.", 415);
    try {
      const input = payload.parse(await readJsonRequestBody(request, 8 * 1024));
      if (!(await deps.consumeRateLimit(request, input.email)))
        return reply("Too many attempts. Please try again in 15 minutes.", 429);
      // Provider responses must never reveal whether an account exists.
      try {
        await deps.startLogin(input.email);
        await deps.setPendingInvite(input.inviteToken ?? null);
      } catch (error) {
        reportAuthError(deps, correlationId, error);
        await deps.setPendingInvite(null);
      }
      return reply(successMessage, 200);
    } catch (error) {
      if (error instanceof PayloadTooLargeError)
        return reply("The request is too large.", 413);
      if (error instanceof SyntaxError || error instanceof z.ZodError)
        return reply(
          "Enter a valid email and use the original invitation link.",
          422,
        );
      reportAuthError(deps, correlationId, error);
      return reply(
        "The portal is temporarily unavailable. Please try again later.",
        503,
      );
    }
  };
}
