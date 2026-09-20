"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PortalButton, PortalCard, PortalSelect } from "@/components/portal/ui";
import type {
  ClientRequestDetail,
  RequestStatus,
  RequestPriority,
} from "@/lib/operations/requests/types";
import {
  founderRequestCommandSchema,
  type FounderRequestCommand,
} from "@/lib/operations/requests/validation";
import {
  requestActionResponseSchema,
  requestActionErrorSchema,
  type ActionResult,
} from "./actions";
import { FounderActionFields } from "./founder-action-fields";
import styles from "./requests.module.css";

const transitions: Record<
  RequestStatus,
  Array<{ value: string; label: string }>
> = {
  new: [{ value: "acknowledge", label: "Acknowledge request" }],
  acknowledged: [{ value: "plan", label: "Plan work" }],
  planned: [{ value: "start", label: "Start work" }],
  in_progress: [{ value: "review", label: "Send for client review" }],
  ready_for_review: [],
  changes_requested: [{ value: "revise", label: "Assess requested changes" }],
  done: [{ value: "reopen", label: "Reopen request" }],
  cancelled: [],
};

export function FounderRequestActions({
  request,
  organisationId,
  deliveryOwners,
  agreements = [],
  commandAction,
  currentPriority = "normal",
}: {
  request: ClientRequestDetail;
  organisationId: string;
  deliveryOwners: Array<{ id: string; label: string }>;
  agreements?: Array<{ id: string; label: string }>;
  commandAction?: (command: FounderRequestCommand) => Promise<ActionResult>;
  currentPriority?: RequestPriority;
}): React.JSX.Element {
  const router = useRouter();
  const locked = useRef(false);
  const [action, setAction] = useState("comment");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const closed = request.status === "done" || request.status === "cancelled";
  const choices = [
    { value: "comment", label: "Add a comment" },
    { value: "set_priority", label: "Set operational priority" },
    ...transitions[request.status],
    ...(!closed
      ? [
          { value: "classify_scope", label: "Update scope decision" },
          { value: "block", label: "Record a blocker" },
          ...(request.blocked
            ? [{ value: "unblock", label: "Clear blocker" }]
            : []),
          { value: "cancel", label: "Cancel request" },
          { value: "close", label: "Close administratively" },
        ]
      : []),
  ];

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const parsed = founderRequestCommandSchema.safeParse({
      requestId: request.id,
      expectedVersion: request.version,
      ...(action === "block"
        ? { action: "block", blocked: fields }
        : action === "unblock"
          ? { action: "block", blocked: null }
          : { action, ...fields }),
      ...(action === "plan"
        ? {
            targetDate: fields.targetDate || null,
            agreementId: fields.agreementId || null,
          }
        : {}),
      ...(action === "classify_scope"
        ? { agreementId: fields.agreementId || null }
        : {}),
    });
    if (!parsed.success) {
      setMessage(
        parsed.error.issues
          .map((issue) => `${issue.path.join(" ")}: ${issue.message}`)
          .join(" "),
      );
      return;
    }
    locked.current = true;
    setPending(true);
    setMessage("");
    setConflict(false);
    try {
      let result: ActionResult;
      if (commandAction) result = await commandAction(parsed.data);
      else {
        const { requestId, ...command } = parsed.data;
        const response = await fetch(
          `/api/growth/operations/clients/${encodeURIComponent(organisationId)}/requests/${encodeURIComponent(requestId)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(command),
          },
        );
        const body: unknown = await response.json().catch(() => null);
        if (response.ok) {
          const parsedResponse = requestActionResponseSchema.safeParse(body);
          result = parsedResponse.success
            ? { ok: true, request: parsedResponse.data.request }
            : {
                ok: false,
                conflict: false,
                error:
                  "We could not confirm the update. Your draft is still here. Try again.",
              };
        } else {
          const failure = requestActionErrorSchema.safeParse(body);
          result = {
            ok: false,
            conflict: response.status === 409,
            error:
              response.status === 409
                ? "This request has changed. Refresh its details; your draft will stay here."
                : failure.success
                  ? failure.data.error
                  : "The update could not be saved. Check the required evidence and try again.",
          };
        }
      }
      if (!result.ok) {
        setMessage(result.error);
        setConflict(result.conflict);
        return;
      }
      setMessage("Request updated.");
      form.reset();
      setAction("comment");
      router.refresh();
    } catch {
      setMessage("We could not connect. Your draft is still here. Try again.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return (
    <PortalCard
      headingId="founder-request-actions-heading"
      title="Manage request"
    >
      <form onSubmit={submit} className={styles.form} aria-busy={pending}>
        <fieldset disabled={pending} className={styles.fieldset}>
          <PortalSelect
            label="Action"
            onChange={(event) => setAction(event.target.value)}
            value={action}
          >
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </PortalSelect>
          <FounderActionFields
            key={action}
            action={action}
            deliveryOwners={deliveryOwners}
            agreements={agreements}
            currentPriority={currentPriority}
          />
          <PortalButton
            disabled={
              pending ||
              !choices.some((choice) => choice.value === action) ||
              (action === "acknowledge" && !deliveryOwners.length)
            }
            loading={pending}
            type="submit"
          >
            {pending ? "Saving update…" : "Save update"}
          </PortalButton>
        </fieldset>
        <p className={styles.feedback} role="status" aria-atomic="true">
          {message}
        </p>
        {conflict && (
          <PortalButton
            onClick={() => router.refresh()}
            type="button"
            variant="secondary"
          >
            Refresh request details
          </PortalButton>
        )}
      </form>
    </PortalCard>
  );
}
