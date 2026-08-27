import { createHmac } from "node:crypto";

import { z } from "zod";

import { isCurrentTenPreviewBackfillRunId } from "../prospect-previews/generation/current-ten-backfill";

const AGENT_KEY_ID = "weekday-agent-v1";
const PREVIEW_PR_ENDPOINT = new URL(
  "https://faithfulsoftware.dev/api/agent/prospect-preview-prs",
);
const CURRENT_TEN_PREVIEW_PR_ENDPOINT = new URL(
  "https://faithfulsoftware.dev/api/agent/current-ten-prospect-preview-pr",
);
const EXTERNAL_RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,199}$/;

const responseSchema = z
  .object({
    externalRunId: z.string().min(1).max(200),
    status: z.enum(["created", "existing", "disabled", "unavailable"]),
    generated: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
    pullRequestNumber: z.number().int().positive().nullable(),
  })
  .strict();

export type PreviewPrTriggerRequest = (
  url: URL,
  init: RequestInit,
) => Promise<Response>;

export type TriggerScheduledPreviewPullRequestInput = {
  externalRunId: string;
  secret: string;
  now?: () => Date;
  request?: PreviewPrTriggerRequest;
};

export type TriggerScheduledPreviewPullRequestResult = { ok: true } | { ok: false };

type PreviewPrTriggerTarget = {
  endpoint: URL;
  isValidRunId: (externalRunId: string) => boolean;
  invalidRunIdMessage: string;
};

function validateInput(
  input: TriggerScheduledPreviewPullRequestInput,
  target: PreviewPrTriggerTarget,
): void {
  if (
    !target.isValidRunId(input.externalRunId) ||
    input.externalRunId !== input.externalRunId.trim()
  ) {
    throw new TypeError(target.invalidRunIdMessage);
  }
  if (input.secret.replace(/\s/g, "").length < 32) {
    throw new TypeError("Preview-generation signing secret is invalid.");
  }
}

function createSignature(input: {
  secret: string;
  timestamp: string;
  body: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(input.timestamp)
    .update(".")
    .update(input.body)
    .digest("hex");
}

async function isValidResponse(
  response: Response,
  externalRunId: string,
): Promise<boolean> {
  if (!response.ok) return false;
  try {
    const parsed = responseSchema.safeParse(await response.json());
    return parsed.success && parsed.data.externalRunId === externalRunId;
  } catch {
    return false;
  }
}

async function triggerPreviewPullRequest(
  input: TriggerScheduledPreviewPullRequestInput,
  target: PreviewPrTriggerTarget,
): Promise<TriggerScheduledPreviewPullRequestResult> {
  validateInput(input, target);
  const now = (input.now ?? (() => new Date()))();
  if (Number.isNaN(now.getTime())) {
    throw new TypeError("Preview-generation trigger time is invalid.");
  }
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const body = JSON.stringify({ externalRunId: input.externalRunId });
  const headers = new Headers({
    "content-type": "application/json",
    "x-fss-key-id": AGENT_KEY_ID,
    "x-fss-timestamp": timestamp,
    "x-fss-signature": createSignature({
      secret: input.secret,
      timestamp,
      body,
    }),
  });
  const request = input.request ?? ((url, init) => fetch(url, init));

  try {
    const response = await request(target.endpoint, {
      method: "POST",
      headers,
      body,
    });
    return (await isValidResponse(response, input.externalRunId))
      ? { ok: true }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function triggerScheduledPreviewPullRequest(
  input: TriggerScheduledPreviewPullRequestInput,
): Promise<TriggerScheduledPreviewPullRequestResult> {
  return triggerPreviewPullRequest(input, {
    endpoint: PREVIEW_PR_ENDPOINT,
    isValidRunId: (externalRunId) => EXTERNAL_RUN_ID_PATTERN.test(externalRunId),
    invalidRunIdMessage: "Preview-generation run ID is invalid.",
  });
}

export async function triggerCurrentTenPreviewPullRequest(
  input: TriggerScheduledPreviewPullRequestInput,
): Promise<TriggerScheduledPreviewPullRequestResult> {
  return triggerPreviewPullRequest(input, {
    endpoint: CURRENT_TEN_PREVIEW_PR_ENDPOINT,
    isValidRunId: isCurrentTenPreviewBackfillRunId,
    invalidRunIdMessage: "Current-ten preview-generation run ID is invalid.",
  });
}
