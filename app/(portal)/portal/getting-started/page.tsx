import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientSetupChecklist } from "@/components/portal/onboarding/client-setup-checklist";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import {
  getClientSetupChecklist,
  type ClientSetupChecklist as ClientSetupChecklistState,
} from "@/lib/operations/onboarding/client-checklist";
import { onboardingEnabled } from "@/lib/operations/onboarding/worker-db";
import { portalPath } from "@/lib/operations/auth/portal-url";
import styles from "@/components/portal/projects.module.css";

export const dynamic = "force-dynamic";

export default async function GettingStartedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(
    (await searchParams).organisationId,
  );
  if (!context) return <PortalUnavailable />;
  let checklist: ClientSetupChecklistState;
  try {
    checklist = await getClientSetupChecklist(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  return (
    <div className={styles.page}>
      <Link className={styles.breadcrumb} href={portalPath("/portal")}>
        Your workspace
      </Link>
      <p className={styles.eyebrow}>Getting started</p>
      <h1 className={styles.title}>Your setup, clearly</h1>
      <p className={styles.copy}>
        Follow the verified milestones for your work with FSS. Each item is
        updated from your agreement, billing, shared-file, and service records.
      </p>
      <ClientSetupChecklist
        checklist={checklist}
        enabled={onboardingEnabled()}
      />
    </div>
  );
}
