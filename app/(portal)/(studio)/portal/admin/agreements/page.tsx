import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StaffAgreementOverview } from "@/components/portal/agreements/staff-agreement-overview";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffAgreementOverview } from "@/lib/operations/agreements/repository";
import { listStaffSigningReadiness } from "@/lib/operations/agreements/signing-repository";

export const dynamic = "force-dynamic";

export default async function AdminAgreementsPage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  let agreements, signingReadiness;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(db, identity, randomUUID());
    [agreements, signingReadiness] = await Promise.all([
      listStaffAgreementOverview(db, admin),
      listStaffSigningReadiness(db, admin),
    ]);
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <StaffAgreementOverview
      agreements={agreements}
      signingReadiness={signingReadiness}
    />
  );
}
