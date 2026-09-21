import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalCard,
} from "@/components/portal/ui";

export function InvitationExpired({
  loginHref,
}: {
  loginHref: string;
}): React.JSX.Element {
  return (
    <div>
      <PageHeader
        description="This invitation can no longer be used to activate access."
        eyebrow="FSS invitation"
        title="This invitation has expired"
      />
      <Notice tone="warning">
        A fresh invitation is needed. Request another invitation from FSS.
        Signing in alone does not activate workspace access.
      </Notice>
      <PortalActionLink href="mailto:hello@faithfulsoftware.dev?subject=Portal%20invitation">
        Request a new invitation
      </PortalActionLink>
      <PortalCard
        description="Use your verified email to see any memberships already linked to your account."
        title="Already have access?"
      >
        <PortalActionLink href={loginHref} variant="secondary">
          Sign in with your existing account
        </PortalActionLink>
      </PortalCard>
    </div>
  );
}
