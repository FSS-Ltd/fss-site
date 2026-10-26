"use client";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormFieldError } from "./form-validation";
import styles from "./crm.module.css";
export function FormField({
  label,
  help,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string }) {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  const error = useFormFieldError(props.name);
  const describedBy =
    [
      props["aria-describedby"],
      help ? `${inputId}-help` : undefined,
      error ? `${inputId}-error` : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : props["aria-invalid"]}
      />
      {help && <small id={`${inputId}-help`}>{help}</small>}
      {error && (
        <small id={`${inputId}-error`} className={styles.fieldError}>
          {error}
        </small>
      )}
    </div>
  );
}
export function TextField({
  label,
  name,
  defaultValue,
  maxLength = 3000,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  maxLength?: number;
}) {
  const id = useId();
  const error = useFormFieldError(name);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        name={name}
        defaultValue={defaultValue}
        rows={3}
        required
        maxLength={maxLength}
      />
      {error && (
        <small id={`${id}-error`} className={styles.fieldError}>
          {error}
        </small>
      )}
    </div>
  );
}
export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className={styles.fields}>{children}</div>;
}
