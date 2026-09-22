import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StaffRequestForm } from "@/components/portal/requests/staff-request-form";
import styles from "@/components/portal/requests/requests.module.css";
import { PageHeader } from "@/components/portal/ui";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { listStaffRequestCreationClients } from "@/lib/operations/requests/staff-repository";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryCreatePage(): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  let clients;
  try {
    const db = getOperationsDb();
    const admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
    clients = await listStaffRequestCreationClients(db, admin);
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <div className={styles.requestPage}>
      <PageHeader
        breadcrumbs={[
          { label: "Delivery", href: "/admin/delivery" },
          { label: "Create work" },
        ]}
        description="Choose the client and project before creating a request. Scope remains under assessment until FSS records a decision."
        eyebrow="FSS Studio / Delivery"
        title="Create work for a client"
      />
      <StaffRequestForm clients={clients} />
    </div>
  );
}
