import { redirect } from "next/navigation";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { portalPath } from "@/lib/operations/auth/portal-url";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (context)
    redirect(
      `${portalPath("/portal/settings/team")}?${new URLSearchParams({ organisationId: context.organisationId }).toString()}`,
    );
  redirect(portalPath("/portal/login"));
}
