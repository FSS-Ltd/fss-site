import type { InputHTMLAttributes } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import styles from "./contact-form.module.css";

type ContactFieldProps = {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
} & Pick<InputHTMLAttributes<HTMLInputElement>, "type" | "autoComplete">;

export function ContactField({
  label,
  registration,
  error,
  ...props
}: ContactFieldProps) {
  const id = `contact-${registration.name}`;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        {...registration}
        {...props}
        id={id}
        required
        className={styles.input}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p className={styles.error} id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
