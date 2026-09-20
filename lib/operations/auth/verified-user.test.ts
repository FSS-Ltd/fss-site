import assert from "node:assert/strict";
import test from "node:test";
import {
  portalUserIdFromClerkId,
  readVerifiedPortalUser,
} from "./verified-user";
test("an unverified secondary email does not invalidate the verified primary identity", () => {
  assert.deepEqual(
    readVerifiedPortalUser({
      id: "user_fixture",
      primaryEmailAddressId: "primary",
      emailAddresses: [
        {
          id: "primary",
          emailAddress: "owner@example.test",
          verification: { status: "verified" },
        },
        {
          id: "secondary",
          emailAddress: "other@example.test",
          verification: { status: "unverified" },
        },
      ],
    }),
    {
      userId: portalUserIdFromClerkId("user_fixture"),
      email: "owner@example.test",
      emailVerified: true,
    },
  );
});
test("only server-confirmed nonanonymous email identity crosses the portal boundary", async () => {
  const user = {
    id: "user_2zClientExample",
    primary_email_address_id: "id_primary",
    email_addresses: [
      {
        id: "id_primary",
        email_address: "Client@example.test",
        verification: { status: "verified" },
      },
    ],
  };
  assert.deepEqual(readVerifiedPortalUser(user), {
    userId: portalUserIdFromClerkId(user.id),
    email: "client@example.test",
    emailVerified: true,
  });
  for (const candidate of [
    null,
    {
      ...user,
      email_addresses: [{ ...user.email_addresses[0], verification: null }],
    },
    { ...user, id: "forged" },
    { ...user, primary_email_address_id: null },
  ])
    assert.equal(readVerifiedPortalUser(candidate), null);
});
