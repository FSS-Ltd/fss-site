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
import styles from "@/components/portal/requests/requests.module.css";
import layout from "@/components/operations/requests/requests.module.css";
import { RequestQueueSummary } from "@/components/operations/requests/request-queue-summary";
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
      <section role="alert">
        <h1>Requests could not load</h1>
        <p>Reload to try again.</p>
        <Link href="/growth/operations/clients">Client register</Link>
      </section>
    );
  }
  const { requests, observedAt: now } = queue;
  return (
    <section className={layout.page}>
      <header className={layout.header}>
        <Link href="/growth/operations/clients">Client register</Link>
        <p className={`${styles.eyebrow} ${layout.headerEyebrow}`}>
          Operations
        </p>
        <h1 className={`${styles.title} ${layout.headerTitle}`}>
          Client requests
        </h1>
        <p className={`${styles.copy} ${layout.headerCopy}`}>
          Review new work, resolve waiting items and share the next step.
        </p>
        <p className={`${styles.note} ${layout.headerNote}`}>
          Showing up to 100 requests, with open work and action deadlines first.
        </p>
      </header>
      <RequestQueueSummary observedAt={now} requests={requests} />
      {requests.length === 0 ? (
        <p className={styles.empty}>
          No requests yet. Client submissions will appear here.
        </p>
      ) : (
        <ul className={styles.list}>
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                className={styles.requestLink}
                href={`/growth/operations/clients/${organisationId}/requests/${request.id}`}
              >
                <span
                  className={`${styles.status} ${layout.status}`}
                  data-status={request.status}
                >
                  {statusLabels[request.status]}
                </span>
                <h2 className={styles.itemTitle}>{request.title}</h2>
                <p className={styles.copy}>
                  {request.nextAction ||
                    "Assess scope and confirm the next action."}
                </p>
                <p className={styles.note}>
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
