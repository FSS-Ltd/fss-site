import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth as configuredAuth } from "@/auth";
import { portalRouteForHost } from "@/lib/operations/auth/portal-host";

const auth = configuredAuth as unknown as NextMiddleware;

export function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): ReturnType<NextMiddleware> {
  const portalRoute = portalRouteForHost(
    request.nextUrl.hostname,
    request.nextUrl.pathname,
  );
  if (portalRoute) {
    const url = request.nextUrl.clone();
    url.pathname = portalRoute;
    const response = NextResponse.rewrite(url);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  if (
    request.nextUrl.pathname === "/portal" ||
    request.nextUrl.pathname.startsWith("/portal/") ||
    request.nextUrl.pathname.startsWith("/api/portal/")
  ) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  return auth(request, event);
}

export const config = {
  matcher: ["/", "/growth/:path*", "/portal/:path*", "/api/portal/:path*"],
};
