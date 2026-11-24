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

test("deadline bounds pending setup and disposes a late subscription", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
  let callbacks:
    | { ready: () => void; change: (id: string) => void }
    | undefined;
  let finish:
    | ((value: { status: "listening"; close: () => Promise<void> }) => void)
    | undefined;
  let closes = 0;
  const handler = createGrowthEventHandler({
    origin,
    authorizeFounder: async () => founder,
    deadline: async () => 1100,
    eventUrl: () => "postgres://x",
    subscribe: async (_url, handlers) => {
      callbacks = handlers;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const responsePromise = handler(request());
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(callbacks);
  t.mock.timers.tick(100);
  callbacks.ready();
  callbacks.change("123e4567-e89b-42d3-a456-426614174000");
  const response = await responsePromise;
  assert.equal(await response.text(), "");
  assert.ok(finish);
  finish({
    status: "listening",
    close: async () => {
      closes++;
    },
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(closes, 1);
});

test("abort bounds pending setup and handles late success or failure", async () => {
  for (const rejectLate of [false, true]) {
    const abort = new AbortController();
    let finish:
      | ((value: { status: "listening"; close: () => Promise<void> }) => void)
      | undefined;
    let fail: ((error: Error) => void) | undefined;
    let closes = 0;
    const handler = createGrowthEventHandler({
      origin,
      authorizeFounder: async () => founder,
      deadline: async () => Date.now() + 10000,
      eventUrl: () => "postgres://x",
      subscribe: async () =>
        new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
    });
    const responsePromise = handler(request(abort.signal));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(finish);
    assert.ok(fail);
    abort.abort();
    assert.equal(await (await responsePromise).text(), "");
    if (rejectLate) fail(new Error("late failure"));
    else
      finish({
        status: "listening",
        close: async () => {
          closes++;
        },
      });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(closes, rejectLate ? 0 : 1);
  }
});

test("an already aborted request does not start a listener", async () => {
  const abort = new AbortController();
  abort.abort();
  let subscribed = false;
  const handler = createGrowthEventHandler({
    origin,
    authorizeFounder: async () => founder,
    deadline: async () => Date.now() + 10000,
    eventUrl: () => "postgres://x",
    subscribe: async () => {
      subscribed = true;
      return { status: "unconfigured" };
    },
  });
  assert.equal(await (await handler(request(abort.signal))).text(), "");
  assert.equal(subscribed, false);
});

test("callbacks at the deadline close setup before the timer runs", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  let callbacks:
    | { ready: () => void; change: (id: string) => void }
    | undefined;
  let finish:
    | ((value: { status: "listening"; close: () => Promise<void> }) => void)
    | undefined;
  let closes = 0;
  const handler = createGrowthEventHandler({
    origin,
    authorizeFounder: async () => founder,
    deadline: async () => 1100,
    eventUrl: () => "postgres://x",
    subscribe: async (_url, handlers) => {
      callbacks = handlers;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const responsePromise = handler(request());
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(callbacks);
  assert.ok(finish);
  t.mock.timers.setTime(1100);
  callbacks.ready();
  callbacks.change("123e4567-e89b-42d3-a456-426614174000");
  assert.equal(await (await responsePromise).text(), "");
  finish({
    status: "listening",
    close: async () => {
      closes++;
    },
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(closes, 1);
});

test("daily topic emits only its redacted marker and rejects unknown topics", async () => {
  let chosen = "";
  let closed = false;
  const abort = new AbortController();
  const handler = createGrowthEventHandler({
    origin,
    authorizeFounder: async () => founder,
    deadline: async () => Date.now() + 10000,
    eventUrl: () => "postgres://x",
    subscribe: async (_url, callbacks, topic) => {
      chosen = topic ?? "audit";
      callbacks.ready();
      callbacks.change("private");
      callbacks.change("changed");
      return {
        status: "listening",
        close: async () => {
          closed = true;
        },
      };
    },
  });
  const response = await handler(
    new Request(`${origin}/api/growth/events?topic=daily-summary`, {
      signal: abort.signal,
    }),
  );
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  assert.match(decoder.decode((await reader.read()).value), /event: ready/);
  const event = decoder.decode((await reader.read()).value);
  assert.match(event, /event: change\ndata: \{\}/);
  assert.doesNotMatch(event, /private|changed/);
  assert.equal(chosen, "daily-summary");
  abort.abort();
  assert.equal(closed, true);
  assert.equal(
    (await handler(new Request(`${origin}/api/growth/events?topic=other`)))
      .status,
    400,
  );
});
