import type { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth as configuredAuth } from "@/auth";

const auth = configuredAuth as unknown as NextMiddleware;

export function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): ReturnType<NextMiddleware> {
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
  matcher: [
    "/growth/:path*",
    "/portal/:path*",
    "/api/portal/:path*",
  ],
};
