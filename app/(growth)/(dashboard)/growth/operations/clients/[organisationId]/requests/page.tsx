import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getOperationsDb, operationsEnabled } from "@/lib/operations/db/client";
import { loadFounderRequestQueue } from "@/lib/operations/requests/repository";
import {
  statusLabels,
  requestDate,
} from "@/components/portal/requests/presentation";
import { OperationsPageHeader } from "@/components/operations/shared/operations-page-header";
import ui from "@/components/operations/shared/operations-ui.module.css";
import layout from "@/components/operations/requests/requests.module.css";
export const dynamic = "force-dynamic";
export default async function FounderRequestsPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}): Promise<React.JSX.Element> {
  if (!operationsEnabled()) notFound();
  const founder = await requireFounder();
  const parsed = z.uuid().safeParse((await params).organisationId);
  if (!parsed.success) notFound();
  const organisationId = parsed.data;
  let queue;
  try {
    queue = await loadFounderRequestQueue(
      getOperationsDb(),
      founder,
      organisationId,
      randomUUID(),
    );
  } catch {
    return (
      <section className={ui.errorState} role="alert">
        <h1>Requests could not load</h1>
        <p>Reload to try again.</p>
        <Link href="/growth/operations/clients">Client register</Link>
      </section>
    );
  }
  const { requests, observedAt: now } = queue;
  return (
    <section className={`${ui.page} ${layout.page}`}>
      <OperationsPageHeader
        context="Operations · Requests"
        title="Client requests"
        description="Review new work, resolve waiting items and share the next step."
        action={<Link href="/growth/operations/clients">Client register</Link>}
      >
        <p className={layout.note}>
          Showing up to 100 requests, with open work and action deadlines first.
        </p>
      </OperationsPageHeader>
      <section className={ui.metricGrid} aria-label="Client request summary">
        <article className={ui.metricCard}>
          <h2 className={layout.metricLabel}>Requests shown</h2>
          <p className={layout.metricValue}>
            {requests.length} request{requests.length === 1 ? "" : "s"}
          </p>
        </article>
      </section>
      {requests.length === 0 ? (
        <p className={ui.emptyState}>
          No requests yet. Client submissions will appear here.
        </p>
      ) : (
        <ul className={layout.list}>
          {requests.map((request) => (
            <li
              className={`${ui.panel} ${layout.requestPanel}`}
              key={request.id}
            >
              <Link
                className={layout.requestLink}
                href={`/growth/operations/clients/${organisationId}/requests/${request.id}`}
              >
                <span
                  className={ui.statusChip}
                  data-status={
                    request.status === "done"
                      ? "success"
                      : request.status === "ready_for_review"
                        ? "attention"
                        : undefined
                  }
                >
                  {statusLabels[request.status]}
                </span>
                <h2 className={layout.itemTitle}>{request.title}</h2>
                <p className={layout.nextAction}>
                  <strong>Next action:</strong>{" "}
                  {request.nextAction ||
                    "Assess scope and confirm the next action."}
                </p>
                <p className={layout.note}>
                  Owner: {request.ownerDisplay || "Awaiting acknowledgement"} ·
                  Target: {requestDate(request.targetDate)}
                </p>
                {request.status === "new" &&
                  Date.parse(request.acknowledgementTarget) < now && (
                    <p className={layout.overdue}>Acknowledgement overdue</p>
                  )}
                {request.status === "ready_for_review" &&
                  request.reviewReminderTarget &&
                  Date.parse(request.reviewReminderTarget) < now && (
                    <p className={layout.overdue}>Review follow-up due</p>
                  )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
