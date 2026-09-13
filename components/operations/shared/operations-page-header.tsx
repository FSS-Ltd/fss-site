import type { ReactNode } from "react";
import styles from "./operations-ui.module.css";

export interface OperationsPageHeaderProps {
  context: string;
  title: string;
  description: string;
  variant?: "default" | "inverse";
  children?: ReactNode;
  action?: ReactNode;
}

export function OperationsPageHeader({
  context,
  title,
  description,
  variant = "default",
  children,
  action,
}: OperationsPageHeaderProps): React.JSX.Element {
  return (
    <header className={styles.header} data-variant={variant}>
      <div className={styles.headerContent}>
        <p className={styles.eyebrow}>{context}</p>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
        {children}
      </div>
      {action ? <div className={styles.headerActions}>{action}</div> : null}
    </header>
  );
}
