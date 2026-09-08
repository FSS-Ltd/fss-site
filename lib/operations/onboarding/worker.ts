import { z } from "zod";
import { thankYouEmail } from "./content/thank-you";
import { expiredUnknownAttempt, retryAt } from "./schedule";
import type {
  EffectResult,
  OnboardingEffects,
  OnboardingLease,
  OnboardingStore,
} from "./types";
async function execute(
  effects: OnboardingEffects,
  lease: OnboardingLease,
): Promise<EffectResult> {
  switch (lease.step) {
    case "welcome":
      return effects.sendEmail({
        lease,
        email: lease.snapshot.welcome,
        attachment: { filename: "FSS-welcome-guide.pdf", content: lease.pdf },
      });
    case "proposal_access":
      return effects.ensureProposalAccess(lease);
    case "proposal": {
      const email = lease.proposal?.emails.find(
        (email) => email.to === lease.recipient,
      );
      if (!email)
        return {
          status: "failed",
          code: "invalid_contract",
          retryable: false,
          uncertain: false,
        };
      return effects.sendEmail({ lease, email });
    }
    case "invoice":
      return effects.createInvoice(lease);
    case "invitation":
      return effects.ensureInvitation(lease);
    case "thank_you": {
      if (!lease.invoice?.url || !lease.proposal?.portalUrl)
        return {
          status: "failed",
          code: "invalid_contract",
          retryable: false,
          uncertain: false,
        };
      return effects.sendEmail({
        lease,
        email: thankYouEmail(
          lease.snapshot,
          lease.invoice.url,
          lease.proposal.portalUrl,
        ),
      });
    }
  }
}
export async function runOnboardingWorker(
  store: OnboardingStore,
  effects: OnboardingEffects,
  options: { limit?: number; now?: () => Date } = {},
): Promise<{
  claimed: number;
  succeeded: number;
  held: number;
  retried: number;
  skipped: number;
  overdue: number;
}> {
  const limit = z
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(options.limit ?? 25);
  const now = options.now ?? (() => new Date());
  const leases = await store.claim(limit, now());
  const summary = {
    claimed: leases.length,
    succeeded: 0,
    held: 0,
    retried: 0,
    skipped: 0,
    overdue: 0,
  };
  for (const lease of leases) {
    if (now().getTime() - new Date(lease.dueAt).getTime() > 15 * 60_000)
      summary.overdue++;
    if (lease.uncertain && expiredUnknownAttempt(lease.firstAttemptAt, now())) {
      await store.fail(lease, "dedupe_window_expired", null, true);
      summary.held++;
      continue;
    }
    if (!(await store.beginEffect(lease, now()))) {
      summary.skipped++;
      continue;
    }
    let result: EffectResult;
    try {
      result = await execute(effects, lease);
    } catch {
      result = {
        status: "failed",
        code: "unknown_outcome",
        uncertain: true,
        retryable: true,
      };
    }
    if (result.status === "succeeded") {
      // A persistence failure intentionally escapes. Its permanent attempt remains
      // uncertain and recovery must use the same provider key, including after pause.
      await store.succeed(lease, result.receipt);
      summary.succeeded++;
    } else {
      const next = result.retryable
        ? retryAt(now(), lease.attempts + 1, result.retryAfterMs)
        : null;
      await store.fail(lease, result.code, next, result.uncertain);
      if (next) summary.retried++;
      else summary.held++;
    }
  }
  return summary;
}
