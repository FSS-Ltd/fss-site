import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse,
  type GetEmailResponse,
} from "resend";
import { z } from "zod";
import type { EffectResult, OnboardingEmailInput } from "./types";

export type ResendEmailInput = Pick<
  OnboardingEmailInput,
  "email" | "attachment"
> & {
  lease: Pick<
    OnboardingEmailInput["lease"],
    "idempotencyKey" | "journeyId" | "jobId"
  >;
};

type Send = (
  body: CreateEmailOptions,
  options?: CreateEmailRequestOptions,
) => Promise<CreateEmailResponse>;
type Lookup = (id: string) => Promise<GetEmailResponse>;
type SenderDependencies = {
  provider?: { send: Send; get: Lookup };
  now?: () => Date;
  timeoutMs?: number;
};
const header = z
  .string()
  .trim()
  .min(1)
  .max(320)
  .refine((value) => !/[\r\n]/.test(value));
const envelope = z.object({
  from: header,
  replyTo: z.email(),
  to: z.email(),
  subject: header,
  html: z.string().min(1).max(256000),
  text: z.string().min(1).max(128000),
});
function failure(
  code: "configuration" | "unknown_outcome" | "rate_limited",
  retryable: boolean,
  uncertain: boolean,
  retryAfterMs?: number,
): EffectResult {
  return {
    status: "failed",
    code,
    retryable,
    uncertain,
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
  };
}
function providerDelay(
  value: string | undefined,
  now: Date,
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - now.getTime();
  return Number.isFinite(delay) && delay >= 0
    ? Math.min(delay, 4 * 60 * 60 * 1000)
    : undefined;
}
export function createOnboardingResendSender(
  apiKey: string,
  dependencies: SenderDependencies = {},
): (input: ResendEmailInput) => Promise<EffectResult> {
  const provider = dependencies.provider ?? new Resend(apiKey).emails;
  const now = dependencies.now ?? (() => new Date());
  const timeoutMs = dependencies.timeoutMs ?? 10000;
  return async ({ lease, email, attachment }) => {
    const parsed = envelope.safeParse(email);
    if (
      !parsed.success ||
      !lease.idempotencyKey ||
      lease.idempotencyKey.length > 256
    )
      return failure("configuration", false, false);
    if (
      attachment &&
      (attachment.content.length > 2 * 1024 * 1024 ||
        attachment.content.subarray(0, 5).toString() !== "%PDF-" ||
        !/^[a-zA-Z0-9_-]+\.pdf$/.test(attachment.filename))
    )
      return failure("configuration", false, false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        provider.send(
          {
            ...parsed.data,
            ...(attachment
              ? {
                  attachments: [
                    { ...attachment, contentType: "application/pdf" },
                  ],
                }
              : {}),
            tags: [
              { name: "operations_journey", value: lease.journeyId },
              { name: "operations_job", value: lease.jobId },
            ],
          },
          { idempotencyKey: lease.idempotencyKey },
        ),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        }),
      ]);
      if (result.error) {
        const status = result.error.statusCode;
        if (
          status === 429 ||
          result.error.name === "concurrent_idempotent_requests"
        )
          return failure(
            "rate_limited",
            true,
            false,
            providerDelay(result.headers?.["retry-after"], now()),
          );
        if (status === null || status >= 500)
          return failure("unknown_outcome", true, true);
        return failure("configuration", false, false);
      }
      if (!result.data.id) return failure("unknown_outcome", true, true);
      // A replayed send returns the original ID. Use the provider's original
      // acceptance time so a lost response cannot move the proposal deadline.
      const accepted = await Promise.race([
        provider.get(result.data.id),
        new Promise<never>((_, reject) => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
        }),
      ]);
      if (accepted.error || !accepted.data)
        return failure("unknown_outcome", true, true);
      const timestamp = Date.parse(accepted.data.created_at);
      if (
        accepted.data.id !== result.data.id ||
        accepted.data.to.length !== 1 ||
        accepted.data.to[0].toLowerCase() !== parsed.data.to.toLowerCase() ||
        accepted.data.from !== parsed.data.from ||
        !Number.isFinite(timestamp) ||
        timestamp > now().getTime() + 60000
      )
        return failure("unknown_outcome", false, true);
      return {
        status: "succeeded",
        receipt: {
          providerId: result.data.id,
          acceptedAt: new Date(timestamp).toISOString(),
        },
      };
    } catch {
      return failure("unknown_outcome", true, true);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
