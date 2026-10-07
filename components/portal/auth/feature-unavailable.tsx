import {
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";
import styles from "./recovery.module.css";

const features = {
  agreements: {
    title: "Your agreements",
    heading: "Signing is not available yet",
    description:
      "FSS needs to enable electronic signing before agreements can be shared here. You do not need to sign anything until your agreement is ready.",
  },
  onboarding: {
    title: "Getting started",
    heading: "Your setup journey is not available yet",
    description:
      "FSS will make your setup steps available here when they are ready. You can continue using the rest of your workspace.",
  },
  billing: {
    title: "Billing",
    heading: "Online billing is not available yet",
    description:
      "Online invoices and payment settings are not enabled. Contact FSS if you need an invoice or help with a payment.",
  },
} as const;

export function PortalFeatureUnavailable({
  feature,
  organisationId,
}: Readonly<{
  feature: keyof typeof features;
  organisationId: string;
}>): React.JSX.Element {
  const content = features[feature];
  const query = new URLSearchParams({ organisationId });
  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Client workspace" title={content.title} />
      <PortalCard title={content.heading} description={content.description}>
        <div className={styles.actions}>
          <PortalActionLink
            href={`${portalPath("/portal")}?${query}`}
            variant="secondary"
          >
            Back to workspace
          </PortalActionLink>
          <PortalActionLink
            href={`${portalPath("/portal/help")}?${query}`}
            variant="quiet"
          >
            Get help
          </PortalActionLink>
        </div>
      </PortalCard>
    </div>
  );
}
