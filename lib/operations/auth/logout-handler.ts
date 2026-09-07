import { requestHasRegisteredOrigin } from "../../growth/http/founder-request";
import {
  privateAuthHeaders,
  reportAuthError,
  type PortalAuthHandlerDependencies,
} from "./http";

export type PortalLogoutDependencies = PortalAuthHandlerDependencies & {
  signOut: () => Promise<void>;
  clearPendingInvite: () => Promise<void>;
};
export function createPortalLogoutHandler(
  deps: PortalLogoutDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = deps.createCorrelationId();
    const headers = privateAuthHeaders(correlationId);
    if (!deps.enabled || !deps.configured)
      return Response.json(
        { message: "The portal is unavailable." },
        { status: deps.enabled ? 503 : 404, headers },
      );
    if (!requestHasRegisteredOrigin(request, deps.origin))
      return Response.json(
        { message: "The request origin is not allowed." },
        { status: 403, headers },
      );
    try {
      await deps.signOut();
      await deps.clearPendingInvite();
      return new Response(null, {
        status: 303,
        headers: {
          ...headers,
          Location: new URL("/portal/login", deps.origin).href,
        },
      });
    } catch (error) {
      reportAuthError(deps, correlationId, error);
      return Response.json(
        { message: "Sign out could not complete. Please try again." },
        { status: 503, headers },
      );
    }
  };
}
