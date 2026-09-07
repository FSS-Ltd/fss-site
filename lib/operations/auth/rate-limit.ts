import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getPortalDb } from "../db/portal-client";
export function portalRateLimitBuckets(
  request: Request,
  email?: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): { hash: string; kind: "ip" | "email" }[] {
  // Vercel supplies this header. Other environments share a fail-closed bucket.
  const forwarded =
    env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for") : null;
  const address =
    forwarded && isIP(forwarded) ? forwarded : "untrusted-network";
  const hash = (kind: string, value: string) =>
    createHash("sha256").update(`${kind}:${value}`).digest("hex");
  const buckets: { hash: string; kind: "ip" | "email" }[] = [
    { hash: hash("ip", address), kind: "ip" },
  ];
  if (email)
    buckets.push({
      hash: hash("email", email.trim().toLowerCase()),
      kind: "email",
    });
  return buckets;
}
export async function consumePortalAuthRateLimit(
  request: Request,
  email?: string,
): Promise<boolean> {
  const db = getPortalDb();
  for (const bucket of portalRateLimitBuckets(request, email)) {
    const [row] = await db<
      { allowed: boolean }[]
    >`select operations.consume_portal_auth_limit(${bucket.hash},${bucket.kind}) as allowed`;
    if (!row.allowed) return false;
  }
  return true;
}
