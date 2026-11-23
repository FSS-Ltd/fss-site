import { z } from "zod";
import { readBoundedResendJson } from "./usage";

const MAX_REQUEST_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const safeHeader = z
  .string()
  .min(1)
  .max(320)
  .refine((value) => value.trim() === value && !/[\x00-\x1f\x7f]/.test(value));
const payloadSchema = z.strictObject({
  from: safeHeader,
  to: z.tuple([z.email().max(320)]),
  reply_to: z.email().max(320),
  subject: safeHeader,
  html: z.string().min(1),
  text: z.string().min(1),
  headers: z
    .record(z.string().regex(/^[A-Za-z0-9-]+$/), safeHeader)
    .refine((headers) =>
      Object.keys(headers).every((name) =>
        [
          "list-unsubscribe",
          "list-unsubscribe-post",
          "in-reply-to",
          "references",
        ].includes(name.toLowerCase()),
      ),
    )
    .optional(),
});
const resultSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
});
type FetchRequest = (url: string, init?: RequestInit) => Promise<Response>;
export type ResendOutreachResult =
  | { status: "accepted"; providerMessageId: string }
  | { status: "not_invoked" }
  | { status: "invoked_unknown"; httpStatus: number | null };

/** Caller must have committed the exact body/key under its durable authority before invocation. */
export function createResendOutreachTransport(
  credential: string,
  dependencies: { request?: FetchRequest } = {},
): {
  sendOnce(
    input: { rawBody: string; idempotencyKey: string },
    finalGate: () => boolean,
  ): Promise<ResendOutreachResult>;
} {
  return {
    async sendOnce(input, finalGate) {
      if (
        !credential.trim() ||
        /[\r\n]/.test(credential) ||
        !/^[A-Za-z0-9_/-]{1,256}$/.test(input.idempotencyKey) ||
        Buffer.byteLength(input.rawBody, "utf8") > MAX_REQUEST_BYTES
      )
        return { status: "not_invoked" };
      try {
        payloadSchema.parse(JSON.parse(input.rawBody));
        if (finalGate() !== true) return { status: "not_invoked" };
      } catch {
        return { status: "not_invoked" };
      }
      try {
        const response = await (dependencies.request ?? fetch)(
          "https://api.resend.com/emails",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${credential}`,
              "Content-Type": "application/json",
              "Idempotency-Key": input.idempotencyKey,
            },
            body: input.rawBody,
            redirect: "error",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
        );
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          return { status: "invoked_unknown", httpStatus: response.status };
        }
        const result = resultSchema.parse(
          await readBoundedResendJson(response),
        );
        return { status: "accepted", providerMessageId: result.id };
      } catch {
        return { status: "invoked_unknown", httpStatus: null };
      }
    },
  };
}
