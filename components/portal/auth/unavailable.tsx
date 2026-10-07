import { Notice, PageHeader, PortalActionLink } from "@/components/portal/ui";

import { portalPath } from "@/lib/operations/auth/portal-url";
import styles from "./recovery.module.css";

export function PortalUnavailable({
  reference,
  retryHref,
}: {
  reference?: string;
  retryHref?: string;
}): React.JSX.Element {
  return (
    <div className={styles.page}>
      <PageHeader
        description="Try again, or return to your workspace to continue."
        eyebrow="Client portal"
        title="We couldn’t load this page"
      />
      <Notice tone="error">
        This page could not be loaded. If this continues, contact FSS
        {reference ? ` with reference ${reference}.` : "."}
      </Notice>
      <div className={styles.actions}>
        {retryHref ? (
          <PortalActionLink href={retryHref}>Try again</PortalActionLink>
        ) : (
          <PortalActionLink href={portalPath("/portal")} variant="secondary">
            Back to workspace
          </PortalActionLink>
        )}
        <PortalActionLink href={portalPath("/portal/help")} variant="quiet">
          Get help
        </PortalActionLink>
      </div>
    </div>
  );
}
