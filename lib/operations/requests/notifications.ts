import { createHash } from "node:crypto";
import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { createOnboardingResendSender } from "../onboarding/resend-provider";
import { retryAt } from "../onboarding/schedule";

export type RequestEmailDelivery = {
  id: string;
  organisationId: string;
  requestId: string;
  kind: "review_requested" | "accepted";
  recipient: string;
  attempts: number;
  requestTitle: string;
  deliverableVersion: string;
  publicSummary: string;
  reviewInstructions: string;
  organisationName: string;
};

export type RequestEmailEffect = {
  status: "succeeded" | "failed";
  receipt?: { providerId: string; acceptedAt: string };
  code?: string;
  retryable?: boolean;
  uncertain?: boolean;
  retryAfterMs?: number;
};

export type RequestEmailSender = (input: {
  lease: Record<string, unknown>;
  email: Record<string, unknown>;
}) => Promise<RequestEmailEffect>;

// Adapt the onboarding Resend provider to the dispatch sender shape. The
// lease cast is confined here; the provider validates the envelope itself.
function providerSender(apiKey: string): RequestEmailSender {
  const send = createOnboardingResendSender(apiKey);
  return (input) => send(input as never);
}

const emailKinds = new Set(["review_requested", "accepted"]);
const senderCache = new Map<string, RequestEmailSender>();

function senderFor(apiKey: string): RequestEmailSender {
  let sender = senderCache.get(apiKey);
  if (!sender) {
    sender = providerSender(apiKey);
    senderCache.set(apiKey, sender);
  }
  return sender;
}

export type DispatchSummary = {
  fannedOut: number;
  emailsClaimed: number;
  emailsSent: number;
  emailsHeld: number;
};

// One dispatch pass: fan out unconsumed outbox rows, then attempt due emails.
// Requires the founder execution role (RLS-gated procedures).
export async function dispatchRequestNotifications(
  db: OperationsDb,
  options: {
    batch?: number;
    now?: () => Date;
    resendApiKey?: string;
    sender?: RequestEmailSender;
  } = {},
): Promise<DispatchSummary> {
  const batch = z.number().int().min(1).max(100).parse(options.batch ?? 25);
  const now = options.now ?? (() => new Date());
  const summary: DispatchSummary = {
    fannedOut: 0,
    emailsClaimed: 0,
    emailsSent: 0,
    emailsHeld: 0,
  };
  const [dispatched] = await db<
    { dispatched: number }[]
  >`select operations.dispatch_request_notifications(${batch}) as dispatched`;
  summary.fannedOut = dispatched.dispatched;
  const deliveries = await db<RequestEmailDelivery[]>`
    select id, organisation_id as "organisationId", request_id as "requestId", kind, recipient,
      attempts, request_title as "requestTitle", deliverable_version as "deliverableVersion",
      public_summary as "publicSummary", review_instructions as "reviewInstructions",
      organisation_name as "organisationName"
    from operations.claim_request_emails(${batch})`;
  summary.emailsClaimed = deliveries.length;
  const send =
    options.sender ??
    (options.resendApiKey ? senderFor(options.resendApiKey) : undefined);
  for (const delivery of deliveries) {
    if (!emailKinds.has(delivery.kind) || !send) {
      await failEmail(db, delivery.id, "configuration", null, true);
      summary.emailsHeld++;
      continue;
    }
    const result = await sendDeliveryEmail(send, delivery, now);
    if (result.status === "succeeded" && result.receipt) {
      await db`select operations.complete_request_email(${delivery.id},${result.receipt.providerId},${result.receipt.acceptedAt}::timestamptz)`;
      summary.emailsSent++;
      continue;
    }
    const next = result.retryable
      ? retryAt(now(), delivery.attempts, result.retryAfterMs ?? 0)
      : null;
    await failEmail(
      db,
      delivery.id,
      result.code ?? "unknown_outcome",
      next,
      next === null,
    );
    if (next) continue;
    summary.emailsHeld++;
  }
  return summary;
}

async function failEmail(
  db: OperationsDb,
  id: string,
  code: string,
  next: Date | null,
  held: boolean,
): Promise<void> {
  await db`select operations.fail_request_email(${id},${code},${next?.toISOString() ?? null}::timestamptz,${held})`;
}

// The idempotency key is deterministic per delivery row and attempt, so a
// retry after an uncertain outcome reuses the same provider key.
export function requestEmailIdempotencyKey(
  deliveryId: string,
  attempts: number,
): string {
  return createHash("sha256")
    .update(`request-email:${deliveryId}:${attempts}`)
    .digest("hex")
    .slice(0, 32);
}

async function sendDeliveryEmail(
  send: RequestEmailSender,
  delivery: RequestEmailDelivery,
  now: () => Date,
): Promise<RequestEmailEffect> {
  void now;
  const subject =
    delivery.kind === "review_requested"
      ? `Ready for your review: ${delivery.requestTitle}`
      : `Completed: ${delivery.requestTitle}`;
  const paragraphs = [
    `The ${delivery.organisationName} delivery workspace has an update about “${delivery.requestTitle}”.`,
    delivery.kind === "review_requested"
      ? `${delivery.publicSummary}\n\n${delivery.reviewInstructions}`
      : delivery.publicSummary ||
        "The work is complete and recorded in your portal.",
    "Open your client portal, choose Requests, and select the request to review the exact version and respond.",
    "Faithful Software Solutions",
  ];
  const escape = (value: string): string =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  const email = {
    from: "FSS <hello@faithfulsoftwaresolutions.co.uk>",
    replyTo: "j.ntagengwa@faithfulsoftware.dev",
    to: delivery.recipient,
    subject,
    html: `<main style="box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#24322d;overflow-wrap:anywhere;">${paragraphs.map((p) => `<p style="margin:0 0 20px;">${escape(p).replaceAll("\n", "<br>")}</p>`).join("")}</main>`,
    text: paragraphs.join("\n\n"),
  };
  const lease = {
    id: delivery.id,
    idempotencyKey: requestEmailIdempotencyKey(
      delivery.id,
      delivery.attempts,
    ),
    journeyId: delivery.requestId,
    jobId: delivery.id,
    organisationId: delivery.organisationId,
    recipient: delivery.recipient,
    step: "welcome",
    attempts: delivery.attempts,
  };
  try {
    return await send({ lease, email });
  } catch {
    return {
      status: "failed",
      code: "unknown_outcome",
      retryable: true,
      uncertain: true,
    };
  }
}
