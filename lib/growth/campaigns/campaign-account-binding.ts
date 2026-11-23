import type { FounderSession } from "../auth/require-founder";
import type { GrowthTransaction } from "../db/types";
import { loadResendAccountReadiness } from "./resend-account-repository";
import { readResendOutreachRuntime } from "./resend-account-runtime";
import type { CampaignPolicyDefinition } from "./schemas";

export async function validateCampaignAccountBinding(
  tx: GrowthTransaction,
  policy: CampaignPolicyDefinition,
  founder: FounderSession,
): Promise<void> {
  if (!policy.accountConnectionId) return;
  if (policy.provider === "resend") {
    const runtime = readResendOutreachRuntime();
    if (!runtime) throw new Error("invalid_account_binding");
    const readiness = await loadResendAccountReadiness(
      tx,
      policy.accountConnectionId,
      runtime,
      "active",
    );
    if (readiness.status === "held") throw new Error(readiness.reason);
    return;
  }
  const [connection] = await tx<{ id: string }[]>`
    select id from growth.integration_connections
    where id = ${policy.accountConnectionId}
      and provider = 'gmail' and subject_email = ${founder.email}
      and status = 'connected' and google_subject is not null
      and 'https://www.googleapis.com/auth/gmail.modify' = any(granted_scopes)
    for share
  `;
  if (!connection) throw new Error("invalid_account_binding");
}
