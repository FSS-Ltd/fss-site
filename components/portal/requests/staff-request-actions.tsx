"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Notice,
  PortalButton,
  PortalCard,
  PortalSelect,
} from "@/components/portal/ui";
import type {
  ClientRequestDetail,
  RequestPriority,
} from "@/lib/operations/requests/types";
import {
  founderRequestCommandSchema,
  type FounderRequestCommand,
} from "@/lib/operations/requests/validation";
import {
  requestActionErrorSchema,
  requestActionResponseSchema,
  type ActionResult,
} from "./actions";
import { FounderActionFields } from "./founder-action-fields";
import styles from "./requests.module.css";

const transitions: Record<string, Array<{ value: string; label: string }>> = {
  new: [{ value: "acknowledge", label: "Acknowledge request" }],
  acknowledged: [{ value: "plan", label: "Plan work" }],
  planned: [{ value: "start", label: "Start work" }],
  in_progress: [{ value: "review", label: "Prepare review package" }],
  ready_for_review: [],
  changes_requested: [{ value: "revise", label: "Assess requested changes" }],
  done: [{ value: "reopen", label: "Reopen request" }],
  cancelled: [],
};

const composerActions = [
  { value: "public_update", label: "Public update" },
  { value: "internal_note", label: "Internal note" },
];

function actionTitle(action: string): string {
  if (action === "review") return "Review package";
  if (action === "classify_scope" || action === "revise") return "Assessment";
  if (action === "public_update") return "Public update";
  if (action === "internal_note") return "Internal note";
  return "Delivery controls";
}

// FSS Admin variant of FounderRequestActions: identical command validation is
// posted to the staff API after a server-side staff recheck.
export function StaffRequestActions({
  request,
  organisationId,
  deliveryOwners,
  agreements = [],
  currentPriority = "normal",
  initialAction,
}: {
  request: ClientRequestDetail;
  organisationId: string;
  deliveryOwners: Array<{ id: string; label: string }>;
  agreements?: Array<{ id: string; label: string }>;
  currentPriority?: RequestPriority;
  initialAction?: string;
}): React.JSX.Element {
  const router = useRouter();
  const locked = useRef(false);
  const closed = request.status === "done" || request.status === "cancelled";
  const choices = [
    ...composerActions,
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
  const defaultAction = choices.some((choice) => choice.value === initialAction)
    ? initialAction!
    : "public_update";
  const [action, setAction] = useState(defaultAction);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const documentIds = formData
      .getAll("documentIds")
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      );
    const fields = Object.fromEntries(formData);
    delete fields.documentIds;
    const commandAction =
      action === "public_update" || action === "internal_note"
        ? "comment"
        : action;
    const parsed = founderRequestCommandSchema.safeParse({
      requestId: request.id,
      expectedVersion: request.version,
      ...(commandAction === "block"
        ? { action: "block", blocked: fields }
        : commandAction === "unblock"
          ? { action: "block", blocked: null }
          : {
              action: commandAction,
              ...fields,
              ...(commandAction === "comment"
                ? {
                    visibility:
                      action === "public_update" ? "client" : "internal",
                  }
                : {}),
              ...(commandAction === "review" ? { documentIds } : {}),
            }),
      ...(commandAction === "plan"
        ? {
            targetDate: fields.targetDate || null,
            agreementId: fields.agreementId || null,
          }
        : {}),
      ...(commandAction === "classify_scope"
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
      const { requestId, ...command } = parsed.data;
      const response = await fetch(
        `/api/portal/admin/clients/${encodeURIComponent(organisationId)}/requests/${encodeURIComponent(requestId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        },
      );
      const body: unknown = await response.json().catch(() => null);
      let result: ActionResult;
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
      if (!result.ok) {
        setMessage(result.error);
        setConflict(result.conflict);
        return;
      }
      setMessage("Request updated.");
      form.reset();
      setAction("public_update");
      router.refresh();
    } catch {
      setMessage("We could not connect. Your draft is still here. Try again.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  return (
    <PortalCard title={actionTitle(action)}>
      <form onSubmit={submit} className={styles.form} aria-busy={pending}>
        <fieldset disabled={pending} className={styles.fieldset}>
          <PortalSelect
            label="Choose work"
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
            documents={request.documents.map((document) => ({
              id: document.id,
              label: document.title,
            }))}
            agreements={agreements}
            currentPriority={currentPriority}
          />
          {action === "review" ? (
            <Notice tone="info">
              Publishing creates the review cycle and its configured client
              notification. A notification delivery failure does not undo a
              successful publication.
            </Notice>
          ) : null}
          {action === "public_update" ? (
            <Notice tone="info">
              Public updates appear in the client portal. Internal notes stay
              within founder operations.
            </Notice>
          ) : null}
          <PortalButton
            disabled={
              pending ||
              !choices.some((choice) => choice.value === action) ||
              (action === "acknowledge" && !deliveryOwners.length) ||
              (action === "review" && !request.documents.length)
            }
            loading={pending}
            type="submit"
          >
            {action === "review"
              ? "Publish review"
              : action === "classify_scope" || action === "revise"
                ? "Save assessment"
                : action === "public_update"
                  ? "Post public update"
                  : action === "internal_note"
                    ? "Save internal note"
                    : "Save update"}
          </PortalButton>
        </fieldset>
        <p className={styles.feedback} role="status" aria-atomic="true">
          {message}
        </p>
        {conflict ? (
          <PortalButton
            onClick={() => router.refresh()}
            type="button"
            variant="secondary"
          >
            Refresh request details
          </PortalButton>
        ) : null}
      </form>
    </PortalCard>
  );
}

export type { FounderRequestCommand };
