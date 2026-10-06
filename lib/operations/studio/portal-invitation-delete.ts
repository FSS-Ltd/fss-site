import { randomUUID } from "node:crypto";
import type { FssAdminContext } from "../auth/staff-types";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import { PortalAccessConflict } from "../auth/operator";
import { revokePendingClerkInvitationById } from "../auth/provision";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { OperationsDb } from "../db/client";
import { hasStudioFounderCapability } from "./access-capability";

export type DeleteInvitationInput = Readonly<{
  invitationId: string;
  kind: "client" | "staff" | "legacy";
  reviewReference: string;
}>;

function isUnavailable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P0002"
  );
}

export async function deleteStudioInvitation(
  db: OperationsDb,
  admin: FssAdminContext,
  identity: VerifiedPortalIdentity | null | undefined,
  input: DeleteInvitationInput,
  revokeProvider: typeof revokePendingClerkInvitationById = revokePendingClerkInvitationById,
): Promise<void> {
  const founder = hasStudioFounderCapability(admin, identity);
  if (input.kind === "staff" && !founder) throw new PortalAccessDenied();
  const correlationId = randomUUID();
  let email: string;
  try {
    email = await withFssAdminTransaction(db, admin, async (tx) => {
      if (input.kind === "client" && !founder) {
        const [scope] = await tx<{ organisationId: string | null }[]>`
          select coalesce(target_organisation_id, organisation_id) as "organisationId"
          from operations.pending_portal_invitations
          where id = ${input.invitationId}
        `;
        if (!scope?.organisationId) throw new PortalAccessDenied();
      }
      const [row] = await tx<{ invitationEmail: string }[]>`
        select invitation_email as "invitationEmail"
        from operations.prepare_access_invitation_delete(
          ${input.kind}, ${input.invitationId}, ${input.reviewReference}, ${correlationId}
        )
      `;
      if (!row)
        throw new PortalAccessConflict(
          "Invitation unavailable. Refresh and try again.",
        );
      return row.invitationEmail;
    });
  } catch (error) {
    if (isUnavailable(error))
      throw new PortalAccessConflict(
        "Invitation unavailable. Refresh and try again.",
      );
    throw error;
  }
  if (input.kind === "legacy") {
    throw new PortalAccessConflict(
      "The old invitation was revoked locally, but its provider invitation cannot be identified safely. Keep this row for review.",
    );
  }
  await revokeProvider(
    email,
    input.invitationId,
    input.kind === "staff" ? "staff" : "portal",
  );
  try {
    await withFssAdminTransaction(db, admin, async (tx) => {
      await tx`select operations.finish_access_invitation_delete(
        ${input.kind}, ${input.invitationId}, ${input.reviewReference}, ${correlationId}
      )`;
    });
  } catch (error) {
    if (isUnavailable(error))
      throw new PortalAccessConflict(
        "Invitation changed. Refresh and try again.",
      );
    throw error;
  }
}
