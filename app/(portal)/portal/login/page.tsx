import { notFound } from "next/navigation";
import { operationsEnabled } from "@/lib/operations/db/client";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { PortalLoginForm } from "@/components/portal/auth/login-form";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const params = await searchParams;
  return <PortalLoginForm linkError={params.error === "link"} />;
}
