import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createDeclineToken } from "../auth/decline-token";
import {
  createPortalInvitationMetadata,
  createStaffInvitationMetadata,
} from "../auth/clerk-invitation";
import { PortalAccessConflict } from "../auth/operator";
import { failPendingPortalInvitation } from "../auth/pending-invitations";
import {
  provisionPortalAccount,
  revokePendingClerkInvitationById,
} from "../auth/provision";
import { createInvitationActivationUrl } from "../auth/portal-url";
import { failStaffInvitation } from "../auth/staff-invitations";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import { PortalAccessDenied, type VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb } from "../db/client";
import { hasStudioFounderCapability } from "./access-capability";

export const resendInvitationSchema = z.strictObject({
  action: z.literal("resend_invitation"),
  invitationId: z.uuid(),
  kind: z.enum(["client", "staff"]),
  reviewReference: z.string().trim().min(1).max(200),
});

export type ResendInvitationInput = z.infer<typeof resendInvitationSchema>;

type InvitationRecipient = Readonly<{
  invitationName: string;
  invitationEmail: string;
}>;

function isUnavailable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P0002"
  );
}

/** The row ID, not browser-supplied recipient details, selects the reviewed resend. */
export async function resendStudioInvitation(
  db: OperationsDb,
  admin: FssAdminContext,
  identity: VerifiedPortalIdentity | null | undefined,
  raw: unknown,
  origin: string,
  provision: typeof provisionPortalAccount = provisionPortalAccount,
  revokeProvider: typeof revokePendingClerkInvitationById = revokePendingClerkInvitationById,
): Promise<void> {
  const input = resendInvitationSchema.parse(raw);
  const founder = hasStudioFounderCapability(admin, identity);
  if (input.kind === "staff" && !founder) throw new PortalAccessDenied();

  const invitationId = randomUUID();
  const correlationId = randomUUID();
  const decline = input.kind === "client" ? createDeclineToken() : null;
  let recipient: InvitationRecipient;
  try {
    recipient = await withFssAdminTransaction(db, admin, async (tx) => {
      if (input.kind === "client") {
        const [scope] = await tx<{ organisationId: string | null }[]>`
          select coalesce(target_organisation_id, organisation_id) as "organisationId"
          from operations.pending_portal_invitations
          where id = ${input.invitationId}
        `;
        if (!scope)
          throw new PortalAccessConflict(
            "Invitation unavailable. Refresh and try again.",
          );
        if (!scope.organisationId && !founder) throw new PortalAccessDenied();
        const [row] = await tx<InvitationRecipient[]>`
          select invitation_name as "invitationName", invitation_email as "invitationEmail"
          from operations.resend_portal_invitation(
            ${input.invitationId}, ${invitationId}, ${input.reviewReference},
            ${correlationId}, ${decline?.hash ?? null}
          )
        `;
        if (!row)
          throw new PortalAccessConflict(
            "Invitation unavailable. Refresh and try again.",
          );
        return row;
      }
      const [row] = await tx<InvitationRecipient[]>`
        select invitation_name as "invitationName", invitation_email as "invitationEmail"
        from operations.resend_staff_invitation(
          ${input.invitationId}, ${invitationId}, ${input.reviewReference}, ${correlationId}
        )
      `;
      if (!row)
        throw new PortalAccessConflict(
          "Invitation unavailable. Refresh and try again.",
        );
      return row;
    });
  } catch (error) {
    if (isUnavailable(error))
      throw new PortalAccessConflict(
        "Invitation changed. Refresh and try again.",
      );
    throw error;
  }

  try {
    await revokeProvider(
      recipient.invitationEmail,
      input.invitationId,
      input.kind === "staff" ? "staff" : "portal",
    );
    const activationUrl = createInvitationActivationUrl(
      origin,
      recipient.invitationName,
      recipient.invitationEmail,
      decline?.token,
    );
    await provision(
      recipient.invitationEmail,
      activationUrl.href,
      input.kind === "staff"
        ? createStaffInvitationMetadata({
            invitationId,
            email: recipient.invitationEmail,
          })
        : createPortalInvitationMetadata({
            invitationId,
            email: recipient.invitationEmail,
          }),
    );
  } catch (error) {
    if (input.kind === "staff")
      await failStaffInvitation(
        db,
        { actorId: admin.actorId },
        invitationId,
        correlationId,
      );
    else
      await failPendingPortalInvitation(
        db,
        { actorId: admin.actorId },
        invitationId,
        correlationId,
      );
    throw error;
  }
}
