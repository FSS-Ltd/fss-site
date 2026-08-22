import { DealList } from "@/components/growth/deals/deal-list";
import { getDealListResult, parseDealListQuery } from "@/lib/growth/dashboard/deals";

type DealsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const query = parseDealListQuery(await searchParams);
  const state = await getDealListResult(query);

  return <DealList query={query} state={state} />;
}
