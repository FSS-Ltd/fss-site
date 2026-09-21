import { useId, type InputHTMLAttributes } from "react";
import styles from "./portal-ui.module.css";

export type PortalCheckboxProps = Readonly<
  Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "type"> & {
    label: React.ReactNode;
    hint?: string;
  }
>;

export function PortalCheckbox({
  className,
  hint,
  id,
  label,
  ...props
}: PortalCheckboxProps): React.JSX.Element {
  const generatedId = useId();
  const checkboxId = id ?? `portal-checkbox-${generatedId}`;
  const hintId = hint ? `${checkboxId}-hint` : undefined;

  return (
    <div className={styles.checkboxField}>
      <label className={styles.checkboxLabel} htmlFor={checkboxId}>
        <input
          {...props}
          aria-describedby={hintId}
          className={[styles.checkboxInput, className].filter(Boolean).join(" ")}
          id={checkboxId}
          type="checkbox"
        />
        <span>{label}</span>
      </label>
      {hint ? <p className={styles.hint} id={hintId}>{hint}</p> : null}
    </div>
  );
}
