import {
  privateAuthHeaders,
  reportAuthError,
  type PortalAuthHandlerDependencies,
} from "./http";
import type { VerifiedPortalIdentity } from "./types";

export type PortalCallbackDependencies = PortalAuthHandlerDependencies & {
  consumeRateLimit: (request: Request) => Promise<boolean>;
  completeLogin: (code: string) => Promise<VerifiedPortalIdentity>;
  readPendingInvite: () => Promise<string | null>;
  clearPendingInvite: () => Promise<void>;
  claimInvite: (
    identity: VerifiedPortalIdentity,
    token: string,
    correlationId: string,
  ) => Promise<unknown>;
};

export function createPortalCallbackHandler(
  deps: PortalCallbackDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = deps.createCorrelationId();
    const redirect = (path: "/portal" | "/portal/login?error=link") =>
      new Response(null, {
        status: 303,
        headers: {
          ...privateAuthHeaders(correlationId),
          Location: new URL(path, deps.origin).href,
        },
      });
    if (!deps.enabled || !deps.configured)
      return Response.json(
        { message: "The portal is unavailable." },
        {
          status: deps.enabled ? 503 : 404,
          headers: privateAuthHeaders(correlationId),
        },
      );
    try {
      const url = new URL(request.url);
      const codes = url.searchParams.getAll("code");
      if (
        url.origin !== deps.origin ||
        codes.length !== 1 ||
        !/^[A-Za-z0-9_-]{1,2048}$/.test(codes[0]) ||
        [...url.searchParams.keys()].some((key) => key !== "code")
      )
        return redirect("/portal/login?error=link");
      if (!(await deps.consumeRateLimit(request)))
        return redirect("/portal/login?error=link");
      const identity = await deps.completeLogin(codes[0]);
      const token = await deps.readPendingInvite();
      if (token) await deps.claimInvite(identity, token, correlationId);
      return redirect("/portal");
    } catch (error) {
      reportAuthError(deps, correlationId, error);
      return redirect("/portal/login?error=link");
    } finally {
      try {
        await deps.clearPendingInvite();
      } catch (error) {
        reportAuthError(deps, correlationId, error);
      }
    }
  };
}
