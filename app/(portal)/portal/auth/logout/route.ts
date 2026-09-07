import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { operationsEnabled } from "@/lib/operations/db/client";
import {
  PORTAL_INVITE_COOKIE,
  portalAuthConfigured,
  portalCookieOptions,
} from "@/lib/operations/auth/configuration";
import { createPortalLogoutHandler } from "@/lib/operations/auth/logout-handler";
import {
  createPortalServerClient,
  signOutPortalClient,
} from "@/lib/operations/auth/server";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const origin = new URL(resolveSiteUrl()).origin;
  return createPortalLogoutHandler({
    enabled: operationsEnabled(),
    configured: portalAuthConfigured(),
    origin,
    createCorrelationId: randomUUID,
    signOut: async () =>
      signOutPortalClient(await createPortalServerClient("write")),
    clearPendingInvite: async () => {
      (await cookies()).set(PORTAL_INVITE_COOKIE, "", {
        ...portalCookieOptions(origin),
        maxAge: 0,
      });
    },
    reportUnexpectedError: (report) =>
      console.error("Portal sign out failed.", report),
  })(request);
}
