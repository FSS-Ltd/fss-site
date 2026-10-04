import assert from "node:assert/strict";
import test from "node:test";
import { PortalAccessDenied } from "../auth/types";
import { createStaffPortalAccessRouteHandler } from "./staff-portal-access-route";

const origin = "https://portal.example.test";

test("rejects a forged origin before executing a Studio portal-access command", async () => {
  let called = false;
  const handler = createStaffPortalAccessRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => {
      called = true;
      return { status: "sent" as const };
    },
    origin,
    reportUnexpectedError: () => undefined,
  });
  const response = await handler(
    new Request("https://portal.example.test/api/portal/admin/portal-access", {
      body: JSON.stringify({}),
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example.test",
      },
      method: "POST",
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test("returns only a narrow provider-safe invitation outcome", async () => {
  const handler = createStaffPortalAccessRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => ({ status: "sent" }),
    origin,
    reportUnexpectedError: () => undefined,
  });
  const response = await handler(
    new Request("https://portal.example.test/api/portal/admin/portal-access", {
      body: JSON.stringify({ action: "invite_existing_client" }),
      headers: { "content-type": "application/json", origin },
      method: "POST",
    }),
  );
  assert.deepEqual(await response.json(), { status: "sent" });
});

test("allows the exact configured Vercel preview origin for Studio commands", async () => {
  const previewOrigin = "https://fss-site-git-portal-invite.vercel.app";
  let called = false;
  const handler = createStaffPortalAccessRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
    enabled: true,
    execute: async () => {
      called = true;
      return { status: "sent" as const };
    },
    origin: [origin, previewOrigin],
    reportUnexpectedError: () => undefined,
  });
  const response = await handler(
    new Request(`${previewOrigin}/api/portal/admin/portal-access`, {
      body: JSON.stringify({ action: "invite_client" }),
      headers: {
        "content-type": "application/json",
        origin: previewOrigin,
      },
      method: "POST",
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(called, true);
});

test("returns a permission error for founder-only commands without exposing details", async () => {
  const handler = createStaffPortalAccessRouteHandler({
    authorize: async () => ({ id: "admin" }),
    createCorrelationId: () => "reference",
    enabled: true,
    execute: async () => {
      throw new PortalAccessDenied();
    },
    origin,
    reportUnexpectedError: () => undefined,
  });
  const response = await handler(
    new Request(`${origin}/api/portal/admin/portal-access`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ action: "invite_admin" }),
    }),
  );
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Founder authorization is required for FSS staff access.",
  });
});
