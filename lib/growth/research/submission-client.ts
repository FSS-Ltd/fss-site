import { createHmac } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

import { globalResearchRunSchema } from "./global-schema";
import { MAX_RESEARCH_BUNDLE_BYTES } from "./limits";

const ENDPOINT = "https://faithfulsoftware.dev/api/agent/research-runs";
const resultSchema = z
  .object({
    ok: z.literal(true),
    runId: z.uuid(),
    accepted: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    acceptedProspects: z.array(
      z
        .object({
          candidateIndex: z.number().int().nonnegative(),
          prospectId: z.uuid(),
        })
        .strict(),
    ),
  })
  .strict();

export type SubmissionReport =
  | { ok: true; result: z.infer<typeof resultSchema>; attempts: number }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "invalid_credential"
        | "http_error"
        | "invalid_response"
        | "transport_error";
      httpStatus: number | null;
      attempts: number;
    };

/** Submit one immutable, locally validated batch. Retries retain its run ID and bytes. */
export async function submitGlobalResearch(input: {
  rawBody: string;
  secret: string;
  request?: typeof fetch;
  now?: () => Date;
  wait?: (milliseconds: number) => Promise<void>;
}): Promise<SubmissionReport> {
  let candidateCount: number;
  let rejectionCount: number;
  try {
    if (Buffer.byteLength(input.rawBody, "utf8") > MAX_RESEARCH_BUNDLE_BYTES) {
      throw new Error("Oversized input");
    }
    const run = globalResearchRunSchema.parse(JSON.parse(input.rawBody));
    candidateCount = run.prospects.length;
    rejectionCount = run.rejections.length;
  } catch {
    return {
      ok: false,
      reason: "invalid_input",
      httpStatus: null,
      attempts: 0,
    };
  }
  if (input.secret.trim().length < 32) {
    return {
      ok: false,
      reason: "invalid_credential",
      httpStatus: null,
      attempts: 0,
    };
  }

  const request = input.request ?? fetch;
  const wait =
    input.wait ??
    (async (milliseconds) => {
      await delay(milliseconds);
    });
  const now = input.now ?? (() => new Date());
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) await wait(attempt === 2 ? 30_000 : 120_000);
    const timestamp = String(Math.floor(now().getTime() / 1000));
    const signature = createHmac("sha256", input.secret)
      .update(timestamp)
      .update(".")
      .update(input.rawBody, "utf8")
      .digest("hex");
    let response: Response;
    try {
      response = await request(ENDPOINT, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "Content-Type": "application/json",
          "X-FSS-Key-Id": "weekday-agent-v1",
          "X-FSS-Timestamp": timestamp,
          "X-FSS-Signature": signature,
        },
        body: input.rawBody,
      });
    } catch {
      if (attempt < 3) continue;
      return {
        ok: false,
        reason: "transport_error",
        httpStatus: null,
        attempts: attempt,
      };
    }
    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < 3)
        continue;
      return {
        ok: false,
        reason: "http_error",
        httpStatus: response.status,
        attempts: attempt,
      };
    }
    try {
      const result = resultSchema.parse(await response.json());
      const indexes = result.acceptedProspects.map(
        (item) => item.candidateIndex,
      );
      const ids = result.acceptedProspects.map((item) => item.prospectId);
      if (
        result.accepted + result.duplicates !== candidateCount ||
        result.rejected !== rejectionCount ||
        result.accepted !== indexes.length ||
        indexes.some((index) => index >= candidateCount) ||
        new Set(indexes).size !== indexes.length ||
        new Set(ids).size !== ids.length
      ) {
        throw new Error("Inconsistent submission result");
      }
      return { ok: true, result, attempts: attempt };
    } catch {
      // The write may have succeeded. Preserve the batch for same-ID reconciliation.
      return {
        ok: false,
        reason: "invalid_response",
        httpStatus: response.status,
        attempts: attempt,
      };
    }
  }
  throw new Error("Unreachable submission state");
}
