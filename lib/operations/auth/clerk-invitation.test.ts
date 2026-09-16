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

test("creates organisation-free metadata for a pending client invitation", () => {
  const pending = createPortalInvitationMetadata({
    invitationId: "12d347ee-3aa5-4ed1-a93e-9c3a8fd36607",
    email: " Client@Example.test ",
  });

  assert.deepEqual(pending, {
    version: 2,
    invitationId: "12d347ee-3aa5-4ed1-a93e-9c3a8fd36607",
    email: "client@example.test",
  });
  assert.equal("organisationId" in pending, false);
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
  const claim = readPortalInvitationClaim(user);
  assert.equal(claim?.invitation.version, 1);
  assert.equal(
    claim?.invitation.version === 1 ? claim.invitation.role : null,
    "viewer",
  );
});

test("reads staff Admin metadata without treating it as a client role", () => {
  const invitation = {
    version: 3,
    realm: "staff",
    role: "admin",
    invitationId: "12d347ee-3aa5-4ed1-a93e-9c3a8fd36607",
    email: "admin@example.test",
  };
  const user = {
    id: "user_staffAdmin",
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      {
        id: "email_primary",
        emailAddress: invitation.email,
        verification: { status: "verified" },
      },
    ],
    publicMetadata: { fssPortalInvitation: invitation },
  };
  assert.deepEqual(readPortalInvitationClaim(user)?.invitation, invitation);
  assert.equal(
    readPortalInvitationClaim({
      ...user,
      publicMetadata: {
        fssPortalInvitation: { ...invitation, realm: "client" },
      },
    }),
    null,
  );
  assert.equal(
    readPortalInvitationClaim({
      ...user,
      emailAddresses: [
        { ...user.emailAddresses[0], emailAddress: "other@example.test" },
      ],
    }),
    null,
  );
  assert.equal(
    readPortalInvitationClaim({
      ...user,
      emailAddresses: [
        { ...user.emailAddresses[0], verification: { status: "unverified" } },
      ],
    }),
    null,
  );
});

test("version 2 client metadata remains readable", () => {
  const invitation = {
    version: 2,
    invitationId: "12d347ee-3aa5-4ed1-a93e-9c3a8fd36607",
    email: "client@example.test",
  };
  assert.deepEqual(
    readPortalInvitationClaim({
      id: "user_clientExample",
      primaryEmailAddressId: "email_primary",
      emailAddresses: [
        {
          id: "email_primary",
          emailAddress: invitation.email,
          verification: { status: "verified" },
        },
      ],
      publicMetadata: { fssPortalInvitation: invitation },
    })?.invitation,
    invitation,
  );
});

test("client metadata creation cannot be coerced into a staff invitation", () => {
  assert.throws(() =>
    Reflect.apply(createPortalInvitationMetadata, undefined, [
      {
        version: 3,
        realm: "staff",
        role: "admin",
        invitationId: "12d347ee-3aa5-4ed1-a93e-9c3a8fd36607",
        email: "admin@example.test",
      },
    ]),
  );
});
