import { Notice, PortalActionLink } from "@/components/portal/ui";
import { portalPath } from "@/lib/operations/auth/portal-url";

function organisationHref(pathname: string, organisationId: string): string {
  return `${portalPath(pathname)}?${new URLSearchParams({ organisationId }).toString()}`;
}

export function ViewerAccessNotice({
  organisationId,
}: {
  organisationId: string;
}): React.JSX.Element {
  return (
    <Notice
      action={
        <div>
          <PortalActionLink
            href={organisationHref("/portal/projects", organisationId)}
            variant="secondary"
          >
            View projects
          </PortalActionLink>
          <PortalActionLink
            href={organisationHref("/portal/help", organisationId)}
            variant="secondary"
          >
            Get access help
          </PortalActionLink>
        </div>
      }
      tone="info"
    >
      You have read-only access. You can view shared projects and public
      updates. Request a role change from FSS if you need to contribute or
      accept work.
    </Notice>
  );
}
