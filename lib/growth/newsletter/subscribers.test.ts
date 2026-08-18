import assert from "node:assert/strict";
import test from "node:test";

import {
  NewsletterConsentError,
  normaliseNewsletterEmail,
  recordNewsletterOptIn,
  recordNewsletterUnsubscribe,
  type NewsletterConsentInput,
  type NewsletterSubscriberDependencies,
  type NewsletterSubscriberRecord,
} from "./subscribers";

let nextId = 1;

function createHarness(seed: NewsletterSubscriberRecord[] = []) {
  const store = new Map<string, NewsletterSubscriberRecord>(
    seed.map((record) => [record.normalisedEmail, record]),
  );

  const dependencies: NewsletterSubscriberDependencies = {
    findSubscriberByEmail: async (normalisedEmail) => store.get(normalisedEmail) ?? null,
    insertSubscriber: async (input) => {
      const record: NewsletterSubscriberRecord = {
        id: `subscriber-${nextId++}`,
        normalisedEmail: input.normalisedEmail,
        status: "subscribed",
        consentedAt: input.consentedAt,
        unsubscribedAt: null,
      };
      store.set(record.normalisedEmail, record);
      return record;
    },
    updateSubscriberConsent: async (id, input) => {
      const existing = [...store.values()].find((record) => record.id === id);
      if (!existing) {
        throw new Error("Subscriber not found.");
      }
      const updated: NewsletterSubscriberRecord = {
        ...existing,
        status: "subscribed",
        consentedAt: input.consentedAt,
        unsubscribedAt: null,
      };
      store.set(updated.normalisedEmail, updated);
      return updated;
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

function optInInput(overrides: Partial<NewsletterConsentInput> = {}): NewsletterConsentInput {
  return {
    email: "Ada@Example.test",
    consentSource: "newsletter_signup",
    consentTextVersion: "v1",
    consentEvidence: "checkbox on /newsletter form",
    consentedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

test("records a new opt-in for an unknown address", async () => {
  const { dependencies } = createHarness();
  const record = await recordNewsletterOptIn(optInInput(), dependencies);

  assert.equal(record.status, "subscribed");
  assert.equal(record.normalisedEmail, "ada@example.test");
});

test("treats email identity as case-insensitive", async () => {
  const { dependencies, store } = createHarness();
  await recordNewsletterOptIn(optInInput({ email: "Ada@Example.test" }), dependencies);
  await recordNewsletterOptIn(
    optInInput({ email: "ADA@EXAMPLE.TEST", consentedAt: new Date("2026-01-02T00:00:00Z") }),
    dependencies,
  );

  assert.equal(store.size, 1);
  assert.equal(normaliseNewsletterEmail("ADA@Example.TEST"), "ada@example.test");
});

test("allows a repeated opt-in and refreshes consent evidence", async () => {
  const { dependencies } = createHarness();
  const first = await recordNewsletterOptIn(optInInput(), dependencies);
  const second = await recordNewsletterOptIn(
    optInInput({ consentEvidence: "checkbox on /newsletter form, confirmed again" }),
    dependencies,
  );

  assert.equal(first.id, second.id);
  assert.equal(second.status, "subscribed");
});

test("rejects opt-in with blank required fields", async () => {
  const { dependencies } = createHarness();
  await assert.rejects(
    recordNewsletterOptIn(optInInput({ consentSource: "  " }), dependencies),
    NewsletterConsentError,
  );
});

test("unsubscribes a subscribed address", async () => {
  const { dependencies } = createHarness();
  await recordNewsletterOptIn(optInInput(), dependencies);

  const result = await recordNewsletterUnsubscribe(
    "ada@example.test",
    dependencies,
    new Date("2026-01-03T00:00:00Z"),
  );

  assert.equal(result?.status, "unsubscribed");
  assert.deepEqual(result?.unsubscribedAt, new Date("2026-01-03T00:00:00Z"));
});

test("unsubscribing an unknown address is a safe no-op", async () => {
  const { dependencies } = createHarness();
  const result = await recordNewsletterUnsubscribe("nobody@example.test", dependencies);
  assert.equal(result, null);
});

test("unsubscribing an already-unsubscribed address is idempotent", async () => {
  const { dependencies } = createHarness();
  await recordNewsletterOptIn(optInInput(), dependencies);
  const first = await recordNewsletterUnsubscribe("ada@example.test", dependencies, new Date("2026-01-03T00:00:00Z"));
  const second = await recordNewsletterUnsubscribe("ada@example.test", dependencies, new Date("2026-01-04T00:00:00Z"));

  assert.deepEqual(first, second);
});

test("re-consent after unsubscribe succeeds with fresher consent evidence", async () => {
  const { dependencies } = createHarness();
  await recordNewsletterOptIn(optInInput({ consentedAt: new Date("2026-01-01T00:00:00Z") }), dependencies);
  await recordNewsletterUnsubscribe("ada@example.test", dependencies, new Date("2026-01-02T00:00:00Z"));

  const resubscribed = await recordNewsletterOptIn(
    optInInput({ consentedAt: new Date("2026-01-05T00:00:00Z") }),
    dependencies,
  );

  assert.equal(resubscribed.status, "subscribed");
});

test("re-consent after unsubscribe rejects stale consent evidence", async () => {
  const { dependencies } = createHarness();
  await recordNewsletterOptIn(optInInput({ consentedAt: new Date("2026-01-05T00:00:00Z") }), dependencies);
  await recordNewsletterUnsubscribe("ada@example.test", dependencies, new Date("2026-01-06T00:00:00Z"));

  await assert.rejects(
    recordNewsletterOptIn(optInInput({ consentedAt: new Date("2026-01-05T00:00:00Z") }), dependencies),
    (error: unknown) => {
      assert.ok(error instanceof NewsletterConsentError);
      assert.equal(error.code, "stale_consent");
      return true;
    },
  );
});

test("a bounced address cannot be resubscribed from a public opt-in", async () => {
  const { dependencies, store } = createHarness([
    {
      id: "subscriber-bounced",
      normalisedEmail: "bounced@example.test",
      status: "bounced",
      consentedAt: null,
      unsubscribedAt: null,
    },
  ]);

  await assert.rejects(
    recordNewsletterOptIn(optInInput({ email: "bounced@example.test" }), dependencies),
    (error: unknown) => {
      assert.ok(error instanceof NewsletterConsentError);
      assert.equal(error.code, "already_suppressed");
      return true;
    },
  );
  assert.equal(store.get("bounced@example.test")?.status, "bounced");
});

test("a complained address cannot be resubscribed from a public opt-in", async () => {
  const { dependencies } = createHarness([
    {
      id: "subscriber-complained",
      normalisedEmail: "complained@example.test",
      status: "complained",
      consentedAt: null,
      unsubscribedAt: null,
    },
  ]);

  await assert.rejects(
    recordNewsletterOptIn(optInInput({ email: "complained@example.test" }), dependencies),
    (error: unknown) => {
      assert.ok(error instanceof NewsletterConsentError);
      assert.equal(error.code, "already_suppressed");
      return true;
    },
  );
});

test("a race between dispatch and unsubscribe resolves to unsubscribed", async () => {
  const { dependencies } = createHarness();
  await recordNewsletterOptIn(optInInput(), dependencies);

  await recordNewsletterUnsubscribe("ada@example.test", dependencies, new Date("2026-01-03T00:00:00Z"));
  const afterUnsubscribe = await dependencies.findSubscriberByEmail("ada@example.test");

  assert.equal(afterUnsubscribe?.status, "unsubscribed");
});
