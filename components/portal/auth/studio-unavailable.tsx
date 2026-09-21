import { Notice, PageHeader } from "@/components/portal/ui";

/**
 * Acknowledges an authenticated staff member while the separately-gated
 * Studio workspace is not enabled in the current deployment.
 */
export function StudioUnavailable(): React.JSX.Element {
  return (
    <div>
      <PageHeader
        description="Your staff account is active. FSS Studio will appear here once it is enabled for this deployment."
        eyebrow="FSS Studio"
        title="Your access is ready"
      />
      <Notice tone="info">
        No further action is needed. Contact the FSS team if you expected Studio
        to be available now.
      </Notice>
    </div>
  );
}
