import assert from "node:assert/strict";
import test from "node:test";
import type { GrowthDb } from "../db/types";
import { createResendOutreachWorker } from "./resend-outreach-worker";

const db = {} as GrowthDb;
type Ports = Parameters<typeof createResendOutreachWorker>[0];
const context = {
  connectionId: "11111111-1111-4111-8111-111111111111",
  runtime: {
    binding: {
      team: "test",
      environment: "development" as const,
      sender: "a@example.org",
      domain: "example.org",
      replyTo: "a@example.org",
      sendGeneration: "22222222-2222-4222-8222-222222222222",
      usageGeneration: "33333333-3333-4333-8333-333333333333",
      webhookGeneration: "44444444-4444-4444-8444-444444444444",
    },
    sendCredential: "test-send",
    usageCredential: "test-usage",
    webhookSecret: "test-hook",
  },
};
function setup() {
  const calls: string[] = [];
  const ports: Ports = {
    workerId: "test-worker",
    context: async () => {
      calls.push("context");
      return context;
    },
    due: async () => {
      calls.push("due");
      return true;
    },
    refresh: async () => {
      calls.push("refresh");
      return { status: "complete" };
    },
    readiness: async () => {
      calls.push("readiness");
      return { status: "ready" };
    },
    first: async (_db, input) => {
      calls.push(`first:${input.limit}`);
      assert.equal("webhookSecret" in input.binding.runtime, false);
      assert.equal(
        input.binding.runtime.binding.webhookGeneration,
        context.runtime.binding.webhookGeneration,
      );
      return { claimed: 0, prepared: 0, held: 0, retry: 0 };
    },
    dispatch: {
      available: async () => ({ status: "ready" }),
      next: async (_db, _id, excluded) =>
        excluded.length ? null : "55555555-5555-4555-8555-555555555555",
      claim: async (_db, input) => {
        calls.push("claim");
        return { id: input.messageId };
      },
      reserve: async () => {
        calls.push("reserve");
        return { status: "held", reason: "permission_invalid" };
      },
      submit: async () => {
        throw new Error("unexpected submit");
      },
      cancelReservation: async () => {
        calls.push("cancel-reservation");
        return { status: "ready", value: { state: "cancelled" } };
      },
      closeClaim: async (_db, input) => {
        calls.push(`close:${input.disposition}:${input.reason}`);
        return true;
      },
    },
  };
  return { ports, calls };
}

test("idle invocation performs no provider request or preparation", async () => {
  const { ports, calls } = setup();
  ports.due = async () => {
    calls.push("due");
    return false;
  };
  const result = await createResendOutreachWorker(ports)(db);
  assert.equal(result.status, "idle");
  assert.deepEqual(calls, ["context", "due"]);
});

test("usage refresh and readiness failure stop before claiming", async () => {
  const { ports, calls } = setup();
  ports.refresh = async () => {
    calls.push("refresh");
    return { status: "held", reason: "usage_unknown" };
  };
  const result = await createResendOutreachWorker(ports)(db);
  assert.equal(result.reason, "usage_unknown");
  assert.deepEqual(calls, ["context", "due", "refresh"]);
});

test("hard-held delivery path may prepare but cannot claim or send", async () => {
  const { ports, calls } = setup();
  if (!ports.dispatch) throw new Error("missing fake ports");
  ports.dispatch.available = async () => ({
    status: "held",
    reason: "delivery_path_unavailable",
  });
  const result = await createResendOutreachWorker(ports)(db);
  assert.equal(result.reason, "delivery_path_unavailable");
  assert.deepEqual(calls, [
    "context",
    "due",
    "refresh",
    "readiness",
    "first:25",
  ]);
});

test("invalid recipient is cancelled and a broad limit releases and stops", async () => {
  const first = setup();
  const result = await createResendOutreachWorker(first.ports)(db);
  assert.equal(result.held, 1);
  assert.ok(first.calls.includes("close:cancel:permission_invalid"));
  const second = setup();
  if (!second.ports.dispatch) throw new Error("missing fake ports");
  second.ports.dispatch.reserve = async () => ({
    status: "held",
    reason: "global_limit",
  });
  const held = await createResendOutreachWorker(second.ports)(db);
  assert.equal(held.reason, "global_limit");
  assert.ok(second.calls.includes("close:release:global_limit"));
  const paused = setup();
  if (!paused.ports.dispatch) throw new Error("missing fake ports");
  paused.ports.dispatch.reserve = async () => ({
    status: "held",
    reason: "policy_not_authorized",
  });
  const pausedResult = await createResendOutreachWorker(paused.ports)(db);
  assert.equal(pausedResult.reason, "policy_not_authorized");
  assert.ok(paused.calls.includes("close:release:policy_not_authorized"));
});

test("uncertain submission stops without releasing a possibly issued lease", async () => {
  const { ports, calls } = setup();
  if (!ports.dispatch) throw new Error("missing fake ports");
  ports.dispatch.reserve = async () => ({
    status: "ready",
    value: {
      reservationId: "reservation",
      fence: 1,
      preparation: {
        messageId: "message",
        sequenceId: "sequence",
        recipient: "a@example.org",
        subject: "s",
        html: "h",
        text: "t",
        gmailThreadId: null,
        references: [],
        fingerprint: "a".repeat(64),
      },
    },
  });
  ports.dispatch.submit = async () => ({
    status: "uncertain",
    reason: "transport_unknown",
  });
  const result = await createResendOutreachWorker(ports)(db);
  assert.equal(result.uncertain, 1);
  assert.equal(result.reason, "transport_unknown");
  assert.ok(!calls.some((call) => call.startsWith("close:")));
  assert.ok(!calls.includes("cancel-reservation"));
});

test("preparation and message claims share a maximum of 25", async () => {
  const { ports } = setup();
  ports.first = async () => ({ claimed: 25, prepared: 25, held: 0, retry: 0 });
  const result = await createResendOutreachWorker(ports)(db);
  assert.equal(result.first.claimed, 25);
  assert.equal(result.claimed, 0);
});

test("live factory performs no provider request when the reviewed account has no due work", async () => {
  const { createLiveResendOutreachWorker } =
    await import("./resend-outreach-worker");
  const values: Record<string, string> = {
    RESEND_OUTREACH_FROM_EMAIL: context.runtime.binding.sender,
    RESEND_OUTREACH_REPLY_TO_EMAIL: context.runtime.binding.replyTo,
    RESEND_OUTREACH_TEAM: context.runtime.binding.team,
    RESEND_OUTREACH_ENVIRONMENT: context.runtime.binding.environment,
    RESEND_OUTREACH_SEND_GENERATION: context.runtime.binding.sendGeneration,
    RESEND_OUTREACH_USAGE_GENERATION: context.runtime.binding.usageGeneration,
    RESEND_OUTREACH_WEBHOOK_GENERATION:
      context.runtime.binding.webhookGeneration,
    RESEND_OUTREACH_SEND_API_KEY: context.runtime.sendCredential,
    RESEND_OUTREACH_USAGE_API_KEY: context.runtime.usageCredential,
    RESEND_OUTREACH_WEBHOOK_SECRET: context.runtime.webhookSecret,
  };
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  const oldFetch = globalThis.fetch;
  let calls = 0;
  const fake = (async (strings: TemplateStringsArray) => {
    calls++;
    const text = strings.join("?");
    if (text.includes("from growth.outreach_account_controls"))
      return [
        {
          connectionId: context.connectionId,
          binding: context.runtime.binding,
          review: { binding: context.runtime.binding },
          gmailSubject: "subject",
          gmailStatus: "connected",
          gmailScopes: [
            "openid",
            "email",
            "https://www.googleapis.com/auth/gmail.modify",
          ],
        },
      ];
    if (text.includes("as due")) return [{ due: false }];
    throw new Error("unexpected database query");
  }) as unknown as GrowthDb;
  try {
    Object.assign(process.env, values);
    globalThis.fetch = async () => {
      throw new Error("unexpected provider call");
    };
    const result = await createLiveResendOutreachWorker()(fake);
    assert.equal(result.status, "idle");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of Object.keys(values)) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("preparation-only invocation never claims or invokes a transport", async () => {
  const { ports, calls } = setup();
  ports.prepareOnly = true;
  ports.follow = async (_db, _context, limit) => {
    assert.equal(limit, 25);
    calls.push("follow");
    return { claimed: 2, prepared: 1, held: 1 };
  };
  const result = await createResendOutreachWorker(ports)(db);
  assert.equal(result.status, "complete");
  assert.equal(result.followUpClaimed, 2);
  assert.equal(result.followUpPrepared, 1);
  assert.equal(result.followUpHeld, 1);
  assert.deepEqual(calls, [
    "context",
    "due",
    "refresh",
    "readiness",
    "first:25",
    "follow",
  ]);
});

test("follow-up preparation and dispatch share one bounded batch", async () => {
  const { ports, calls } = setup();
  ports.first = async () => ({ claimed: 20, prepared: 20, held: 0, retry: 0 });
  ports.follow = async (_db, _context, limit) => {
    assert.equal(limit, 5);
    return { claimed: 5, prepared: 5, held: 0 };
  };
  const result = await createResendOutreachWorker(ports)(db);
  assert.equal(result.status, "complete");
  assert.equal(result.followUpClaimed, 5);
  assert.equal(result.claimed, 0);
  assert.equal(calls.includes("claim"), false);
});
