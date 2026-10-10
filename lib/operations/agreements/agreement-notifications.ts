import { createHash } from "node:crypto";
import { resolveSiteUrl } from "@/lib/config/site-url";
import type { OperationsDb } from "../db/client";
import { createOnboardingResendSender } from "../onboarding/resend-provider";
import type { EffectResult } from "../onboarding/types";

export type AgreementNotification = Readonly<{
  id: string;
  organisationId: string;
  offerId: string | null;
  approvalId: string | null;
  kind: "budget_request" | "offer_request" | "signing_request";
  recipient: string;
  attempts: number;
  sendVersion: number;
  title: string;
  organisationName: string;
}>;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function agreementNotificationEmail(
  notification: AgreementNotification,
): {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
} {
  const budget = notification.kind === "budget_request";
  const offer = notification.kind !== "signing_request";
  const target = offer
    ? `offers/${notification.offerId}`
    : notification.approvalId;
  const url = new URL(`/portal/agreements/${target}`, resolveSiteUrl());
  url.searchParams.set("organisationId", notification.organisationId);
  const subject = budget
    ? `Propose a budget: ${notification.title}`
    : offer
      ? `Review payment terms: ${notification.title}`
      : `Review and sign: ${notification.title}`;
  const message = budget
    ? "FSS has sent the agreement terms for your budget proposal. Review them and propose an amount in your secure workspace."
    : offer
      ? "FSS has sent the agreement terms and payment choices for your review. Choose an option in your secure workspace."
      : "FSS has approved the agreement for signing. Review the final document and sign it in your secure workspace.";
  const action = budget
    ? "Propose your budget"
    : offer
      ? "Review payment choices"
      : "Review and sign";
  const text = `${message}\n\n${action}: ${url.href}\n\nFaithful Software Solutions`;
  return {
    from: "FSS <hello@faithfulsoftwaresolutions.co.uk>",
    replyTo: "j.ntagengwa@faithfulsoftware.dev",
    to: notification.recipient,
    subject,
    text,
    html: `<main style="max-width:640px;margin:auto;padding:24px;font-family:Arial,sans-serif;line-height:1.6;color:#24322d"><h1>${escapeHtml(subject)}</h1><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(url.href)}">${escapeHtml(action)}</a></p><p>Faithful Software Solutions</p></main>`,
  };
}

export function agreementNotificationIdempotencyKey(
  id: string,
  sendVersion: number,
): string {
  return createHash("sha256")
    .update(`agreement-notification:${id}:${sendVersion}`)
    .digest("hex")
    .slice(0, 32);
}

type NotificationSender = ReturnType<typeof createOnboardingResendSender>;

export async function dispatchAgreementNotifications(
  db: OperationsDb,
  options: {
    apiKey?: string;
    sender?: NotificationSender;
    batch?: number;
  } = {},
): Promise<{ claimed: number; sent: number; held: number }> {
  const batch = options.batch ?? 20;
  if (!Number.isInteger(batch) || batch < 1 || batch > 50)
    throw new Error("Invalid notification batch.");
  const notifications = await db<AgreementNotification[]>`
    select id,organisation_id as "organisationId",offer_id as "offerId",
      approval_id as "approvalId",kind,recipient,attempts,send_version as "sendVersion",title,
      organisation_name as "organisationName"
    from operations.claim_agreement_notifications(${batch})
  `;
  const sender =
    options.sender ??
    (options.apiKey ? createOnboardingResendSender(options.apiKey) : null);
  let sent = 0;
  let held = 0;
  for (const notification of notifications) {
    const [sendable] = await db<{ allowed: boolean }[]>`
      select operations.agreement_notification_sendable(${notification.id}) as allowed
    `;
    if (!sendable?.allowed) continue;
    let result: EffectResult;
    try {
      result = sender
        ? await sender({
            lease: {
              idempotencyKey: agreementNotificationIdempotencyKey(
                notification.id,
                notification.sendVersion,
              ),
              journeyId:
                notification.offerId ??
                notification.approvalId ??
                notification.id,
              jobId: notification.id,
            },
            email: agreementNotificationEmail(notification),
          })
        : {
            status: "failed",
            code: "configuration",
            retryable: false,
            uncertain: false,
          };
    } catch {
      result = {
        status: "failed",
        code: "unknown_outcome",
        retryable: false,
        uncertain: true,
      };
    }
    if (result.status === "succeeded") {
      await db`select operations.finish_agreement_notification(${notification.id},${result.receipt.providerId},${result.receipt.acceptedAt}::timestamptz,${null},${null}::timestamptz)`;
      sent++;
    } else {
      const retryAt =
        result.retryable && !result.uncertain
          ? new Date(
              Date.now() + Math.max(result.retryAfterMs ?? 60_000, 60_000),
            )
          : null;
      await db`select operations.finish_agreement_notification(${notification.id},${null},${null}::timestamptz,${result.uncertain ? "unknown_outcome" : result.code},${retryAt?.toISOString() ?? null}::timestamptz)`;
      if (!retryAt) held++;
    }
  }
  return { claimed: notifications.length, sent, held };
}
