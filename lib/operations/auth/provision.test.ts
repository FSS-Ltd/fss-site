import assert from "node:assert/strict";
import test from "node:test";
import { createPortalInvitationMetadata } from "./clerk-invitation";
import {
  provisionPortalAccount,
  readPortalProvisionConfig,
  revokePendingClerkInvitationById,
  revokePendingClerkStaffInvitations,
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

test("single-invitation cleanup never revokes a different invitation for the same email", async () => {
  const revoked: string[] = [];
  await revokePendingClerkInvitationById(
    "client@example.test",
    "2e83e9c3-b021-4a55-b117-78c05b456c15",
    "portal",
    async () => ({
      invitations: {
        getInvitationList: async () => ({
          data: [
            {
              id: "wrong-id",
              emailAddress: "client@example.test",
              publicMetadata: {
                fssPortalInvitation: {
                  version: 2,
                  invitationId: "11111111-1111-4111-8111-111111111111",
                  email: "client@example.test",
                },
              },
            },
            {
              id: "exact-id",
              emailAddress: "client@example.test",
              publicMetadata: {
                fssPortalInvitation: {
                  version: 2,
                  invitationId: "2e83e9c3-b021-4a55-b117-78c05b456c15",
                  email: "client@example.test",
                },
              },
            },
            {
              id: "missing-metadata",
              emailAddress: "client@example.test",
              publicMetadata: null,
            },
          ],
        }),
        revokeInvitation: async (id) => {
          revoked.push(id);
        },
      },
    }),
  );
  assert.deepEqual(revoked, ["exact-id"]);
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
      ignoreExisting: true,
      expiresInDays: 30,
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
  const providerError = Object.assign(
    new Error("Invitation already exists for client@example.test"),
    {
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
    },
  );

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

test("reconciles only the matching pending Clerk staff invitation", async () => {
  const listRequests: unknown[] = [];
  const revokedInvitationIds: string[] = [];

  await revokePendingClerkStaffInvitations(
    " Admin@example.test ",
    ["2e83e9c3-b021-4a55-b117-78c05b456c15"],
    async () => ({
      invitations: {
        getInvitationList: async (params) => {
          listRequests.push(params);
          return {
            data: [
              {
                id: "inv_staff",
                emailAddress: "admin@example.test",
                publicMetadata: {
                  fssPortalInvitation: {
                    version: 3,
                    realm: "staff",
                    role: "admin",
                    invitationId: "2e83e9c3-b021-4a55-b117-78c05b456c15",
                    email: "admin@example.test",
                  },
                },
              },
              {
                id: "inv_client",
                emailAddress: "admin@example.test",
                publicMetadata: {
                  fssPortalInvitation: {
                    version: 2,
                    invitationId: "2e83e9c3-b021-4a55-b117-78c05b456c15",
                    email: "admin@example.test",
                  },
                },
              },
              {
                id: "inv_other_email",
                emailAddress: "other@example.test",
                publicMetadata: {
                  fssPortalInvitation: {
                    version: 3,
                    realm: "staff",
                    role: "admin",
                    invitationId: "2e83e9c3-b021-4a55-b117-78c05b456c15",
                    email: "admin@example.test",
                  },
                },
              },
            ],
          };
        },
        revokeInvitation: async (invitationId) => {
          revokedInvitationIds.push(invitationId);
        },
      },
    }),
  );

  assert.deepEqual(listRequests, [
    { query: "admin@example.test", status: "pending", limit: 100, offset: 0 },
  ]);
  assert.deepEqual(revokedInvitationIds, ["inv_staff"]);
});

test("reconciliation rejects invalid email input before contacting Clerk", async () => {
  let contacted = false;

  await assert.rejects(
    revokePendingClerkStaffInvitations(
      "not-an-email",
      ["2e83e9c3-b021-4a55-b117-78c05b456c15"],
      async () => {
        contacted = true;
        return {
          invitations: {
            getInvitationList: async () => ({ data: [] }),
            revokeInvitation: async () => undefined,
          },
        };
      },
    ),
  );

  assert.equal(contacted, false);
});

test("reconciliation propagates provider failures without exposing invitation details", async () => {
  const providerFailure = new Error("provider unavailable for inv_staff");

  await assert.rejects(
    revokePendingClerkStaffInvitations(
      "admin@example.test",
      ["2e83e9c3-b021-4a55-b117-78c05b456c15"],
      async () => ({
        invitations: {
          getInvitationList: async () => {
            throw providerFailure;
          },
          revokeInvitation: async () => undefined,
        },
      }),
    ),
    (error: unknown) => {
      assert.equal(error, providerFailure);
      assert.doesNotMatch(String(error), /admin@example\.test/);
      return true;
    },
  );
});

test("client reconciliation preserves staff invitations for the same email", async () => {
  const { revokePendingClerkPortalInvitations } = await import("./provision");
  const revoked: string[] = [];
  await revokePendingClerkPortalInvitations(
    "owner@example.test",
    ["2e83e9c3-b021-4a55-b117-78c05b456c15"],
    async () => ({
      invitations: {
        getInvitationList: async () => ({
          data: [
            {
              id: "inv_staff",
              emailAddress: "owner@example.test",
              publicMetadata: {
                fssPortalInvitation: {
                  version: 3,
                  realm: "staff",
                  role: "admin",
                  invitationId: "2e83e9c3-b021-4a55-b117-78c05b456c15",
                  email: "owner@example.test",
                },
              },
            },
            {
              id: "inv_client",
              emailAddress: "owner@example.test",
              publicMetadata: {
                fssPortalInvitation: {
                  version: 2,
                  invitationId: "2e83e9c3-b021-4a55-b117-78c05b456c15",
                  email: "owner@example.test",
                },
              },
            },
          ],
        }),
        revokeInvitation: async (id) => {
          revoked.push(id);
        },
      },
    }),
  );
  assert.deepEqual(revoked, ["inv_client"]);
});

test("reconciliation visits every provider page before revoking invitations", async () => {
  const revoked: string[] = [];
  await revokePendingClerkStaffInvitations(
    "admin@example.test",
    ["2e83e9c3-b021-4a55-b117-78c05b456c15"],
    async () => ({
      invitations: {
        getInvitationList: async (query) => {
          assert.equal(
            revoked.length,
            0,
            "Pagination must finish before revocation shifts offsets",
          );
          const offset = "offset" in query ? query.offset : 0;
          return {
            data: Array.from({ length: offset === 0 ? 100 : 1 }, (_, i) => ({
              id: `inv_${offset}_${i}`,
              emailAddress: "admin@example.test",
              publicMetadata: {
                fssPortalInvitation: {
                  version: 3,
                  realm: "staff",
                  role: "admin",
                  invitationId: "2e83e9c3-b021-4a55-b117-78c05b456c15",
                  email: "admin@example.test",
                },
              },
            })),
          };
        },
        revokeInvitation: async (id) => {
          revoked.push(id);
        },
      },
    }),
  );
  assert.equal(revoked.length, 101);
});

test("client cleanup leaves a newer unclaimed provider invitation intact", async () => {
  const { revokePendingClerkPortalInvitations } = await import("./provision");
  const revoked: string[] = [];
  await revokePendingClerkPortalInvitations(
    "owner@example.test",
    ["2e83e9c3-b021-4a55-b117-78c05b456c15"],
    async () => ({
      invitations: {
        getInvitationList: async () => ({
          data: [
            {
              id: "inv_unclaimed",
              emailAddress: "owner@example.test",
              publicMetadata: {
                fssPortalInvitation: {
                  version: 2,
                  invitationId: "339e26f7-7f06-46a9-bd16-934aad5af540",
                  email: "owner@example.test",
                },
              },
            },
          ],
        }),
        revokeInvitation: async (id) => {
          revoked.push(id);
        },
      },
    }),
  );
  assert.deepEqual(revoked, []);
});
