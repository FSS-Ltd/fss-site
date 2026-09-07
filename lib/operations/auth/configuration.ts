import { operationsEnabled } from "../db/client";
export const PORTAL_INVITE_COOKIE = "fss-portal-invite";
export const PORTAL_SESSION_COOKIE = "fss-portal-auth";
type Environment = Readonly<Record<string, string | undefined>>;
export type PortalAuthConfig = { url: string; publishableKey: string };
export function readPortalAuthConfig(
  env: Environment = process.env,
): PortalAuthConfig {
  if (!operationsEnabled(env))
    throw new Error("Portal authentication is unavailable.");
  const raw = env.OPERATIONS_SUPABASE_URL;
  const publishableKey = env.OPERATIONS_SUPABASE_PUBLISHABLE_KEY;
  if (!raw || !publishableKey?.startsWith("sb_publishable_"))
    throw new Error("Portal authentication is unavailable.");
  const url = new URL(raw);
  const local =
    env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Portal authentication is unavailable.");
  return { url: url.origin, publishableKey };
}
export function portalAuthConfigured(env: Environment = process.env): boolean {
  try {
    readPortalAuthConfig(env);
    return !!env.OPERATIONS_PORTAL_DATABASE_URL;
  } catch {
    return false;
  }
}
export function portalCookieOptions(origin: string): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(origin).protocol === "https:",
    path: "/",
  };
}
