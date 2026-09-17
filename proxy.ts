import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  portalRedirectForHost,
  portalRouteForHost,
} from "@/lib/operations/auth/portal-host";

function applyPortalSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function isPortalRequest(request: NextRequest): boolean {
  const { hostname, pathname } = request.nextUrl;
  return (
    portalRedirectForHost(hostname, pathname) !== null ||
    portalRouteForHost(hostname, pathname) !== null ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/api/portal/")
  );
}

export function portalProxyResponse(request: NextRequest): NextResponse {
  const portalRedirect = portalRedirectForHost(
    request.nextUrl.hostname,
    request.nextUrl.pathname,
  );
  if (portalRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = portalRedirect;
    return applyPortalSecurityHeaders(NextResponse.redirect(url));
  }

  const portalRoute = portalRouteForHost(
    request.nextUrl.hostname,
    request.nextUrl.pathname,
  );
  if (portalRoute) {
    const url = request.nextUrl.clone();
    url.pathname = portalRoute;
    return applyPortalSecurityHeaders(NextResponse.rewrite(url));
  }

  return applyPortalSecurityHeaders(NextResponse.next());
}

const portalMiddleware = clerkMiddleware((_auth, request) =>
  portalProxyResponse(request),
);

export function createProxy(
  portalRequestMiddleware: NextMiddleware,
): NextMiddleware {
  return async function proxy(
    request: NextRequest,
    event: NextFetchEvent,
  ): Promise<Awaited<ReturnType<NextMiddleware>>> {
    if (isPortalRequest(request)) {
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
