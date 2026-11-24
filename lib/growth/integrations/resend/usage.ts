import { z } from "zod";

const MAX_RESPONSE_BYTES = 256 * 1024;
const USAGE_MAX_AGE_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
const count = z.number().int().nonnegative().safe();
const windowSchema = z
  .object({
    used: count,
    sent: count,
    received: count,
    limit: count.nullable(),
    resets_at: z.iso.datetime({ offset: true }),
  })
  .refine((window) => window.sent + window.received === window.used);
const usageSchema = z.object({
  object: z.literal("usage"),
  emails: z.object({ daily: windowSchema, monthly: windowSchema }),
  rate_limit: z.object({
    limit: z.number().int().positive().safe(),
    duration: z.string().regex(/^[1-9][0-9]{0,8}ms$/),
  }),
});

export type ResendUsage = {
  observedAt: string;
  validUntil: string;
  daily: z.infer<typeof windowSchema>;
  monthly: z.infer<typeof windowSchema>;
  rateLimit: { limit: number; duration: string };
};

type FetchRequest = (url: string, init?: RequestInit) => Promise<Response>;

export async function readBoundedResendJson(
  response: Response,
): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (
    length &&
    (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)
  ) {
    await response.body?.cancel();
    throw new Error("invalid response");
  }
  if (!response.body) throw new Error("missing response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error("response too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
  );
}

export async function readResendUsage(
  credential: string,
  dependencies: { request?: FetchRequest; now?: () => number } = {},
): Promise<{ status: "observed"; usage: ResendUsage } | { status: "held" }> {
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  if (
    !credential.trim() ||
    /[\r\n]/.test(credential) ||
    !Number.isFinite(startedAt)
  )
    return { status: "held" };
  try {
    const response = await (dependencies.request ?? fetch)(
      "https://api.resend.com/usage",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${credential}` },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { status: "held" };
    }
    const parsed = usageSchema.parse(await readBoundedResendJson(response));
    const finishedAt = now();
    const validUntil = Math.min(
      startedAt + USAGE_MAX_AGE_MS,
      Date.parse(parsed.emails.daily.resets_at),
      Date.parse(parsed.emails.monthly.resets_at),
    );
    if (
      !Number.isFinite(finishedAt) ||
      finishedAt < startedAt ||
      finishedAt >= validUntil
    )
      return { status: "held" };
    return {
      status: "observed",
      usage: {
        observedAt: new Date(startedAt).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        daily: parsed.emails.daily,
        monthly: parsed.emails.monthly,
        rateLimit: parsed.rate_limit,
      },
    };
  } catch {
    return { status: "held" };
  }
}
