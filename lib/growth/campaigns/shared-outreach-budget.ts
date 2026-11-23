import type { GrowthTransaction } from "../db/types";
import { loadReservationAccount } from "./account-repository";
import {
  intersectAuthorityBounds,
  type AuthorityBounds,
} from "./authority-bounds";
import { loadResendAccountReadiness } from "./resend-account-repository";
import { readResendOutreachRuntime } from "./resend-account-runtime";
import { CAMPAIGN_FOUNDER_EMAIL } from "./authorization";
import type { GmailDueContext } from "./gmail-due-context";
import { loadCurrentResendGmailBounds } from "./resend-gmail-context";

type ReadyRamp = { ramp: number; bounds: AuthorityBounds };

/** Caller holds the global routing lock until the reservation transaction ends. */
export async function loadSharedOutreachBudget(
  tx: GrowthTransaction,
  capabilities: {
    resendDelivery: "enabled" | "unavailable";
    gmailContext?: GmailDueContext;
  },
): Promise<
  | { status: "ready"; ramp: number; bounds: AuthorityBounds }
  | { status: "held"; reason: string }
> {
  const runtime =
    capabilities.resendDelivery === "enabled"
      ? readResendOutreachRuntime()
      : null;
  const controls = await tx<{ connectionId: string; provider: string }[]>`
    select c.connection_id as "connectionId",c.provider::text as provider
    from growth.outreach_account_controls c
    join growth.integration_connections ic on ic.id=c.connection_id and ic.provider=c.provider
    where c.state='active' and (
      (c.provider='gmail' and ic.subject_email=${CAMPAIGN_FOUNDER_EMAIL}) or
      (c.provider='resend' and c.resend_team=${runtime?.binding.team ?? null}
        and c.resend_environment=${runtime?.binding.environment ?? null})
    )
    order by c.connection_id limit 3`;
  if (controls.length > 2)
    return { status: "held", reason: "account_scope_exceeded" };
  const [start] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
  if (!start) return { status: "held", reason: "invalid_time" };
  const candidates: ReadyRamp[] = [];
  for (const control of controls) {
    if (control.provider === "gmail") {
      const account = await loadReservationAccount(tx, control.connectionId);
      if (account.status === "ready")
        candidates.push({
          ramp: account.account.ramp,
          bounds: account.account.bounds,
        });
    } else if (control.provider === "resend" && runtime) {
      const account = await loadResendAccountReadiness(
        tx,
        control.connectionId,
        runtime,
      );
      if (
        account.status === "ready" &&
        capabilities.resendDelivery === "enabled" &&
        capabilities.gmailContext
      ) {
        const gmailBounds = await loadCurrentResendGmailBounds(tx, {
          account,
          runtime,
          context: capabilities.gmailContext,
        });
        if (gmailBounds)
          candidates.push({
            ramp: account.ramp,
            bounds: intersectAuthorityBounds(gmailBounds, {
              validatedAt: start.now,
              expiresAt: account.expiresAt,
              validThrough: null,
            }),
          });
      }
    }
  }
  const [clock] = await tx<{ now: Date }[]>`select clock_timestamp() as now`;
  if (!clock) return { status: "held", reason: "invalid_time" };
  const current = candidates.filter(
    (candidate) =>
      [25, 50, 100, 150].includes(candidate.ramp) &&
      candidate.bounds.validatedAt <= clock.now &&
      candidate.bounds.expiresAt > clock.now &&
      (!candidate.bounds.validThrough ||
        candidate.bounds.validThrough >= clock.now),
  );
  current.sort(
    (left, right) =>
      right.ramp - left.ramp ||
      Math.min(
        right.bounds.expiresAt.getTime(),
        right.bounds.validThrough?.getTime() ?? Infinity,
      ) -
        Math.min(
          left.bounds.expiresAt.getTime(),
          left.bounds.validThrough?.getTime() ?? Infinity,
        ),
  );
  const chosen = current[0];
  if (!chosen) return { status: "held", reason: "no_ready_account" };
  return {
    status: "ready",
    ramp: chosen.ramp,
    bounds: intersectAuthorityBounds(chosen.bounds, {
      validatedAt: clock.now,
      expiresAt: chosen.bounds.expiresAt,
      validThrough: chosen.bounds.validThrough,
    }),
  };
}
