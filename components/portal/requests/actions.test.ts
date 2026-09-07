import assert from "node:assert/strict";
import test from "node:test";
import { postRequestCommand } from "./actions";

test("request transport preserves the submitted idempotency key across network retry", async (context) => {
  const bodies: string[] = [];
  const id = "4d3e1c27-3a6c-4720-a163-198ec5391220";
  context.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      if (bodies.length === 1) throw new Error("offline");
      return Response.json({ request: { id, version: 1 } });
    },
  );
  const draft = {
    projectId: id,
    title: "Update contact form",
    description: "Add a phone field",
    type: "work" as const,
    desiredOutcome: "Visitors can share a callback number",
    idempotencyKey: id,
  };
  const failed = await postRequestCommand("/api/portal/requests", id, draft);
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.match(failed.error, /draft is still here/);
  const saved = await postRequestCommand("/api/portal/requests", id, draft);
  assert.deepEqual(saved, { ok: true, request: { id, version: 1 } });
  assert.equal(bodies[0], bodies[1]);
});

test("stale review submission returns a conflict with a safe refresh instruction", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "stale version" }, { status: 409 }),
  );
  const result = await postRequestCommand(
    "/api/portal/requests/item/actions",
    "org",
    {
      action: "accept",
      expectedVersion: 2,
      deliverableVersion: "v1",
      reviewCycle: 1,
    },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.conflict, true);
    assert.match(result.error, /Refresh.*draft will stay/);
  }
});

test("a malformed successful response never clears a draft as a confirmed save", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json({ request: { id: "bad-id" } }),
  );
  const result = await postRequestCommand(
    "/api/portal/requests/item/actions",
    "org",
    { action: "comment", expectedVersion: 2, body: "Please check the heading" },
  );
  assert.equal(result.ok, false);
});

test("conflicts retain their recovery path when the response is not JSON", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response("Conflict", { status: 409 }),
  );
  const result = await postRequestCommand(
    "/api/portal/requests/item/actions",
    "org",
    { action: "comment", expectedVersion: 2, body: "Test" },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.conflict, true);
});

test("boundary validation retains field errors for accessible form feedback", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { error: "Check your request", fields: { title: "Enter a title" } },
      { status: 400 },
    ),
  );
  const result = await postRequestCommand(
    "/api/portal/requests/item/actions",
    "org",
    { action: "comment", expectedVersion: 2, body: "Test" },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.fields, { title: "Enter a title" });
});
