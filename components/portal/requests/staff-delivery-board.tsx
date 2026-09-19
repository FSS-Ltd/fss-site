"use client";

import { useCallback, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  requestStatuses,
  type RequestStatus,
} from "@/lib/operations/requests/types";
import { statusLabels } from "./presentation";
import styles from "./requests.module.css";
import type { StaffDeliveryBoardRequest } from "@/lib/operations/requests/staff-repository";

// Server-validated transition plan per status column: which founder/staff
// command moves a card into this column, and what it requires.
const columnTransitions: Partial<
  Record<RequestStatus, { command: string; requiresForm: boolean; label: string }>
> = {
  acknowledged: { command: "acknowledge", requiresForm: true, label: "Acknowledge" },
  planned: { command: "plan", requiresForm: true, label: "Plan" },
  in_progress: { command: "start", requiresForm: false, label: "Start" },
  ready_for_review: { command: "review", requiresForm: true, label: "Send for review" },
};

const keyboardTransitions: Partial<Record<RequestStatus, RequestStatus>> = {
  // Keyboard alternative to dragging: move forward/backward through the
  // delivery pipeline using arrow keys from a focused card.
  acknowledged: "planned",
  planned: "in_progress",
  in_progress: "ready_for_review",
  changes_requested: "in_progress",
  done: "acknowledged",
};

export function StaffDeliveryBoard({
  requests,
  clients,
  filters,
}: {
  requests: StaffDeliveryBoardRequest[];
  clients: Array<{ id: string; displayName: string }>;
  filters: { organisationId: string; status: string };
}): React.JSX.Element {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);

  const move = useCallback(
    async (request: StaffDeliveryBoardRequest, target: RequestStatus) => {
      if (pendingId) return;
      const transition =
        target === "cancelled"
          ? { command: "cancel", requiresForm: true, label: "Cancel request" }
          : columnTransitions[target];
      if (!transition) {
        setError(
          "That move needs the request workspace. Open the request to provide the required evidence.",
        );
        return;
      }
      if (transition.requiresForm) {
        router.push(
          `/admin/clients/${request.organisationId}/requests/${request.id}`,
        );
        return;
      }
      setPendingId(request.id);
      setError("");
      try {
        const response = await fetch(
          `/api/portal/admin/clients/${encodeURIComponent(request.organisationId)}/requests/${encodeURIComponent(request.id)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: transition.command,
              requestId: request.id,
              expectedVersion: request.version,
            }),
          },
        );
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const message =
            typeof body === "object" && body !== null && "error" in body
              ? String((body as { error: unknown }).error)
              : null;
          setError(
            response.status === 409
              ? "This request changed. Reload the board and try again."
              : (message ??
                "The update could not be saved. Try again from the request workspace."),
          );
          return;
        }
        router.refresh();
      } catch {
        setError("We could not connect. Try again.");
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, router],
  );

  function onCardKeyDown(
    event: KeyboardEvent<HTMLAnchorElement>,
    request: StaffDeliveryBoardRequest,
  ): void {
    if (pendingId) return;
    const target =
      event.key === "ArrowRight"
        ? keyboardTransitions[request.status]
        : event.key === "ArrowLeft" && request.status === "in_progress"
          ? "planned"
          : null;
    if (!target) return;
    event.preventDefault();
    void move(request, target);
  }

  const lanes = requestStatuses.filter(
    (value) => filters.status === "all" || filters.status === value,
  );
  return (
    <section aria-label="Cross-client delivery board">
      <div className={styles.filters}>
        <label className={styles.field}>
          Client
          <select
            value={filters.organisationId}
            className={styles.input}
            onChange={(event) =>
              router.push(
                `/admin/delivery?client=${encodeURIComponent(event.target.value)}&status=${encodeURIComponent(filters.status)}`,
              )
            }
          >
            <option value="all">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Status
          <select
            value={filters.status}
            className={styles.input}
            onChange={(event) =>
              router.push(
                `/admin/delivery?client=${encodeURIComponent(filters.organisationId)}&status=${encodeURIComponent(event.target.value)}`,
              )
            }
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
      <p className={styles.note} role="status" aria-live="polite">
        {error}
      </p>
      <div className={styles.board}>
        {lanes.map((lane) => {
          const cards = requests.filter((r) => r.status === lane);
          return (
            <section
              className={styles.lane}
              key={lane}
              aria-label={statusLabels[lane]}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                const request = requests.find((r) => r.id === dragging);
                setDragging(null);
                if (request) void move(request, lane);
              }}
            >
              <h2 className={styles.laneTitle}>
                {statusLabels[lane]} <span>{cards.length}</span>
              </h2>
              <ul>
                {cards.map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/admin/clients/${request.organisationId}/requests/${request.id}`}
                      className={styles.boardLink}
                      aria-label={`${request.title} — ${statusLabels[request.status]}. Use arrow keys to move, Enter to open.`}
                      aria-disabled={pendingId === request.id}
                      draggable={pendingId !== request.id}
                      onDragStart={() => setDragging(request.id)}
                      onKeyDown={(event) => onCardKeyDown(event, request)}
                      style={pendingId === request.id ? { opacity: 0.5 } : undefined}
                    >
                      <h3>{request.title}</h3>
                      <p>
                        {request.organisationName} ·{" "}
                        {request.nextAction || "Awaiting next step"}
                      </p>
                      {request.blocked && (
                        <span className={styles.status}>Blocked</span>
                      )}
                    </Link>
                  </li>
                ))}
                {!cards.length && <li className={styles.note}>No requests</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <p className={styles.note}>
        Cards requiring evidence open the request workspace. Arrow keys move
        cards through the pipeline; Enter opens the request.{" "}
        <Link href="/admin/clients">Open client workspaces</Link>.
      </p>
    </section>
  );
}
