import assert from "node:assert/strict";
import test from "node:test";
import { createPortalInvitationMetadata } from "./clerk-invitation";
import { provisionPortalAccount, readPortalProvisionConfig } from "./provision";

test("provisioning requires a dedicated server secret and enabled portal configuration", () => {
  const env = {
    OPERATIONS_ENABLED: "true",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
    CLERK_SECRET_KEY: "sk_test_fixture",
  };
  assert.equal(readPortalProvisionConfig(env).secretKey, "sk_test_fixture");
  assert.throws(() =>
    readPortalProvisionConfig({
      ...env,
      CLERK_SECRET_KEY: "pk_test_fixture",
    }),
  );
  assert.throws(() =>
    readPortalProvisionConfig({ ...env, OPERATIONS_ENABLED: "false" }),
  );
});
test("provisioning creates a Clerk invitation with a fixed activation redirect", async () => {
  const inputs: unknown[] = [];
  const metadata = createPortalInvitationMetadata({
    organisationId: "8aa24c0b-3665-4fd4-8694-500675c943c3",
    name: "Client Example",
    email: "client@example.test",
    role: "viewer",
    reviewReference: "Fixture approval",
    approvedBy: "a".repeat(64),
  });
  await provisionPortalAccount(
    "Client@example.test",
    "https://portal.example.test/portal/activate",
    metadata,
    async (input) => {
      inputs.push(input);
    },
  );
  assert.deepEqual(inputs, [
    {
      emailAddress: "client@example.test",
      notify: true,
      redirectUrl: "https://portal.example.test/portal/activate",
      publicMetadata: { fssPortalInvitation: metadata },
    },
  ]);
  await assert.rejects(
    provisionPortalAccount(
      "client@example.test",
      "https://portal.example.test/portal/activate",
      undefined,
      async () => {
        throw new Error("provider failed");
      },
    ),
    /unavailable/,
  );
  await assert.rejects(
    provisionPortalAccount(
      "invalid",
      "https://portal.example.test/portal/activate",
      undefined,
      async () => {
        throw new Error("must not call");
      },
    ),
  );
});
