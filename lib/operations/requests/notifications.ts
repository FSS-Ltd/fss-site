import { createHash } from "node:crypto";
import { z } from "zod";
import { resolveSiteUrl } from "@/lib/config/site-url";
import type { OperationsDb } from "../db/client";
import { createOnboardingResendSender } from "../onboarding/resend-provider";
import { retryAt } from "../onboarding/schedule";

export type RequestEmailDelivery = {
  id: string;
  organisationId: string;
  requestId: string;
  kind: "review_requested" | "accepted" | "closed";
  recipient: string;
  attempts: number;
  requestTitle: string;
  deliverableVersion: string;
  publicSummary: string;
  reviewInstructions: string;
  organisationName: string;
  completionAt?: string | null;
  closureReason?: string;
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

const emailKinds = new Set(["review_requested", "accepted", "closed"]);
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
  const email = buildRequestDeliveryEmail(delivery);
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

type RequestDeliveryEmail = {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function completionDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(parsed);
}

function portalRequestUrl(
  delivery: RequestEmailDelivery,
  page: "review" | "completed",
  siteUrl: string,
): string {
  const path =
    page === "review"
      ? `/portal/requests/${encodeURIComponent(delivery.requestId)}/review`
      : `/portal/requests/${encodeURIComponent(delivery.requestId)}`;
  const url = new URL(path, siteUrl);
  url.searchParams.set("organisationId", delivery.organisationId);
  return url.toString();
}

/**
 * Produces the full, public-only request email envelope. Decisions still live
 * behind the authenticated portal routes; these messages contain no private
 * deliverables or bearer actions.
 */
export function buildRequestDeliveryEmail(
  delivery: RequestEmailDelivery,
  siteUrl = resolveSiteUrl(),
): RequestDeliveryEmail {
  const review = delivery.kind === "review_requested";
  const closed = delivery.kind === "closed";
  const actionUrl = portalRequestUrl(
    delivery,
    review ? "review" : "completed",
    siteUrl,
  );
  const heading = review ? "Your update is ready." : "All done.";
  const subject = review
    ? `Ready for your review: ${delivery.requestTitle}`
    : closed
      ? `FSS closed: ${delivery.requestTitle}`
      : `Completed: ${delivery.requestTitle}`;
  const actionLabel = review ? "Review the update" : "View completed work";
  const acceptedOn = completionDate(delivery.completionAt ?? null);
  const detail = review
    ? [
        delivery.publicSummary || "FSS has prepared an update for your review.",
        `Review ${delivery.deliverableVersion} and let us know whether it meets the agreed outcome.`,
        delivery.reviewInstructions
          ? `What to check: ${delivery.reviewInstructions}`
          : "Open the retained deliverable in your workspace before deciding.",
      ]
    : closed
      ? [
          "FSS closed this request. This is not a client acceptance.",
          delivery.closureReason || delivery.publicSummary
            ? `Reason: ${delivery.closureReason || delivery.publicSummary}`
            : "The recorded closure reason is available in your workspace.",
          "The request history and any retained final work remain available in your workspace.",
        ]
      : [
          `A client reviewer accepted ${delivery.deliverableVersion}${acceptedOn ? ` on ${acceptedOn}` : ""}.`,
          "Your final deliverable and review history are available in your workspace.",
          delivery.publicSummary || "The accepted outcome is recorded with the request.",
        ];
  const paragraphs = [
    `Hello,`,
    `${delivery.organisationName} has an update about “${delivery.requestTitle}”.`,
    ...detail,
    "Faithful Software Solutions",
  ];
  return {
    from: "FSS <hello@faithfulsoftwaresolutions.co.uk>",
    replyTo: "j.ntagengwa@faithfulsoftware.dev",
    to: delivery.recipient,
    subject,
    html: `<main style="box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#24322d;overflow-wrap:anywhere;"><h1 style="font-size:24px;line-height:1.25;margin:0 0 24px;">${escapeHtml(heading)}</h1>${paragraphs.map((paragraph) => `<p style="margin:0 0 20px;">${escapeHtml(paragraph)}</p>`).join("")}<p style="margin:28px 0 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 18px;background:#0f7078;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">${escapeHtml(actionLabel)}</a></p></main>`,
    text: [...paragraphs, `${actionLabel}: ${actionUrl}`].join("\n\n"),
  };
}
