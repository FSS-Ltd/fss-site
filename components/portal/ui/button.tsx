import { useId, type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import styles from "./portal-ui.module.css";

export type PortalButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "destructive";

export type PortalButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: PortalButtonVariant;
    loading?: boolean;
    disabledReason?: string;
  }
>;

const variantClassNames: Record<PortalButtonVariant, string> = {
  primary: styles.buttonPrimary,
  secondary: styles.buttonSecondary,
  quiet: styles.buttonQuiet,
  destructive: styles.buttonDestructive,
};

export function PortalButton({
  children,
  className,
  disabled,
  disabledReason,
  loading = false,
  variant = "primary",
  ...props
}: PortalButtonProps): React.JSX.Element {
  const disabledReasonId = useId();
  const isDisabled = Boolean(disabled) || loading;
  const describedBy = [
    props["aria-describedby"],
    isDisabled && disabledReason ? disabledReasonId : undefined,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");

  return (
    <span className={styles.buttonGroup}>
      <button
        {...props}
        aria-busy={loading || undefined}
        aria-describedby={describedBy || undefined}
        className={[styles.button, variantClassNames[variant], className]
          .filter(Boolean)
          .join(" ")}
        disabled={isDisabled}
      >
        {children}
        {loading ? (
          <>
            <LoaderCircle aria-hidden="true" className={styles.buttonLoader} size={16} />
            <span className={styles.visuallyHidden}>Loading</span>
          </>
        ) : null}
      </button>
      {isDisabled && disabledReason ? (
        <span id={disabledReasonId} className={styles.buttonReason}>
          {disabledReason}
        </span>
      ) : null}
    </span>
  );
}
