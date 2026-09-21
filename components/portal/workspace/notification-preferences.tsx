"use client";

import { useState } from "react";
import { Notice, PortalButton, PortalCheckbox } from "@/components/portal/ui";
import styles from "./workspace.module.css";

export function NotificationPreferences({
  organisationId,
  initialRequestEmailEnabled,
}: {
  organisationId: string;
  initialRequestEmailEnabled: boolean;
}): React.JSX.Element {
  const [requestEmailEnabled, setRequestEmailEnabled] = useState(
    initialRequestEmailEnabled,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/portal/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisationId, requestEmailEnabled }),
      });
      if (!response.ok) throw new Error("Preferences could not be saved.");
      setMessage("Notification preferences saved.");
    } catch {
      setError(true);
      setMessage("Preferences could not be saved. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.preferences} onSubmit={save}>
      <PortalCheckbox
        checked={requestEmailEnabled}
        disabled={pending}
        label="Email me when FSS asks for a review or confirms completed work."
        onChange={(event) => setRequestEmailEnabled(event.target.checked)}
      />
      <p className={styles.preferenceCopy}>
        In-app notifications remain available in your workspace. This setting
        controls only the owner’s request email alerts.
      </p>
      <PortalButton loading={pending} type="submit">
        Save preferences
      </PortalButton>
      {message ? (
        <Notice tone={error ? "error" : "success"}>{message}</Notice>
      ) : null}
    </form>
  );
}
