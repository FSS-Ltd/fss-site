import { getPortalRolePresentation } from "@/lib/operations/auth/permissions";
import type { ProposalApprovalSnapshot } from "@/lib/operations/onboarding/types";

export function ProposalAccessPreview({
  access,
}: {
  access: ProposalApprovalSnapshot["access"];
}): React.JSX.Element {
  return (
    <ul>
      {access.map((recipient) => {
        const role = getPortalRolePresentation(recipient.role);
        return (
          <li key={recipient.email}>
            {recipient.email}: {role.label}. {role.detail}
          </li>
        );
      })}
    </ul>
  );
}
