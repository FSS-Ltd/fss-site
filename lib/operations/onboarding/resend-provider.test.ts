import assert from "node:assert/strict";
import test from "node:test";
import type {
  CreateEmailResponse,
  GetEmailResponse,
  GetEmailResponseSuccess,
} from "resend";
import { createOnboardingResendSender } from "./resend-provider";
import type { OnboardingEmailInput } from "./types";
import { preparedWelcomeFixture } from "./fixtures";
async function input(): Promise<OnboardingEmailInput> {
  const welcome = await preparedWelcomeFixture();
  return {
    email: welcome.snapshot.welcome,
    attachment: { filename: "welcome.pdf", content: welcome.pdf },
    lease: {
      jobId: "11111111-1111-4111-8111-111111111111",
      journeyId: "22222222-2222-4222-8222-222222222222",
      organisationId: "33333333-3333-4333-8333-333333333333",
      agreementId: "44444444-4444-4444-8444-444444444444",
      approvalId: "55555555-5555-4555-8555-555555555555",
      signingApprovalId: null,
      step: "welcome",
      generation: 1,
      leaseToken: "66666666-6666-4666-8666-666666666666",
      idempotencyKey: "onboarding:stable-key",
      recipient: welcome.snapshot.recipient,
      uncertain: false,
      attempts: 0,
      firstAttemptAt: null,
      dueAt: "2026-09-08T09:00:00Z",
      snapshot: welcome.snapshot,
      proposal: null,
      pdf: welcome.pdf,
      invoice: null,
      invitation: null,
    },
  };
}
const accepted: GetEmailResponseSuccess = {
  id: "email-1",
  created_at: "2026-09-08T09:00:00Z",
  from: "service@example.test",
  to: ["signer0@example.test"],
  bcc: null,
  cc: null,
  html: null,
  text: null,
  reply_to: null,
  subject: "Welcome",
  message_id: "message-1",
  last_event: "sent",
  scheduled_at: null,
  object: "email",
};
const now = () => new Date("2026-09-08T10:00:00Z");
const get = async (): Promise<GetEmailResponse> => ({
  data: accepted,
  error: null,
  headers: null,
});
test("sender preserves frozen bytes and original acceptance time across replay", async () => {
  const value = await input();
  let calls = 0;
  const send = createOnboardingResendSender("re_test", {
    now,
    provider: {
      get,
      async send(body, options) {
        calls++;
        assert.equal(options?.idempotencyKey, value.lease.idempotencyKey);
        assert.equal(body.html, value.email.html);
        assert.deepEqual(
          body.attachments?.[0].content,
          value.attachment?.content,
        );
        assert.equal(body.tags?.[1].value, value.lease.jobId);
        return { data: { id: "email-1" }, error: null, headers: null };
      },
    },
  });
  for (let i = 0; i < 2; i++)
    assert.deepEqual(await send(value), {
      status: "succeeded",
      receipt: {
        providerId: "email-1",
        acceptedAt: "2026-09-08T09:00:00.000Z",
      },
    });
  assert.equal(calls, 2);
});
test("sender holds malformed approved headers and attachment before provider call", async () => {
  const value = await input();
  let calls = 0;
  const send = createOnboardingResendSender("re_test", {
    provider: {
      get,
      async send() {
        calls++;
        throw Error();
      },
    },
  });
  const invalid = [
    {
      ...value,
      email: { ...value.email, subject: "Hello\r\nBcc:other@test.com" },
    },
    {
      ...value,
      attachment: { filename: "../file.pdf", content: Buffer.from("%PDF-") },
    },
    {
      ...value,
      attachment: { filename: "file.pdf", content: Buffer.alloc(2097153) },
    },
    {
      ...value,
      attachment: { filename: "file.pdf", content: Buffer.from("not PDF") },
    },
  ];
  for (const item of invalid) assert.equal((await send(item)).status, "failed");
  assert.equal(calls, 0);
});
test("provider failures distinguish throttling, uncertain outcomes and configuration holds", async () => {
  const value = await input();
  for (const status of [429, 500, null, 401]) {
    const response: CreateEmailResponse = {
      data: null,
      error: {
        name: status === 429 ? "rate_limit_exceeded" : "application_error",
        message: "redacted",
        statusCode: status,
      },
      headers: { "retry-after": "300" },
    };
    const send = createOnboardingResendSender("re_test", {
      now,
      provider: { get, send: async () => response },
    });
    const result = await send(value);
    assert.equal(result.status, "failed");
    if (result.status !== "failed") throw Error();
    assert.equal(result.uncertain, status === 500 || status === null);
    assert.equal(result.retryable, status !== 401);
    if (status === 429) assert.equal(result.retryAfterMs, 300000);
  }
  const successful = async (): Promise<CreateEmailResponse> => ({
    data: { id: "email-1" },
    error: null,
    headers: null,
  });
  for (const lookup of [
    async (): Promise<GetEmailResponse> => ({
      data: { ...accepted, to: ["wrong@example.test"] },
      error: null,
      headers: null,
    }),
    async (): Promise<GetEmailResponse> => {
      throw Error("network");
    },
  ]) {
    const result = await createOnboardingResendSender("re_test", {
      now,
      provider: { send: successful, get: lookup },
    })(value);
    assert.equal(result.status, "failed");
    if (result.status === "failed") assert.equal(result.uncertain, true);
  }
  const timed = await createOnboardingResendSender("re_test", {
    timeoutMs: 1,
    provider: { get, send: () => new Promise(() => {}) },
  })(value);
  assert.equal(timed.status, "failed");
});
