import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientHelp } from "@/components/portal/support/client-help";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";

export const dynamic = "force-dynamic";

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  return <ClientHelp organisationId={context.organisationId} />;
}
