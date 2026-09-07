import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listAgreementRegister } from "@/lib/operations/agreements/repository";
import { AgreementRegister } from "@/components/operations/agreements/agreement-register";
export const dynamic = "force-dynamic";
export default async function AgreementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{ after?: string | string[] }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  const founder = await requireFounder();
  const { organisationId } = await params;
  const { after } = await searchParams;
  let register;
  try {
    if (Array.isArray(after)) throw new Error("Invalid cursor.");
    register = await listAgreementRegister(
      getOperationsDb(),
      founder,
      organisationId,
      after,
    );
  } catch (error) {
    console.error("Operations agreement register could not load.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return (
      <section role="alert">
        <h1>Agreements could not load</h1>
        <p>Reload the register to try again.</p>
        <Link href="/growth/operations/clients">Back to client register</Link>
      </section>
    );
  }
  if (!register) notFound();
  return (
    <AgreementRegister organisationId={organisationId} register={register} />
  );
}
