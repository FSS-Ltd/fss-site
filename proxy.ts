import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const proxy = clerkMiddleware((_auth, request) => {
  const response = NextResponse.next();
  if (
    request.nextUrl.pathname === "/portal" ||
    request.nextUrl.pathname.startsWith("/portal/") ||
    request.nextUrl.pathname.startsWith("/api/portal/")
  ) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  return response;
});

export const config = {
  matcher: [
    "/growth/:path*",
    "/portal/:path*",
    "/api/growth/:path*",
    "/api/auth/:path*",
    "/api/portal/:path*",
  ],
};
