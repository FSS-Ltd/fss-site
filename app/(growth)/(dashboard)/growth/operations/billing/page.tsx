import { notFound, redirect } from "next/navigation";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listBillingExceptions } from "@/lib/operations/billing/exception-repository";
import { BillingExceptionList } from "@/components/operations/billing/exception-list";
import { growthOperationsCutoverEnabled } from "@/lib/operations/auth/release-flags";
import { fssStudioUrl } from "@/lib/operations/auth/studio-url";

export const dynamic = "force-dynamic";
export default async function BillingReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  const founder = await requireFounder();
  if (growthOperationsCutoverEnabled())
    redirect(fssStudioUrl("/admin/billing"));
  if (process.env.OPERATIONS_BILLING_ENABLED !== "true") notFound();
  const params = await searchParams;
  try {
    if (Array.isArray(params.after)) throw new Error("Invalid cursor.");
    const data = await listBillingExceptions(
      getOperationsDb(),
      founder,
      params.after,
    );
    return <BillingExceptionList state={{ status: "ready", ...data }} />;
  } catch {
    return <BillingExceptionList state={{ status: "error" }} />;
  }
}
