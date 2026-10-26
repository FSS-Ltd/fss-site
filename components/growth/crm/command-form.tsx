"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CrmCommand, CrmCommandResult } from "@/lib/growth/crm/schemas";
import { useCrmCommand } from "./use-crm-command";
import styles from "./crm.module.css";

export function CommandForm({
  label,
  submitLabel,
  buildCommand,
  children,
  onSuccess,
}: {
  label: string;
  submitLabel: string;
  buildCommand: (data: FormData) => CrmCommand;
  children: ReactNode;
  onSuccess?: (result: CrmCommandResult, form: HTMLFormElement) => void;
}) {
  const { busy, saving, feedback, run, report } = useCrmCommand();
  const router = useRouter();
  return (
    <form
      aria-label={label}
      aria-busy={busy}
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        let command: CrmCommand;
        try {
          command = buildCommand(new FormData(form));
        } catch (error) {
          report(
            error instanceof Error ? error.message : "Check the form fields.",
          );
          return;
        }
        const result = await run(command);
        if (result) onSuccess?.(result, form);
      }}
    >
      <fieldset disabled={busy} className={styles.fieldset}>
        {children}
        <button type="submit" className={styles.primary}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </fieldset>
      {feedback && (
        <div
          role={feedback.error ? "alert" : "status"}
          className={feedback.error ? styles.error : styles.success}
        >
          <p>{feedback.message}</p>
          {feedback.href && (
            <Link href={feedback.href}>Open existing record</Link>
          )}
          {feedback.error && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => router.refresh()}
            >
              Refresh record
            </button>
          )}
        </div>
      )}
    </form>
  );
}
export function CommandButton({
  command,
  label,
  confirm,
}: {
  command: CrmCommand;
  label: string;
  confirm?: string;
}) {
  const { busy, saving, feedback, run } = useCrmCommand();
  const router = useRouter();
  return (
    <div className={styles.command}>
      <button
        type="button"
        className={styles.secondary}
        disabled={busy}
        onClick={() => {
          if (!confirm || window.confirm(confirm)) void run(command);
        }}
      >
        {saving ? "Saving…" : label}
      </button>
      {feedback && (
        <p
          role={feedback.error ? "alert" : "status"}
          className={feedback.error ? styles.error : styles.success}
        >
          {feedback.message}
          {feedback.error && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => router.refresh()}
            >
              Refresh record
            </button>
          )}
        </p>
      )}
    </div>
  );
}
