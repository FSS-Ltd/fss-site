"use client";

import { useState } from "react";
import Link from "next/link";
import { RequestList, type RequestCollectionProps } from "./list";
import {
  requestStatuses,
  type RequestStatus,
} from "@/lib/operations/requests/types";
import { requestHref, statusLabels } from "./presentation";
import styles from "./requests.module.css";

type RequestBoardProps = RequestCollectionProps & {
  filters: { query: string; status?: RequestStatus };
};

export function RequestBoard({
  requests,
  organisationId,
  filters,
}: RequestBoardProps): React.JSX.Element {
  const [view, setView] = useState<"list" | "board">("list");
  return (
    <section className={styles.workspace} aria-label="Project requests">
      <p className={styles.note}>
        Filters and pages are applied before requests reach this workspace.
      </p>
      <form className={styles.filters} method="get">
        <input name="organisationId" type="hidden" value={organisationId} />
        <label className={styles.field}>
          Find a request
          <input
            defaultValue={filters.query}
            className={styles.input}
            name="query"
            type="search"
            placeholder="Search by title"
          />
        </label>
        <label className={styles.field}>
          Status
          <select
            className={styles.input}
            defaultValue={filters.status ?? "all"}
            name="status"
          >
            <option value="all">All statuses</option>
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
          {requests.length} {requests.length === 1 ? "request" : "requests"} on
          this page
        </p>
        <div className={styles.viewSwitch} aria-label="Request view">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            Board
          </button>
        </div>
      </div>
      <div className={view === "board" ? styles.mobileList : undefined}>
        <RequestList requests={requests} organisationId={organisationId} />
      </div>
      {view === "board" && (
        <div className={styles.board}>
          {requestStatuses
            .filter((value) => !filters.status || filters.status === value)
            .map((value) => (
              <section
                className={styles.lane}
                key={value}
                aria-label={statusLabels[value]}
              >
                <h2 className={styles.laneTitle}>
                  {statusLabels[value]}{" "}
                  <span>
                    {
                      requests.filter((request) => request.status === value)
                        .length
                    }
                  </span>
                </h2>
                <ul>
                  {requests
                    .filter((request) => request.status === value)
                    .map((request) => (
                      <li key={request.id}>
                        <Link
                          href={requestHref(request.id, organisationId)}
                          className={styles.boardLink}
                        >
                          <h3>{request.title}</h3>
                          <p>{request.nextAction || "Awaiting next step"}</p>
                          {request.blocked && (
                            <span className={styles.status}>Blocked</span>
                          )}
                        </Link>
                      </li>
                    ))}
                </ul>
                {!requests.some((request) => request.status === value) && (
                  <p className={styles.note}>No requests</p>
                )}
              </section>
            ))}
        </div>
      )}
      <p className={styles.note}>
        New requests are assessed before scheduling. Acknowledgement confirms
        receipt; your scope decision and agreed dates appear on each request.
      </p>
    </section>
  );
}
