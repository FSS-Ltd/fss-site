import { useId, type TextareaHTMLAttributes } from "react";
import styles from "./portal-ui.module.css";

export type PortalTextareaProps = Readonly<
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    error?: string;
    hint?: string;
    label: string;
  }
>;

export function PortalTextarea({
  className,
  error,
  hint,
  id,
  label,
  required,
  "aria-describedby": describedBy,
  ...props
}: PortalTextareaProps): React.JSX.Element {
  const generatedId = useId();
  const textareaId = id ?? `portal-textarea-${generatedId}`;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const ariaDescribedBy = [describedBy, hintId, errorId]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    )
    .join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={textareaId}>
        {label}
        {required ? <span className={styles.required}> *</span> : null}
      </label>
      <textarea
        {...props}
        aria-describedby={ariaDescribedBy || undefined}
        aria-invalid={error ? true : props["aria-invalid"]}
        className={[styles.textarea, className].filter(Boolean).join(" ")}
        id={textareaId}
        required={required}
      />
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
