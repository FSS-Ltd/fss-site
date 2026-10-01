"use client";

import { useState } from "react";
import {
  Notice,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalField,
  PortalTextarea,
  StatusBadge,
} from "@/components/portal/ui";
import type { CompletedEngagementCommand } from "@/lib/operations/agreements/engagement-service";
import styles from "./agreements.module.css";

type EngagementFormProps = Readonly<{
  agreementHref: string;
  commandEndpoint: string;
  draft: Readonly<{ id: string; version: number }> | null;
  engagementChoices: readonly { id: string; name: string }[];
  onComplete: (result: CompletedEngagementCommand) => void;
  organisationName: string;
}>;

type EngagementCommandResult = CompletedEngagementCommand;

function resultFrom(value: unknown): value is EngagementCommandResult {
  return (
    value !== null &&
    typeof value === "object" &&
    "engagementId" in value &&
    typeof value.engagementId === "string" &&
    "draftId" in value &&
    typeof value.draftId === "string" &&
    "draftVersion" in value &&
    typeof value.draftVersion === "number"
  );
}

export function EngagementForm({
  agreementHref,
  commandEndpoint,
  draft,
  engagementChoices,
  onComplete,
  organisationName,
}: EngagementFormProps): React.JSX.Element {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [commandId, setCommandId] = useState(() => crypto.randomUUID());

  async function submit(
    command: Record<string, unknown>,
    requestId = commandId,
  ): Promise<void> {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(commandEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...command,
          commandId: requestId,
          ...(draft
            ? { draftId: draft.id, expectedVersion: draft.version }
            : {}),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error =
          body !== null &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "We could not save this engagement. Please try again.";
        throw new Error(error);
      }
      if (!resultFrom(body))
        throw new Error(
          "The saved engagement response was incomplete. Please try again.",
        );
      onComplete(body);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save this engagement. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={styles.detail}
      aria-labelledby="engagement-provenance-heading"
    >
      <PortalCard
        description="Record the agreed goal and scope, then confirm your review to make this work available to an agreement."
        title="Create reviewed work"
      >
        <form
          className={styles.engagementForm}
          onChange={() => setCommandId(crypto.randomUUID())}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (!event.currentTarget.reportValidity()) return;
            void submit({
              action: "create",
              name: String(data.get("name") ?? ""),
              primaryGoal: String(data.get("primaryGoal") ?? ""),
              proposedScope: String(data.get("proposedScope") ?? ""),
              reviewReference: String(data.get("reviewReference") ?? ""),
              reviewed: data.get("reviewed") === "on",
            });
          }}
        >
          <div className={styles.fieldGrid}>
            <PortalField label="Client" required>
              <input readOnly value={organisationName} />
            </PortalField>
            <PortalField label="Engagement name" required>
              <input autoComplete="off" maxLength={200} name="name" required />
            </PortalField>
            <PortalTextarea
              label="Primary goal"
              maxLength={4000}
              name="primaryGoal"
              required
              rows={3}
            />
            <PortalTextarea
              label="Proposed scope"
              maxLength={4000}
              name="proposedScope"
              required
              rows={3}
            />
            <PortalField label="Reviewed source or reference" required>
              <input
                autoComplete="off"
                maxLength={200}
                name="reviewReference"
                required
              />
            </PortalField>
          </div>
          <label className={styles.engagementReview}>
            <input name="reviewed" required type="checkbox" />
            <span>
              I have reviewed this work and confirmed the goal and proposed
              scope.
            </span>
          </label>
          {message ? (
            <Notice tone="error">
              <p>{message}</p>
            </Notice>
          ) : null}
          <div className={styles.actionRow}>
            <PortalButton loading={pending} type="submit">
              Create &amp; continue to agreement
            </PortalButton>
            <PortalActionLink href={agreementHref} variant="secondary">
              Cancel and return
            </PortalActionLink>
          </div>
        </form>
      </PortalCard>

      {engagementChoices.length ? (
        <PortalCard
          description="Use reviewed work already linked to this client."
          title="Existing reviewed work"
        >
          <ul className={styles.schedule}>
            {engagementChoices.map((engagement) => (
              <li key={engagement.id}>
                <span>{engagement.name}</span>
                <div className={styles.engagementActions}>
                  <StatusBadge status="success">
                    Reviewed &amp; linked
                  </StatusBadge>
                  <PortalButton
                    disabled={pending}
                    onClick={() => {
                      const nextCommandId = crypto.randomUUID();
                      setCommandId(nextCommandId);
                      void submit(
                        { action: "select", engagementId: engagement.id },
                        nextCommandId,
                      );
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Use this engagement
                  </PortalButton>
                </div>
              </li>
            ))}
          </ul>
        </PortalCard>
      ) : null}
    </section>
  );
}
