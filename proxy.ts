import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  portalRedirectForHost,
  portalRouteForHost,
} from "@/lib/operations/auth/portal-host";
import { prefixFreePortalEnabled } from "@/lib/operations/auth/release-flags";

function applyPortalSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function isPortalRequest(
  request: NextRequest,
  prefixFreeEnabled: boolean,
): boolean {
  const { hostname, pathname } = request.nextUrl;
  return (
    portalRedirectForHost(hostname, pathname, prefixFreeEnabled) !== null ||
    portalRouteForHost(hostname, pathname, prefixFreeEnabled) !== null ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/api/portal/")
  );
}

export function createPortalProxyResponse(
  prefixFreeEnabled: () => boolean = prefixFreePortalEnabled,
): (request: NextRequest) => NextResponse {
  return (request) => {
    const routingEnabled = prefixFreeEnabled();
    const portalRedirect = portalRedirectForHost(
      request.nextUrl.hostname,
      request.nextUrl.pathname,
      routingEnabled,
    );
    if (portalRedirect) {
      const url = request.nextUrl.clone();
      url.pathname = portalRedirect;
      return applyPortalSecurityHeaders(NextResponse.redirect(url));
    }

    const portalRoute = portalRouteForHost(
      request.nextUrl.hostname,
      request.nextUrl.pathname,
      routingEnabled,
    );
    if (portalRoute) {
      const url = request.nextUrl.clone();
      url.pathname = portalRoute;
      return applyPortalSecurityHeaders(NextResponse.rewrite(url));
    }

    return applyPortalSecurityHeaders(NextResponse.next());
  };
}

export const portalProxyResponse = createPortalProxyResponse();

const portalMiddleware = clerkMiddleware((_auth, request) =>
  portalProxyResponse(request),
);

export function createProxy(
  portalRequestMiddleware: NextMiddleware,
  prefixFreeEnabled: () => boolean = prefixFreePortalEnabled,
): NextMiddleware {
  return async function proxy(
    request: NextRequest,
    event: NextFetchEvent,
  ): Promise<Awaited<ReturnType<NextMiddleware>>> {
    if (isPortalRequest(request, prefixFreeEnabled())) {
      return await portalRequestMiddleware(request, event);
    }

    if (request.nextUrl.pathname === "/") return NextResponse.next();

    const { auth } = await import("@/auth");
    return await (auth as unknown as NextMiddleware)(request, event);
  };
}

export const proxy = createProxy(portalMiddleware);

export const config = {
  matcher: [
    "/",
    "/growth/:path*",
    "/portal/:path*",
    "/api/portal/:path*",
    {
      source: "/((?!api|webhooks|_next|.*\\..*).*)",
      has: [
        {
          type: "header",
          key: "host",
          value: "portal\\.faithfulsoftware\\.dev",
        },
      ],
    },
  ],
};
