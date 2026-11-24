import type { ResendBinding } from "@/lib/growth/campaigns/resend-account-readiness";
import type { GrowthDb } from "@/lib/growth/db/types";

/** Resolve the server-configured account only; the receipt transaction rechecks its reviewed binding. */
export async function resolveResendOutreachConnection(
  db: GrowthDb,
  binding: ResendBinding,
): Promise<string | null> {
  const rows = await db<{ id: string }[]>`
    select c.connection_id as id from growth.outreach_account_controls c
    join growth.integration_connections ic on ic.id=c.connection_id and ic.provider='resend'
    where c.provider='resend' and c.resend_team=${binding.team} and c.resend_environment=${binding.environment}
      and ic.subject_email=${binding.sender} limit 2`;
  return rows.length === 1 ? rows[0].id : null;
}
