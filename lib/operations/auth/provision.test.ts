import assert from "node:assert/strict";
import test from "node:test";
import { createPortalInvitationMetadata } from "./clerk-invitation";
import {
  provisionPortalAccount,
  readPortalProvisionConfig,
  toPortalProvisioningErrorReport,
} from "./provision";

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

test("provisioning classifies an existing Clerk invitation without retaining provider details", async () => {
  const providerError = Object.assign(new Error("Invitation already exists for client@example.test"), {
    name: "ClerkAPIResponseError",
    status: 409,
    errors: [
      {
        code: "form_identifier_exists",
        message: "Invitation already exists for client@example.test",
        longMessage: "The existing invitation is still pending.",
        meta: { emailAddresses: ["client@example.test"] },
      },
    ],
  });

  await assert.rejects(
    provisionPortalAccount(
      "client@example.test",
      "https://portal.example.test/portal/activate",
      undefined,
      async () => {
        throw providerError;
      },
    ),
    (error: unknown) => {
      assert.equal(
        typeof error === "object" && error !== null
          ? Reflect.get(error, "name")
          : undefined,
        "PortalProvisioningError",
      );
      assert.equal(
        typeof error === "object" && error !== null
          ? Reflect.get(error, "code")
          : undefined,
        "INVITATION_CONFLICT",
      );
      assert.deepEqual(toPortalProvisioningErrorReport(error), {
        errorName: "PortalProvisioningError",
        errorCode: "INVITATION_CONFLICT",
      });
      assert.doesNotMatch(JSON.stringify(error), /client@example\.test/);
      return true;
    },
  );
});

test("provisioning classifies Clerk failures by safe status category", async () => {
  const cases = [
    [400, "INVALID_PROVIDER_REQUEST"],
    [401, "PROVIDER_AUTHENTICATION_FAILED"],
    [429, "RETRYABLE_PROVIDER_ERROR"],
    [500, "RETRYABLE_PROVIDER_ERROR"],
    [418, "UNKNOWN_PROVIDER_ERROR"],
  ] as const;

  for (const [status, expectedCode] of cases) {
    await assert.rejects(
      provisionPortalAccount(
        "client@example.test",
        "https://portal.example.test/portal/activate",
        undefined,
        async () => {
          throw Object.assign(new Error("provider response"), { status });
        },
      ),
      (error: unknown) => {
        assert.deepEqual(toPortalProvisioningErrorReport(error), {
          errorName: "PortalProvisioningError",
          errorCode: expectedCode,
        });
        return true;
      },
    );
  }
});
