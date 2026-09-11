import Link from "next/link";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getOperationsDb } from "@/lib/operations/db/client";
import type { MetricsSnapshot } from "@/lib/operations/metrics/snapshot-types";
import type { MetricProviderScope } from "@/lib/operations/metrics/filters";
import { loadMetricsSnapshot } from "@/lib/operations/metrics/snapshot-repository";
import { OperationsOverview } from "@/components/operations/overview/overview";
export const dynamic = "force-dynamic";
export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const founder = await requireFounder();
  let data: MetricsSnapshot | null = null;
  try {
    const mode = process.env.STRIPE_MODE;
    const providerScope: MetricProviderScope =
      process.env.OPERATIONS_BILLING_ENABLED === "true" &&
      process.env.STRIPE_ACCOUNT_ID &&
      (mode === "test" || mode === "live")
        ? { accountId: process.env.STRIPE_ACCOUNT_ID, mode }
        : null;
    data = await loadMetricsSnapshot(
      getOperationsDb(),
      founder,
      await searchParams,
      { providerScope },
    );
  } catch {
    data = null;
  }
  if (!data)
    return (
      <main>
        <h1>Operations unavailable</h1>
        <p>
          The report could not be loaded. Check the date range and filters, then
          retry.
        </p>
        <Link href="/growth/operations">Reset filters and retry</Link>
      </main>
    );
  return <OperationsOverview data={data} />;
}
