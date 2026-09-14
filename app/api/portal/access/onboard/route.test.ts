import assert from "node:assert/strict";
import test from "node:test";
import type { OperationsDb } from "@/lib/operations/db/client";
import { createPortalOnboardingHandler } from "./handler";

const identity = {
  userId: "d6fd04aa-3f79-48b5-84ee-83a01b129428",
  email: "client@example.test",
  emailVerified: true as const,
};

test("portal onboarding rejects another origin before any tenant mutation", async () => {
  let completed = false;
  const post = createPortalOnboardingHandler({
    configured: () => true,
    origin: () => "https://portal.example.test",
    identity: async () => identity,
    db: () => ({}) as OperationsDb,
    complete: async () => {
      completed = true;
      return { organisationId: "5d54f85a-f954-4a86-852c-ad5ea2329b6b" };
    },
  });
  const response = await post(
    new Request("https://portal.example.test/api/portal/access/onboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example.test",
      },
      body: JSON.stringify({
        legalName: "Client Limited",
        displayName: "Client",
        timezone: "Europe/London",
      }),
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(completed, false);
});

test("portal onboarding completes against the verified identity", async () => {
  const inputs: unknown[] = [];
  const post = createPortalOnboardingHandler({
    configured: () => true,
    origin: () => "https://portal.example.test",
    identity: async () => identity,
    db: () => ({}) as OperationsDb,
    complete: async (_db, actualIdentity, input) => {
      inputs.push({ actualIdentity, input });
      return { organisationId: "5d54f85a-f954-4a86-852c-ad5ea2329b6b" };
    },
  });
  const response = await post(
    new Request("https://portal.example.test/api/portal/access/onboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://portal.example.test",
      },
      body: JSON.stringify({
        legalName: "Client Limited",
        displayName: "Client",
        timezone: "Europe/London",
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    organisationId: "5d54f85a-f954-4a86-852c-ad5ea2329b6b",
  });
  assert.deepEqual(inputs, [
    {
      actualIdentity: identity,
      input: {
        legalName: "Client Limited",
        displayName: "Client",
        timezone: "Europe/London",
      },
    },
  ]);
});
