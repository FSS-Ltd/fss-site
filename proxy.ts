import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { portalRouteForHost } from "@/lib/operations/auth/portal-host";

function isPortalRequest(request: NextRequest): boolean {
  return (
    portalRouteForHost(request.nextUrl.hostname, request.nextUrl.pathname) !==
      null ||
    request.nextUrl.pathname === "/portal" ||
    request.nextUrl.pathname.startsWith("/portal/") ||
    request.nextUrl.pathname.startsWith("/api/portal/")
  );
}

export function portalProxyResponse(request: NextRequest): NextResponse {
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

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

const portalProxy = clerkMiddleware((_auth, request) =>
  portalProxyResponse(request),
);

export function createProxy(portalMiddleware: NextMiddleware): NextMiddleware {
  return async function proxy(request: NextRequest, event: NextFetchEvent) {
    if (isPortalRequest(request)) return await portalMiddleware(request, event);

    if (request.nextUrl.pathname === "/") return NextResponse.next();

    const { auth } = await import("@/auth");
    return await (auth as unknown as NextMiddleware)(request, event);
  };
}

export const proxy = createProxy(portalProxy);

export const config = {
  matcher: ["/", "/growth/:path*", "/portal/:path*", "/api/portal/:path*"],
};
