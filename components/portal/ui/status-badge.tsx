import styles from "./portal-ui.module.css";

export type PortalStatus = "neutral" | "info" | "success" | "warning" | "error";

export type StatusBadgeProps = Readonly<{
  status: PortalStatus;
  children: React.ReactNode;
}>;

const statusLabels: Record<PortalStatus, string> = {
  neutral: "Status",
  info: "Information",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

const statusClassNames: Record<PortalStatus, string> = {
  neutral: styles.statusNeutral,
  info: styles.statusInfo,
  success: styles.statusSuccess,
  warning: styles.statusWarning,
  error: styles.statusError,
};

export function StatusBadge({
  children,
  status,
}: StatusBadgeProps): React.JSX.Element {
  return (
    <span className={`${styles.statusBadge} ${statusClassNames[status]}`}>
      <span className={styles.statusLabel}>{statusLabels[status]}</span>
      <span>{children}</span>
    </span>
  );
}
