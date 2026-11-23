import type { GrowthTransaction } from "../db/types";
import { sameAccountScopes } from "../integrations/google-oauth";
import type { GmailDueContext } from "./gmail-due-context";
import type { ResendRuntimeConfiguration } from "./resend-account-control";
import { loadReservationAccount } from "./account-repository";
import type { AuthorityBounds } from "./authority-bounds";
import type { loadResendAccountReadiness } from "./resend-account-repository";

type ReadyAccount = Extract<
  Awaited<ReturnType<typeof loadResendAccountReadiness>>,
  { status: "ready" }
>;

/** The caller holds the global routing lock and the reviewed account lock. */
export async function loadCurrentResendGmailBounds(
  tx: GrowthTransaction,
  input: {
    account: ReadyAccount;
    runtime: ResendRuntimeConfiguration;
    context: GmailDueContext;
  },
): Promise<AuthorityBounds | null> {
  const { account, runtime, context } = input;
  const mailbox = account.monitoredMailbox,
    bound = context.bound.binding;
  if (
    process.env.GROWTH_OS_RESEND_OUTREACH_ENABLED !== "true" ||
    !runtime.webhookSecret?.trim() ||
    !runtime.binding.webhookGeneration ||
    context.usage.status !== "complete" ||
    !context.coverageId ||
    mailbox.connectionId !== bound.connectionId ||
    mailbox.googleSubject !== bound.googleSubject ||
    mailbox.grantEpoch !== bound.grantEpoch ||
    !sameAccountScopes(mailbox.grantedScopes, bound.grantedScopes)
  )
    return null;
  const [coverage] = await tx<
    { valid: boolean }[]
  >`select exists(select 1 from growth.gmail_reply_coverage v join growth.integration_connections c on c.id=v.connection_id where v.id=${context.coverageId} and v.connection_id=${bound.connectionId} and v.google_subject=${bound.googleSubject} and v.grant_epoch=${bound.grantEpoch} and v.state='complete' and v.history_end=c.provider_cursor and c.status='connected' and c.version=v.grant_epoch and c.google_subject=v.google_subject and v.observed_until<=clock_timestamp()) as valid`;
  if (!coverage?.valid) return null;
  const gmail = await loadReservationAccount(tx, bound.connectionId);
  return gmail.status === "ready" ? gmail.account.bounds : null;
}
