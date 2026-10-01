import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
} from "react";
import styles from "./portal-ui.module.css";

export type PortalFieldProps = Readonly<{
  label: string;
  labelVisibility?: "visible" | "hidden";
  children: ReactElement<InputHTMLAttributes<HTMLInputElement>>;
  error?: string;
  hint?: string;
  required?: boolean;
}>;

export function PortalField({
  children,
  error,
  hint,
  label,
  labelVisibility = "visible",
  required = false,
}: PortalFieldProps): React.JSX.Element {
  const generatedId = useId();
  const fieldId = children.props.id ?? `portal-field-${generatedId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId, errorId]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    )
    .join(" ");

  if (
    Children.count(children) !== 1 ||
    !isValidElement(children) ||
    children.type !== "input"
  ) {
    throw new Error("PortalField requires exactly one native input child.");
  }

  return (
    <div className={styles.field}>
      <label
        htmlFor={fieldId}
        className={
          labelVisibility === "hidden" ? styles.visuallyHidden : styles.label
        }
      >
        {label}
        {required ? <span className={styles.required}> *</span> : null}
      </label>
      {cloneElement(children, {
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        className: [styles.input, children.props.className]
          .filter(Boolean)
          .join(" "),
        id: fieldId,
        required: required || children.props.required,
      })}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
