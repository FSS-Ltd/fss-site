import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalButton,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import type { StaffJourneyRecovery } from "@/lib/operations/onboarding/queries";
import styles from "./operations-queues.module.css";

function actionLabel(id: string): string {
  if (id === "agreement" || id === "signing") return "Open agreement";
  if (id === "sender" || id === "billing") return "Open settings";
  if (id === "contact") return "Open clients";
  return "Open welcome journeys";
}

function tone(status: StaffJourneyRecovery["checks"][number]["status"]): "success" | "warning" | "error" {
  if (status === "passed") return "success";
  return status === "failed" ? "error" : "warning";
}

export function JourneyRecovery({
  recovery,
}: Readonly<{ recovery: StaffJourneyRecovery | null }>): React.JSX.Element {
  if (!recovery) {
    return (
      <main className={styles.page}>
        <PageHeader
          description="There is no saved welcome draft to recover. Prepare a journey from a current agreement first."
          eyebrow="FSS Studio · Welcome journeys"
          title="No journey draft to review"
        />
      </main>
    );
  }
  const failed = recovery.checks.filter((check) => check.status !== "passed");
  return (
    <section className={styles.page} aria-labelledby="journey-recovery-heading">
      <PageHeader
        description={`The saved draft for ${recovery.organisationName} remains intact. Resolve the retained checks, then prepare a fresh server preview.`}
        eyebrow="FSS Studio · Welcome journeys"
        title="Two things need your attention"
      />
      <Notice tone="warning">
        Activation remains unavailable until the existing journey command runs a new server preflight. A browser result cannot start this journey.
      </Notice>
      <PortalCard title="Readiness checks">
        <ul className={styles.list}>
          {recovery.checks.map((check) => (
            <li key={check.id}>
              <div className={styles.row}>
                <div className={styles.rowSummary}>
                  <h2>{check.id.replaceAll("_", " ")}</h2>
                  <p>{check.reason}</p>
                </div>
                <StatusBadge status={tone(check.status)}>{check.status === "passed" ? "Confirmed" : "Needs attention"}</StatusBadge>
                {check.href ? <PortalActionLink href={check.href} variant="secondary">{actionLabel(check.id)}</PortalActionLink> : null}
              </div>
            </li>
          ))}
        </ul>
      </PortalCard>
      <PortalCard title="Resolve before starting">
        <p className={styles.empty}>
          {failed.length === 0
            ? "The displayed checks are current, but starting still requires a new server preview."
            : `${failed.length} retained ${failed.length === 1 ? "check needs" : "checks need"} repair before a new preview can be prepared.`}
        </p>
        <PortalButton disabled disabledReason="Prepare a new server preview after resolving every retained check." type="button">
          Start welcome journey
        </PortalButton>
      </PortalCard>
    </section>
  );
}
