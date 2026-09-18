import assert from "node:assert/strict";
import test from "node:test";
import { createRequestCommandHandler } from "./request-command-handler";
import { RequestConflict } from "../requests/types";

const id = "10000000-0000-4000-8000-000000000001";
const actor = { marker: "actor" };

function request(
  origin = "https://fss.test",
  body: unknown = { action: "start", expectedVersion: 1 },
) {
  return new Request("https://fss.test/api/portal/admin", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(
  execute?: (command: unknown) => Promise<{ id: string; version: number }>,
) {
  return {
    enabled: true,
    origin: "https://fss.test",
    authorize: async () => actor,
    execute: async (
      authorized: unknown,
      organisation: string,
      command: unknown,
    ): Promise<{ id: string; version: number }> => {
      assert.equal(authorized, actor);
      assert.equal(organisation, id);
      return execute
        ? execute(command)
        : Promise.resolve({ id, version: 2 });
    },
    createCorrelationId: () => id,
    reportUnexpectedError: () => {},
  };
}

test("command handler authenticates, binds route identifiers, and maps success", async () => {
  const commands: unknown[] = [];
  const handler = createRequestCommandHandler({
    ...dependencies((command) => {
      commands.push(command);
      return Promise.resolve({ id, version: 3 });
    }),
  });
  assert.equal(
    (await handler(request("https://evil.test"), id, id)).status,
    403,
  );
  assert.equal(
    (await handler(request(undefined, { requestId: id }), id, id)).status,
    400,
  );
  const result = await handler(request(), id, id);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(commands, [
    { action: "start", expectedVersion: 1, requestId: id },
  ]);
});

test("command handler preserves conflict, validation, and private failure mapping", async () => {
  for (const [kind, status] of [
    ["auth", 403],
    ["conflict", 409],
    ["database", 503],
  ] as const) {
    const handler = createRequestCommandHandler({
      enabled: true,
      origin: "https://fss.test",
      authorize: async () => {
        if (kind === "auth") throw new Error("denied");
        return actor;
      },
      execute: async () => {
        if (kind === "conflict") throw new RequestConflict();
        throw new Error("private database hostname");
      },
      createCorrelationId: () => id,
      reportUnexpectedError: () => {},
    });
    const response = await handler(request(), id, id);
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /private database hostname/);
  }
});

test("command handler rejects oversized payloads and malformed JSON", async () => {
  const handler = createRequestCommandHandler(dependencies());
  const huge = new Request("https://fss.test/api/portal/admin", {
    method: "POST",
    headers: {
      origin: "https://fss.test",
      "content-type": "application/json",
      "content-length": String(64 * 1024 + 1),
    },
    body: JSON.stringify({ action: "start" }),
  });
  assert.equal((await handler(huge, id, id)).status, 413);
  const malformed = new Request("https://fss.test/api/portal/admin", {
    method: "POST",
    headers: {
      origin: "https://fss.test",
      "content-type": "application/json",
    },
    body: "{not-json",
  });
  assert.equal((await handler(malformed, id, id)).status, 400);
});
