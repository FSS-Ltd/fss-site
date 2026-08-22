import { ClientList } from "@/components/growth/clients/client-list";
import { getClientListResult, parseClientListQuery } from "@/lib/growth/dashboard/clients";

type ClientsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const query = parseClientListQuery(await searchParams);
  const state = await getClientListResult(query);

  return <ClientList query={query} state={state} />;
}
