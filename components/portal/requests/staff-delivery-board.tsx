"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalSelect,
  StatusBadge,
  type PortalStatus,
} from "@/components/portal/ui";
import {
  type RequestStatus,
  requestStatuses,
} from "@/lib/operations/requests/types";
import type { StaffDeliveryBoardRequest } from "@/lib/operations/requests/staff-repository";
import { statusLabels } from "./presentation";
import styles from "./requests.module.css";

type BoardLane = {
  id: string;
  label: string;
  statuses: RequestStatus[];
};

type MoveTransition = {
  command: "acknowledge" | "plan" | "start" | "review" | "revise" | "reopen";
  label: string;
  requiresWorkspace: boolean;
  target: RequestStatus;
};

const deliveryLanes: BoardLane[] = [
  { id: "inbox", label: "Inbox", statuses: ["new", "acknowledged"] },
  { id: "planned", label: "Planned", statuses: ["planned"] },
  { id: "in-progress", label: "In progress", statuses: ["in_progress"] },
  {
    id: "ready-for-review",
    label: "Ready for review",
    statuses: ["ready_for_review"],
  },
  {
    id: "changes-requested",
    label: "Changes requested",
    statuses: ["changes_requested"],
  },
  { id: "done", label: "Done", statuses: ["done"] },
];

const moveTransitions: Partial<Record<RequestStatus, MoveTransition>> = {
  acknowledged: {
    command: "plan",
    label: "Move to planned",
    requiresWorkspace: true,
    target: "planned",
  },
  changes_requested: {
    command: "revise",
    label: "Assess requested changes",
    requiresWorkspace: true,
    target: "in_progress",
  },
  done: {
    command: "reopen",
    label: "Reopen request",
    requiresWorkspace: true,
    target: "acknowledged",
  },
  in_progress: {
    command: "review",
    label: "Move to Ready for review",
    requiresWorkspace: true,
    target: "ready_for_review",
  },
  new: {
    command: "acknowledge",
    label: "Move to acknowledged",
    requiresWorkspace: true,
    target: "acknowledged",
  },
  planned: {
    command: "start",
    label: "Move to In progress",
    requiresWorkspace: false,
    target: "in_progress",
  },
};

function statusTone(status: RequestStatus): PortalStatus {
  if (status === "done") return "success";
  if (status === "ready_for_review") return "info";
  if (status === "changes_requested") return "warning";
  return "neutral";
}

function workspaceHref(
  request: StaffDeliveryBoardRequest,
  action: MoveTransition["command"],
): string {
  return `/admin/clients/${encodeURIComponent(request.organisationId)}/requests/${encodeURIComponent(request.id)}?action=${action}`;
}

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
  const dialogRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [movingRequest, setMovingRequest] =
    useState<StaffDeliveryBoardRequest | null>(null);

  const closeMoveSheet = useCallback(() => {
    setMovingRequest(null);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (movingRequest) dialogRef.current?.focus();
  }, [movingRequest]);

  const move = useCallback(
    async (
      request: StaffDeliveryBoardRequest,
      transition: MoveTransition,
    ): Promise<boolean> => {
      if (pendingId || transition.requiresWorkspace) return false;
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
          return false;
        }
        router.refresh();
        return true;
      } catch {
        setError("We could not connect. Try again.");
        return false;
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, router],
  );

  function openMoveSheet(
    request: StaffDeliveryBoardRequest,
    trigger?: HTMLButtonElement,
  ): void {
    triggerRef.current = trigger ?? null;
    setMovingRequest(request);
    setError("");
  }

  const lanes = deliveryLanes.filter(
    (lane) =>
      filters.status === "all" ||
      lane.statuses.some((status) => status === filters.status),
  );
  const archivedLane: BoardLane = {
    id: "cancelled",
    label: "Cancelled",
    statuses: ["cancelled"],
  };
  const displayedLanes =
    filters.status === "cancelled" ? [archivedLane] : lanes;
  const selectedTransition = movingRequest
    ? moveTransitions[movingRequest.status]
    : undefined;

  return (
    <section
      className={styles.deliveryBoard}
      aria-label="Cross-client delivery board"
    >
      <div className={styles.filters}>
        <PortalSelect
          label="Client"
          name="client"
          onChange={(event) =>
            router.push(
              `/admin/delivery?client=${encodeURIComponent(event.target.value)}&status=${encodeURIComponent(filters.status)}`,
            )
          }
          value={filters.organisationId}
        >
          <option value="all">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.displayName}
            </option>
          ))}
        </PortalSelect>
        <PortalSelect
          label="Status"
          name="status"
          onChange={(event) =>
            router.push(
              `/admin/delivery?client=${encodeURIComponent(filters.organisationId)}&status=${encodeURIComponent(event.target.value)}`,
            )
          }
          value={filters.status}
        >
          <option value="all">All statuses</option>
          {requestStatuses.map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </PortalSelect>
      </div>
      <p className={styles.feedback} role="status" aria-live="polite">
        {error}
      </p>
      <div className={styles.board}>
        {displayedLanes.map((lane) => {
          const cards = requests.filter((request) =>
            lane.statuses.includes(request.status),
          );
          return (
            <section
              className={styles.lane}
              key={lane.id}
              aria-label={lane.label}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                const request = requests.find((item) => item.id === dragging);
                setDragging(null);
                const transition = request && moveTransitions[request.status];
                if (
                  request &&
                  transition &&
                  transition.target === lane.statuses[0]
                ) {
                  if (transition.requiresWorkspace) {
                    openMoveSheet(request);
                    setError(
                      "Complete the required evidence before moving this work.",
                    );
                  } else {
                    void move(request, transition);
                  }
                }
              }}
            >
              <h2 className={styles.laneTitle}>
                {lane.label} <span>{cards.length}</span>
              </h2>
              <ul>
                {cards.map((request) => (
                  <li key={request.id}>
                    <PortalCard
                      className={styles.deliveryCard}
                      title={request.title}
                    >
                      <p className={styles.cardReference}>
                        {request.organisationName}
                      </p>
                      <div className={styles.cardMeta}>
                        <span>
                          Owner: {request.ownerDisplay || "Unassigned"}
                        </span>
                        <span>Priority: {request.priority}</span>
                      </div>
                      <StatusBadge status={statusTone(request.status)}>
                        {statusLabels[request.status]}
                      </StatusBadge>
                      {request.blocked ? (
                        <StatusBadge status="error">Blocked</StatusBadge>
                      ) : null}
                      <Link
                        className={styles.deliveryCardLink}
                        draggable={pendingId !== request.id}
                        href={`/admin/clients/${encodeURIComponent(request.organisationId)}/requests/${encodeURIComponent(request.id)}`}
                        onDragStart={() => setDragging(request.id)}
                      >
                        Open workspace
                      </Link>
                      {moveTransitions[request.status] ? (
                        <PortalButton
                          aria-label={`Move ${request.title} from ${statusLabels[request.status]}`}
                          disabled={pendingId === request.id}
                          onClick={(event) =>
                            openMoveSheet(request, event.currentTarget)
                          }
                          type="button"
                          variant="secondary"
                        >
                          Move to
                        </PortalButton>
                      ) : (
                        <PortalButton
                          disabled
                          disabledReason="This work is waiting for its current workflow step."
                          type="button"
                          variant="secondary"
                        >
                          Move to
                        </PortalButton>
                      )}
                    </PortalCard>
                  </li>
                ))}
                {!cards.length ? (
                  <li className={styles.note}>No requests</li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
      <Notice tone="info">
        <strong>Move work with confidence</strong>
        <p className={styles.noticeCopy}>
          Dragging is optional. Use Move to for every transition. Scope, review,
          and capacity checks appear before a change is committed.
        </p>
      </Notice>
      {movingRequest && selectedTransition ? (
        <section
          aria-label="Move work"
          aria-modal="true"
          className={styles.moveSheet}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMoveSheet();
          }}
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <PortalCard
            description={`Nothing has moved yet. ${movingRequest.title} remains ${statusLabels[movingRequest.status]}.`}
            title={selectedTransition.label}
          >
            {selectedTransition.requiresWorkspace ? (
              <>
                <Notice tone="warning">
                  Complete the required scope, review, or capacity evidence in
                  the request workspace before moving this work.
                </Notice>
                <PortalButton
                  onClick={() =>
                    router.push(
                      workspaceHref(movingRequest, selectedTransition.command),
                    )
                  }
                  type="button"
                >
                  Open request workspace
                </PortalButton>
              </>
            ) : (
              <PortalButton
                disabled={pendingId === movingRequest.id}
                loading={pendingId === movingRequest.id}
                onClick={() => {
                  void move(movingRequest, selectedTransition).then((moved) => {
                    if (moved) closeMoveSheet();
                  });
                }}
                type="button"
              >
                {selectedTransition.label}
              </PortalButton>
            )}
            <PortalButton
              onClick={closeMoveSheet}
              type="button"
              variant="secondary"
            >
              Cancel
            </PortalButton>
          </PortalCard>
        </section>
      ) : null}
    </section>
  );
}
