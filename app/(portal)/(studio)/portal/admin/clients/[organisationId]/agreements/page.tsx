import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import {
  AgreementRegister,
  type AgreementWorkspace,
} from "@/components/operations/agreements/agreement-register";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffAgreementRegister } from "@/lib/operations/agreements/repository";

export const dynamic = "force-dynamic";

export default async function StaffClientAgreementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{ after?: string | string[] }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const organisationId = z.uuid().safeParse((await params).organisationId);
  const after = (await searchParams).after;
  if (!organisationId.success || Array.isArray(after)) notFound();
  let register;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    register = await listStaffAgreementRegister(
      db,
      admin,
      organisationId.data,
      after,
    );
  } catch {
    return <PortalUnavailable />;
  }
  if (!register) notFound();
  const apiRoot = `/api/portal/admin/clients/${organisationId.data}`;
  const workspace: AgreementWorkspace = {
    context: "FSS Studio · Agreements",
    backHref: `/admin/clients/${organisationId.data}`,
    backLabel: "Back to client workspace",
    agreementEndpoint: `${apiRoot}/agreements`,
    signingHref: `/admin/clients/${organisationId.data}/signing`,
    signingEndpoint: `${apiRoot}/signing`,
    nextPageHref: (cursor) =>
      `/admin/clients/${organisationId.data}/agreements?after=${encodeURIComponent(cursor)}`,
    evidenceMode: "generated",
    allowManualSigning: false,
  };
  return (
    <AgreementRegister
      organisationId={organisationId.data}
      register={register}
      workspace={workspace}
    />
  );
}
