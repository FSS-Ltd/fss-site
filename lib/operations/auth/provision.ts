import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readPortalAuthConfig } from "./configuration";

type ProvisionInput = { email: string; email_confirm: true };
type CreateAccount = (
  input: ProvisionInput,
) => Promise<{ error: { code?: string } | null }>;

export function readPortalProvisionConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { url: string; secretKey: string } {
  const { url } = readPortalAuthConfig(env);
  const secretKey = env.OPERATIONS_SUPABASE_SECRET_KEY;
  if (!secretKey?.startsWith("sb_secret_"))
    throw new Error("Portal provisioning is unavailable.");
  return { url, secretKey };
}

function createAccount(input: ProvisionInput): ReturnType<CreateAccount> {
  const { url, secretKey } = readPortalProvisionConfig();
  const client = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client.auth.admin.createUser(input);
}

export async function provisionPortalAccount(
  email: string,
  create: CreateAccount = createAccount,
): Promise<void> {
  const normalizedEmail = z.email().max(254).parse(email).toLowerCase();
  // Signup is disabled. This creates no password or session; the first login
  // still proves inbox ownership, and membership requires a separate invite claim.
  const { error } = await create({
    email: normalizedEmail,
    email_confirm: true,
  });
  if (
    error &&
    !["email_exists", "user_already_exists"].includes(error.code ?? "")
  )
    throw new Error("Portal provisioning is unavailable.");
}
