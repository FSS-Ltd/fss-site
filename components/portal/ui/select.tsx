import { useId, type SelectHTMLAttributes } from "react";
import styles from "./portal-ui.module.css";

export type PortalSelectProps = Readonly<
  SelectHTMLAttributes<HTMLSelectElement> & {
    error?: string;
    hint?: string;
    label: string;
  }
>;

export function PortalSelect({
  children,
  className,
  error,
  hint,
  id,
  label,
  required,
  "aria-describedby": describedBy,
  ...props
}: PortalSelectProps): React.JSX.Element {
  const generatedId = useId();
  const selectId = id ?? `portal-select-${generatedId}`;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const ariaDescribedBy = [describedBy, hintId, errorId]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
        {required ? <span className={styles.required}> *</span> : null}
      </label>
      <select
        {...props}
        aria-describedby={ariaDescribedBy || undefined}
        aria-invalid={error ? true : props["aria-invalid"]}
        className={[styles.input, className].filter(Boolean).join(" ")}
        id={selectId}
        required={required}
      >
        {children}
      </select>
      {hint ? <p className={styles.hint} id={hintId}>{hint}</p> : null}
      {error ? <p className={styles.error} id={errorId}>{error}</p> : null}
    </div>
  );
}
