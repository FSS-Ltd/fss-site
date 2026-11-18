"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./facebook.module.css";

export const FacebookAuthFailureContext = createContext<() => void>(() => {});

type Payload = Record<string, unknown>;
export function CommandForm({
  label,
  build,
  onSuccess,
  onConflict,
  children,
}: {
  label: string;
  build: (data: FormData) => Payload;
  onSuccess: (id: string) => void;
  onConflict?: () => void;
  children?: ReactNode;
}) {
  const authFailed = useContext(FacebookAuthFailureContext);
  const retry = useRef<{ payload: string; id: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [duplicate, setDuplicate] = useState<string | null>(null);
  return (
    <form
      className={styles.form}
      data-command={label}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        let payload: Payload;
        try {
          payload = build(new FormData(form));
        } catch {
          setFeedback("Check the dates and required fields.");
          return;
        }
        const serialized = JSON.stringify(payload);
        if (retry.current?.payload !== serialized)
          retry.current = { payload: serialized, id: crypto.randomUUID() };
        const requestId = retry.current.id;
        if (
          payload.type === "capture_source" &&
          typeof payload.source === "object" &&
          payload.source !== null
        )
          payload.source = { ...payload.source, requestId };
        setPending(true);
        setFeedback("");
        setDuplicate(null);
        try {
          const response = await fetch("/api/growth/facebook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, requestId }),
          });
          if (!response.ok) {
            if (response.status === 401) authFailed();
            if (response.status === 409) onConflict?.();
            const location = response.headers.get("location");
            if (location?.startsWith("/growth/prospects/"))
              setDuplicate(location);
            setFeedback(
              response.status === 409
                ? "Record changed or already exists. Review the current record before trying again."
                : response.status === 422
                  ? "Check the entered values and dates."
                  : "Could not save. Your entries are preserved; try again.",
            );
            return;
          }
          const result: { id?: unknown } = await response.json();
          if (typeof result.id !== "string")
            throw new Error("Invalid response");
          retry.current = null;
          setFeedback("Saved.");
          onSuccess(result.id);
        } catch {
          setFeedback("Could not save. Your entries are preserved; try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      {children}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : label}
      </button>
      {feedback && (
        <p role="status">
          {feedback}{" "}
          {duplicate && <a href={duplicate}>Open existing prospect</a>}
        </p>
      )}
    </form>
  );
}
export function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  children?: ReactNode;
}) {
  return (
    <label className={styles.field}>
      {label}
      {children ?? (
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
        />
      )}
    </label>
  );
}
export const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
export const optional = (data: FormData, key: string) =>
  value(data, key) || null;
export const timestamp = (data: FormData, key: string) =>
  new Date(value(data, key)).toISOString();
