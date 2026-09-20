import styles from "./portal-ui.module.css";

export type PortalBreadcrumb = Readonly<{
  label: string;
  href?: string;
}>;

export type PageHeaderProps = Readonly<{
  title: string;
  description?: string;
  eyebrow?: string;
  breadcrumbs?: readonly PortalBreadcrumb[];
  action?: React.ReactNode;
}>;

export function PageHeader({
  action,
  breadcrumbs,
  description,
  eyebrow,
  title,
}: PageHeaderProps): React.JSX.Element {
  return (
    <header className={styles.pageHeader}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol className={styles.breadcrumbList}>
            {breadcrumbs.map((breadcrumb) => (
              <li key={`${breadcrumb.label}-${breadcrumb.href ?? "current"}`}>
                {breadcrumb.href ? (
                  <a href={breadcrumb.href} className={styles.breadcrumbLink}>
                    {breadcrumb.label}
                  </a>
                ) : (
                  <span aria-current="page">{breadcrumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className={styles.headerContent}>
        <div>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {action ? <div className={styles.headerAction}>{action}</div> : null}
      </div>
    </header>
  );
}
