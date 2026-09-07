import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { operationsEnabled } from "@/lib/operations/db/client";
import {
  PORTAL_INVITE_COOKIE,
  portalAuthConfigured,
  portalCookieOptions,
} from "@/lib/operations/auth/configuration";
import { createPortalLoginHandler } from "@/lib/operations/auth/login-handler";
import {
  createPortalServerClient,
  startPortalLogin,
} from "@/lib/operations/auth/server";
import { consumePortalAuthRateLimit } from "@/lib/operations/auth/rate-limit";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const origin = new URL(resolveSiteUrl()).origin;
  return createPortalLoginHandler({
    enabled: operationsEnabled(),
    configured: portalAuthConfigured(),
    origin,
    createCorrelationId: randomUUID,
    consumeRateLimit: consumePortalAuthRateLimit,
    startLogin: async (email) =>
      startPortalLogin(await createPortalServerClient("write"), email),
    setPendingInvite: async (token) => {
      (await cookies()).set(PORTAL_INVITE_COOKIE, token ?? "", {
        ...portalCookieOptions(origin),
        maxAge: token ? 600 : 0,
      });
    },
    reportUnexpectedError: (report) =>
      console.error("Portal login failed.", report),
  })(request);
}
