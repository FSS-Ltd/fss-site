import { useId, type InputHTMLAttributes } from "react";
import styles from "./agreements.module.css";
export type FieldIssues = { path: string; message: string }[];
export function Field({
  label,
  name,
  issues,
  multiline,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  issues: FieldIssues;
  multiline?: boolean;
}): React.JSX.Element {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const message = issues
    .filter((i) => i.path === name || i.path.startsWith(`${name}.`))
    .map((i) => i.message)
    .join(" ");
  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      {multiline ? (
        <textarea
          id={inputId}
          name={name}
          defaultValue={props.defaultValue}
          required={props.required}
          maxLength={4000}
          aria-invalid={!!message}
          aria-describedby={message ? errorId : undefined}
        />
      ) : (
        <input
          {...props}
          id={inputId}
          name={name}
          aria-invalid={!!message}
          aria-describedby={message ? errorId : undefined}
        />
      )}
      {message && (
        <span id={errorId} className={styles.error}>
          {message}
        </span>
      )}
    </div>
  );
}
export function value(data: FormData, name: string): string {
  return String(data.get(name) ?? "").trim();
}
export function emails(data: FormData, name: string): string[] {
  return value(data, name)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
