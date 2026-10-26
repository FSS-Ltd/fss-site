import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./crm.module.css";
export function FormField({
  label,
  help,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string }) {
  const generatedId = useId();
  const inputId = props.id ?? generatedId;
  const describedBy =
    [props["aria-describedby"], help ? `${inputId}-help` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <input {...props} id={inputId} aria-describedby={describedBy} />
      {help && <small id={`${inputId}-help`}>{help}</small>}
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
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        rows={3}
        required
        maxLength={maxLength}
      />
    </div>
  );
}
export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className={styles.fields}>{children}</div>;
}
