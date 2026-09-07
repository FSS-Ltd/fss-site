import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ClientRequest } from "@/lib/operations/requests/types";
import {
  requestDate,
  requestHref,
  scopeLabels,
  statusLabels,
} from "./presentation";
import styles from "./requests.module.css";

export type RequestCollectionProps = {
  requests: ClientRequest[];
  organisationId: string;
};

export function RequestList({
  requests,
  organisationId,
}: RequestCollectionProps): React.JSX.Element {
  if (!requests.length)
    return (
      <p className={styles.empty}>
        No requests to show. Create a request when you need a change, a fix or a
        hand with your project.
      </p>
    );
  return (
    <ul className={styles.list}>
      {requests.map((request) => (
        <li key={request.id}>
          <Link
            className={styles.requestLink}
            href={requestHref(request.id, organisationId)}
          >
            <div className={styles.row}>
              <span
                className={styles.status}
                data-review={request.status === "ready_for_review"}
              >
                {statusLabels[request.status]}
              </span>
              {request.blocked && <span className={styles.note}>Blocked</span>}
              <ArrowUpRight
                className={styles.arrow}
                size={18}
                aria-hidden="true"
              />
            </div>
            <h2 className={styles.itemTitle}>{request.title}</h2>
            <p className={styles.copy}>
              {request.nextAction ||
                "Your FSS team will assess the request and confirm the next step."}
            </p>
            <div className={styles.meta}>
              <span>{scopeLabels[request.scope]}</span>
              <span>{request.ownerDisplay || "Owner to be confirmed"}</span>
              <span>Target: {requestDate(request.targetDate)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
