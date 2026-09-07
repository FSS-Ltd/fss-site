import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import {
  PORTAL_SESSION_COOKIE,
  portalCookieOptions,
  type PortalAuthConfig,
} from "./configuration";
export function createPortalAuthClient(
  config: PortalAuthConfig,
  cookies: CookieMethodsServer,
  origin: string,
): ReturnType<typeof createServerClient> {
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: {
      ...portalCookieOptions(origin),
      name: PORTAL_SESSION_COOKIE,
    },
    cookies,
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
export type PortalSupabaseClient = ReturnType<typeof createPortalAuthClient>;
