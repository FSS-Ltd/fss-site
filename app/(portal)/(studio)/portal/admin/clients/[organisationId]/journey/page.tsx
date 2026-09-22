import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { StaffJourneyWorkspace } from "@/components/portal/onboarding/staff-journey-workspace";
import { isJourneyBuilderStage } from "@/lib/operations/onboarding/builder-stage";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { requireFssAdmin } from "@/lib/operations/auth/require-admin";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import {
  getOperationsDb,
  operationsEnabled,
  type OperationsDb,
} from "@/lib/operations/db/client";
import { listStaffAgreementRegister } from "@/lib/operations/agreements/repository";
import type { AgreementRegister } from "@/lib/operations/agreements/types";
import { listStaffSigning } from "@/lib/operations/agreements/signing-service";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";
import {
  listStaffJourneyContacts,
  listStaffJourneys,
  loadStaffOnboardingWorkspace,
} from "@/lib/operations/onboarding/queries";
import type {
  JourneyBillingAccount,
  JourneyView,
} from "@/lib/operations/onboarding/command-types";
import { onboardingEnabled } from "@/lib/operations/onboarding/worker-db";
import { readBillingConfiguration } from "@/lib/operations/billing/configuration";
import styles from "@/components/portal/studio-client.module.css";
import type { FssAdminContext } from "@/lib/operations/auth/staff-types";
import type { OnboardingWorkspace } from "@/lib/operations/onboarding/workspace-types";

export const dynamic = "force-dynamic";

export default async function StaffClientJourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{ step?: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  if (!portalAuthConfigured()) return <PortalUnavailable />;
  const identity = await getPortalIdentity();
  if (!identity) return <PortalUnavailable />;
  const organisationId = z.uuid().safeParse((await params).organisationId);
  if (!organisationId.success) notFound();
  const requestedStage = (await searchParams).step;
  const builderStage = isJourneyBuilderStage(requestedStage)
    ? requestedStage
    : undefined;
  let db: OperationsDb;
  let admin: FssAdminContext;
  try {
    db = getOperationsDb();
    admin = await requireFssAdmin(getPortalDb(), identity, randomUUID());
  } catch {
    return <PortalUnavailable />;
  }
  if (!onboardingEnabled()) {
    return (
      <section
        className={styles.page}
        aria-labelledby="journey-unavailable-heading"
      >
        <h1 id="journey-unavailable-heading" className={styles.title}>
          Welcome journeys unavailable
        </h1>
        <p className={styles.rowCopy}>
          Onboarding delivery is not enabled. No messages, invitations, or
          billing effects can be prepared from this workspace.
        </p>
      </section>
    );
  }
  let data: {
    register: AgreementRegister;
    journeys: JourneyView[];
    approvals: SigningApproval[];
    contacts: Array<{ id: string; name: string; email: string }>;
    billing: JourneyBillingAccount | null;
    workspace: OnboardingWorkspace;
  };
  try {
    const [register, journeys, approvals, contacts, workspace] =
      await Promise.all([
        listStaffAgreementRegister(db, admin, organisationId.data),
        listStaffJourneys(db, admin, organisationId.data),
        listStaffSigning(db, admin, organisationId.data, randomUUID()),
        listStaffJourneyContacts(db, admin, organisationId.data),
        loadStaffOnboardingWorkspace(db, admin, organisationId.data),
      ]);
    if (!register) notFound();
    let billing = null;
    try {
      const configuration = readBillingConfiguration();
      billing = configuration.enabled
        ? {
            accountId: configuration.accountId,
            livemode: configuration.mode === "live",
          }
        : null;
    } catch {
      billing = null;
    }
    data = { register, journeys, approvals, contacts, billing, workspace };
  } catch {
    return <PortalUnavailable />;
  }
  return (
    <StaffJourneyWorkspace
      organisationId={organisationId.data}
      register={data.register}
      journeys={data.journeys}
      approvals={data.approvals}
      contacts={data.contacts}
      billing={data.billing}
      builderStage={builderStage}
      workspace={data.workspace}
    />
  );
}
