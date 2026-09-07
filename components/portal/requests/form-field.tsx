import { useId } from "react";
import styles from "./requests.module.css";

type FieldProps = {
  name: string;
  label: string;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  type?: "text" | "date";
  error?: string;
  hint?: string;
};

export function RequestField({
  name,
  label,
  multiline = false,
  required = false,
  maxLength,
  type = "text",
  error,
  hint,
}: FieldProps): React.JSX.Element {
  const id = useId();
  const props = {
    id,
    name,
    required,
    maxLength,
    className: styles.input,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error || hint ? `${id}-help` : undefined,
  };
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {!required && <span className={styles.optional}> (optional)</span>}
      </label>
      {multiline ? (
        <textarea {...props} rows={4} />
      ) : (
        <input {...props} type={type} />
      )}
      {(error || hint) && (
        <p id={`${id}-help`} className={error ? styles.errorText : styles.note}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
