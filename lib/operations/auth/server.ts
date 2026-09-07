import { cookies } from "next/headers";
import { resolveSiteUrl } from "../../config/site-url";
import { createPortalAuthClient, type PortalSupabaseClient } from "./client";
import { readPortalAuthConfig } from "./configuration";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "./types";
import { readVerifiedPortalUser } from "./verified-user";
export type { PortalSupabaseClient } from "./client";
export async function createPortalServerClient(
  mode: "read" | "write" = "read",
): Promise<PortalSupabaseClient> {
  const store = await cookies();
  return createPortalAuthClient(
    readPortalAuthConfig(),
    {
      getAll: () => store.getAll(),
      setAll: (updates) => {
        // Proxy refreshes read-only Server Component cookies before rendering.
        if (mode === "write")
          for (const { name, value, options } of updates)
            store.set(name, value, options);
      },
    },
    resolveSiteUrl(),
  );
}
export async function getPortalIdentity(
  client?: PortalSupabaseClient,
): Promise<VerifiedPortalIdentity | null> {
  const auth = client ?? (await createPortalServerClient());
  return readVerifiedPortalUser(() => auth.auth.getUser());
}
export async function startPortalLogin(
  client: PortalSupabaseClient,
  email: string,
): Promise<void> {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: new URL("/portal/auth/callback", resolveSiteUrl()).href,
    },
  });
  // Unknown accounts receive the same response as existing invited accounts.
  if (
    error &&
    ![
      "signup_disabled",
      "user_not_found",
      "otp_disabled",
      "over_email_send_rate_limit",
      "over_request_rate_limit",
    ].includes(error.code ?? "")
  )
    throw new Error("Portal authentication is unavailable.");
}
export async function completePortalLogin(
  client: PortalSupabaseClient,
  code: string,
): Promise<VerifiedPortalIdentity> {
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw new PortalAccessDenied();
  const identity = await getPortalIdentity(client);
  if (!identity) throw new PortalAccessDenied();
  return identity;
}
export async function signOutPortalClient(
  client: PortalSupabaseClient,
): Promise<void> {
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Portal authentication is unavailable.");
}
