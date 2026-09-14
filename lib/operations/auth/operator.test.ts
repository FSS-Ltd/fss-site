import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { OperationsDb } from "../db/client";
import { applyPortalOperation, portalOperationSchema } from "./operator";

test("client invitation requests cannot choose an organisation", () => {
  const request = {
    action: "invite_client",
    name: "Client Owner",
    email: "client@example.test",
    role: "owner",
    reviewReference: "Founder approved",
  } as const;
  assert.equal(portalOperationSchema.safeParse(request).success, true);
  assert.equal(
    portalOperationSchema.safeParse({
      ...request,
      organisationId: "8aa24c0b-3665-4fd4-8694-500675c943c3",
    }).success,
    false,
  );
});

test("client invitation records the pending grant and sends organisation-free Clerk metadata", async () => {
  const invitationId = randomUUID();
  const provisioned: unknown[] = [];
  const issued: unknown[] = [];
  const result = await applyPortalOperation(
    {} as OperationsDb,
    { actorId: "a".repeat(64) },
    {
      action: "invite_client",
      name: "Client Owner",
      email: "Client@Example.test",
      role: "owner",
      reviewReference: "Founder approved",
    },
    "https://portal.example.test",
    async (email, redirectUrl, metadata) => {
      provisioned.push({ email, redirectUrl, metadata });
    },
    {
      createId: () => invitationId,
      issuePending: async (_db, _founder, input, id, correlationId) => {
        issued.push({ input, id, correlationId });
        return {
          invitationId: id,
          expiresAt: new Date("2026-09-16T12:00:00.000Z"),
        };
      },
      failPending: async () => undefined,
    },
  );

  assert.deepEqual(result, { action: "invite_client" });
  assert.equal(issued.length, 1);
  assert.deepEqual(provisioned, [
    {
      email: "client@example.test",
      redirectUrl:
        "https://portal.example.test/portal/activate?name=Client+Owner&email=client%40example.test",
      metadata: {
        version: 2,
        invitationId,
        email: "client@example.test",
      },
    },
  ]);
});

test("founder invitation accepts no browser-selected recipient", async () => {
  const request = {
    action: "invite_founder",
    reviewReference: "Founder requested access email",
  } as const;
  assert.equal(portalOperationSchema.safeParse(request).success, true);
  assert.equal(
    portalOperationSchema.safeParse({
      ...request,
      email: "other@example.test",
    }).success,
    false,
  );
  const sent: string[] = [];
  assert.deepEqual(
    await applyPortalOperation(
      {} as OperationsDb,
      { actorId: "a".repeat(64) },
      request,
      "https://portal.example.test",
      async () => undefined,
      { sendFounder: async (review) => void sent.push(review) },
    ),
    { action: "invite_founder" },
  );
  assert.deepEqual(sent, [request.reviewReference]);
});
