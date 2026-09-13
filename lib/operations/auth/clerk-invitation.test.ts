import assert from "node:assert/strict";
import test from "node:test";
import {
  createPortalInvitationMetadata,
  readPortalInvitationClaim,
} from "./clerk-invitation";
import { portalUserIdFromClerkId } from "./verified-user";

const metadata = createPortalInvitationMetadata({
  organisationId: "8aa24c0b-3665-4fd4-8694-500675c943c3",
  name: "Client Example",
  email: "client@example.test",
  role: "viewer",
  reviewReference: "Approved for project updates",
  approvedBy: "a".repeat(64),
});

test("reads Clerk invitation metadata only for the verified invited email", () => {
  const user = {
    id: "user_2zClientExample",
    primary_email_address_id: "email_primary",
    email_addresses: [
      {
        id: "email_primary",
        email_address: "Client@example.test",
        verification: { status: "verified" },
      },
    ],
    public_metadata: { fssPortalInvitation: metadata },
    extra_clerk_field: "accepted",
  };
  assert.deepEqual(readPortalInvitationClaim(user), {
    clerkUserId: user.id,
    identity: {
      userId: portalUserIdFromClerkId(user.id),
      email: "client@example.test",
      emailVerified: true,
    },
    invitation: metadata,
  });
  assert.equal(
    readPortalInvitationClaim({
      ...user,
      email_addresses: [
        {
          ...user.email_addresses[0],
          email_address: "other@example.test",
        },
      ],
    }),
    null,
  );
});

test("accepts Clerk's camelCase user resource shape", () => {
  const user = {
    id: "user_2zClientExample",
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      {
        id: "email_primary",
        emailAddress: "client@example.test",
        verification: { status: "verified" },
      },
    ],
    publicMetadata: { fssPortalInvitation: metadata },
  };
  assert.equal(readPortalInvitationClaim(user)?.invitation.role, "viewer");
});
