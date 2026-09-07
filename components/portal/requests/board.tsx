"use client";

import { useState } from "react";
import Link from "next/link";
import { RequestList, type RequestCollectionProps } from "./list";
import { requestStatuses } from "@/lib/operations/requests/types";
import { requestHref, statusLabels } from "./presentation";
import styles from "./requests.module.css";

export function RequestBoard({
  requests,
  organisationId,
}: RequestCollectionProps): React.JSX.Element {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "board">("list");
  const filtered = requests.filter(
    (request) =>
      (status === "all" || request.status === status) &&
      request.title
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <section className={styles.workspace} aria-label="Project requests">
      <p className={styles.note}>
        Showing up to 100 recent requests. Search and filters apply to these
        displayed requests.
      </p>
      <div className={styles.filters}>
        <label className={styles.field}>
          Find a request
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title"
            className={styles.input}
          />
        </label>
        <label className={styles.field}>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={styles.input}
          >
            <option value="all">All statuses</option>
            {requestStatuses.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.row}>
        <p className={styles.note} role="status">
          {filtered.length} {filtered.length === 1 ? "request" : "requests"}
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
        <RequestList requests={filtered} organisationId={organisationId} />
      </div>
      {view === "board" && (
        <div className={styles.board}>
          {requestStatuses
            .filter((value) => status === "all" || status === value)
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
                      filtered.filter((request) => request.status === value)
                        .length
                    }
                  </span>
                </h2>
                <ul>
                  {filtered
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
                {!filtered.some((request) => request.status === value) && (
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
