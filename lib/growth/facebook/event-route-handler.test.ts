import assert from "node:assert/strict";
import test from "node:test";
import { FounderAuthorizationError } from "../auth/require-founder";
import { createGrowthEventHandler } from "./event-route-handler";

const origin = "https://example.test";
const request = (signal?: AbortSignal) =>
  new Request(`${origin}/api/growth/events`, { signal });
const founder = { email: "owner@example.test", actorId: "actor" };
test("authorizes before listening and rejects cross-site requests", async () => {
  let listened = false;
  const handler = createGrowthEventHandler({
    origin,
    authorizeFounder: async () => {
      throw new FounderAuthorizationError();
    },
    deadline: async () => Date.now() + 10000,
    eventUrl: () => "postgres://x",
    subscribe: async () => {
      listened = true;
      return { status: "unconfigured" };
    },
  });
  assert.equal((await handler(request())).status, 401);
  assert.equal(listened, false);
  assert.equal(
    (
      await handler(
        new Request(`${origin}/api/growth/events`, {
          headers: { origin: "https://elsewhere.test" },
        }),
      )
    ).status,
    400,
  );
});
test("emits only UUID hints and closes listener on abort", async () => {
  let closed = 0;
  const abort = new AbortController();
  const handler = createGrowthEventHandler({
    origin,
    authorizeFounder: async () => founder,
    deadline: async () => Date.now() + 10000,
    eventUrl: () => "postgres://x",
    subscribe: async (_url, callbacks) => {
      callbacks.ready();
      callbacks.change("private content");
      callbacks.change("123e4567-e89b-42d3-a456-426614174000");
      return {
        status: "listening",
        close: async () => {
          closed++;
        },
      };
    },
  });
  const response = await handler(request(abort.signal));
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  assert.match(decoder.decode((await reader.read()).value), /event: ready/);
  assert.match(
    decoder.decode((await reader.read()).value),
    /123e4567-e89b-42d3-a456-426614174000/,
  );
  abort.abort();
  assert.equal((await reader.read()).done, true);
  assert.equal(closed, 1);
});
test("reports missing event configuration without listening", async () => {
  const handler = createGrowthEventHandler({
    origin,
    authorizeFounder: async () => founder,
    deadline: async () => Date.now() + 10000,
    eventUrl: () => undefined,
  });
  assert.match(await (await handler(request())).text(), /event: unconfigured/);
});
test("closes expired streams and handles listener failure", async () => {
  let closed = 0;
  const base = {
    origin,
    authorizeFounder: async () => founder,
    deadline: async () => Date.now() + 20,
    eventUrl: () => "postgres://x",
  };
  const handler = createGrowthEventHandler({
    ...base,
    subscribe: async (_url, callbacks) => {
      callbacks.ready();
      return {
        status: "listening",
        close: async () => {
          closed++;
        },
      };
    },
  });
  const reader = (await handler(request())).body!.getReader();
  await reader.read();
  assert.equal((await reader.read()).done, true);
  assert.equal(closed, 1);
  const failed = createGrowthEventHandler({
    ...base,
    subscribe: async () => {
      throw new Error("unavailable");
    },
  });
  assert.equal((await failed(request())).status, 503);
});
