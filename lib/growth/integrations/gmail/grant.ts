import type { GrowthTransaction } from "../../db/types";
import { hasRequiredGmailScopes, sameAccountScopes } from "../google-oauth";
import type { GmailGrantBinding } from "./live-client";

export async function lockCurrentGmailGrant(
  tx: GrowthTransaction,
  binding: GmailGrantBinding,
): Promise<void> {
  const [connection] = await tx<
    Array<{
      status: string;
      subject: string | null;
      version: number;
      scopes: string[];
    }>
  >`
    select status, google_subject as subject, version, granted_scopes as scopes
    from growth.integration_connections where id=${binding.connectionId} and provider='gmail' for share
  `;
  if (
    !connection ||
    connection.status !== "connected" ||
    connection.subject !== binding.googleSubject ||
    connection.version !== binding.grantEpoch ||
    !hasRequiredGmailScopes(connection.scopes) ||
    !sameAccountScopes(connection.scopes, binding.grantedScopes)
  )
    throw new Error("Gmail grant changed.");
}
