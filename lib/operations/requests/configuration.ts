export function requestEmailsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.OPERATIONS_REQUEST_EMAILS_ENABLED === "true";
}
