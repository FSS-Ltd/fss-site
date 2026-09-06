import { notFound } from "next/navigation";
import {
  ClientList,
  type ClientListState,
} from "@/components/operations/clients/client-list";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listOrganisations } from "@/lib/operations/organisations/repository";

export const dynamic = "force-dynamic";

export default async function OperationsClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  // Layouts and pages may render concurrently; authorise here before any query.
  const founder = await requireFounder();
  const params = await searchParams;
  let state: ClientListState;
  try {
    if (Array.isArray(params.after)) throw new Error("Invalid cursor.");
    state = {
      status: "ready",
      data: await listOrganisations(getOperationsDb(), founder, params.after),
    };
  } catch {
    state = {
      status: "error",
      message:
        "The client register could not load. Reload the first page to try again.",
    };
  }
  return <ClientList state={state} />;
}
