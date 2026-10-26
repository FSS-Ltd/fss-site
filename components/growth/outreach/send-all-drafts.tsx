"use client";

import { useState } from "react";
import type { OutreachDraftRow } from "@/lib/growth/dashboard/outreach-drafts";
import { SendAllDialog } from "./send-all-dialog";
import styles from "./outreach.module.css";

export function SendAllDrafts({
  rows,
}: {
  rows: readonly OutreachDraftRow[];
}): React.JSX.Element {
  const [drafts, setDrafts] = useState<readonly OutreachDraftRow[] | null>(
    null,
  );
  return (
    <>
      <button
        className={styles.actionButton}
        data-variant="primary"
        type="button"
        aria-haspopup="dialog"
        disabled={rows.length === 0}
        onClick={() => setDrafts([...rows])}
      >
        Send all
      </button>
      {drafts && (
        <SendAllDialog
          rows={drafts}
          onClose={(attempted) => {
            setDrafts(null);
            if (attempted) window.location.reload();
          }}
        />
      )}
    </>
  );
}
