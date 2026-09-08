import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { onboardingFixture } from "./onboarding-fixtures";
import { onboardingEffects } from "../../../lib/operations/onboarding/effects";
import { applyOnboardingDeliveryEvent } from "../../../lib/operations/onboarding/resend-webhook";
test("production sender wiring uses frozen welcome, checks global suppression and accepts early verified bounce", async (t) => {
  const f = await onboardingFixture(t, 1);
  const names = [
    "OPERATIONS_ENABLED",
    "OPERATIONS_ONBOARDING_ENABLED",
    "OPERATIONS_PORTAL_ORIGIN",
    "OPERATIONS_RESEND_API_KEY",
    "OPERATIONS_ONBOARDING_INVITE_KEY",
    "OPERATIONS_BILLING_ENABLED",
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  const fetch = globalThis.fetch;
  let sent = 0;
  t.after(() => {
    globalThis.fetch = fetch;
    for (const [name, value] of previous)
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  });
  Object.assign(process.env, {
    OPERATIONS_ENABLED: "true",
    OPERATIONS_ONBOARDING_ENABLED: "true",
    OPERATIONS_PORTAL_ORIGIN: "https://example.test",
    OPERATIONS_RESEND_API_KEY: "re_synthetic",
    OPERATIONS_ONBOARDING_INVITE_KEY: Buffer.alloc(32, 8).toString("base64"),
    OPERATIONS_BILLING_ENABLED: "false",
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(
      url.startsWith("https://api.resend.com/emails"),
      "Unexpected provider request",
    );
    if (init?.method === "POST") {
      sent++;
      const body = JSON.parse(String(init.body));
      assert.equal(body.html, f.prepared.snapshot.welcome.html);
      return Response.json({ id: "email-synthetic" });
    }
    return Response.json({
      id: "email-synthetic",
      created_at: new Date().toISOString(),
      from: f.prepared.snapshot.welcome.from,
      to: [f.prepared.snapshot.recipient],
    });
  };
  const [lease] = await f.store.claim(1, new Date());
  await f.store.beginEffect(lease, new Date());
  const effects = onboardingEffects(f.worker);
  const input = {
    lease,
    email: f.prepared.snapshot.welcome,
    attachment: { filename: "welcome.pdf", content: f.prepared.pdf },
  };
  assert.equal((await effects.sendEmail(input)).status, "succeeded");
  assert.equal(sent, 1);
  assert.equal(
    (
      await effects.sendEmail({
        ...input,
        email: { ...input.email, to: "wrong@example.test" },
      })
    ).status,
    "failed",
  );
  assert.equal((await effects.createInvoice(lease)).status, "failed");
  try {
    await f.admin`insert into growth.suppressions(normalised_email,reason,source,created_by) values(${lease.recipient},'bounce','onboarding-test','test')`;
    assert.equal((await effects.sendEmail(input)).status, "failed");
    assert.equal(sent, 1);
  } finally {
    await f.admin`delete from growth.suppressions where normalised_email=${lease.recipient} and source='onboarding-test'`;
  }
  const event = {
    type: "email.bounced" as const,
    data: {
      email_id: "email-synthetic",
      from: input.email.from,
      to: [lease.recipient],
      tags: { operations_job: lease.jobId },
    },
  };
  await applyOnboardingDeliveryEvent(
    f.worker,
    "synthetic-account",
    randomUUID(),
    { ...event, data: { ...event.data, to: ["wrong@example.test"] } },
  );
  const [active] = await f.admin<
    { state: string }[]
  >`select state from operations.onboarding_journeys where id=${f.journeyId}`;
  assert.equal(active.state, "active");
  const id = randomUUID();
  await applyOnboardingDeliveryEvent(f.worker, "synthetic-account", id, event);
  await applyOnboardingDeliveryEvent(f.worker, "synthetic-account", id, event);
  const [blocked] = await f.admin<
    { state: string }[]
  >`select state from operations.onboarding_journeys where id=${f.journeyId}`;
  assert.equal(blocked.state, "blocked");
  const [count] = await f.admin<
    { n: number }[]
  >`select count(*)::integer as n from operations.onboarding_delivery_events where job_id=${lease.jobId}`;
  assert.equal(count.n, 1);
});
