import assert from "node:assert/strict";
import test from "node:test";
import { subscribeCrmChanges } from "./change-events";
test("change subscription refreshes only on events and cleans up listeners", () => {
  const surface = new EventTarget();
  let refreshes = 0;
  const stop = subscribeCrmChanges({
    surface,
    visible: () => true,
    refresh: () => {
      refreshes++;
    },
    openChannel: () => null,
  });
  assert.equal(refreshes, 0);
  surface.dispatchEvent(new Event("focus"));
  assert.equal(refreshes, 1);
  surface.dispatchEvent(new Event("online"));
  assert.equal(refreshes, 2);
  surface.dispatchEvent(new Event("growth-crm-committed"));
  assert.equal(refreshes, 3);
  stop();
  surface.dispatchEvent(new Event("focus"));
  assert.equal(refreshes, 3);
});
test("hidden views defer refresh until focus and duplicate change IDs are ignored", () => {
  const surface = new EventTarget();
  let visible = false;
  let refreshes = 0;
  let receive: ((event: MessageEvent) => void) | null = null;
  let closed = false;
  const stop = subscribeCrmChanges({
    surface,
    visible: () => visible,
    refresh: () => {
      refreshes++;
    },
    openChannel: (listener) => {
      receive = listener;
      return {
        close: () => {
          closed = true;
        },
      };
    },
  });
  surface.dispatchEvent(new Event("online"));
  assert.equal(refreshes, 0);
  visible = true;
  surface.dispatchEvent(new Event("focus"));
  assert.equal(refreshes, 1);
  const listener = receive as unknown as (event: MessageEvent) => void;
  listener(
    new MessageEvent("message", { data: { type: "committed", id: "one" } }),
  );
  listener(
    new MessageEvent("message", { data: { type: "committed", id: "one" } }),
  );
  assert.equal(refreshes, 2);
  stop();
  assert.equal(closed, true);
});

test("hidden views close their channel and visibility return reconciles before accepting new events", () => {
  const surface = new EventTarget();
  let visible = true;
  let opens = 0;
  let closes = 0;
  let reads = 0;
  const stop = subscribeCrmChanges({
    surface,
    visible: () => visible,
    refresh: () => {
      reads++;
    },
    openChannel: () => {
      opens++;
      return {
        close: () => {
          closes++;
        },
      };
    },
  });
  assert.equal(opens, 1);
  visible = false;
  surface.dispatchEvent(new Event("visibilitychange"));
  assert.equal(closes, 1);
  visible = true;
  surface.dispatchEvent(new Event("visibilitychange"));
  assert.equal(opens, 2);
  assert.equal(reads, 1);
  stop();
  assert.equal(closes, 2);
});

test("one commit delivered locally and by channel causes only one refresh", () => {
  const surface = new EventTarget();
  let reads = 0;
  let receiver: ((event: MessageEvent) => void) | undefined;
  const stop = subscribeCrmChanges({
    surface,
    visible: () => true,
    refresh: () => {
      reads++;
    },
    openChannel: (receive) => {
      receiver = receive;
      return { close: () => {} };
    },
  });
  const data = { type: "committed", id: "same-commit" };
  surface.dispatchEvent(
    new CustomEvent("growth-crm-committed", { detail: data }),
  );
  receiver?.(new MessageEvent("message", { data }));
  assert.equal(reads, 1);
  stop();
});
