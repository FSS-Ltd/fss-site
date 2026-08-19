import { ProspectList } from "@/components/growth/prospects/prospect-list";
import {
  getProspectListResult,
  parseProspectListQuery,
} from "@/lib/growth/dashboard/prospects";

type ProspectsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProspectsPage({ searchParams }: ProspectsPageProps) {
  const query = parseProspectListQuery(await searchParams);
  const state = await getProspectListResult(query);

  return <ProspectList query={query} state={state} />;
}
