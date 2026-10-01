import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { requireOperationsFounder } from "../organisations/link-engagement";
import {
  freshness,
  METRIC_DEFINITION_VERSION,
  londonDate,
} from "./definitions";
import { parseMetricFilters, type MetricProviderScope } from "./filters";
import { loadRevenue } from "./revenue-repository";
import { loadReceivables } from "./receivables-repository";
import { loadOperationalQueue } from "./queue-repository";
import type { MetricsSnapshot } from "./snapshot-types";
/** One repeatable-read snapshot: cards and their pages observe the same committed evidence. */
export async function loadMetricsSnapshot(
  db: OperationsDb,
  context: OperationsFounder | null,
  rawFilters: unknown = {},
  options: { observedAt?: string; providerScope?: MetricProviderScope } = {},
): Promise<MetricsSnapshot> {
  const founder = requireOperationsFounder(context);
  const observedAt = z.iso
    .datetime()
    .parse(options.observedAt ?? new Date().toISOString());
  const filters = parseMetricFilters(rawFilters, observedAt);
  const scope = options.providerScope
    ? z
        .object({
          accountId: z.string().regex(/^acct_[A-Za-z0-9]+$/),
          mode: z.enum(["test", "live"]),
        })
        .parse(options.providerScope)
    : null;
  const wrapped = await db.begin(
    "isolation level repeatable read read only",
    async (tx) => {
      await tx`select set_config('operations.actor_id',${founder.actorId},true)`;
      const revenue = await loadRevenue(tx, filters);
      // Current projections cannot reconstruct historical balances without allocation/credit history.
      const receivables =
        scope && filters.to === londonDate(observedAt)
          ? await loadReceivables(tx, filters, scope)
          : null;
      const [provider] = await tx<
        { last: string | null; corrected: string | null; cash: string | null }[]
      >`
      select (select completed_at::text from operations.billing_reconciliation_cursors where account_id=${scope?.accountId ?? null} and environment=${scope?.mode ?? null}) as last,
      (select max(completed_at)::text from operations.billing_provider_events where account_id=${scope?.accountId ?? null} and environment=${scope?.mode ?? null} and state='completed' and (occurred_at at time zone 'Europe/London')::date between ${filters.from}::date and ${filters.to}::date and (received_at at time zone 'Europe/London')::date>(occurred_at at time zone 'Europe/London')::date) as corrected,
      (select coalesce(sum(p.received_pence),0)::text from operations.payments p where p.account_id=${scope?.accountId ?? null} and p.environment=${scope?.mode ?? null} and p.state='succeeded' and p.currency=${filters.currency}
       and (p.confirmed_at at time zone 'Europe/London')::date between ${filters.from}::date and ${filters.to}::date
       and (${filters.organisationId ?? null}::uuid is null or p.organisation_id=${filters.organisationId ?? null}::uuid)
       and (${filters.client ?? null}::text is null or p.organisation_id in (select id from operations.organisations where display_name ilike ${`%${filters.client ?? ""}%`}))
       and (${filters.service ?? null}::text is null and ${filters.owner ?? null}::text is null)) as cash`;
      const queue = await loadOperationalQueue(tx, filters, scope);
      const limitations = [
        "Contract metrics use recorded activation and inclusive contract end dates. Unrecorded pauses, amendments and temporary discounts are unavailable.",
        "Period refunds and net cash are unavailable: refund confirmation timestamps are not captured.",
        "Request cycle and blocked durations are unavailable: history does not retain complete state intervals.",
        "Each service amount is exact to 1/12 minor currency unit; totals round once to two decimals. Rounded rows may differ by one minor unit.",
        "Payment-state filters apply to receivables. Contract revenue and the current action queue remain independent of collection state.",
      ];
      if (!scope)
        limitations.push(
          "Billing provider scope is not configured; collections and receivables are unavailable.",
        );
      if (filters.to !== londonDate(observedAt))
        limitations.push(
          "Historical receivables are unavailable; current projections cannot reconstruct past credits and balances.",
        );
      if (filters.service || filters.owner)
        limitations.push(
          "Collected cash is unavailable for service/owner filters because payment receipts can span multiple allocations.",
        );
      return {
        value: {
          definitionVersion: METRIC_DEFINITION_VERSION,
          generatedAt: observedAt,
          filters,
          revenue,
          receivables,
          cash:
            scope && provider.last && !filters.service && !filters.owner
              ? provider.cash
              : null,
          lastReconciledAt: provider.last,
          freshness: freshness(provider.last, observedAt),
          correctedAt: provider.corrected,
          ...queue,
          limitations,
        } satisfies MetricsSnapshot,
      };
    },
  );
  return wrapped.value;
}
