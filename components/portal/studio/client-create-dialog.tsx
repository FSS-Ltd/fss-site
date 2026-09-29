"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { PortalButton } from "@/components/portal/ui";
import { StudioClientForm } from "./client-form";
import styles from "./client-create-dialog.module.css";

export function ClientCreateDialog(): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dirty, setDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function close(): void {
    if (dirty && !window.confirm("Discard the client details you entered?"))
      return;
    dialogRef.current?.close();
  }

  function reset(): void {
    setDirty(false);
    setFormKey((key) => key + 1);
  }

  return (
    <>
      <PortalButton
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        <Plus aria-hidden="true" size={17} /> Add client
      </PortalButton>
      <dialog
        aria-labelledby="client-create-title"
        aria-describedby="client-create-description"
        className={styles.dialog}
        onCancel={(event) => {
          if (
            dirty &&
            !window.confirm("Discard the client details you entered?")
          ) {
            event.preventDefault();
          }
        }}
        onClose={reset}
        ref={dialogRef}
      >
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>FSS Studio · Clients</p>
            <h2 id="client-create-title">Add a client</h2>
            <p id="client-create-description">
              Record the organisation and its main contact. Portal access is set
              up separately.
            </p>
          </div>
          <button
            aria-label="Close add client"
            className={styles.close}
            onClick={close}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className={styles.body} onInput={() => setDirty(true)}>
          <StudioClientForm embedded key={formKey} onCancel={close} />
        </div>
      </dialog>
    </>
  );
}
