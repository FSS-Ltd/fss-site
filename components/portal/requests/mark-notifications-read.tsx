"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./requests.module.css";

export function MarkNotificationsRead({
  organisationId,
  ids,
}: {
  organisationId: string;
  ids: string[];
}): React.JSX.Element {
  const router = useRouter();
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
      router.refresh();
    } catch {
      setError("We could not connect. Try again.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className={styles.secondary}
        onClick={() => void markRead()}
        disabled={pending || ids.length === 0}
      >
        {pending
          ? "Marking read…"
          : `Mark ${ids.length} notification${ids.length === 1 ? "" : "s"} as read`}
      </button>
      <p className={styles.note} role="status">
        {error}
      </p>
    </div>
  );
}
