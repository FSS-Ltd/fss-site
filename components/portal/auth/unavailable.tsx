import { Notice, PageHeader, PortalActionLink } from "@/components/portal/ui";

export function PortalUnavailable({
  reference,
  retryHref,
}: {
  reference?: string;
  retryHref?: string;
}): React.JSX.Element {
  return (
    <div>
      <PageHeader
        description="Your work is safe. Try again in a moment."
        eyebrow="Client portal"
        title="We couldn’t load your workspace"
      />
      <Notice tone="error">
        The portal is temporarily unavailable. If this continues, contact FSS
        {reference ? ` with reference ${reference}.` : "."}
      </Notice>
      {retryHref ? (
        <PortalActionLink href={retryHref}>Try again</PortalActionLink>
      ) : null}
    </div>
  );
}
