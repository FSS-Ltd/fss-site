"use client";

import Link from "next/link";
import { useState } from "react";
import {
  requestStatuses,
  type RequestStatus,
} from "@/lib/operations/requests/types";
import { RequestList, type RequestCollectionProps } from "./list";
import {
  requestDate,
  requestHref,
  requestTypeLabels,
  statusLabels,
} from "./presentation";
import styles from "./requests.module.css";

type RequestBoardProps = RequestCollectionProps & {
  filters: { query: string; status?: RequestStatus };
};

const requestLanes: readonly {
  label: string;
  statuses: readonly RequestStatus[];
}[] = [
  { label: "Inbox", statuses: ["new", "acknowledged"] },
  { label: "Planned", statuses: ["planned"] },
  { label: "In progress", statuses: ["in_progress"] },
  { label: "Ready for review", statuses: ["ready_for_review"] },
  { label: "Changes requested", statuses: ["changes_requested"] },
  { label: "Done", statuses: ["done"] },
];

const cancelledLane = {
  label: "Cancelled",
  statuses: ["cancelled"] as const,
};

function requestNewHref(organisationId: string, type?: "bug"): string {
  const query = new URLSearchParams({ organisationId });
  if (type) query.set("type", type);
  return `/requests/new?${query.toString()}`;
}

function requestLanesForFilter(status?: RequestStatus): readonly {
  label: string;
  statuses: readonly RequestStatus[];
}[] {
  if (!status) return requestLanes;
  if (status === "cancelled") return [cancelledLane];
  return requestLanes.filter((lane) => lane.statuses.includes(status));
}

export function RequestBoardSkeleton(): React.JSX.Element {
  return (
    <section
      aria-busy="true"
      aria-label="Loading requests"
      className={styles.requestSkeleton}
    >
      <p className={styles.visuallyHidden}>Loading your requests</p>
      {Array.from({ length: 3 }, (_, index) => (
        <div className={styles.skeletonCard} key={index} />
      ))}
    </section>
  );
}

export function RequestBoard({
  requests,
  organisationId,
  filters,
}: RequestBoardProps): React.JSX.Element {
  const [view, setView] = useState<"list" | "board">("board");
  const lanes = requestLanesForFilter(filters.status);
  const hasRequests = requests.length > 0;

  return (
    <section className={styles.workspace} aria-label="Project requests">
      <form className={styles.filters} method="get">
        <input name="organisationId" type="hidden" value={organisationId} />
        <label className={styles.field}>
          Find a request
          <input
            className={styles.input}
            defaultValue={filters.query}
            name="query"
            placeholder="Search by title"
            type="search"
          />
        </label>
        <label className={styles.field}>
          Request state
          <select
            className={styles.input}
            defaultValue={filters.status ?? "all"}
            name="status"
          >
            <option value="all">All states</option>
            {requestStatuses.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <button className={styles.secondary} type="submit">
          Apply filters
        </button>
      </form>

      <div className={styles.row}>
        <p className={styles.note} role="status">
          {requests.length} {requests.length === 1 ? "request" : "requests"} in
          this view
        </p>
        <div className={styles.viewSwitch} aria-label="Request view">
          <button
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
            type="button"
          >
            Board
          </button>
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            type="button"
          >
            List
          </button>
        </div>
      </div>

      {!hasRequests ? (
        <section className={styles.emptyBoard} aria-labelledby="empty-board-heading">
          <p className={styles.eyebrow}>Requests &amp; feedback</p>
          <h2 id="empty-board-heading" className={styles.sectionTitle}>
            Nothing in your board yet.
          </h2>
          <p className={styles.copy}>
            Create a request or report a bug. FSS will assess scope and confirm
            the next step.
          </p>
          <div className={styles.emptyBoardActions}>
            <Link className={styles.primary} href={requestNewHref(organisationId)}>
              Create first request
            </Link>
            <Link
              className={styles.secondary}
              href={requestNewHref(organisationId, "bug")}
            >
              Report a bug
            </Link>
          </div>
        </section>
      ) : null}

      {hasRequests ? (
        <div className={view === "board" ? styles.mobileList : undefined}>
          <RequestList requests={requests} organisationId={organisationId} />
        </div>
      ) : null}

      {hasRequests && view === "board" ? (
        <div className={styles.board}>
          {lanes.map((lane) => {
            const cards = requests.filter((request) =>
              lane.statuses.includes(request.status),
            );
            return (
              <section className={styles.lane} key={lane.label} aria-label={lane.label}>
                <h2 className={styles.laneTitle}>
                  {lane.label} <span>{cards.length}</span>
                </h2>
                <ul>
                  {cards.map((request) => (
                    <li key={request.id}>
                      <Link
                        className={styles.boardLink}
                        href={requestHref(request.id, organisationId)}
                      >
                        <span className={styles.cardReference}>
                          {requestTypeLabels[request.type]}
                        </span>
                        <h3>{request.title}</h3>
                        <p>{request.nextAction || "Awaiting next step"}</p>
                        <span className={styles.cardMeta}>
                          {request.status !== "planned" &&
                          request.status !== "in_progress" ? (
                            <span>{statusLabels[request.status]}</span>
                          ) : null}
                          <span>{request.ownerDisplay || "Owner to be confirmed"}</span>
                          <span>{requestDate(request.targetDate)}</span>
                        </span>
                        {request.blocked ? (
                          <span className={styles.status}>Blocked</span>
                        ) : null}
                        <span className={styles.cardAction}>
                          {request.status === "ready_for_review" ? "Review" : "Open"}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {!cards.length ? <li className={styles.note}>No requests</li> : null}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      <aside className={styles.boardGuidance} aria-label="How your board works">
        <h2 className={styles.sectionTitle}>How your board works</h2>
        <p className={styles.copy}>
          FSS plans and progresses delivery. You can accept a review or request
          changes. Open a card for its next action and discussion.
        </p>
      </aside>
    </section>
  );
}
