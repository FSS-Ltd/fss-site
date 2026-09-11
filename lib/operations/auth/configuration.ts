import { operationsEnabled } from "../db/client";
type Environment = Readonly<Record<string, string | undefined>>;
export type PortalAuthConfig = { publishableKey: string; secretKey: string };

const defaultPortalOrigin = "https://portal.faithfulsoftware.dev";
export function readPortalAuthConfig(
  env: Environment = process.env,
): PortalAuthConfig {
  if (!operationsEnabled(env))
    throw new Error("Portal authentication is unavailable.");
  const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = env.CLERK_SECRET_KEY;
  if (!publishableKey?.startsWith("pk_") || !secretKey?.startsWith("sk_"))
    throw new Error("Portal authentication is unavailable.");
  return { publishableKey, secretKey };
}
export function portalAuthConfigured(env: Environment = process.env): boolean {
  try {
    readPortalAuthConfig(env);
    return !!env.OPERATIONS_PORTAL_DATABASE_URL;
  } catch {
    return false;
  }
}

export function resolvePortalOrigin(env: Environment = process.env): string {
  const value = env.OPERATIONS_PORTAL_ORIGIN ?? defaultPortalOrigin;

  try {
    const origin = new URL(value);
    const isLocalHttp = origin.protocol === "http:" && origin.hostname === "localhost";

    if (
      !(origin.protocol === "https:" || isLocalHttp) ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    ) {
      throw new Error();
    }

    return origin.origin;
  } catch {
    throw new Error("OPERATIONS_PORTAL_ORIGIN must be an HTTPS origin.");
  }
}
