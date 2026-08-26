import assert from "node:assert/strict";
import test from "node:test";

import { signUnsubscribeToken } from "@/lib/growth/email/suppression";
import type {
  NewsletterSubscriberDependencies,
  NewsletterSubscriberRecord,
} from "@/lib/growth/newsletter/subscribers";

import { createUnsubscribeRouteHandler } from "./handler";
import { GET, POST } from "./route";

const SECRET = "a".repeat(32);
const NOW = new Date("2026-01-15T00:00:00Z");

function createHarness(seed: NewsletterSubscriberRecord[] = []) {
  const store = new Map(seed.map((record) => [record.normalisedEmail, record]));

  const dependencies: NewsletterSubscriberDependencies = {
    findSubscriberByEmail: async (normalisedEmail) =>
      store.get(normalisedEmail) ?? null,
    insertSubscriber: async () => {
      throw new Error("Not exercised by the unsubscribe route.");
    },
    updateSubscriberConsent: async () => {
      throw new Error("Not exercised by the unsubscribe route.");
    },
    updateSubscriberStatus: async (id, status, at) => {
      const existing = [...store.values()].find((record) => record.id === id);
      if (!existing) {
        throw new Error("Subscriber not found.");
      }
      const updated: NewsletterSubscriberRecord = {
        ...existing,
        status,
        unsubscribedAt: at,
      };
      store.set(updated.normalisedEmail, updated);
      return updated;
    },
  };

  return { dependencies, store };
}

function request(token?: string): Request {
  const url = new URL(
    "https://faithfulsoftwaresolutions.co.uk/api/newsletter/unsubscribe",
  );
  if (token !== undefined) {
    url.searchParams.set("token", token);
  }
  return new Request(url);
}

async function bodyText(response: Response): Promise<string> {
  return response.text();
}

test("rejects a request with no token", async () => {
  const { dependencies } = createHarness();
  const handler = createUnsubscribeRouteHandler({
    tokenSecret: SECRET,
    subscribers: dependencies,
    now: () => NOW,
  });

  const response = await handler(request());

  assert.equal(response.status, 400);
  assert.match(await bodyText(response), /no longer valid/);
});

test("returns a safe response when the server has no token secret configured", async () => {
  const { dependencies } = createHarness();
  const handler = createUnsubscribeRouteHandler({
    tokenSecret: undefined,
    subscribers: dependencies,
    now: () => NOW,
  });

  const response = await handler(request("anything"));

  assert.equal(response.status, 400);
});

test("rejects a malformed token", async () => {
  const { dependencies } = createHarness();
  const handler = createUnsubscribeRouteHandler({
    tokenSecret: SECRET,
    subscribers: dependencies,
    now: () => NOW,
  });

  const response = await handler(request("not-a-real-token"));

  assert.equal(response.status, 400);
});

test("rejects an expired token", async () => {
  const { dependencies } = createHarness();
  const handler = createUnsubscribeRouteHandler({
    tokenSecret: SECRET,
    subscribers: dependencies,
    now: () => NOW,
  });
  const expiredToken = signUnsubscribeToken(
    "ada@example.test",
    SECRET,
    new Date("2020-01-01T00:00:00Z"),
  );

  const response = await handler(request(expiredToken));

  assert.equal(response.status, 400);
});

test("unsubscribes a subscribed recipient and returns a safe confirmation", async () => {
  const { dependencies, store } = createHarness([
    {
      id: "subscriber-1",
      normalisedEmail: "ada@example.test",
      status: "subscribed",
      consentedAt: new Date("2026-01-01T00:00:00Z"),
      unsubscribedAt: null,
    },
  ]);
  const handler = createUnsubscribeRouteHandler({
    tokenSecret: SECRET,
    subscribers: dependencies,
    now: () => NOW,
  });
  const token = signUnsubscribeToken("ada@example.test", SECRET, NOW);

  const response = await handler(request(token));

  assert.equal(response.status, 200);
  assert.match(await bodyText(response), /unsubscribed/i);
  assert.equal(store.get("ada@example.test")?.status, "unsubscribed");
});

test("returns the same safe response for an unknown recipient", async () => {
  const { dependencies } = createHarness();
  const handler = createUnsubscribeRouteHandler({
    tokenSecret: SECRET,
    subscribers: dependencies,
    now: () => NOW,
  });
  const token = signUnsubscribeToken("nobody@example.test", SECRET, NOW);

  const response = await handler(request(token));

  assert.equal(response.status, 200);
  assert.match(await bodyText(response), /unsubscribed/i);
});

test("returns the same safe response for an already-unsubscribed recipient", async () => {
  const { dependencies } = createHarness([
    {
      id: "subscriber-2",
      normalisedEmail: "ada@example.test",
      status: "unsubscribed",
      consentedAt: new Date("2026-01-01T00:00:00Z"),
      unsubscribedAt: new Date("2026-01-10T00:00:00Z"),
    },
  ]);
  const handler = createUnsubscribeRouteHandler({
    tokenSecret: SECRET,
    subscribers: dependencies,
    now: () => NOW,
  });
  const token = signUnsubscribeToken("ada@example.test", SECRET, NOW);

  const response = await handler(request(token));

  assert.equal(response.status, 200);
  assert.match(await bodyText(response), /unsubscribed/i);
});

test("returns a 500 and reports an unexpected dependency failure without leaking details", async () => {
  const reported: unknown[] = [];
  const dependencies: NewsletterSubscriberDependencies = {
    findSubscriberByEmail: async () => {
      throw new Error("connection reset");
    },
    insertSubscriber: async () => {
      throw new Error("unused");
    },
    updateSubscriberConsent: async () => {
      throw new Error("unused");
    },
    updateSubscriberStatus: async () => {
      throw new Error("unused");
    },
  };
  const handler = createUnsubscribeRouteHandler({
    tokenSecret: SECRET,
    subscribers: dependencies,
    now: () => NOW,
    reportUnexpectedError: (error) => reported.push(error),
  });
  const token = signUnsubscribeToken("ada@example.test", SECRET, NOW);

  const response = await handler(request(token));

  assert.equal(response.status, 500);
  assert.doesNotMatch(await bodyText(response), /connection reset/);
  assert.equal(reported.length, 1);
});

test("GET and POST use the same idempotent handler", () => {
  assert.equal(POST, GET);
});
