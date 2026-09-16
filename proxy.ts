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

export async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): Promise<ReturnType<NextMiddleware>> {
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

  if (request.nextUrl.pathname === "/") return NextResponse.next();

  if (
    request.nextUrl.pathname === "/portal" ||
    request.nextUrl.pathname.startsWith("/portal/") ||
    request.nextUrl.pathname.startsWith("/api/portal/")
  ) {
    return applyPortalSecurityHeaders(NextResponse.next());
  }

  const { auth } = await import("@/auth");
  return (auth as unknown as NextMiddleware)(request, event);
}

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
