import styles from "./portal-ui.module.css";

export type PortalCardProps = Readonly<{
  children: React.ReactNode;
  className?: string;
  description?: string;
  title?: string;
  tone?: "default" | "accent" | "dark";
}>;

const toneClassNames: Record<NonNullable<PortalCardProps["tone"]>, string> = {
  default: styles.cardDefault,
  accent: styles.cardAccent,
  dark: styles.cardDark,
};

export function PortalCard({
  children,
  className,
  description,
  title,
  tone = "default",
}: PortalCardProps): React.JSX.Element {
  const classNames = [styles.card, toneClassNames[tone], className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classNames}>
      {title ? <h2 className={styles.cardTitle}>{title}</h2> : null}
      {description ? <p className={styles.cardDescription}>{description}</p> : null}
      <div className={styles.cardContent}>{children}</div>
    </section>
  );
}
