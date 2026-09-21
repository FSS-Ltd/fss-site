"use client";

import { useRef, useState } from "react";
import { Notice, PortalButton } from "@/components/portal/ui";

export function MarkNotificationsRead({
  organisationId,
  ids,
}: {
  organisationId: string;
  ids: string[];
}): React.JSX.Element {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function markRead(): Promise<void> {
    if (locked.current || ids.length === 0) return;
    locked.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/portal/notifications/mark-read?organisationId=${encodeURIComponent(organisationId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        },
      );
      if (!response.ok) {
        setError("Notifications could not be marked as read. Try again.");
        return;
      }
      window.location.reload();
    } catch {
      setError("We could not connect. Try again.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return (
    <div>
      <PortalButton
        onClick={() => void markRead()}
        disabled={pending || ids.length === 0}
        loading={pending}
        type="button"
      >
        Mark {ids.length} notification{ids.length === 1 ? "" : "s"} as read
      </PortalButton>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
